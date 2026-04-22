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

  class Selection extends Range {
    active: Position
    isEmpty: boolean

    constructor(start: Position, end: Position) {
      super(start, end)
      this.active = end
      this.isEmpty = start.line === end.line && start.character === end.character
    }
  }

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
        lineAt: (line: number) => { text: string }
        lineCount: number
        offsetAt: (position: { line: number, character: number }) => number
        uri: { fsPath: string }
      }
      revealRange: ReturnType<typeof vi.fn>
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
    getFakeCodingProgress: vi.fn(() => ({
      endOffset: 18,
      startOffset: 0,
      typedLength: 18,
    })),
    getFakeCodingStatus: vi.fn(() => state.status),
    getPersistedSession: vi.fn(() => undefined),
    isInternalEdit: vi.fn(() => false),
    initSessionStore: vi.fn(),
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
    },
    pauseFakeCoding: vi.fn(() => {
      state.status = 'paused'
    }),
    onFakeCodingStatusChange: vi.fn(),
    registerCommand: vi.fn((name: string, callback: () => unknown) => {
      commands.set(name, callback)
    }),
    randomBetween: vi.fn(() => 3000),
    resetCoding: vi.fn(async () => {
      state.status = 'idle'
      return true
    }),
    restorePersistedSession: vi.fn(async () => false),
    resumeFakeCoding: vi.fn(() => {
      state.status = 'running'
    }),
    savePersistedSession: vi.fn(async () => {}),
    showQuickPick: vi.fn(async () => ({
      label: 'Current File',
      mode: 'single',
    })),
    startFakeCoding: vi.fn(() => {
      state.status = 'running'
    }),
    status: 'idle' as 'idle' | 'running' | 'paused' | 'waiting',
    statusChangeListener: null as null | ((status: 'idle' | 'running' | 'paused' | 'waiting') => void),
    stopFakeCoding: vi.fn(() => {
      state.status = 'idle'
    }),
    workspace: {
      getConfiguration: vi.fn(() => ({
        update: vi.fn(async () => {}),
      })),
      onDidChangeTextDocument: vi.fn((callback: (event: unknown) => unknown) => {
        events.set('document-change', callback)
        return { dispose: vi.fn() }
      }),
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
    showQuickPick: mocks.showQuickPick,
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
  getFakeCodingProgress: mocks.getFakeCodingProgress,
  getFakeCodingSource: mocks.getFakeCodingSource,
  getFakeCodingStatus: mocks.getFakeCodingStatus,
  onFakeCodingStatusChange: vi.fn((listener?: (status: 'idle' | 'running' | 'paused' | 'waiting') => void) => {
    mocks.statusChangeListener = listener ?? null
  }),
  pauseFakeCoding: mocks.pauseFakeCoding,
  resumeFakeCoding: mocks.resumeFakeCoding,
  startFakeCoding: mocks.startFakeCoding,
  stopFakeCoding: mocks.stopFakeCoding,
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
  isInternalEdit: mocks.isInternalEdit,
  logger: mocks.logger,
  runAsInternalEdit: vi.fn((task: () => unknown) => task()),
}))

vi.mock('../src/wander', () => ({
  collectOpenFileUris: vi.fn(() => []),
  isWanderLanguageAllowed: vi.fn(() => true),
  listWanderTargets: vi.fn(() => []),
  matchesWanderIgnorePath: vi.fn(() => false),
  pickNextWanderTarget: vi.fn(() => null),
  randomBetween: mocks.randomBetween,
  resolveActivityWindow: vi.fn((originCode: string) => ({
    endOffset: originCode.length,
    startOffset: 0,
  })),
}))

vi.mock('../src/manualEdit', () => ({
  applyManualEditsToOrigin: vi.fn((originCode: string, changes: Array<{ rangeLength: number, rangeOffset: number, text: string }>) => {
    let nextCode = originCode
    for (let index = changes.length - 1; index >= 0; index -= 1) {
      const change = changes[index]
      if (!change)
        continue

      nextCode = `${nextCode.slice(0, change.rangeOffset)}${change.text}${nextCode.slice(change.rangeOffset + change.rangeLength)}`
    }
    return nextCode
  }),
}))

function createEditor(fsPath: string, text: string) {
  return {
    document: {
      getText: () => text,
      isDirty: false,
      lineAt: () => ({ text }),
      lineCount: 1,
      offsetAt: ({ character }: { character: number }) => character,
      uri: { fsPath },
    },
    revealRange: vi.fn(),
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
    mocks.statusChangeListener = null
    mocks.randomBetween.mockImplementation(() => 3000)
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

  it('lets the bottom bar choose a start mode while idle', async () => {
    await mocks.commands.get('fake-coding.toggle')?.()

    expect(mocks.showQuickPick).toHaveBeenCalledTimes(1)
    expect(mocks.startFakeCoding).toHaveBeenCalledTimes(1)
  })

  it('starts auto wander in loop mode so typing keeps going until switched', async () => {
    await mocks.commands.get('fake-coding.startWander')?.()

    expect(mocks.startFakeCoding).toHaveBeenCalledTimes(1)
    const startArgs = mocks.startFakeCoding.mock.calls[0] as unknown[] | undefined
    expect(startArgs).toBeDefined()
    const range = startArgs?.[1] as { loop?: boolean } | undefined
    expect(range?.loop).toBe(true)
  })

  it('ends the current session when toggling from the bottom bar while active', async () => {
    mocks.status = 'waiting'

    await mocks.commands.get('fake-coding.toggle')?.()

    expect(mocks.executeCommand).toHaveBeenCalledWith('fake-coding.stop')
  })

  it('treats pause as ending the current session and restoring state', async () => {
    await mocks.commands.get('fake-coding.start')?.()
    await Promise.resolve()
    await Promise.resolve()

    await mocks.commands.get('fake-coding.pause')?.()
    await Promise.resolve()
    await Promise.resolve()

    expect(mocks.resetCoding).toHaveBeenCalledTimes(1)
    expect(mocks.clearPersistedSession).toHaveBeenCalledTimes(1)
  })

  it('restarts fake coding in the current file when no other wander target exists', async () => {
    vi.useFakeTimers()
    try {
      mocks.randomBetween.mockImplementation((...values: number[]) => values[0] ?? 0)
      await mocks.commands.get('fake-coding.startWander')?.()

      expect(vi.getTimerCount()).toBe(1)

      await vi.advanceTimersByTimeAsync(13000)
      await Promise.resolve()
      await Promise.resolve()

      expect(mocks.pauseFakeCoding).toHaveBeenCalledTimes(1)
      expect(mocks.resetCoding).toHaveBeenCalledTimes(1)
      expect(mocks.startFakeCoding).toHaveBeenCalledTimes(2)
      expect(vi.getTimerCount()).toBe(1)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('stops and clears the session when the user edits the active file', async () => {
    await mocks.commands.get('fake-coding.start')?.()
    await Promise.resolve()
    await Promise.resolve()
    mocks.status = 'waiting'

    const callback = mocks.events.get('document-change')
    await callback?.({
      contentChanges: [{
        rangeLength: 0,
        rangeOffset: 15,
        text: 'x',
      }],
      document: {
        getText: () => 'const value = 1x',
        lineAt: () => ({ text: 'const value = 1x' }),
        lineCount: 1,
        uri: { fsPath: '/workspace/demo.ts' },
      },
    })
    await Promise.resolve()

    expect(mocks.stopFakeCoding).toHaveBeenCalledTimes(1)
    expect(mocks.clearPersistedSession).toHaveBeenCalledTimes(1)
    expect(mocks.resetCoding).not.toHaveBeenCalled()
    expect(mocks.codingMap.size).toBe(0)
  })
})
