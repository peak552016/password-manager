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

/** Items keep their order; a group appears where its first member was. Only groups with 2+ members are folded. */
export function groupRows(items: DecryptedItem[]): ListRow[] {
  const buckets = new Map<string, DecryptedItem[]>()
  const keyOf = new Map<string, string>()
  for (const i of items) {
    const k = `${i.type}|${baseName(i.title).toLowerCase()}`
    keyOf.set(i.id, k)
    const b = buckets.get(k)
    if (b) b.push(i)
    else buckets.set(k, [i])
  }
  const rows: ListRow[] = []
  const done = new Set<string>()
  for (const i of items) {
    const k = keyOf.get(i.id)!
    const b = buckets.get(k)!
    if (b.length < 2) rows.push({ kind: 'item', item: i })
    else if (!done.has(k)) {
      done.add(k)
      const sorted = [...b].sort((x, y) => envRank(x.environment) - envRank(y.environment) || x.title.localeCompare(y.title))
      rows.push({ kind: 'group', key: k, name: baseName(b[0].title), items: sorted })
    }
  }
  return rows
}

/** Sorted distinct collection ("หมวด") names. */
export const collectionsOf = (items: { collection: string }[]) =>
  [...new Set(items.map((i) => i.collection).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'))
