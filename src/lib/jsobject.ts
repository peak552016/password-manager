/**
 * Lenient reader for JavaScript-ish object literals, such as a config file
 * that holds API client keys:
 *
 *   const clients = {
 *     Gamification: { name: "Gamification", clientId: "…", clientSecret: "…", },
 *     'Hotline-ICS': { … },   // comments are fine
 *   }
 *
 * Accepts unquoted keys, single / double / backtick quotes, trailing commas,
 * comments, `const x =` / `module.exports =` / `export default` wrappers and
 * several top-level declarations. It never evaluates code: anything that is
 * not a plain literal (a variable, a function call, `process.env.X`) is read
 * as null.
 */

export type JsValue = string | number | boolean | null | JsValue[] | { [key: string]: JsValue }

type Tok =
  | { t: 'str'; v: string }
  | { t: 'num'; v: number }
  | { t: 'id'; v: string }
  | { t: 'p'; v: string }

function tokenize(src: string): Tok[] {
  const out: Tok[] = []
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      i = end < 0 ? n : end + 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      let v = ''
      i++
      while (i < n && src[i] !== c) {
        if (src[i] === '\\' && i + 1 < n) {
          const e = src[i + 1]
          i += 2
          if (e === 'n') v += '\n'
          else if (e === 't') v += '\t'
          else if (e === 'r') v += '\r'
          else if (e === 'u' && /^[0-9a-f]{4}$/i.test(src.slice(i, i + 4))) {
            v += String.fromCharCode(parseInt(src.slice(i, i + 4), 16))
            i += 4
          } else if (e === '\n') {
            /* line continuation */
          } else v += e
        } else v += src[i++]
      }
      i++ // closing quote
      out.push({ t: 'str', v })
      continue
    }
    const num = /^-?(?:0x[0-9a-f]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)/i.exec(src.slice(i, i + 40))
    if (num && (c === '-' ? /\d/.test(src[i + 1] ?? '') : /\d/.test(c))) {
      out.push({ t: 'num', v: Number(num[0]) })
      i += num[0].length
      continue
    }
    const id = /^[A-Za-z_$À-￿][\w$À-￿-]*/.exec(src.slice(i, i + 200))
    if (id) {
      // allow dashes inside unquoted keys (Hotline-ICS), but not a trailing one
      const v = id[0].replace(/-+$/, '')
      out.push({ t: 'id', v })
      i += v.length
      continue
    }
    out.push({ t: 'p', v: c })
    i++
  }
  return out
}

class Parser {
  i = 0
  private toks: Tok[]
  constructor(toks: Tok[]) {
    this.toks = toks
  }

  peek(): Tok | undefined {
    return this.toks[this.i]
  }
  isP(v: string) {
    const t = this.peek()
    return t?.t === 'p' && t.v === v
  }

  value(): JsValue {
    const t = this.toks[this.i++]
    if (!t) return null
    if (t.t === 'p' && t.v === '{') return this.object()
    if (t.t === 'p' && t.v === '[') return this.array()
    if (t.t === 'str') {
      let v = t.v
      // "abc" + "def"
      while (this.isP('+') && this.toks[this.i + 1]?.t === 'str') {
        v += (this.toks[this.i + 1] as { v: string }).v
        this.i += 2
      }
      return v
    }
    if (t.t === 'num') return t.v
    if (t.t === 'id') {
      if (t.v === 'true') return true
      if (t.v === 'false') return false
      if (t.v === 'null' || t.v === 'undefined') return null
      this.skipExpression()
      return null
    }
    // any other expression: (…) => …, -x, new Foo()
    this.i--
    this.skipExpression()
    return null
  }

  /** skip the rest of a non-literal expression up to the next , } ] ; */
  skipExpression() {
    let depth = 0
    while (this.i < this.toks.length) {
      const t = this.toks[this.i]
      if (t.t === 'p') {
        if ('([{'.includes(t.v)) depth++
        else if (')]}'.includes(t.v)) {
          if (depth === 0) return
          depth--
        } else if ((t.v === ',' || t.v === ';') && depth === 0) return
      }
      this.i++
    }
  }

  object(): { [key: string]: JsValue } {
    const obj: { [key: string]: JsValue } = {}
    while (this.i < this.toks.length) {
      if (this.isP('}')) {
        this.i++
        return obj
      }
      if (this.isP(',')) {
        this.i++
        continue
      }
      const k = this.toks[this.i++]
      let key: string
      if (k.t === 'str' || k.t === 'id') key = k.v
      else if (k.t === 'num') key = String(k.v)
      else if (k.t === 'p' && k.v === '[') {
        // computed key ['x']
        const inner = this.value()
        if (this.isP(']')) this.i++
        key = String(inner)
      } else if (k.t === 'p' && k.v === '.' && this.isP('.')) {
        // ...spread
        this.i++
        this.skipExpression()
        continue
      } else continue
      if (this.isP(':')) {
        this.i++
        obj[key] = this.value()
      } else if (this.isP('(')) {
        // method shorthand: skip it
        this.skipExpression()
      } else obj[key] = null // shorthand { foo }
    }
    return obj
  }

  array(): JsValue[] {
    const arr: JsValue[] = []
    while (this.i < this.toks.length) {
      if (this.isP(']')) {
        this.i++
        return arr
      }
      if (this.isP(',')) {
        this.i++
        continue
      }
      arr.push(this.value())
    }
    return arr
  }
}

export interface JsRoot {
  /** the variable / export name the literal was assigned to, if any */
  name: string
  value: JsValue
}

/**
 * Every top-level object / array literal in the text, with the name it was
 * assigned to (`const UAT = {…}` → "UAT"; `module.exports = {…}` → "").
 */
export function parseJsObjects(src: string): JsRoot[] {
  const toks = tokenize(src.replace(/^﻿/, ''))
  const p = new Parser(toks)
  const roots: JsRoot[] = []
  while (p.i < toks.length) {
    const t = toks[p.i]
    if (t.t === 'p' && (t.v === '{' || t.v === '[')) {
      let name = ''
      const prev = toks[p.i - 1]
      const before = toks[p.i - 2]
      if (prev?.t === 'p' && prev.v === '=' && before?.t === 'id' && before.v !== 'exports') name = before.v
      if (prev?.t === 'p' && prev.v === ':' && before && (before.t === 'id' || before.t === 'str')) name = before.v
      roots.push({ name, value: p.value() })
    } else p.i++
  }
  return roots
}
