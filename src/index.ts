import { addEventListener, createBottomBar, createExtension, executeCommand, getConfiguration, registerCommand } from '@vscode-use/utils'
import * as vscode from 'vscode'
import { resetCoding } from './reset'
import { getFakeCodingSource, getFakeCodingStatus, pauseFakeCoding, resumeFakeCoding, startFakeCoding } from './run'
import { clearPersistedSession, getPersistedSession, initSessionStore, restorePersistedSession, savePersistedSession } from './sessionStore'
import { codingMap, logger } from './utils'
import { collectOpenFileUris, pickNextWanderTarget, randomBetween } from './wander'

type StartFrom = 'fileStart' | 'cursor' | 'selection'
type PresetName = 'steady' | 'realistic' | 'fastDemo' | 'slowReview'
type InteractionMode = 'follow' | 'wander'

let activeFileUrl: vscode.Uri | null = null
let autoStopTimer: NodeJS.Timeout | null = null
let wanderTimer: NodeJS.Timeout | null = null
let interactionMode: InteractionMode | null = null
let ignoreActiveTextChange = false
let wanderInFlight = false

function clearAutoStopTimer() {
  if (autoStopTimer)
    clearTimeout(autoStopTimer)
  autoStopTimer = null
}

function clearWanderTimer() {
  if (wanderTimer)
    clearTimeout(wanderTimer)
  wanderTimer = null
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function runIgnoringActiveTextChange(task: () => Promise<void> | void) {
  ignoreActiveTextChange = true
  try {
    await task()
  }
  finally {
    ignoreActiveTextChange = false
  }
}

async function stopSession(resetInteractiveMode = true) {
  clearAutoStopTimer()
  clearWanderTimer()

  if (activeFileUrl) {
    const url = activeFileUrl
    activeFileUrl = null
    const snapshot = getPersistedSession()
    await resetCoding(url, {
      wasDirty: snapshot?.fsPath === url.fsPath ? snapshot.wasDirty : false,
    })
  }

  await clearPersistedSession()
  if (resetInteractiveMode)
    interactionMode = null
}

export = createExtension(async (context, disposals = []) => {
  initSessionStore(context)
  await restorePersistedSession()

  const bar = createBottomBar({
    text: 'Fake Coding ■',
    command: 'fake-coding.toggle',
    position: 'left',
    offset: 500,
  })
  bar.show()
  disposals.push(bar)

  function formatSourceLabel(source: StartFrom) {
    return source === 'fileStart' ? 'start' : source
  }

  function refreshBar() {
    const status = getFakeCodingStatus()
    const mode = getConfiguration('fake-coding.mode') as string
    const minutes = getConfiguration('fake-coding.autoStopMinutes') as number
    const source = status === 'idle'
      ? (getConfiguration('fake-coding.startFrom') as StartFrom)
      : getFakeCodingSource()
    const icon = status === 'running'
      ? '▶'
      : status === 'paused'
        ? '⏸'
        : '■'
    const parts = [`Fake Coding ${icon}`, mode]

    if (interactionMode)
      parts.push(interactionMode)

    if (source !== 'fileStart')
      parts.push(formatSourceLabel(source))

    if (minutes > 0)
      parts.push(`${minutes}m`)

    bar.text = parts.join(' · ')
  }

  function armAutoStop() {
    clearAutoStopTimer()
    const minutes = getConfiguration('fake-coding.autoStopMinutes') as number
    if (minutes <= 0)
      return

    autoStopTimer = setTimeout(() => {
      executeCommand('fake-coding.stop')
    }, minutes * 60 * 1000)
  }

  function armWander() {
    clearWanderTimer()
    if (interactionMode !== 'wander' || getFakeCodingStatus() !== 'running')
      return

    wanderTimer = setTimeout(() => {
      void runWanderStep()
    }, randomBetween(2500, 7000))
  }

  function resolveStartRange(source: StartFrom, editor: vscode.TextEditor | undefined, strict = true) {
    if (!editor) {
      if (strict)
        logger.error('你必须在打开一个文件的状态下去使用')
      return null
    }

    const originCode = editor.document.getText()
    if (!originCode) {
      if (strict)
        logger.error('你必须对一个有内容的文件去使用')
      return null
    }

    if (source === 'fileStart') {
      return {
        startOffset: 0,
        endOffset: originCode.length,
        source,
      }
    }

    if (source === 'cursor') {
      const startOffset = editor.document.offsetAt(editor.selection.active)
      if (startOffset >= originCode.length) {
        if (!strict) {
          return {
            startOffset: 0,
            endOffset: originCode.length,
            source: 'fileStart' as const,
          }
        }
        logger.error('光标后没有可输入的内容')
        return null
      }

      return {
        startOffset,
        endOffset: originCode.length,
        source,
      }
    }

    if (editor.selection.isEmpty) {
      if (!strict)
        return resolveStartRange('cursor', editor, false)
      logger.error('你必须先选择一段内容')
      return null
    }

    const startOffset = editor.document.offsetAt(editor.selection.start)
    const endOffset = editor.document.offsetAt(editor.selection.end)
    if (startOffset >= endOffset) {
      if (!strict)
        return resolveStartRange('cursor', editor, false)
      logger.error('你必须先选择一段内容')
      return null
    }

    return {
      startOffset,
      endOffset,
      source,
    }
  }

  async function applyPreset(name: PresetName) {
    const config = vscode.workspace.getConfiguration()

    if (name === 'steady') {
      await config.update('fake-coding.mode', 'steady', vscode.ConfigurationTarget.Global)
      await config.update('fake-coding.interval', 200, vscode.ConfigurationTarget.Global)
    }
    else if (name === 'realistic') {
      await config.update('fake-coding.mode', 'realistic', vscode.ConfigurationTarget.Global)
      await config.update('fake-coding.interval', 200, vscode.ConfigurationTarget.Global)
    }
    else if (name === 'fastDemo') {
      await config.update('fake-coding.mode', 'steady', vscode.ConfigurationTarget.Global)
      await config.update('fake-coding.interval', 80, vscode.ConfigurationTarget.Global)
      await config.update('fake-coding.autoStopMinutes', 15, vscode.ConfigurationTarget.Global)
    }
    else if (name === 'slowReview') {
      await config.update('fake-coding.mode', 'realistic', vscode.ConfigurationTarget.Global)
      await config.update('fake-coding.interval', 320, vscode.ConfigurationTarget.Global)
    }

    refreshBar()
  }

  function moveWanderCursor(editor: vscode.TextEditor) {
    const maxLine = editor.document.lineCount - 1
    if (maxLine < 0)
      return

    const line = randomBetween(0, maxLine)
    const text = editor.document.lineAt(line).text
    const character = text.length > 0 ? randomBetween(0, text.length) : 0
    const position = new vscode.Position(line, character)
    const range = new vscode.Range(position, position)
    editor.selection = new vscode.Selection(position, position)
    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport)
  }

  async function startWithSource(source: StartFrom, options?: { editor?: vscode.TextEditor, mode?: InteractionMode, strict?: boolean }) {
    if (getFakeCodingStatus() !== 'idle')
      return false

    const editor = options?.editor || vscode.window.activeTextEditor
    const currentFileUrl = editor?.document.uri
    if (!currentFileUrl || !editor) {
      if (options?.strict !== false)
        logger.error('你必须在打开一个文件的状态下去使用')
      return false
    }

    const originCode = editor.document.getText()
    if (!originCode) {
      if (options?.strict !== false)
        logger.error('你必须对一个有内容的文件去使用')
      return false
    }

    const range = resolveStartRange(source, editor, options?.strict !== false)
    if (!range)
      return false

    codingMap.set(currentFileUrl, originCode)
    await savePersistedSession({
      content: originCode,
      fsPath: currentFileUrl.fsPath,
      wasDirty: editor.document.isDirty,
    })
    activeFileUrl = currentFileUrl
    interactionMode = options?.mode ?? null
    startFakeCoding(currentFileUrl, range)
    armAutoStop()
    armWander()
    refreshBar()
    return true
  }

  async function handoffToEditor(mode: InteractionMode, editor?: vscode.TextEditor) {
    const nextEditor = editor || vscode.window.activeTextEditor
    if (nextEditor && activeFileUrl && nextEditor.document.uri.fsPath === activeFileUrl.fsPath)
      return

    await stopSession(false)
    const source = ((getConfiguration('fake-coding.startFrom') as StartFrom) || 'fileStart')
    await startWithSource(source, {
      editor: nextEditor,
      mode,
      strict: false,
    })
  }

  async function runWanderStep() {
    if (interactionMode !== 'wander' || wanderInFlight || getFakeCodingStatus() !== 'running')
      return

    wanderInFlight = true
    try {
      await runIgnoringActiveTextChange(async () => {
        const nextUri = pickNextWanderTarget(collectOpenFileUris(vscode.window.tabGroups.all), activeFileUrl?.fsPath)
        if (!nextUri)
          return

        await stopSession(false)
        await delay(randomBetween(250, 900))

        const document = await vscode.workspace.openTextDocument(nextUri)
        const editor = await vscode.window.showTextDocument(document, {
          preview: false,
          preserveFocus: false,
        })

        const source = ((getConfiguration('fake-coding.startFrom') as StartFrom) || 'fileStart')
        if (source === 'fileStart')
          moveWanderCursor(editor)

        await delay(randomBetween(200, 800))
        await startWithSource(source, {
          editor,
          mode: 'wander',
          strict: false,
        })
      })
    }
    finally {
      wanderInFlight = false
      if (interactionMode === 'wander' && getFakeCodingStatus() === 'running')
        armWander()
      refreshBar()
    }
  }

  registerCommand('fake-coding.start', () => {
    const source = (getConfiguration('fake-coding.startFrom') as StartFrom) || 'fileStart'
    void startWithSource(source)
  })

  registerCommand('fake-coding.startFromCursor', () => {
    void startWithSource('cursor')
  })

  registerCommand('fake-coding.startFromSelection', () => {
    void startWithSource('selection')
  })

  registerCommand('fake-coding.startInteractive', () => {
    const source = (getConfiguration('fake-coding.startFrom') as StartFrom) || 'fileStart'
    void startWithSource(source, { mode: 'follow' })
  })

  registerCommand('fake-coding.startWander', () => {
    const source = (getConfiguration('fake-coding.startFrom') as StartFrom) || 'fileStart'
    void startWithSource(source, { mode: 'wander' })
  })

  registerCommand('fake-coding.pause', () => {
    clearWanderTimer()
    pauseFakeCoding()
    refreshBar()
  })

  registerCommand('fake-coding.resume', () => {
    resumeFakeCoding()
    armWander()
    refreshBar()
  })

  registerCommand('fake-coding.stop', async () => {
    await runIgnoringActiveTextChange(async () => {
      await stopSession()
    })
    refreshBar()
  })

  registerCommand('fake-coding.toggle', () => {
    const status = getFakeCodingStatus()
    if (status === 'idle')
      return executeCommand('fake-coding.start')
    if (status === 'running')
      return executeCommand('fake-coding.pause')
    return executeCommand('fake-coding.resume')
  })

  registerCommand('fake-coding.usePreset.steady', async () => {
    await applyPreset('steady')
  })

  registerCommand('fake-coding.usePreset.realistic', async () => {
    await applyPreset('realistic')
  })

  registerCommand('fake-coding.usePreset.fastDemo', async () => {
    await applyPreset('fastDemo')
  })

  registerCommand('fake-coding.usePreset.slowReview', async () => {
    await applyPreset('slowReview')
  })

  addEventListener('activeText-change', (editor) => {
    if (ignoreActiveTextChange)
      return

    if (interactionMode === 'follow') {
      void runIgnoringActiveTextChange(async () => {
        if (getFakeCodingStatus() === 'paused')
          await stopSession(false)
        else
          await handoffToEditor('follow', editor)
        refreshBar()
      })
      return
    }

    if (interactionMode === 'wander') {
      void runIgnoringActiveTextChange(async () => {
        clearWanderTimer()
        if (getFakeCodingStatus() === 'paused')
          await stopSession(false)
        else
          await handoffToEditor('wander', editor)
        refreshBar()
      })
      return
    }

    if (getFakeCodingStatus() !== 'idle') {
      void runIgnoringActiveTextChange(async () => {
        await stopSession()
        refreshBar()
      })
    }
  })

  refreshBar()
}, () => {
  void runIgnoringActiveTextChange(async () => {
    await stopSession()
  })
})
