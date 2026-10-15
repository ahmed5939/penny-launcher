import { describe, expect, it } from 'vitest'

import { createRequestGate } from './-request-gate'

/** A request whose reply the test releases by hand, the way a slow IPC call lands. */
function deferredRequest(
  gate: ReturnType<typeof createRequestGate>,
  applied: Array<string>,
  label: string
) {
  const stillCurrent = gate.begin()
  let reply!: () => void
  const landed = new Promise<void>((resolve) => {
    reply = resolve
  })

  return {
    land: async () => {
      reply()
      await landed.then(() => {
        if (stillCurrent()) applied.push(label)
      })
    },
  }
}

describe('createRequestGate', () => {
  it('applies a reply for the account still on screen', async () => {
    const gate = createRequestGate()
    const applied: Array<string> = []

    gate.select('A')
    await deferredRequest(gate, applied, 'A').land()

    expect(applied).toEqual(['A'])
  })

  it('drops a deferred reply from A after switching to B', async () => {
    const gate = createRequestGate()
    const applied: Array<string> = []

    gate.select('A')
    const fromA = deferredRequest(gate, applied, 'A')
    gate.select('B')
    const fromB = deferredRequest(gate, applied, 'B')

    await fromB.land()
    await fromA.land()

    expect(applied).toEqual(['B'])
  })

  it('drops a reply from before a switch away and back to the same account', async () => {
    const gate = createRequestGate()
    const applied: Array<string> = []

    gate.select('A')
    const first = deferredRequest(gate, applied, 'first A')
    gate.select('B')
    gate.select('A')
    const second = deferredRequest(gate, applied, 'second A')

    await first.land()
    await second.land()

    expect(applied).toEqual(['second A'])
  })

  it('keeps replies when the same account is selected again', async () => {
    const gate = createRequestGate()
    const applied: Array<string> = []

    expect(gate.select('A')).toBe(true)
    const request = deferredRequest(gate, applied, 'A')
    expect(gate.select('A')).toBe(false)
    await request.land()

    expect(applied).toEqual(['A'])
  })

  it('drops a reply from an account that is deselected', async () => {
    const gate = createRequestGate()
    const applied: Array<string> = []

    gate.select('A')
    const request = deferredRequest(gate, applied, 'A')
    gate.select(null)
    await request.land()

    expect(applied).toEqual([])
  })
})
