import { describe, expect, it } from 'vitest'
import { baseName, groupRows, similarNames } from './group'
import { dbEngine } from './format'
import { EMPTY_ENTRY, normalizeEntry, type DecryptedItem } from './vault'

const item = (title: string, environment = '', type = 'database', collection = ''): DecryptedItem => ({
  ...EMPTY_ENTRY,
  type,
  collection,
  title,
  environment,
  id: title,
  updatedAt: 0,
})

describe('baseName', () => {
  it.each([
    ['customer - UAT', 'customer'],
    ['customer - Dev', 'customer'],
    ['customer - PRE', 'customer'],
    ['common_service - Non-Prod', 'common_service'],
    ['consolidate (rsales_pg - SIT)', 'consolidate (rsales_pg)'],
    ['consolidate (rsale_pg UAT)', 'consolidate (rsale_pg)'],
    ['[Huawei] customer_dev', '[Huawei] customer'],
    ['kyc - pre-prod', 'kyc'],
    ['UAT', 'UAT'],
    ['developer portal', 'developer portal'],
  ])('%s → %s', (t, want) => expect(baseName(t)).toBe(want))
})

describe('groupRows', () => {
  it('folds same-name items across environments, ordered DEV→PROD', () => {
    const rows = groupRows([item('a - UAT', 'UAT'), item('customer - UAT', 'UAT'), item('customer - Dev', 'DEV'), item('customer - PRE', 'PRE-PROD'), item('b')])
    expect(rows.map((r) => r.kind)).toEqual(['item', 'group', 'item'])
    const g = rows[1]
    expect(g.kind === 'group' && g.name).toBe('customer')
    expect(g.kind === 'group' && g.items.map((i) => i.environment)).toEqual(['DEV', 'UAT', 'PRE-PROD'])
  })
  it('does not mix types', () => {
    const rows = groupRows([item('x - DEV', 'DEV'), item('x - UAT', 'UAT', 'api')])
    expect(rows.every((r) => r.kind === 'item')).toBe(true)
  })
})

describe('dbEngine', () => {
  it('reads the type field, the connection string, or guesses from the port', () => {
    expect(dbEngine({ dbType: 'PostgreSQL' })?.short).toBe('PG')
    expect(dbEngine({ dbType: 'Oracle' })?.label).toBe('Oracle')
    expect(dbEngine({ connectionString: 'jdbc:oracle:thin:@h:1521/x' })?.label).toBe('Oracle')
    expect(dbEngine({ port: '3306' })).toMatchObject({ label: 'MySQL', guessed: true })
    expect(dbEngine({ host: 'x' })).toBeNull()
  })
})

describe('collection migration', () => {
  it('picks the DBeaver project out of older notes', () => {
    expect(normalizeEntry({ title: 'x', notes: 'DBeaver project: TLI DB\nDBeaver folder: f' }).collection).toBe('TLI DB')
    expect(normalizeEntry({ title: 'x', collection: 'Mine' }).collection).toBe('Mine')
  })
})

describe('typo-tolerant grouping', () => {
  it('groups a misspelt name in the same หมวด, named after the หมวด', () => {
    const rows = groupRows([
      item('Customer Dashbaord - SIT', 'SIT', 'login', 'Customer Dashboard'),
      item('Customer Dashboard - UAT', 'UAT', 'login', 'Customer Dashboard'),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].kind === 'group' && rows[0].name).toBe('Customer Dashboard')
  })
  it('keeps short or clearly different names apart', () => {
    expect(similarNames('kyc', 'kyb')).toBe(false)
    expect(similarNames('customer', 'consolidate')).toBe(false)
    expect(similarNames('appserver01', 'appserver02')).toBe(false)
    expect(similarNames('consolidate (rsale_pg)', 'consolidate (rsales_pg)')).toBe(true)
    const rows = groupRows([item('customer_a - DEV', 'DEV', 'database', 'X'), item('customer_b - UAT', 'UAT', 'database', 'Y')])
    expect(rows.every((r) => r.kind === 'item')).toBe(true)
  })
})
