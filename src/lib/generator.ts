export interface GenOptions {
  length: number
  lower: boolean
  upper: boolean
  digits: boolean
  symbols: boolean
  /** drop look-alikes such as 0/O and 1/l/I */
  avoidAmbiguous: boolean
}

export const DEFAULT_GEN: GenOptions = {
  length: 20,
  lower: true,
  upper: true,
  digits: true,
  symbols: true,
  avoidAmbiguous: true,
}

const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/~',
}
const AMBIGUOUS = /[0O1lI|]/g

/** Unbiased random int in [0, n) using rejection sampling. */
function randInt(n: number): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n
  const buf = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0] < limit) return buf[0] % n
  }
}

export function generatePassword(o: GenOptions): string {
  const sets = (Object.keys(SETS) as (keyof typeof SETS)[])
    .filter((k) => o[k])
    .map((k) => (o.avoidAmbiguous ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]))
  if (sets.length === 0) throw new Error('เลือกชนิดตัวอักษรอย่างน้อย 1 แบบ')
  const length = Math.max(o.length, sets.length)
  const all = sets.join('')
  // guarantee one char from each chosen set, then fill and shuffle
  const chars = sets.map((s) => s[randInt(s.length)])
  while (chars.length < length) chars.push(all[randInt(all.length)])
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

/** Rough strength estimate in bits for a password the user typed. */
export function estimateBits(pw: string): number {
  let pool = 0
  if (/[a-z]/.test(pw)) pool += 26
  if (/[A-Z]/.test(pw)) pool += 26
  if (/[0-9]/.test(pw)) pool += 10
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 33
  return pool ? Math.round(pw.length * Math.log2(pool)) : 0
}

export function strengthLabel(bits: number): { label: string; level: 0 | 1 | 2 | 3 } {
  if (bits < 40) return { label: 'อ่อนมาก', level: 0 }
  if (bits < 60) return { label: 'พอใช้', level: 1 }
  if (bits < 80) return { label: 'ดี', level: 2 }
  return { label: 'แข็งแรงมาก', level: 3 }
}
