"""Recover any Storm Shield zone: 3D terrain hulls, zone layout and props.

Generalises recover_twine.py to the other outposts, and replaces the C#
ZoneExporter's layout output so no .NET build is needed. Reads loose cooked
packages through the existing CUE4Parse DLLs (Python.NET).

    python recover_zone.py --cache-root ~/.cache/penny-fn-assets-42 \\
      --map Zone_Outpost_Stonewood --zone-id pve_01 \\
      --terrain-out ../../assets/outpost-game/zones/pve_01 \\
      --zone-out ../../src/config/constants/outpost-zones/pve_01.json
"""
import argparse
import json
import re
from pathlib import Path

from recover import collision_mesh, decode_texture, make_provider
from recover_twine import scene_transform, terrain_kind

CELL = 512
# Surface textures per zone: top faces, cliff faces and soil/shore.
ZONE_TEXTURES = {
    # T_Cave_Exterior_Wall_D ships only its 64 px inline mip in this archive,
    # so Stonewood borrows a full-resolution cliff. T_Grasslands_D is 64 px
    # too, but it is the green the game uses and tiles cleanly (as in Twine);
    # the 512 px T_Grasslands_AD variant is a dry autumn olive.
    'pve_01': {'grass': 'T_Grasslands_D', 'grass-normal': 'T_Grasslands_N',
               'rock': 'T_Asteria_RockCliff_04_D', 'rock-normal': 'T_Asteria_RockCliff_04_N',
               'ground': 'T_FORT_ForestFloor01'},
    # Plankerton is the autumn outpost: its grass is the dry AD variant.
    'pve_02': {'grass': 'T_Grasslands_AD_D', 'grass-normal': 'T_Grasslands_N',
               'rock': 'T_HB_Rock_Cliff_D', 'rock-normal': 'T_HB_Rock_Cliff_N',
               'ground': 'T_HB_Soil_D'},
    'pve_03': {'grass': 'DesertSand_basecolor', 'grass-normal': 'DesertSand_normal',
               'rock': 'RockCliff_basecolor', 'rock-normal': 'RockCliff_normal',
               'ground': 'pebblesDesert'},
}
MESH_COMPONENTS = ('FortStaticMeshComponent', 'StaticMeshComponent', 'BaseBuildingStaticMeshComponent')
PROP_NAME = re.compile(r'Tree|Palm|Rock|Plant|Shrub|Log|Vein|Chest|Cactus|Foliage|Mushroom|Bush', re.I)
TERRAIN_NAME = re.compile(r'^S_(Elevation|Cave|Cliff|GeoSlope|Shoreline)|Lava|Fissure')


def prop_kind(name):
    if re.search(r'Palm|Cactus|Tree(?!_?Log)', name, re.I):
        return 0
    if re.search(r'Rock|Vein', name, re.I):
        return 1
    if re.search(r'Plant|Shrub|Foliage|Mushroom|Bush', name, re.I):
        return 2
    return 4


def model_kind(name):
    """Renderer surface for a placed mesh; None drops invisible helpers."""
    if 'VoidArea' in name or 'Deaddrop' in name:
        return None
    if re.search(r'^S_Water|^S_Stream', name):
        return 'water'
    if re.search(r'^S_Urban_Cave|^S_Foundation', name):
        return 'rock'
    if TERRAIN_NAME.search(name):
        return terrain_kind(name)
    return 'structure'


def layout_class(name):
    """Zone-layout bucket, matching the C# exporter's rules."""
    if re.search(r'^S_Elevation_Ground|^S_Cave_Ramp2?_(Floor|Ground)|^S_GeoSlope', name):
        return 'floors'
    if name.startswith('S_Shoreline'):
        return 'shore'
    if re.search(r'Volcano_Lava|LavaFalls|Lava_Plane|LavaFissure|Lava_\dx\d|Fissure', name):
        return 'lava'
    if re.search(r'^S_Cliff|^S_Cave_|^S_Elevation|Lava_Wall_Accents', name):
        return 'rocks'
    return None


def rounded(values, digits=3):
    return [round(v, digits) for v in values]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-root', type=Path, required=True)
    parser.add_argument('--map', required=True)
    parser.add_argument('--zone-id', required=True)
    parser.add_argument('--terrain-out', type=Path, required=True)
    parser.add_argument('--zone-out', type=Path, required=True)
    args = parser.parse_args()

    provider = make_provider(args.cache_root)
    from Newtonsoft.Json import JsonConvert
    from CUE4Parse.UE4.Objects.UObject import FPackageIndex

    keys = [str(k) for k in provider.Files.Keys]
    key_by_stem = {Path(k).stem: k for k in keys if k.endswith('.uasset')}
    field = lambda obj, name: obj.GetType().GetField(name).GetValue(obj)
    package = provider.LoadPackage(next(k for k in keys if k.endswith(f'/{args.map}.umap')))
    imports = field(package, 'ImportMap')
    public_hashes = field(package, 'ImportedPublicExportHashes')

    # Public export hash → mesh package name. Loose packages drop the resolved
    # import table, but both sides keep public export hashes, so scan the
    # export headers of every package that could hold a placed mesh.
    mesh_by_hash = {}
    candidates = [k for k in keys if k.endswith('.uasset') and (
        '/Meshes/' in k or '/DS_Fortnite_Terrain' in k or '/Environments/' in k
        or Path(k).stem.startswith(('S_', 'SM_', 'SM')))]
    for key in candidates:
        try:
            candidate = provider.LoadPackage(key)
            exports = field(candidate, 'ExportMap')
            for i in range(candidate.ExportMapLength):
                public_hash = int(exports[i].PublicExportHash)
                if public_hash:
                    mesh_by_hash[public_hash] = Path(key).stem
        except Exception:
            continue

    print(f'mesh hashes from {len(candidates)} candidate packages:', len(mesh_by_hash), flush=True)
    placements, props, spawn, skipped = [], [], None, 0
    storm_shield, amplifiers = None, {}
    for i in range(package.ExportMapLength):
        try:
            obj = package.ExportsLazy[i].Value
            if obj is None or obj.Class is None:
                continue
            cls = str(obj.Class.Name.Text)
            actor = str(obj.Outer.Name.Text) if obj.Outer is not None else str(obj.Name)
            if cls == 'SceneComponent' and (actor.startswith('StormShieldPlacementActor')
                                            or actor.startswith('AmplifierPlacementActor')):
                props_json = json.loads(str(JsonConvert.SerializeObject(obj))).get('Properties', {})
                loc = props_json.get('RelativeLocation', {'X': 0, 'Y': 0, 'Z': 0})
                yaw = props_json.get('RelativeRotation', {}).get('Yaw', 0)
                entry = [*rounded([loc['X'] / CELL, loc['Y'] / CELL, loc['Z'] / CELL]), round(yaw, 1)]
                if actor.startswith('StormShield'):
                    storm_shield = entry
                else:
                    amplifiers[int(re.sub(r'\D', '', actor) or 0)] = entry
                continue
            if cls == 'SceneComponent' and actor.startswith('PlayerSpawnPlacementActor') and spawn is None:
                loc = json.loads(str(JsonConvert.SerializeObject(obj)))['Properties'].get('RelativeLocation')
                if loc:
                    spawn = rounded([loc['X'] / CELL, loc['Y'] / CELL, loc['Z'] / CELL])
                continue
            if cls not in MESH_COMPONENTS:
                continue
            props_json = json.loads(str(JsonConvert.SerializeObject(obj))).get('Properties', {})
            if props_json.get('bVisible') is False or props_json.get('bHiddenInGame') is True:
                continue
            if props_json.get('AttachParent') is not None:
                skipped += 1
                continue
            mesh = None
            reference = obj.GetOrDefault[FPackageIndex]('StaticMesh')
            if reference is not None and reference.IsImport:
                imported = imports[-reference.Index - 1]
                if imported.IsPackageImport:
                    mesh = mesh_by_hash.get(int(public_hashes[imported.AsPackageImportRef.ImportedPublicExportHashIndex]))
            name = mesh or re.sub(r'[_\d]+$', '', actor)
            if PROP_NAME.search(name) and not TERRAIN_NAME.search(name):
                loc = props_json.get('RelativeLocation', {'X': 0, 'Y': 0, 'Z': 0})
                yaw = props_json.get('RelativeRotation', {}).get('Yaw', 0)
                scale = props_json.get('RelativeScale3D', {}).get('X', 1)
                props.append([*rounded([loc['X'] / CELL, loc['Y'] / CELL, loc['Z'] / CELL]),
                              prop_kind(name), round(yaw, 1), round(scale, 2)])
                continue
            if mesh is None:
                skipped += 1
                continue
            placements.append((mesh, scene_transform(props_json), props_json))
        except Exception as error:
            skipped += 1
            if skipped <= 3:
                print('skip:', repr(error)[:300], flush=True)
    print(f'{args.map}: {len(placements)} mesh placements, {len(props)} props, skipped {skipped}', flush=True)

    models, bounds_by_mesh = {}, {}
    for name in sorted({mesh for mesh, _, _ in placements}):
        key = key_by_stem.get(name)
        if key is None:
            continue
        try:
            exports = list(provider.LoadPackage(key).GetExports())
            static_mesh = next((e for e in exports if hasattr(e, 'RenderData')), None)
            if static_mesh is not None:
                extended = json.loads(str(JsonConvert.SerializeObject(static_mesh)))['Properties'].get('ExtendedBounds')
                if extended:
                    bounds_by_mesh[name] = extended
            body = next((e for e in exports if hasattr(e, 'AggGeom') and e.AggGeom is not None
                         and len(e.AggGeom.ConvexElems)), None)
            kind = model_kind(name)
            if kind is None:
                continue
            if body is not None:
                aggregate = json.loads(str(JsonConvert.SerializeObject(body.AggGeom)))
                aggregate['ConvexElems'] = [c for c in aggregate['ConvexElems'] if c['VertexData'] and c['IndexData']]
                models[name] = {'kind': kind, 'source': 'collision', **collision_mesh(aggregate)}
            elif name in bounds_by_mesh and 'Cave_Entrance' not in name:
                o, e = bounds_by_mesh[name]['Origin'], bounds_by_mesh[name]['BoxExtent']
                models[name] = {'kind': kind, 'source': 'bounds',
                                'bounds': [o['Y'] / CELL, o['Z'] / CELL, -o['X'] / CELL,
                                           e['Y'] / 256, e['Z'] / 256, e['X'] / 256]}
        except Exception as error:
            print('Unavailable mesh:', name, str(error)[:100], flush=True)

    names = list(models)
    lookup = {n: i for i, n in enumerate(names)}
    instances = [[lookup[m], *t] for m, t, _ in placements if m in lookup]
    args.terrain_out.mkdir(parents=True, exist_ok=True)
    (args.terrain_out / 'terrain.json').write_text(json.dumps({
        'source': f'{args.map}.umap', 'cell': CELL, 'basis': 'scene-y-up',
        'models': [{'name': n, **models[n]} for n in names], 'instances': instances,
    }, separators=(',', ':')) + '\n')

    # Zone layout for the heightfield, ocean mask and whole-map camera.
    layout = {'floors': [], 'rocks': [], 'shore': [], 'lava': []}
    for mesh, _, props_json in placements:
        bucket = layout_class(mesh)
        if bucket is None or 'Origin' not in bounds_by_mesh.get(mesh, {}):
            continue
        loc = props_json.get('RelativeLocation', {'X': 0, 'Y': 0, 'Z': 0})
        yaw = props_json.get('RelativeRotation', {}).get('Yaw', 0)
        scale = props_json.get('RelativeScale3D', {'X': 1, 'Y': 1, 'Z': 1})
        o, e = bounds_by_mesh[mesh]['Origin'], bounds_by_mesh[mesh]['BoxExtent']
        quarter = round(yaw / 90) % 4
        ox, oy = o['X'] / CELL * scale['X'], o['Y'] / CELL * scale['Y']
        ex, ey = abs(e['X'] / CELL * scale['X']), abs(e['Y'] / CELL * scale['Y'])
        off = [(ox, oy), (-oy, ox), (-ox, -oy), (oy, -ox)][quarter]
        half = (ex, ey) if quarter % 2 == 0 else (ey, ex)
        top = (o['Z'] + e['Z']) / CELL * scale['Z']
        layout[bucket].append(rounded([loc['X'] / CELL + off[0], loc['Y'] / CELL + off[1],
                                       loc['Z'] / CELL + top, half[0], half[1]]))
    tiles = layout['floors'] + layout['rocks'] + layout['shore']
    zone = {
        'bounds': {
            'maxX': int(max(t[0] + t[3] for t in tiles) + 0.999),
            'maxY': int(max(t[1] + t[4] for t in tiles) + 0.999),
            'minX': int(min(t[0] - t[3] for t in tiles) // 1),
            'minY': int(min(t[1] - t[4] for t in tiles) // 1),
        },
        'cell': CELL, **layout, 'props': props, 'source': f'{args.map}.umap', 'spawn': spawn,
        # Where the game places the Storm Shield and its amplifiers:
        # `[x, y, z, yawDegrees]`, amplifiers in placement-actor order.
        'stormShield': storm_shield,
        'amplifiers': [amplifiers[k] for k in sorted(amplifiers)],
        'waterZ': round(min(t[2] for t in (layout['shore'] or layout['floors'])), 3),
        'zoneId': args.zone_id,
    }
    textures = {}
    for filename, name in ZONE_TEXTURES.get(args.zone_id, {}).items():
        try:
            texture = next(e for e in provider.LoadPackage(key_by_stem[name]).GetExports() if hasattr(e, 'PlatformData'))
            image = decode_texture(texture, filename.endswith('-normal'))
            image.save(args.terrain_out / f'{filename}.png', optimize=True)
            textures[filename] = {'package': key_by_stem[name], 'format': str(texture.Format), 'size': list(image.size)}
        except Exception as error:
            print('Texture unavailable:', filename, name, repr(error)[:160], flush=True)
    (args.terrain_out / 'provenance.json').write_text(json.dumps({
        'source': f'{args.map}.umap', 'cacheRoot': str(args.cache_root.name),
        'collisionModels': sum(m['source'] == 'collision' for m in models.values()),
        'boundsModels': sum(m['source'] == 'bounds' for m in models.values()),
        'instances': len(instances), 'textures': textures,
    }, indent=2) + '\n')

    args.zone_out.parent.mkdir(parents=True, exist_ok=True)
    args.zone_out.write_text(json.dumps(zone, separators=(',', ':')) + '\n')
    print(json.dumps({'models': len(models), 'collision': sum(m['source'] == 'collision' for m in models.values()),
                      'instances': len(instances), **{k: len(v) for k, v in layout.items()},
                      'props': len(props), 'bounds': zone['bounds'], 'waterZ': zone['waterZ']}), flush=True)


if __name__ == '__main__':
    main()
