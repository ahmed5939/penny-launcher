export type OverlayQuestGroup =
  | 'daily'
  | 'ventures'
  | 'weekly'
  | 'storm-shield'
  | 'wargames'
  | 'dungeons'
  | 'endurance'
  | 'active'

export type OverlayQuest = {
  id: string
  name: string
  description?: string
  group: OverlayQuestGroup
  current?: number
  total?: number
}

export type OverlayPlayer = {
  displayName: string
  errorMessage?: string
  mission?: string
  missionDetails?: string
  quests: Array<OverlayQuest>
  ventureLevel?: string
  venturePowerLevel?: number
}

export type OverlaySnapshot = {
  players: Array<OverlayPlayer>
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  status?: string
  updatedAt: string
}
