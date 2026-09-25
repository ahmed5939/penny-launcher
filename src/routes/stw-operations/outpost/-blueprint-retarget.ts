import * as THREE from 'three'

/**
 * Retargets humanoid clips between rigs with different rest poses and bone
 * names (here: the CC0 locomotion rig → a Fortnite hero skeleton).
 *
 * Every frame is transferred as world-space rotation deltas. First each
 * mapped target bone is "re-rested" so it points the way the matching
 * source bone points in its rest pose (T-pose vs Fortnite's A-pose); then the
 * source's rotation away from its rest is applied on top. Bones in between
 * (extra spine segments, twist bones, fingers) keep their rest local pose.
 */

/** Source bone → target bone. */
export type BoneMap = Record<string, string>

export const QUATERNIUS_TO_FORTNITE: BoneMap = {
  Hips: 'pelvis',
  Abdomen: 'spine_01',
  Torso: 'spine_03',
  Neck: 'neck_01',
  Head: 'head',
  'Shoulder.L': 'clavicle_l',
  'UpperArm.L': 'upperarm_l',
  'LowerArm.L': 'lowerarm_l',
  'Palm.L': 'hand_l',
  'Shoulder.R': 'clavicle_r',
  'UpperArm.R': 'upperarm_r',
  'LowerArm.R': 'lowerarm_r',
  'Palm.R': 'hand_r',
  'UpperLeg.L': 'thigh_l',
  'LowerLeg.L': 'calf_l',
  'Foot.L': 'foot_l',
  'UpperLeg.R': 'thigh_r',
  'LowerLeg.R': 'calf_r',
  'Foot.R': 'foot_r',
}

function bonesByName(root: THREE.Object3D) {
  const bones = new Map<string, THREE.Bone>()

  root.traverse((object) => {
    if (object instanceof THREE.Bone && !bones.has(object.name)) bones.set(object.name, object)
  })

  return bones
}

/** First mapped descendant, to know which way a bone points. */
function mappedChild(bone: THREE.Bone, mapped: Set<string>): THREE.Bone | null {
  const queue = [...bone.children]

  while (queue.length) {
    const next = queue.shift()!

    if (next instanceof THREE.Bone && mapped.has(next.name)) return next
    queue.push(...next.children)
  }

  return null
}

function worldPositions(bones: Map<string, THREE.Bone>) {
  const out = new Map<string, THREE.Vector3>()

  bones.forEach((bone, name) => out.set(name, bone.getWorldPosition(new THREE.Vector3())))

  return out
}

function worldQuaternions(bones: Map<string, THREE.Bone>) {
  const out = new Map<string, THREE.Quaternion>()

  bones.forEach((bone, name) => out.set(name, bone.getWorldQuaternion(new THREE.Quaternion())))

  return out
}

/**
 * Bakes `clip` (animating `source`) into a clip for `target`. `facing`
 * rotates the source's world frame onto the target's (both about +Y).
 */
export function retargetClip({
  clip,
  facing,
  map,
  source,
  target,
  fps = 30,
}: {
  clip: THREE.AnimationClip
  facing: THREE.Quaternion
  fps?: number
  map: BoneMap
  source: THREE.Object3D
  target: THREE.Object3D
}) {
  const sourceBones = bonesByName(source)
  const targetBones = bonesByName(target)
  // GLTFLoader sanitizes node names (`UpperArm.L` → `UpperArmL`).
  const clean = (name: string) => THREE.PropertyBinding.sanitizeNodeName(name)

  map = Object.fromEntries(Object.entries(map).map(([s, t]) => [clean(s), clean(t)]))
  const pairs = Object.entries(map).filter(([s, t]) => sourceBones.has(s) && targetBones.has(t))
  const sourceMapped = new Set(pairs.map(([s]) => s))
  const targetMapped = new Set(pairs.map(([, t]) => t))
  const facingInverse = facing.clone().invert()

  // Rest poses (bind pose; SkinnedMesh.pose() restores it).
  source.traverse((o) => { if (o instanceof THREE.SkinnedMesh) o.skeleton.pose() })
  target.traverse((o) => { if (o instanceof THREE.SkinnedMesh) o.skeleton.pose() })
  source.updateMatrixWorld(true)
  target.updateMatrixWorld(true)
  const sourceRestQ = worldQuaternions(sourceBones)
  const sourceRestP = worldPositions(sourceBones)
  const targetRestQ = worldQuaternions(targetBones)
  const targetRestP = worldPositions(targetBones)
  const targetRestLocal = new Map<string, THREE.Quaternion>()

  targetBones.forEach((bone, name) => targetRestLocal.set(name, bone.quaternion.clone()))

  // Re-rest: swing each mapped target bone onto its source bone's direction.
  const rerest = new Map<string, THREE.Quaternion>()

  for (const [s, t] of pairs) {
    const sourceChild = mappedChild(sourceBones.get(s)!, sourceMapped)
    const targetChild = mappedChild(targetBones.get(t)!, targetMapped)
    let swing = new THREE.Quaternion()

    if (sourceChild && targetChild && map[sourceChild.name] === targetChild.name) {
      const from = targetRestP.get(targetChild.name)!.clone().sub(targetRestP.get(t)!).normalize()
      const to = sourceRestP.get(sourceChild.name)!.clone().sub(sourceRestP.get(s)!).applyQuaternion(facing).normalize()

      swing = new THREE.Quaternion().setFromUnitVectors(from, to)
    }
    rerest.set(t, swing.multiply(targetRestQ.get(t)!))
  }

  const sourceHips = sourceBones.get('Hips')
  const targetPelvis = targetBones.get(map.Hips ?? '')
  const heightRatio = sourceHips && targetPelvis
    ? targetRestP.get(targetPelvis.name)!.y / Math.max(sourceRestP.get('Hips')!.y, 1e-6)
    : 1

  const mixer = new THREE.AnimationMixer(source)
  const action = mixer.clipAction(clip)

  action.play()
  const frames = Math.max(2, Math.round(clip.duration * fps) + 1)
  const times: Array<number> = []
  const quaternionTracks = new Map<string, Array<number>>()
  const pelvisPositions: Array<number> = []
  const order: Array<THREE.Bone> = []

  target.traverse((o) => { if (o instanceof THREE.Bone) order.push(o) })

  for (let frame = 0; frame < frames; frame++) {
    const time = (frame / (frames - 1)) * clip.duration

    times.push(time)
    mixer.setTime(time)
    source.updateMatrixWorld(true)
    const sourceNowQ = worldQuaternions(sourceBones)
    const world = new Map<string, THREE.Quaternion>()

    for (const bone of order) {
      const parentWorld = bone.parent instanceof THREE.Bone
        ? world.get(bone.parent.name) ?? bone.parent.getWorldQuaternion(new THREE.Quaternion())
        : bone.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion()
      const pair = pairs.find(([, t]) => t === bone.name)
      let boneWorld: THREE.Quaternion

      if (pair) {
        const [s] = pair
        // Source rotation away from rest, expressed in the target's frame.
        const delta = sourceNowQ.get(s)!.clone().multiply(sourceRestQ.get(s)!.clone().invert())

        delta.premultiply(facing).multiply(facingInverse)
        boneWorld = delta.multiply(rerest.get(bone.name)!)
      } else {
        boneWorld = parentWorld.clone().multiply(targetRestLocal.get(bone.name)!)
      }
      world.set(bone.name, boneWorld)
      if (pair) {
        const local = parentWorld.clone().invert().multiply(boneWorld)
        const track = quaternionTracks.get(bone.name) ?? []

        track.push(local.x, local.y, local.z, local.w)
        quaternionTracks.set(bone.name, track)
      }
    }

    if (sourceHips && targetPelvis) {
      // Vertical bob only; locomotion itself is driven by the controller.
      const lift = (sourceHips.getWorldPosition(new THREE.Vector3()).y - sourceRestP.get('Hips')!.y) * heightRatio
      const parentInverse = targetPelvis.parent!.matrixWorld.clone().invert()
      const rest = targetRestP.get(targetPelvis.name)!.clone()

      rest.y += lift
      rest.applyMatrix4(parentInverse)
      pelvisPositions.push(rest.x, rest.y, rest.z)
    }
  }

  action.stop()
  mixer.uncacheRoot(source)
  const tracks: Array<THREE.KeyframeTrack> = []

  quaternionTracks.forEach((values, name) => tracks.push(new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values)))
  if (targetPelvis && pelvisPositions.length) {
    tracks.push(new THREE.VectorKeyframeTrack(`${targetPelvis.name}.position`, times, pelvisPositions))
  }
  // Leave the target back in its bind pose.
  target.traverse((o) => { if (o instanceof THREE.SkinnedMesh) o.skeleton.pose() })

  return new THREE.AnimationClip(clip.name, clip.duration, tracks)
}
