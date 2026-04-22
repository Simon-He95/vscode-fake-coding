import type * as vscode from 'vscode'

function normalizeTextList(values: readonly string[]) {
  return values
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)
}

function normalizeWindowBounds(minChars: number, maxChars: number) {
  const safeMin = Math.max(12, Math.round(Math.min(minChars, maxChars)))
  const safeMax = Math.max(safeMin, Math.round(Math.max(minChars, maxChars)))
  return {
    max: safeMax,
    min: safeMin,
  }
}

function getTabUri(tab: Pick<vscode.Tab, 'input'>) {
  const input = tab.input as { uri?: vscode.Uri } | undefined
  const uri = input?.uri
  if (!uri || uri.scheme !== 'file')
    return null
  return uri
}

export function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function collectOpenFileUris(tabGroups: readonly Pick<vscode.TabGroup, 'tabs'>[]) {
  const seen = new Set<string>()
  const uris: vscode.Uri[] = []

  for (const group of tabGroups) {
    for (const tab of group.tabs) {
      const uri = getTabUri(tab)
      if (!uri || seen.has(uri.fsPath))
        continue

      seen.add(uri.fsPath)
      uris.push(uri)
    }
  }

  return uris
}

export function pickNextWanderTarget(uris: readonly vscode.Uri[], currentFsPath?: string | null) {
  const candidates = currentFsPath
    ? uris.filter(uri => uri.fsPath !== currentFsPath)
    : [...uris]

  if (!candidates.length)
    return null

  return candidates[randomBetween(0, candidates.length - 1)] ?? null
}

export function listWanderTargets(uris: readonly vscode.Uri[], currentFsPath?: string | null) {
  const remaining = currentFsPath
    ? uris.filter(uri => uri.fsPath !== currentFsPath)
    : [...uris]
  const ordered: vscode.Uri[] = []

  while (remaining.length > 0) {
    const index = randomBetween(0, remaining.length - 1)
    const [candidate] = remaining.splice(index, 1)
    if (candidate)
      ordered.push(candidate)
  }

  return ordered
}

export function resolveActivityWindow(originCode: string, cursorOffset: number, minChars: number, maxChars: number) {
  const { max, min } = normalizeWindowBounds(minChars, maxChars)
  if (originCode.length <= max) {
    return {
      endOffset: originCode.length,
      startOffset: 0,
    }
  }

  const windowSize = Math.min(originCode.length, randomBetween(min, max))
  const maxStartOffset = Math.max(0, originCode.length - windowSize)
  const startOffset = Math.max(0, Math.min(cursorOffset, maxStartOffset))

  return {
    endOffset: startOffset + windowSize,
    startOffset,
  }
}

export function matchesWanderIgnorePath(fsPath: string, patterns: readonly string[]) {
  const normalizedPath = fsPath.replace(/\\/g, '/').toLowerCase()
  const normalizedPatterns = normalizeTextList(patterns)

  return normalizedPatterns.some(pattern => normalizedPath.includes(pattern))
}

export function isWanderLanguageAllowed(languageId: string, allowLanguages: readonly string[]) {
  const normalizedLanguages = normalizeTextList(allowLanguages)
  if (!normalizedLanguages.length)
    return true

  return normalizedLanguages.includes(languageId.toLowerCase())
}
