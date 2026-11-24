import { beforeAll, describe, expect, it } from 'vitest'
import { clearPin, hasPin, setPin, verifyPin } from './pin'

beforeAll(() => {
  const m = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  } as Storage
})

describe('pin', () => {
  it('sets, verifies and clears per vault', async () => {
    expect(hasPin('v1')).toBe(false)
    await setPin('v1', '2468')
    expect(hasPin('v1')).toBe(true)
    expect(hasPin('v2')).toBe(false)
    expect(await verifyPin('v1', '2468')).toBe(true)
    expect(await verifyPin('v1', '2469')).toBe(false)
    expect(localStorage.getItem('vault-pin:v1')).not.toContain('2468')
    clearPin('v1')
    expect(await verifyPin('v1', '2468')).toBe(false)
  })
  it('rejects non-numeric or short PINs', async () => {
    await expect(setPin('v3', '12a4')).rejects.toThrow()
    await expect(setPin('v3', '123')).rejects.toThrow()
  })
})
