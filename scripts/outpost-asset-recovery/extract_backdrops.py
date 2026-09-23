"""Export an outpost's distant scenery from its skybox sublevel.

    ~/.cache/penny-fn-assets/python-env/bin/python extract_backdrops.py \\
      --cache-root ~/.cache/penny-fn-assets-42 --map Skybox_Outpost \\
      --output /tmp/Skybox_Outpost.glb --placements /tmp/Skybox_Outpost.json

The zones stream these levels in (Stonewood: Skybox_Outpost and
Skybox_Outpost_HomeBase; Plankerton and Twine: Skybox_Outpost; Canny Valley:
Zone_Outpost_CannyValley_Skybox). They share the zone's world space, so the
placements are world matrices in scene space (column-major, three.js
`Matrix4.fromArray` order): `[mesh, m0 … m15]`, with attached components
composed through their parent chain. Sky-dome, cloud-hole and fog
cards are skipped; the explorer draws its own sky.
"""
import argparse
import json
import math
import re
from pathlib import Path

import numpy as np

from extract_build_pieces import TexturedMeshExporter

SKIP = re.compile(r'SkyHole|Fog|Cloud|SkyDome|Sky_Sphere|Skysphere', re.I)
MESH_COMPONENTS = ('FortStaticMeshComponent', 'StaticMeshComponent')
# These scenery materials sample their textures directly (no parameters).
FALLBACKS = [
    (r'HB_Center_Command', {'Diffuse': 'T_HB_Center_ComWare_D', 'NormalMap': 'T_HB_Center_ComWare_N'}),
    (r'HexMaps_Grasslands', {'Diffuse': 'T_Fortnite_HexMaps_Grasslands_02_D', 'NormalMap': 'T_Fortnite_HexMaps_Grasslands_N'}),
    (r'HB_Trees', {'Diffuse': 'T_Temperate_Forest_D'}),
]
# Unreal (X forward, Y right, Z up) → scene (Y up); lengths / 512.
BASIS = np.array([[0, 1, 0], [0, 0, 1], [-1, 0, 0]], dtype=float)


def local_matrix(props):
    """4×4 Unreal-space transform (column vectors) of one component."""
    location = props.get('RelativeLocation') or {}
    rotation = props.get('RelativeRotation') or {}
    scale = props.get('RelativeScale3D') or {}
    pitch, yaw, roll = (math.radians(rotation.get(k, 0)) for k in ('Pitch', 'Yaw', 'Roll'))
    sp, cp, sy, cy, sr, cr = math.sin(pitch), math.cos(pitch), math.sin(yaw), math.cos(yaw), math.sin(roll), math.cos(roll)
    # FRotationMatrix rows are the rotated X/Y/Z axes.
    axes = np.array([
        [cp * cy, cp * sy, sp],
        [sr * sp * cy - cr * sy, sr * sp * sy + cr * cy, -sr * cp],
        [-(cr * sp * cy + sr * sy), cy * sr - cr * sp * sy, cr * cp],
    ])
    matrix = np.eye(4)
    matrix[:3, :3] = axes.T @ np.diag([scale.get(k, 1) for k in 'XYZ'])
    matrix[:3, 3] = [location.get(k, 0) for k in 'XYZ']
    return matrix


def scene_matrix(world):
    result = np.eye(4)
    result[:3, :3] = BASIS @ world[:3, :3] @ BASIS.T
    result[:3, 3] = BASIS @ world[:3, 3] / 512
    return result.T.reshape(-1)  # column-major


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-root', type=Path, required=True)
    parser.add_argument('--map', required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--placements', type=Path, required=True)
    parser.add_argument('--lod', type=int, default=1)
    args = parser.parse_args()
    exporter = TexturedMeshExporter(args.cache_root)
    from CUE4Parse.UE4.Objects.UObject import FPackageIndex

    field = exporter.field
    package = exporter.provider.LoadPackage(next(k for k in exporter.keys if k.endswith(f'/{args.map}.umap')))
    imports = field(package, 'ImportMap')
    hashes = field(package, 'ImportedPublicExportHashes')
    placements, skipped = [], 0
    for i in range(package.ExportMapLength):
        try:
            obj = package.ExportsLazy[i].Value
        except Exception:
            continue
        if obj is None or obj.Class is None or str(obj.Class.Name.Text) not in MESH_COMPONENTS:
            continue
        reference = obj.GetOrDefault[FPackageIndex]('StaticMesh')
        if reference is None or not reference.IsImport:
            continue
        imported = imports[-reference.Index - 1]
        if not imported.IsPackageImport:
            continue
        mesh = exporter.by_hash.get(int(hashes[imported.AsPackageImportRef.ImportedPublicExportHashIndex]))
        if mesh is None or SKIP.search(mesh):
            continue
        props = json.loads(str(exporter.json.SerializeObject(obj))).get('Properties', {})
        if props.get('bVisible') is False or props.get('bHiddenInGame') is True:
            continue
        world, node, depth = local_matrix(props), obj, 0
        while depth < 16:
            parent = node.GetOrDefault[FPackageIndex]('AttachParent')
            if parent is None or not parent.IsExport:
                break
            node = package.ExportsLazy[parent.Index - 1].Value
            if node is None:
                break
            parent_props = json.loads(str(exporter.json.SerializeObject(node))).get('Properties', {})
            world = local_matrix(parent_props) @ world
            depth += 1
        if depth == 16:
            skipped += 1
            continue
        placements.append([mesh, *[round(float(v), 6) for v in scene_matrix(world)]])

    meshes = []
    for name in sorted({p[0] for p in placements}):
        entry = exporter.mesh(exporter.by_stem[name], name, lod_index=args.lod, fallbacks=FALLBACKS)
        if entry is not None:
            meshes.append(entry)
    names = {m['name'] for m in meshes}
    placements = [p for p in placements if p[0] in names]
    report = exporter.write(args.output, meshes)
    args.placements.write_text(json.dumps({'source': f'{args.map}.umap', 'placements': placements},
                                          separators=(',', ':')) + '\n')
    print(json.dumps({**report, 'placements': len(placements), 'skipped': skipped}), flush=True)


if __name__ == '__main__':
    main()
