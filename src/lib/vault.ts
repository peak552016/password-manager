import {
  decryptJson,
  deriveKek,
  encryptJson,
  generateIdentity,
  generateVaultKey,
  newKdfParams,
  unwrapVaultKey,
  wrapKey,
  DEFAULT_KDF,
} from './crypto'
import * as db from './db'
import type { AccountRecord, ItemRecord } from './db'

export interface Entry {
  title: string
  username: string
  password: string
  url: string
  notes: string
}

export interface DecryptedItem extends Entry {
  id: string
  updatedAt: number
}

export interface Session {
  vaultId: string
  key: CryptoKey
}

export class WrongPasswordError extends Error {
  constructor() {
    super('รหัสผ่านหลักไม่ถูกต้อง')
  }
}

/** Items are bound to their id + vault so ciphertexts can't be swapped around. */
const aad = (vaultId: string, itemId: string) => `item:${vaultId}:${itemId}`

export function hasAccount(): Promise<boolean> {
  return db.getAccount().then(Boolean)
}

export async function createAccount(
  password: string,
  kdf: Partial<typeof DEFAULT_KDF> = {},
): Promise<Session> {
  const params = newKdfParams(kdf)
  const kek = await deriveKek(password, params)
  const key = await generateVaultKey()
  const vaultId = crypto.randomUUID()
  const account: AccountRecord = {
    id: 'account',
    version: 1,
    kdf: params,
    identity: await generateIdentity(key),
    vaults: [
      {
        id: vaultId,
        wrappedKey: await wrapKey(key, kek),
        meta: await encryptJson(key, { name: 'ส่วนตัว' }, `vault:${vaultId}`),
      },
    ],
    createdAt: Date.now(),
  }
  await db.putAccount(account)
  void db.requestPersistence()
  return { vaultId, key }
}

async function unlockAccount(account: AccountRecord, password: string): Promise<Session> {
  const kek = await deriveKek(password, account.kdf)
  const v = account.vaults[0]
  try {
    return { vaultId: v.id, key: await unwrapVaultKey(v.wrappedKey, kek) }
  } catch {
    throw new WrongPasswordError()
  }
}

export async function unlock(password: string): Promise<Session> {
  const account = await db.getAccount()
  if (!account) throw new Error('ยังไม่มีคลังรหัสผ่าน')
  return unlockAccount(account, password)
}

/** Only re-wraps the vault key; items are untouched. */
export async function changeMasterPassword(current: string, next: string): Promise<void> {
  const account = await db.getAccount()
  if (!account) throw new Error('ยังไม่มีคลังรหัสผ่าน')
  const kek = await deriveKek(current, account.kdf)
  const kdf = newKdfParams({
    memory: account.kdf.memory,
    iterations: account.kdf.iterations,
    parallelism: account.kdf.parallelism,
  })
  const newKek = await deriveKek(next, kdf)
  const vaults = []
  for (const v of account.vaults) {
    let key: CryptoKey
    try {
      key = await unwrapVaultKey(v.wrappedKey, kek)
    } catch {
      throw new WrongPasswordError()
    }
    vaults.push({ ...v, wrappedKey: await wrapKey(key, newKek) })
  }
  await db.putAccount({ ...account, kdf, vaults })
}

export async function listEntries(s: Session): Promise<DecryptedItem[]> {
  const records = await db.listItems(s.vaultId)
  const items = await Promise.all(
    records.map(async (r) => ({
      ...(await decryptJson<Entry>(s.key, r.data, aad(r.vaultId, r.id))),
      id: r.id,
      updatedAt: r.updatedAt,
    })),
  )
  return items.sort((a, b) => a.title.localeCompare(b.title, 'th'))
}

export async function saveEntry(s: Session, entry: Entry, id: string = crypto.randomUUID()): Promise<DecryptedItem> {
  const updatedAt = Date.now()
  const record: ItemRecord = {
    id,
    vaultId: s.vaultId,
    data: await encryptJson(s.key, entry, aad(s.vaultId, id)),
    updatedAt,
  }
  await db.putItem(record)
  return { ...entry, id, updatedAt }
}

export const deleteEntry = (id: string) => db.deleteItem(id)

// ---- Encrypted backup ----

export interface Backup {
  format: 'pm-backup'
  version: 1
  exportedAt: number
  account: AccountRecord
  items: ItemRecord[]
}

/** The backup is exactly what's on disk: ciphertext only. */
export async function exportBackup(): Promise<Backup> {
  const account = await db.getAccount()
  if (!account) throw new Error('ยังไม่มีคลังรหัสผ่าน')
  return { format: 'pm-backup', version: 1, exportedAt: Date.now(), account, items: await db.allItems() }
}

/** Verifies the password against the backup before overwriting local data. */
export async function importBackup(backup: Backup, password: string): Promise<Session> {
  if (backup?.format !== 'pm-backup' || backup.version !== 1) throw new Error('ไฟล์สำรองไม่ถูกต้อง')
  const session = await unlockAccount(backup.account, password)
  // make sure every item actually decrypts before we replace anything
  for (const r of backup.items) await decryptJson(session.key, r.data, aad(r.vaultId, r.id))
  await db.replaceAll(backup.account, backup.items)
  return session
}
