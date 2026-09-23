"""Export the STW trap models, keyed by the display names the save parser uses.

    ~/.cache/penny-fn-assets/python-env/bin/python extract_trap_models.py \\
      --cache-root ~/.cache/penny-fn-assets-42 --output /tmp/traps.glb

Each trap may be several meshes (base + moving part); nodes are named
`<display name>#<part>`. Floor and ceiling traps pivot on the tile edge
like floors, wall traps on the wall plane, so they share the build-piece
instance transform.
"""
import argparse
import json
from pathlib import Path

from extract_build_pieces import TexturedMeshExporter

TRAPS = {
    'Wooden Floor Spikes': ['S_Wood_Floor_Spike'],
    'Floor Freeze Trap': ['S_Floor_Freeze'],
    'Tar Pit': ['SM_Tar_Pit_Trap'],
    'Floor Launcher': ['S_Floor_Jump_Trap_Base', 'Enemy_JumpPad_Floor'],
    'Anti-Air Trap': ['Patrol_Ward_Trap'],
    'Healing Pad': ['S_Floor_HealthSquare'],
    'Boost Pad': ['S_Speedboost_Straight'],
    'Jump Pad (Up)': ['JumpPadUP_floor'],
    'Jump Pad (Directional)': ['JumpPadD_floor'],
    'Retractable Floor Spikes': ['Spike_Trap_Floor_Base', 'Spike_Trap_Spikes'],
    'Cozy Campfire': ['FORT_Athena_Campfire_Item'],
    'Flame Grill Trap': ['SM_Flame_Grill_Trap'],
    'Wall Darts': ['S_Solid_Wall_Trap_test'],
    'Wall Dynamo': ['Electric_Trap_Wall'],
    'Wall Launcher': ['SM_Wall_Launcher_Trap_Base', 'SM_Wall_Launcher_Trap'],
    'Wall Spikes': ['S_Wood_Wall_Spike_SM'],
    'Wall Lights': ['Light_Trap_wall'],
    'Sound Wall': ['Wall_SpeakerTrap'],
    'Broadside': ['Trap_Cannon_Wall', 'Trap_Cannon__Cannons'],
    'Zap-o-max': ['Mechstructor_Trap'],
    'Ceiling Electric Field': ['electric_ceiling_Trap'],
    'Ceiling Zapper': ['S_Ceiling_Electric_Weak_Trap'],
    'Ceiling Drop Trap': ['S_Cieling_Drop_Trap'],
    'Ceiling Gas Trap': ['Ceiling_Gas_Trap'],
    'Ceiling Spikes': ['S_Ceiling_Spikes_Metal_Base', 'S_Cieling_Spikes_Metal'],
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    exporter = TexturedMeshExporter(args.cache_root)
    meshes, missing = [], []
    for trap, stems in TRAPS.items():
        for part, stem in enumerate(stems):
            key = exporter.by_stem.get(stem)
            entry = exporter.mesh(key, f'{trap}#{part}') if key else None
            if entry is None:
                missing.append(stem)
                continue
            meshes.append(entry)
    report = exporter.write(args.output, meshes)
    print(json.dumps({**report, 'missing': missing}), flush=True)


if __name__ == '__main__':
    main()
