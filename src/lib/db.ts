/** Minimal IndexedDB wrapper. Only ciphertext is ever written here. */
import type { Encrypted, Identity, KdfParams } from './crypto'

export interface VaultRecord {
  id: string
  /** vault key wrapped by the master-password KEK */
  wrappedKey: Encrypted
  /** encrypted { name } */
  meta: Encrypted
}

export interface AccountRecord {
  id: 'account'
  version: 1
  kdf: KdfParams
  identity: Identity
  vaults: VaultRecord[]
  createdAt: number
}

export interface ItemRecord {
  id: string
  vaultId: string
  data: Encrypted
  updatedAt: number
}

const DB_NAME = 'pm'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      db.createObjectStore('account', { keyPath: 'id' })
      const items = db.createObjectStore('items', { keyPath: 'id' })
      items.createIndex('vaultId', 'vaultId')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function store(name: 'account' | 'items', mode: IDBTransactionMode = 'readonly') {
  return (await open()).transaction(name, mode).objectStore(name)
}

export async function getAccount(): Promise<AccountRecord | undefined> {
  return wrap((await store('account')).get('account'))
}

export async function putAccount(a: AccountRecord): Promise<void> {
  await wrap((await store('account', 'readwrite')).put(a))
}

export async function listItems(vaultId: string): Promise<ItemRecord[]> {
  return wrap((await store('items')).index('vaultId').getAll(vaultId))
}

export async function putItem(i: ItemRecord): Promise<void> {
  await wrap((await store('items', 'readwrite')).put(i))
}

export async function deleteItem(id: string): Promise<void> {
  await wrap((await store('items', 'readwrite')).delete(id))
}

/** Replace everything atomically (used by backup import). */
export async function replaceAll(a: AccountRecord, items: ItemRecord[]): Promise<void> {
  const db = await open()
  const tx = db.transaction(['account', 'items'], 'readwrite')
  tx.objectStore('account').clear()
  tx.objectStore('items').clear()
  tx.objectStore('account').put(a)
  for (const i of items) tx.objectStore('items').put(i)
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function allItems(): Promise<ItemRecord[]> {
  return wrap((await store('items')).getAll())
}

/** Ask the browser not to evict our data (important on iOS Safari). */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
