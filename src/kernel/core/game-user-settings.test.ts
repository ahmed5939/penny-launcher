import { describe, expect, it } from 'vitest'

import {
  applyGameSettings,
  fortSection,
  parseIni,
  readGameSettings,
  sanitizeGameSettings,
  setIniValue,
} from './game-user-settings'

const sample = [
  '[/Script/FortniteGame.FortGameUserSettings]',
  'ResolutionSizeX=1920',
  'ResolutionSizeY=1080',
  'LastUserConfirmedResolutionSizeX=1920',
  'LastUserConfirmedResolutionSizeY=1080',
  'FullscreenMode=1',
  'PreferredFullscreenMode=1',
  'LastConfirmedFullscreenMode=1',
  'bUseVSync=False',
  'FrameRateLimit=240.000000',
  'bShowGrass=True',
  '',
  '[ScalabilityGroups]',
  'sg.ResolutionQuality=100',
  'sg.ShadowQuality=3',
  '',
].join('\n')

function valueOf(content: string, key: string, section = fortSection) {
  return parseIni(content).get(section)?.get(key)
}

describe('parseIni', () => {
  it('keeps the first value when a key repeats', () => {
    const sections = parseIni('[A]\nKey=first\nKey=second\n')

    expect(sections.get('A')?.get('Key')).toBe('first')
  })

  it('ignores comments and blank lines', () => {
    const sections = parseIni('[A]\n; Key=commented\n\nKey=real\n')

    expect(sections.get('A')?.get('Key')).toBe('real')
  })
})

describe('setIniValue', () => {
  it('replaces an existing key in place', () => {
    expect(setIniValue('[A]\nKey=old\n[B]\nKey=other\n', 'A', 'Key', 'new')).toBe(
      '[A]\nKey=new\n[B]\nKey=other\n'
    )
  })

  it('appends to the section when the key is missing', () => {
    expect(setIniValue('[A]\nOther=1\n[B]\nKey=2\n', 'A', 'Key', '3')).toBe(
      '[A]\nOther=1\nKey=3\n[B]\nKey=2\n'
    )
  })

  it('creates the section when the file has none', () => {
    expect(setIniValue('[A]\nOther=1', 'B', 'Key', '2')).toBe(
      '[A]\nOther=1\n\n[B]\nKey=2'
    )
  })
})

describe('readGameSettings', () => {
  it('reads the display values from the Fortnite section', () => {
    const settings = readGameSettings(sample)

    expect(settings.resolutionX).toBe(1920)
    expect(settings.resolutionY).toBe(1080)
    expect(settings.fullscreenMode).toBe(1)
    expect(settings.vsync).toBe(false)
    expect(settings.frameRateLimit).toBe(240)
    expect(settings.resolutionQuality).toBe(100)
  })

  it('reads CRLF files', () => {
    expect(readGameSettings(sample.replace(/\n/g, '\r\n')).resolutionX).toBe(1920)
  })

  it('falls back to the confirmed mode when FullscreenMode is absent', () => {
    const content = '[/Script/FortniteGame.FortGameUserSettings]\nLastConfirmedFullscreenMode=2\n'

    expect(readGameSettings(content).fullscreenMode).toBe(2)
  })

  it('reports performance mode from the PerformanceMode section', () => {
    const content = `${sample}\n[PerformanceMode]\nMeshQuality=0\n`

    expect(readGameSettings(content).renderingMode).toBe('performance')
  })
})

describe('sanitizeGameSettings', () => {
  it('drops values outside the ranges the game uses', () => {
    expect(
      sanitizeGameSettings({
        resolutionX: 1280,
        resolutionY: 99_999,
        fullscreenMode: 5,
        resolutionQuality: 10,
        frameRateLimit: 120,
      })
    ).toEqual({ resolutionX: 1280, frameRateLimit: 120 })
  })

  it('drops unknown keys and wrongly typed values', () => {
    expect(
      sanitizeGameSettings({ vsync: 'yes', nonsense: 1, showFps: true })
    ).toEqual({ showFps: true })
  })

  it('refuses string values that could smuggle in another INI line', () => {
    expect(
      sanitizeGameSettings({ antiAliasingMethod: 'TSRHigh\nbRayTracing=True' })
    ).toEqual({})
    expect(sanitizeGameSettings({ renderingMode: 'vulkan' })).toEqual({})
    expect(sanitizeGameSettings({ renderingMode: 'dx11' })).toEqual({
      renderingMode: 'dx11',
    })
  })

  it('rounds numbers that the file stores as integers', () => {
    expect(sanitizeGameSettings({ resolutionQuality: 74.6 })).toEqual({
      resolutionQuality: 75,
    })
  })
})

describe('applyGameSettings', () => {
  it('writes the resolution alongside its LastUserConfirmed pair', () => {
    const next = applyGameSettings(sample, {
      resolutionX: 2560,
      resolutionY: 1440,
    })

    expect(valueOf(next, 'ResolutionSizeX')).toBe('2560')
    expect(valueOf(next, 'LastUserConfirmedResolutionSizeX')).toBe('2560')
    expect(valueOf(next, 'ResolutionSizeY')).toBe('1440')
    expect(valueOf(next, 'LastUserConfirmedResolutionSizeY')).toBe('1440')
  })

  it('writes all three fullscreen keys together', () => {
    const next = applyGameSettings(sample, { fullscreenMode: 2 })

    expect(valueOf(next, 'FullscreenMode')).toBe('2')
    expect(valueOf(next, 'PreferredFullscreenMode')).toBe('2')
    expect(valueOf(next, 'LastConfirmedFullscreenMode')).toBe('2')
  })

  it('writes booleans, the frame rate limit and the quality scale', () => {
    const next = applyGameSettings(sample, {
      vsync: true,
      frameRateLimit: 144,
      resolutionQuality: 80,
    })

    expect(valueOf(next, 'bUseVSync')).toBe('True')
    expect(valueOf(next, 'FrameRateLimit')).toBe('144.000000')
    expect(valueOf(next, 'sg.ResolutionQuality', 'ScalabilityGroups')).toBe('80')
  })

  it('leaves untouched keys exactly as they were', () => {
    const next = applyGameSettings(sample, { vsync: true })

    expect(valueOf(next, 'bShowGrass')).toBe('True')
    expect(valueOf(next, 'sg.ShadowQuality', 'ScalabilityGroups')).toBe('3')
    expect(next.split('\n')).toHaveLength(sample.split('\n').length)
  })

  it('is a no-op for an empty patch', () => {
    expect(applyGameSettings(sample, {})).toBe(sample)
  })
})
