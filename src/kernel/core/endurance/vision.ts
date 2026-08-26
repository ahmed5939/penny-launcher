import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { app, desktopCapturer, nativeImage, screen } from 'electron'

/**
 * The eyes of the endurance runner — the proven normalized-cross-correlation
 * matcher from the original macro, ported to run on Electron's own capture
 * and image decode so it needs no native imaging dependency and no user
 * supplied screenshots. Reference images are generic Fortnite UI elements
 * bundled with the app.
 */

export type GrayImage = {
  data: Uint8Array
  width: number
  height: number
}

export type Region = {
  x: number
  y: number
  width: number
  height: number
}

export type MatchResult = {
  found: boolean
  confidence: number
  /** Match rectangle in screenshot pixels. */
  rectangle: Region
  /** Point to click, in physical screen pixels (target applied) — the
   * same space SetCursorPos works in. */
  clickTarget: { x: number; y: number }
  screenshot: { width: number; height: number }
}

/** BGRA bitmap → 8-bit luma. */
function toGray(
  bitmap: Buffer,
  width: number,
  height: number,
): GrayImage {
  const data = new Uint8Array(width * height)

  for (let index = 0; index < data.length; index += 1) {
    const offset = index * 4
    // BGRA byte order from NativeImage.toBitmap().
    data[index] =
      (bitmap[offset + 2] * 299 +
        bitmap[offset + 1] * 587 +
        bitmap[offset] * 114) /
      1000
  }

  return { data, width, height }
}

/** Bilinear resize — quality on par with what the matcher needs. */
function resizeGray(
  source: GrayImage,
  width: number,
  height: number,
): GrayImage {
  const data = new Uint8Array(width * height)
  const xRatio = source.width / width
  const yRatio = source.height / height

  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(source.height - 1.001, y * yRatio)
    const y0 = Math.floor(sourceY)
    const yFraction = sourceY - y0

    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(source.width - 1.001, x * xRatio)
      const x0 = Math.floor(sourceX)
      const xFraction = sourceX - x0
      const topRow = y0 * source.width + x0
      const bottomRow = topRow + source.width
      const top =
        source.data[topRow] * (1 - xFraction) +
        source.data[topRow + 1] * xFraction
      const bottom =
        source.data[bottomRow] * (1 - xFraction) +
        source.data[bottomRow + 1] * xFraction

      data[y * width + x] = top * (1 - yFraction) + bottom * yFraction
    }
  }

  return { data, width, height }
}

function cropGray(source: GrayImage, region: Region): GrayImage {
  const left = Math.max(0, Math.round(source.width * region.x))
  const top = Math.max(0, Math.round(source.height * region.y))
  const width = Math.max(
    1,
    Math.min(
      source.width - left,
      Math.round(source.width * region.width),
    ),
  )
  const height = Math.max(
    1,
    Math.min(
      source.height - top,
      Math.round(source.height * region.height),
    ),
  )
  const data = new Uint8Array(width * height)

  for (let y = 0; y < height; y += 1) {
    const sourceStart = (top + y) * source.width + left
    data.set(
      source.data.subarray(sourceStart, sourceStart + width),
      y * width,
    )
  }

  return { data, width, height }
}

function correlationAt(
  source: GrayImage,
  template: GrayImage,
  left: number,
  top: number,
  sampleStep: number,
) {
  let sourceSum = 0
  let templateSum = 0
  let sourceSquareSum = 0
  let templateSquareSum = 0
  let productSum = 0
  let count = 0

  for (
    let y = Math.floor(sampleStep / 2);
    y < template.height;
    y += sampleStep
  ) {
    const sourceRow = (top + y) * source.width + left
    const templateRow = y * template.width

    for (
      let x = Math.floor(sampleStep / 2);
      x < template.width;
      x += sampleStep
    ) {
      const sourceValue = source.data[sourceRow + x]
      const templateValue = template.data[templateRow + x]

      sourceSum += sourceValue
      templateSum += templateValue
      sourceSquareSum += sourceValue * sourceValue
      templateSquareSum += templateValue * templateValue
      productSum += sourceValue * templateValue
      count += 1
    }
  }

  const covariance = productSum - (sourceSum * templateSum) / count
  const sourceVariance =
    sourceSquareSum - (sourceSum * sourceSum) / count
  const templateVariance =
    templateSquareSum - (templateSum * templateSum) / count
  const denominator = Math.sqrt(
    Math.max(0, sourceVariance * templateVariance),
  )

  return denominator ? covariance / denominator : -1
}

function scan(source: GrayImage, template: GrayImage) {
  const sampleStep = Math.max(
    5,
    Math.floor(Math.min(template.width, template.height) / 18),
  )
  const positionStep = Math.max(
    3,
    Math.floor(Math.min(template.width, template.height) / 42),
  )
  let best = { correlation: -1, x: 0, y: 0 }

  for (let y = 0; y <= source.height - template.height; y += positionStep) {
    for (
      let x = 0;
      x <= source.width - template.width;
      x += positionStep
    ) {
      const correlation = correlationAt(
        source,
        template,
        x,
        y,
        sampleStep,
      )

      if (correlation > best.correlation) {
        best = { correlation, x, y }
      }
    }
  }

  const refineRadius = positionStep + 1
  const refineStep = Math.max(3, Math.floor(sampleStep / 2))

  for (
    let y = Math.max(0, best.y - refineRadius);
    y <=
    Math.min(source.height - template.height, best.y + refineRadius);
    y += 1
  ) {
    for (
      let x = Math.max(0, best.x - refineRadius);
      x <=
      Math.min(source.width - template.width, best.x + refineRadius);
      x += 1
    ) {
      const correlation = correlationAt(source, template, x, y, refineStep)

      if (correlation > best.correlation) {
        best = { correlation, x, y }
      }
    }
  }

  // Report confidence using all template pixels at the refined location,
  // matching OpenCV's TM_CCOEFF_NORMED semantics much more closely than the
  // coarse search samples alone.
  best.correlation = correlationAt(source, template, best.x, best.y, 1)

  return best
}

function buildScaleCandidates(sourceHeight: number) {
  const candidates: Array<number> = []
  const add = (value: number) => {
    const rounded = Math.round(value * 1000) / 1000

    if (
      rounded < 0.4 ||
      rounded > 2.5 ||
      candidates.some((item) => Math.abs(item - rounded) < 0.025)
    ) {
      return
    }

    candidates.push(rounded)
  }

  // Bundled references were captured around a 1600px-tall client.
  add(1)
  // These are the exact scale candidates used by the reference macro.
  add(0.95)
  add(1.05)
  add(sourceHeight / 1600)

  for (const base of [...candidates]) {
    add(base * 0.875)
    add(base * 1.125)
    add(base * 0.75)
    add(base * 1.25)
  }

  return candidates
}

export class Vision {
  private static templates = new Map<string, GrayImage>()

  /** Test hook: match against a PNG on disk instead of the live screen. */
  static captureOverridePath: string | null = null

  private static assetsDirectory = app.isPackaged
    ? path.join(process.resourcesPath, 'endurance-assets')
    : path.join(app.getAppPath(), 'endurance-assets')

  private static async template(id: string): Promise<GrayImage> {
    const cached = Vision.templates.get(id)

    if (cached) {
      return cached
    }

    const file = await readFile(
      path.join(Vision.assetsDirectory, `${id}.png`),
    )
    const image = nativeImage.createFromBuffer(file)

    if (image.isEmpty()) {
      throw new Error(`Reference image ${id}.png could not be decoded.`)
    }

    const { width, height } = image.getSize()
    const gray = toGray(image.toBitmap(), width, height)

    Vision.templates.set(id, gray)

    return gray
  }

  /** Full-resolution screenshot of the primary display, grayscale. */
  static async capture(): Promise<{
    gray: GrayImage
    display: Electron.Display
  }> {
    const display = screen.getPrimaryDisplay()

    if (Vision.captureOverridePath) {
      const image = nativeImage.createFromBuffer(
        await readFile(Vision.captureOverridePath),
      )
      const size = image.getSize()

      return {
        gray: toGray(image.toBitmap(), size.width, size.height),
        display,
      }
    }
    const width = Math.round(display.size.width * display.scaleFactor)
    const height = Math.round(display.size.height * display.scaleFactor)
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height },
    })
    const source =
      sources.find(
        (item) => String(item.display_id) === String(display.id),
      ) ?? sources[0]

    if (!source || source.thumbnail.isEmpty()) {
      throw new Error('Could not capture the screen.')
    }

    const size = source.thumbnail.getSize()

    return {
      gray: toGray(source.thumbnail.toBitmap(), size.width, size.height),
      display,
    }
  }

  /**
   * One capture + match. `referenceRegion` crops the template first;
   * `searchRegion` narrows the screenshot area; `target` picks the click
   * point inside (or, deliberately, outside) the matched rectangle.
   */
  static async find(
    templateId: string,
    options: {
      referenceRegion?: Region
      searchRegion?: Region
      target?: { x: number; y: number }
      threshold?: number
    } = {},
  ): Promise<MatchResult> {
    const {
      referenceRegion,
      searchRegion,
      target = { x: 0.5, y: 0.5 },
      threshold = 0.9,
    } = options
    const { gray: fullSource, display } = await Vision.capture()

    let source = fullSource
    let offsetX = 0
    let offsetY = 0

    if (searchRegion) {
      offsetX = Math.max(0, Math.round(fullSource.width * searchRegion.x))
      offsetY = Math.max(
        0,
        Math.round(fullSource.height * searchRegion.y),
      )
      source = cropGray(fullSource, searchRegion)
    }

    let template = await Vision.template(templateId)

    if (referenceRegion) {
      template = cropGray(template, referenceRegion)
    }

    let best: {
      correlation: number
      x: number
      y: number
      width: number
      height: number
    } | null = null

    for (const scale of buildScaleCandidates(fullSource.height)) {
      const width = Math.max(20, Math.round(template.width * scale))
      const height = Math.max(20, Math.round(template.height * scale))

      if (width > source.width || height > source.height) {
        continue
      }

      const scaled =
        width === template.width && height === template.height
          ? template
          : resizeGray(template, width, height)
      const candidate = { ...scan(source, scaled), width, height }

      if (!best || candidate.correlation > best.correlation) {
        best = candidate
      }

      // cv2.TM_CCOEFF_NORMED (used by the reference macro) reports the
      // normalized correlation directly. Do not remap [-1, 1] to [0, 1]:
      // that turns a weak 0.76 match into an apparent 0.88 match.
      const confidence = Math.max(0, Math.min(1, candidate.correlation))

      if (confidence >= threshold) {
        break
      }
    }

    if (!best) {
      throw new Error(
        `Reference image ${templateId} is larger than the captured screen.`,
      )
    }

    const confidence = Math.max(0, Math.min(1, best.correlation))
    const rectangle: Region = {
      x: best.x + offsetX,
      y: best.y + offsetY,
      width: best.width,
      height: best.height,
    }
    // The capture is the primary display at physical resolution, so match
    // pixels map onto SetCursorPos space via the physical-size ratio.
    const physicalWidth = display.size.width * display.scaleFactor
    const physicalHeight = display.size.height * display.scaleFactor
    const toPhysicalX = physicalWidth / fullSource.width
    const toPhysicalY = physicalHeight / fullSource.height

    return {
      found: confidence >= threshold,
      confidence,
      rectangle,
      clickTarget: {
        x:
          display.bounds.x * display.scaleFactor +
          (rectangle.x + rectangle.width * target.x) * toPhysicalX,
        y:
          display.bounds.y * display.scaleFactor +
          (rectangle.y + rectangle.height * target.y) * toPhysicalY,
      },
      screenshot: {
        width: fullSource.width,
        height: fullSource.height,
      },
    }
  }
}
