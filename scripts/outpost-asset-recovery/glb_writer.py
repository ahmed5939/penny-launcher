"""Minimal GLB writer for recovered meshes (positions, normals, UVs, indices)."""
import json, struct
import numpy as np

def write_glb(path, meshes):
    """meshes: list of dict(name, positions[n,3] scene-space, normals, uvs, indices)."""
    bin_parts, views, accessors, gl_meshes, nodes = [], [], [], [], []
    offset = 0
    def add(arr, target, comp, typ, minmax=False):
        nonlocal offset
        data = np.ascontiguousarray(arr).tobytes()
        pad = (-len(data)) % 4
        views.append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(data), **({'target': target} if target else {})})
        bin_parts.append(data + b'\0' * pad); offset += len(data) + pad
        acc = {'bufferView': len(views) - 1, 'componentType': comp, 'count': len(arr), 'type': typ}
        if minmax:
            acc['min'] = arr.min(0).tolist(); acc['max'] = arr.max(0).tolist()
        accessors.append(acc)
        return len(accessors) - 1
    for m in meshes:
        attrs = {'POSITION': add(m['positions'].astype(np.float32), 34962, 5126, 'VEC3', True)}
        if m.get('normals') is not None:
            nrm = m['normals'].astype(np.float32)
            nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-6)
            attrs['NORMAL'] = add(nrm, 34962, 5126, 'VEC3')
        if m.get('uvs') is not None:
            attrs['TEXCOORD_0'] = add(m['uvs'].astype(np.float32), 34962, 5126, 'VEC2')
        prims = []
        for sec in m.get('sections') or [{'indices': m['indices'], 'material': 0}]:
            prims.append({'attributes': attrs, 'indices': add(sec['indices'].astype(np.uint32), 34963, 5125, 'SCALAR'), 'material': 0})
        gl_meshes.append({'name': m['name'], 'primitives': prims})
        nodes.append({'name': m['name'], 'mesh': len(gl_meshes) - 1})
    gltf = {'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes,
            'meshes': gl_meshes, 'materials': [{'pbrMetallicRoughness': {'baseColorFactor': [0.8, 0.8, 0.8, 1], 'metallicFactor': 0, 'roughnessFactor': 0.8}}],
            'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': offset}]}
    js = json.dumps(gltf).encode(); js += b' ' * ((-len(js)) % 4)
    binb = b''.join(bin_parts)
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binb))
    out += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binb), 0x004E4942) + binb
    open(path, 'wb').write(out)

def ue_to_scene(p):
    """Unreal (X fwd, Y right, Z up, cm) → scene (Y up), 1 unit = 512 uu."""
    return np.stack([p[:, 1], p[:, 2], -p[:, 0]], 1) / 512
