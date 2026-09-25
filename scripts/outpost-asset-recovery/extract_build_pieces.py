"""Export the player build pieces (wood/brick/metal, tiers 1-3) with textures.

    ~/.cache/penny-fn-assets/python-env/bin/python extract_build_pieces.py \\
      --cache-root ~/.cache/penny-fn-assets-42 --output /tmp/builds.glb

Geometry comes from ue_mesh (full-detail LOD, real UVs); each section's
material slot is resolved to its material instance and that instance's
Diffuse / NormalMap textures by public export hash (loose packages drop the
resolved import table). Meshes are named `<W|B|M><tier>_<Shape>`, e.g.
`W1_Solid`, in the same scene frame as the recovered collision hulls.
Compress afterwards with compress_glb.mjs.
"""
import argparse
import io
import json
import re
import struct
from pathlib import Path

import numpy as np
from PIL import Image

from recover import decode_texture, make_provider
from ue_mesh import read_static_mesh, to_scene

MESH = re.compile(r'/PBW_([WBM])([123])_([A-Za-z]+)\.uasset$')
# Safety net only: with the suffix-stripping lookup every slot in the 42.20
# archive resolves to its material instance (these match what they give).
SLOT_FALLBACK = [
    (r'Brick_lvl3_Door', {'Diffuse': 'T_BrickL3_Door'}),
    (r'Brick_lvl3', {'Diffuse': 'T_BrickL3', 'NormalMap': 'T_BrickL3_N'}),
    (r'Brick_lvl2', {'Diffuse': 'BrickT2_D', 'NormalMap': 'BrickT2_N'}),
    (r'Metal_lvl3', {'Diffuse': 'T_Metal_L3', 'NormalMap': 'T_Metal_L3_N'}),
    (r'Metal_lvl2', {'Diffuse': 'T_PBW_M2_D', 'NormalMap': 'T_PBW_M2_N'}),
    (r'(?i)wood_(lvl|level)3', {'Diffuse': 'T_Wood_L3', 'NormalMap': 'T_Wood_L3_N'}),
    (r'(?i)wood_(lvl|level)2', {'Diffuse': 'PBW_wood_2_D', 'NormalMap': 'PBW_wood_2_N'}),
]


def foliage_textures(found):
    """Normalise environment/foliage parameter names to Diffuse/NormalMap/
    SpecularMasks(+Opacity). Trunk sections of tree materials carry their
    bark in Trunk_* while `Diffuse` there is the shared leaf atlas."""
    found = dict(found)
    if found.get('Trunk_BaseColor'):
        return {'Diffuse': found['Trunk_BaseColor'], 'NormalMap': found.get('Trunk_Normal')}
    found = {k: v for k, v in found.items() if not k.startswith('@')}
    if not found.get('NormalMap'):
        found['NormalMap'] = found.get('Normals') or found.get('Normal')
    mask = found.get('MaskTexture')
    if mask and 'white' not in mask.lower():
        found['Opacity'] = mask
    return found


def bleed_alpha(picture, passes=24):
    """Spread opaque RGB into transparent texels (alpha unchanged)."""
    pixels = np.array(picture, dtype=np.float32)
    filled = pixels[..., 3] > 16
    for _ in range(passes):
        if filled.all():
            break
        total = np.zeros(pixels.shape[:2] + (3,), np.float32)
        count = np.zeros(pixels.shape[:2], np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            shifted = np.roll(filled, (dy, dx), (0, 1))
            total += np.roll(pixels[..., :3], (dy, dx), (0, 1)) * shifted[..., None]
            count += shifted
        grow = ~filled & (count > 0)
        pixels[grow, :3] = total[grow] / count[grow][:, None]
        filled |= grow
    return Image.fromarray(pixels.astype(np.uint8), 'RGBA')


class TexturedMeshExporter:
    """Resolves material slots → textures and packs meshes into one GLB."""

    def __init__(self, cache_root):
        self.cache_root = cache_root.expanduser()
        self.provider = make_provider(cache_root)
        from Newtonsoft.Json import JsonConvert

        self.json = JsonConvert
        self.keys = [str(k) for k in self.provider.Files.Keys]
        self.by_stem = {k.split('/')[-1][:-7]: k for k in self.keys if k.endswith('.uasset')}
        self.by_hash = {}
        for key in self.keys:
            if key.endswith('.uasset') and ('/Textures/' in key or '/Materials/' in key or '/PBW/' in key
                                            or '/Models/' in key or '/Meshes/' in key or 'Trap' in key
                                            or '/Environments/' in key or key.split('/')[-1].startswith(('S_', 'SM_'))
                                            or '/Characters/' in key or '/Accessories/' in key):
                try:
                    package = self.provider.LoadPackage(key)
                    exports = self.field(package, 'ExportMap')
                    for i in range(package.ExportMapLength):
                        if int(exports[i].PublicExportHash):
                            self.by_hash[int(exports[i].PublicExportHash)] = key.split('/')[-1][:-7]
                except Exception:
                    continue
        self.material_cache, self.image_cache = {}, {}
        self.alpha_textures = set()
        # Texture name → replacement PNG (e.g. rebuild_metal_l1.py output).
        self.overrides = {}

    @staticmethod
    def field(obj, name):
        return obj.GetType().GetField(name).GetValue(obj)

    def resolve(self, package, index):
        imports = self.field(package, 'ImportMap')
        hashes = self.field(package, 'ImportedPublicExportHashes')
        entry = imports[-index - 1]
        if not entry.IsPackageImport:
            return None
        return self.by_hash.get(int(hashes[entry.AsPackageImportRef.ImportedPublicExportHashIndex]))

    def material_textures(self, name):
        """Diffuse/NormalMap texture names for a material, following parents."""
        if name in self.material_cache:
            return self.material_cache[name]
        self.material_cache[name] = {}
        # Slot names often carry a numeric suffix the asset lacks
        # (`Metal_lvl2_Static_INST2` → `Metal_lvl2_Static_INST`).
        key = self.by_stem.get(name) or self.by_stem.get(re.sub(r'\d+$', '', name))
        if key is None:
            return {}
        textures, parent = {}, None
        package = self.provider.LoadPackage(key)
        for export in package.GetExports():
            for prop in export.Properties:
                label = str(prop.Name.Text)
                if label == 'Parent' and prop.Tag.GenericValue.IsImport:
                    parent = self.resolve(package, prop.Tag.GenericValue.Index)
                if label == 'VectorParameterValues':
                    for element in prop.Tag.GenericValue.Properties:
                        param, colour = None, None
                        for tag in element.GenericValue.StructType.__implementation__.Properties:
                            tag_name = str(tag.Name.Text)
                            if tag_name == 'ParameterInfo':
                                for inner in tag.Tag.GenericValue.StructType.__implementation__.Properties:
                                    if str(inner.Name.Text) == 'Name':
                                        param = str(inner.Tag.GenericValue)
                            elif tag_name == 'ParameterValue':
                                value = tag.Tag.GenericValue
                                value = value.StructType.__implementation__ if hasattr(value, 'StructType') else value
                                if hasattr(value, 'R'):
                                    colour = (float(value.R), float(value.G), float(value.B))
                        if param in ('Color1_Base', 'Color2_Lit') and colour:
                            textures[f'@{param}'] = colour
                    continue
                if label != 'TextureParameterValues':
                    continue
                for element in prop.Tag.GenericValue.Properties:
                    struct_value = element.GenericValue.StructType.__implementation__
                    param, reference = None, None
                    for tag in struct_value.Properties:
                        tag_name = str(tag.Name.Text)
                        if tag_name == 'ParameterValue':
                            reference = tag.Tag.GenericValue
                        elif tag_name == 'ParameterInfo':
                            for inner in tag.Tag.GenericValue.StructType.__implementation__.Properties:
                                if str(inner.Name.Text) == 'Name':
                                    param = str(inner.Tag.GenericValue)
                    if param and reference is not None and reference.IsImport:
                        textures[param] = self.resolve(package, reference.Index)
        if parent:
            textures = {**self.material_textures(parent), **{k: v for k, v in textures.items() if v}}
        # Foliage materials tint a greyscale atlas with linear-colour params.
        base, lit = textures.get('@Color1_Base'), textures.get('@Color2_Lit')
        if base:
            mix = [(a + b) / 2 for a, b in zip(base, lit or base)]
            textures['Tint'] = mix
        if not textures.get('Diffuse'):
            # Environment materials name their colour map differently.
            colour = next((v for k, v in textures.items() if v and re.search(
                r'(?i)diffuse|base ?colou?r|albedo|^colou?r$|_D$', k)), None)
            if colour:
                textures['Diffuse'] = colour
        self.material_cache[name] = textures
        return textures

    def image(self, name, kind):
        """Encoded texture: kind is 'color', 'normal' or 'mr'.

        'mr' converts Fortnite SpecularMasks (R specular, G metallic,
        B roughness) to glTF metallic-roughness (G roughness, B metallic).
        """
        cache_key = (name, kind)
        if cache_key not in self.image_cache:
            if name in self.overrides and kind == 'color':
                picture = Image.open(self.overrides[name])
            else:
                texture = next(e for e in self.provider.LoadPackage(self.by_stem[name]).GetExports() if hasattr(e, 'PlatformData'))
                picture = decode_texture(texture, kind == 'normal', keep_alpha=kind.startswith('color'))
            if kind.startswith('color+'):
                # Foliage keeps its cut-out in a separate mask texture; use
                # its most varied channel as the colour's alpha.
                mask_texture = next(e for e in self.provider.LoadPackage(self.by_stem[kind[6:]]).GetExports()
                                    if hasattr(e, 'PlatformData'))
                mask = np.array(decode_texture(mask_texture, False).resize(picture.size), dtype=np.float32)
                channel = int(np.argmax(mask.reshape(-1, 3).std(0)))
                picture = picture.convert('RGB')
                picture.putalpha(Image.fromarray(mask[..., channel].astype(np.uint8)))
            buffer = io.BytesIO()
            if kind == 'normal':
                picture.save(buffer, 'PNG', optimize=True)
            elif kind == 'mr':
                _, metallic, roughness = picture.convert('RGB').split()
                Image.merge('RGB', (Image.new('L', picture.size, 255), roughness, metallic)).save(buffer, 'PNG', optimize=True)
            elif picture.mode == 'RGBA' and picture.getchannel('A').getextrema()[0] < 128:
                # Cut-out foliage: keep the alpha for masking, and bleed leaf
                # colours outwards so distant mipmaps do not turn black.
                bleed_alpha(picture).save(buffer, 'PNG', optimize=True)
                self.alpha_textures.add(f'{name}:{kind}')
            else:
                picture.convert('RGB').save(buffer, 'JPEG', quality=88)
            self.image_cache[cache_key] = (buffer.getvalue(), 'image/png' if buffer.getvalue()[:4] == b'\x89PNG' else 'image/jpeg')
        return self.image_cache[cache_key]

    def slot_materials(self, package, mesh_export):
        """Material package per StaticMaterials slot, via export hashes."""
        names = []
        for prop in mesh_export.Properties:
            if str(prop.Name.Text) != 'StaticMaterials':
                continue
            for element in prop.Tag.GenericValue.Properties:
                resolved = None
                for tag in element.GenericValue.StructType.__implementation__.Properties:
                    if str(tag.Name.Text) == 'MaterialInterface':
                        reference = tag.Tag.GenericValue
                        if reference is not None and reference.IsImport:
                            resolved = self.resolve(package, reference.Index)
                names.append(resolved)
        return names

    def slot_materials_skeletal(self, package, mesh_export):
        """Material package per SkeletalMaterials slot (natively serialized)."""
        names = []
        for material in getattr(mesh_export, 'SkeletalMaterials', None) or []:
            reference = material.Material
            resolved = None
            try:
                index = reference.Index if hasattr(reference, 'Index') else reference.ResolvedObject.Index
                if index < 0:
                    resolved = self.resolve(package, index)
            except Exception:
                resolved = None
            if resolved is None:
                try:
                    resolved = str(material.MaterialSlotName.Text)
                except Exception:
                    resolved = None
            names.append(resolved)
        return names

    def mesh(self, key, name, lod_index=0, fallbacks=(), scenery=False):
        """A named, textured mesh entry for write(), or None.

        With `scenery`, impostor cards and unassigned slots (distance LODs
        baked into foliage meshes) are dropped."""
        lod = read_static_mesh(str(self.cache_root / key), lod_index=lod_index)
        if lod is None:
            return None
        package = self.provider.LoadPackage(key)
        mesh_export = next(e for e in package.GetExports() if hasattr(e, 'RenderData'))
        slots = json.loads(str(self.json.SerializeObject(mesh_export))).get('Properties', {}).get('StaticMaterials') or []
        slot_names = [s.get('MaterialSlotName') for s in slots]
        slot_materials = self.slot_materials(package, mesh_export)
        sections = []
        for section in lod['sections']:
            index = section['material']
            slot = slot_names[index] if index < len(slot_names) else None
            # The slot's actual material, resolved by hash, beats its name.
            material = slot_materials[index] if index < len(slot_materials) else None
            found = self.material_textures(material) if material else {}
            if not found.get('Diffuse') and slot:
                found = self.material_textures(slot) or found
            if slot and not found.get('Diffuse'):
                found = next((textures for pattern, textures in fallbacks if re.search(pattern, slot)), found)
            if scenery and (material is None or re.search(r'(?i)impostor', material)):
                continue
            sections.append({**section, 'textures': foliage_textures(found), 'slot': slot})
        if not sections:
            return None
        positions, normals = to_scene(lod)
        return {'name': name, 'positions': positions, 'normals': normals,
                'uvs': lod['uvs'], 'indices': lod['indices'], 'sections': sections}

    def write(self, path, meshes, assemblies=None):
        write_textured_glb(path, meshes, self.image, assemblies, self.alpha_textures)
        return {'meshes': len(meshes), 'textures': sorted(f'{n}:{k}' for n, k in self.image_cache),
                'untextured_slots': sorted({s['slot'] for m in meshes for s in m['sections']
                                            if not s['textures'].get('Diffuse')} - {None})}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--override', action='append', default=[],
                        help='TEXTURE=path.png, e.g. T_Metal_L1=rebuilt.png')
    args = parser.parse_args()
    exporter = TexturedMeshExporter(args.cache_root)
    exporter.overrides = dict(item.split('=', 1) for item in args.override)
    meshes = []
    for key in sorted(exporter.keys):
        match = MESH.search(key)
        if not match:
            continue
        material_letter, tier, shape = match.groups()
        # LOD1 keeps every silhouette detail visible from orbit distance at
        # roughly half LOD0's vertices; the whole set ships with the app.
        entry = exporter.mesh(key, f'{material_letter}{tier}_{shape}', lod_index=1, fallbacks=SLOT_FALLBACK)
        if entry is None:
            print('No geometry:', key, flush=True)
            continue
        meshes.append(entry)
    print(json.dumps(exporter.write(args.output, meshes)), flush=True)


def write_textured_glb(path, meshes, image, assemblies=None, alpha_textures=frozenset()):
    """Pack meshes into a GLB. With `assemblies` (name → [(mesh name,
    column-major 4×4)]) each assembly becomes a parent node whose children
    place shared meshes; otherwise every mesh is its own top-level node."""
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

    def accessor(array, component, kind, target, bounds=False):
        entry = {'bufferView': view(np.ascontiguousarray(array).tobytes(), target), 'componentType': component,
                 'count': len(array), 'type': kind}
        if bounds:
            entry['min'], entry['max'] = array.min(0).tolist(), array.max(0).tolist()
        accessors.append(entry)
        return len(accessors) - 1

    def texture_for(name, kind):
        if (name, kind) not in image_index:
            data, mime = image(name, kind)
            images.append({'bufferView': view(data), 'mimeType': mime, 'name': f'{name}:{kind}'})
            textures.append({'source': len(images) - 1})
            image_index[(name, kind)] = len(textures) - 1
        return image_index[(name, kind)]

    def material_for(found):
        tint = found.get('Tint')
        key = (found.get('Diffuse'), found.get('NormalMap'), found.get('SpecularMasks'), found.get('Opacity'),
               tuple(round(c, 4) for c in tint) if tint else None)
        if key not in material_index:
            material = {'name': key[0] or 'untextured', 'pbrMetallicRoughness': {'metallicFactor': 0, 'roughnessFactor': 0.85}}
            if key[4]:
                # The game multiplies these (linear) over a pale atlas and
                # brightens in its shading; scale so the albedo reads right.
                peak = max(key[4]) or 1
                factor = [min(1.0, c / peak * 0.85) for c in key[4]]
                material['pbrMetallicRoughness']['baseColorFactor'] = [*factor, 1]
            if key[0]:
                colour_kind = f'color+{key[3]}' if key[3] else 'color'
                material['pbrMetallicRoughness']['baseColorTexture'] = {'index': texture_for(key[0], colour_kind)}
                if f'{key[0]}:{colour_kind}' in alpha_textures:
                    material.update({'alphaMode': 'MASK', 'alphaCutoff': 0.4, 'doubleSided': True})
            else:
                material['pbrMetallicRoughness']['baseColorFactor'] = [0.35, 0.36, 0.38, 1]
            if key[1]:
                material['normalTexture'] = {'index': texture_for(key[1], 'normal')}
            if key[2]:
                # Per-texel metalness and roughness from the game's masks.
                material['pbrMetallicRoughness'].update({
                    'metallicFactor': 1, 'roughnessFactor': 1,
                    'metallicRoughnessTexture': {'index': texture_for(key[2], 'mr')},
                })
            materials.append(material)
            material_index[key] = len(materials) - 1
        return material_index[key]

    gl_meshes, nodes = [], []
    for mesh in meshes:
        attributes = {
            'POSITION': accessor(mesh['positions'], 5126, 'VEC3', 34962, True),
            'NORMAL': accessor(mesh['normals'], 5126, 'VEC3', 34962),
            'TEXCOORD_0': accessor(mesh['uvs'].astype(np.float32), 5126, 'VEC2', 34962),
        }
        primitives = []
        for section in mesh['sections']:
            start = section['first']
            indices = mesh['indices'][start:start + section['triangles'] * 3].astype(np.uint32)
            primitives.append({'attributes': attributes, 'indices': accessor(indices, 5125, 'SCALAR', 34963),
                               'material': material_for(section['textures'])})
        gl_meshes.append({'name': mesh['name'], 'primitives': primitives})
        if assemblies is None:
            nodes.append({'name': mesh['name'], 'mesh': len(gl_meshes) - 1})
    roots = list(range(len(nodes)))
    if assemblies is not None:
        mesh_index = {m['name']: i for i, m in enumerate(gl_meshes)}
        roots = []
        for name, parts in assemblies.items():
            children = []
            for part, matrix in parts:
                if part not in mesh_index:
                    continue
                nodes.append({'name': f'{name}:{part}', 'mesh': mesh_index[part], 'matrix': list(matrix)})
                children.append(len(nodes) - 1)
            if children:
                nodes.append({'name': name, 'children': children})
                roots.append(len(nodes) - 1)
    document = {'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': roots}],
                'nodes': nodes, 'meshes': gl_meshes, 'materials': materials, 'textures': textures,
                'images': images, 'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': offset}]}
    encoded = json.dumps(document).encode()
    encoded += b' ' * ((-len(encoded)) % 4)
    binary = b''.join(chunks)
    with open(path, 'wb') as output:
        output.write(struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(binary)))
        output.write(struct.pack('<II', len(encoded), 0x4E4F534A) + encoded)
        output.write(struct.pack('<II', len(binary), 0x004E4942) + binary)


if __name__ == '__main__':
    main()
