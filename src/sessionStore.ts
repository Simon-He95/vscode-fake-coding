import * as vscode from 'vscode'
import { logger, runAsInternalEdit } from './utils'

const SESSION_SNAPSHOT_KEY = 'fake-coding.active-snapshot'

interface PersistedSessionSnapshot {
  content: string
  fsPath: string
  wasDirty: boolean
}

let workspaceState: vscode.Memento | null = null

function createFullRange(document: vscode.TextDocument) {
  const lastLine = Math.max(document.lineCount - 1, 0)
  const endCharacter = document.lineAt(lastLine).text.length
  return new vscode.Range(0, 0, lastLine, endCharacter)
}

function isMissingFileError(error: unknown) {
  if (!error)
    return false

  const code = typeof error === 'object' && 'code' in error ? String(error.code) : ''
  const name = typeof error === 'object' && 'name' in error ? String(error.name) : ''
  const message = error instanceof Error ? error.message : String(error)

  return code === 'FileNotFound'
    || name.includes('FileNotFound')
    || name.includes('EntryNotFound')
    || /\bENOENT\b/i.test(message)
    || /no such file/i.test(message)
}

export function initSessionStore(context: vscode.ExtensionContext) {
  workspaceState = context.workspaceState
}

export function getPersistedSession() {
  return workspaceState?.get<PersistedSessionSnapshot>(SESSION_SNAPSHOT_KEY)
}

export async function savePersistedSession(snapshot: PersistedSessionSnapshot) {
  await workspaceState?.update(SESSION_SNAPSHOT_KEY, snapshot)
}

export async function clearPersistedSession() {
  await workspaceState?.update(SESSION_SNAPSHOT_KEY, undefined)
}

export async function restorePersistedSession() {
  const snapshot = getPersistedSession()
  if (!snapshot)
    return false

  try {
    const uri = vscode.Uri.file(snapshot.fsPath)
    try {
      await vscode.workspace.fs.stat(uri)
    }
    catch (error) {
      if (!isMissingFileError(error))
        throw error

      await clearPersistedSession()
      logger.warn(`discarded missing fake coding snapshot: ${snapshot.fsPath}`)
      return false
    }

    const document = await vscode.workspace.openTextDocument(uri)
    const edit = new vscode.WorkspaceEdit()
    edit.replace(uri, createFullRange(document), snapshot.content)
    const applied = await runAsInternalEdit(() => vscode.workspace.applyEdit(edit))
    if (!applied) {
      logger.error(`failed to apply fake coding snapshot: ${snapshot.fsPath}`)
      return false
    }

    if (!snapshot.wasDirty)
      await document.save()

    await clearPersistedSession()
    logger.info(`restored fake coding snapshot: ${snapshot.fsPath}`)
    return true
  }
  catch (error) {
    logger.error(`failed to restore fake coding snapshot: ${String(error)}`)
    return false
  }
}
