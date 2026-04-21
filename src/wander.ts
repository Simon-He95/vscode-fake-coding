import type * as vscode from 'vscode'

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
