import type { Uri } from 'vscode'
import { addEventListener, createBottomBar, createExtension, executeCommand, getActiveText, getConfiguration, getCurrentFileUrl, registerCommand } from '@vscode-use/utils'
import { resetCoding } from './reset'
import { getFakeCodingStatus, pauseFakeCoding, resumeFakeCoding, startFakeCoding } from './run'
import { codingMap, logger } from './utils'

export = createExtension(() => {
  let activeFileUrl: Uri | null = null
  let autoStopTimer: NodeJS.Timeout | null = null
  const bar = createBottomBar({
    text: 'Fake Coding ■',
    command: 'fake-coding.toggle',
    position: 'left',
    offset: 500,
  })
  bar.show()

  function clearAutoStopTimer() {
    if (autoStopTimer)
      clearTimeout(autoStopTimer)
    autoStopTimer = null
  }

  function refreshBar() {
    const status = getFakeCodingStatus()
    bar.text = status === 'running'
      ? 'Fake Coding ▶'
      : status === 'paused'
        ? 'Fake Coding ⏸'
        : 'Fake Coding ■'
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

  registerCommand('fake-coding.start', () => {
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

    codingMap.set(currentFileUrl, originCode)
    activeFileUrl = currentFileUrl
    startFakeCoding(currentFileUrl)
    armAutoStop()
    refreshBar()
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
    clearAutoStopTimer()

    if (activeFileUrl) {
      const url = activeFileUrl
      activeFileUrl = null
      await resetCoding(url)
    }

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

  addEventListener('activeText-change', () => {
    if (getFakeCodingStatus() !== 'idle')
      executeCommand('fake-coding.stop')
  })

  refreshBar()
}, () => {

})
