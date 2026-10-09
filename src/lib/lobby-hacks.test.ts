import { describe, expect, it } from 'vitest'

import {
  checkLobbyHackCode,
  isMultiLinePaste,
  lobbyHackCodeMaxLength,
  parseLobbyHackRequest,
} from './lobby-hacks'

const accountId = 'a'.repeat(32)

describe('checkLobbyHackCode', () => {
  it('trims the edges and keeps case, punctuation, hyphens and inner spaces', () => {
    expect(checkLobbyHackCode('  Cheat-Code_42!  ')).toEqual({
      ok: true,
      code: 'Cheat-Code_42!',
      length: 14,
    })
    expect(checkLobbyHackCode('\tUP up DOWN down\n')).toMatchObject({
      ok: true,
      code: 'UP up DOWN down',
    })
  })

  it('does not apply the product-code normaliser', () => {
    const check = checkLobbyHackCode('ab-cd.ef')

    expect(check.ok && check.code).toBe('ab-cd.ef')
  })

  it('refuses a blank code', () => {
    expect(checkLobbyHackCode('')).toMatchObject({ ok: false, reason: 'blank' })
    expect(checkLobbyHackCode('   \n ')).toMatchObject({
      ok: false,
      reason: 'blank',
    })
  })

  it('refuses more than one line, however it is broken', () => {
    for (const separator of ['\n', '\r\n', '\r', '\u2028', '\u2029', '\u0085', '\v', '\f']) {
      expect(checkLobbyHackCode(`FIRST${separator}SECOND`)).toMatchObject({
        ok: false,
        reason: 'line-break',
      })
    }
  })

  it('refuses tabs, other control characters and bidi overrides', () => {
    for (const character of ['\t', '\u0000', '\u001b', '\u007f', '\u009f', '\u202e', '\u2066']) {
      expect(checkLobbyHackCode(`AB${character}CD`)).toMatchObject({
        ok: false,
        reason: 'characters',
      })
    }
  })

  it('refuses lone surrogates but accepts emoji', () => {
    expect(checkLobbyHackCode('AB\ud800CD')).toMatchObject({
      ok: false,
      reason: 'characters',
    })
    expect(checkLobbyHackCode('GG🎮')).toMatchObject({ ok: true, length: 3 })
  })

  it('counts characters, not UTF-16 units, against the 256 limit', () => {
    expect(lobbyHackCodeMaxLength).toBe(256)
    expect(checkLobbyHackCode('x'.repeat(256)).ok).toBe(true)
    expect(checkLobbyHackCode('x'.repeat(257))).toMatchObject({
      ok: false,
      reason: 'too-long',
      length: 257,
    })
    expect(checkLobbyHackCode('🎮'.repeat(256)).ok).toBe(true)
  })
})

describe('isMultiLinePaste', () => {
  it('flags pasted text with an inner line break only', () => {
    expect(isMultiLinePaste('ONE\nTWO')).toBe(true)
    expect(isMultiLinePaste('ONE\n')).toBe(false)
    expect(isMultiLinePaste('ONE TWO')).toBe(false)
  })
})

describe('parseLobbyHackRequest', () => {
  it('keeps only the account id and the trimmed code', () => {
    expect(
      parseLobbyHackRequest({
        accountId,
        code: '  CODE ',
        accessToken: 'leaked',
        extra: { nested: true },
      })
    ).toEqual({ ok: true, request: { accountId, code: 'CODE' } })
  })

  it('rejects anything malformed, naming the account only when it is valid', () => {
    expect(parseLobbyHackRequest(null)).toEqual({ ok: false, accountId: null })
    expect(parseLobbyHackRequest(['x'])).toEqual({ ok: false, accountId: null })
    expect(parseLobbyHackRequest({ accountId: 'nope', code: 'CODE' })).toEqual({
      ok: false,
      accountId: null,
    })
    expect(parseLobbyHackRequest({ accountId, code: 42 })).toEqual({
      ok: false,
      accountId,
    })
    expect(parseLobbyHackRequest({ accountId, code: ['A', 'B'] })).toEqual({
      ok: false,
      accountId,
    })
    expect(parseLobbyHackRequest({ accountId, code: 'A\nB' })).toEqual({
      ok: false,
      accountId,
    })
  })
})
