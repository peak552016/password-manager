import { describe, expect, it } from 'vitest'
import { extractCurlCredentials } from './curlinfo'

describe('extractCurlCredentials', () => {
  it('finds client credentials in a form body and resolves vars', () => {
    const curl = `curl -X POST 'https://x/oauth/token' \\\n  -H 'Content-Type: application/x-www-form-urlencoded' \\\n  --data-urlencode 'grant_type=client_credentials' \\\n  --data-urlencode 'client_id={{client_id}}' \\\n  --data-urlencode 'client_secret={{client_secret}}'`
    const r = extractCurlCredentials(curl, { client_id: 'abc' })
    expect(r.find((c) => c.label === 'URL')?.value).toBe('https://x/oauth/token')
    expect(r.find((c) => c.label === 'Client ID')).toMatchObject({ value: 'abc', unresolved: false })
    expect(r.find((c) => c.label === 'Client Secret')).toMatchObject({ value: '{{client_secret}}', unresolved: true, secret: true })
  })
  it('finds bearer tokens, api keys, basic auth and JSON fields', () => {
    const curl = `curl 'https://x' -H 'Authorization: Bearer tok123' -H 'x-api-key: k1' -H 'Authorization: Basic ${btoa('me:pw')}' --data-raw '{"clientId":"cid","clientSecret":"sec"}'`
    const m = Object.fromEntries(extractCurlCredentials(curl).map((c) => [c.label, c.value]))
    expect(m).toMatchObject({ Token: 'tok123', 'API Key': 'k1', Username: 'me', Password: 'pw', 'Client ID': 'cid', 'Client Secret': 'sec' })
  })
})
