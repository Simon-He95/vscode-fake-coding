import type * as vscode from 'vscode'
import { createRange, getConfiguration, getPosition, nextTick, setSelection, updateText } from '@vscode-use/utils'
import { codingMap } from './utils'

export type FakeCodingStatus = 'idle' | 'running' | 'paused'
type Mode = 'steady' | 'realistic'

const session = {
  status: 'idle' as FakeCodingStatus,
  index: 0,
  timer: null as NodeJS.Timeout | null,
  url: null as vscode.Uri | null,
  pauseCountdown: 0,
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

function getNextDelay(originCode: string) {
  const interval = getConfiguration('fake-coding.interval') as number
  const mode = getConfiguration('fake-coding.mode') as Mode
  if (mode === 'steady')
    return interval

  const char = originCode[session.index] ?? ''
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

function scheduleNextTick() {
  if (session.status !== 'running' || !session.url)
    return

  const originCode = codingMap.get(session.url)
  if (!originCode)
    return

  session.timer = setTimeout(() => {
    if (session.status !== 'running' || !session.url)
      return

    if (session.index >= originCode.length) {
      session.index = 0
      updateText((edit) => {
        edit.delete(createRange(0, 0, getPosition(originCode.length).position))
      })
      scheduleNextTick()
      return
    }

    const beforeText = originCode.slice(0, session.index)
    const addText = originCode[session.index]
    const position = getPosition(beforeText.length, originCode).position
    updateText((edit) => {
      edit.insert(position, addText)
      setSelection(position, position)
    })

    session.index += 1
    scheduleNextTick()
  }, getNextDelay(originCode))
}

export function getFakeCodingStatus() {
  return session.status
}

export function startFakeCoding(url: vscode.Uri) {
  const originCode = codingMap.get(url)
  if (!originCode)
    return

  clearTimer()
  session.status = 'running'
  session.index = 0
  session.url = url
  resetPauseCountdown()

  updateText((edit) => {
    edit.delete(createRange(0, 0, getPosition(originCode.length).position))
  })

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
  resetPauseCountdown()
}
