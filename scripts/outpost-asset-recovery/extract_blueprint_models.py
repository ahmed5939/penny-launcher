"""Export build pieces and traps exactly as their blueprints assemble them.

    PY=~/.cache/penny-fn-assets/python-env/bin/python
    $PY extract_blueprint_models.py builds --cache-root ~/.cache/penny-fn-assets-42 \\
      --output /tmp/builds.glb --override T_Metal_L1=T_Metal_L1_rebuilt.png
    $PY extract_blueprint_models.py traps --cache-root ~/.cache/penny-fn-assets-42 --output /tmp/traps.glb

Each `PBWA_<W|S|M><tier>_<Shape>` / `Trap_<Name>` blueprint lists its mesh
components; their relative transforms (composed through AttachParent) are
kept, so multi-part pieces (anti-air base + turret + head, door frames)
come out whole and at the scale the game uses. Nodes are named by the key
the explorer looks up: `<W|B|M><tier>_<Shape>` for builds (stone is B, as
the save's material code), and the trap's display name for traps.
"""
import argparse
import json
import re
from pathlib import Path

import numpy as np

from extract_backdrops import local_matrix, scene_matrix
from extract_build_pieces import SLOT_FALLBACK, TexturedMeshExporter
from ue_mesh import read_static_mesh

BUILD = re.compile(r'/PBWA_([WSM])([123])_([A-Za-z0-9_]+)\.uasset$')
TRAP = re.compile(r'/Items/Traps/Blueprints/Trap_([A-Za-z0-9_]+)\.uasset$')
WALL_TRAPS = {'Broadside', 'Zap-o-max', 'Sound Wall'}
# Hidden or effect-only parts inside trap blueprints.
SKIP_PART = re.compile(r'Tire|Projectile|Range|Guide|Distance|Ammo|FX|Beam|Spline|Mist|Cloud|Rays|Tracer', re.I)
# Equivalent shape names that differ between materials/tiers; each tier gets
# every spelling the save may use.
SHAPE_ALIASES = [
    ('HalfWall', 'HalfWallS'), ('WindowC', 'WindowsC'), ('WindowSide', 'WindowsSide'),
    ('HalfWallDoorS', 'HalfWallDoorSide'), ('Floor', 'Floor_2'),
    ('ArchwaySupport', 'ArchwayLargeSupport'),
]
CEILING_TOP = -0.028  # just under a floor slab's underside (-0.025)
TRAP_NAMES = {
    'Floor_Spikes_Wood': 'Wooden Floor Spikes', 'Floor_Freeze': 'Floor Freeze Trap', 'Floor_Tar': 'Tar Pit',
    'Floor_Launcher': 'Floor Launcher', 'Floor_Ward_AntiAir': 'Anti-Air Trap',
    'Floor_Health_First_Aid_MegaBacon': 'Healing Pad', 'Floor_Hoverboard_Speed': 'Boost Pad',
    'Floor_Player_Jump_Pad': 'Jump Pad (Up)', 'Floor_Player_Jump_Free_Direction_Pad': 'Jump Pad (Directional)',
    'Floor_Spikes': 'Retractable Floor Spikes', 'Floor_Campfire': 'Cozy Campfire',
    'Floor_Flamegrill': 'Flame Grill Trap', 'Floor_Health': 'Healing Pad', 'Wall_Darts': 'Wall Darts',
    'Wall_Electric': 'Wall Dynamo', 'Wall_Launcher': 'Wall Launcher', 'Wall_Spikes': 'Wall Spikes',
    'Wall_Wood_Spikes': 'Wall Spikes', 'Wall_Light': 'Wall Lights', 'Wall_Speaker': 'Sound Wall',
    'Wall_Cannons': 'Broadside', 'Wall_Mechstructor': 'Zap-o-max', 'Ceiling_Electric': 'Ceiling Electric Field',
    'Ceiling_ElectricWeak': 'Ceiling Zapper', 'Ceiling_Electric_Single': 'Ceiling Zapper',
    'Ceiling_Falling': 'Ceiling Drop Trap', 'Ceiling_Gas': 'Ceiling Gas Trap', 'Ceiling_Spikes': 'Ceiling Spikes',
    'Ceiling_Goop': 'Vindertech Goop',
}


def blueprint_parts(exporter, key, skip=None):
    """[(mesh stem, Unreal-space 4×4)] for a blueprint's mesh components."""
    from CUE4Parse.UE4.Objects.UObject import FPackageIndex

    package = exporter.provider.LoadPackage(key)
    exports = list(package.GetExports())
    parts = []
    for export in exports:
        name = str(export.Name)
        if name.startswith('Default__') or (skip and skip.search(name)):
            continue
        try:
            reference = export.GetOrDefault[FPackageIndex]('StaticMesh')
        except Exception:
            continue
        if reference is None or not reference.IsImport:
            continue
        mesh = exporter.resolve(package, reference.Index)
        if mesh is None or (skip and skip.search(mesh)):
            continue
        props = json.loads(str(exporter.json.SerializeObject(export))).get('Properties', {})
        if props.get('bVisible') is False or props.get('bHiddenInGame') is True:
            continue
        matrix, node = local_matrix(props), export
        for _ in range(8):
            parent = node.GetOrDefault[FPackageIndex]('AttachParent')
            if parent is None or not parent.IsExport:
                break
            node = package.ExportsLazy[parent.Index - 1].Value
            if node is None:
                break
            matrix = local_matrix(json.loads(str(exporter.json.SerializeObject(node))).get('Properties', {})) @ matrix
        parts.append((mesh, matrix, name))
    # Trap blueprints often repeat the root mesh in a named, offset visual
    # component (the drop trap's crate sits 16 uu lower); keep that one.
    named = {mesh for mesh, _, component in parts if component != 'StaticMeshComponent0'}
    parts = [(mesh, matrix) for mesh, matrix, component in parts
             if not (component == 'StaticMeshComponent0' and mesh in named)]
    unique, seen = [], set()
    for mesh, matrix in parts:
        signature = (mesh, tuple(np.round(matrix, 1).reshape(-1)))
        if signature not in seen:
            seen.add(signature)
            unique.append((mesh, matrix))
    return unique


def seat_trap(exporter, name, parts):
    """Centre floor/ceiling trap models on their tile, and drop ceiling traps
    so nothing pokes through the slab or roof they hang from."""
    points = []
    for mesh, matrix in parts:
        lod = read_static_mesh(str(exporter.cache_root / exporter.by_stem[mesh]))
        if lod is not None:
            p = lod['positions']
            points.append((np.c_[p, np.ones(len(p))] @ matrix.T)[:, :3])
    if not points or name.startswith('Wall') or name in WALL_TRAPS:
        return parts
    p = np.concatenate(points)
    shift = np.zeros(3)
    # Models are delivered centred on their tile; the explorer places them
    # at the trap's tile centre. The forward axis (scene x) is Unreal Y:
    # edge-pivoted models span 0..512 and move back half a tile.
    centre_forward = (p[:, 1].min() + p[:, 1].max()) / 2
    if centre_forward > 0.25 * 512:
        shift[1] = -256
    if name.startswith('Ceiling') or name == 'Vindertech Goop':
        shift[2] = min(0, CEILING_TOP * 512 - p[:, 2].max())
    if not shift.any():
        return parts
    move = np.eye(4)
    move[:3, 3] = shift
    return [(mesh, move @ matrix) for mesh, matrix in parts]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('kind', choices=('builds', 'traps'))
    parser.add_argument('--cache-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--override', action='append', default=[])
    args = parser.parse_args()
    exporter = TexturedMeshExporter(args.cache_root)
    exporter.overrides = dict(item.split('=', 1) for item in args.override)
    assemblies, needed = {}, set()
    for key in sorted(exporter.keys):
        if args.kind == 'builds':
            match = BUILD.search(key)
            if not match:
                continue
            letter, tier, shape = match.groups()
            name = f"{'B' if letter == 'S' else letter}{tier}_{shape}"
            parts = blueprint_parts(exporter, key)
        else:
            match = TRAP.search(key)
            if not match or match.group(1) not in TRAP_NAMES:
                continue
            name = TRAP_NAMES[match.group(1)]
            if name in assemblies:
                continue
            parts = blueprint_parts(exporter, key, SKIP_PART)
        if parts and args.kind == 'traps':
            parts = seat_trap(exporter, name, parts)
        if parts:
            assemblies[name] = [(mesh, scene_matrix(matrix)) for mesh, matrix in parts]
            needed.update(mesh for mesh, _ in parts)
    if args.kind == 'builds':
        for tier_prefix in sorted({name[:2] for name in assemblies}):
            for group in SHAPE_ALIASES:
                source = next((f'{tier_prefix}_{shape}' for shape in group if f'{tier_prefix}_{shape}' in assemblies), None)
                for shape in group:
                    assemblies.setdefault(f'{tier_prefix}_{shape}', assemblies[source]) if source else None
    lod = 1 if args.kind == 'builds' else 0
    meshes, missing = [], []
    for stem in sorted(needed):
        key = exporter.by_stem.get(stem)
        entry = exporter.mesh(key, stem, lod_index=lod, fallbacks=SLOT_FALLBACK) if key else None
        if entry is None:
            missing.append(stem)
        else:
            meshes.append(entry)
    report = exporter.write(args.output, meshes, assemblies)
    print(json.dumps({'assemblies': len(assemblies), 'meshes': len(meshes), 'missing': missing,
                      'untextured_slots': report['untextured_slots']}), flush=True)


if __name__ == '__main__':
    main()
