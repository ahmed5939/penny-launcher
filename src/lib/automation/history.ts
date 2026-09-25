/** Rolling retention shared by the saved history and the live panel. */
export const AUTOMATION_HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
export function isRecentAutomationEvent(createdAt: string, now = Date.now()) {
  const timestamp = Date.parse(createdAt)
  return Number.isFinite(timestamp) && timestamp >= now - AUTOMATION_HISTORY_RETENTION_MS && timestamp <= now
}
