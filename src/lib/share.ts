/**
 * Share files: a set of entries encrypted with a one-off share password,
 * independent of anyone's master password.
 *
 *   share password ──Argon2id(salt)──▶ KEK ──wraps──▶ random content key
 *   content key ──AES-256-GCM──▶ { name, entries }
 *
 * Only the format tag, version, item count and timestamp are in the clear.
 */
import { decryptJson, deriveKek, encryptJson, generateVaultKey, newKdfParams, unwrapVaultKey, wrapKey, DEFAULT_KDF, type Encrypted, type KdfParams } from './crypto'
import { normalizeEntry, WrongPasswordError, type Entry } from './vault'
import { generatePassword } from './generator'

export interface ShareFile {
  format: 'pm-share'
  version: 1
  createdAt: number
  count: number
  kdf: KdfParams
  wrappedKey: Encrypted
  payload: Encrypted
}

interface Payload {
  name: string
  entries: Entry[]
}

const AAD = 'pm-share:v1'

export async function createShare(
  entries: Entry[],
  password: string,
  name: string,
  kdf: Partial<typeof DEFAULT_KDF> = {},
): Promise<ShareFile> {
  const params = newKdfParams(kdf)
  const kek = await deriveKek(password, params)
  const key = await generateVaultKey()
  // favourites are personal; don't carry them over
  const clean = entries.map((e) => ({ ...normalizeEntry(e as Entry & Record<string, unknown>), favorite: false }))
  return {
    format: 'pm-share',
    version: 1,
    createdAt: Date.now(),
    count: clean.length,
    kdf: params,
    wrappedKey: await wrapKey(key, kek),
    payload: await encryptJson(key, { name, entries: clean } satisfies Payload, AAD),
  }
}

export function isShareFile(x: unknown): x is ShareFile {
  return !!x && typeof x === 'object' && (x as ShareFile).format === 'pm-share'
}

export async function openShare(file: ShareFile, password: string): Promise<Payload> {
  if (!isShareFile(file) || file.version !== 1) throw new Error('ไม่ใช่ไฟล์แชร์ของ Vault')
  const kek = await deriveKek(password, file.kdf)
  let key: CryptoKey
  try {
    key = await unwrapVaultKey(file.wrappedKey, kek)
  } catch {
    throw new WrongPasswordError('รหัสแชร์ไม่ถูกต้อง')
  }
  const p = await decryptJson<Payload>(key, file.payload, AAD)
  return { name: String(p.name ?? ''), entries: (p.entries ?? []).map((e) => normalizeEntry(e as Entry & Record<string, unknown>)) }
}

/** Easy-to-read random share password, e.g. "k7Fq-29xM-pR4t-Wz8n" (~95 bits). */
export function generateSharePassword(): string {
  const raw = generatePassword({ length: 16, lower: true, upper: true, digits: true, symbols: false, avoidAmbiguous: true })
  return raw.match(/.{4}/g)!.join('-')
}
