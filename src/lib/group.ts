/**
 * Group near-duplicate entries that only differ by environment, e.g.
 * "customer - DEV", "customer - UAT", "customer_sit" → "customer".
 */
import type { DecryptedItem } from './vault'

const ENV_TOKEN =
  /(^|[^a-z0-9])(pre[-_ ]?prod|preprod|pre[-_ ]?prd|pre|non[-_ ]?prod|nonprod|production|prod|prd|uat|sit|development|develop|dev|staging|stg)(?=[^a-z0-9]|$)/gi

/** Title with environment words removed: "consolidate (rsales_pg - SIT)" → "consolidate (rsales_pg)". */
export function baseName(title: string): string {
  let s = title.replace(ENV_TOKEN, '$1')
  for (let i = 0; i < 3; i++) {
    s = s
      .replace(/[\s\-_:|/.]+([)\]])/g, '$1') // "(x - )" → "(x)"
      .replace(/([([])\s*[-_:|/.]+\s*/g, '$1') // "( - x)" → "(x)"
      .replace(/\(\s*\)|\[\s*\]/g, '') // empty brackets
      .replace(/\s{2,}/g, ' ')
      .replace(/^[\s\-_:|/.]+|[\s\-_:|/.]+$/g, '')
  }
  return s || title.trim()
}

const ENV_ORDER = ['DEV', 'SIT', 'NON-PROD', 'UAT', 'PRE-PROD', 'PROD']
const envRank = (e: string) => {
  const i = ENV_ORDER.indexOf(e)
  return i < 0 ? (e ? ENV_ORDER.length : -1) : i
}

export type ListRow =
  | { kind: 'item'; item: DecryptedItem }
  | { kind: 'group'; key: string; name: string; items: DecryptedItem[] }

/** Edit distance counting a swap of two neighbours as one edit ("Dashbaord" vs "Dashboard"). */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  return d[a.length][b.length]
}

/** Same thing with a typo: close names of reasonable length (short names must match exactly). */
export function similarNames(a: string, b: string): boolean {
  if (a === b) return true
  const len = Math.min(a.length, b.length)
  if (len < 8) return false
  // server01 vs server02 are different machines, not a typo
  if (a.replace(/\D/g, '') !== b.replace(/\D/g, '')) return false
  return editDistance(a, b) <= (len >= 16 ? 2 : 1)
}

/**
 * Items keep their order; a group appears where its first member was. Only groups with 2+ members are folded.
 * Items group when type and หมวด match and their names (without environment) are the same or differ by a typo.
 */
export function groupRows(items: DecryptedItem[]): ListRow[] {
  const clusters: { key: string; type: string; collection: string; base: string; items: DecryptedItem[] }[] = []
  const clusterOf = new Map<string, (typeof clusters)[number]>()
  for (const i of items) {
    const base = baseName(i.title).toLowerCase()
    let c = clusters.find((c) => c.type === i.type && c.base === base && c.collection === i.collection)
    c ??= clusters.find((c) => c.type === i.type && c.collection === i.collection && similarNames(c.base, base))
    // exact names still group across หมวด, as before
    c ??= clusters.find((c) => c.type === i.type && c.base === base)
    if (!c) {
      c = { key: `${i.type}|${i.collection}|${base}`, type: i.type, collection: i.collection, base, items: [] }
      clusters.push(c)
    }
    c.items.push(i)
    clusterOf.set(i.id, c)
  }
  const rows: ListRow[] = []
  const done = new Set<string>()
  for (const i of items) {
    const c = clusterOf.get(i.id)!
    if (c.items.length < 2) rows.push({ kind: 'item', item: i })
    else if (!done.has(c.key)) {
      done.add(c.key)
      const sorted = [...c.items].sort((x, y) => envRank(x.environment) - envRank(y.environment) || x.title.localeCompare(y.title))
      rows.push({ kind: 'group', key: c.key, name: groupName(c.items), items: sorted })
    }
  }
  return rows
}

/** Prefer the name that matches the หมวด, else the most common spelling. */
function groupName(items: DecryptedItem[]): string {
  const names = items.map((i) => baseName(i.title))
  const coll = items[0].collection.toLowerCase()
  const byColl = names.find((n) => n.toLowerCase() === coll)
  if (byColl) return byColl
  const count = new Map<string, number>()
  for (const n of names) count.set(n, (count.get(n) ?? 0) + 1)
  return [...count].sort((a, b) => b[1] - a[1])[0][0]
}

/** Sorted distinct collection ("หมวด") names. */
export const collectionsOf = (items: { collection: string }[]) =>
  [...new Set(items.map((i) => i.collection).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'))
