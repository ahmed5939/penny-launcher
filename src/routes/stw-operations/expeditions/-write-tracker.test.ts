import { describe, expect, it } from 'vitest'

import { createWriteTracker } from './-write-tracker'

describe('createWriteTracker', () => {
  it('trusts a poll asked while nothing was being saved', () => {
    const writes = createWriteTracker()
    const sent = writes.mark()

    expect(writes.isCurrent(sent)).toBe(true)
  })

  it('drops a deferred poll reply that arrives after a save has finished', () => {
    const writes = createWriteTracker()
    const sent = writes.mark()

    writes.start()
    writes.finish()

    expect(writes.isCurrent(sent)).toBe(false)
  })

  it('drops a poll asked while a save was running, even once the save has finished', () => {
    const writes = createWriteTracker()

    writes.start()
    const sent = writes.mark()
    writes.finish()

    expect(writes.isCurrent(sent)).toBe(false)
  })

  it('drops a poll whose reply arrives while a save started after it is still running', () => {
    const writes = createWriteTracker()
    const sent = writes.mark()

    writes.start()

    expect(writes.isCurrent(sent)).toBe(false)
  })

  it('trusts a poll asked after the latest save has finished', () => {
    const writes = createWriteTracker()

    writes.start()
    writes.finish()
    const sent = writes.mark()

    expect(writes.isCurrent(sent)).toBe(true)
  })
})
