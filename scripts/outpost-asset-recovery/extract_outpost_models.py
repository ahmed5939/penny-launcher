"""Export the Storm Shield device and amplifier models with their textures.

    ~/.cache/penny-fn-assets/python-env/bin/python extract_outpost_models.py \\
      --cache-root ~/.cache/penny-fn-assets-42 --output /tmp/outpost.glb
"""
import argparse
import json
from pathlib import Path

from extract_build_pieces import TexturedMeshExporter

MODELS = {
    'StormShield': 'Static_Complete_Outpost',
    'StormShieldTop': 'Static_Complete_Outpost_Top',
    'Amplifier': 'Storm_Shield_Amplifier_b',
    'AmplifierFloor': 'Storm_Shield_Amplifier_Floor',
}
# The core's own material instance is absent; its colour texture is not.
FALLBACKS = [(r'Outpost_Core', {'Diffuse': 'Outpost_Core_C'})]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    exporter = TexturedMeshExporter(args.cache_root)
    meshes = []
    for name, stem in MODELS.items():
        entry = exporter.mesh(exporter.by_stem[stem], name, lod_index=1, fallbacks=FALLBACKS)
        if entry is None:
            print('No geometry:', stem, flush=True)
            continue
        meshes.append(entry)
    print(json.dumps(exporter.write(args.output, meshes)), flush=True)


if __name__ == '__main__':
    main()
