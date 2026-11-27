import { describe, expect, it } from 'vitest'
import { parseJsObjects } from './jsobject'
import { importApiClients } from './importers'

const SAMPLE = `
// API clients
const clients = {
  Gamification: {
    name: "Gamification",
    clientId: "gam-id",
    clientSecret: "gam-secret",
  },
  Hotline-ICS: {
    name: "Hotline-ICS",
    clientId: 'hot-id',
    clientSecret: \`hot-secret\`,
  },
  "Lead-agent": { name: "Lead-agent", clientId: "la-id", clientSecret: "la-\\"q\\"" }, /* block */
  Thailife_web: {
    clientId: "tw-id",
    clientSecret: "tw-" + "secret",
    scopes: ["read", "write"],
    redirectUri: process.env.REDIRECT,
  },
};
module.exports = clients;
`

describe('parseJsObjects', () => {
  it('reads unquoted keys, mixed quotes, trailing commas and comments', () => {
    const [root] = parseJsObjects(SAMPLE)
    expect(root.name).toBe('clients')
    const v = root.value as Record<string, Record<string, unknown>>
    expect(Object.keys(v)).toEqual(['Gamification', 'Hotline-ICS', 'Lead-agent', 'Thailife_web'])
    expect(v['Hotline-ICS'].clientSecret).toBe('hot-secret')
    expect(v['Lead-agent'].clientSecret).toBe('la-"q"')
    expect(v.Thailife_web.clientSecret).toBe('tw-secret')
    expect(v.Thailife_web.redirectUri).toBeNull()
  })

  it('reads plain JSON and a bare object without a wrapper', () => {
    expect(parseJsObjects('{"a": {"clientId": "x"}}')[0].value).toEqual({ a: { clientId: 'x' } })
    expect(parseJsObjects('A: { clientId: "x", },')[0]).toEqual({ name: 'A', value: { clientId: 'x' } })
  })

  it('never runs code', () => {
    const [root] = parseJsObjects('export default { a: (() => { throw 1 })(), b: "ok" }')
    expect(root.value).toEqual({ a: null, b: 'ok' })
  })

  it('reads several declarations', () => {
    const roots = parseJsObjects('const UAT = { X: { clientId: "u" } }\nconst PROD = { X: { clientId: "p" } }')
    expect(roots.map((r) => r.name)).toEqual(['UAT', 'PROD'])
  })
})

describe('importApiClients', () => {
  it('turns each client into an api entry', () => {
    const out = importApiClients(parseJsObjects(SAMPLE), 'clients.js')
    expect(out.map((e) => e.title)).toEqual(['Gamification', 'Hotline-ICS', 'Lead-agent', 'Thailife_web'])
    expect(out[0]).toMatchObject({ type: 'api', environment: '', values: { clientId: 'gam-id', clientSecret: 'gam-secret' } })
    expect(out[3].fields).toEqual([{ label: 'scopes', value: 'read, write', secret: false }])
  })

  it('guesses the environment from nesting or file name', () => {
    const nested = importApiClients(parseJsObjects('const UAT = { X: { clientId: "u" } }\nconst PROD = { X: { clientId: "p" } }'))
    expect(nested.map((e) => [e.title, e.environment])).toEqual([
      ['X', 'UAT'],
      ['X', 'PROD'],
    ])
    expect(importApiClients(parseJsObjects('{ X: { clientId: "a" } }'), 'keys-sit.js')[0].environment).toBe('SIT')
  })

  it('finds nothing in unrelated objects', () => {
    expect(importApiClients(parseJsObjects('{ a: { b: 1 } }'))).toEqual([])
  })
})
