"""Export a Save the World hero as a skinned glTF (body + head + backpack).

    ~/.cache/penny-fn-assets/python-env/bin/python extract_character.py \\
      --cache-root ~/.cache/penny-fn-assets-42 --output /tmp/penny.glb

Defaults to Power B.A.S.E. Penny (CID_Constructor_008_FoundersF). Geometry
and skin weights come from ue_skeletal.py; bones and the bind pose from the
mesh's ReferenceSkeleton (which CUE4Parse reads fine). Body and head have
separate skeletons that share bone names, so they merge into one rig.
Everything is converted to the explorer's scene space (Y up, 1 unit = one
512 uu build tile). Animations are not included: the cooked archive holds
none for heroes, so the explorer retargets its own clips onto this rig.
"""
import argparse
import io
import json
import math
import struct
from pathlib import Path

import numpy as np

from extract_build_pieces import TexturedMeshExporter
from ue_skeletal import read_skeletal_lod

PARTS = [
    # (mesh package path suffix, material overrides by slot, attach bone)
    ('Bodies/F_LRG_Constructor_01/Mesh/SK_F_LRG_Constructor_01.uasset', {0: 'F_LRG_Constructor_TV16'}, None),
    # The TV16 hair material and the backpack material share their package
    # names with a texture / the mesh, so their textures are named directly.
    ('Heads/F_LRG_CAU_Penny_Head_01/Mesh/F_LRG_CAU_Penny_Head_01.uasset',
     {0: {'Diffuse': 'Textures/TV16/F_LRG_Constructor_Hair_TV16', 'Normals': 'F_LRG_Constructor_Hair_01_N'}}, None),
    # The part asks for the `backpack_BR` socket, which lives on a skeleton
    # asset the archive doesn't ship. Backpack meshes are authored upright in
    # character space around the upper back, so they hang from spine_05's
    # position (not its rotated axes) and ride on that bone.
    ('FORT_Backpacks/Mesh/Female_Constructor_08.uasset',
     {0: {'Diffuse': 'Backpack_Female_Constructor_08_d', 'Normals': 'Backpack_Female_Constructor_08_n'}}, 'spine_05'),
]
# Unreal (X forward, Y right, Z up, cm) → scene (Y up, tiles).
BASIS = np.array([[0, 1, 0], [0, 0, 1], [-1, 0, 0]], dtype=float)
SCALE = 1 / 512


def quat_matrix(x, y, z, w):
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])


def matrix_quat(m):
    trace = m[0, 0] + m[1, 1] + m[2, 2]
    if trace > 0:
        s = 0.5 / math.sqrt(trace + 1)
        return [(m[2, 1] - m[1, 2]) * s, (m[0, 2] - m[2, 0]) * s, (m[1, 0] - m[0, 1]) * s, 0.25 / s]
    if m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = 2 * math.sqrt(1 + m[0, 0] - m[1, 1] - m[2, 2])
        return [0.25 * s, (m[0, 1] + m[1, 0]) / s, (m[0, 2] + m[2, 0]) / s, (m[2, 1] - m[1, 2]) / s]
    if m[1, 1] > m[2, 2]:
        s = 2 * math.sqrt(1 + m[1, 1] - m[0, 0] - m[2, 2])
        return [(m[0, 1] + m[1, 0]) / s, 0.25 * s, (m[1, 2] + m[2, 1]) / s, (m[0, 2] - m[2, 0]) / s]
    s = 2 * math.sqrt(1 + m[2, 2] - m[0, 0] - m[1, 1])
    return [(m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s, 0.25 * s, (m[1, 0] - m[0, 1]) / s]


def skeleton(mesh_export):
    """[(name, parent index, 4×4 local Unreal transform)]."""
    reference = mesh_export.ReferenceSkeleton
    info, pose = reference.FinalRefBoneInfo, reference.FinalRefBonePose
    bones = []
    for i in range(info.Length):
        t = pose[i]
        local = np.eye(4)
        local[:3, :3] = quat_matrix(t.Rotation.X, t.Rotation.Y, t.Rotation.Z, t.Rotation.W) @ np.diag(
            [t.Scale3D.X, t.Scale3D.Y, t.Scale3D.Z])
        local[:3, 3] = [t.Translation.X, t.Translation.Y, t.Translation.Z]
        bones.append((str(info[i].Name), int(info[i].ParentIndex), local))
    return bones


def to_scene_matrix(unreal):
    conversion = np.eye(4)
    conversion[:3, :3] = BASIS * SCALE
    return conversion @ unreal @ np.linalg.inv(conversion)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    exporter = TexturedMeshExporter(args.cache_root)

    names, parents, globals_ue = [], [], []
    index_of = {}
    parts = []
    for suffix, overrides, attach in PARTS:
        key = next(k for k in exporter.keys if k.endswith(suffix))
        stem = Path(suffix).stem
        package = exporter.provider.LoadPackage(key)
        mesh_export = next(e for e in package.GetExports() if e.GetType().Name == 'USkeletalMesh')
        bones = skeleton(mesh_export)
        local_globals = []
        remap = []
        socket = np.eye(4)
        if attach:
            socket[:3, 3] = globals_ue[index_of[attach]][:3, 3]
        for name, parent, local in bones:
            if parent < 0 and attach:
                # The accessory's root is its socket: skin it to that bone.
                local_globals.append(socket @ local)
                remap.append(index_of[attach])
                continue
            parent_global = local_globals[parent] if parent >= 0 else np.eye(4)
            world = parent_global @ local
            local_globals.append(world)
            if name not in index_of:
                index_of[name] = len(names)
                names.append(name)
                parents.append(remap[parent] if parent >= 0 else (index_of[attach] if attach else -1))
                globals_ue.append(world)
            remap.append(index_of[name])
        lod = read_skeletal_lod(str(exporter.cache_root / key))
        slot_materials = exporter.slot_materials_skeletal(package, mesh_export)
        # Accessories are authored relative to their socket bone.
        positions = lod['positions']
        if attach:
            positions = (np.c_[positions, np.ones(len(positions))] @ socket.T)[:, :3]
        joints = np.array(remap, np.uint16)[lod['joints']]
        weights = lod['weights']
        # three.js skins four influences per vertex: keep the strongest.
        order = np.argsort(-weights, axis=1)[:, :4]
        joints = np.take_along_axis(joints, order, 1)
        weights = np.take_along_axis(weights, order, 1)
        weights /= np.maximum(weights.sum(1, keepdims=True), 1e-6)
        sections = []
        for section in lod['sections']:
            override = overrides.get(section['material'])
            if isinstance(override, dict):
                textures = {}
                for param, texture in override.items():
                    # A path suffix picks one of several same-named packages.
                    match = next((k for k in exporter.keys if k.endswith(f'/{texture}.uasset')), None)
                    if '/' in texture and match:
                        exporter.by_stem[match] = match
                        textures[param] = match
                    else:
                        textures[param] = texture
                sections.append({**section, 'textures': textures, 'slot': f'{stem}_{section["material"]}'})
                continue
            material = override or (
                slot_materials[section['material']] if section['material'] < len(slot_materials) else None)
            sections.append({**section, 'textures': exporter.material_textures(material) if material else {},
                             'slot': material})
        parts.append({'name': stem, 'positions': positions, 'normals': lod['normals'], 'uvs': lod['uvs'],
                      'indices': lod['indices'], 'joints': joints, 'weights': weights, 'sections': sections})

    scene_globals = [to_scene_matrix(g) for g in globals_ue]
    write_skinned_glb(args.output, names, parents, scene_globals, parts, exporter)
    print(json.dumps({'bones': len(names), 'parts': [(p['name'], len(p['positions'])) for p in parts],
                      'materials': [[s['slot'], sorted(k for k, v in s['textures'].items() if v and not k.startswith('@'))]
                                    for p in parts for s in p['sections']]}), flush=True)


def write_skinned_glb(path, names, parents, scene_globals, parts, exporter):
    chunks, views, accessors, materials, textures, images = [], [], [], [], [], []
    offset = 0
    image_index, material_index = {}, {}

    def view(data, target=None):
        nonlocal offset
        pad = (-len(data)) % 4
        views.append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(data), **({'target': target} if target else {})})
        chunks.append(data + b'\0' * pad)
        offset += len(data) + pad
        return len(views) - 1

    def accessor(array, component, kind, target=None, bounds=False):
        entry = {'bufferView': view(np.ascontiguousarray(array).tobytes(), target), 'componentType': component,
                 'count': len(array), 'type': kind}
        if bounds:
            entry['min'], entry['max'] = array.min(0).tolist(), array.max(0).tolist()
        accessors.append(entry)
        return len(accessors) - 1

    def texture_for(name, kind):
        if (name, kind) not in image_index:
            data, mime = exporter.image(name, kind)
            images.append({'bufferView': view(data), 'mimeType': mime, 'name': f'{name}:{kind}'})
            textures.append({'source': len(images) - 1})
            image_index[(name, kind)] = len(textures) - 1
        return image_index[(name, kind)]

    def material_for(found, name):
        diffuse = found.get('Diffuse')
        normal = found.get('Normals') or found.get('NormalMap') or found.get('Normal')
        key = (diffuse, normal)
        if key not in material_index:
            material = {'name': name or 'untextured',
                        'pbrMetallicRoughness': {'metallicFactor': 0, 'roughnessFactor': 0.75}}
            if diffuse:
                material['pbrMetallicRoughness']['baseColorTexture'] = {'index': texture_for(diffuse, 'color')}
            if normal:
                material['normalTexture'] = {'index': texture_for(normal, 'normal')}
            materials.append(material)
            material_index[key] = len(materials) - 1
        return material_index[key]

    nodes = []
    # Bone nodes: local transforms from scene-space globals.
    for i, name in enumerate(names):
        parent_global = scene_globals[parents[i]] if parents[i] >= 0 else np.eye(4)
        local = np.linalg.inv(parent_global) @ scene_globals[i]
        rotation = local[:3, :3]
        scale = np.linalg.norm(rotation, axis=0)
        nodes.append({'name': name, 'translation': local[:3, 3].tolist(),
                      'rotation': matrix_quat(rotation / scale), 'scale': scale.tolist()})
    for i, parent in enumerate(parents):
        if parent >= 0:
            nodes[parent].setdefault('children', []).append(i)
    roots = [i for i, parent in enumerate(parents) if parent < 0]
    inverse_bind = np.array([np.linalg.inv(g).T.reshape(-1) for g in scene_globals], np.float32)
    skin = {'joints': list(range(len(names))), 'inverseBindMatrices': accessor(inverse_bind, 5126, 'MAT4'),
            'skeleton': roots[0]}

    meshes = []
    for part in parts:
        p = part['positions']
        positions = np.stack([p[:, 1], p[:, 2], -p[:, 0]], 1).astype(np.float32) * SCALE
        n = part['normals']
        normals = np.stack([n[:, 1], n[:, 2], -n[:, 0]], 1)
        normals = (normals / np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-6)).astype(np.float32)
        attributes = {
            'POSITION': accessor(positions, 5126, 'VEC3', 34962, True),
            'NORMAL': accessor(normals, 5126, 'VEC3', 34962),
            'TEXCOORD_0': accessor(part['uvs'].astype(np.float32), 5126, 'VEC2', 34962),
            'JOINTS_0': accessor(part['joints'].astype(np.uint16), 5123, 'VEC4', 34962),
            'WEIGHTS_0': accessor(part['weights'].astype(np.float32), 5126, 'VEC4', 34962),
        }
        primitives = []
        for section in part['sections']:
            start = section['first']
            indices = part['indices'][start:start + section['triangles'] * 3].astype(np.uint32)
            primitives.append({'attributes': attributes, 'indices': accessor(indices, 5125, 'SCALAR', 34963),
                               'material': material_for(section['textures'], section['slot'])})
        meshes.append({'name': part['name'], 'primitives': primitives})
        nodes.append({'name': part['name'], 'mesh': len(meshes) - 1, 'skin': 0})
        roots.append(len(nodes) - 1)

    document = {'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': roots}], 'nodes': nodes,
                'meshes': meshes, 'skins': [skin], 'materials': materials, 'textures': textures, 'images': images,
                'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': offset}]}
    encoded = json.dumps(document).encode()
    encoded += b' ' * ((-len(encoded)) % 4)
    binary = b''.join(chunks)
    with open(path, 'wb') as output:
        output.write(struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(binary)))
        output.write(struct.pack('<II', len(encoded), 0x4E4F534A) + encoded)
        output.write(struct.pack('<II', len(binary), 0x004E4942) + binary)


if __name__ == '__main__':
    main()
