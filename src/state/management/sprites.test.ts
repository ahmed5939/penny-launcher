import { beforeEach, describe, expect, it } from 'vitest'

import { useSpritesStore } from './sprites'

describe('sprites account requests', () => {
  beforeEach(() => useSpritesStore.getState().reset())

  it('ignores a late response from a previously selected account', () => {
    const state = useSpritesStore.getState()
    state.setLoading('first')
    state.setLoading('second')
    state.setPayload({ accountId: 'first', collection: null })

    expect(useSpritesStore.getState()).toMatchObject({
      requestedFor: 'second',
      loadedFor: null,
      isLoading: true,
    })

    state.setPayload({ accountId: 'second', collection: null })

    expect(useSpritesStore.getState()).toMatchObject({
      loadedFor: 'second',
      isLoading: false,
    })
  })

  it('clears another account’s collection when switching', () => {
    const state = useSpritesStore.getState()
    state.setLoading('first')
    state.setPayload({
      accountId: 'first',
      collection: {
        families: [],
        totalVariants: 0,
        ownedVariants: 0,
        lostVariants: 0,
        masteredVariants: 0,
        spriteDust: null,
        equippedRelicId: null,
      },
    })
    state.setLoading('second')

    expect(useSpritesStore.getState().collection).toBeNull()
    expect(useSpritesStore.getState().loadedFor).toBeNull()
  })
})
