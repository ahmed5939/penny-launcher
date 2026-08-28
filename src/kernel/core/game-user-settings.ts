import type { GameSettings } from '../../types/fn-launch'

import {
  frameRateLimitRange,
  qualityRange,
  renderingModes,
  resolutionQualityRange,
  resolutionRange,
} from '../../config/fortnite/game-settings'

/**
 * Fortnite's `GameUserSettings.ini` — parsing, reading and editing.
 *
 * Pure string work only: no `fs`, no `electron`. The file lives at
 * `%LOCALAPPDATA%\FortniteGame\Saved\Config\WindowsClient\GameUserSettings.ini`
 * and is the same file the in-game settings screen writes, so everything here
 * stays inside keys the game already owns — nothing is injected into the game
 * and no protected memory is touched.
 *
 * `core/fn-launch.ts` owns the file itself (path discovery, backup, write).
 */

export const gameUserSettingsRelativePath = [
  'FortniteGame',
  'Saved',
  'Config',
  'WindowsClient',
  'GameUserSettings.ini',
] as const

export const fortSection = '/Script/FortniteGame.FortGameUserSettings'
export const scalabilitySection = 'ScalabilityGroups'
export const rhiSection = 'D3DRHIPreference'
export const performanceSection = 'PerformanceMode'

// ── INI parsing ───────────────────────────────────────────────

/** Parse an INI file into `section → key → value`. First occurrence wins. */
export function parseIni(content: string): Map<string, Map<string, string>> {
  const sections = new Map<string, Map<string, string>>()
  let currentSection = ''
  sections.set(currentSection, new Map())

  for (const line of content.split('\n')) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith(';')) continue

    const sectionMatch = trimmed.match(/^\[(.+)\]$/)

    if (sectionMatch) {
      currentSection = sectionMatch[1]

      if (!sections.has(currentSection)) {
        sections.set(currentSection, new Map())
      }

      continue
    }

    const eqIndex = trimmed.indexOf('=')

    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex)
      const value = trimmed.substring(eqIndex + 1)
      const sectionMap = sections.get(currentSection)

      if (sectionMap && !sectionMap.has(key)) {
        sectionMap.set(key, value)
      }
    }
  }

  return sections
}

/**
 * Set a value in an INI file string. If the key exists under the section it
 * is replaced in place; otherwise it is appended to the section — or the
 * section is created at the end of the file.
 */
export function setIniValue(
  content: string,
  section: string,
  key: string,
  value: string
): string {
  const lines = content.split('\n')
  let inSection = false
  let lastKeyLineInSection = -1
  let sectionStartLine = -1

  for (let index = 0; index < lines.length; index++) {
    const trimmed = lines[index].trim()
    const sectionMatch = trimmed.match(/^\[(.+)\]$/)

    if (sectionMatch) {
      if (inSection) {
        // Left the target section without meeting the key: insert here.
        break
      }

      if (sectionMatch[1] === section) {
        inSection = true
        sectionStartLine = index
      }

      continue
    }

    if (inSection && trimmed.startsWith(`${key}=`)) {
      lines[index] = `${key}=${value}`

      return lines.join('\n')
    }

    if (inSection && trimmed && !trimmed.startsWith(';')) {
      lastKeyLineInSection = index
    }
  }

  if (sectionStartLine >= 0 && lastKeyLineInSection >= 0) {
    lines.splice(lastKeyLineInSection + 1, 0, `${key}=${value}`)
  } else if (sectionStartLine >= 0) {
    lines.splice(sectionStartLine + 1, 0, `${key}=${value}`)
  } else {
    lines.push('', `[${section}]`, `${key}=${value}`)
  }

  return lines.join('\n')
}

function readValue(
  sections: Map<string, Map<string, string>>,
  section: string,
  key: string,
  fallback = ''
): string {
  return sections.get(section)?.get(key) ?? fallback
}

function readNumber(
  sections: Map<string, Map<string, string>>,
  section: string,
  key: string,
  fallback: number
): number {
  const parsed = Number.parseFloat(readValue(sections, section, key))

  return Number.isFinite(parsed) ? parsed : fallback
}

function readInteger(
  sections: Map<string, Map<string, string>>,
  section: string,
  key: string,
  fallback: number
): number {
  return Math.round(readNumber(sections, section, key, fallback))
}

function readBool(
  sections: Map<string, Map<string, string>>,
  section: string,
  key: string,
  fallback = false
): boolean {
  const value = readValue(sections, section, key)

  return value === '' ? fallback : value.toLowerCase() === 'true'
}

/**
 * The mode the game is actually in. `FullscreenMode` is the live value;
 * a file written before the user ever confirmed a change only carries the
 * `LastConfirmed`/`Preferred` pair, so fall back through both.
 */
function readFullscreenMode(
  sections: Map<string, Map<string, string>>
): number {
  for (const key of [
    'FullscreenMode',
    'LastConfirmedFullscreenMode',
    'PreferredFullscreenMode',
  ]) {
    if (readValue(sections, fortSection, key) !== '') {
      return readInteger(sections, fortSection, key, 1)
    }
  }

  return 1
}

// ── Reading ───────────────────────────────────────────────────

export function readGameSettings(content: string): GameSettings {
  const sections = parseIni(content.replace(/\r\n/g, '\n'))

  // Performance mode is DX11 with `[PerformanceMode] MeshQuality` present.
  const meshQuality = readValue(sections, performanceSection, 'MeshQuality')
  const preferredRhi =
    readValue(sections, rhiSection, 'PreferredRHI', 'dx12') || 'dx12'

  return {
    // Display
    resolutionX: readInteger(sections, fortSection, 'ResolutionSizeX', 1920),
    resolutionY: readInteger(sections, fortSection, 'ResolutionSizeY', 1080),
    fullscreenMode: readFullscreenMode(sections),
    vsync: readBool(sections, fortSection, 'bUseVSync'),
    frameRateLimit: readNumber(sections, fortSection, 'FrameRateLimit', 240),
    renderingMode: meshQuality !== '' ? 'performance' : preferredRhi,

    // Graphics
    displayGamma: readNumber(sections, fortSection, 'DisplayGamma', 2.2),
    userInterfaceContrast: readNumber(
      sections,
      fortSection,
      'UserInterfaceContrast',
      1.0
    ),
    motionBlur: readBool(sections, fortSection, 'bMotionBlur'),
    uiParallax: readBool(sections, fortSection, 'bAllowUIParallax'),
    showFps: readBool(sections, fortSection, 'bShowFPS'),

    // Graphics quality
    viewDistance: readInteger(
      sections,
      scalabilitySection,
      'sg.ViewDistanceQuality',
      3
    ),
    shadows: readInteger(sections, scalabilitySection, 'sg.ShadowQuality', 3),
    antiAliasingQuality: readInteger(
      sections,
      scalabilitySection,
      'sg.AntiAliasingQuality',
      3
    ),
    textures: readInteger(sections, scalabilitySection, 'sg.TextureQuality', 3),
    effects: readInteger(sections, scalabilitySection, 'sg.EffectsQuality', 3),
    postProcess: readInteger(
      sections,
      scalabilitySection,
      'sg.PostProcessQuality',
      3
    ),
    globalIllumination: readInteger(
      sections,
      scalabilitySection,
      'sg.GlobalIlluminationQuality',
      1
    ),
    reflections: readInteger(
      sections,
      scalabilitySection,
      'sg.ReflectionQuality',
      1
    ),
    foliage: readInteger(sections, scalabilitySection, 'sg.FoliageQuality', 3),
    resolutionQuality: readInteger(
      sections,
      scalabilitySection,
      'sg.ResolutionQuality',
      100
    ),

    // Advanced graphics quality
    antiAliasingMethod: readValue(
      sections,
      fortSection,
      'FortAntiAliasingMethod',
      'TSRMedium'
    ),
    tsrQuality: readValue(
      sections,
      fortSection,
      'TemporalSuperResolutionQuality',
      'Quality'
    ),
    dynamicResolution: readBool(sections, fortSection, 'bUseDynamicResolution'),
    nanite: readBool(sections, fortSection, 'bUseNanite'),
    desiredGIQuality: readInteger(
      sections,
      fortSection,
      'DesiredGlobalIlluminationQuality',
      1
    ),
    desiredReflectionQuality: readInteger(
      sections,
      fortSection,
      'DesiredReflectionQuality',
      1
    ),
    rayTracing: readBool(sections, fortSection, 'bRayTracing'),
    showGrass: readBool(sections, fortSection, 'bShowGrass', true),
  }
}

// ── Validation ────────────────────────────────────────────────

function integerIn(value: unknown, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }

  const rounded = Math.round(value)

  return rounded < min || rounded > max ? undefined : rounded
}

function numberIn(value: unknown, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }

  return value < min || value > max ? undefined : value
}

function boolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
}

/** UE reads these back as identifiers, so refuse anything that could add a line. */
function token(value: unknown) {
  return typeof value === 'string' && /^[A-Za-z0-9_.]{1,32}$/.test(value)
    ? value
    : undefined
}

function quality(value: unknown) {
  return integerIn(value, qualityRange.min, qualityRange.max)
}

function oneOf<T extends string>(value: unknown, allowed: ReadonlyArray<T>) {
  return typeof value === 'string' && (allowed as ReadonlyArray<string>).includes(value)
    ? (value as T)
    : undefined
}

/**
 * Keep only the keys we recognise, with values inside the ranges the game
 * itself uses. Anything else is dropped rather than written — the renderer is
 * the one asking, and this file belongs to Fortnite.
 */
export function sanitizeGameSettings(input: unknown): Partial<GameSettings> {
  if (!input || typeof input !== 'object') {
    return {}
  }

  const raw = input as Record<string, unknown>
  const candidate: Partial<GameSettings> = {
    // Display
    resolutionX: integerIn(
      raw.resolutionX,
      resolutionRange.min,
      resolutionRange.max
    ),
    resolutionY: integerIn(
      raw.resolutionY,
      resolutionRange.min,
      resolutionRange.max
    ),
    fullscreenMode: integerIn(raw.fullscreenMode, 0, 2),
    vsync: boolean(raw.vsync),
    frameRateLimit: numberIn(
      raw.frameRateLimit,
      frameRateLimitRange.min,
      frameRateLimitRange.max
    ),
    renderingMode: oneOf(raw.renderingMode, renderingModes),

    // Graphics
    displayGamma: numberIn(raw.displayGamma, 1, 5),
    userInterfaceContrast: numberIn(raw.userInterfaceContrast, 0, 2),
    motionBlur: boolean(raw.motionBlur),
    uiParallax: boolean(raw.uiParallax),
    showFps: boolean(raw.showFps),

    // Graphics quality
    viewDistance: quality(raw.viewDistance),
    shadows: quality(raw.shadows),
    antiAliasingQuality: quality(raw.antiAliasingQuality),
    textures: quality(raw.textures),
    effects: quality(raw.effects),
    postProcess: quality(raw.postProcess),
    globalIllumination: quality(raw.globalIllumination),
    reflections: quality(raw.reflections),
    foliage: quality(raw.foliage),
    resolutionQuality: integerIn(
      raw.resolutionQuality,
      resolutionQualityRange.min,
      resolutionQualityRange.max
    ),

    // Advanced graphics quality
    antiAliasingMethod: token(raw.antiAliasingMethod),
    tsrQuality: token(raw.tsrQuality),
    dynamicResolution: boolean(raw.dynamicResolution),
    nanite: boolean(raw.nanite),
    desiredGIQuality: integerIn(raw.desiredGIQuality, 0, 2),
    desiredReflectionQuality: integerIn(raw.desiredReflectionQuality, 0, 2),
    rayTracing: boolean(raw.rayTracing),
    showGrass: boolean(raw.showGrass),
  }

  return Object.fromEntries(
    Object.entries(candidate).filter(([, value]) => value !== undefined)
  ) as Partial<GameSettings>
}

// ── Writing ───────────────────────────────────────────────────

function bool(value: boolean) {
  return value ? 'True' : 'False'
}

/**
 * Apply a sanitized patch to the file's text. Only the keys present in
 * `partial` are touched; every other line — including keys Penny knows
 * nothing about — is left exactly where the game put it.
 */
export function applyGameSettings(
  content: string,
  partial: Partial<GameSettings>
): string {
  let next = content
  const fort = (key: string, value: string) => {
    next = setIniValue(next, fortSection, key, value)
  }
  const scalability = (key: string, value: string) => {
    next = setIniValue(next, scalabilitySection, key, value)
  }

  // Display
  if (partial.resolutionX !== undefined) {
    fort('ResolutionSizeX', `${partial.resolutionX}`)
    fort('LastUserConfirmedResolutionSizeX', `${partial.resolutionX}`)
  }

  if (partial.resolutionY !== undefined) {
    fort('ResolutionSizeY', `${partial.resolutionY}`)
    fort('LastUserConfirmedResolutionSizeY', `${partial.resolutionY}`)
  }

  if (partial.fullscreenMode !== undefined) {
    // All three, or the game reverts on the next confirmation prompt.
    fort('FullscreenMode', `${partial.fullscreenMode}`)
    fort('PreferredFullscreenMode', `${partial.fullscreenMode}`)
    fort('LastConfirmedFullscreenMode', `${partial.fullscreenMode}`)
  }

  if (partial.vsync !== undefined) {
    fort('bUseVSync', bool(partial.vsync))
  }

  if (partial.frameRateLimit !== undefined) {
    fort('FrameRateLimit', partial.frameRateLimit.toFixed(6))
  }

  if (partial.renderingMode !== undefined) {
    if (partial.renderingMode === 'performance') {
      next = setIniValue(next, rhiSection, 'PreferredRHI', 'dx11')
      next = setIniValue(next, performanceSection, 'MeshQuality', '0')
    } else {
      next = setIniValue(
        next,
        rhiSection,
        'PreferredRHI',
        partial.renderingMode
      )
      // Leave no stale MeshQuality behind: it is what marks performance mode.
      next = next.replace(
        /\[PerformanceMode\]\s*\nMeshQuality=\d+\s*\n?/,
        '[PerformanceMode]\n'
      )
    }
  }

  // Graphics
  if (partial.displayGamma !== undefined) {
    fort('DisplayGamma', partial.displayGamma.toFixed(6))
  }

  if (partial.userInterfaceContrast !== undefined) {
    fort('UserInterfaceContrast', partial.userInterfaceContrast.toFixed(6))
  }

  if (partial.motionBlur !== undefined) {
    fort('bMotionBlur', bool(partial.motionBlur))
  }

  if (partial.uiParallax !== undefined) {
    fort('bAllowUIParallax', bool(partial.uiParallax))
  }

  if (partial.showFps !== undefined) {
    fort('bShowFPS', bool(partial.showFps))
  }

  // Graphics quality
  if (partial.viewDistance !== undefined) {
    scalability('sg.ViewDistanceQuality', `${partial.viewDistance}`)
  }

  if (partial.shadows !== undefined) {
    scalability('sg.ShadowQuality', `${partial.shadows}`)
  }

  if (partial.antiAliasingQuality !== undefined) {
    scalability('sg.AntiAliasingQuality', `${partial.antiAliasingQuality}`)
  }

  if (partial.textures !== undefined) {
    scalability('sg.TextureQuality', `${partial.textures}`)
  }

  if (partial.effects !== undefined) {
    scalability('sg.EffectsQuality', `${partial.effects}`)
  }

  if (partial.postProcess !== undefined) {
    scalability('sg.PostProcessQuality', `${partial.postProcess}`)
  }

  if (partial.globalIllumination !== undefined) {
    scalability('sg.GlobalIlluminationQuality', `${partial.globalIllumination}`)
  }

  if (partial.reflections !== undefined) {
    scalability('sg.ReflectionQuality', `${partial.reflections}`)
  }

  if (partial.foliage !== undefined) {
    scalability('sg.FoliageQuality', `${partial.foliage}`)
  }

  if (partial.resolutionQuality !== undefined) {
    scalability('sg.ResolutionQuality', `${partial.resolutionQuality}`)
  }

  // Advanced graphics quality
  if (partial.antiAliasingMethod !== undefined) {
    fort('FortAntiAliasingMethod', partial.antiAliasingMethod)
  }

  if (partial.tsrQuality !== undefined) {
    fort('TemporalSuperResolutionQuality', partial.tsrQuality)
  }

  if (partial.dynamicResolution !== undefined) {
    fort('bUseDynamicResolution', bool(partial.dynamicResolution))
  }

  if (partial.nanite !== undefined) {
    fort('bUseNanite', bool(partial.nanite))
  }

  if (partial.desiredGIQuality !== undefined) {
    fort('DesiredGlobalIlluminationQuality', `${partial.desiredGIQuality}`)
  }

  if (partial.desiredReflectionQuality !== undefined) {
    fort('DesiredReflectionQuality', `${partial.desiredReflectionQuality}`)
  }

  if (partial.rayTracing !== undefined) {
    fort('bRayTracing', bool(partial.rayTracing))
  }

  if (partial.showGrass !== undefined) {
    fort('bShowGrass', bool(partial.showGrass))
  }

  return next
}
