import { afterEach, describe, expect, it, vi } from 'vitest'
import { collectOpenFileUris, pickNextWanderTarget, randomBetween } from '../src/wander'

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

  it('uses an inclusive random range', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    expect(randomBetween(2, 4)).toBe(4)
  })
})
