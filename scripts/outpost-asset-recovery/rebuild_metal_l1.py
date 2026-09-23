"""Rebuild a crisp 512 px tier-1 metal texture from its 64 px mip.

The archives only carry T_Metal_L1's 64 px inline mip. Every scrap-metal
sheet on the tier-1 pieces is its own UV island, so the islands are
rasterised from the meshes at full resolution and each is filled from the
bicubic-upscaled original (keeping the game's colours and gradients) inside
a hard island edge, with light grain and worn, darker sheet borders. The
result is a reconstruction, not recovered game data.

    python rebuild_metal_l1.py <metal-L1-mesh-folder> <T_Metal_L1_64.png> <out.png>
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from ue_mesh import read_static_mesh

SIZE = 512


def main(mesh_folder, source_png, output_png):
    mask = Image.new('I', (SIZE, SIZE), 0)
    draw = ImageDraw.Draw(mask)
    island = 0
    for path in sorted(Path(mesh_folder).glob('PBW_M1_*.uasset')):
        lod = read_static_mesh(str(path), lod_index=1)
        if lod is None:
            continue
        uv = lod['uvs']
        for a, b, c in lod['indices'].reshape(-1, 3):
            points = [(float(uv[i, 0]) * SIZE, float(uv[i, 1]) * SIZE) for i in (a, b, c)]
            if max(p[0] for p in points) - min(p[0] for p in points) > SIZE * 0.9:
                continue  # wraps around; not a sheet
            island += 1
            draw.polygon(points, fill=1)
    # Close the hairline gaps between rasterised triangles of one sheet.
    closed = Image.fromarray(((np.array(mask) > 0) * 255).astype(np.uint8))
    closed = closed.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    coverage = np.array(closed) > 0
    base = np.asarray(Image.open(source_png).convert('RGB').resize((SIZE, SIZE), Image.BICUBIC), dtype=np.float32)
    # Sheet borders: distance-to-edge approximated by repeated erosion.
    edge = coverage.astype(np.float32)
    worn = np.zeros_like(edge)
    current = Image.fromarray((coverage * 255).astype(np.uint8))
    for step in range(6):
        current = current.filter(ImageFilter.MinFilter(3))
        worn += (np.array(current) > 0)
    border = 1 - np.clip(worn / 6, 0, 1)  # 1 at the sheet edge, 0 inside
    rng = np.random.default_rng(7)
    grain = np.asarray(Image.fromarray((rng.random((SIZE // 4, SIZE // 4)) * 255).astype(np.uint8))
                       .resize((SIZE, SIZE), Image.BICUBIC), dtype=np.float32) / 255 - 0.5
    fine = rng.normal(0, 1, (SIZE, SIZE)).astype(np.float32)
    result = base * (1 + grain[..., None] * 0.07 + fine[..., None] * 0.008)
    result *= (1 - border[..., None] * 0.3)
    result[~coverage] = base[~coverage] * 0.8
    Image.fromarray(np.clip(result, 0, 255).astype(np.uint8)).save(output_png, optimize=True)
    print('islands', island, 'coverage', round(float(coverage.mean()), 3))


if __name__ == '__main__':
    main(*sys.argv[1:4])
