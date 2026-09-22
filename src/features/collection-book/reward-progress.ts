export interface BookRewardLevel {
  /** Displayed level, not the zero-based game-table row. */
  level: number
  totalXp: number
  xpToNextLevel: number
}

/** Highest achieved level survives unslotting; current XP can fall below it. */
export function bookRewardProgress(
  levels: readonly BookRewardLevel[],
  currentXp: number | null,
  highestDisplayedLevel: number | null = null
) {
  if (currentXp !== null && (!Number.isFinite(currentXp) || currentXp < 0)) {
    throw new Error('Collection Book XP must be a non-negative finite number')
  }
  if (highestDisplayedLevel !== null &&
      (!Number.isInteger(highestDisplayedLevel) || highestDisplayedLevel < 1)) {
    throw new Error('Expected a one-based displayed Collection Book level')
  }
  if (!levels.length || (currentXp === null && highestDisplayedLevel === null)) {
    return null
  }
  const xpLevel = currentXp === null ? null :
    levels.findLast((row) => row.totalXp <= currentXp)
  const displayLevel = Math.max(xpLevel?.level ?? 1, highestDisplayedLevel ?? 1)
  const current = levels.find((row) => row.level === displayLevel)
  // Do not invent a threshold for a future game level outside this catalog.
  if (!current) return null
  const next = levels.find((row) => row.level > displayLevel) ?? null
  return {
    current,
    next,
    currentXp,
    xpForLevel: next ? next.totalXp - current.totalXp : null,
    xpRemaining: currentXp !== null && next
      ? Math.max(0, next.totalXp - currentXp) : null,
    xpDebt: currentXp !== null ? Math.max(0, current.totalXp - currentXp) : null,
    progress: currentXp !== null && next
      ? Math.max(0, Math.min(1, (currentXp - current.totalXp) /
        (next.totalXp - current.totalXp))) : null,
  }
}
