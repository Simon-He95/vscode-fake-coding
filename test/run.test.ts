import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getFakeCodingSource, startFakeCoding, stopFakeCoding } from '../src/run'
import { codingMap } from '../src/utils'

const mocks = vi.hoisted(() => ({
  createRange: vi.fn((start: unknown, end: unknown) => ({ start, end })),
  createLog: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  })),
  getConfiguration: vi.fn(),
  getPosition: vi.fn((offset: number) => ({ position: { offset } })),
  nextTick: vi.fn((callback?: () => void) => callback?.()),
  setSelection: vi.fn(),
  updateText: vi.fn(),
}))

vi.mock('@vscode-use/utils', () => ({
  createRange: mocks.createRange,
  createLog: mocks.createLog,
  getConfiguration: mocks.getConfiguration,
  getPosition: mocks.getPosition,
  nextTick: mocks.nextTick,
  setSelection: mocks.setSelection,
  updateText: mocks.updateText,
}))

describe('startFakeCoding', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    codingMap.clear()
    stopFakeCoding()

    mocks.getConfiguration.mockImplementation((name: string) => {
      if (name === 'fake-coding.interval')
        return 1
      if (name === 'fake-coding.mode')
        return 'steady'
      return undefined
    })
  })

  it('types only within the configured segment', () => {
    const deleteEdit = vi.fn()
    const insertEdit = vi.fn()
    const url = { fsPath: '/workspace/demo.ts' }

    codingMap.set(url as never, 'abcdef')
    mocks.updateText.mockImplementation((callback: (edit: { delete: typeof deleteEdit, insert: typeof insertEdit }) => void) => {
      callback({ delete: deleteEdit, insert: insertEdit })
    })

    startFakeCoding(url as never, {
      startOffset: 2,
      endOffset: 4,
      source: 'cursor',
    })

    expect(deleteEdit).toHaveBeenCalledWith({
      start: { offset: 2 },
      end: { offset: 4 },
    })

    vi.advanceTimersByTime(2)

    expect(insertEdit).toHaveBeenNthCalledWith(1, { offset: 2 }, 'c')
    expect(insertEdit).toHaveBeenNthCalledWith(2, { offset: 3 }, 'd')
  })

  it('tracks and resets the current source', () => {
    const url = { fsPath: '/workspace/demo.ts' }

    codingMap.set(url as never, 'abcdef')
    mocks.updateText.mockImplementation(() => {})

    startFakeCoding(url as never, {
      startOffset: 0,
      endOffset: 6,
      source: 'selection',
    })

    expect(getFakeCodingSource()).toBe('selection')

    stopFakeCoding()

    expect(getFakeCodingSource()).toBe('fileStart')
  })
})
