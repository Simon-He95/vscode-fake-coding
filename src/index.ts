import { addEventListener, createBottomBar, createExtension, executeCommand, getActiveText, getConfiguration, getCurrentFileUrl, registerCommand } from '@vscode-use/utils'
import * as vscode from 'vscode'
import { resetCoding } from './reset'
import { getFakeCodingSource, getFakeCodingStatus, pauseFakeCoding, resumeFakeCoding, startFakeCoding } from './run'
import { codingMap, logger } from './utils'

type StartFrom = 'fileStart' | 'cursor' | 'selection'
type PresetName = 'steady' | 'realistic' | 'fastDemo' | 'slowReview'

let activeFileUrl: vscode.Uri | null = null
let autoStopTimer: NodeJS.Timeout | null = null

function clearAutoStopTimer() {
  if (autoStopTimer)
    clearTimeout(autoStopTimer)
  autoStopTimer = null
}

async function stopSession() {
  clearAutoStopTimer()

  if (activeFileUrl) {
    const url = activeFileUrl
    activeFileUrl = null
    await resetCoding(url)
  }
}

export = createExtension((_context, disposals = []) => {
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

  function resolveStartRange(source: StartFrom) {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      logger.error('你必须在打开一个文件的状态下去使用')
      return null
    }

    const originCode = editor.document.getText()
    if (!originCode) {
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
      logger.error('你必须先选择一段内容')
      return null
    }

    const startOffset = editor.document.offsetAt(editor.selection.start)
    const endOffset = editor.document.offsetAt(editor.selection.end)
    if (startOffset >= endOffset) {
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

  function startWithSource(source: StartFrom) {
    if (getFakeCodingStatus() !== 'idle')
      return

    const currentFileUrl = getCurrentFileUrl(true)
    if (!currentFileUrl) {
      logger.error('你必须在打开一个文件的状态下去使用')
      return
    }

    const originCode = getActiveText()
    if (!originCode) {
      logger.error('你必须对一个有内容的文件去使用')
      return
    }

    const range = resolveStartRange(source)
    if (!range)
      return

    codingMap.set(currentFileUrl, originCode)
    activeFileUrl = currentFileUrl
    startFakeCoding(currentFileUrl, range)
    armAutoStop()
    refreshBar()
  }

  registerCommand('fake-coding.start', () => {
    const source = (getConfiguration('fake-coding.startFrom') as StartFrom) || 'fileStart'
    startWithSource(source)
  })

  registerCommand('fake-coding.startFromCursor', () => {
    startWithSource('cursor')
  })

  registerCommand('fake-coding.startFromSelection', () => {
    startWithSource('selection')
  })

  registerCommand('fake-coding.pause', () => {
    pauseFakeCoding()
    refreshBar()
  })

  registerCommand('fake-coding.resume', () => {
    resumeFakeCoding()
    refreshBar()
  })

  registerCommand('fake-coding.stop', async () => {
    await stopSession()
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

  addEventListener('activeText-change', () => {
    if (getFakeCodingStatus() !== 'idle')
      executeCommand('fake-coding.stop')
  })

  refreshBar()
}, () => {
  void stopSession()
})
