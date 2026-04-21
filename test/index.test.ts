import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetCoding } from '../src/reset'
import { codingMap } from '../src/utils'

const mocks = vi.hoisted(() => ({
  createRange: vi.fn((...args: unknown[]) => ({ args })),
  createLog: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  })),
  getActiveTextEditor: vi.fn(),
  getConfiguration: vi.fn(),
  getCurrentFileUrl: vi.fn(),
  getPosition: vi.fn((offset: number) => ({ position: { offset } })),
  jumpToLine: vi.fn(),
  nextTick: vi.fn(async (callback?: (result?: boolean) => unknown) => callback?.(true)),
  setSelection: vi.fn(),
  stopFakeCoding: vi.fn(),
  updateText: vi.fn(),
}))

vi.mock('@vscode-use/utils', () => ({
  createRange: mocks.createRange,
  createLog: mocks.createLog,
  getActiveTextEditor: mocks.getActiveTextEditor,
  getConfiguration: mocks.getConfiguration,
  getCurrentFileUrl: mocks.getCurrentFileUrl,
  getPosition: mocks.getPosition,
  jumpToLine: mocks.jumpToLine,
  nextTick: mocks.nextTick,
  setSelection: mocks.setSelection,
  updateText: mocks.updateText,
}))

vi.mock('../src/run', () => ({
  stopFakeCoding: mocks.stopFakeCoding,
}))

describe('resetCoding', () => {
  beforeEach(() => {
    codingMap.clear()
    vi.clearAllMocks()

    mocks.getConfiguration.mockReturnValue(true)
    mocks.getPosition.mockImplementation((offset: number) => ({ position: { offset } }))
    mocks.nextTick.mockImplementation(async (callback?: (result?: boolean) => unknown) => callback?.(true))
  })

  it('restores and saves only the current file', async () => {
    const replace = vi.fn()
    const save = vi.fn()
    const url = { fsPath: '/workspace/current.ts' }

    codingMap.set(url as never, 'hello')
    mocks.getCurrentFileUrl.mockReturnValue('/workspace/current.ts')
    mocks.getActiveTextEditor.mockReturnValue({ document: { save } })
    mocks.updateText.mockImplementation((callback: (edit: { replace: typeof replace }) => void) => {
      callback({ replace })
    })

    await resetCoding(url as never)

    expect(mocks.stopFakeCoding).toHaveBeenCalledTimes(1)
    expect(mocks.jumpToLine).not.toHaveBeenCalled()
    expect(replace).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(codingMap.has(url as never)).toBe(false)
  })

  it('restores, saves target file, and jumps back when switching files', async () => {
    const replace = vi.fn()
    const currentSave = vi.fn()
    const targetSave = vi.fn()
    const url = { fsPath: '/workspace/target.ts' }
    let activeEditor = { document: { save: currentSave } }

    codingMap.set(url as never, 'hello')
    mocks.getCurrentFileUrl.mockReturnValue('/workspace/current.ts')
    mocks.getActiveTextEditor.mockImplementation(() => activeEditor)
    mocks.jumpToLine.mockImplementation(async (_line: number, filepath?: string) => {
      activeEditor = filepath === '/workspace/target.ts'
        ? { document: { save: targetSave } }
        : { document: { save: currentSave } }
      return activeEditor
    })
    mocks.updateText.mockImplementation((callback: (edit: { replace: typeof replace }) => void) => {
      callback({ replace })
    })

    await resetCoding(url as never)

    expect(mocks.jumpToLine).toHaveBeenNthCalledWith(1, 0, '/workspace/target.ts')
    expect(mocks.jumpToLine).toHaveBeenNthCalledWith(2, 0, '/workspace/current.ts')
    expect(replace).toHaveBeenCalledTimes(1)
    expect(targetSave).toHaveBeenCalledTimes(1)
    expect(currentSave).not.toHaveBeenCalled()
    expect(codingMap.has(url as never)).toBe(false)
  })

  it('skips saving when saveOnStop is disabled', async () => {
    const replace = vi.fn()
    const save = vi.fn()
    const url = { fsPath: '/workspace/current.ts' }

    codingMap.set(url as never, 'hello')
    mocks.getConfiguration.mockReturnValue(false)
    mocks.getCurrentFileUrl.mockReturnValue('/workspace/current.ts')
    mocks.getActiveTextEditor.mockReturnValue({ document: { save } })
    mocks.updateText.mockImplementation((callback: (edit: { replace: typeof replace }) => void) => {
      callback({ replace })
    })

    await resetCoding(url as never)

    expect(replace).toHaveBeenCalledTimes(1)
    expect(save).not.toHaveBeenCalled()
  })
})
