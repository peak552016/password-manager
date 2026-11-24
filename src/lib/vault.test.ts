import 'fake-indexeddb/auto'
import { describe, expect, it, beforeEach } from 'vitest'
import * as vault from './vault'
import * as db from './db'
import { generatePassword, DEFAULT_GEN } from './generator'
import { createShare, generateSharePassword, openShare } from './share'

// small KDF params so tests run fast; production uses 64 MiB
const FAST = { memory: 1024, iterations: 1 }

const entry = vault.normalizeEntry({ title: 'GitHub', values: { username: 'peak', password: 's3cret!', url: 'https://github.com' } })

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

describe('typed entries', () => {
  it('round-trips typed values and custom fields, encrypted', async () => {
    const s = await vault.createAccount('pw-api-test', FAST)
    const api = vault.normalizeEntry({
      type: 'api',
      title: 'Payment API',
      environment: 'UAT',
      knowledgeUrl: 'https://wiki.example.com/payment',
      values: { apiKey: 'ak_live_123', clientId: 'client-abc', clientSecret: 'cs_secret_456' },
      fields: [{ label: 'Webhook key', value: 'wh_789', secret: true }],
    })
    await vault.saveEntry(s, api)
    const curl = vault.normalizeEntry({ type: 'curl', title: 'Get policy', values: { curl: "curl -H 'Authorization: Bearer tok_abc'" } })
    await vault.saveEntry(s, curl)
    const got = await vault.listEntries(s)
    expect(got.find((g) => g.type === 'api')).toMatchObject(api)
    expect(got.find((g) => g.type === 'curl')).toMatchObject(curl)
    const dump = JSON.stringify(await vault.exportBackup())
    for (const v of ['ak_live_123', 'client-abc', 'cs_secret_456', 'wh_789', 'wiki.example', 'tok_abc', 'Payment']) expect(dump).not.toContain(v)
  })

  it('upgrades entries saved by the first version', async () => {
    const s = await vault.createAccount('pw-old', FAST)
    await vault.saveEntry(s, { title: 'Old', username: 'u', password: 'p', url: 'x.com', notes: 'n' } as unknown as vault.Entry)
    const [got] = await vault.listEntries(s)
    expect(got).toMatchObject({ type: 'login', title: 'Old', notes: 'n', values: { username: 'u', password: 'p', url: 'x.com' }, fields: [] })
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

describe('share files', () => {
  const items = [
    vault.normalizeEntry({ type: 'api', title: 'Claim API', environment: 'UAT', values: { apiKey: 'ak_share_1' }, favorite: true }),
    vault.normalizeEntry({ type: 'curl', title: 'Get claim', values: { curl: 'curl -H "x-key: ak_share_2"' } }),
  ]

  it('round-trips with the share password and hides everything', async () => {
    const pw = generateSharePassword()
    expect(pw).toMatch(/^[A-Za-z0-9]{4}(-[A-Za-z0-9]{4}){3}$/)
    const file = await createShare(items, pw, 'Claim team', FAST)
    const raw = JSON.stringify(file)
    for (const v of ['ak_share_1', 'ak_share_2', 'Claim', 'UAT']) expect(raw).not.toContain(v)
    expect(file.count).toBe(2)
    const opened = await openShare(JSON.parse(raw), pw)
    expect(opened.name).toBe('Claim team')
    expect(opened.entries.map((e) => e.title)).toEqual(['Claim API', 'Get claim'])
    expect(opened.entries[0].favorite).toBe(false)
    expect(opened.entries[0].values.apiKey).toBe('ak_share_1')
  })

  it('rejects a wrong share password', async () => {
    const file = await createShare(items, 'right-pass', 'x', FAST)
    await expect(openShare(file, 'wrong-pass')).rejects.toThrow('รหัสแชร์ไม่ถูกต้อง')
  })

  it('imported entries land in the vault as new items', async () => {
    const s = await vault.createAccount('pw-share-import', FAST)
    const file = await createShare(items, 'sp', 'x', FAST)
    const { entries } = await openShare(file, 'sp')
    for (const e of entries) await vault.saveEntry(s, e)
    expect(await vault.listEntries(s)).toHaveLength(2)
  })
})
