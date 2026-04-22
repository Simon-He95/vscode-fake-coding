import { afterEach, describe, expect, it, vi } from 'vitest'
import { collectOpenFileUris, isWanderLanguageAllowed, listWanderTargets, matchesWanderIgnorePath, pickNextWanderTarget, randomBetween, resolveActivityWindow } from '../src/wander'

describe('wander', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('collects unique file tabs only', () => {
    const uris = collectOpenFileUris([
      {
        tabs: [
          { input: { uri: { fsPath: '/workspace/a.ts', scheme: 'file' } } },
          { input: { uri: { fsPath: '/workspace/a.ts', scheme: 'file' } } },
          { input: { uri: { fsPath: '/workspace/notes.md', scheme: 'file' } } },
          { input: { uri: { fsPath: '/workspace/output', scheme: 'output' } } },
        ],
      },
      {
        tabs: [
          { input: { uri: { fsPath: '/workspace/b.ts', scheme: 'file' } } },
        ],
      },
    ] as never)

    expect(uris.map(uri => uri.fsPath)).toEqual([
      '/workspace/a.ts',
      '/workspace/notes.md',
      '/workspace/b.ts',
    ])
  })

  it('prefers a different file when wandering', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const next = pickNextWanderTarget([
      { fsPath: '/workspace/current.ts' },
      { fsPath: '/workspace/other.ts' },
    ] as never, '/workspace/current.ts')

    expect(next?.fsPath).toBe('/workspace/other.ts')
  })

  it('returns null when there is nowhere else to go', () => {
    const next = pickNextWanderTarget([
      { fsPath: '/workspace/current.ts' },
    ] as never, '/workspace/current.ts')

    expect(next).toBeNull()
  })

  it('builds a randomized candidate list without the current file', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0)

    const candidates = listWanderTargets([
      { fsPath: '/workspace/current.ts' },
      { fsPath: '/workspace/a.ts' },
      { fsPath: '/workspace/b.ts' },
    ] as never, '/workspace/current.ts')

    expect(candidates.map(uri => uri.fsPath)).toEqual([
      '/workspace/b.ts',
      '/workspace/a.ts',
    ])
  })

  it('uses an inclusive random range', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    expect(randomBetween(2, 4)).toBe(4)
  })

  it('resolves an activity window within the configured bounds', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const range = resolveActivityWindow('a'.repeat(300), 120, 40, 80)

    expect(range).toEqual({
      endOffset: 160,
      startOffset: 120,
    })
  })

  it('shifts the activity window back when the cursor is near the file end', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    const range = resolveActivityWindow('a'.repeat(300), 299, 40, 80)

    expect(range.startOffset).toBe(220)
    expect(range.endOffset).toBe(300)
  })

  it('matches ignore paths using normalized substrings', () => {
    expect(matchesWanderIgnorePath('/workspace/src/generated/demo.ts', ['generated', 'dist/'])).toBe(true)
    expect(matchesWanderIgnorePath('C:\\workspace\\dist\\demo.js', ['generated', 'dist/'])).toBe(true)
    expect(matchesWanderIgnorePath('/workspace/src/demo.ts', ['generated', 'dist/'])).toBe(false)
  })

  it('allows all languages by default and can restrict to a whitelist', () => {
    expect(isWanderLanguageAllowed('typescript', [])).toBe(true)
    expect(isWanderLanguageAllowed('typescriptreact', ['typescript', 'javascript'])).toBe(false)
    expect(isWanderLanguageAllowed('TypeScript', ['typescript', 'javascript'])).toBe(true)
  })
})
