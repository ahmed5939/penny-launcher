import { describe, expect, it } from 'vitest'

import { extractAuthorizationCode, parseDeviceAuth } from './-paste'

const code = '79ebb4c00887455e810f83dda1cc8dfe'
const accountId = '0123456789abcdef0123456789abcdef'
const deviceId = 'fedcba9876543210fedcba9876543210'
const secret = 'c'.repeat(32)

describe('extractAuthorizationCode', () => {
  it('keeps a bare code and drops the whitespace around it', () => {
    expect(extractAuthorizationCode(`  ${code}\n`)).toBe(code)
  })

  it('reads the authorizationCode of the JSON blob Epic shows', () => {
    const blob = `{
  "authorizationCode": "${code}"
}`

    expect(extractAuthorizationCode(blob)).toBe(code)
  })

  it('reads the code from a redirect URL', () => {
    const url = `https://www.epicgames.com/id/api/redirect?clientId=34a02cf8f4414e29b15921876da36f9a&code=${code}`

    expect(extractAuthorizationCode(url)).toBe(code)
  })

  it('returns anything else trimmed and unchanged, for the length check to refuse', () => {
    expect(extractAuthorizationCode('  not a code  ')).toBe('not a code')
    expect(extractAuthorizationCode('{"sid":null}')).toBe('{"sid":null}')
    expect(extractAuthorizationCode('{"authorizationCode":""}')).toBe(
      '{"authorizationCode":""}'
    )
    expect(extractAuthorizationCode('https://example.com/?state=1')).toBe(
      'https://example.com/?state=1'
    )
  })

  it('does not read a 32-digit number as JSON', () => {
    const digits = '12345678901234567890123456789012'

    expect(extractAuthorizationCode(digits)).toBe(digits)
  })
})

describe('parseDeviceAuth', () => {
  it('reads camelCase keys', () => {
    const json = JSON.stringify({ accountId, deviceId, secret })

    expect(parseDeviceAuth(json)).toEqual({ accountId, deviceId, secret })
  })

  it('reads snake_case keys, as in a saved device auth file', () => {
    const json = JSON.stringify({
      account_id: accountId,
      device_id: deviceId,
      secret,
      created: { location: 'Somewhere' },
    })

    expect(parseDeviceAuth(json)).toEqual({ accountId, deviceId, secret })
  })

  it('trims the values it reads', () => {
    const json = JSON.stringify({
      account_id: ` ${accountId} `,
      device_id: deviceId,
      secret: `\n${secret}`,
    })

    expect(parseDeviceAuth(json)).toEqual({ accountId, deviceId, secret })
  })

  it('refuses JSON missing any of the three values', () => {
    expect(parseDeviceAuth(JSON.stringify({ accountId, deviceId }))).toBeNull()
    expect(parseDeviceAuth(JSON.stringify({ accountId, secret }))).toBeNull()
    expect(
      parseDeviceAuth(JSON.stringify({ accountId, deviceId, secret: '  ' }))
    ).toBeNull()
  })

  it('refuses garbage, arrays and plain values', () => {
    expect(parseDeviceAuth(accountId)).toBeNull()
    expect(parseDeviceAuth('not json at all')).toBeNull()
    expect(parseDeviceAuth('{"accountId":')).toBeNull()
    expect(parseDeviceAuth('[]')).toBeNull()
    expect(parseDeviceAuth('')).toBeNull()
  })
})
