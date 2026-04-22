import type { Uri } from 'vscode'
import { getConfiguration, getCurrentFileUrl, setSelection } from '@vscode-use/utils'
import * as vscode from 'vscode'
import { stopFakeCoding, waitForPendingFakeCodingEdit } from './run'
import { codingMap, logger, runAsInternalEdit } from './utils'

function createFullRange(document: vscode.TextDocument) {
  const lastLine = Math.max(document.lineCount - 1, 0)
  const endCharacter = document.lineAt(lastLine).text.length
  return new vscode.Range(0, 0, lastLine, endCharacter)
}

export async function resetCoding(url: Uri, options?: { wasDirty?: boolean }) {
  const originCode = codingMap.get(url)
  if (!originCode)
    return true

  stopFakeCoding()
  await waitForPendingFakeCodingEdit()
  const saveOnStop = getConfiguration('fake-coding.saveOnStop') as boolean
  const shouldSave = saveOnStop && !options?.wasDirty
  const isCurrentFile = getCurrentFileUrl() === url.fsPath

  try {
    const document = await vscode.workspace.openTextDocument(url)
    const edit = new vscode.WorkspaceEdit()
    edit.replace(url, createFullRange(document), originCode)
    const applied = await runAsInternalEdit(() => vscode.workspace.applyEdit(edit))
    if (!applied) {
      logger.error(`failed to restore fake coding content: ${url.fsPath}`)
      return false
    }

    if (isCurrentFile)
      setSelection([0, 0], [0, 0])

    if (shouldSave)
      await document.save()

    codingMap.delete(url)
    return true
  }
  catch (error) {
    logger.error(`failed to reset fake coding session: ${String(error)}`)
    return false
  }
}
