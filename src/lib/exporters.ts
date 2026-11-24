/**
 * Plain (UNENCRYPTED) exports for other tools. The caller must confirm the
 * master password and warn the user before using these.
 *
 *  - DBeaver: "Custom (CSV)" connection import, one file per database engine
 *    (DBeaver asks for the driver per import). Columns per DBeaver docs:
 *    name, host, port, database, url, user, password.
 *  - Postman: one Environment from env / API / token entries.
 *  - CSV / JSON: everything, for spreadsheets or other managers.
 */
import type { Entry } from './vault'
import { dbEngine } from './format'
import { parseEnvContent } from './importers'
import { typeOf } from './types'

export interface ExportFile {
  name: string
  mime: string
  text: string
  /** shown to the user next to the file */
  note?: string
}

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
// bom: Excel needs it to read Thai as UTF-8; DBeaver would take it as part of the first header
const csv = (rows: string[][], bom = false) => (bom ? '\uFEFF' : '') + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'

export function jdbcUrl(engine: string, v: Record<string, string>): string {
  if (v.connectionString?.startsWith('jdbc:')) return v.connectionString
  const h = v.host ?? ''
  if (!h) return v.connectionString ?? ''
  const p = v.port ? `:${v.port}` : ''
  const db = v.database ?? ''
  switch (engine) {
    case 'PostgreSQL':
      return `jdbc:postgresql://${h}${p}/${db}`
    case 'MySQL':
      return `jdbc:mysql://${h}${p}/${db}`
    case 'MariaDB':
      return `jdbc:mariadb://${h}${p}/${db}`
    case 'Oracle':
      return `jdbc:oracle:thin:@//${h}${p}/${db}`
    case 'SQL Server':
      return `jdbc:sqlserver://${h}${p}${db ? `;databaseName=${db}` : ''}`
    case 'DB2':
      return `jdbc:db2://${h}${p}/${db}`
    case 'Redshift':
      return `jdbc:redshift://${h}${p}/${db}`
    default:
      return ''
  }
}

const fileSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'other'

export function toDbeaver(entries: Entry[], base: string): ExportFile[] {
  const byEngine = new Map<string, Entry[]>()
  for (const e of entries.filter((e) => e.type === 'database')) {
    const eng = dbEngine(e.values)?.label ?? 'อื่นๆ'
    byEngine.set(eng, [...(byEngine.get(eng) ?? []), e])
  }
  return [...byEngine].map(([engine, list]) => ({
    name: `${base}-dbeaver-${fileSlug(engine)}.csv`,
    mime: 'text/csv',
    note: `${list.length} connection · ตอนนำเข้าเลือก driver: ${engine}`,
    text: csv([
      ['name', 'host', 'port', 'database', 'url', 'user', 'password'],
      ...list.map((e) => {
        const v = e.values
        return [e.title, v.host ?? '', v.port ?? '', v.database ?? '', jdbcUrl(engine, v), v.username ?? '', v.password ?? '']
      }),
    ]),
  }))
}

const varName = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')

export function toPostmanEnvironment(entries: Entry[], name: string): ExportFile[] {
  const values: { key: string; value: string; type: 'default' | 'secret'; enabled: true }[] = []
  const add = (key: string, value: string | undefined, secret = true) => {
    if (value) values.push({ key, value, type: secret ? 'secret' : 'default', enabled: true })
  }
  for (const e of entries) {
    const p = varName(e.title)
    if (e.type === 'env') for (const [k, v] of Object.entries(parseEnvContent(e.values.content ?? ''))) add(k, v, /secret|token|key|pass/i.test(k))
    else if (e.type === 'api') {
      add(`${p}_baseUrl`, e.values.url, false)
      add(`${p}_apiKey`, e.values.apiKey)
      add(`${p}_clientId`, e.values.clientId, false)
      add(`${p}_clientSecret`, e.values.clientSecret)
    } else if (e.type === 'token') add(`${p}_token`, e.values.token)
  }
  if (!values.length) return []
  return [
    {
      name: `${fileSlug(name) || 'vault'}.postman_environment.json`,
      mime: 'application/json',
      note: `${values.length} ตัวแปร · Postman → Import → เลือกไฟล์นี้`,
      text: JSON.stringify({ name: name || 'Vault export', values, _postman_variable_scope: 'environment' }, null, 2),
    },
  ]
}

export function toPlainCsv(entries: Entry[], base: string): ExportFile[] {
  const keys: string[] = []
  for (const e of entries) for (const f of typeOf(e.type).fields) if (e.values[f.key] && !keys.includes(f.key)) keys.push(f.key)
  const custom: string[] = []
  for (const e of entries) for (const f of e.fields) if (f.label && !custom.includes(f.label)) custom.push(f.label)
  return [
    {
      name: `${base}.csv`,
      mime: 'text/csv',
      text: csv([
        ['type', 'title', 'collection', 'environment', 'access', ...keys, 'knowledgeUrl', 'notes', ...custom],
        ...entries.map((e) => [
          typeOf(e.type).label,
          e.title,
          e.collection,
          e.environment,
          e.access.join(' + '),
          ...keys.map((k) => e.values[k] ?? ''),
          e.knowledgeUrl,
          e.notes,
          ...custom.map((c) => e.fields.find((f) => f.label === c)?.value ?? ''),
        ]),
      ], true),
    },
  ]
}

export const toPlainJson = (entries: Entry[], base: string): ExportFile[] => [
  { name: `${base}.json`, mime: 'application/json', text: JSON.stringify({ format: 'vault-plain', version: 1, entries }, null, 2) },
]
