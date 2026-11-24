/**
 * Password-protected ZIP for the "ready to use" export. AES-256 (WinZip AES)
 * by default, which 7-Zip / WinRAR / macOS Archive Utility open; ZipCrypto
 * only on request, because it is weak but Windows Explorer can open it.
 */
import { BlobWriter, TextReader, ZipWriter, configure } from '@zip.js/zip.js'

// workers would need a blob: script, which the CSP forbids
configure({ useWebWorkers: false })

export async function passwordZip(files: { name: string; text: string }[], password: string, windowsCompatible = false): Promise<Blob> {
  const zip = new ZipWriter(new BlobWriter('application/zip'), {
    password,
    ...(windowsCompatible ? { zipCrypto: true } : { encryptionStrength: 3 as const }),
  })
  for (const f of files) await zip.add(f.name, new TextReader(f.text))
  return zip.close()
}
