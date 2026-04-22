export interface ManualEditChange {
  rangeLength: number
  rangeOffset: number
  text: string
}

export interface FakeCodingProgress {
  endOffset: number
  startOffset: number
  typedLength: number
}

function clampTypedLength(progress: FakeCodingProgress) {
  const segmentLength = Math.max(0, progress.endOffset - progress.startOffset)
  return Math.max(0, Math.min(progress.typedLength, segmentLength))
}

function mapInsertionOffset(offset: number, progress: FakeCodingProgress) {
  const typedLength = clampTypedLength(progress)
  const hiddenLength = Math.max(0, progress.endOffset - progress.startOffset - typedLength)
  const typedEnd = progress.startOffset + typedLength

  if (hiddenLength === 0 || offset < typedEnd)
    return offset

  return offset + hiddenLength
}

function mapChangeRange(change: ManualEditChange, progress: FakeCodingProgress) {
  if (change.rangeLength === 0) {
    const offset = mapInsertionOffset(change.rangeOffset, progress)
    return {
      endOffset: offset,
      startOffset: offset,
      text: change.text,
    }
  }

  const typedLength = clampTypedLength(progress)
  const hiddenLength = Math.max(0, progress.endOffset - progress.startOffset - typedLength)
  const typedEnd = progress.startOffset + typedLength
  const rangeEnd = change.rangeOffset + change.rangeLength

  if (hiddenLength === 0 || rangeEnd <= typedEnd) {
    return {
      endOffset: rangeEnd,
      startOffset: change.rangeOffset,
      text: change.text,
    }
  }

  if (change.rangeOffset >= typedEnd) {
    return {
      endOffset: rangeEnd + hiddenLength,
      startOffset: change.rangeOffset + hiddenLength,
      text: change.text,
    }
  }

  return null
}

export function applyManualEditsToOrigin(originCode: string, changes: readonly ManualEditChange[], progress: FakeCodingProgress) {
  const mappedChanges = changes.map(change => mapChangeRange(change, progress))
  if (mappedChanges.some(change => !change))
    return null

  let nextCode = originCode
  for (let index = mappedChanges.length - 1; index >= 0; index -= 1) {
    const change = mappedChanges[index]
    if (!change)
      continue

    nextCode = `${nextCode.slice(0, change.startOffset)}${change.text}${nextCode.slice(change.endOffset)}`
  }

  return nextCode
}
