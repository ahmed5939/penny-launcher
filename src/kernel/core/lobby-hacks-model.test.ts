import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'

import {
  classifyTerminalCommandError,
  readTerminalCommandResponse,
  terminalCommandRewards,
} from './lobby-hacks-model'

const nameOf = (itemType: string) => ({
  name: `name:${itemType}`,
  imageUrl: null,
})

const terminalResult = (fields: Record<string, unknown>) => ({
  type: 'terminalCommandResult',
  primary: true,
  client_request_id: '',
  successActionTag: '',
  ...fields,
})

/** The documented questClaim example, as Epic would send it. */
const questClaim = {
  type: 'questClaim',
  primary: true,
  client_request_id: '',
  questId: 'Quest:quest_s42_cosmicthunder_00_promo_q22',
  loot: {
    items: [
      {
        itemType: 'MagpieEntitlementReward:magpiereward_jonesy_gold_sprite',
        itemGuid: 'd9d56ffb-c1d0-46c2-9cf8-d2cbb211b061',
        itemProfile: 'athena',
        attributes: {},
        quantity: 1,
      },
    ],
  },
  questsAndRewards: [
    {
      questId: 'Quest:quest_s28_winterfest_dailygift_q01',
      loot: {
        items: [
          {
            itemType: 'AthenaBackpack:backpack_wintergift',
            itemGuid: 'dbf80ea6-fa45-490b-a747-24ee705263a5',
            itemProfile: 'athena',
            quantity: 1,
          },
        ],
      },
    },
  ],
}

describe('readTerminalCommandResponse', () => {
  it('reports a grant only when terminalCommandResult says rewardGranted', () => {
    const result = readTerminalCommandResponse(
      {
        profileId: 'athena',
        notifications: [
          terminalResult({ canRepeat: false, rewardGranted: true }),
          questClaim,
        ],
      },
      nameOf,
      200
    )

    expect(result.outcome).toBe('granted')
    expect(result.canRepeat).toBe(false)
    expect(result.httpStatus).toBe(200)
    expect(result.rewards).toEqual([
      {
        itemType: 'MagpieEntitlementReward:magpiereward_jonesy_gold_sprite',
        name: 'name:MagpieEntitlementReward:magpiereward_jonesy_gold_sprite',
        quantity: 1,
        itemProfile: 'athena',
        imageUrl: null,
      },
      {
        itemType: 'AthenaBackpack:backpack_wintergift',
        name: 'name:AthenaBackpack:backpack_wintergift',
        quantity: 1,
        itemProfile: 'athena',
        imageUrl: null,
      },
    ])
  })

  it('reports no reward when Epic says rewardGranted is false', () => {
    const result = readTerminalCommandResponse(
      { notifications: [terminalResult({ canRepeat: true, rewardGranted: false })] },
      nameOf
    )

    expect(result.outcome).toBe('no-reward')
    expect(result.canRepeat).toBe(true)
    expect(result.rewards).toEqual([])
  })

  it('is unconfirmed when a 2xx answer has no terminal notification', () => {
    expect(
      readTerminalCommandResponse({ profileId: 'athena', notifications: [] }, nameOf)
        .outcome
    ).toBe('unconfirmed')
    expect(readTerminalCommandResponse({}, nameOf).outcome).toBe('unconfirmed')
    expect(readTerminalCommandResponse('<html>', nameOf).outcome).toBe('unconfirmed')
    expect(readTerminalCommandResponse(null, nameOf).outcome).toBe('unconfirmed')
  })

  it('still lists rewards on an unconfirmed answer, without calling it a grant', () => {
    const result = readTerminalCommandResponse(
      { notifications: [questClaim] },
      nameOf
    )

    expect(result.outcome).toBe('unconfirmed')
    expect(result.rewards).toHaveLength(2)
  })

  it('is unconfirmed when rewardGranted is missing or not a boolean', () => {
    for (const rewardGranted of [undefined, 'true', 1, null]) {
      expect(
        readTerminalCommandResponse(
          { notifications: [terminalResult({ rewardGranted })] },
          nameOf
        ).outcome
      ).toBe('unconfirmed')
    }
  })

  it('reads notifications carried by multiUpdate', () => {
    const result = readTerminalCommandResponse(
      {
        notifications: [terminalResult({ rewardGranted: true })],
        multiUpdate: [
          {
            profileId: 'common_core',
            notifications: [
              {
                type: 'questClaim',
                loot: {
                  items: [
                    {
                      itemType: 'Currency:MtxGiveaway',
                      itemProfile: 'common_core',
                      quantity: 500,
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
      nameOf
    )

    expect(result.outcome).toBe('granted')
    expect(result.rewards).toEqual([
      expect.objectContaining({
        itemType: 'Currency:MtxGiveaway',
        quantity: 500,
        itemProfile: 'common_core',
      }),
    ])
  })
})

describe('terminalCommandRewards', () => {
  it('counts an item listed in loot and questsAndRewards once', () => {
    const item = {
      itemType: 'AthenaDance:eid_test',
      itemGuid: 'same-guid',
      itemProfile: 'athena',
      quantity: 1,
    }

    expect(
      terminalCommandRewards(
        [
          {
            type: 'questClaim',
            loot: { items: [item] },
            questsAndRewards: [{ loot: { items: [item] } }],
          },
        ],
        nameOf
      )
    ).toHaveLength(1)
  })

  it('skips malformed items and leaves unknown quantities unknown', () => {
    expect(
      terminalCommandRewards(
        [
          {
            type: 'questClaim',
            loot: {
              items: [
                null,
                { quantity: 3 },
                { itemType: '' },
                { itemType: 'AthenaCharacter:cid_x', quantity: -1 },
              ],
            },
          },
          { type: 'somethingElse', loot: { items: [{ itemType: 'Ignored:x' }] } },
        ],
        nameOf
      )
    ).toEqual([
      expect.objectContaining({
        itemType: 'AthenaCharacter:cid_x',
        quantity: null,
        itemProfile: null,
      }),
    ])
  })
})

function epicError(
  status: number | null,
  data: unknown = {},
  options: { code?: string; headers?: Record<string, string> } = {}
) {
  const config = {
    headers: new AxiosHeaders({ Authorization: 'bearer secret-token' }),
    data: JSON.stringify({ command: 'MY-SECRET-CODE' }),
  }

  return new AxiosError(
    'Request failed',
    options.code,
    config,
    {},
    status === null
      ? undefined
      : {
          status,
          statusText: '',
          data,
          headers: new AxiosHeaders(options.headers ?? {}),
          config,
        }
  )
}

describe('classifyTerminalCommandError', () => {
  it.each([
    ['auth-failed', 401, 'errors.com.epicgames.common.authentication.token_verification_failed'],
    ['auth-failed', 400, 'errors.com.epicgames.common.oauth.invalid_token'],
    ['already-used', 400, 'errors.com.epicgames.fortnite.terminal_command_already_used'],
    ['already-used', 409, 'errors.com.epicgames.fortnite.quest_already_claimed'],
    ['invalid-code', 400, 'errors.com.epicgames.fortnite.invalid_terminal_command'],
    ['invalid-code', 404, 'errors.com.epicgames.fortnite.command_not_found'],
    ['cooldown', 400, 'errors.com.epicgames.fortnite.terminal_command_cooldown'],
    ['unavailable', 404, 'errors.com.epicgames.fortnite.operation_not_found'],
    ['unavailable', 403, 'errors.com.epicgames.modules.profiles.operation_forbidden'],
    ['unavailable', 403, 'errors.com.epicgames.common.missing_permission'],
    ['rejected', 400, 'errors.com.epicgames.validation.validation_failed'],
  ])('maps %s from HTTP %i %s', (outcome, status, errorCode) => {
    const result = classifyTerminalCommandError(
      epicError(status, { errorCode, errorMessage: 'Nope' })
    )

    expect(result.outcome).toBe(outcome)
    expect(result.httpStatus).toBe(status)
    expect(result.errorCode).toBe(errorCode)
    expect(result.errorMessage).toBe('Nope')
  })

  it('treats 429 as a cooldown and reads Retry-After', () => {
    const result = classifyTerminalCommandError(
      epicError(
        429,
        { errorCode: 'errors.com.epicgames.common.throttled' },
        { headers: { 'Retry-After': '30' } }
      )
    )

    expect(result).toMatchObject({ outcome: 'cooldown', retryAfterSeconds: 30 })
  })

  it("falls back to Epic's throttle message variable for the wait", () => {
    const result = classifyTerminalCommandError(
      epicError(400, {
        errorCode: 'errors.com.epicgames.common.throttled',
        messageVars: ['12'],
      })
    )

    expect(result).toMatchObject({ outcome: 'cooldown', retryAfterSeconds: 12 })
  })

  it('calls an unexplained 403 or 404 unavailable and other 4xx refused', () => {
    expect(classifyTerminalCommandError(epicError(403)).outcome).toBe('unavailable')
    expect(classifyTerminalCommandError(epicError(404)).outcome).toBe('unavailable')
    expect(classifyTerminalCommandError(epicError(400)).outcome).toBe('rejected')
  })

  it('cannot tell whether a 5xx, timeout or reset went through', () => {
    expect(classifyTerminalCommandError(epicError(500)).outcome).toBe('uncertain')
    expect(
      classifyTerminalCommandError(
        epicError(503, { errorCode: 'errors.com.epicgames.common.server_error' })
      ).outcome
    ).toBe('uncertain')
    expect(
      classifyTerminalCommandError(epicError(null, {}, { code: 'ECONNABORTED' }))
        .outcome
    ).toBe('uncertain')
    expect(
      classifyTerminalCommandError(epicError(null, {}, { code: 'ECONNRESET' }))
        .outcome
    ).toBe('uncertain')
    expect(classifyTerminalCommandError(new Error('boom')).outcome).toBe(
      'uncertain'
    )
  })

  it('knows a refused connection or failed lookup never sent anything', () => {
    for (const code of ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']) {
      expect(
        classifyTerminalCommandError(epicError(null, {}, { code })).outcome
      ).toBe('not-sent')
    }
  })

  it('keeps the request, token and code out of the result', () => {
    const result = classifyTerminalCommandError(
      epicError(400, {
        errorCode: 'errors.com.epicgames.validation.validation_failed',
        errorMessage: 'Bad request access_token=abc123\nsecond line',
      })
    )
    const serialized = JSON.stringify(result)

    expect(serialized).not.toContain('secret-token')
    expect(serialized).not.toContain('MY-SECRET-CODE')
    expect(serialized).not.toContain('abc123')
    expect(result.errorMessage).toBe('Bad request access_token=[redacted] second line')
    expect(Object.keys(result).sort()).toEqual([
      'canRepeat',
      'errorCode',
      'errorMessage',
      'httpStatus',
      'outcome',
      'retryAfterSeconds',
      'rewards',
    ])
  })
})
