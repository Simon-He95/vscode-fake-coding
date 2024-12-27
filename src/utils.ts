import type { Uri } from 'vscode'
import { createLog } from '@vscode-use/utils'
import * as vscode from 'vscode'
export const logger = createLog('fake-coding')
export const codingMap = new Map<Uri, string>()
export const centerCursorInViewport = (editor:vscode.TextEditor)=>{
    const cursorPosition = editor.selection.active.line
    editor.revealRange(
        new vscode.Range(cursorPosition,0,cursorPosition,Number.MAX_SAFE_INTEGER),
        vscode.TextEditorRevealType.InCenter
    )
}