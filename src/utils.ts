import type { Uri } from 'vscode'
import { createLog } from '@vscode-use/utils'

export const logger = createLog('fake-coding')
export const codingMap = new Map<Uri, string>()
