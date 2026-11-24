/**
 * Pull the credentials out of a stored cURL command so they can be shown
 * (and copied) as separate fields: client id/secret, token, API key, basic auth.
 * {{vars}} are resolved from the given environment variables when possible.
 */
import { resolveVars } from './importers'

export interface CurlCred {
  label: string
  value: string
  secret: boolean
  /** still contains {{var}} that no environment defines */
  unresolved: boolean
}

const KEYS: [RegExp, string, boolean][] = [
  [/^client[_-]?id$/i, 'Client ID', false],
  [/^client[_-]?secret$/i, 'Client Secret', true],
  [/^(x-)?api[_-]?key$|^apikey$/i, 'API Key', true],
  [/^(access[_-]?)?token$/i, 'Token', true],
  [/^(username|user[_-]?name|user)$/i, 'Username', false],
  [/^password$/i, 'Password', true],
  [/^(grant[_-]?type)$/i, 'Grant type', false],
  [/^scope$/i, 'Scope', false],
]

const label = (key: string) => KEYS.find(([re]) => re.test(key.trim()))

export function extractCurlCredentials(curl: string, vars: Record<string, string> = {}): CurlCred[] {
  const text = resolveVars(curl, vars)
  const found: { label: string; value: string; secret: boolean }[] = []
  const add = (l: string, value: string, secret: boolean) => {
    value = value.trim()
    if (value && !found.some((f) => f.label === l && f.value === value)) found.push({ label: l, value, secret })
  }

  // the request URL, so each environment's real address shows
  const url = text.match(/\bcurl\b(?:\s+-X\s+\w+)?\s+(['"]?)((?:https?:\/\/|\{\{)[^'"\s]+)\1/)
  if (url) add('URL', url[2], false)
  // headers: -H 'Name: value'
  for (const m of text.matchAll(/-H\s+(['"])([^:'"]+):\s*(.*?)\1/g)) {
    const [name, value] = [m[2], m[3]]
    const auth = /^authorization$/i.test(name.trim()) ? value.match(/^(Bearer|Basic)\s+(.+)$/i) : null
    if (auth?.[1].toLowerCase() === 'bearer') add('Token', auth[2], true)
    else if (auth?.[1].toLowerCase() === 'basic') basic(auth[2], add)
    else {
      const k = label(name)
      if (k) add(k[1], value, k[2])
    }
  }
  // -u user:pass
  const u = text.match(/(?:-u|--user)\s+(['"])(.*?)\1/)
  if (u) {
    const i = u[2].indexOf(':')
    add('Username', i < 0 ? u[2] : u[2].slice(0, i), false)
    if (i >= 0) add('Password', u[2].slice(i + 1), true)
  }
  // JSON bodies: "client_id": "x"
  for (const m of text.matchAll(/"([\w-]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) {
    const k = label(m[1])
    if (k) add(k[1], m[2], k[2])
  }
  // form / urlencoded / query: client_id=x
  for (const m of text.matchAll(/(?:^|[\s'"?&])([\w-]+)=([^&\s'"]+)/g)) {
    const k = label(m[1])
    if (k) add(k[1], decodeURIComponentSafe(m[2]), k[2])
  }

  return found.map((f) => ({ ...f, unresolved: /\{\{.+?\}\}/.test(f.value) }))
}

function basic(b64: string, add: (l: string, v: string, s: boolean) => void) {
  try {
    const plain = atob(b64.trim())
    const i = plain.indexOf(':')
    if (i < 0) return
    add('Username', plain.slice(0, i), false)
    add('Password', plain.slice(i + 1), true)
  } catch {
    add('Basic auth', b64, true)
  }
}

function decodeURIComponentSafe(s: string) {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '))
  } catch {
    return s
  }
}
