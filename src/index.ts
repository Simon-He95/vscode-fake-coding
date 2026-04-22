import { addEventListener, createBottomBar, createExtension, executeCommand, getConfiguration, registerCommand } from '@vscode-use/utils'
import * as vscode from 'vscode'
import { applyManualEditsToOrigin } from './manualEdit'
import { resetCoding } from './reset'
import { getFakeCodingProgress, getFakeCodingSource, getFakeCodingStatus, onFakeCodingStatusChange, pauseFakeCoding, resumeFakeCoding, startFakeCoding, stopFakeCoding } from './run'
import { clearPersistedSession, getPersistedSession, initSessionStore, restorePersistedSession, savePersistedSession } from './sessionStore'
import { codingMap, isInternalEdit, logger, runAsInternalEdit } from './utils'
import { collectOpenFileUris, isWanderLanguageAllowed, listWanderTargets, matchesWanderIgnorePath, randomBetween, resolveActivityWindow } from './wander'

type StartFrom = 'fileStart' | 'cursor' | 'selection'
type PresetName = 'steady' | 'realistic' | 'fastDemo' | 'slowReview'
type InteractionMode = 'follow' | 'wander'
type StartMode = 'single' | InteractionMode

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

function isCurrentActiveFile(editor?: vscode.TextEditor) {
  return !!editor && !!activeFileUrl && editor.document.uri.fsPath === activeFileUrl.fsPath
}

function getNumericConfiguration(key: string, fallback: number, min = 0) {
  const value = Number(getConfiguration(key))
  if (!Number.isFinite(value))
    return fallback
  return Math.max(min, Math.round(value))
}

function isSessionActive(status = getFakeCodingStatus()) {
  return status !== 'idle'
}

function canAutoHandoff(status = getFakeCodingStatus()) {
  return status === 'running' || status === 'waiting'
}

function createFullRange(document: vscode.TextDocument) {
  const lastLine = Math.max(document.lineCount - 1, 0)
  const endCharacter = document.lineAt(lastLine).text.length
  return new vscode.Range(0, 0, lastLine, endCharacter)
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

async function abandonSession(document?: vscode.TextDocument, content?: string) {
  clearAutoStopTimer()
  clearWanderTimer()
  stopFakeCoding()
  let preserved = true

  if (document && typeof content === 'string') {
    const edit = new vscode.WorkspaceEdit()
    edit.replace(document.uri, createFullRange(document), content)
    const applied = await runAsInternalEdit(() => vscode.workspace.applyEdit(edit))
    if (!applied)
      logger.error(`failed to preserve manual changes after fake coding: ${document.uri.fsPath}`)
    preserved = applied
  }

  if (activeFileUrl)
    codingMap.delete(activeFileUrl)
  activeFileUrl = null
  interactionMode = null
  await clearPersistedSession()
  return preserved
}

async function stopSession(resetInteractiveMode = true) {
  clearAutoStopTimer()
  clearWanderTimer()

  if (activeFileUrl) {
    const url = activeFileUrl
    const snapshot = getPersistedSession()
    const restored = await resetCoding(url, {
      wasDirty: snapshot?.fsPath === url.fsPath ? snapshot.wasDirty : false,
    })
    if (!restored) {
      logger.error(`failed to stop fake coding safely: ${url.fsPath}`)
      return false
    }

    activeFileUrl = null
    await clearPersistedSession()
  }
  if (resetInteractiveMode)
    interactionMode = null
  return true
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
  onFakeCodingStatusChange(() => {
    armWander()
    refreshBar()
  })

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
      : status === 'waiting'
        ? '…'
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
    if (interactionMode !== 'wander' || !canAutoHandoff())
      return

    const minSeconds = getNumericConfiguration('fake-coding.wanderMinSeconds', 9, 1)
    const maxSeconds = getNumericConfiguration('fake-coding.wanderMaxSeconds', 18, 1)
    const minDelay = Math.min(minSeconds, maxSeconds) * 1000
    const maxDelay = Math.max(minSeconds, maxSeconds) * 1000

    wanderTimer = setTimeout(() => {
      void runWanderStep()
    }, randomBetween(minDelay, maxDelay))
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

  function resolveInteractiveRange(editor: vscode.TextEditor | undefined, strict = true) {
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

    const minWindow = getNumericConfiguration('fake-coding.activityMinChars', 40, 12)
    const maxWindow = getNumericConfiguration('fake-coding.activityMaxChars', 80, 12)
    const cursorOffset = editor.document.offsetAt(editor.selection.active)
    const { startOffset, endOffset } = resolveActivityWindow(originCode, cursorOffset, minWindow, maxWindow)
    const source = startOffset === 0 && endOffset === originCode.length
      ? 'fileStart' as const
      : 'cursor' as const

    return {
      startOffset,
      endOffset,
      loop: false,
      source,
    }
  }

  function resolveSessionRange(source: StartFrom, editor: vscode.TextEditor | undefined, mode?: InteractionMode, strict = true) {
    if (mode && source === 'fileStart')
      return resolveInteractiveRange(editor, strict)

    return resolveStartRange(source, editor, strict)
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

  function getStringArrayConfiguration(key: string) {
    const values = getConfiguration(key) as string[] | undefined
    return values ?? []
  }

  function canWanderIntoDocument(document: vscode.TextDocument) {
    const skipDirtyFiles = (getConfiguration('fake-coding.wanderSkipDirtyFiles') as boolean) !== false
    if (skipDirtyFiles && document.isDirty)
      return false

    const ignorePaths = getStringArrayConfiguration('fake-coding.wanderIgnorePaths')
    if (matchesWanderIgnorePath(document.uri.fsPath, ignorePaths))
      return false

    const allowLanguages = getStringArrayConfiguration('fake-coding.wanderAllowLanguages')
    if (!isWanderLanguageAllowed(document.languageId, allowLanguages))
      return false

    const maxFileChars = getNumericConfiguration('fake-coding.wanderMaxFileChars', 0, 0)
    if (maxFileChars > 0 && document.getText().length > maxFileChars)
      return false

    return true
  }

  async function findNextWanderEditor(currentFsPath?: string | null) {
    const candidates = listWanderTargets(collectOpenFileUris(vscode.window.tabGroups.all), currentFsPath)

    for (const candidate of candidates) {
      const document = await vscode.workspace.openTextDocument(candidate)
      if (!canWanderIntoDocument(document))
        continue

      const editor = await vscode.window.showTextDocument(document, {
        preview: false,
        preserveFocus: false,
      })

      return editor
    }

    return null
  }

  function setEditorCursor(editor: vscode.TextEditor, position: vscode.Position) {
    const range = new vscode.Range(position, position)
    editor.selection = new vscode.Selection(position, position)
    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport)
  }

  function moveWanderCursor(editor: vscode.TextEditor, options?: { random?: boolean, spread?: number }) {
    const maxLine = editor.document.lineCount - 1
    if (maxLine < 0)
      return

    const currentLine = editor.selection.active.line
    const spread = options?.spread ?? 8
    const minLine = Math.max(0, currentLine - spread)
    const maxNearLine = Math.min(maxLine, currentLine + spread)
    const line = options?.random
      ? randomBetween(0, maxLine)
      : randomBetween(minLine, maxNearLine)
    const text = editor.document.lineAt(line).text
    const character = text.length > 0 ? randomBetween(0, text.length) : 0
    const position = new vscode.Position(line, character)
    setEditorCursor(editor, position)
  }

  async function driftCursor(editor: vscode.TextEditor, options?: { randomFirst?: boolean, spread?: number, steps?: number }) {
    const steps = options?.steps ?? 2
    for (let index = 0; index < steps; index += 1) {
      moveWanderCursor(editor, {
        random: !!options?.randomFirst && index === 0,
        spread: options?.spread,
      })
      if (index < steps - 1)
        await delay(randomBetween(220, 650))
    }
  }

  async function pickStartMode(): Promise<StartMode | null> {
    const source = ((getConfiguration('fake-coding.startFrom') as StartFrom) || 'fileStart')
    const choice = await vscode.window.showQuickPick([
      {
        label: 'Current File',
        description: `Start in the current file from ${formatSourceLabel(source)}`,
        mode: 'single' as const,
      },
      {
        label: 'Follow Active File',
        description: 'Follow the file you switch to manually',
        mode: 'follow' as const,
      },
      {
        label: 'Auto Wander',
        description: 'Automatically switch across opened file tabs',
        mode: 'wander' as const,
      },
    ], {
      placeHolder: 'Choose how fake coding should start',
    })

    return choice?.mode ?? null
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

    const range = resolveSessionRange(source, editor, options?.mode, options?.strict !== false)
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
    startFakeCoding(currentFileUrl, {
      ...range,
      loop: !options?.mode,
    })
    armAutoStop()
    armWander()
    refreshBar()
    return true
  }

  async function handoffToEditor(mode: InteractionMode, editor?: vscode.TextEditor) {
    const nextEditor = editor || vscode.window.activeTextEditor
    if (nextEditor && activeFileUrl && nextEditor.document.uri.fsPath === activeFileUrl.fsPath)
      return true

    const restored = await stopSession(false)
    if (!restored)
      return false

    const source = ((getConfiguration('fake-coding.startFrom') as StartFrom) || 'fileStart')
    return startWithSource(source, {
      editor: nextEditor,
      mode,
      strict: false,
    })
  }

  async function runWanderStep() {
    if (interactionMode !== 'wander' || wanderInFlight || !canAutoHandoff())
      return

    wanderInFlight = true
    try {
      await runIgnoringActiveTextChange(async () => {
        const previousUrl = activeFileUrl
        const snapshot = getPersistedSession()
        const previousEditor = vscode.window.activeTextEditor
        const previousStatus = getFakeCodingStatus()
        if (previousUrl && previousStatus === 'running')
          pauseFakeCoding()

        try {
          if (previousEditor && previousUrl && previousEditor.document.uri.fsPath === previousUrl.fsPath)
            await driftCursor(previousEditor, { spread: 6, steps: randomBetween(1, 2) })

          await delay(randomBetween(900, 1800))

          const editor = await findNextWanderEditor(previousUrl?.fsPath)
          if (!editor) {
            if (previousStatus === 'running')
              resumeFakeCoding()
            return
          }

          const source = ((getConfiguration('fake-coding.startFrom') as StartFrom) || 'fileStart')
          await driftCursor(editor, {
            randomFirst: true,
            spread: 10,
            steps: randomBetween(2, 3),
          })

          if (previousUrl) {
            const restored = await resetCoding(previousUrl, {
              wasDirty: snapshot?.fsPath === previousUrl.fsPath ? snapshot.wasDirty : false,
            })
            if (!restored) {
              logger.error(`failed to restore previous file during wander: ${previousUrl.fsPath}`)
              return
            }

            activeFileUrl = null
            await clearPersistedSession()
          }

          await delay(randomBetween(450, 1200))
          await startWithSource(source, {
            editor,
            mode: 'wander',
            strict: false,
          })
        }
        catch (error) {
          if (previousUrl) {
            const restored = await resetCoding(previousUrl, {
              wasDirty: snapshot?.fsPath === previousUrl.fsPath ? snapshot.wasDirty : false,
            })
            if (restored) {
              activeFileUrl = null
              await clearPersistedSession()
            }
          }
          logger.error(`wander step failed: ${String(error)}`)
        }
      })
    }
    finally {
      wanderInFlight = false
      if (interactionMode === 'wander' && canAutoHandoff() && !wanderTimer)
        armWander()
      refreshBar()
    }
  }

  registerCommand('fake-coding.start', () => {
    const source = (getConfiguration('fake-coding.startFrom') as StartFrom) || 'fileStart'
    void runIgnoringActiveTextChange(async () => {
      await startWithSource(source)
    })
  })

  registerCommand('fake-coding.startFromCursor', () => {
    void runIgnoringActiveTextChange(async () => {
      await startWithSource('cursor')
    })
  })

  registerCommand('fake-coding.startFromSelection', () => {
    void runIgnoringActiveTextChange(async () => {
      await startWithSource('selection')
    })
  })

  registerCommand('fake-coding.startInteractive', () => {
    const source = (getConfiguration('fake-coding.startFrom') as StartFrom) || 'fileStart'
    void runIgnoringActiveTextChange(async () => {
      await startWithSource(source, { mode: 'follow' })
    })
  })

  registerCommand('fake-coding.startWander', () => {
    const source = (getConfiguration('fake-coding.startFrom') as StartFrom) || 'fileStart'
    void runIgnoringActiveTextChange(async () => {
      await startWithSource(source, { mode: 'wander' })
    })
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
    if (status === 'idle') {
      return runIgnoringActiveTextChange(async () => {
        const mode = await pickStartMode()
        if (!mode)
          return

        const source = (getConfiguration('fake-coding.startFrom') as StartFrom) || 'fileStart'
        await startWithSource(source, mode === 'single' ? undefined : { mode })
      })
    }
    if (status === 'running' || status === 'waiting')
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

  disposals.push(vscode.workspace.onDidChangeTextDocument((event) => {
    if (ignoreActiveTextChange || isInternalEdit() || !activeFileUrl || !isSessionActive())
      return

    if (event.document.uri.fsPath !== activeFileUrl.fsPath || event.contentChanges.length === 0)
      return

    const originCode = codingMap.get(activeFileUrl)
    const progress = getFakeCodingProgress()
    if (!originCode || !progress)
      return

    void runIgnoringActiveTextChange(async () => {
      const preservedContent = applyManualEditsToOrigin(originCode, event.contentChanges.map(change => ({
        rangeLength: change.rangeLength,
        rangeOffset: change.rangeOffset,
        text: change.text,
      })), progress)

      if (preservedContent === null) {
        await abandonSession()
        logger.warn(`manual edit stopped fake coding without auto-restore: ${event.document.uri.fsPath}`)
        refreshBar()
        return
      }

      const stopped = await abandonSession(
        event.document,
        preservedContent === event.document.getText() ? undefined : preservedContent,
      )
      if (stopped)
        logger.warn(`manual edit stopped fake coding and preserved changes: ${event.document.uri.fsPath}`)
      refreshBar()
    })
  }))

  addEventListener('activeText-change', (editor) => {
    if (ignoreActiveTextChange)
      return

    if (isCurrentActiveFile(editor))
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
        else if (canAutoHandoff())
          await handoffToEditor('wander', editor)
        refreshBar()
      })
      return
    }

    if (isSessionActive()) {
      void runIgnoringActiveTextChange(async () => {
        await stopSession()
        refreshBar()
      })
    }
  })

  refreshBar()
}, () => {
  onFakeCodingStatusChange()
  void runIgnoringActiveTextChange(async () => {
    await stopSession()
  })
})
