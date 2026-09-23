"""Export a zone's own trees, rocks and plants: real models, real placements.

    ~/.cache/penny-fn-assets/python-env/bin/python extract_zone_scenery.py \\
      --cache-root ~/.cache/penny-fn-assets-42 --map Zone_Outpost_Stonewood \\
      --output /tmp/pve_01-scenery.glb --placements /tmp/pve_01-scenery.json

Map foliage is placed as blueprint actors whose component only records its
transform; the mesh comes from the component's template in the actor
blueprint (`Default__Tree_Pine_C:StaticMeshComponent0`). The template import
is resolved by public export hash to the blueprint package, and that
blueprint's own mesh component supplies the model. Placements use the same
scene-space matrices as extract_backdrops.py.
"""
import argparse
import json
import re
from pathlib import Path

from extract_backdrops import local_matrix, scene_matrix
from extract_blueprint_models import blueprint_parts
from extract_build_pieces import TexturedMeshExporter

MESH_COMPONENTS = ('FortStaticMeshComponent', 'StaticMeshComponent', 'BaseBuildingStaticMeshComponent')
NATURE = re.compile(r'Tree|Pine|Palm|Rock|Stone|Boulder|Shrub|Plant|Bush|Log|Stump|Mushroom|Flower|Cactus|'
                    r'Foliage|Fern|Grass|Vein|Crystal|Birch|Oak|Stalag', re.I)
NOT_NATURE = re.compile(r'^S_(Elevation|Cave|Cliff|GeoSlope|Shoreline|Urban_Cave)|Skybox|Terrain', re.I)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-root', type=Path, required=True)
    parser.add_argument('--map', required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--placements', type=Path, required=True)
    parser.add_argument('--lod', type=int, default=1)
    args = parser.parse_args()
    exporter = TexturedMeshExporter(args.cache_root)
    field = exporter.field
    # Blueprint packages resolve templates; index their exports too.
    for key in exporter.keys:
        if key.endswith('.uasset') and '/ActorBlueprints/' in key:
            try:
                package = exporter.provider.LoadPackage(key)
                exports = field(package, 'ExportMap')
                for i in range(package.ExportMapLength):
                    public_hash = int(exports[i].PublicExportHash)
                    if public_hash:
                        exporter.by_hash.setdefault(public_hash, key.split('/')[-1][:-7])
            except Exception:
                continue
    from CUE4Parse.UE4.Objects.UObject import FPackageIndex

    package = exporter.provider.LoadPackage(next(k for k in exporter.keys if k.endswith(f'/{args.map}.umap')))
    export_map = field(package, 'ExportMap')
    hashes = field(package, 'ImportedPublicExportHashes')

    def template_blueprint(index):
        template = export_map[index].TemplateIndex
        if not template.IsPackageImport:
            return None
        return exporter.by_hash.get(int(hashes[template.AsPackageImportRef.ImportedPublicExportHashIndex]))

    blueprint_mesh = {}
    placements, unresolved = [], 0
    for i in range(package.ExportMapLength):
        try:
            obj = package.ExportsLazy[i].Value
        except Exception:
            continue
        if obj is None or obj.Class is None or str(obj.Class.Name.Text) not in MESH_COMPONENTS:
            continue
        actor = str(obj.Outer.Name.Text) if obj.Outer is not None else ''
        mesh, offset = None, None
        reference = obj.GetOrDefault[FPackageIndex]('StaticMesh')
        if reference is not None and reference.IsImport:
            mesh = exporter.resolve(package, reference.Index)
        if mesh is None:
            blueprint = template_blueprint(i)
            if blueprint is None:
                if NATURE.search(actor):
                    unresolved += 1
                continue
            if blueprint not in blueprint_mesh:
                key = exporter.by_stem.get(blueprint)
                parts = blueprint_parts(exporter, key) if key else []
                blueprint_mesh[blueprint] = parts[0] if parts else None
            if blueprint_mesh[blueprint] is None:
                continue
            mesh, offset = blueprint_mesh[blueprint]
        if not NATURE.search(mesh + ' ' + actor) or NOT_NATURE.search(mesh):
            continue
        props = json.loads(str(exporter.json.SerializeObject(obj))).get('Properties', {})
        if props.get('bVisible') is False or props.get('bHiddenInGame') is True:
            continue
        world, node = local_matrix(props), obj
        for _ in range(8):
            parent = node.GetOrDefault[FPackageIndex]('AttachParent')
            if parent is None or not parent.IsExport:
                break
            node = package.ExportsLazy[parent.Index - 1].Value
            if node is None:
                break
            world = local_matrix(json.loads(str(exporter.json.SerializeObject(node))).get('Properties', {})) @ world
        if offset is not None:
            world = world @ offset
        placements.append([mesh, *[round(float(v), 6) for v in scene_matrix(world)]])

    meshes = []
    for name in sorted({p[0] for p in placements}):
        key = exporter.by_stem.get(name)
        entry = exporter.mesh(key, name, lod_index=args.lod, scenery=True) if key else None
        if entry is not None:
            meshes.append(entry)
    names = {m['name'] for m in meshes}
    placements = [p for p in placements if p[0] in names]
    report = exporter.write(args.output, meshes)
    args.placements.write_text(json.dumps({'source': f'{args.map}.umap', 'placements': placements},
                                          separators=(',', ':')) + '\n')
    print(json.dumps({'meshes': len(meshes), 'placements': len(placements), 'unresolved': unresolved,
                      'models': sorted(names), 'untextured_slots': report['untextured_slots']}), flush=True)


if __name__ == '__main__':
    main()
