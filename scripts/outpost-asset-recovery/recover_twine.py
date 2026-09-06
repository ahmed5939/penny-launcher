"""Recover Twine terrain collision shapes, placed transforms and surfaces."""
import argparse
import json
import math
from pathlib import Path

from recover import collision_mesh, decode_texture, make_provider, stage_archive

TEXTURES = {
    'grass': ('T_Grasslands_D', False),
    'grass-normal': ('T_Grasslands_N', True),
    'rock': ('T_Volcano_Exterior_Wall_Volcanic_Andesite', False),
    'cave-normal': ('T_Cave_Exterior_Wall_N', True),
    'ground': ('T_Volcano_Pebbles_D', False),
    'lava': ('LavaGround_D', False),
    'lava-normal': ('LavaGround_N', True),
}


def scene_transform(properties):
    loc = properties.get('RelativeLocation', dict(X=0, Y=0, Z=0))
    scale = properties.get('RelativeScale3D', dict(X=1, Y=1, Z=1))
    rotation = properties.get('RelativeRotation', {})
    pitch, yaw, roll = [math.radians(rotation.get(k, 0)) / 2 for k in ('Pitch', 'Yaw', 'Roll')]
    sp, sy, sr = math.sin(pitch), math.sin(yaw), math.sin(roll)
    cp, cy, cr = math.cos(pitch), math.cos(yaw), math.cos(roll)
    # FRotator.Quaternion, then change basis (X,Y,Z)->(Y,Z,-X).
    qx, qy = cr*sp*sy-sr*cp*cy, -cr*sp*cy-sr*cp*sy
    qz, qw = cr*cp*sy-sr*sp*cy, cr*cp*cy+sr*sp*sy
    return [round(n, 7) for n in [loc['Y']/512, loc['Z']/512, -loc['X']/512,
                                   -qy, -qz, qx, qw, scale['Y'], scale['Z'], scale['X']]]


def terrain_kind(name):
    if any(s in name for s in ('LavaFalls', 'Volcano_Lava', 'Lava_Plane', 'LavaFissure')):
        return 'lava'
    if 'Shoreline' in name:
        return 'shore'
    if name.startswith(('S_Elevation_Ground', 'S_GeoSlope')):
        return 'ground'
    return 'rock'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--cache-root', type=Path, default=Path.home()/'.cache/penny-fn-assets')
    args = parser.parse_args()
    stage_archive(args.archive, args.cache_root)
    provider = make_provider(args.cache_root)
    from Newtonsoft.Json import JsonConvert
    from CUE4Parse.UE4.Objects.UObject import FPackageIndex
    keys = [str(k) for k in provider.Files.Keys]
    candidates = {Path(k).stem: k for k in keys if k.endswith('.uasset')
                  and ('/DS_Fortnite_Terrain_NoLOD/' in k or '/Vulcano/' in k)
                  and Path(k).stem.startswith(('S_', 'SM_'))}
    # Loose packages omit the imported-package table, so resolved references
    # become null. Public export hashes remain present in both the level and
    # mesh packages, and identify meshes even when an actor has been renamed.
    field = lambda obj, name: obj.GetType().GetField(name).GetValue(obj)
    export_hashes = {}
    for name, key in candidates.items():
        mesh_package = provider.LoadPackage(key)
        exports = field(mesh_package, 'ExportMap')
        for i in range(mesh_package.ExportMapLength):
            entry = mesh_package.ExportsLazy[i].Value
            if entry is not None and hasattr(entry, 'RenderData'):
                public_hash = int(exports[i].PublicExportHash)
                if public_hash:
                    export_hashes[public_hash] = name
    package = provider.LoadPackage(next(k for k in keys if k.endswith('Zone_Outpost_TwinePeaks.umap')))
    imports = field(package, 'ImportMap')
    public_hashes = field(package, 'ImportedPublicExportHashes')
    placements, skipped = [], 0
    for i in range(package.ExportMapLength):
        try:
            obj = package.ExportsLazy[i].Value
            if obj is None or obj.Class is None or str(obj.Class.Name.Text) not in (
                    'FortStaticMeshComponent', 'StaticMeshComponent', 'BaseBuildingStaticMeshComponent'):
                continue
            reference = obj.GetOrDefault[FPackageIndex]('StaticMesh')
            if reference is None or not reference.IsImport:
                continue
            imported = imports[-reference.Index-1]
            if not imported.IsPackageImport:
                continue
            mesh = export_hashes.get(int(public_hashes[imported.AsPackageImportRef.ImportedPublicExportHashIndex]))
            if mesh is None:
                continue
            props = json.loads(str(JsonConvert.SerializeObject(obj))).get('Properties', {})
            if props.get('bVisible') is False or props.get('bHiddenInGame') is True:
                continue
            # A component attached to another component needs its full parent
            # transform; omit it rather than treating a local transform as world.
            if props.get('AttachParent') is not None:
                skipped += 1
                continue
            placements.append((mesh, scene_transform(props)))
        except Exception:
            skipped += 1
    print('Terrain placements:', len(placements), 'skipped:', skipped, flush=True)
    models = {}
    for name in sorted({n for n, _ in placements}):
        try:
            exports = list(provider.LoadPackage(candidates[name]).GetExports())
            body = next((e for e in exports if hasattr(e, 'AggGeom') and e.AggGeom is not None
                         and len(e.AggGeom.ConvexElems)), None)
            if body is not None:
                aggregate = json.loads(str(JsonConvert.SerializeObject(body.AggGeom)))
                aggregate['ConvexElems'] = [c for c in aggregate['ConvexElems']
                                           if c['VertexData'] and c['IndexData']]
                geometry = collision_mesh(aggregate)
                model = {'kind': terrain_kind(name), 'source': 'collision', **geometry}
            else:
                if 'Cave_Entrance' in name:
                    raise ValueError('No hull; omit rather than block the cave with a bounds box')
                mesh = next(e for e in exports if hasattr(e, 'RenderData'))
                bounds = json.loads(str(JsonConvert.SerializeObject(mesh)))['Properties']['ExtendedBounds']
                o, e = bounds['Origin'], bounds['BoxExtent']
                # Missing hulls (mostly beaches) retain a clearly recorded
                # bounds-based fallback. Never fill an entire island heightfield.
                model = {'kind': terrain_kind(name), 'source': 'bounds',
                         'bounds': [o['Y']/512, o['Z']/512, -o['X']/512,
                                    e['Y']/256, e['Z']/256, e['X']/256]}
            models[name] = model
        except Exception as error:
            print('Unavailable terrain mesh:', name, str(error)[:100], flush=True)
    model_names = list(models)
    lookup = {n: i for i, n in enumerate(model_names)}
    instances = [[lookup[n], *t] for n, t in placements if n in lookup]
    output = {'source': 'Zone_Outpost_TwinePeaks.umap', 'cell': 512,
              'basis': 'scene-y-up', 'models': [{'name': n, **models[n]} for n in model_names],
              'instances': instances}
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output/'terrain.json').write_text(json.dumps(output, separators=(',', ':'))+'\n')
    provenance = {'archive': args.archive.name, 'source': output['source'],
                  'collisionModels': sum(m['source'] == 'collision' for m in models.values()),
                  'boundsModels': sum(m['source'] == 'bounds' for m in models.values()),
                  'instances': len(instances), 'skippedComponents': skipped, 'meshResolution': 'public-export-hash', 'textures': {}}
    for filename, (name, normal) in TEXTURES.items():
        key = next(k for k in keys if k.endswith('/'+name+'.uasset'))
        texture = next(e for e in provider.LoadPackage(key).GetExports() if hasattr(e, 'PlatformData'))
        image = decode_texture(texture, normal)
        image.save(args.output/(filename+'.png'), optimize=True)
        provenance['textures'][filename] = {'package': key, 'normal': normal, 'size': list(image.size)}
    (args.output/'provenance.json').write_text(json.dumps(provenance, indent=2)+'\n')
    print(json.dumps({k: v for k, v in provenance.items() if k != 'textures'}), flush=True)


if __name__ == '__main__':
    main()
