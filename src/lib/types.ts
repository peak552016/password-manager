import {
  Database,
  FileCode2,
  KeyRound,
  Puzzle,
  Server,
  StickyNote,
  Terminal,
  Ticket,
  type LucideIcon,
} from 'lucide-react'

/**
 * Item types. Each type declares only the fields it needs, so the form stays
 * short. Common to every type: title, notes, custom fields; and for technical
 * types also environment + knowledge link.
 */

export type FieldKind =
  | 'text' // plain single line
  | 'mono' // single line, monospace (ids, hosts)
  | 'secret' // hidden single line
  | 'password' // hidden + generator + strength meter
  | 'url'
  | 'multiline' // plain textarea
  | 'secretBlock' // hidden monospace textarea (curl, .env, private keys)
  | 'date'

export interface FieldDef {
  key: string
  label: string
  kind: FieldKind
  placeholder?: string
  /** show in list subtitle when set (first match wins) */
  subtitle?: boolean
}

export interface TypeDef {
  id: string
  label: string
  Icon: LucideIcon
  /** one-line hint on the type picker */
  hint: string
  color: string
  /** show Environment + Link Knowledge */
  technical: boolean
  fields: FieldDef[]
}

export const TYPES: TypeDef[] = [
  {
    id: 'login',
    label: 'Login เว็บไซต์',
    Icon: KeyRound,
    hint: 'ชื่อผู้ใช้ + รหัสผ่านของเว็บ/แอพ',
    color: '#4f8cff',
    technical: false,
    fields: [
      { key: 'username', label: 'ชื่อผู้ใช้ / อีเมล', kind: 'text', subtitle: true },
      { key: 'password', label: 'รหัสผ่าน', kind: 'password' },
      { key: 'url', label: 'เว็บไซต์', kind: 'url', placeholder: 'https://' },
    ],
  },
  {
    id: 'api',
    label: 'API Credentials',
    Icon: Puzzle,
    hint: 'API Key, Client ID / Secret',
    color: '#7c3aed',
    technical: true,
    fields: [
      { key: 'apiKey', label: 'Key', kind: 'secret' },
      { key: 'clientId', label: 'Client ID', kind: 'mono', subtitle: true },
      { key: 'clientSecret', label: 'Client Secret', kind: 'secret' },
      { key: 'url', label: 'Endpoint / Base URL', kind: 'url', placeholder: 'https://api.example.com' },
    ],
  },
  {
    id: 'token',
    label: 'Token',
    Icon: Ticket,
    hint: 'Bearer, Personal Access Token, JWT',
    color: '#0891b2',
    technical: true,
    fields: [
      { key: 'token', label: 'Token', kind: 'secretBlock' },
      { key: 'tokenType', label: 'ประเภท Token', kind: 'text', placeholder: 'เช่น Bearer, GitHub PAT, JWT', subtitle: true },
      { key: 'scope', label: 'Scope / สิทธิ์', kind: 'text' },
      { key: 'expiresAt', label: 'หมดอายุ', kind: 'date' },
      { key: 'url', label: 'ใช้กับ URL', kind: 'url' },
    ],
  },
  {
    id: 'curl',
    label: 'cURL / Request',
    Icon: Terminal,
    hint: 'คำสั่ง curl ที่มี header / token',
    color: '#ea580c',
    technical: true,
    fields: [
      { key: 'curl', label: 'คำสั่ง cURL', kind: 'secretBlock', placeholder: "curl -X POST https://… -H 'Authorization: Bearer …'" },
      { key: 'description', label: 'ใช้ทำอะไร', kind: 'text', subtitle: true },
    ],
  },
  {
    id: 'database',
    label: 'Database',
    Icon: Database,
    hint: 'Host, Port, User, Password, Connection string',
    color: '#16a34a',
    technical: true,
    fields: [
      { key: 'dbType', label: 'ชนิด', kind: 'text', placeholder: 'เช่น PostgreSQL, Oracle, SQL Server' },
      { key: 'host', label: 'Host', kind: 'mono', subtitle: true },
      { key: 'port', label: 'Port', kind: 'mono' },
      { key: 'database', label: 'Database / Schema', kind: 'mono' },
      { key: 'username', label: 'Username', kind: 'mono' },
      { key: 'password', label: 'Password', kind: 'password' },
      { key: 'connectionString', label: 'Connection string', kind: 'secretBlock' },
    ],
  },
  {
    id: 'server',
    label: 'Server / SSH',
    Icon: Server,
    hint: 'Host, User, Password หรือ Private key',
    color: '#475569',
    technical: true,
    fields: [
      { key: 'host', label: 'Host / IP', kind: 'mono', subtitle: true },
      { key: 'port', label: 'Port', kind: 'mono', placeholder: '22' },
      { key: 'username', label: 'Username', kind: 'mono' },
      { key: 'password', label: 'Password', kind: 'password' },
      { key: 'privateKey', label: 'Private key', kind: 'secretBlock', placeholder: '-----BEGIN OPENSSH PRIVATE KEY-----' },
    ],
  },
  {
    id: 'env',
    label: 'Environment Variables',
    Icon: FileCode2,
    hint: 'ไฟล์ .env / config ทั้งก้อน',
    color: '#ca8a04',
    technical: true,
    fields: [
      { key: 'content', label: 'เนื้อหา (.env)', kind: 'secretBlock', placeholder: 'API_KEY=…\nDB_PASSWORD=…' },
      { key: 'project', label: 'ใช้กับโปรเจกต์', kind: 'text', subtitle: true },
    ],
  },
  {
    id: 'note',
    label: 'Secure Note',
    Icon: StickyNote,
    hint: 'ข้อความลับทั่วไป',
    color: '#db2777',
    technical: false,
    fields: [{ key: 'content', label: 'ข้อความ', kind: 'secretBlock' }],
  },
]

export const typeOf = (id: string): TypeDef => TYPES.find((t) => t.id === id) ?? TYPES[0]

export const isSecretKind = (k: FieldKind) => k === 'secret' || k === 'password' || k === 'secretBlock'
