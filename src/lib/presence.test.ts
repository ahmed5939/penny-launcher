import { describe, expect, it } from 'vitest'

import {
  checkPresenceText,
  parsePresenceRequest,
  presenceTextMaxBytes,
} from './presence'

const accountId = 'a'.repeat(32)
const valid = {
  accountId,
  text: 'Farming Twine',
  availability: 'online',
  durationMinutes: 60,
}

describe('checkPresenceText', () => {
  it('trims and accepts ordinary text, emoji and accents', () => {
    expect(checkPresenceText('  Back in five  ')).toEqual({
      ok: true,
      text: 'Back in five',
      bytes: 12,
    })
    expect(checkPresenceText('Café 👨‍👩‍👧 ✌️').ok).toBe(true)
  })

  it('rejects blank text', () => {
    expect(checkPresenceText('   ')).toMatchObject({ ok: false, reason: 'blank' })
  })

  it('counts UTF-8 bytes, not characters', () => {
    const ascii = 'x'.repeat(presenceTextMaxBytes)
    const emoji = '🔥'.repeat(presenceTextMaxBytes / 4 + 1)

    expect(checkPresenceText(ascii).ok).toBe(true)
    expect(checkPresenceText(`${ascii}x`)).toMatchObject({
      ok: false,
      reason: 'too-long',
    })
    expect(emoji.length).toBeLessThan(presenceTextMaxBytes)
    expect(checkPresenceText(emoji)).toMatchObject({ ok: false, reason: 'too-long' })
  })

  it('rejects control characters, bidi overrides and lone surrogates', () => {
    for (const text of ['one\ntwo', 'tab\there', 'bell\u0007', 'c1\u0085', 'rtl‮evil', 'iso⁦x', 'half\ud83d']) {
      expect(checkPresenceText(text)).toMatchObject({
        ok: false,
        reason: 'characters',
      })
    }
  })
})

describe('parsePresenceRequest', () => {
  it('rebuilds a request from known fields only', () => {
    const parsed = parsePresenceRequest({
      ...valid,
      accountId: accountId.toUpperCase(),
      text: '  Farming Twine ',
      accessToken: 'leaked',
      account: { secret: 'leaked' },
    })

    expect(parsed).toEqual({
      ok: true,
      request: {
        accountId,
        text: 'Farming Twine',
        availability: 'online',
        durationMinutes: 60,
        replaceActive: false,
      },
    })
  })

  it('accepts until-stopped and an explicit replace', () => {
    expect(
      parsePresenceRequest({ ...valid, durationMinutes: null, replaceActive: true })
    ).toMatchObject({
      ok: true,
      request: { durationMinutes: null, replaceActive: true },
    })
  })

  it.each([
    ['non-object', 'nope'],
    ['array', [valid]],
    ['unknown account id shape', { ...valid, accountId: 'not-an-id' }],
    ['missing text', { ...valid, text: undefined }],
    ['blank text', { ...valid, text: '  ' }],
    ['oversized text', { ...valid, text: 'x'.repeat(5_000) }],
    ['bad availability', { ...valid, availability: 'xa' }],
    ['missing duration', { ...valid, durationMinutes: undefined }],
    ['fractional duration', { ...valid, durationMinutes: 1.5 }],
    ['zero duration', { ...valid, durationMinutes: 0 }],
    ['duration over a day', { ...valid, durationMinutes: 24 * 60 + 1 }],
    ['string duration', { ...valid, durationMinutes: '60' }],
    ['non-boolean replace', { ...valid, replaceActive: 'yes' }],
  ])('rejects %s', (_, input) => {
    expect(parsePresenceRequest(input).ok).toBe(false)
  })
})
