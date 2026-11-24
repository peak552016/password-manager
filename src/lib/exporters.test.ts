import { describe, expect, it } from 'vitest'
import { jdbcUrl, toDbeaver, toPlainCsv, toPostmanEnvironment } from './exporters'
import { EMPTY_ENTRY, type Entry } from './vault'

const e = (p: Partial<Entry>): Entry => ({ ...EMPTY_ENTRY, ...p, values: p.values ?? {}, fields: p.fields ?? [] })

describe('exporters', () => {
  it('DBeaver: one CSV per engine with JDBC urls and credentials', () => {
    const files = toDbeaver(
      [
        e({ type: 'database', title: 'customer - UAT', values: { dbType: 'PostgreSQL', host: 'h1', port: '5432', database: 'customer', username: 'u', password: 'p,"x' } }),
        e({ type: 'database', title: 'policy', values: { dbType: 'Oracle', host: 'h2', port: '1521', database: 'ORCL' } }),
        e({ type: 'login', title: 'ignored' }),
      ],
      'x',
    )
    expect(files.map((f) => f.name)).toEqual(['x-dbeaver-postgresql.csv', 'x-dbeaver-oracle.csv'])
    const lines = files[0].text.replace('﻿', '').trim().split('\r\n')
    expect(lines[0]).toBe('name,host,port,database,url,user,password')
    expect(lines[1]).toBe('customer - UAT,h1,5432,customer,jdbc:postgresql://h1:5432/customer,u,"p,""x"')
    expect(files[1].text).toContain('jdbc:oracle:thin:@//h2:1521/ORCL')
  })
  it('jdbcUrl keeps an existing JDBC string', () => {
    expect(jdbcUrl('MySQL', { connectionString: 'jdbc:mysql://a/b' })).toBe('jdbc:mysql://a/b')
    expect(jdbcUrl('SQL Server', { host: 'h', port: '1433', database: 'd' })).toBe('jdbc:sqlserver://h:1433;databaseName=d')
  })
  it('Postman environment from env, api and token entries', () => {
    const [f] = toPostmanEnvironment(
      [
        e({ type: 'env', title: 'ekyc SIT', values: { content: 'BASE=https://x\nCLIENT_SECRET=s' } }),
        e({ type: 'api', title: 'Claim API', values: { url: 'https://api', clientId: 'id', clientSecret: 'sec' } }),
        e({ type: 'token', title: 'bot', values: { token: 't' } }),
      ],
      'My env',
    )
    const env = JSON.parse(f.text)
    expect(env.name).toBe('My env')
    expect(env.values.map((v: { key: string }) => v.key)).toEqual(['BASE', 'CLIENT_SECRET', 'Claim_API_baseUrl', 'Claim_API_clientId', 'Claim_API_clientSecret', 'bot_token'])
    expect(env.values[1].type).toBe('secret')
  })
  it('plain CSV has a column per used field', () => {
    const [f] = toPlainCsv([e({ type: 'login', title: 'a', values: { username: 'u', password: 'p' }, fields: [{ label: 'PIN', value: '1', secret: true }] })], 'b')
    expect(f.text.replace('﻿', '').split('\r\n')[0]).toBe('type,title,collection,environment,username,password,knowledgeUrl,notes,PIN')
  })
})
