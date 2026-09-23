"""Standalone reader for cooked Unreal static-mesh LOD buffers.

CUE4Parse misreads the LOD header of this Fortnite build's loose packages
(it reports zero LODs), but the buffers themselves use the long-stable
layout. So this anchors on the position buffer (stride 12, vertex count,
bulk element size 12, count) and reads forward:

  FPositionVertexBuffer → FStaticMeshVertexBuffer (tangents, UVs) →
  FColorVertexBuffer → FRawStaticIndexBuffer

The `.uasset` inlines only small LODs; the full-detail LOD0 streams from the
matching `.ubulk`, which starts with the same buffers. Sections (one per
material slot) are found by searching the `.uasset` for a section array
whose triangle counts add up to the chosen LOD's index count.
"""
import struct

import numpy as np

SECTION_SIZES = (40, 44, 36, 32, 48, 28, 52)


def find_position_buffers(data, start=0):
    found, i = [], start
    while True:
        i = data.find(b'\x0c\x00\x00\x00', i)
        if i < 0 or i + 16 > len(data):
            return found
        stride, count, element, total = struct.unpack_from('<4i', data, i)
        if stride == 12 and element == 12 and count == total and 3 <= count < 4_000_000 and i + 16 + 12 * count <= len(data):
            found.append((i, count))
            i += 16 + 12 * count
        else:
            i += 1


def read_lod(data, position, count):
    offset = position + 16
    positions = np.frombuffer(data, np.float32, count * 3, offset).reshape(count, 3)
    offset += 12 * count
    for skip in (2, 0, 4):
        o = offset + skip
        uv_sets, vertices, full_uvs, precise_tangents = struct.unpack_from('<4i', data, o)
        if vertices == count and 1 <= uv_sets <= 8 and full_uvs in (0, 1) and precise_tangents in (0, 1):
            offset = o + 16
            break
    else:
        raise ValueError('vertex buffer header not found')
    element, total = struct.unpack_from('<2i', data, offset)
    offset += 8
    tangents = data[offset:offset + element * total]
    offset += element * total
    element, total = struct.unpack_from('<2i', data, offset)
    offset += 8
    uv_bytes = data[offset:offset + element * total]
    offset += element * total
    uv_type = np.float32 if full_uvs else np.float16
    uvs = np.frombuffer(uv_bytes, uv_type).reshape(count, uv_sets, 2)[:, 0].astype(np.float32)
    basis_type, scale = (np.int16, 32767) if precise_tangents else (np.int8, 127)
    normals = np.frombuffer(tangents, basis_type).reshape(count, 2, 4)[:, 1, :3].astype(np.float32) / scale
    for skip in (2, 0):
        o = offset + skip
        stride, vertices = struct.unpack_from('<2i', data, o)
        if stride in (0, 4) and vertices in (0, count):
            offset = o + 8
            if vertices:
                element, total = struct.unpack_from('<2i', data, offset)
                offset += 8 + element * total
            break
    else:
        raise ValueError('colour buffer header not found')
    for skip in (0, 4, 2):
        o = offset + skip
        wide, element, size = struct.unpack_from('<3i', data, o)
        if wide in (0, 1) and element == 1 and 0 < size < 200_000_000 and size % (4 if wide else 2) == 0:
            indices = np.frombuffer(data, np.uint32 if wide else np.uint16, size // (4 if wide else 2), o + 12).astype(np.uint32)
            break
    else:
        raise ValueError('index buffer not found')
    if len(indices) % 3 or indices.max() >= count:
        raise ValueError('index buffer out of range')
    return {'positions': positions, 'normals': normals, 'uvs': uvs, 'indices': indices}


def find_sections(header, vertex_count, index_count):
    """First section array in the package header matching this LOD."""
    for size in SECTION_SIZES:
        for o in range(0, len(header) - 8):
            count = struct.unpack_from('<i', header, o)[0]
            if not 1 <= count <= 64 or o + 4 + count * size > len(header):
                continue
            sections, total = [], 0
            for s in range(count):
                material, first, triangles, low, high = struct.unpack_from('<5i', header, o + 4 + s * size)
                if not (0 <= material < 64 and first == total and triangles > 0 and 0 <= low <= high < vertex_count):
                    break
                sections.append({'material': material, 'first': first, 'triangles': triangles})
                total += triangles * 3
            else:
                if total == index_count:
                    return sections
    return None


def read_static_mesh(uasset_path, lod_index=0):
    """A streamed LOD of a mesh package (0 = full detail), or None.

    `.ubulk` holds the streamed LODs back to back; asking for one it lacks
    falls back to the most detailed one present.
    """
    header = open(uasset_path, 'rb').read()
    candidates = []
    bulk_path = uasset_path[:-len('.uasset')] + '.ubulk'
    try:
        candidates.append(open(bulk_path, 'rb').read())
    except FileNotFoundError:
        pass
    candidates.append(header)
    for data in candidates:
        buffers = find_position_buffers(data)
        for position, count in buffers[lod_index:lod_index + 1] or buffers[:1]:
            try:
                lod = read_lod(data, position, count)
            except ValueError:
                continue
            lod['sections'] = find_sections(header, count, len(lod['indices'])) or [
                {'material': 0, 'first': 0, 'triangles': len(lod['indices']) // 3}]
            return lod
    return None


def to_scene(lod):
    """Unreal (X forward, Y right, Z up; 512 uu per tile) → scene Y-up tiles."""
    p, n = lod['positions'], lod['normals']
    positions = np.stack([p[:, 1], p[:, 2], -p[:, 0]], 1) / 512
    normals = np.stack([n[:, 1], n[:, 2], -n[:, 0]], 1)
    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-6)
    return positions.astype(np.float32), normals.astype(np.float32)
