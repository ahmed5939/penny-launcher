export type WriteMark = { inFlight: number; writes: number }

/**
 * Tells a poll reply apart from a save. A poll asked before a save started, or
 * still running when it was asked, may describe settings from before that
 * save, and it can arrive after the save has finished. Such a reply is stale.
 */
export function createWriteTracker() {
  let inFlight = 0
  let writes = 0

  return {
    start() {
      inFlight += 1
      writes += 1
    },
    finish() {
      inFlight -= 1
      writes += 1
    },
    mark: (): WriteMark => ({ inFlight, writes }),
    isCurrent: (sent: WriteMark) => sent.inFlight === 0 && sent.writes === writes,
  }
}
