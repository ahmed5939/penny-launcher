import type { CosmeticMeta } from './locker-catalog'

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

import { cosmeticRarityWeight, cosmeticTileColors } from '../../config/fortnite/locker'

import { RuntimeLog } from '../runtime-log'

/**
 * The locker card: an account's cosmetics as one shareable image.
 *
 * Everything above `renderLockerCard` is arithmetic and string building with
 * no I/O, because that is the part worth testing — how a count becomes a
 * grid, how a shelf is ordered, what a rarity is coloured. `renderLockerCard`
 * is the thin layer that downloads art and hands buffers to sharp.
 */

/** A tile at 1:1. Anything smaller and an outfit stops being recognisable. */
const baseTileSize = 128
const tileGap = 2
const canvasPadding = 16

/**
 * PNG's own limit is far higher, but a canvas past this is several hundred
 * megabytes of RGBA in memory and no image viewer opens it happily.
 */
const maxCanvasDimension = 8192
const minTileSize = 24

/** Wider than tall: a card is looked at on a screen, not printed. */
const targetAspectRatio = 1.6

const backgroundColor = { r: 9, g: 9, b: 14, alpha: 1 }

/**
 * Spelt as a constant rather than inline so the finished data URL is never a
 * literal in the source — `scripts/check-source-budgets.mjs` reads one of
 * those as a checked-in image, which is a rule worth keeping.
 */
const previewMimeType = 'image/jpeg'

/**
 * Shelf order, then best-first inside a shelf.
 *
 * `groupOrder` maps a backend type onto its shelf; anything unlisted sorts
 * last rather than being dropped, so a cosmetic type Epic adds mid-season
 * still shows up on the card.
 */
export function sortForCard(
  cosmetics: Array<CosmeticMeta>,
  groupOrder: Map<string, number>
) {
  return [...cosmetics].sort((a, b) => {
    const groupA = groupOrder.get(a.backendType) ?? Number.MAX_SAFE_INTEGER
    const groupB = groupOrder.get(b.backendType) ?? Number.MAX_SAFE_INTEGER

    if (groupA !== groupB) {
      return groupA - groupB
    }

    const weight = cosmeticRarityWeight(b.rarity) - cosmeticRarityWeight(a.rarity)

    if (weight !== 0) {
      return weight
    }

    const addedA = a.added ? Date.parse(a.added) : 0
    const addedB = b.added ? Date.parse(b.added) : 0

    if (addedA !== addedB) {
      return addedB - addedA
    }

    return a.name.localeCompare(b.name)
  })
}

export type LockerCardLayout = {
  columns: number
  rows: number
  tileSize: number
  gap: number
  padding: number
  headerHeight: number
  footerHeight: number
  width: number
  height: number
  /** Multiplier for every font size and margin in the chrome. */
  scale: number
}

function measure(count: number, columns: number, tileSize: number) {
  const rows = Math.max(1, Math.ceil(count / columns))
  const width =
    canvasPadding * 2 + columns * tileSize + (columns - 1) * tileGap
  const gridHeight = rows * tileSize + (rows - 1) * tileGap
  const scale = Math.min(4, Math.max(1, width / 1600))
  const headerHeight = Math.round(88 * scale)
  const footerHeight = Math.round(72 * scale)

  return {
    rows,
    width,
    scale,
    headerHeight,
    footerHeight,
    height:
      canvasPadding * 2 + headerHeight + gridHeight + footerHeight,
  }
}

/**
 * How many columns, how big a tile, how tall the whole thing.
 *
 * Columns come from the target aspect ratio; the tile then shrinks — never
 * the column count — until the canvas fits `maxCanvasDimension`. Shrinking
 * columns instead would turn a 5,000-item locker into a tall ribbon.
 */
export function planLockerCard(count: number): LockerCardLayout {
  const items = Math.max(1, count)
  const columns = Math.max(1, Math.round(Math.sqrt(items * targetAspectRatio)))

  let tileSize = baseTileSize
  let box = measure(items, columns, tileSize)

  while (
    tileSize > minTileSize &&
    (box.width > maxCanvasDimension || box.height > maxCanvasDimension)
  ) {
    const overflow = Math.max(
      box.width / maxCanvasDimension,
      box.height / maxCanvasDimension
    )

    tileSize = Math.max(
      minTileSize,
      Math.min(tileSize - 1, Math.floor(tileSize / overflow))
    )
    box = measure(items, columns, tileSize)
  }

  return {
    columns,
    rows: box.rows,
    tileSize,
    gap: tileGap,
    padding: canvasPadding,
    headerHeight: box.headerHeight,
    footerHeight: box.footerHeight,
    width: box.width,
    height: box.height,
    scale: box.scale,
  }
}

export function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * SVG has no text metrics, so a label is fitted by counting characters
 * against an average glyph width. Deliberately pessimistic: a name clipped
 * with an ellipsis reads fine, a name spilling past the tile does not.
 */
export function fitLabel(name: string, maxWidth: number, fontSize: number) {
  const glyphWidth = fontSize * 0.55
  const maxChars = Math.max(3, Math.floor(maxWidth / glyphWidth))

  return name.length <= maxChars
    ? name
    : `${name.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`
}

const fontStack = 'Segoe UI, Arial, Helvetica, DejaVu Sans, sans-serif'

function tileBackgroundSvg(size: number, colors: [string, string]) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      '<defs>' +
      '<radialGradient id="g" cx="50%" cy="38%" r="78%">' +
      `<stop offset="0%" stop-color="${colors[0]}"/>` +
      `<stop offset="100%" stop-color="${colors[1]}"/>` +
      '</radialGradient>' +
      '</defs>' +
      `<rect width="${size}" height="${size}" fill="url(#g)"/>` +
      '</svg>'
  )
}

/** The scrim and the name — everything that sits on top of the artwork. */
function tileLabelSvg(size: number, name: string, accent: string | null) {
  const bandHeight = Math.max(18, Math.round(size * 0.24))
  const fontSize = Math.max(8, Math.round(size * 0.115))
  const label = escapeXml(fitLabel(name, size - 10, fontSize))

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      '<defs>' +
      '<linearGradient id="s" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#000000" stop-opacity="0"/>' +
      '<stop offset="100%" stop-color="#000000" stop-opacity="0.82"/>' +
      '</linearGradient>' +
      '</defs>' +
      `<rect x="0" y="${size - bandHeight}" width="${size}" height="${bandHeight}" fill="url(#s)"/>` +
      (accent
        ? `<rect x="0" y="${size - 3}" width="${size}" height="3" fill="${accent}"/>`
        : '') +
      `<text x="${size / 2}" y="${size - Math.round(bandHeight * 0.28)}" ` +
      `text-anchor="middle" font-family="${fontStack}" font-size="${fontSize}" ` +
      'font-weight="600" fill="#ffffff">' +
      label +
      '</text>' +
      '</svg>'
  )
}

/** A banner colour has no art, so the swatch *is* the tile. */
function swatchSvg(size: number, color: string) {
  const inset = Math.round(size * 0.22)

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<rect x="${inset}" y="${inset}" width="${size - inset * 2}" height="${size - inset * 2}" ` +
      `rx="${Math.round(size * 0.08)}" fill="${color}" stroke="#ffffff" stroke-opacity="0.35" stroke-width="2"/>` +
      '</svg>'
  )
}

function chromeSvg(
  layout: LockerCardLayout,
  { title, subtitle, footnote }: {
    title: string
    subtitle: string
    footnote: string
  }
) {
  const margin = layout.padding + Math.round(8 * layout.scale)
  const titleSize = Math.round(34 * layout.scale)
  const subtitleSize = Math.round(19 * layout.scale)
  const footnoteSize = Math.round(18 * layout.scale)
  const titleY = layout.padding + Math.round(42 * layout.scale)
  const footnoteY = layout.height - layout.padding - Math.round(22 * layout.scale)

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}">` +
      `<text x="${margin}" y="${titleY}" font-family="${fontStack}" ` +
      `font-size="${titleSize}" font-weight="700" fill="#ffffff">${escapeXml(title)}</text>` +
      `<text x="${margin}" y="${titleY + Math.round(28 * layout.scale)}" font-family="${fontStack}" ` +
      `font-size="${subtitleSize}" fill="#9aa4b2">${escapeXml(subtitle)}</text>` +
      `<text x="${margin}" y="${footnoteY}" font-family="${fontStack}" ` +
      `font-size="${footnoteSize}" fill="#6b7480">${escapeXml(footnote)}</text>` +
      '</svg>'
  )
}

/** Enough parallelism to saturate the link, few enough to stay a good citizen. */
const downloadConcurrency = 16
const downloadTimeoutMs = 15_000

async function downloadArt(url: string) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(downloadTimeoutMs),
    })

    if (!response.ok) {
      return null
    }

    return Buffer.from(await response.arrayBuffer())
  } catch {
    /*
     * One dead image URL must not fail a 5,000-item card; the tile just
     * renders as its rarity plate with the name on it.
     */
    return null
  }
}

async function mapWithLimit<Item, Result>(
  items: Array<Item>,
  limit: number,
  worker: (item: Item, index: number) => Promise<Result>
) {
  const results = new Array<Result>(items.length)
  let cursor = 0

  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      for (;;) {
        const index = cursor++

        if (index >= items.length) {
          return
        }

        results[index] = await worker(items[index], index)
      }
    }
  )

  await Promise.all(runners)

  return results
}

export type LockerCardResult = {
  filePath: string
  fileName: string
  count: number
  width: number
  height: number
  /** A downscaled copy the renderer can show without reading the file. */
  previewDataUrl: string
  sizeBytes: number
}

/**
 * Renders the card and writes it next to the app's other exports.
 *
 * `onProgress` is called as tiles complete — a full locker is thousands of
 * image downloads, which is long enough that a silent spinner is not honest
 * about what is happening.
 */
export async function renderLockerCard({
  cosmetics,
  directory,
  displayName,
  onProgress,
  subtitle,
}: {
  cosmetics: Array<CosmeticMeta>
  directory: string
  displayName: string
  onProgress?: (done: number, total: number) => void
  subtitle: string
}): Promise<LockerCardResult> {
  if (cosmetics.length === 0) {
    throw new Error('Nothing to draw')
  }

  const layout = planLockerCard(cosmetics.length)
  const { tileSize } = layout

  const backgrounds = new Map<string, Buffer>()
  const artCache = new Map<string, Buffer | null>()

  const backgroundFor = (cosmetic: CosmeticMeta) => {
    const colors = cosmeticTileColors(cosmetic)
    const key = colors.join('|')
    const cached = backgrounds.get(key)

    if (cached) {
      return cached
    }

    const created = tileBackgroundSvg(tileSize, colors)

    backgrounds.set(key, created)

    return created
  }

  let done = 0

  const tiles = await mapWithLimit(
    cosmetics,
    downloadConcurrency,
    async (cosmetic) => {
      const overlays: Array<sharp.OverlayOptions> = []

      if (cosmetic.color) {
        overlays.push({ input: swatchSvg(tileSize, cosmetic.color), top: 0, left: 0 })
      } else if (cosmetic.imageUrl) {
        let art = artCache.get(cosmetic.imageUrl)

        if (art === undefined) {
          art = await downloadArt(cosmetic.imageUrl)
          artCache.set(cosmetic.imageUrl, art)
        }

        if (art) {
          try {
            overlays.push({
              input: await sharp(art)
                .resize(tileSize, tileSize, {
                  fit: 'contain',
                  background: { r: 0, g: 0, b: 0, alpha: 0 },
                })
                .ensureAlpha()
                .png()
                .toBuffer(),
              top: 0,
              left: 0,
            })
          } catch (error) {
            RuntimeLog.error('caught:core/locker-card.ts', error)
          }
        }
      }

      overlays.push({
        input: tileLabelSvg(
          tileSize,
          cosmetic.name,
          cosmeticTileColors(cosmetic)[0]
        ),
        top: 0,
        left: 0,
      })

      const tile = await sharp(backgroundFor(cosmetic))
        .composite(overlays)
        .png({ compressionLevel: 0 })
        .toBuffer()

      done += 1
      onProgress?.(done, cosmetics.length)

      return tile
    }
  )

  /*
   * Composited a row at a time. One `composite` call holding every tile of a
   * five-thousand-item locker is the difference between a few hundred
   * megabytes of peak memory and a few gigabytes.
   */
  const stripWidth = layout.width - layout.padding * 2
  const strips: Array<sharp.OverlayOptions> = []

  for (let row = 0; row < layout.rows; row += 1) {
    const rowTiles = tiles.slice(
      row * layout.columns,
      (row + 1) * layout.columns
    )

    if (rowTiles.length === 0) {
      continue
    }

    const strip = await sharp({
      create: {
        width: stripWidth,
        height: tileSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(
        rowTiles.map((input, column) => ({
          input,
          top: 0,
          left: column * (tileSize + layout.gap),
        }))
      )
      .png({ compressionLevel: 0 })
      .toBuffer()

    strips.push({
      input: strip,
      left: layout.padding,
      top:
        layout.padding +
        layout.headerHeight +
        row * (tileSize + layout.gap),
    })
  }

  const stamp = new Date()
  const canvas = await sharp({
    create: {
      width: layout.width,
      height: layout.height,
      channels: 4,
      background: backgroundColor,
    },
  })
    .composite([
      ...strips,
      {
        input: chromeSvg(layout, {
          title: displayName,
          subtitle,
          footnote: `Penny Launcher · ${stamp.toISOString().slice(0, 10)}`,
        }),
        top: 0,
        left: 0,
      },
    ])
    .png({ compressionLevel: 6, adaptiveFiltering: true })
    .toBuffer()

  await mkdir(directory, { recursive: true })

  const fileName = `locker-${displayName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'account'}-${stamp
    .toISOString()
    .slice(0, 19)
    .replace(/[:T]/g, '-')}.png`
  const filePath = path.join(directory, fileName)

  /*
   * `Buffer` *is* a `Uint8Array`, but @types/node 20 predates TypeScript
   * making `Uint8Array` generic, so it models one as
   * `Uint8Array<ArrayBufferLike>` where `writeFile` asks for
   * `Uint8Array<ArrayBuffer>`. The cast is the whole of that difference.
   */
  await writeFile(filePath, canvas as unknown as Uint8Array)

  /*
   * The renderer cannot read `file://` under the app's CSP, and a full-size
   * card is tens of megabytes, so the preview is a deliberately small JPEG
   * inlined as a data URL.
   */
  const preview = await sharp(canvas)
    .resize({ width: Math.min(1280, layout.width), withoutEnlargement: true })
    .flatten({ background: backgroundColor })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer()

  return {
    filePath,
    fileName,
    count: cosmetics.length,
    width: layout.width,
    height: layout.height,
    previewDataUrl: `data:${previewMimeType};base64,${preview.toString('base64')}`,
    sizeBytes: canvas.length,
  }
}
