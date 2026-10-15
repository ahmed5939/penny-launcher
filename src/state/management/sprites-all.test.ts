import type { SpriteCollection } from '../../kernel/core/sprites'

import { beforeEach, describe, expect, it } from 'vitest'

import { useSpritesAllStore } from './sprites-all'

const collection: SpriteCollection = {
  families: [],
  totalVariants: 0,
  ownedVariants: 0,
  lostVariants: 0,
  masteredVariants: 0,
  spriteDust: null,
  equippedRelicId: null,
}

describe('all-accounts sprite columns', () => {
  beforeEach(() =>
    useSpritesAllStore.setState({
      sweepId: null,
      running: false,
      total: 0,
      landed: [],
      columns: {},
    })
  )

  it('drops a removed account’s column on the next sweep', () => {
    const { receive } = useSpritesAllStore.getState()
    receive({
      kind: 'start',
      sweepId: 'sweep-1',
      total: 2,
      accounts: [
        { accountId: 'a', displayName: 'A' },
        { accountId: 'b', displayName: 'B' },
      ],
    })
    receive({
      kind: 'account',
      sweepId: 'sweep-1',
      accountId: 'a',
      displayName: 'A',
      index: 1,
      total: 2,
      collection,
    })
    receive({
      kind: 'account',
      sweepId: 'sweep-1',
      accountId: 'b',
      displayName: 'B',
      index: 2,
      total: 2,
      collection,
    })
    receive({
      kind: 'start',
      sweepId: 'sweep-2',
      total: 1,
      accounts: [{ accountId: 'a', displayName: 'A' }],
    })

    const { columns } = useSpritesAllStore.getState()

    expect(columns.b).toBeUndefined()
    expect(columns.a).toMatchObject({ state: 'reading', collection })
  })
})
