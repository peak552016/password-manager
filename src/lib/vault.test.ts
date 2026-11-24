import 'fake-indexeddb/auto'
import { describe, expect, it, beforeEach } from 'vitest'
import * as vault from './vault'
import * as db from './db'
import { generatePassword, DEFAULT_GEN } from './generator'

// small KDF params so tests run fast; production uses 64 MiB
const FAST = { memory: 1024, iterations: 1 }

const entry = { title: 'GitHub', username: 'peak', password: 's3cret!', url: 'https://github.com', notes: '' }

describe('vault', () => {
  beforeEach(async () => {
    const a = await db.getAccount()
    if (a) await db.replaceAll({ ...a, vaults: [] }, [])
  })

  it('creates, unlocks and round-trips entries', async () => {
    const s = await vault.createAccount('correct horse', FAST)
    await vault.saveEntry(s, entry)
    const s2 = await vault.unlock('correct horse')
    const items = await vault.listEntries(s2)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject(entry)
  })

  it('stores no plaintext', async () => {
    const s = await vault.createAccount('master-pass-xyz', FAST)
    await vault.saveEntry(s, entry)
    const dump = JSON.stringify(await vault.exportBackup())
    expect(dump).not.toContain('s3cret!')
    expect(dump).not.toContain('GitHub')
    expect(dump).not.toContain('master-pass-xyz')
  })

  it('rejects a wrong master password', async () => {
    await vault.createAccount('right', FAST)
    await expect(vault.unlock('wrong')).rejects.toBeInstanceOf(vault.WrongPasswordError)
  })

  it('changes the master password without touching items', async () => {
    const s = await vault.createAccount('old', FAST)
    await vault.saveEntry(s, entry)
    await vault.changeMasterPassword('old', 'new')
    await expect(vault.unlock('old')).rejects.toBeInstanceOf(vault.WrongPasswordError)
    expect(await vault.listEntries(await vault.unlock('new'))).toHaveLength(1)
  })

  it('detects swapped ciphertexts', async () => {
    const s = await vault.createAccount('pw', FAST)
    const a = await vault.saveEntry(s, entry)
    const b = await vault.saveEntry(s, { ...entry, title: 'B' })
    const [ra, rb] = await Promise.all([a.id, b.id].map(async (id) => (await db.allItems()).find((r) => r.id === id)!))
    await db.putItem({ ...ra, data: rb.data })
    await expect(vault.listEntries(s)).rejects.toThrow()
  })

  it('imports a backup only with the right password', async () => {
    const s = await vault.createAccount('pw', FAST)
    await vault.saveEntry(s, entry)
    const backup = await vault.exportBackup()
    await expect(vault.importBackup(backup, 'nope')).rejects.toBeInstanceOf(vault.WrongPasswordError)
    const s2 = await vault.importBackup(backup, 'pw')
    expect(await vault.listEntries(s2)).toHaveLength(1)
  })
})

describe('generator', () => {
  it('honours length and character sets', () => {
    const pw = generatePassword({ ...DEFAULT_GEN, length: 32 })
    expect(pw).toHaveLength(32)
    expect(pw).toMatch(/[a-z]/)
    expect(pw).toMatch(/[A-Z]/)
    expect(pw).toMatch(/[0-9]/)
    expect(pw).not.toMatch(/[0O1lI|]/)
    expect(generatePassword({ ...DEFAULT_GEN, upper: false, symbols: false, digits: false, length: 50 })).toMatch(
      /^[a-z]+$/,
    )
  })
})
