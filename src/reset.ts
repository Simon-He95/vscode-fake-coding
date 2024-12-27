import type { Uri } from 'vscode'
import * as vscode from "vscode"
import { createRange, getCurrentFileUrl, getPosition, jumpToLine, nextTick, saveFile, updateText } from '@vscode-use/utils'
import { reset } from './run'
import { codingMap } from './utils'


export async function resetCoding(url: Uri) {
  const originCode = codingMap.get(url)!
  reset()

  if (getCurrentFileUrl(true) === url) {
    // await updateText((edit) => {
    //   edit.replace(createRange(0, 0, getPosition(originCode.length).position), originCode)
    // })
    // 原先的还原有问题
    const editor = vscode.window.activeTextEditor!;
    const document = editor.document;
    const fullRange = new vscode.Range(
      document.lineAt(0).range.start,
      document.lineAt(document.lineCount - 1).range.end
    )
    await editor.edit(editBuilder => {
      editBuilder.replace(fullRange,originCode)
    })
    editor.revealRange(new vscode.Range(0,0,0,0), vscode.TextEditorRevealType.AtTop)

  }
  else {
    const currentFileUrl = getCurrentFileUrl()!
    jumpToLine(0, url.fsPath)?.then(() => {
      updateText((edit) => {
        edit.replace(createRange(0, 0, getPosition(originCode.length).position), originCode)
      })
      nextTick(() => {
        jumpToLine(0, currentFileUrl)
      })
    })
  }
  nextTick(() => {
    saveFile(true)
  })
  codingMap.delete(url)
}
