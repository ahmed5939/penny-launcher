import { beforeEach, describe, expect, it } from 'vitest'

import { useLockerStore } from './locker'

const card = {
  filePath: 'cards/first.png',
  fileName: 'first.png',
  count: 1,
  width: 1,
  height: 1,
  previewDataUrl: '',
  sizeBytes: 1,
}

describe('locker transient state owner', () => {
  beforeEach(() => useLockerStore.getState().reset())

  it('keeps a card and an open picker when the same account claims them again', () => {
    const state = useLockerStore.getState()
    state.claimFor('first')
    state.openPicker('character')
    state.setCard({ accountId: 'first', card })

    state.claimFor('first')

    expect(useLockerStore.getState()).toMatchObject({
      transientFor: 'first',
      pickerSlot: 'character',
      card,
    })
  })

  it('clears a picker, an equip and a card when another account claims them', () => {
    const state = useLockerStore.getState()
    state.claimFor('first')
    state.openPicker('character')
    state.setEquipping('character')
    state.setCard({ accountId: 'first', card })
    state.setGenerating(true)

    state.claimFor('second')

    expect(useLockerStore.getState()).toMatchObject({
      transientFor: 'second',
      pickerSlot: null,
      equipping: null,
      isGenerating: false,
      card: null,
    })
  })

  it('does not hand back a card made for an account the user switched away from', () => {
    const state = useLockerStore.getState()
    state.claimFor('first')
    state.setResponse({ accountId: 'first', slots: {} })
    state.claimFor('second')
    state.setCard({ accountId: 'second', card })

    state.claimFor('first')

    expect(useLockerStore.getState()).toMatchObject({
      transientFor: 'first',
      loadedFor: 'first',
      card: null,
    })
  })
})
