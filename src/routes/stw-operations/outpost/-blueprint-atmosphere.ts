import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'

import skyInfo from '../../../../assets/outpost-game/sky/sky.json'
import skyEnvUrl from '../../../../assets/outpost-game/sky/sky-env.hdr?url'
import skyUrl from '../../../../assets/outpost-game/sky/sky.jpg'

/**
 * Presentation layer for the 3D explorer: a physical sky that also lights
 * the scene, animated water, the Storm Shield dome, drifting embers and the
 * cinematic post-processing chain. None of it changes what the save says —
 * it only changes how the reconstruction is lit and framed.
 */

type Track = <T extends { dispose: () => void }>(resource: T) => T

/** Brings the HDRI's absolute radiance into the explorer's exposure range. */
const SKY_GAIN = 0.9

/**
 * The sky is a CC0 Poly Haven HDRI ("Kloofendal 48d partly cloudy, pure
 * sky"), prepared by `scripts/outpost-asset-recovery/prepare_sky.py`: a JPEG
 * of the upper hemisphere for the backdrop, a small HDR for lighting, and
 * the sun direction and horizon colour measured from the image.
 */
export const SUN_DIRECTION = new THREE.Vector3(...(skyInfo.sun as [number, number, number])).normalize()
/** Radiance where the sky meets the sea; fog fades into exactly this. */
export const HORIZON = new THREE.Color().setRGB(
  ...(skyInfo.horizon.map((value) => value * SKY_GAIN) as [number, number, number])
)

/** Objects flagged this way stay out of the ambient-occlusion G-buffer. */
const SKIP_AO = 'skipAO'

const skyVertex = /* glsl */ `
  varying vec3 vDirection;

  void main() {
    vDirection = position;
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position + cameraPosition, 1.0);
    gl_Position = clip.xyww;
  }
`

const skyFragment = /* glsl */ `
  uniform sampler2D uSky;
  uniform float uReady;
  uniform float uScale;
  uniform float uBelow;
  uniform vec3 uHorizon;
  varying vec3 vDirection;

  void main() {
    vec3 direction = normalize(vDirection);
    float elevation = degrees(asin(clamp(direction.y, -1.0, 1.0)));
    vec2 uv = vec2(
      atan(direction.z, direction.x) / 6.28318530718 + 0.5,
      clamp((elevation + uBelow) / (90.0 + uBelow), 0.001, 0.999)
    );
    vec3 sky = pow(texture2D(uSky, uv).rgb, vec3(2.2)) * uScale;
    vec3 color = mix(uHorizon, sky, uReady);
    gl_FragColor = vec4(mix(color, uHorizon, smoothstep(0.05, -0.02, direction.y)), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

/**
 * Adds the cloud dome and bakes the HDR into a prefiltered environment so
 * every standard material picks up sky-tinted light and water reflects it.
 * Both images stream in; until then the dome shows the horizon haze.
 */
export function createSky(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  track: Track,
  onLoad: () => void
) {
  let disposed = false
  const uniforms = {
    uBelow: { value: skyInfo.belowHorizonDegrees },
    uHorizon: { value: HORIZON },
    uReady: { value: 0 },
    uScale: { value: skyInfo.skyScale * SKY_GAIN },
    uSky: { value: null as THREE.Texture | null },
  }
  const dome = new THREE.Mesh(
    track(new THREE.SphereGeometry(100, 64, 32)),
    track(new THREE.ShaderMaterial({
      depthWrite: false,
      fragmentShader: skyFragment,
      side: THREE.BackSide,
      uniforms,
      vertexShader: skyVertex,
    }))
  )

  track({ dispose: () => { disposed = true } })
  dome.frustumCulled = false
  dome.renderOrder = -1
  dome.userData[SKIP_AO] = true
  scene.add(dome)

  const backdrop = track(new THREE.TextureLoader().load(skyUrl, () => {
    if (disposed) return
    uniforms.uReady.value = 1
    onLoad()
  }))

  backdrop.anisotropy = 4
  // The shader decodes gamma itself so the JPEG can hold scaled radiance.
  backdrop.colorSpace = THREE.NoColorSpace
  uniforms.uSky.value = backdrop

  new RGBELoader().load(skyEnvUrl, (hdr) => {
    if (disposed) {
      hdr.dispose()
      return
    }
    hdr.mapping = THREE.EquirectangularReflectionMapping
    const pmrem = new THREE.PMREMGenerator(renderer)
    const environment = track(pmrem.fromEquirectangular(hdr))

    pmrem.dispose()
    hdr.dispose()
    scene.environment = environment.texture
    onLoad()
  })

  return dome
}

// ── Water ────────────────────────────────────────────────────

/** Tileable ripple normals built from summed sine waves. */
function rippleNormalTexture(size = 256) {
  const heights = new Float32Array(size * size)
  const waves = [
    [3, 2, 0.5, 0.2],
    [-2, 5, 0.3, 1.3],
    [7, -3, 0.18, 2.1],
    [-9, -7, 0.1, 0.7],
    [13, 11, 0.06, 4.2],
  ]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let height = 0

      for (const [kx, ky, amplitude, phase] of waves) {
        height += amplitude * Math.sin(((kx * x + ky * y) / size) * Math.PI * 2 + phase)
      }
      heights[y * size + x] = height
    }
  }

  const data = new Uint8Array(size * size * 4)
  const at = (x: number, y: number) => heights[((y + size) % size) * size + ((x + size) % size)]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const normal = new THREE.Vector3(
        (at(x - 1, y) - at(x + 1, y)) * 6,
        (at(x, y - 1) - at(x, y + 1)) * 6,
        1
      ).normalize()
      const index = (y * size + x) * 4

      data[index] = (normal.x * 0.5 + 0.5) * 255
      data[index + 1] = (normal.y * 0.5 + 0.5) * 255
      data[index + 2] = (normal.z * 0.5 + 0.5) * 255
      data[index + 3] = 255
    }
  }

  const texture = new THREE.DataTexture(data, size, size)

  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 8
  texture.needsUpdate = true

  return texture
}

/** World-space UVs so ripples keep one scale on every water surface. */
export function worldWaterUVs(geometry: THREE.BufferGeometry, cellsPerTile = 6) {
  const positions = geometry.getAttribute('position')
  const uvs = new Float32Array(positions.count * 2)

  for (let index = 0; index < positions.count; index++) {
    uvs[index * 2] = positions.getX(index) / cellsPerTile
    uvs[index * 2 + 1] = positions.getZ(index) / cellsPerTile
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))

  return geometry
}

/** Camera distance (build tiles) over which ripples fade to a flat mirror. */
const RIPPLE_FADE_START = 18
const RIPPLE_FADE_END = 70

/**
 * Glassy sea that reflects the baked sky. Two scrolling samples of one
 * ripple map cross each other so the surface never visibly repeats.
 */
export function createWaterMaterial(track: Track) {
  const flow = { value: new THREE.Vector2() }
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x0c4a5e,
    envMapIntensity: 0.85,
    metalness: 0,
    normalMap: track(rippleNormalTexture()),
    normalScale: new THREE.Vector2(0.24, 0.24),
    opacity: 0.93,
    roughness: 0.08,
    sheen: 0.25,
    sheenColor: new THREE.Color(0x7fe0ff),
    specularIntensity: 1,
    transparent: true,
  })

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFlow = flow
    shader.fragmentShader = `uniform vec2 uFlow;\n${shader.fragmentShader}`.replace(
      '#include <normal_fragment_maps>',
      /* glsl */ `
        vec3 mapN = texture2D( normalMap, vNormalMapUv + uFlow ).xyz
          + texture2D( normalMap, vNormalMapUv * 1.61 - uFlow.yx * 0.7 ).xyz - 1.0;
        // A tiling ripple map turns into moiré towards the horizon, so
        // distant water settles into a calm mirror of the sky.
        float rippleFade = 1.0 - smoothstep( ${RIPPLE_FADE_START.toFixed(1)}, ${RIPPLE_FADE_END.toFixed(1)}, length( vViewPosition ) );
        mapN.xy *= normalScale * rippleFade;
        normal = normalize( tbn * mapN );
      `
    )
  }

  return {
    material: track(material),
    /** An opaque deep-water floor so open sea never shows the sky through it. */
    seabed(size: number) {
      const geometry = new THREE.PlaneGeometry(size, size)

      geometry.rotateX(-Math.PI / 2)

      return new THREE.Mesh(
        track(geometry),
        track(new THREE.MeshBasicMaterial({ color: 0x0b3442 }))
      )
    },
    update(time: number) {
      flow.value.set(time * 0.011, time * 0.007)
    },
  }
}

// ── Storm Shield ─────────────────────────────────────────────

const shieldVertex = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  varying vec3 vLocal;

  void main() {
    vLocal = position;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPositionW = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const shieldFragment = /* glsl */ `
  uniform float uTime;
  uniform float uRadius;
  uniform vec3 uCore;
  uniform vec3 uRim;
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  varying vec3 vLocal;

  float hexEdge(vec2 p) {
    vec2 r = vec2(1.0, 1.7320508);
    vec2 h = r * 0.5;
    vec2 a = mod(p, r) - h;
    vec2 b = mod(p - h, r) - h;
    vec2 g = dot(a, a) < dot(b, b) ? a : b;
    vec2 q = abs(g);
    float d = max(dot(q, normalize(r)), q.x);
    return smoothstep(0.42, 0.5, d);
  }

  void main() {
    vec3 view = normalize(cameraPosition - vPositionW);
    float facing = abs(dot(normalize(vNormalW), view));
    float fresnel = pow(1.0 - facing, 2.6);
    vec3 dir = normalize(vLocal);
    vec2 sphereUv = vec2(atan(dir.z, dir.x) * 7.0, asin(clamp(dir.y, -1.0, 1.0)) * 7.0);
    float hex = hexEdge(sphereUv * (uRadius / 7.0));
    float height = vLocal.y / uRadius;
    float sweep = pow(fract(height * 1.6 - uTime * 0.12), 12.0);
    float shimmer = 0.5 + 0.5 * sin(uTime * 1.7 + sphereUv.x * 0.6 + sphereUv.y * 0.9);
    float base = smoothstep(0.18, 0.0, abs(height)) * 0.9;
    float alpha = fresnel * 0.32 + hex * (0.025 + fresnel * 0.12) * shimmer + sweep * 0.05 + base * 0.2;
    vec3 color = mix(uCore, uRim, fresnel) * (1.0 + fresnel * 1.2 + sweep * 1.5 + base);
    gl_FragColor = vec4(color * alpha, 1.0);
  }
`

/**
 * The outpost's Storm Shield as a translucent energy bubble. It is a full
 * sphere so the terrain clips its lower half wherever the ground rises.
 */
export function createStormShield(radius: number, track: Track) {
  const uniforms = {
    uCore: { value: new THREE.Color(0x2c7cff) },
    uRadius: { value: radius },
    uRim: { value: new THREE.Color(0xa77dff) },
    uTime: { value: 0 },
  }
  const mesh = new THREE.Mesh(
    track(new THREE.SphereGeometry(radius, 96, 48)),
    track(new THREE.ShaderMaterial({
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fragmentShader: shieldFragment,
      side: THREE.DoubleSide,
      transparent: true,
      uniforms,
      vertexShader: shieldVertex,
    }))
  )

  mesh.renderOrder = 5
  mesh.userData[SKIP_AO] = true

  return {
    mesh,
    update(time: number) {
      uniforms.uTime.value = time
    },
  }
}

// ── Particles ────────────────────────────────────────────────

const particleVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uRise;
  uniform float uSize;
  uniform float uPixelRatio;
  varying float vLife;
  varying float vSeed;

  void main() {
    float life = fract(uTime * (0.08 + aSeed * 0.07) + aSeed * 13.7);
    vec3 p = position;
    p.y += life * uRise;
    p.x += sin(uTime * 0.9 + aSeed * 40.0) * 0.25 * life;
    p.z += cos(uTime * 0.7 + aSeed * 23.0) * 0.25 * life;
    vLife = life;
    vSeed = aSeed;
    vec4 view = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = uSize * uPixelRatio * (0.6 + aSeed * 0.8) * (1.0 - life * 0.6) / -view.z;
  }
`

const particleFragment = /* glsl */ `
  uniform vec3 uHot;
  uniform vec3 uCool;
  varying float vLife;
  varying float vSeed;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float disc = smoothstep(0.5, 0.0, d);
    float fade = smoothstep(0.0, 0.08, vLife) * smoothstep(1.0, 0.55, vLife);
    vec3 color = mix(uHot, uCool, vLife) * (1.6 + vSeed);
    gl_FragColor = vec4(color * disc * fade, 1.0);
  }
`

/**
 * Additive sparks rising from each emitter — embers over lava, motes of
 * shield energy over the base. Animated entirely on the GPU.
 */
export function createParticles({
  cool,
  count,
  emitters,
  hot,
  pixelRatio,
  rise,
  size,
  spread,
  track,
}: {
  cool: number
  count: number
  /** Scene-space emitter centres. */
  emitters: Array<THREE.Vector3>
  hot: number
  pixelRatio: number
  rise: number
  size: number
  spread: number
  track: Track
}) {
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  let state = 1234567

  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0

    return state / 0x100000000
  }

  for (let index = 0; index < count; index++) {
    const emitter = emitters[index % emitters.length]
    const angle = random() * Math.PI * 2
    const reach = Math.sqrt(random()) * spread

    positions[index * 3] = emitter.x + Math.cos(angle) * reach
    positions[index * 3 + 1] = emitter.y + random() * 0.3
    positions[index * 3 + 2] = emitter.z + Math.sin(angle) * reach
    seeds[index] = random()
  }

  const geometry = track(new THREE.BufferGeometry())

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  geometry.computeBoundingSphere()
  if (geometry.boundingSphere) geometry.boundingSphere.radius += rise

  const uniforms = {
    uCool: { value: new THREE.Color(cool) },
    uHot: { value: new THREE.Color(hot) },
    uPixelRatio: { value: pixelRatio },
    uRise: { value: rise },
    uSize: { value: size },
    uTime: { value: 0 },
  }
  const points = new THREE.Points(
    geometry,
    track(new THREE.ShaderMaterial({
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fragmentShader: particleFragment,
      transparent: true,
      uniforms,
      vertexShader: particleVertex,
    }))
  )

  points.renderOrder = 6

  return {
    points,
    update(time: number) {
      uniforms.uTime.value = time
    },
  }
}

// ── Wind ─────────────────────────────────────────────────────

/**
 * Leaf cards carry canopy-shaped normals. Three.js flips normals on back
 * faces, which darkens every card seen from behind, so keep them as authored.
 */
export function keepFoliageNormals(material: THREE.Material) {
  const previous = material.onBeforeCompile.bind(material)
  const previousKey = material.customProgramCacheKey.bind(material)

  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer)
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      THREE.ShaderChunk.normal_fragment_begin.replace(
        'float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;',
        'float faceDirection = 1.0;'
      )
    )
  }
  material.customProgramCacheKey = () => `${previousKey()}|foliage`
}

// ── Post-processing ──────────────────────────────────────────

const VignetteShader = {
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 centred = vUv - 0.5;
      float vignette = smoothstep(0.85, 0.28, length(centred * vec2(1.1, 1.0)));
      color.rgb *= mix(0.72, 1.0, vignette);
      color.rgb = mix(vec3(dot(color.rgb, vec3(0.299, 0.587, 0.114))), color.rgb, 1.08);
      gl_FragColor = color;
    }
  `,
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
}

/**
 * Multisampled HDR render → ground-truth AO → bloom on anything brighter
 * than white (lava, the shield rim, the sun) → tone map → vignette.
 */
export function createPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera
) {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    samples: renderer.capabilities.isWebGL2 ? 4 : 0,
    type: THREE.HalfFloatType,
  })
  const composer = new EffectComposer(renderer, target)
  const ao = new GTAOPass(scene, camera, 1, 1)
  const hideFromAO = ao.overrideVisibility.bind(ao)

  ao.overrideVisibility = () => {
    hideFromAO()
    scene.traverse((object) => {
      if (object.userData[SKIP_AO]) object.visible = false
    })
  }
  ao.updateGtaoMaterial({ distanceExponent: 1.4, radius: 0.55, samples: 16, scale: 1.1, thickness: 1 })
  ao.blendIntensity = 0.85

  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.5, 0.95)

  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(ao)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())
  composer.addPass(new ShaderPass(VignetteShader))

  return {
    dispose() {
      composer.passes.forEach((pass) => pass.dispose())
      composer.dispose()
    },
    render() {
      composer.render()
    },
    setSize(width: number, height: number) {
      composer.setPixelRatio(renderer.getPixelRatio())
      composer.setSize(width, height)
    },
  }
}
