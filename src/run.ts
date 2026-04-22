import { createRange, getConfiguration, getPosition, nextTick, setSelection } from '@vscode-use/utils'
import * as vscode from 'vscode'
import { codingMap, runAsInternalEdit } from './utils'

export type FakeCodingStatus = 'idle' | 'running' | 'paused' | 'waiting'
export type FakeCodingSource = 'fileStart' | 'cursor' | 'selection'
type Mode = 'steady' | 'realistic'

export interface FakeCodingRange {
  startOffset: number
  endOffset: number
  loop?: boolean
  source: FakeCodingSource
}

export interface FakeCodingProgress {
  endOffset: number
  startOffset: number
  typedLength: number
}

const session = {
  status: 'idle' as FakeCodingStatus,
  index: 0,
  timer: null as NodeJS.Timeout | null,
  url: null as vscode.Uri | null,
  pendingEdit: null as Promise<boolean> | null,
  pauseCountdown: 0,
  loop: true,
  startOffset: 0,
  endOffset: 0,
  source: 'fileStart' as FakeCodingSource,
}
let statusChangeListener: ((status: FakeCodingStatus) => void) | null = null

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function setStatus(status: FakeCodingStatus) {
  session.status = status
  statusChangeListener?.(status)
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

async function applyActiveEditorEdit(callback: Parameters<vscode.TextEditor['edit']>[0]) {
  const editor = vscode.window.activeTextEditor
  if (!editor)
    return false

  const pendingEdit = runAsInternalEdit(() => editor.edit(callback))
  session.pendingEdit = pendingEdit

  try {
    return await pendingEdit
  }
  finally {
    if (session.pendingEdit === pendingEdit)
      session.pendingEdit = null
  }
}

function clearSegment(originCode: string) {
  const start = getPosition(session.startOffset, originCode).position
  const end = getPosition(session.endOffset, originCode).position
  return applyActiveEditorEdit((edit) => {
    edit.delete(createRange(start, end))
  })
}

function getCurrentSegmentLength() {
  if (!session.url)
    return 0

  const originCode = codingMap.get(session.url)
  if (!originCode)
    return 0

  return originCode.slice(session.startOffset, session.endOffset).length
}

function scheduleNextTick() {
  if (session.status !== 'running' || !session.url)
    return

  const originCode = codingMap.get(session.url)
  if (!originCode)
    return
  const segment = originCode.slice(session.startOffset, session.endOffset)

  session.timer = setTimeout(async () => {
    if (session.status !== 'running' || !session.url)
      return

    if (session.index >= segment.length) {
      if (!session.loop) {
        clearTimer()
        setStatus('waiting')
        return
      }

      session.index = 0
      const cleared = await clearSegment(originCode)
      if (cleared)
        scheduleNextTick()
      return
    }

    const beforeText = segment.slice(0, session.index)
    const addText = segment[session.index]
    const offset = session.startOffset + beforeText.length
    const position = getPosition(offset, originCode).position
    const applied = await applyActiveEditorEdit((edit) => {
      edit.insert(position, addText)
      setSelection(position, position)
    })
    if (!applied)
      return

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

export function getFakeCodingProgress(): FakeCodingProgress | null {
  if (!session.url)
    return null

  return {
    endOffset: session.endOffset,
    startOffset: session.startOffset,
    typedLength: Math.max(0, Math.min(session.index, session.endOffset - session.startOffset)),
  }
}

export function onFakeCodingStatusChange(listener?: (status: FakeCodingStatus) => void) {
  statusChangeListener = listener ?? null
}

export async function waitForPendingFakeCodingEdit() {
  await session.pendingEdit
}

export function startFakeCoding(url: vscode.Uri, range: FakeCodingRange) {
  const originCode = codingMap.get(url)
  if (!originCode || range.endOffset <= range.startOffset)
    return

  clearTimer()
  session.index = 0
  session.url = url
  session.startOffset = range.startOffset
  session.endOffset = range.endOffset
  session.loop = range.loop ?? true
  session.source = range.source
  resetPauseCountdown()
  setStatus('running')

  void clearSegment(originCode).then((cleared) => {
    if (!cleared)
      return

    nextTick(() => {
      scheduleNextTick()
    })
  })
}

export function pauseFakeCoding() {
  if (session.status !== 'running' && session.status !== 'waiting')
    return

  clearTimer()
  setStatus('paused')
}

export function resumeFakeCoding() {
  if (session.status !== 'paused')
    return

  if (!session.loop && session.index >= getCurrentSegmentLength()) {
    setStatus('waiting')
    return
  }

  setStatus('running')
  scheduleNextTick()
}

export function stopFakeCoding() {
  clearTimer()
  session.index = 0
  session.url = null
  session.loop = true
  session.startOffset = 0
  session.endOffset = 0
  session.source = 'fileStart'
  resetPauseCountdown()
  setStatus('idle')
}
