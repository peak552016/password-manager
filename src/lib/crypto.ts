/**
 * Cryptographic core. Everything happens on the client; nothing here ever
 * leaves the device in plaintext.
 *
 * Key hierarchy (designed so sharing can be added later without re-encrypting
 * every item):
 *
 *   master password ──Argon2id(salt)──▶ KEK (key-encryption key, never stored)
 *        KEK ──wraps──▶ vault key (random AES-256-GCM, one per vault)
 *        vault key ──encrypts──▶ each item (AES-256-GCM, fresh 96-bit IV)
 *        vault key ──wraps──▶ user's ECDH P-256 private key (for future sharing)
 *
 * Sharing a vault later = wrap that vault's key for the recipient's public key.
 * Changing the master password = re-wrap the vault key only.
 */
import { argon2id } from 'hash-wasm'
import { b64decode, b64encode } from './encoding'

export interface KdfParams {
  algo: 'argon2id'
  /** memory in KiB */
  memory: number
  iterations: number
  parallelism: number
  salt: string // base64
}

/** OWASP-recommended range; ~0.5–1.5 s on a modern phone. */
export const DEFAULT_KDF = { memory: 64 * 1024, iterations: 3, parallelism: 1 }

export interface Encrypted {
  iv: string // base64
  ct: string // base64 (ciphertext + GCM tag)
}

const enc = new TextEncoder()
const dec = new TextDecoder()

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n))
}

export function newKdfParams(overrides: Partial<typeof DEFAULT_KDF> = {}): KdfParams {
  return { algo: 'argon2id', ...DEFAULT_KDF, ...overrides, salt: b64encode(randomBytes(16)) }
}

/** Derive the key-encryption key from the master password. */
export async function deriveKek(password: string, p: KdfParams): Promise<CryptoKey> {
  const raw = await argon2id({
    password: password.normalize('NFKC'),
    salt: b64decode(p.salt),
    memorySize: p.memory,
    iterations: p.iterations,
    parallelism: p.parallelism,
    hashLength: 32,
    outputType: 'binary',
  })
  try {
    return await crypto.subtle.importKey('raw', raw as Uint8Array<ArrayBuffer>, 'AES-GCM', false, [
      'wrapKey',
      'unwrapKey',
    ])
  } finally {
    raw.fill(0)
  }
}

export function generateVaultKey(): Promise<CryptoKey> {
  // extractable only so it can be wrapped; raw bytes are never exposed otherwise
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
    'wrapKey',
    'unwrapKey',
  ]) as Promise<CryptoKey>
}

export async function wrapKey(key: CryptoKey, wrapper: CryptoKey, format: 'raw' | 'pkcs8' = 'raw'): Promise<Encrypted> {
  const iv = randomBytes(12)
  const ct = await crypto.subtle.wrapKey(format, key, wrapper, { name: 'AES-GCM', iv })
  return { iv: b64encode(iv), ct: b64encode(new Uint8Array(ct)) }
}

/** Throws if the wrapper is wrong (GCM authentication fails). */
export function unwrapVaultKey(w: Encrypted, kek: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw',
    b64decode(w.ct),
    kek,
    { name: 'AES-GCM', iv: b64decode(w.iv) },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],
  )
}

export async function encryptJson(key: CryptoKey, data: unknown, aad?: string): Promise<Encrypted> {
  const iv = randomBytes(12)
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, ...(aad ? { additionalData: enc.encode(aad) } : {}) },
    key,
    enc.encode(JSON.stringify(data)),
  )
  return { iv: b64encode(iv), ct: b64encode(new Uint8Array(ct)) }
}

export async function decryptJson<T>(key: CryptoKey, e: Encrypted, aad?: string): Promise<T> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64decode(e.iv), ...(aad ? { additionalData: enc.encode(aad) } : {}) },
    key,
    b64decode(e.ct),
  )
  return JSON.parse(dec.decode(pt)) as T
}

// ---- Identity keypair (groundwork for sharing) ----

export interface Identity {
  publicKey: JsonWebKey
  wrappedPrivateKey: Encrypted
}

export async function generateIdentity(wrapper: CryptoKey): Promise<Identity> {
  const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])
  return {
    publicKey: await crypto.subtle.exportKey('jwk', kp.publicKey),
    wrappedPrivateKey: await wrapKey(kp.privateKey, wrapper, 'pkcs8'),
  }
}
