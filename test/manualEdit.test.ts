import { describe, expect, it } from 'vitest'
import { applyManualEditsToOrigin } from '../src/manualEdit'

describe('applyManualEditsToOrigin', () => {
  it('applies insertions after a fully restored segment directly to the origin', () => {
    const next = applyManualEditsToOrigin('abcdef', [{
      rangeLength: 0,
      rangeOffset: 3,
      text: 'X',
    }], {
      endOffset: 4,
      startOffset: 2,
      typedLength: 2,
    })

    expect(next).toBe('abcXdef')
  })

  it('maps insertions after a partial fake segment back behind the hidden suffix', () => {
    const next = applyManualEditsToOrigin('abcdef', [{
      rangeLength: 0,
      rangeOffset: 3,
      text: 'X',
    }], {
      endOffset: 4,
      startOffset: 2,
      typedLength: 1,
    })

    expect(next).toBe('abcdXef')
  })

  it('keeps deletions inside the visible typed prefix aligned to the origin', () => {
    const next = applyManualEditsToOrigin('abcdef', [{
      rangeLength: 1,
      rangeOffset: 2,
      text: '',
    }], {
      endOffset: 4,
      startOffset: 2,
      typedLength: 1,
    })

    expect(next).toBe('abdef')
  })

  it('returns null when a user change spans the collapsed fake boundary', () => {
    const next = applyManualEditsToOrigin('abcdef', [{
      rangeLength: 2,
      rangeOffset: 2,
      text: '',
    }], {
      endOffset: 5,
      startOffset: 2,
      typedLength: 1,
    })

    expect(next).toBeNull()
  })
})
