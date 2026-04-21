import type { Uri } from 'vscode'
import { createRange, getActiveTextEditor, getConfiguration, getCurrentFileUrl, getPosition, jumpToLine, nextTick, setSelection, updateText } from '@vscode-use/utils'
import { stopFakeCoding } from './run'
import { codingMap } from './utils'

export async function resetCoding(url: Uri, options?: { wasDirty?: boolean }) {
  const originCode = codingMap.get(url)
  if (!originCode)
    return

  stopFakeCoding()
  const saveOnStop = getConfiguration('fake-coding.saveOnStop') as boolean
  const shouldSave = saveOnStop && !options?.wasDirty

  if (getCurrentFileUrl() === url.fsPath) {
    updateText((edit) => {
      edit.replace(createRange(0, 0, getPosition(originCode.length).position), originCode)
    })
    setSelection([0, 0], [0, 0])
    if (shouldSave)
      await nextTick(() => getActiveTextEditor()?.document.save())
  }
  else {
    const currentFileUrl = getCurrentFileUrl()
    if (currentFileUrl) {
      await jumpToLine(0, url.fsPath)
      updateText((edit) => {
        edit.replace(createRange(0, 0, getPosition(originCode.length).position), originCode)
      })
      if (shouldSave)
        await nextTick(() => getActiveTextEditor()?.document.save())
      await nextTick(() => {
        jumpToLine(0, currentFileUrl)
      })
    }
  }

  codingMap.delete(url)
}
