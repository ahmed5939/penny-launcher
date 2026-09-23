"""Write the full-detail render meshes a zone's terrain.json places.

    python extract_render_meshes.py --terrain ../../assets/outpost-game/zones/pve_01/terrain.json \\
      --cache-root ~/.cache/penny-fn-assets-42 --cache-root ~/.cache/penny-fn-assets \\
      --output /tmp/pve_01-meshes.glb

Then compress with `compress_glb.mjs`. One glTF mesh per model name; section
materials are left generic because the renderer assigns biome surfaces.
"""
import argparse
import json
import os
from pathlib import Path

from glb_writer import write_glb
from ue_mesh import read_static_mesh, to_scene


def index_packages(roots):
    found = {}
    for root in roots:
        for directory, _, files in os.walk(root / 'assets'):
            for name in files:
                if name.endswith('.uasset'):
                    found.setdefault(name[:-7], os.path.join(directory, name))
    return found


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--terrain', type=Path, action='append', required=True)
    parser.add_argument('--cache-root', type=Path, action='append', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    packages = index_packages([root.expanduser() for root in args.cache_root])
    names = sorted({m['name'] for path in args.terrain for m in json.loads(path.read_text())['models']})
    meshes, missing = [], []
    for name in names:
        path = packages.get(name)
        lod = read_static_mesh(path) if path else None
        if lod is None:
            missing.append(name)
            continue
        positions, normals = to_scene(lod)
        meshes.append({'name': name, 'positions': positions, 'normals': normals, 'uvs': lod['uvs'], 'indices': lod['indices']})
    write_glb(str(args.output), meshes)
    print(json.dumps({'meshes': len(meshes), 'triangles': sum(len(m['indices']) // 3 for m in meshes),
                      'missing': missing}), flush=True)


if __name__ == '__main__':
    main()
