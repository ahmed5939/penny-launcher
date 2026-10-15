import { expect, it } from 'vitest'

import { autoKickToast } from './load-automation'

it('reports a failed auto-kick as an error with the next step', () => {
  expect(autoKickToast(-1)).toEqual({
    tone: 'error',
    message:
      "Auto-kick could not run: the account's sign-in has expired or Epic did not answer. Check it on Automation.",
  })
})

it('stays quiet when nobody was kicked', () => {
  expect(autoKickToast(0)).toBeNull()
})

it('counts kicked players', () => {
  expect(autoKickToast(1)).toEqual({
    tone: 'success',
    message: 'Automation kicked 1 player',
  })
  expect(autoKickToast(3)).toEqual({
    tone: 'success',
    message: 'Automation kicked 3 players',
  })
})
