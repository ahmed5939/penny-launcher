/**
 * Meshopt-compresses a GLB written by the Python extractors and re-encodes
 * any embedded textures as WebP.
 *   node compress_glb.mjs <in.glb> <out.glb> [--skinned]
 * `--skinned` keeps positions as floats: three.js ignores the dequantizing
 * node transform on skinned meshes, which would blow the character up.
 * Needs @gltf-transform/core, /extensions, /functions, meshoptimizer and sharp.
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions'
import { dedup, meshopt, prune, quantize, reorder, textureCompress } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import sharp from 'sharp'

const [input, output] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
const skinned = process.argv.includes('--skinned')

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
  ...(skinned
    ? [
        reorder({ encoder: MeshoptEncoder, target: 'size' }),
        quantize({ pattern: /^(NORMAL|TEXCOORD|JOINTS|WEIGHTS)(_\d+)?$/ }),
      ]
    : [meshopt({ encoder: MeshoptEncoder, level: 'medium' })])
)
if (skinned) {
  document.createExtension(EXTMeshoptCompression).setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })
}
await io.write(output, document)
console.log('Wrote', output)
