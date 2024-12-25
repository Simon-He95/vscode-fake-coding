import type { Uri } from 'vscode'
import { addEventListener, createBottomBar, createExtension, executeCommand, getActiveText, getCurrentFileUrl, registerCommand } from '@vscode-use/utils'
import { resetCoding } from './reset'
import { runFakeCoding } from './run'
import { codingMap, logger } from './utils'

export = createExtension(() => {
  let isOpen = false
  const bar = createBottomBar({
    text: `Fake Coding ${isOpen ? '✅' : '❎'}`,
    command: 'fake-coding.toggle',
    position: 'left',
    offset: 500,
  })
  bar.show()
  let activeFileUrl: Uri
  registerCommand('fake-coding.toggle', () => {
    const currentFileUrl = getCurrentFileUrl(true)
    if (isOpen && activeFileUrl) {
      resetCoding(activeFileUrl)
      isOpen = !isOpen
      bar.text = `Fake Coding ${isOpen ? '✅' : '❎'}`
      return
    }
    if (!currentFileUrl) {
      logger.error('你必须在打开一个文件的状态下去使用')
      return
    }
    if (!codingMap.has(currentFileUrl)) {
      const originCode = getActiveText()!
      if (!originCode) {
        logger.error('你必须对一个有内容的文件去使用')
        return
      }
      codingMap.set(currentFileUrl, originCode)
    }

    if (!activeFileUrl) {
      activeFileUrl = currentFileUrl
    }
    isOpen = !isOpen
    bar.text = `Fake Coding ${isOpen ? '✅' : '❎'}`

    if (isOpen) {
      runFakeCoding(activeFileUrl)
    }
    activeFileUrl = currentFileUrl
  })

  addEventListener('activeText-change', () => {
    if (isOpen && activeFileUrl) {
      executeCommand('fake-coding.toggle')
    }
  })
}, () => {

})
