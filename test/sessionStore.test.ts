import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearPersistedSession, initSessionStore, restorePersistedSession, savePersistedSession } from '../src/sessionStore'

const mocks = vi.hoisted(() => {
  class Range {
    args: unknown[]

    constructor(...args: unknown[]) {
      this.args = args
    }
  }

  class WorkspaceEdit {
    replacements: Array<{ range: Range, text: string, uri: { fsPath: string } }> = []

    replace(uri: { fsPath: string }, range: Range, text: string) {
      this.replacements.push({ range, text, uri })
    }
  }

  return {
    Range,
    WorkspaceEdit,
    applyEdit: vi.fn(async () => true),
    get: vi.fn(),
    logger: {
      error: vi.fn(),
      info: vi.fn(),
    },
    openTextDocument: vi.fn(),
    update: vi.fn(async () => {}),
    uriFile: vi.fn((fsPath: string) => ({ fsPath })),
  }
})

vi.mock('vscode', () => ({
  Range: mocks.Range,
  Uri: {
    file: mocks.uriFile,
  },
  WorkspaceEdit: mocks.WorkspaceEdit,
  workspace: {
    applyEdit: mocks.applyEdit,
    openTextDocument: mocks.openTextDocument,
  },
}))

vi.mock('../src/utils', () => ({
  logger: mocks.logger,
}))

describe('sessionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    initSessionStore({
      workspaceState: {
        get: mocks.get,
        update: mocks.update,
      },
    } as never)
  })

  it('persists and clears the active snapshot', async () => {
    const snapshot = {
      content: 'hello',
      fsPath: '/workspace/demo.ts',
      wasDirty: false,
    }

    await savePersistedSession(snapshot)
    await clearPersistedSession()

    expect(mocks.update).toHaveBeenNthCalledWith(1, 'fake-coding.active-snapshot', snapshot)
    expect(mocks.update).toHaveBeenNthCalledWith(2, 'fake-coding.active-snapshot', undefined)
  })

  it('restores and saves a clean document snapshot', async () => {
    const save = vi.fn(async () => true)
    mocks.get.mockReturnValue({
      content: 'restored',
      fsPath: '/workspace/demo.ts',
      wasDirty: false,
    })
    mocks.openTextDocument.mockResolvedValue({
      lineAt: () => ({ text: 'fake' }),
      lineCount: 1,
      save,
    })

    const restored = await restorePersistedSession()

    expect(restored).toBe(true)
    expect(mocks.uriFile).toHaveBeenCalledWith('/workspace/demo.ts')
    expect(mocks.applyEdit).toHaveBeenCalledTimes(1)
    const [[editArg]] = mocks.applyEdit.mock.calls as unknown as [[InstanceType<typeof mocks.WorkspaceEdit>]]
    const edit = editArg
    expect(edit.replacements).toHaveLength(1)
    expect(edit.replacements[0]?.text).toBe('restored')
    expect(save).toHaveBeenCalledTimes(1)
    expect(mocks.update).toHaveBeenCalledWith('fake-coding.active-snapshot', undefined)
  })

  it('restores without saving when the original document was already dirty', async () => {
    const save = vi.fn(async () => true)
    mocks.get.mockReturnValue({
      content: 'restored',
      fsPath: '/workspace/demo.ts',
      wasDirty: true,
    })
    mocks.openTextDocument.mockResolvedValue({
      lineAt: () => ({ text: 'fake' }),
      lineCount: 1,
      save,
    })

    const restored = await restorePersistedSession()

    expect(restored).toBe(true)
    expect(save).not.toHaveBeenCalled()
  })
})
