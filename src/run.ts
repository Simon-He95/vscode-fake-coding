import type * as vscode from 'vscode'
import { createRange, getConfiguration, getPosition, nextTick, updateText } from '@vscode-use/utils/index'
import { codingMap } from './utils'

let index = 0
let timer: NodeJS.Timeout
let stop = false
export function reset() {
  index = 0
  clearInterval(timer)
  stop = true
}
const interval = getConfiguration('fake-coding.interval') as number
export async function runFakeCoding(url: vscode.Uri) {
  reset()
  stop = false
  const originCode = codingMap.get(url)!
  // 清空当前文件内容
  await updateText((edit) => {
    edit.delete(createRange(0, 0, getPosition(originCode.length).position))
  })

  // 间隔 1s 一次，去修改当前文件的内容
  nextTick(() => {
    timer = setInterval(() => {
      if (stop)
        return
      const beforeText = originCode.slice(0, index)
      const addText = originCode.slice(index, ++index)
      if (index === originCode.length) {
        // loop
        if (!stop)
          runFakeCoding(url)
        return
      }
      updateText((edit) => {
        const position = getPosition(beforeText.length, originCode).position
        edit.insert(position, addText)
      })
    }, interval)
  })
}
