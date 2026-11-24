import { describe, expect, it } from 'vitest'
import {
  applyEnvironment,
  decryptDbeaverCredentials,
  detectEnvironment,
  encryptDbeaverCredentials,
  importDbeaver,
  importPostmanCollection,
  importPostmanEnvironment,
  isDbeaverDataSources,
  isPostmanCollection,
  isPostmanEnvironment,
} from './importers'

describe('detectEnvironment', () => {
  it.each([
    ['customer - UAT', 'UAT'],
    ['kyc - pre', 'PRE-PROD'],
    ['leadmktdb - PRE', 'PRE-PROD'],
    ['superapp-database-pre-prod.cluster', 'PRE-PROD'],
    ['common_service - Non-Prod', 'NON-PROD'],
    ['customer - Dev', 'DEV'],
    ['kyc - sit', 'SIT'],
    ['ekyc SIT', 'SIT'],
    ['CDC-SIT-GW-SuperApp', 'SIT'],
    ['policy PROD', 'PROD'],
    ['leadmktdb', ''],
    ['superapp_db 2', ''],
    ['president', ''],
  ])('%s → %s', (name, env) => expect(detectEnvironment(name)).toBe(env))
})

describe('DBeaver', () => {
  const dataSources = {
    folders: {},
    connections: {
      'postgres-jdbc-1': {
        provider: 'postgresql',
        driver: 'postgres-jdbc',
        name: 'customer - UAT',
        'save-password': true,
        configuration: { host: 'uat-odsdb.example.com', port: '5432', database: 'customer', type: 'dev' },
      },
      'postgres-jdbc-2': {
        provider: 'postgresql',
        driver: 'postgres-jdbc',
        name: 'kyc - pre',
        configuration: { host: 'pre-kycdb.example.com', port: '5432', database: 'kyc', user: 'plainuser' },
      },
    },
  }

  it('decrypts credentials-config.json and maps connections', async () => {
    const creds = { 'postgres-jdbc-1': { '#connection': { user: 'app_user', password: 's3cr3t' } } }
    const bytes = await encryptDbeaverCredentials(creds)
    const decoded = await decryptDbeaverCredentials(bytes)
    expect(decoded).toEqual(creds)
    expect(isDbeaverDataSources(dataSources)).toBe(true)
    const [a, b] = importDbeaver(dataSources, decoded)
    expect(a).toMatchObject({
      type: 'database',
      title: 'customer - UAT',
      environment: 'UAT',
      values: { dbType: 'PostgreSQL', host: 'uat-odsdb.example.com', port: '5432', database: 'customer', username: 'app_user', password: 's3cr3t' },
    })
    expect(b).toMatchObject({ environment: 'PRE-PROD', values: { username: 'plainuser' } })
    expect(b.values.password).toBeUndefined()
  })

  it('rejects garbage credentials', async () => {
    await expect(decryptDbeaverCredentials(new Uint8Array(48).buffer)).rejects.toThrow()
  })
})

describe('Postman', () => {
  const collection = {
    info: { name: 'eKYC v2', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}' }] },
    variable: [{ key: 'baseUrl', value: 'https://api.example.com' }],
    item: [
      {
        name: 'Customer',
        item: [
          {
            name: 'Get customer',
            request: { method: 'GET', header: [{ key: 'x-api-key', value: '{{apiKey}}' }], url: { raw: '{{baseUrl}}/customers/1' } },
          },
          {
            name: 'Create customer',
            request: {
              method: 'POST',
              header: [{ key: 'Content-Type', value: 'application/json' }, { key: 'X-Off', value: '1', disabled: true }],
              url: '{{baseUrl}}/customers',
              body: { mode: 'raw', raw: `{"name":"O'Neil"}` },
              auth: { type: 'basic', basic: [{ key: 'username', value: 'u' }, { key: 'password', value: 'p' }] },
            },
          },
        ],
      },
    ],
  }
  const environment = {
    name: 'ekyc UAT',
    _postman_variable_scope: 'environment',
    values: [
      { key: 'baseUrl', value: 'https://uat.example.com', enabled: true },
      { key: 'token', value: 'tok_uat', type: 'secret', enabled: true },
      { key: 'apiKey', value: 'ak_uat', enabled: true },
      { key: 'off', value: 'x', enabled: false },
    ],
  }

  it('detects file kinds', () => {
    expect(isPostmanCollection(collection)).toBe(true)
    expect(isPostmanEnvironment(environment)).toBe(true)
    expect(isPostmanEnvironment(collection)).toBe(false)
    expect(isPostmanCollection(environment)).toBe(false)
  })

  it('turns requests into curl commands with inherited auth', () => {
    const items = importPostmanCollection(collection)
    expect(items.map((i) => i.type)).toEqual(['curl', 'curl', 'env'])
    const [get, post, vars] = items
    expect(get.title).toBe('Get customer')
    expect(get.values.curl).toBe(
      "curl -X GET '{{baseUrl}}/customers/1' \\\n  -H 'Authorization: Bearer {{token}}' \\\n  -H 'x-api-key: {{apiKey}}'",
    )
    expect(post.values.curl).toContain("-u 'u:p'")
    expect(post.values.curl).toContain(`--data-raw '{"name":"O'\\''Neil"}'`)
    expect(post.values.curl).not.toContain('X-Off')
    expect(post.notes).toContain('eKYC v2 / Customer')
    expect(vars.values.content).toBe('baseUrl=https://api.example.com')
    const form = importPostmanCollection({
      info: { name: 'x' },
      item: [{ name: 'f', request: { method: 'POST', url: 'u', body: { mode: 'formdata', formdata: [{ key: 'a', value: '1' }] } } }],
    })[0]
    expect(form.values.curl).toContain("-F 'a=1'")
    const enc = importPostmanCollection({
      info: { name: 'x' },
      item: [{ name: 'e', request: { method: 'POST', url: 'u', body: { mode: 'urlencoded', urlencoded: [{ key: 'b', value: '2' }] } } }],
    })[0]
    expect(enc.values.curl).toContain("--data-urlencode 'b=2'")
  })

  it('imports environments and bakes them into curls', () => {
    const env = importPostmanEnvironment(environment)
    expect(env).toMatchObject({ type: 'env', title: 'ekyc UAT', environment: 'UAT' })
    expect(env.values.content).toBe('baseUrl=https://uat.example.com\ntoken=tok_uat\napiKey=ak_uat')
    const [get] = applyEnvironment(importPostmanCollection(collection), env)
    expect(get.environment).toBe('UAT')
    expect(get.title).toBe('Get customer [UAT]')
    expect(get.values.curl).toContain("'https://uat.example.com/customers/1'")
    expect(get.values.curl).toContain('Bearer tok_uat')
    expect(get.values.curl).toContain('x-api-key: ak_uat')
  })
})

import { importPostmanV1Collection, isPostmanDump, isPostmanV1Collection, linkEnvironments } from './importers'
import { EMPTY_ENTRY as EE } from './vault'

describe('Postman data dump', () => {
  it('reads v1 collections and links environments by name', () => {
    const dump = {
      version: 1,
      collections: [
        {
          name: 'eKYC v2',
          folders: [{ id: 'f1', name: 'Auth' }],
          requests: [
            { name: 'token', method: 'POST', url: '{{baseUrl}}/oauth', folder: 'f1', headers: 'Content-Type: application/x-www-form-urlencoded\n', dataMode: 'urlencoded', data: [{ key: 'client_id', value: '{{client_id}}' }] },
          ],
        },
      ],
      environments: [{ name: 'ekyc SIT', values: [] }],
    }
    expect(isPostmanDump(dump)).toBe(true)
    expect(isPostmanV1Collection(dump.collections[0])).toBe(true)
    const [e] = importPostmanV1Collection(dump.collections[0])
    expect(e.collection).toBe('eKYC v2')
    expect(e.values.curl).toContain("client_id={{client_id}}")
    expect(e.notes).toBe('Postman: eKYC v2 / Auth')
    const envs = [{ ...EE, type: 'env', title: 'ekyc SIT', values: {}, fields: [], access: [] }]
    linkEnvironments(envs, ['eKYC v2', 'SuperApp'])
    expect(envs[0].collection).toBe('eKYC v2')
  })
})
