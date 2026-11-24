/**
 * PIN for "show everything" while the vault is unlocked. It is a second gate
 * against someone at an unlocked screen, not encryption: data stays protected
 * by the master password. Stored per vault as an Argon2id hash.
 */
import { argon2id } from 'hash-wasm'
import { b64decode, b64encode } from './encoding'

const key = (vaultId: string) => `vault-pin:${vaultId}`
export const PIN_MAX_TRIES = 5

interface Stored {
  salt: string
  hash: string
}

const derive = (pin: string, salt: Uint8Array) =>
  argon2id({ password: pin, salt, parallelism: 1, iterations: 2, memorySize: 19456, hashLength: 32, outputType: 'hex' })

function read(vaultId: string): Stored | null {
  try {
    const v = localStorage.getItem(key(vaultId))
    return v ? (JSON.parse(v) as Stored) : null
  } catch {
    return null
  }
}

export const hasPin = (vaultId: string) => read(vaultId) !== null
export const isValidPin = (pin: string) => /^\d{4,8}$/.test(pin)

export async function setPin(vaultId: string, pin: string) {
  if (!isValidPin(pin)) throw new Error('PIN ต้องเป็นตัวเลข 4–8 หลัก')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  localStorage.setItem(key(vaultId), JSON.stringify({ salt: b64encode(salt), hash: await derive(pin, salt) } satisfies Stored))
}

export async function verifyPin(vaultId: string, pin: string): Promise<boolean> {
  const s = read(vaultId)
  if (!s) return false
  const h = await derive(pin, b64decode(s.salt))
  // constant-time compare
  let diff = h.length ^ s.hash.length
  for (let i = 0; i < Math.min(h.length, s.hash.length); i++) diff |= h.charCodeAt(i) ^ s.hash.charCodeAt(i)
  return diff === 0
}

export function clearPin(vaultId: string) {
  try {
    localStorage.removeItem(key(vaultId))
  } catch {
    /* ignore */
  }
}
