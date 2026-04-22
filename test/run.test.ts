import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getFakeCodingSource, getFakeCodingStatus, pauseFakeCoding, resumeFakeCoding, startFakeCoding, stopFakeCoding } from '../src/run'
import { codingMap } from '../src/utils'

const mocks = vi.hoisted(() => ({
  activeEditor: null as null | {
    edit: (callback: (edit: { delete: ReturnType<typeof vi.fn>, insert: ReturnType<typeof vi.fn> }) => void) => Promise<boolean>
  },
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
}))

vi.mock('@vscode-use/utils', () => ({
  createRange: mocks.createRange,
  createLog: mocks.createLog,
  getConfiguration: mocks.getConfiguration,
  getPosition: mocks.getPosition,
  nextTick: mocks.nextTick,
  setSelection: mocks.setSelection,
}))

vi.mock('vscode', () => ({
  window: {
    get activeTextEditor() {
      return mocks.activeEditor
    },
  },
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
    mocks.activeEditor = {
      edit: vi.fn(async (callback: (edit: { delete: ReturnType<typeof vi.fn>, insert: ReturnType<typeof vi.fn> }) => void) => {
        callback({
          delete: vi.fn(),
          insert: vi.fn(),
        })
        return true
      }),
    }
  })

  it('types only within the configured segment', async () => {
    const deleteEdit = vi.fn()
    const insertEdit = vi.fn()
    const url = { fsPath: '/workspace/demo.ts' }

    codingMap.set(url as never, 'abcdef')
    mocks.activeEditor = {
      edit: vi.fn(async (callback: (edit: { delete: typeof deleteEdit, insert: typeof insertEdit }) => void) => {
        callback({ delete: deleteEdit, insert: insertEdit })
        return true
      }),
    }

    startFakeCoding(url as never, {
      startOffset: 2,
      endOffset: 4,
      source: 'cursor',
    })

    expect(deleteEdit).toHaveBeenCalledWith({
      start: { offset: 2 },
      end: { offset: 4 },
    })

    await vi.advanceTimersByTimeAsync(2)

    expect(insertEdit).toHaveBeenNthCalledWith(1, { offset: 2 }, 'c')
    expect(insertEdit).toHaveBeenNthCalledWith(2, { offset: 3 }, 'd')
  })

  it('tracks and resets the current source', () => {
    const url = { fsPath: '/workspace/demo.ts' }

    codingMap.set(url as never, 'abcdef')

    startFakeCoding(url as never, {
      startOffset: 0,
      endOffset: 6,
      source: 'selection',
    })

    expect(getFakeCodingSource()).toBe('selection')

    stopFakeCoding()

    expect(getFakeCodingSource()).toBe('fileStart')
  })

  it('can stop on the current segment without replaying it', async () => {
    const deleteEdit = vi.fn()
    const insertEdit = vi.fn()
    const url = { fsPath: '/workspace/demo.ts' }

    codingMap.set(url as never, 'abcdef')
    mocks.activeEditor = {
      edit: vi.fn(async (callback: (edit: { delete: typeof deleteEdit, insert: typeof insertEdit }) => void) => {
        callback({ delete: deleteEdit, insert: insertEdit })
        return true
      }),
    }

    startFakeCoding(url as never, {
      startOffset: 2,
      endOffset: 4,
      loop: false,
      source: 'cursor',
    })

    await vi.advanceTimersByTimeAsync(4)

    expect(insertEdit).toHaveBeenCalledTimes(2)
    expect(deleteEdit).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(20)

    expect(insertEdit).toHaveBeenCalledTimes(2)
    expect(deleteEdit).toHaveBeenCalledTimes(1)
    expect(getFakeCodingStatus()).toBe('waiting')
  })

  it('pauses and resumes after reaching the waiting state', async () => {
    const url = { fsPath: '/workspace/demo.ts' }

    codingMap.set(url as never, 'abcdef')

    startFakeCoding(url as never, {
      startOffset: 2,
      endOffset: 4,
      loop: false,
      source: 'cursor',
    })

    await vi.advanceTimersByTimeAsync(4)

    expect(getFakeCodingStatus()).toBe('waiting')

    pauseFakeCoding()
    expect(getFakeCodingStatus()).toBe('paused')

    resumeFakeCoding()
    expect(getFakeCodingStatus()).toBe('waiting')
  })
})
