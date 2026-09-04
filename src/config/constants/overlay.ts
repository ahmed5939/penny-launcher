export const overlayPositions = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
] as const

export const overlayScales = ['compact', 'normal', 'large'] as const

export const defaultOverlayQuestGroups = {
  daily: true,
  ventures: true,
  weekly: true,
  stormShield: true,
  wargames: true,
  dungeons: true,
  endurance: true,
  active: true,
}

export const defaultOverlaySettings = {
  enabled: true,
  position: 'top-right' as const,
  scale: 'normal' as const,
  opacity: 92,
  refreshMinutes: 5,
  maximumPlayers: 4,
  maximumQuestsPerPlayer: 18,
  includeSquadMembers: true,
  showMission: true,
  showVentures: true,
  showQuestDescriptions: true,
  showQuestProgress: true,
  questGroups: defaultOverlayQuestGroups,
}
