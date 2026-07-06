#!/usr/bin/env python3
"""
THE FLY — zero-dependency glTF (.glb) generator.

Emits a VALID binary glTF 2.0 file (a low-poly crate) with POSITION, NORMAL and
indices, so the asset-loading pipeline (static/town/assets.js → FLY.assets) can be
proven end-to-end WITHOUT Blender, Node, or any pip install. This is the Sprint-0
"load at least one real GLTF asset in-game" gate probe — not a shipped art asset.

The real authoring path is tools/blender_export.py (headless bpy). This exists so
the pipeline is verifiable in any environment.

Usage:
    python3 tools/gen_gltf_box.py [out.glb]     # default: static/town/assets/crate.glb
"""
import json
import os
import struct
import sys

HALF = 0.5  # → a 1m crate (respects the town's toy scale; ART_BIBLE §3.4)

# 6 faces × 4 corners, each face flat-shaded (its own normal) so the ink outline
# pass gets clean per-face silhouettes.
FACES = [
    # (normal, [four corner offsets ccw])
    ((0, 0, 1),  [(-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]),   # +Z front
    ((0, 0, -1), [(1, -1, -1), (-1, -1, -1), (-1, 1, -1), (1, 1, -1)]),  # -Z back
    ((1, 0, 0),  [(1, -1, 1), (1, -1, -1), (1, 1, -1), (1, 1, 1)]),   # +X right
    ((-1, 0, 0), [(-1, -1, -1), (-1, -1, 1), (-1, 1, 1), (-1, 1, -1)]),  # -X left
    ((0, 1, 0),  [(-1, 1, 1), (1, 1, 1), (1, 1, -1), (-1, 1, -1)]),   # +Y top
    ((0, -1, 0), [(-1, -1, -1), (1, -1, -1), (1, -1, 1), (-1, -1, 1)]),  # -Y bottom
]


def build_geometry():
    positions, normals, indices = [], [], []
    for nrm, corners in FACES:
        base = len(positions) // 3
        for cx, cy, cz in corners:
            positions += [cx * HALF, cy * HALF, cz * HALF]
            normals += list(nrm)
        indices += [base, base + 1, base + 2, base, base + 2, base + 3]
    return positions, normals, indices


def pad4(b, fill=b"\x00"):
    while len(b) % 4:
        b += fill
    return b


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "static", "town", "assets", "crate.glb")
    os.makedirs(os.path.dirname(out), exist_ok=True)

    positions, normals, indices = build_geometry()

    idx_bytes = pad4(struct.pack("<%dH" % len(indices), *indices))
    pos_bytes = pad4(struct.pack("<%df" % len(positions), *positions))
    nrm_bytes = pad4(struct.pack("<%df" % len(normals), *normals))
    bin_blob = idx_bytes + pos_bytes + nrm_bytes

    pmin = [min(positions[i::3]) for i in range(3)]
    pmax = [max(positions[i::3]) for i in range(3)]

    gltf = {
        "asset": {"version": "2.0", "generator": "THE FLY gen_gltf_box.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "Crate"}],
        "meshes": [{"name": "Crate", "primitives": [{
            "attributes": {"POSITION": 1, "NORMAL": 2},
            "indices": 0, "material": 0, "mode": 4,
        }]}],
        "materials": [{
            "name": "CrateMat",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.847, 0.659, 0.467, 1.0],  # warm wall tone #d8a877
                "metallicFactor": 0.0, "roughnessFactor": 0.9,
            },
        }],
        "buffers": [{"byteLength": len(bin_blob)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(idx_bytes), "target": 34963},
            {"buffer": 0, "byteOffset": len(idx_bytes), "byteLength": len(pos_bytes), "target": 34962},
            {"buffer": 0, "byteOffset": len(idx_bytes) + len(pos_bytes), "byteLength": len(nrm_bytes), "target": 34962},
        ],
        "accessors": [
            {"bufferView": 0, "componentType": 5123, "count": len(indices), "type": "SCALAR"},
            {"bufferView": 1, "componentType": 5126, "count": len(positions) // 3, "type": "VEC3", "min": pmin, "max": pmax},
            {"bufferView": 2, "componentType": 5126, "count": len(normals) // 3, "type": "VEC3"},
        ],
    }

    json_bytes = pad4(json.dumps(gltf, separators=(",", ":")).encode("utf-8"), b" ")

    total = 12 + 8 + len(json_bytes) + 8 + len(bin_blob)
    with open(out, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))          # header: 'glTF', v2, length
        f.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))    # JSON chunk header
        f.write(json_bytes)
        f.write(struct.pack("<II", len(bin_blob), 0x004E4942))      # BIN chunk header
        f.write(bin_blob)

    print("wrote %s (%d bytes, %d verts, %d tris)" % (
        out, total, len(positions) // 3, len(indices) // 3))


if __name__ == "__main__":
    main()
