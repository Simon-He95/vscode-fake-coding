import type * as vscode from 'vscode'
import { createRange, getConfiguration, getPosition, nextTick, setSelection, updateText } from '@vscode-use/utils'
import { codingMap } from './utils'

export type FakeCodingStatus = 'idle' | 'running' | 'paused'
export type FakeCodingSource = 'fileStart' | 'cursor' | 'selection'
type Mode = 'steady' | 'realistic'

export interface FakeCodingRange {
  startOffset: number
  endOffset: number
  source: FakeCodingSource
}

const session = {
  status: 'idle' as FakeCodingStatus,
  index: 0,
  timer: null as NodeJS.Timeout | null,
  url: null as vscode.Uri | null,
  pauseCountdown: 0,
  startOffset: 0,
  endOffset: 0,
  source: 'fileStart' as FakeCodingSource,
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function clearTimer() {
  if (session.timer)
    clearTimeout(session.timer)
  session.timer = null
}

function resetPauseCountdown() {
  session.pauseCountdown = randomBetween(20, 40)
}

function getNextDelay(segment: string) {
  const interval = getConfiguration('fake-coding.interval') as number
  const mode = getConfiguration('fake-coding.mode') as Mode
  if (mode === 'steady')
    return interval

  const char = segment[session.index] ?? ''
  let delay = Math.round(interval * (0.7 + Math.random() * 0.6))

  if (',.;:)]}'.includes(char))
    delay += randomBetween(150, 300)

  if (char === '\n')
    delay += randomBetween(300, 600)

  session.pauseCountdown -= 1
  if (session.pauseCountdown <= 0) {
    delay += randomBetween(400, 900)
    resetPauseCountdown()
  }

  return delay
}

function clearSegment(originCode: string) {
  const start = getPosition(session.startOffset, originCode).position
  const end = getPosition(session.endOffset, originCode).position
  updateText((edit) => {
    edit.delete(createRange(start, end))
  })
}

function scheduleNextTick() {
  if (session.status !== 'running' || !session.url)
    return

  const originCode = codingMap.get(session.url)
  if (!originCode)
    return
  const segment = originCode.slice(session.startOffset, session.endOffset)

  session.timer = setTimeout(() => {
    if (session.status !== 'running' || !session.url)
      return

    if (session.index >= segment.length) {
      session.index = 0
      clearSegment(originCode)
      scheduleNextTick()
      return
    }

    const beforeText = segment.slice(0, session.index)
    const addText = segment[session.index]
    const offset = session.startOffset + beforeText.length
    const position = getPosition(offset, originCode).position
    updateText((edit) => {
      edit.insert(position, addText)
      setSelection(position, position)
    })

    session.index += 1
    scheduleNextTick()
  }, getNextDelay(segment))
}

export function getFakeCodingStatus() {
  return session.status
}

export function getFakeCodingSource() {
  return session.source
}

export function startFakeCoding(url: vscode.Uri, range: FakeCodingRange) {
  const originCode = codingMap.get(url)
  if (!originCode || range.endOffset <= range.startOffset)
    return

  clearTimer()
  session.status = 'running'
  session.index = 0
  session.url = url
  session.startOffset = range.startOffset
  session.endOffset = range.endOffset
  session.source = range.source
  resetPauseCountdown()

  clearSegment(originCode)

  nextTick(() => {
    scheduleNextTick()
  })
}

export function pauseFakeCoding() {
  if (session.status !== 'running')
    return

  clearTimer()
  session.status = 'paused'
}

export function resumeFakeCoding() {
  if (session.status !== 'paused')
    return

  session.status = 'running'
  scheduleNextTick()
}

export function stopFakeCoding() {
  clearTimer()
  session.status = 'idle'
  session.index = 0
  session.url = null
  session.startOffset = 0
  session.endOffset = 0
  session.source = 'fileStart'
  resetPauseCountdown()
}
