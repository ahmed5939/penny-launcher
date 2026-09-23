"""Prepare the outpost explorer's sky from a Poly Haven "pure sky" HDRI (CC0).

Writes three files next to each other:

- ``sky.jpg``: the upper hemisphere (plus a little below the horizon) as an
  sRGB JPEG, divided by ``skyScale`` so the clouds fit in 8 bits. The renderer
  multiplies it back to radiance before tone mapping.
- ``sky-env.hdr``: a 512×256 flat-RGBE copy used only for image-based light.
- ``sky.json``: the sun direction, horizon colour and scales above.

Usage::

    curl -o sky4k.hdr https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/kloofendal_48d_partly_cloudy_puresky_4k.hdr
    python prepare_sky.py sky4k.hdr ../../assets/outpost-game/sky

Needs numpy and Pillow.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

BELOW_HORIZON_DEGREES = 8


def read_hdr(path):
    data = Path(path).read_bytes()
    header_end = data.index(b'\n\n') + 2
    size_end = data.index(b'\n', header_end)
    _, height, _, width = data[header_end:size_end].split()
    width, height = int(width), int(height)
    source = np.frombuffer(data, dtype=np.uint8, offset=size_end + 1)
    pixels = np.empty((height, width, 4), dtype=np.uint8)
    cursor = 0
    for row in range(height):
        if source[cursor] != 2 or source[cursor + 1] != 2:
            raise ValueError('Only new-style RLE Radiance files are supported')
        cursor += 4
        for channel in range(4):
            column = 0
            while column < width:
                count = int(source[cursor])
                cursor += 1
                if count > 128:
                    count -= 128
                    pixels[row, column:column + count, channel] = source[cursor]
                    cursor += 1
                else:
                    pixels[row, column:column + count, channel] = source[cursor:cursor + count]
                    cursor += count
                column += count
    exponent = pixels[..., 3].astype(np.float32)
    scale = np.where(exponent > 0, np.ldexp(1.0, (exponent - 136).astype(np.int32)), 0)
    return pixels[..., :3].astype(np.float32) * scale[..., None]


def write_flat_hdr(path, image):
    height, width, _ = image.shape
    brightest = image.max(axis=2)
    mantissa, exponent = np.frexp(brightest)
    scale = np.where(brightest > 1e-32, mantissa * 256 / np.maximum(brightest, 1e-32), 0)
    rgbe = np.zeros((height, width, 4), dtype=np.uint8)
    rgbe[..., :3] = np.clip(image * scale[..., None], 0, 255).astype(np.uint8)
    rgbe[..., 3] = np.where(brightest > 1e-32, exponent + 128, 0).astype(np.uint8)
    header = f'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y {height} +X {width}\n'.encode()
    Path(path).write_bytes(header + rgbe.tobytes())


def srgb_encode(linear):
    linear = np.clip(linear, 0, 1)
    return np.where(linear <= 0.0031308, linear * 12.92, 1.055 * np.power(linear, 1 / 2.4) - 0.055)


def main(source, output):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    image = read_hdr(source)
    height, width, _ = image.shape
    luminance = image @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)

    # Equirect rows run from the zenith (row 0) to the nadir.
    row, column = np.unravel_index(np.argmax(luminance), luminance.shape)
    elevation = math.pi / 2 - (row + 0.5) / height * math.pi
    azimuth = (column + 0.5) / width * 2 * math.pi - math.pi
    horizon_rows = slice(height // 2 - int(height * 3 / 180), height // 2)
    horizon = image[horizon_rows].reshape(-1, 3).mean(axis=0)

    last_row = height // 2 + int(height * BELOW_HORIZON_DEGREES / 180)
    upper = image[:last_row]
    sky_scale = float(np.percentile(luminance[:last_row], 99.3))
    Image.fromarray((srgb_encode(upper / sky_scale) * 255 + 0.5).astype(np.uint8)).save(
        output / 'sky.jpg', quality=86, optimize=True, progressive=True
    )

    small = image.reshape(256, height // 256, 512, width // 512, 3).mean(axis=(1, 3))
    write_flat_hdr(output / 'sky-env.hdr', small)

    # Direction in the renderer's frame: u = atan2(z, x) / 2π + 0.5.
    sun = [math.cos(elevation) * math.cos(azimuth), math.sin(elevation), math.cos(elevation) * math.sin(azimuth)]
    (output / 'sky.json').write_text(json.dumps({
        'source': Path(source).name,
        'licence': 'CC0 1.0 — Poly Haven (Greg Zaal, Jarod Guest)',
        'belowHorizonDegrees': BELOW_HORIZON_DEGREES,
        'skyScale': round(sky_scale, 5),
        'horizon': [round(float(value), 5) for value in horizon],
        'sun': [round(value, 5) for value in sun],
        'sunElevationDegrees': round(math.degrees(elevation), 2),
    }, indent=2) + '\n')
    print('sun elevation', math.degrees(elevation), 'azimuth', math.degrees(azimuth), 'scale', sky_scale)


if __name__ == '__main__':
    main(*sys.argv[1:3])
