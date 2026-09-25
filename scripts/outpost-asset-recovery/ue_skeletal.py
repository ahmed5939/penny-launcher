"""Standalone reader for cooked Unreal skeletal-mesh LOD buffers.

Like ue_mesh.py, this works around CUE4Parse reading zero LODs from this
Fortnite build. The streamed LOD data (`.ubulk`) is laid out as

  strip flags → FMultisizeIndexContainer → FPositionVertexBuffer →
  FStaticMeshVertexBuffer (tangents, UVs) → FSkinWeightVertexBuffer

and the render sections (material, triangle range, vertex range and the
section's bone map) live inline in the `.uasset`.
"""
import struct

import numpy as np

from ue_mesh import find_position_buffers


def _i32(data, offset):
    return struct.unpack_from('<i', data, offset)[0]


def _parse_section(data, o):
    """One FSkelMeshRenderSection at `o` (after its 2-byte strip flags)."""
    material, base_index, triangles = struct.unpack_from('<hii', data, o)
    o += 10
    recompute = _i32(data, o); o += 4
    o += 1  # RecomputeTangentsVertexMaskChannel
    cast_shadow = _i32(data, o); o += 4
    visible_rt = _i32(data, o); o += 4
    if recompute not in (0, 1) or cast_shadow not in (0, 1) or visible_rt not in (0, 1):
        return None
    base_vertex = _i32(data, o); o += 4
    # ClothMappingDataLODs: array of arrays of FMeshToMeshVertData.
    lods = _i32(data, o); o += 4
    if not 0 <= lods <= 8:
        return None
    for _ in range(lods):
        count = _i32(data, o); o += 4
        if count != 0:
            return None  # cloth-mapped sections are not needed here
    bones = _i32(data, o); o += 4
    if not 0 < bones <= 1024:
        return None
    bone_map = list(struct.unpack_from(f'<{bones}H', data, o)); o += 2 * bones
    vertices = _i32(data, o); o += 4
    packed = _i32(data, o) & 0x7FFFFFFF; o += 4
    o += 2 + 20  # CorrespondClothAssetIndex, ClothingData
    # DuplicatedVerticesBuffer (two bulk arrays) is stripped in cooked
    # Fortnite builds; skip it only when present.
    if _i32(data, o) in (4, 8):
        for _ in range(2):
            element, count = struct.unpack_from('<ii', data, o)
            if element not in (4, 8) or count < 0:
                return None
            o += 8 + element * count
    disabled = _i32(data, o); o += 4
    if disabled not in (0, 1) or vertices <= 0:
        return None
    return {'material': material, 'first': base_index, 'triangles': triangles, 'base_vertex': base_vertex,
            'vertices': vertices, 'bone_map': bone_map, 'max_influences': packed}, o


def find_sections(header, vertex_count, triangle_count):
    """The section list whose triangles and vertices add up to this LOD."""
    for o in range(0, len(header) - 40):
        count = _i32(header, o)
        if not 1 <= count <= 32:
            continue
        sections, cursor = [], o + 4
        for _ in range(count):
            parsed = _parse_section(header, cursor + 2)
            if parsed is None:
                break
            section, cursor = parsed
            sections.append(section)
        else:
            if (sum(s['triangles'] for s in sections) == triangle_count
                    and sum(s['vertices'] for s in sections) == vertex_count
                    and sections[0]['first'] == 0 and sections[0]['base_vertex'] == 0):
                return sections
    return None


def _read_vertex_buffer(data, offset, count):
    """FStaticMeshVertexBuffer → (normals, uvs, end offset)."""
    for skip in (2, 0, 4):
        o = offset + skip
        uv_sets, vertices, full_uvs, precise = struct.unpack_from('<4i', data, o)
        if vertices == count and 1 <= uv_sets <= 8 and full_uvs in (0, 1) and precise in (0, 1):
            offset = o + 16
            break
    else:
        raise ValueError('vertex buffer header not found')
    element, total = struct.unpack_from('<2i', data, offset); offset += 8
    tangents = data[offset:offset + element * total]; offset += element * total
    element, total = struct.unpack_from('<2i', data, offset); offset += 8
    uv_bytes = data[offset:offset + element * total]; offset += element * total
    uvs = np.frombuffer(uv_bytes, np.float32 if full_uvs else np.float16).reshape(count, uv_sets, 2)[:, 0].astype(np.float32)
    basis, scale = (np.int16, 32767) if precise else (np.int8, 127)
    normals = np.frombuffer(tangents, basis).reshape(count, 2, 4)[:, 1, :3].astype(np.float32) / scale
    return normals, uvs, offset


def _read_skin_weights(data, offset, count):
    """FSkinWeightVertexBuffer → (bone indices [n, k], weights [n, k])."""
    for skip in (2, 0):
        o = offset + skip
        variable, influences, bones, vertices = struct.unpack_from('<iIIi', data, o)
        if variable in (0, 1) and 1 <= influences <= 12 and vertices == count:
            o += 16
            wide_index, wide_weight = struct.unpack_from('<ii', data, o)
            o += 8
            break
    else:
        raise ValueError('skin weight header not found')
    element, size = struct.unpack_from('<ii', data, o); o += 8
    raw = data[o:o + element * size]; o += element * size
    o += 2  # lookup strip flags
    lookup_count = _i32(data, o); o += 4
    element, size = struct.unpack_from('<ii', data, o); o += 8
    lookup = np.frombuffer(data, np.uint32, size, o) if size else None
    index_type = np.uint16 if wide_index else np.uint8
    weight_type = np.uint16 if wide_weight else np.uint8
    stride = influences * (np.dtype(index_type).itemsize + np.dtype(weight_type).itemsize)
    indices = np.zeros((count, influences), np.uint16)
    weights = np.zeros((count, influences), np.float32)
    weight_max = 65535.0 if wide_weight else 255.0
    for v in range(count):
        if variable and lookup is not None:
            start, n = int(lookup[v] >> 8), int(lookup[v] & 0xFF)
        else:
            start, n = v * stride, influences
        index_bytes = n * np.dtype(index_type).itemsize
        indices[v, :n] = np.frombuffer(raw, index_type, n, start)
        weights[v, :n] = np.frombuffer(raw, weight_type, n, start + index_bytes) / weight_max
    return indices, weights


def read_skeletal_lod(uasset_path, lod_index=0):
    """Positions (UE space), normals, UVs, indices, sections and skin."""
    header = open(uasset_path, 'rb').read()
    bulk_path = uasset_path[:-len('.uasset')] + '.ubulk'
    try:
        data = open(bulk_path, 'rb').read()
    except FileNotFoundError:
        data = header
    buffers = find_position_buffers(data)
    position, count = (buffers[lod_index:lod_index + 1] or buffers[:1])[0]
    # Index container ends exactly where the position buffer starts.
    indices = None
    for size in (2, 4):
        for h in range(position - 8, max(0, position - 8 - 4 * 2_000_000), -1):
            element, total = struct.unpack_from('<2i', data, h)
            if element == size and h + 8 + total * size == position and data[h - 1] == size:
                indices = np.frombuffer(data, np.uint16 if size == 2 else np.uint32, total, h + 8).astype(np.uint32)
                break
        if indices is not None:
            break
    if indices is None:
        raise ValueError('index buffer not found')
    positions = np.frombuffer(data, np.float32, count * 3, position + 16).reshape(count, 3)
    normals, uvs, offset = _read_vertex_buffer(data, position + 16 + 12 * count, count)
    bone_indices, bone_weights = _read_skin_weights(data, offset, count)
    sections = find_sections(header, count, len(indices) // 3)
    if sections is None:
        raise ValueError('render sections not found')
    # Section-local bone indices → skeleton bone indices.
    joints = np.zeros_like(bone_indices)
    for section in sections:
        rows = slice(section['base_vertex'], section['base_vertex'] + section['vertices'])
        lookup = np.array(section['bone_map'], np.uint16)
        joints[rows] = lookup[np.minimum(bone_indices[rows], len(lookup) - 1)]
    return {'positions': positions, 'normals': normals, 'uvs': uvs, 'indices': indices,
            'sections': sections, 'joints': joints, 'weights': bone_weights}
