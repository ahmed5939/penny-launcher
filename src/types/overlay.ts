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
  status?: string
  updatedAt: string
}
