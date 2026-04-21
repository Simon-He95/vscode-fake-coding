import type { Uri } from 'vscode'
import { createRange, getConfiguration, getCurrentFileUrl, getPosition, jumpToLine, nextTick, saveFile, setSelection, updateText } from '@vscode-use/utils'
import { stopFakeCoding } from './run'
import { codingMap } from './utils'

export async function resetCoding(url: Uri) {
  const originCode = codingMap.get(url)
  if (!originCode)
    return

  stopFakeCoding()

  if (getCurrentFileUrl(true) === url) {
    updateText((edit) => {
      edit.replace(createRange(0, 0, getPosition(originCode.length).position), originCode)
    })
    setSelection([0, 0], [0, 0])
  }
  else {
    const currentFileUrl = getCurrentFileUrl()
    if (currentFileUrl) {
      jumpToLine(0, url.fsPath)?.then(() => {
        updateText((edit) => {
          edit.replace(createRange(0, 0, getPosition(originCode.length).position), originCode)
        })
        nextTick(() => {
          jumpToLine(0, currentFileUrl)
        })
      })
    }
  }

  const saveOnStop = getConfiguration('fake-coding.saveOnStop') as boolean
  if (saveOnStop) {
    nextTick(() => {
      saveFile(true)
    })
  }

  codingMap.delete(url)
}
