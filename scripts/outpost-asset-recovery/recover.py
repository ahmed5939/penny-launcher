"""Recover textures and collision hulls using the existing CUE4Parse DLLs.

Runs through Python.NET; never invokes dotnet build or compiles C#.
"""
import argparse
import json
import math
import os
from pathlib import Path
import shutil
import sys
import zipfile
import zlib

TEXTURES = {
    'wood-planks': ('PBW_wood_2_D', False),
    'brick-wall': ('BrickT1_D', False),
    'brick-wall-normal': ('BrickT1_N', True),
    'brick-floor': ('BrickT1_Floor_D', False),
    'brick-floor-normal': ('BrickT1_Floor_N', True),
    'stone-tier3': ('T_BrickL3', False),
    'stone-tier3-normal': ('T_BrickL3_N', True),
}
MESHES = {
    'PBW_B1_RoofC': ('RoofC', 1),
    'PBW_B3_Archway': ('Archway', 3),
    'PBW_B3_BalconyO': ('BalconyO', 3),
    'PBW_B3_BalconyS': ('BalconyS', 3),
    'PBW_B3_DoorS': ('DoorS', 3),
    'PBW_B3_QuarterWalls': ('QuarterWallS', 3),
}


def crc(path):
    value = 0
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            value = zlib.crc32(block, value)
    return value


def stage_archive(archive, cache):
    """Reuse only byte-identical cached packages; retain all dependencies."""
    with zipfile.ZipFile(archive) as source:
        for info in source.infolist():
            target = (cache / info.filename).resolve()
            if not target.is_relative_to(cache.resolve()) or not info.filename.startswith('assets/'):
                raise ValueError(f'Unexpected archive path: {info.filename}')
            if info.is_dir():
                continue
            if target.is_file() and target.stat().st_size == info.file_size and crc(target) == info.CRC:
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with source.open(info) as data, target.open('wb') as output:
                shutil.copyfileobj(data, output, 1024 * 1024)


def make_provider(cache):
    os.environ['DOTNET_ROOT'] = str(cache / 'dotnet')
    from pythonnet import load
    assembly_dir = cache / 'exporter/bin/Debug/net10.0'
    load('coreclr', runtime_config=str(assembly_dir / 'ZoneExporter.runtimeconfig.json'),
         dotnet_root=str(cache / 'dotnet'))
    import clr
    sys.path.append(str(assembly_dir))
    for assembly in ['CUE4Parse', 'ZoneExporter', 'Newtonsoft.Json']:
        clr.AddReference(assembly)
    from CUE4Parse.FileProvider import DefaultFileProvider
    from CUE4Parse.UE4.Versions import EGame, VersionContainer
    from CUE4Parse.MappingsProvider.Usmap import FileUsmapTypeMappingsProvider
    from System.IO import SearchOption
    from System import StringComparer
    from ZoneExporter import GlobalDataBuilder
    provider = DefaultFileProvider(str(cache / 'assets'), SearchOption.AllDirectories,
                                   VersionContainer(EGame.GAME_UE5_6), StringComparer.OrdinalIgnoreCase)
    provider.MappingsContainer = FileUsmapTypeMappingsProvider(str(cache / 'mappings.usmap'))
    provider.Initialize()
    provider.GlobalData = GlobalDataBuilder.Build(provider.MappingsContainer.MappingsForGame.Types.Keys)
    return provider


def decode_texture(texture, normal):
    from PIL import Image
    modes = {'PF_DXT1': ('RGBA', 1, 'DXT1'), 'PF_DXT5': ('RGBA', 3, 'DXT5'),
             'PF_BC5': ('RGB', 5, 'BC5')}
    mode, code, label = modes[str(texture.Format)]
    mip = next(m for m in texture.PlatformData.Mips
               if m.SizeX <= 512 and m.SizeY <= 512
               and m.BulkData is not None and m.BulkData.Data is not None)
    image = Image.frombytes(mode, (mip.SizeX, mip.SizeY), bytes(mip.BulkData.Data),
                            'bcn', (code, label)).convert('RGB')
    if normal:
        # BC5 stores only X/Y. Reconstruct positive Z and convert DirectX's
        # downward green channel to the renderer's OpenGL tangent convention.
        pixels = []
        for red, green, _ in image.get_flattened_data():
            x, y = red / 127.5 - 1, green / 127.5 - 1
            z = math.sqrt(max(0, 1 - x*x - y*y))
            pixels.append((red, 255-green, round((z + 1) * 127.5)))
        image.putdata(pixels)
    return image


def scene_vertex(vertex, transform):
    scale = transform['Scale3D']
    v = [vertex[k] * scale[k] for k in 'XYZ']
    q = transform['Rotation']
    u = [q[k] for k in 'XYZ']
    cross = lambda a, b: [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
    uv = cross(u, v)
    uuv = cross(u, uv)
    v = [v[i] + 2*(q['W']*uv[i]+uuv[i]) + transform['Translation'][k]
         for i, k in enumerate('XYZ')]
    # Preserve the mesh's actor pivot, including edge pivots on roof/floors.
    return [v[1]/512, v[2]/512, -v[0]/512]


def collision_mesh(aggregate):
    positions, indices = [], []
    for convex in aggregate['ConvexElems']:
        vertices = [scene_vertex(v, convex['Transform']) for v in convex['VertexData']]
        source_indices = convex['IndexData']
        if not vertices or not source_indices or len(source_indices) % 3:
            raise ValueError('Collision hull has no complete triangle data')
        centre = [sum(v[i] for v in vertices)/len(vertices) for i in range(3)]
        offset = len(positions)//3
        for start in range(0, len(source_indices), 3):
            a, b, c = source_indices[start:start+3]
            va, vb, vc = vertices[a], vertices[b], vertices[c]
            ab, ac = [vb[i]-va[i] for i in range(3)], [vc[i]-va[i] for i in range(3)]
            normal = [ab[1]*ac[2]-ab[2]*ac[1], ab[2]*ac[0]-ab[0]*ac[2], ab[0]*ac[1]-ab[1]*ac[0]]
            if sum(normal[i]*(va[i]-centre[i]) for i in range(3)) < 0:
                b, c = c, b
            indices.extend([offset+a, offset+b, offset+c])
        positions.extend(round(value, 6) for v in vertices for value in v)
    if not indices:
        raise ValueError('No collision geometry recovered')
    return {'positions': positions, 'indices': indices}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--cache-root', type=Path, default=Path.home()/'.cache/penny-fn-assets')
    args = parser.parse_args()
    print('Verifying cached packages against archive CRCs…', flush=True)
    stage_archive(args.archive, args.cache_root)
    provider = make_provider(args.cache_root)
    from Newtonsoft.Json import JsonConvert
    args.output.mkdir(parents=True, exist_ok=True)
    package_keys = {Path(str(key)).stem: str(key) for key in provider.Files.Keys
                    if '/packages/pbw/' in str(key).lower() and str(key).endswith('.uasset')}
    manifest = {'archive': args.archive.name, 'geometrySource': 'collision-hulls',
                'textureResolutionLimit': 512, 'textures': {}, 'meshes': {}}
    meshes = {}
    for output, (name, normal) in TEXTURES.items():
        key = package_keys[name]
        texture = next(e for e in provider.LoadPackage(key).GetExports() if hasattr(e, 'PlatformData'))
        image = decode_texture(texture, normal)
        # The tier-3 material is an atlas. Retain its top masonry strip;
        # the other regions contain trim/door parts with unrelated UVs.
        region = [0, 0, 512, 156] if output.startswith('stone-tier3') else None
        if region:
            image = image.crop(region)
        image.save(args.output / (output+'.png'), optimize=True)
        manifest['textures'][output] = {'package': key, 'format': str(texture.Format),
                                       'size': list(image.size), 'normal': normal, 'atlasRegion': region}
        print('Decoded', output, flush=True)
    for name, (shape, tier) in MESHES.items():
        key = package_keys[name]
        body = next(e for e in provider.LoadPackage(key).GetExports()
                    if hasattr(e, 'AggGeom') and e.AggGeom is not None)
        mesh = collision_mesh(json.loads(str(JsonConvert.SerializeObject(body.AggGeom))))
        entry_key = f'1:{tier}:{shape.lower()}'
        meshes[entry_key] = mesh
        manifest['meshes'][entry_key] = {'package': key, 'vertices': len(mesh['positions'])//3,
                                         'triangles': len(mesh['indices'])//3}
        print('Recovered collision hulls:', shape, 'tier', tier, flush=True)
    (args.output/'build-collision.json').write_text(json.dumps(meshes, separators=(',', ':'))+'\n')
    (args.output/'provenance.json').write_text(json.dumps(manifest, indent=2)+'\n')


if __name__ == '__main__':
    main()
