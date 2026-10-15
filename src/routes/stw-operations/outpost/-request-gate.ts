/**
 * Decides whether a reply still belongs on screen. Every account change starts
 * a new generation, so a request begun for an earlier account is dropped even
 * if the same account is selected again by the time it lands.
 */
export function createRequestGate() {
  let accountId: string | null = null
  let generation = 0

  return {
    /** Moves to `next` and returns true when that is a different account. */
    select(next: string | null) {
      if (next === accountId) return false

      accountId = next
      generation += 1

      return true
    },
    /** Snapshot taken when a request starts; call it when the reply lands. */
    begin() {
      const started = generation

      return () => started === generation
    },
  }
}
