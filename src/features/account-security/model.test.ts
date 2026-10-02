import { describe, expect, it } from 'vitest'

import { parseMyAccount, platformLabel, securityIssues } from './model'

const at = '2026-10-02T00:00:00.000Z'

// As `Account.myAccount` answered on 2026-10-02 (ids removed).
const reply = (account: Record<string, unknown> | null) => ({ data: { Account: { myAccount: account } } })

describe('parseMyAccount', () => {
  it('reads security and linked platforms, consoles first, keeping no ids', () => {
    const parsed = parseMyAccount(
      reply({
        id: 'abc',
        displayName: 'Someone',
        email: 'someone@example.com',
        country: 'US',
        emailVerified: true,
        tfaEnabled: true,
        cabinedMode: false,
        externalAuths: [
          { type: 'twitch', externalAuthId: '1' },
          { type: 'xbl', externalAuthId: '2' },
          { type: 'psn', externalAuthId: '3' },
          { type: 'psn', externalAuthId: '3' },
          { type: '' },
          null,
        ],
      }),
      at
    )

    expect(parsed).toEqual({
      status: 'ok',
      tfaEnabled: true,
      emailVerified: true,
      country: 'US',
      cabinedMode: false,
      platforms: [
        { type: 'psn', label: 'PlayStation' },
        { type: 'xbl', label: 'Xbox' },
        { type: 'twitch', label: 'Twitch' },
      ],
      checkedAt: at,
    })
    expect(JSON.stringify(parsed)).not.toContain('someone@example.com')
  })

  it('leaves unknown flags unknown, and is null without an account', () => {
    expect(parseMyAccount(reply({ externalAuths: null }), at)).toMatchObject({
      tfaEnabled: null,
      emailVerified: null,
      cabinedMode: null,
      platforms: [],
    })
    expect(parseMyAccount(reply(null), at)).toBeNull()
    expect(parseMyAccount({ errors: [{ message: 'x' }] }, at)).toBeNull()
  })

  it('names platforms it does not know from their type', () => {
    expect(platformLabel('google')).toBe('Google')
    expect(platformLabel('newthing')).toBe('Newthing')
  })
})

describe('securityIssues', () => {
  const ok = parseMyAccount(reply({ tfaEnabled: true, emailVerified: true, cabinedMode: false }), at)!

  it('lists what needs attention, two-factor first', () => {
    expect(securityIssues(ok)).toEqual([])
    expect(securityIssues({ ...ok, tfaEnabled: false, emailVerified: false, cabinedMode: true })).toEqual([
      'tfa',
      'cabined',
      'email',
    ])
  })

  it('says nothing about an account it could not read', () => {
    expect(securityIssues(undefined)).toEqual([])
    expect(securityIssues({ ...ok, status: 'unknown', tfaEnabled: false })).toEqual([])
  })
})
