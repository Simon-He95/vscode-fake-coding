import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetCoding } from '../src/reset'
import { codingMap } from '../src/utils'

const mocks = vi.hoisted(() => ({
  Range: class Range {
    args: unknown[]

    constructor(...args: unknown[]) {
      this.args = args
    }
  },
  WorkspaceEdit: class WorkspaceEdit {
    replacements: Array<{ range: unknown, text: string, uri: { fsPath: string } }> = []

    replace(uri: { fsPath: string }, range: unknown, text: string) {
      this.replacements.push({ range, text, uri })
    }
  },
  applyEdit: vi.fn(async () => true),
  createLog: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  })),
  getConfiguration: vi.fn(),
  getCurrentFileUrl: vi.fn(),
  openTextDocument: vi.fn(),
  setSelection: vi.fn(),
  stopFakeCoding: vi.fn(),
  waitForPendingFakeCodingEdit: vi.fn(async () => {}),
}))

vi.mock('@vscode-use/utils', () => ({
  createLog: mocks.createLog,
  getConfiguration: mocks.getConfiguration,
  getCurrentFileUrl: mocks.getCurrentFileUrl,
  setSelection: mocks.setSelection,
}))

vi.mock('vscode', () => ({
  Range: mocks.Range,
  WorkspaceEdit: mocks.WorkspaceEdit,
  workspace: {
    applyEdit: mocks.applyEdit,
    openTextDocument: mocks.openTextDocument,
  },
}))

vi.mock('../src/run', () => ({
  stopFakeCoding: mocks.stopFakeCoding,
  waitForPendingFakeCodingEdit: mocks.waitForPendingFakeCodingEdit,
}))

describe('resetCoding', () => {
  beforeEach(() => {
    codingMap.clear()
    vi.clearAllMocks()

    mocks.applyEdit.mockResolvedValue(true)
    mocks.getConfiguration.mockReturnValue(true)
    mocks.openTextDocument.mockResolvedValue({
      lineAt: () => ({ text: 'fake' }),
      lineCount: 1,
      save: vi.fn(async () => true),
    })
    mocks.waitForPendingFakeCodingEdit.mockImplementation(async () => {})
  })

  it('restores and saves only the current file', async () => {
    const save = vi.fn()
    const url = { fsPath: '/workspace/current.ts' }

    codingMap.set(url as never, 'hello')
    mocks.getCurrentFileUrl.mockReturnValue('/workspace/current.ts')
    mocks.openTextDocument.mockResolvedValue({
      lineAt: () => ({ text: 'fake' }),
      lineCount: 1,
      save,
    })

    const restored = await resetCoding(url as never)

    expect(restored).toBe(true)
    expect(mocks.stopFakeCoding).toHaveBeenCalledTimes(1)
    expect(mocks.waitForPendingFakeCodingEdit).toHaveBeenCalledTimes(1)
    expect(mocks.openTextDocument).toHaveBeenCalledWith(url)
    expect(mocks.applyEdit).toHaveBeenCalledTimes(1)
    expect(mocks.setSelection).toHaveBeenCalledWith([0, 0], [0, 0])
    expect(save).toHaveBeenCalledTimes(1)
    expect(codingMap.has(url as never)).toBe(false)
  })

  it('restores and saves a background file without jumping away', async () => {
    const targetSave = vi.fn()
    const url = { fsPath: '/workspace/target.ts' }

    codingMap.set(url as never, 'hello')
    mocks.getCurrentFileUrl.mockReturnValue('/workspace/current.ts')
    mocks.openTextDocument.mockResolvedValue({
      lineAt: () => ({ text: 'fake' }),
      lineCount: 1,
      save: targetSave,
    })

    const restored = await resetCoding(url as never)

    expect(restored).toBe(true)
    expect(mocks.openTextDocument).toHaveBeenCalledWith(url)
    expect(mocks.applyEdit).toHaveBeenCalledTimes(1)
    const [[editArg]] = mocks.applyEdit.mock.calls as unknown as [[InstanceType<typeof mocks.WorkspaceEdit>]]
    expect(editArg.replacements).toHaveLength(1)
    expect(editArg.replacements[0]?.text).toBe('hello')
    expect(targetSave).toHaveBeenCalledTimes(1)
    expect(mocks.setSelection).not.toHaveBeenCalled()
    expect(codingMap.has(url as never)).toBe(false)
  })

  it('skips saving when saveOnStop is disabled', async () => {
    const save = vi.fn()
    const url = { fsPath: '/workspace/current.ts' }

    codingMap.set(url as never, 'hello')
    mocks.getConfiguration.mockReturnValue(false)
    mocks.getCurrentFileUrl.mockReturnValue('/workspace/current.ts')
    mocks.openTextDocument.mockResolvedValue({
      lineAt: () => ({ text: 'fake' }),
      lineCount: 1,
      save,
    })

    const restored = await resetCoding(url as never)

    expect(restored).toBe(true)
    expect(save).not.toHaveBeenCalled()
  })

  it('restores without saving when the original file was already dirty', async () => {
    const save = vi.fn()
    const url = { fsPath: '/workspace/current.ts' }

    codingMap.set(url as never, 'hello')
    mocks.getConfiguration.mockReturnValue(true)
    mocks.getCurrentFileUrl.mockReturnValue('/workspace/current.ts')
    mocks.openTextDocument.mockResolvedValue({
      lineAt: () => ({ text: 'fake' }),
      lineCount: 1,
      save,
    })

    const restored = await resetCoding(url as never, { wasDirty: true })

    expect(restored).toBe(true)
    expect(save).not.toHaveBeenCalled()
  })

  it('keeps the source code cached when applying the restore edit fails', async () => {
    const url = { fsPath: '/workspace/current.ts' }

    codingMap.set(url as never, 'hello')
    mocks.getCurrentFileUrl.mockReturnValue('/workspace/current.ts')
    mocks.applyEdit.mockResolvedValue(false)

    const restored = await resetCoding(url as never)

    expect(restored).toBe(false)
    expect(codingMap.get(url as never)).toBe('hello')
  })

  it('waits for any in-flight fake typing edit before restoring the file', async () => {
    let resolvePendingEdit!: () => void
    const url = { fsPath: '/workspace/current.ts' }

    codingMap.set(url as never, 'hello')
    mocks.getCurrentFileUrl.mockReturnValue('/workspace/current.ts')
    mocks.waitForPendingFakeCodingEdit.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolvePendingEdit = () => resolve()
    }))

    const restorePromise = resetCoding(url as never)
    await Promise.resolve()

    expect(mocks.stopFakeCoding).toHaveBeenCalledTimes(1)
    expect(mocks.openTextDocument).not.toHaveBeenCalled()

    resolvePendingEdit()
    const restored = await restorePromise

    expect(restored).toBe(true)
    expect(mocks.openTextDocument).toHaveBeenCalledWith(url)
    expect(mocks.applyEdit).toHaveBeenCalledTimes(1)
  })
})
