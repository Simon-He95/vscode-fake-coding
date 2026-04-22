import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const commands = new Map<string, () => unknown>()
  const events = new Map<string, (editor?: unknown) => unknown>()
  const codingMap = new Map()

  class Position {
    line: number
    character: number

    constructor(line: number, character: number) {
      this.line = line
      this.character = character
    }
  }

  class Range {
    start: Position
    end: Position

    constructor(start: Position, end: Position) {
      this.start = start
      this.end = end
    }
  }

  class Selection extends Range {}

  const state = {
    Position,
    Range,
    Selection,
    TextEditorRevealType: {
      InCenterIfOutsideViewport: 0,
    },
    activate: null as null | ((context: unknown, disposals?: unknown[]) => Promise<void>),
    activeEditor: null as null | {
      document: {
        getText: () => string
        isDirty: boolean
        offsetAt: (position: { line: number, character: number }) => number
        uri: { fsPath: string }
      }
      selection: {
        active: { line: number, character: number }
        end: { line: number, character: number }
        isEmpty: boolean
        start: { line: number, character: number }
      }
    },
    addEventListener: vi.fn((type: string, callback: (editor?: unknown) => unknown) => {
      events.set(type, callback)
      return { dispose: vi.fn() }
    }),
    clearPersistedSession: vi.fn(async () => {}),
    codingMap,
    commands,
    createBottomBar: vi.fn(() => ({
      show: vi.fn(),
      text: '',
    })),
    createExtension: vi.fn((activate: (context: unknown, disposals?: unknown[]) => Promise<void>) => {
      state.activate = activate
      return {}
    }),
    events,
    executeCommand: vi.fn(),
    getConfiguration: vi.fn((key: string) => {
      if (key === 'fake-coding.startFrom')
        return 'fileStart'
      if (key === 'fake-coding.mode')
        return 'steady'
      if (key === 'fake-coding.autoStopMinutes')
        return 0
      return undefined
    }),
    getFakeCodingSource: vi.fn(() => 'fileStart'),
    getFakeCodingStatus: vi.fn(() => state.status),
    getPersistedSession: vi.fn(() => undefined),
    initSessionStore: vi.fn(),
    logger: {
      error: vi.fn(),
    },
    pauseFakeCoding: vi.fn(() => {
      state.status = 'paused'
    }),
    registerCommand: vi.fn((name: string, callback: () => unknown) => {
      commands.set(name, callback)
    }),
    resetCoding: vi.fn(async () => {
      state.status = 'idle'
    }),
    restorePersistedSession: vi.fn(async () => false),
    resumeFakeCoding: vi.fn(() => {
      state.status = 'running'
    }),
    savePersistedSession: vi.fn(async () => {}),
    startFakeCoding: vi.fn(() => {
      state.status = 'running'
    }),
    status: 'idle' as 'idle' | 'running' | 'paused',
    workspace: {
      getConfiguration: vi.fn(() => ({
        update: vi.fn(async () => {}),
      })),
      openTextDocument: vi.fn(),
    },
  }

  return state
})

vi.mock('@vscode-use/utils', () => ({
  addEventListener: mocks.addEventListener,
  createBottomBar: mocks.createBottomBar,
  createExtension: mocks.createExtension,
  executeCommand: mocks.executeCommand,
  getConfiguration: mocks.getConfiguration,
  registerCommand: mocks.registerCommand,
}))

vi.mock('vscode', () => ({
  Position: mocks.Position,
  Range: mocks.Range,
  Selection: mocks.Selection,
  TextEditorRevealType: mocks.TextEditorRevealType,
  window: {
    get activeTextEditor() {
      return mocks.activeEditor
    },
    showTextDocument: vi.fn(),
    tabGroups: {
      all: [],
    },
  },
  workspace: mocks.workspace,
}))

vi.mock('../src/reset', () => ({
  resetCoding: mocks.resetCoding,
}))

vi.mock('../src/run', () => ({
  getFakeCodingSource: mocks.getFakeCodingSource,
  getFakeCodingStatus: mocks.getFakeCodingStatus,
  pauseFakeCoding: mocks.pauseFakeCoding,
  resumeFakeCoding: mocks.resumeFakeCoding,
  startFakeCoding: mocks.startFakeCoding,
}))

vi.mock('../src/sessionStore', () => ({
  clearPersistedSession: mocks.clearPersistedSession,
  getPersistedSession: mocks.getPersistedSession,
  initSessionStore: mocks.initSessionStore,
  restorePersistedSession: mocks.restorePersistedSession,
  savePersistedSession: mocks.savePersistedSession,
}))

vi.mock('../src/utils', () => ({
  codingMap: mocks.codingMap,
  logger: mocks.logger,
}))

vi.mock('../src/wander', () => ({
  collectOpenFileUris: vi.fn(() => []),
  pickNextWanderTarget: vi.fn(() => null),
  randomBetween: vi.fn(() => 3000),
}))

function createEditor(fsPath: string, text: string) {
  return {
    document: {
      getText: () => text,
      isDirty: false,
      offsetAt: ({ character }: { character: number }) => character,
      uri: { fsPath },
    },
    selection: {
      active: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
      isEmpty: true,
      start: { line: 0, character: 0 },
    },
  }
}

describe('extension active editor handling', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.commands.clear()
    mocks.events.clear()
    mocks.codingMap.clear()
    mocks.status = 'idle'
    mocks.activeEditor = createEditor('/workspace/demo.ts', 'const value = 1')

    await import('../src/index')
    await mocks.activate?.({
      workspaceState: {
        get: vi.fn(),
        update: vi.fn(async () => {}),
      },
    }, [])
  })

  it('ignores same-file active editor events after starting', async () => {
    await mocks.commands.get('fake-coding.start')?.()

    const callback = mocks.events.get('activeText-change')
    await callback?.(mocks.activeEditor)

    expect(mocks.startFakeCoding).toHaveBeenCalledTimes(1)
    expect(mocks.resetCoding).not.toHaveBeenCalled()
  })
})
