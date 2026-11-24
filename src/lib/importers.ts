/**
 * Importers for files exported from other tools. Everything runs in the
 * browser; nothing is uploaded.
 *
 *  - DBeaver: data-sources.json (+ optional credentials-config.json)
 *  - Postman: Collection v2.x export, Environment export
 */
import { EMPTY_ENTRY, type Entry } from './vault'

// ---------------------------------------------------------------------------
// Environment from a name like "customer - UAT", "kyc - pre", "ekyc SIT"
// ---------------------------------------------------------------------------

const ENV_PATTERNS: [RegExp, string][] = [
  [/(^|[^a-z])(pre[-_ ]?prod|preprod|pre[-_ ]?prd|pre)([^a-z]|$)/i, 'PRE-PROD'],
  [/(^|[^a-z])non[-_ ]?prod([^a-z]|$)/i, 'NON-PROD'],
  [/(^|[^a-z])(prod|prd|production)([^a-z]|$)/i, 'PROD'],
  [/(^|[^a-z])uat([^a-z]|$)/i, 'UAT'],
  [/(^|[^a-z])sit([^a-z]|$)/i, 'SIT'],
  [/(^|[^a-z])(dev|develop|development)([^a-z]|$)/i, 'DEV'],
]

export function detectEnvironment(...texts: (string | undefined)[]): string {
  for (const t of texts) {
    if (!t) continue
    for (const [re, env] of ENV_PATTERNS) if (re.test(t)) return env
  }
  return ''
}

const entry = (p: Partial<Entry>): Entry => ({ ...EMPTY_ENTRY, ...p, values: { ...(p.values ?? {}) }, fields: p.fields ?? [] })

// ---------------------------------------------------------------------------
// DBeaver
// ---------------------------------------------------------------------------

/** DBeaver's built-in, publicly documented key for credentials-config.json. */
const DBEAVER_KEY_HEX = 'babb4a9f774ab853c96c2d653dfe544a'

const hex = (h: string) => new Uint8Array(h.match(/../g)!.map((x) => parseInt(x, 16)))

export interface DbeaverCreds {
  [connectionId: string]: { '#connection'?: { user?: string; password?: string } }
}

/** Decrypts DBeaver's credentials-config.json (AES-128-CBC, IV = first 16 bytes). */
export async function decryptDbeaverCredentials(bytes: ArrayBuffer): Promise<DbeaverCreds> {
  const data = new Uint8Array(bytes)
  if (data.length < 32) throw new Error('ไฟล์ credentials-config.json สั้นผิดปกติ')
  const key = await crypto.subtle.importKey('raw', hex(DBEAVER_KEY_HEX), 'AES-CBC', false, ['decrypt'])
  let plain: ArrayBuffer
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: data.slice(0, 16) }, key, data.slice(16))
  } catch {
    throw new Error('ถอดรหัส credentials-config.json ไม่ได้ (DBeaver อาจตั้ง master password ไว้)')
  }
  const text = new TextDecoder().decode(plain)
  return JSON.parse(text.slice(text.indexOf('{')))
}

interface DbeaverConn {
  provider?: string
  driver?: string
  name?: string
  folder?: string
  configuration?: {
    host?: string
    port?: string | number
    database?: string
    url?: string
    user?: string
    password?: string
    type?: string
    'auth-model'?: string
  }
}

const DB_NAMES: Record<string, string> = {
  postgresql: 'PostgreSQL',
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  mariadb: 'MariaDB',
  oracle: 'Oracle',
  sqlserver: 'SQL Server',
  mssql: 'SQL Server',
  db2: 'DB2',
  sqlite: 'SQLite',
  mongodb: 'MongoDB',
  redshift: 'Redshift',
  snowflake: 'Snowflake',
  redis: 'Redis',
  generic: '',
}

function dbLabel(c: DbeaverConn): string {
  const raw = `${c.driver ?? ''} ${c.provider ?? ''}`.toLowerCase()
  for (const [k, v] of Object.entries(DB_NAMES)) if (raw.includes(k)) return v
  return c.provider ?? ''
}

export function isDbeaverDataSources(x: unknown): x is { connections: Record<string, DbeaverConn> } {
  return !!x && typeof x === 'object' && typeof (x as { connections?: unknown }).connections === 'object'
}

export function importDbeaver(
  dataSources: { connections: Record<string, DbeaverConn> },
  creds: DbeaverCreds = {},
  project = '',
): Entry[] {
  return Object.entries(dataSources.connections).map(([id, c]) => {
    const cfg = c.configuration ?? {}
    const cred = creds[id]?.['#connection'] ?? {}
    const name = c.name || cfg.host || id
    const values: Record<string, string> = {
      dbType: dbLabel(c),
      host: cfg.host ?? '',
      port: cfg.port != null ? String(cfg.port) : '',
      database: cfg.database ?? '',
      username: cred.user ?? cfg.user ?? '',
      password: cred.password ?? cfg.password ?? '',
    }
    if (cfg.url && !cfg.host) values.connectionString = cfg.url
    return entry({
      type: 'database',
      title: name,
      collection: project,
      environment: detectEnvironment(name, cfg.host, c.folder),
      notes: [project && `DBeaver project: ${project}`, c.folder && `DBeaver folder: ${c.folder}`].filter(Boolean).join('\n'),
      values: Object.fromEntries(Object.entries(values).filter(([, v]) => v)),
    })
  })
}

// ---------------------------------------------------------------------------
// Postman
// ---------------------------------------------------------------------------

interface PmKV {
  key: string
  value?: string
  disabled?: boolean
  enabled?: boolean
  type?: string
  src?: unknown
}
interface PmAuth {
  type: string
  [k: string]: PmKV[] | string | undefined
}
interface PmRequest {
  method?: string
  header?: PmKV[]
  url?: string | { raw?: string }
  body?: {
    mode?: string
    raw?: string
    urlencoded?: PmKV[]
    formdata?: PmKV[]
    graphql?: { query?: string; variables?: string }
  }
  auth?: PmAuth
  description?: string
}
interface PmItem {
  name?: string
  item?: PmItem[]
  request?: PmRequest | string
  auth?: PmAuth
}
export interface PostmanCollection {
  info: { name?: string; schema?: string }
  item: PmItem[]
  auth?: PmAuth
  variable?: PmKV[]
}
export interface PostmanEnvironment {
  name: string
  values: PmKV[]
  _postman_variable_scope?: string
}

export function isPostmanCollection(x: unknown): x is PostmanCollection {
  const c = x as PostmanCollection
  return !!c && typeof c === 'object' && !!c.info && Array.isArray(c.item)
}

export function isPostmanEnvironment(x: unknown): x is PostmanEnvironment {
  const e = x as PostmanEnvironment
  return !!e && typeof e === 'object' && Array.isArray(e.values) && typeof e.name === 'string' && !('info' in e)
}

/** Single-quote for POSIX shells. */
const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

function authParam(a: PmAuth, key: string): string {
  const list = a[a.type]
  if (!Array.isArray(list)) return ''
  return list.find((kv) => kv.key === key)?.value ?? ''
}

function authArgs(a: PmAuth | undefined): string[] {
  if (!a || a.type === 'noauth') return []
  switch (a.type) {
    case 'bearer':
      return ['-H', q(`Authorization: Bearer ${authParam(a, 'token')}`)]
    case 'basic':
      return ['-u', q(`${authParam(a, 'username')}:${authParam(a, 'password')}`)]
    case 'apikey': {
      const k = authParam(a, 'key') || 'x-api-key'
      const v = authParam(a, 'value')
      return authParam(a, 'in') === 'query' ? [] : ['-H', q(`${k}: ${v}`)]
    }
    default:
      return []
  }
}

export function toCurl(r: PmRequest, inheritedAuth?: PmAuth): string {
  const method = (r.method ?? 'GET').toUpperCase()
  let url = typeof r.url === 'string' ? r.url : (r.url?.raw ?? '')
  const auth = r.auth ?? inheritedAuth
  if (auth?.type === 'apikey' && authParam(auth, 'in') === 'query') {
    url += `${url.includes('?') ? '&' : '?'}${authParam(auth, 'key')}=${authParam(auth, 'value')}`
  }
  const parts: string[][] = [[`curl -X ${method} ${q(url)}`]]
  parts.push(authArgs(auth))
  for (const h of r.header ?? []) if (!h.disabled) parts.push(['-H', q(`${h.key}: ${h.value ?? ''}`)])
  const b = r.body
  if (b?.mode === 'raw' && b.raw) {
    parts.push(['--data-raw', q(b.raw)])
  } else if (b?.mode === 'urlencoded') {
    for (const kv of b.urlencoded ?? []) if (!kv.disabled) parts.push(['--data-urlencode', q(`${kv.key}=${kv.value ?? ''}`)])
  } else if (b?.mode === 'formdata') {
    for (const kv of b.formdata ?? [])
      if (!kv.disabled) parts.push(['-F', q(kv.type === 'file' ? `${kv.key}=@${String(kv.src ?? '')}` : `${kv.key}=${kv.value ?? ''}`)])
  } else if (b?.mode === 'graphql' && b.graphql) {
    parts.push(['--data-raw', q(JSON.stringify({ query: b.graphql.query ?? '', variables: tryJson(b.graphql.variables) }))])
  }
  return parts
    .filter((p) => p.length)
    .map((p) => p.join(' '))
    .join(' \\\n  ')
}

function tryJson(s?: string): unknown {
  try {
    return s ? JSON.parse(s) : {}
  } catch {
    return s
  }
}

export function importPostmanCollection(col: PostmanCollection): Entry[] {
  const out: Entry[] = []
  const colName = col.info.name ?? 'Postman'
  const walk = (items: PmItem[], path: string[], auth?: PmAuth) => {
    for (const it of items) {
      if (it.item) {
        walk(it.item, [...path, it.name ?? ''], it.auth ?? auth)
        continue
      }
      if (!it.request) continue
      const r: PmRequest = typeof it.request === 'string' ? { method: 'GET', url: it.request } : it.request
      const url = typeof r.url === 'string' ? r.url : (r.url?.raw ?? '')
      out.push(
        entry({
          type: 'curl',
          title: it.name || url,
          collection: colName,
          environment: detectEnvironment(it.name, url, ...path, colName),
          notes: [typeof r.description === 'string' ? r.description : '', `Postman: ${[colName, ...path].filter(Boolean).join(' / ')}`]
            .filter(Boolean)
            .join('\n\n'),
          values: { curl: toCurl(r, auth), description: `${(r.method ?? 'GET').toUpperCase()} ${url}` },
        }),
      )
    }
  }
  walk(col.item, [], col.auth)
  // collection variables become one .env entry so {{vars}} in the curls can be resolved
  const vars = (col.variable ?? []).filter((v) => v.key)
  if (vars.length)
    out.push(
      entry({
        type: 'env',
        title: `${colName} (collection variables)`,
        collection: colName,
        environment: detectEnvironment(colName),
        values: { content: vars.map((v) => `${v.key}=${v.value ?? ''}`).join('\n'), project: colName },
      }),
    )
  return out
}

export function importPostmanEnvironment(env: PostmanEnvironment): Entry {
  const lines = env.values.filter((v) => v.key && v.enabled !== false).map((v) => `${v.key}=${v.value ?? ''}`)
  return entry({
    type: 'env',
    title: env.name,
    environment: detectEnvironment(env.name),
    notes: 'นำเข้าจาก Postman Environment',
    values: { content: lines.join('\n'), project: env.name },
  })
}

// ---- Postman "Export data" dump (Settings → Data): v1 collections ----

interface PmV1Request {
  name?: string
  method?: string
  url?: string
  headers?: string
  headerData?: { key: string; value: string; enabled?: boolean }[]
  dataMode?: string
  rawModeData?: string
  data?: { key: string; value: string; enabled?: boolean }[] | null
  folder?: string | null
}

export interface PostmanV1Collection {
  name: string
  folders?: { id: string; name: string }[]
  requests: PmV1Request[]
}

export function isPostmanV1Collection(x: unknown): x is PostmanV1Collection {
  const c = x as PostmanV1Collection
  return !!c && typeof c === 'object' && typeof c.name === 'string' && Array.isArray(c.requests)
}

/** Postman data dumps hold many collections and environments in one JSON. */
export function isPostmanDump(x: unknown): x is { collections?: unknown[]; environments?: unknown[] } {
  const d = x as { collections?: unknown[]; environments?: unknown[] }
  return !!d && typeof d === 'object' && (Array.isArray(d.collections) || Array.isArray(d.environments)) && !('info' in d)
}

export function importPostmanV1Collection(col: PostmanV1Collection): Entry[] {
  const folders = new Map((col.folders ?? []).map((f) => [f.id, f.name]))
  return col.requests.map((r) => {
    const header: PmKV[] =
      r.headerData?.filter((h) => h.enabled !== false).map((h) => ({ key: h.key, value: h.value })) ??
      (r.headers ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => ({ key: l.slice(0, l.indexOf(':')).trim(), value: l.slice(l.indexOf(':') + 1).trim() }))
    const kv = (r.data ?? []).filter((d) => d.enabled !== false).map((d) => ({ key: d.key, value: d.value }))
    const body: PmRequest['body'] =
      r.dataMode === 'raw' ? { mode: 'raw', raw: r.rawModeData ?? '' } : r.dataMode === 'urlencoded' ? { mode: 'urlencoded', urlencoded: kv } : r.dataMode === 'params' && kv.length ? { mode: 'formdata', formdata: kv } : undefined
    const req: PmRequest = { method: r.method ?? 'GET', url: r.url ?? '', header, body }
    const path = [col.name, r.folder ? folders.get(r.folder) : ''].filter(Boolean).join(' / ')
    return entry({
      type: 'curl',
      title: r.name || r.url || 'request',
      collection: col.name,
      environment: detectEnvironment(r.name, r.url, col.name),
      notes: `Postman: ${path}`,
      values: { curl: toCurl(req), description: `${(r.method ?? 'GET').toUpperCase()} ${r.url ?? ''}` },
    })
  })
}

/** Put environments into the collection whose name they share, e.g. "ekyc SIT" → "eKYC v2". */
export function linkEnvironments(envs: Entry[], collections: string[]) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '')
  for (const e of envs) {
    if (e.collection) continue
    const base = norm(e.title.replace(/(^|[^a-z])(pre[-_ ]?prod|preprod|non[-_ ]?prod|prod|prd|uat|sit|dev|pre|staging|stg)(?=[^a-z]|$)/gi, '$1'))
    if (base.length < 3) continue
    const hits = collections.filter((c) => norm(c).includes(base) || base.includes(norm(c)))
    if (hits.length === 1) e.collection = hits[0]
  }
}

/** KEY=value lines of an imported environment / collection-variables entry. */
export function parseEnvContent(content: string): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const i = line.indexOf('=')
    if (i > 0) vars[line.slice(0, i).trim()] = line.slice(i + 1)
  }
  return vars
}

/** Replace Postman-style {{var}} placeholders. Unknown vars are left as-is. */
export function resolveVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.$-]+)\s*\}\}/g, (m, k: string) => (k in vars ? vars[k] : m))
}

/** Bake an environment's variables into imported cURL entries. */
export function applyEnvironment(entries: Entry[], envEntry: Entry): Entry[] {
  const vars = parseEnvContent(envEntry.values.content ?? '')
  return entries.map((e) =>
    e.type !== 'curl'
      ? e
      : {
          ...e,
          title: envEntry.environment && !detectEnvironment(e.title) ? `${e.title} [${envEntry.environment}]` : e.title,
          environment: envEntry.environment || e.environment,
          values: Object.fromEntries(Object.entries(e.values).map(([k, v]) => [k, resolveVars(v, vars)])),
        },
  )
}

// ---------------------------------------------------------------------------
// test helper
// ---------------------------------------------------------------------------

/** Encrypts JSON the way DBeaver does (used by tests). */
export async function encryptDbeaverCredentials(obj: unknown): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', hex(DBEAVER_KEY_HEX), 'AES-CBC', false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(16))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, new TextEncoder().encode(JSON.stringify(obj))))
  const out = new Uint8Array(16 + ct.length)
  out.set(iv)
  out.set(ct, 16)
  return out.buffer
}
