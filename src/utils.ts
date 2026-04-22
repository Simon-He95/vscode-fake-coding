import type { Uri } from 'vscode'
import { createLog } from '@vscode-use/utils'

export const logger = createLog('fake-coding')
export const codingMap = new Map<Uri, string>()

let internalEditDepth = 0

export function isInternalEdit() {
  return internalEditDepth > 0
}

export async function runAsInternalEdit<T>(task: () => PromiseLike<T> | T) {
  internalEditDepth += 1
  try {
    return await task()
  }
  finally {
    internalEditDepth -= 1
  }
}
