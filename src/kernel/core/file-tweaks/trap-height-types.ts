export type PatchStatus = {
  found: boolean
  activated: boolean
  error?: string
}

export type PatchResult = {
  success: boolean
  activated?: boolean
  message: string
}

export type TrapListItem = {
  defaultHeight: string
  desc: string
  family: string
  guid: string
  heightSupported: boolean
  name: string
  rarity: string
  tier: string
}

export type TrapFamilyInfo = {
  category: string
  defaultHeight: { hex: string; uu: number }
  heightOffset: number
  heightSupported: boolean
  insideFloor: { hex: string; uu: number } | null
  key: string
}

export type TrapHeightScaleEntry = {
  blocks: string
  hex: string
  uu: number
}

export type TrapNamedConfig = {
  hex: string
  key: string
  label: string
  uu: number
}

export type TrapPatchState = {
  currentHeight: string
  guidFilePos: number
  heightOffset: number
  originalHeight: string
  trapName: string
}

export type TrapStatus = {
  currentHeight: string | null
  error?: string
  found: boolean
  isModified: boolean
}

export type TrapActionResult = {
  currentHeight?: string
  isModified?: boolean
  message: string
  success: boolean
}

export type BasePatchStatus = {
  currentHeight: string
  error?: string
  found: boolean
  isModified: boolean
}

export type ModifiedTrap = {
  currentHeight: string
  desc: string
  guid: string
  name: string
  rarity: string
  tier: string
}

export type WorkerPowerResult = {
  error?: string
  heroCount?: number
  json?: string
  modified?: number
  sizeMB?: string
  success: boolean
  workerCount?: number
}
