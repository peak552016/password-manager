/**
 * Binary file container for backups (.vault) and share files (.vshare):
 *
 *   "PMVAULT" (7 bytes) | version (1 byte) | gzip(JSON envelope)
 *
 * The envelope is the same already-encrypted JSON as before, so the
 * container only changes how it is stored; readers still accept old .json files.
 */
const MAGIC = new TextEncoder().encode('PMVAULT')
const VERSION = 1

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream))
  return new Uint8Array(await out.arrayBuffer())
}

export async function packFile(envelope: unknown): Promise<Blob> {
  const body = await pipe(new TextEncoder().encode(JSON.stringify(envelope)), new CompressionStream('gzip'))
  return new Blob([MAGIC, new Uint8Array([VERSION]), body], { type: 'application/octet-stream' })
}

export const isPacked = (b: Uint8Array) => b.length > MAGIC.length && MAGIC.every((x, i) => b[i] === x)

/** Reads a .vault / .vshare container, or a legacy JSON file. */
export async function unpackFile(file: Blob): Promise<unknown> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (isPacked(bytes)) {
    const version = bytes[MAGIC.length]
    if (version !== VERSION) throw new Error(`ไฟล์นี้มาจากแอพเวอร์ชันใหม่กว่า (รูปแบบ ${version}) ให้อัปเดตแอพก่อน`)
    const json = await pipe(bytes.slice(MAGIC.length + 1), new DecompressionStream('gzip'))
    return JSON.parse(new TextDecoder().decode(json))
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new Error('อ่านไฟล์ไม่ได้ ไม่ใช่ไฟล์ของ Vault')
  }
}
