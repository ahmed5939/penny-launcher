/**
 * Meshopt-compresses a GLB written by the Python extractors and re-encodes
 * any embedded textures as WebP.
 *   node compress_glb.mjs <in.glb> <out.glb>
 * Needs @gltf-transform/core, /extensions, /functions, meshoptimizer and sharp.
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, meshopt, prune, textureCompress } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import sharp from 'sharp'

const [input, output] = process.argv.slice(2)

await MeshoptDecoder.ready
await MeshoptEncoder.ready
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
const document = await io.read(input)

await document.transform(
  dedup(),
  prune(),
  textureCompress({ encoder: sharp, quality: 84, resize: [512, 512], targetFormat: 'webp' }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' })
)
await io.write(output, document)
console.log('Wrote', output)
