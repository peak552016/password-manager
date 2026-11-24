import { describe, expect, it } from 'vitest'
import { isPacked, packFile, unpackFile } from './container'

describe('binary container', () => {
  it('round-trips and is not readable JSON', async () => {
    const env = { format: 'pm-backup', items: [{ id: 'a', data: 'xyz' }], name: 'ไทย' }
    const blob = await packFile(env)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect(isPacked(bytes)).toBe(true)
    expect(new TextDecoder().decode(bytes)).not.toContain('pm-backup')
    expect(await unpackFile(blob)).toEqual(env)
  })
  it('still reads legacy JSON files', async () => {
    expect(await unpackFile(new Blob(['{"a":1}']))).toEqual({ a: 1 })
    await expect(unpackFile(new Blob(['garbage']))).rejects.toThrow()
  })
})
