import { describe, expect, it } from 'vitest'
import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js'
import { passwordZip } from './zip'

describe('passwordZip', () => {
  it.each([false, true])('round-trips with the password (windowsCompatible=%s) and refuses without it', async (win) => {
    const blob = await passwordZip([{ name: 'a.csv', text: 'name,password\nx,ไทย' }], 'pw-123', win)
    const read = async (password?: string) => {
      const r = new ZipReader(new BlobReader(blob), { password, useWebWorkers: false })
      const [e] = await r.getEntries()
      if (e.directory) throw new Error('expected a file')
      expect(e.encrypted).toBe(true)
      return e.getData(new TextWriter())
    }
    expect(await read('pw-123')).toBe('name,password\nx,ไทย')
    await expect(read('nope')).rejects.toThrow()
  })
})
