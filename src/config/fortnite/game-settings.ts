/**
 * Limits for the values Penny writes into Fortnite's `GameUserSettings.ini`.
 *
 * Shared so the form and the main process agree on what is acceptable: the
 * renderer uses them for validation messages, and `kernel/core/game-user-settings`
 * enforces them again before anything reaches the file.
 */

export const resolutionRange = { min: 320, max: 15_360 } as const

/** `0` means uncapped, which is what the game's own "unlimited" writes. */
export const frameRateLimitRange = { min: 0, max: 1_000 } as const

/** UE's 3D resolution percentage. */
export const resolutionQualityRange = { min: 25, max: 100 } as const

export const fullscreenModes = {
  fullscreen: 0,
  windowedFullscreen: 1,
  windowed: 2,
} as const

export const fullscreenModeValues = [0, 1, 2] as const

export const renderingModes = ['dx11', 'dx12', 'performance'] as const

/** Scalability groups (`sg.*`): low, medium, high, epic. */
export const qualityRange = { min: 0, max: 4 } as const
