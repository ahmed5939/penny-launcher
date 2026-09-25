import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'

import { QUATERNIUS_TO_FORTNITE, retargetClip } from './-blueprint-retarget'

import animationsUrl from '../../../../assets/outpost-game/character/character.glb?url'
import pennyUrl from '../../../../assets/outpost-game/character/penny.glb?url'

/**
 * Third-person walk mode, played like the game:
 *
 * - Power B.A.S.E. Penny (extracted from the game, see extract_character.py)
 *   animated with CC0 locomotion clips retargeted onto her Fortnite rig.
 * - Click the view to capture the mouse; moving it turns the camera (Esc
 *   releases it). The camera sits over the right shoulder and pulls in when
 *   terrain or builds come between it and the character.
 * - WASD / arrows move relative to the camera; running is the default,
 *   Shift sprints, Ctrl walks and Space jumps.
 *
 * Anything tagged `userData.walkable` is solid ground and wall. Units are
 * build tiles (512 uu ≈ 5.1 m); speeds follow Fortnite's.
 */

/** Marks a mesh as ground/walls for walk mode. */
export const WALKABLE = 'walkable'

const TILE_METRES = 5.12
const RUN_SPEED = 5.5 / TILE_METRES
const SPRINT_SPEED = 7.9 / TILE_METRES
const WALK_SPEED = 2.2 / TILE_METRES
const ACCELERATION = 14
const JUMP_SPEED = 1.5
const JUMP_BUFFER = 0.15
const COYOTE_TIME = 0.12
const GRAVITY = 4.2
/** Unreal's default max step (45 uu); anything taller blocks. */
const STEP_UP = 0.09
const RADIUS = 0.06
const TURN_RATE = 14
const FALL_LIMIT = 30
const LOOK_SENSITIVITY = 0.0022
const SHOULDER = new THREE.Vector3(0.09, 0, 0)
/** Animation clips were authored for these ground speeds (tiles/s). */
const CLIP_SPEED = { run: 0.95, walk: 0.34 }
/**
 * `Man_Jump` is a standing jump: a crouch, take-off at 0.28 s, the tucked
 * airborne pose around 0.55 s and a landing. Walk mode starts it at take-off,
 * reaches the tucked pose at the apex and holds it until touchdown.
 */
const JUMP_CLIP = { hold: 0.55, takeoff: 0.28 }
/** Seconds of falling (without a jump) before the airborne pose kicks in. */
const FALL_POSE_AFTER = 0.18

type Walker = {
  dispose: () => void
  update: (delta: number) => void
}

type Clips = { idle?: THREE.AnimationAction; jump?: THREE.AnimationAction; run?: THREE.AnimationAction; walk?: THREE.AnimationAction }
type Character = { animations: Array<THREE.AnimationClip>; height: number; model: THREE.Object3D }

let characterPromise: Promise<Character> | null = null

const ARM_BONES = /^(clavicle|upperarm|lowerarm|hand|Shoulder|UpperArm|LowerArm|Palm)/

/**
 * The CC0 jump throws both arms overhead. Keep its tucked legs and body, hold
 * the run's bent arms instead, and drop its vertical lift (physics moves her).
 */
function airborneClip(jump: THREE.AnimationClip, run: THREE.AnimationClip | undefined) {
  const arms = new Map((run?.tracks ?? []).filter((track) => ARM_BONES.test(track.name)).map((track) => [track.name, track]))
  const tracks = jump.tracks.flatMap((track) => {
    if (track.name.endsWith('.position')) return []
    const arm = arms.get(track.name)

    if (!arm) return [track]
    const pose = arm.createInterpolant().evaluate(run!.duration * 0.25)

    return [new THREE.QuaternionKeyframeTrack(track.name, [0], Array.from(pose))]
  })

  return new THREE.AnimationClip(jump.name, jump.duration, tracks)
}

function withAirborneJump(clips: Array<THREE.AnimationClip>) {
  const run = clips.find((clip) => /_Run$/.test(clip.name))

  return clips.map((clip) => (/_Jump$/.test(clip.name) ? airborneClip(clip, run) : clip))
}

/** Penny with retargeted clips; the CC0 rig itself if she fails to load. */
function loadCharacter(): Promise<Character> {
  characterPromise ??= (async () => {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    const source = await loader.loadAsync(animationsUrl)
    const wanted = source.animations.filter((clip) => /_(Idle|Walk|Run|Jump)$/.test(clip.name))

    try {
      const penny = await loader.loadAsync(pennyUrl)
      const box = new THREE.Box3().setFromObject(penny.scene)
      const height = box.max.y - box.min.y
      const facing = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
      const animations = wanted.map((clip) =>
        retargetClip({ clip, facing, map: QUATERNIUS_TO_FORTNITE, source: source.scene, target: penny.scene }))
      // Penny faces +X; turn her so the character root faces +Z.
      const model = new THREE.Group()

      penny.scene.rotation.y = -Math.PI / 2
      penny.scene.position.y = -box.min.y
      model.add(penny.scene)

      return { animations: withAirborneJump(animations), height, model }
    } catch (error) {
      console.error('Walk mode: hero failed to load, using the stand-in character', error)
      const model = new THREE.Group()
      const box = new THREE.Box3()

      source.scene.updateMatrixWorld(true)
      source.scene.traverse((object) => {
        if (object instanceof THREE.SkinnedMesh) {
          object.skeleton.update()
          object.computeBoundingBox()
          box.union(object.boundingBox!.clone().applyMatrix4(object.matrixWorld))
        }
      })
      const height = 0.34
      const scale = height / Math.max(box.max.y - box.min.y, 1e-3)

      source.scene.scale.setScalar(scale)
      source.scene.position.y = -box.min.y * scale
      model.add(source.scene)

      return { animations: withAirborneJump(wanted), height, model }
    }
  })().catch((error) => {
    characterPromise = null
    throw error
  })

  return characterPromise
}

const KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'Space'])

export function createWalker({
  camera,
  controls,
  element,
  onPointerLock,
  onReady,
  scene,
  spawn,
}: {
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  /** The canvas: clicking it captures the mouse. */
  element: HTMLElement
  /** Reports whether the mouse is captured (for the on-screen hint). */
  onPointerLock: (locked: boolean) => void
  onReady: () => void
  scene: THREE.Scene
  /** Scene-space point above where the character should land. */
  spawn: THREE.Vector3
}): Walker {
  let disposed = false
  const root = new THREE.Group()
  const pressed = new Set<string>()
  const velocity = new THREE.Vector3()
  const ray = new THREE.Raycaster()
  const down = new THREE.Vector3(0, -1, 0)
  let grounded = false
  // Game-feel timers: a tap just before landing, or just after running off
  // an edge, still jumps.
  let jumpBuffer = 0
  let coyote = 0
  let airTime = 0
  let mixer: THREE.AnimationMixer | null = null
  const clips: Clips = {}
  let current: THREE.AnimationAction | undefined
  let solids: Array<THREE.Object3D> = []
  let refresh = 0
  let height = 0.34
  let distance = 1.15
  // Start looking the way the orbit camera was facing.
  const initial = new THREE.Vector3().subVectors(controls.target, camera.position)
  let yaw = Math.atan2(-initial.x, -initial.z)
  let pitch = -0.28

  root.position.copy(spawn)
  scene.add(root)
  controls.enabled = false

  const collectSolids = () => {
    solids = []
    scene.traverse((object) => {
      if (object.userData[WALKABLE] && object.visible) solids.push(object)
    })
  }

  const isVisible = (object: THREE.Object3D) => {
    for (let node: THREE.Object3D | null = object; node; node = node.parent) if (!node.visible) return false

    return true
  }

  const firstHit = (origin: THREE.Vector3, direction: THREE.Vector3, far: number) => {
    ray.set(origin, direction)
    ray.far = far

    return ray.intersectObjects(solids, false).find((hit) => isVisible(hit.object)) ?? null
  }

  const groundBelow = (from: THREE.Vector3, reach: number) => firstHit(from, down, reach)?.point.y ?? null

  /** Casts across the body's width at knee and chest height. */
  const blocked = (from: THREE.Vector3, direction: THREE.Vector3, step: number) => {
    const side = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(RADIUS * 0.8)

    for (const lift of [STEP_UP + 0.02, height * 0.45, height * 0.8]) {
      for (const offset of [0, 1, -1]) {
        const origin = from.clone().setY(from.y + lift).addScaledVector(side, offset)

        if (firstHit(origin, direction, step + RADIUS)) return true
      }
    }

    return false
  }

  const play = (next: THREE.AnimationAction | undefined, fade = 0.15) => {
    if (!next || next === current) return
    next.reset().fadeIn(fade).play()
    current?.fadeOut(fade)
    current = next
  }

  const onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null

    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
    if (!KEYS.has(event.code)) return
    event.preventDefault()
    // Space would otherwise "click" whichever toolbar button has focus.
    if (target instanceof HTMLButtonElement) element.focus()
    if (event.type === 'keydown') {
      pressed.add(event.code)
      if (event.code === 'Space' && !event.repeat) jumpBuffer = JUMP_BUFFER
    }
    else pressed.delete(event.code)
  }
  const onBlur = () => pressed.clear()
  const onClick = () => {
    if (document.pointerLockElement !== element) void element.requestPointerLock()
  }
  const onMouseMove = (event: MouseEvent) => {
    if (document.pointerLockElement !== element) return
    yaw -= event.movementX * LOOK_SENSITIVITY
    pitch = THREE.MathUtils.clamp(pitch - event.movementY * LOOK_SENSITIVITY, -1.25, 0.9)
  }
  const onWheel = (event: WheelEvent) => {
    event.preventDefault()
    distance = THREE.MathUtils.clamp(distance * (event.deltaY > 0 ? 1.12 : 0.89), 0.35, 3.5)
  }
  const onLockChange = () => onPointerLock(document.pointerLockElement === element)

  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKey)
  window.addEventListener('blur', onBlur)
  element.addEventListener('click', onClick)
  element.addEventListener('wheel', onWheel, { passive: false })
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('pointerlockchange', onLockChange)

  /** Over-the-shoulder camera that pulls in instead of clipping into walls. */
  const placeCamera = () => {
    const look = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'))
    const pivot = root.position.clone().setY(root.position.y + height * 0.88)
      .add(SHOULDER.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)))
    const back = new THREE.Vector3(0, 0, 1).applyQuaternion(look)
    const hit = firstHit(pivot, back, distance)
    const reach = hit ? Math.max(0.12, hit.distance - 0.06) : distance

    camera.position.copy(pivot).addScaledVector(back, reach)
    camera.quaternion.copy(look)
    // Keep the orbit controls' pivot on the character for when walking ends.
    controls.target.copy(pivot)
  }

  loadCharacter().then(({ animations, height: modelHeight, model: template }) => {
    if (disposed) return
    const model = cloneSkinned(template)

    height = modelHeight
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true
        object.frustumCulled = false
      }
    })
    root.add(model)
    mixer = new THREE.AnimationMixer(model)
    for (const clip of animations) {
      const action = mixer.clipAction(clip)

      if (/_Idle$/.test(clip.name)) clips.idle = action
      else if (/_Walk$/.test(clip.name)) clips.walk = action
      else if (/_Run$/.test(clip.name)) clips.run = action
      else if (/_Jump$/.test(clip.name)) {
        action.setLoop(THREE.LoopOnce, 1)
        action.clampWhenFinished = true
        clips.jump = action
      }
    }
    play(clips.idle, 0)
    collectSolids()
    const ground = groundBelow(spawn.clone().setY(spawn.y + 40), 200)

    if (ground !== null) root.position.y = ground
    // The character faces +Z; start with her back to the camera.
    root.rotation.y = yaw + Math.PI
    placeCamera()
    onReady()
  }).catch((error) => {
    console.error('Walk mode: character failed to load', error)
  })

  return {
    dispose() {
      disposed = true
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('blur', onBlur)
      element.removeEventListener('click', onClick)
      element.removeEventListener('wheel', onWheel)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('pointerlockchange', onLockChange)
      if (document.pointerLockElement === element) document.exitPointerLock()
      onPointerLock(false)
      mixer?.stopAllAction()
      scene.remove(root)
      controls.enabled = true
      controls.update()
    },
    update(delta) {
      if (!mixer) return
      const dt = Math.min(delta, 0.05)

      refresh -= dt
      if (refresh <= 0) {
        // Terrain, pieces and scenery stream in; pick them up as they land.
        collectSolids()
        refresh = 1
      }

      // Camera-relative input on the ground plane.
      const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
      const input = new THREE.Vector3()

      if (pressed.has('KeyW') || pressed.has('ArrowUp')) input.add(forward)
      if (pressed.has('KeyS') || pressed.has('ArrowDown')) input.sub(forward)
      if (pressed.has('KeyD') || pressed.has('ArrowRight')) input.add(right)
      if (pressed.has('KeyA') || pressed.has('ArrowLeft')) input.sub(right)
      const moving = input.lengthSq() > 0
      const sprinting = pressed.has('ShiftLeft') || pressed.has('ShiftRight')
      const walking = pressed.has('ControlLeft') || pressed.has('ControlRight')
      const speed = walking ? WALK_SPEED : sprinting ? SPRINT_SPEED : RUN_SPEED

      if (moving) input.normalize().multiplyScalar(speed)
      // Snappy acceleration, a little less control in the air.
      const blend = 1 - Math.exp(-(grounded ? ACCELERATION : ACCELERATION * 0.35) * dt)

      velocity.x += (input.x - velocity.x) * blend
      velocity.z += (input.z - velocity.z) * blend
      const planar = new THREE.Vector3(velocity.x, 0, velocity.z)
      const planarSpeed = planar.length()

      if (planarSpeed > 1e-4) {
        const step = planarSpeed * dt
        const direction = planar.clone().normalize()
        let moved = false

        // Slide along walls by trying each axis on its own when blocked.
        for (const axis of [direction, new THREE.Vector3(direction.x, 0, 0), new THREE.Vector3(0, 0, direction.z)]) {
          if (axis.lengthSq() < 1e-6) continue
          const along = axis.clone().normalize()
          const length = step * axis.length()

          if (!blocked(root.position, along, length)) {
            root.position.addScaledVector(along, length)
            moved = true
            break
          }
        }
        if (!moved) {
          velocity.x = 0
          velocity.z = 0
        }
      }
      if (moving) {
        const facing = Math.atan2(input.x, input.z)
        const turn = ((facing - root.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI

        root.rotation.y += turn * Math.min(1, TURN_RATE * dt)
      }

      jumpBuffer -= dt
      coyote = grounded ? COYOTE_TIME : coyote - dt
      if (jumpBuffer > 0 && coyote > 0) {
        velocity.y = JUMP_SPEED
        grounded = false
        jumpBuffer = 0
        coyote = 0
        play(clips.jump, 0.08)
        if (clips.jump) {
          clips.jump.time = JUMP_CLIP.takeoff
          clips.jump.timeScale = (JUMP_CLIP.hold - JUMP_CLIP.takeoff) / (JUMP_SPEED / GRAVITY)
        }
      }
      velocity.y -= GRAVITY * dt
      root.position.y += velocity.y * dt

      const probe = STEP_UP + 0.05
      const ground = groundBelow(root.position.clone().setY(root.position.y + probe), probe + Math.max(0.05, -velocity.y * dt))

      if (ground !== null && velocity.y <= 0 && root.position.y <= ground + 0.02) {
        root.position.y = ground
        velocity.y = 0
        grounded = true
      } else if (ground === null) {
        grounded = false
      }
      if (root.position.y < spawn.y - FALL_LIMIT) {
        // Fell off the island: back to the spawn point.
        root.position.copy(spawn)
        velocity.set(0, 0, 0)
      }

      airTime = grounded ? 0 : airTime + dt
      if (!grounded && clips.jump) {
        if (current !== clips.jump && airTime > FALL_POSE_AFTER) {
          // Ran off a ledge: straight into the airborne pose.
          play(clips.jump, 0.2)
          clips.jump.time = JUMP_CLIP.hold
        }
        if (current === clips.jump && clips.jump.time >= JUMP_CLIP.hold) clips.jump.timeScale = 0
      }
      if (grounded) {
        if (planarSpeed < 0.08) {
          play(clips.idle)
        } else if (walking) {
          play(clips.walk)
          if (clips.walk) clips.walk.timeScale = planarSpeed / CLIP_SPEED.walk
        } else {
          play(clips.run)
          if (clips.run) clips.run.timeScale = Math.max(0.6, planarSpeed / CLIP_SPEED.run)
        }
      }
      mixer.update(dt)
      placeCamera()
    },
  }
}
