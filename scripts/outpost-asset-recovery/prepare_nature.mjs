/**
 * Builds `assets/outpost-game/nature/nature.glb` from Quaternius' Stylized
 * Nature MegaKit (CC0). Downloads are not automated here; see the README.
 *
 *   npm i --no-save @gltf-transform/core@4 @gltf-transform/extensions@4 \
 *     @gltf-transform/functions@4 meshoptimizer sharp
 *   node prepare_nature.mjs <megakit-glb-folder> ../../assets/outpost-game/nature/nature.glb
 *
 * Every selected model keeps its own scene. Textures are capped at 512 px,
 * cut-out colours are bled into their transparent surroundings (otherwise
 * distant mipmaps turn canopies black), then re-encoded as WebP, and the
 * geometry is meshopt-compressed.
 */
import { readdir } from 'node:fs/promises'
import path from 'node:path'

import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions'
import { dedup, meshopt, mergeDocuments, prune, simplifyPrimitive, unpartition, weld } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'

const MODELS = [
  'Pine_1', 'Pine_2', 'Pine_3', 'Pine_4', 'Pine_5',
  'Tree_1', 'Tree_2', 'Tree_3', 'Tree_4', 'Tree_5',
  'Dead_Tree_1', 'Dead_Tree_3',
  'Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3',
  'Bush_with_Flowers_1', 'Plant_Big_2', 'Fern_1', 'Plant_1',
  'Grass_Wispy_1', 'Grass_Wispy_2', 'Tall_Grass_1', 'Flower_Group_1',
]
/**
 * Solid parts seen from tens of metres away: trunks and boulders keep their
 * silhouette with a fraction of the triangles. Grass blades tolerate it too; leaf cards are left alone.
 */
const SIMPLIFY = { Bark_DeadTree: 0.3, Bark_NormalTree: 0.2, Grass: 0.45, Rocks: 0.6 }
const MAX_SIZE = 512

/** Pushes opaque colours outwards through transparent texels. */
function bleed(pixels, width, height) {
  const filled = new Uint8Array(width * height)

  for (let index = 0; index < filled.length; index++) filled[index] = pixels[index * 4 + 3] > 16 ? 1 : 0
  for (let pass = 0; pass < 48; pass++) {
    const next = filled.slice()
    let changed = false

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x

        if (filled[index]) continue
        let r = 0, g = 0, b = 0, count = 0

        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy

          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const neighbour = ny * width + nx

          if (!filled[neighbour]) continue
          r += pixels[neighbour * 4]
          g += pixels[neighbour * 4 + 1]
          b += pixels[neighbour * 4 + 2]
          count++
        }
        if (count === 0) continue
        pixels[index * 4] = r / count
        pixels[index * 4 + 1] = g / count
        pixels[index * 4 + 2] = b / count
        next[index] = 1
        changed = true
      }
    }
    filled.set(next)
    if (!changed) break
  }
}

const [source, output] = process.argv.slice(2)

if (!source || !output) {
  console.error('usage: node prepare_nature.mjs <megakit-glb-folder> <output.glb>')
  process.exit(1)
}

await MeshoptDecoder.ready
await MeshoptEncoder.ready
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
const available = new Set(await readdir(source))
const [first, ...rest] = MODELS.map((name) => {
  if (!available.has(`${name}.glb`)) throw new Error(`Missing ${name}.glb in ${source}`)

  return path.join(source, `${name}.glb`)
})
const document = await io.read(first)

for (const file of rest) mergeDocuments(document, await io.read(file))
await document.transform(dedup(), prune(), weld())
await MeshoptSimplifier.ready
for (const mesh of document.getRoot().listMeshes()) {
  for (const primitive of mesh.listPrimitives()) {
    const ratio = SIMPLIFY[primitive.getMaterial()?.getName() ?? '']

    if (ratio) simplifyPrimitive(primitive, { error: 0.02, ratio, simplifier: MeshoptSimplifier })
  }
}

document.createExtension(EXTTextureWebP).setRequired(false)
for (const texture of document.getRoot().listTextures()) {
  const image = sharp(Buffer.from(texture.getImage()))
  const { width = MAX_SIZE, height = MAX_SIZE } = await image.metadata()
  const scale = Math.min(1, MAX_SIZE / Math.max(width, height))
  const { data, info } = await image
    .resize(Math.round(width * scale), Math.round(height * scale))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let hasAlpha = false

  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 250) {
      hasAlpha = true
      break
    }
  }
  if (hasAlpha) bleed(data, info.width, info.height)
  const pipeline = sharp(data, { raw: { channels: 4, height: info.height, width: info.width } })
  const webp = await (hasAlpha ? pipeline : pipeline.removeAlpha())
    .webp({ alphaQuality: 100, quality: 82 })
    .toBuffer()

  texture.setImage(new Uint8Array(webp)).setMimeType('image/webp')
  texture.setURI(texture.getURI().replace(/\.png$/i, '.webp'))
}

await document.transform(unpartition(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
await io.write(output, document)
console.log('Wrote', output)
