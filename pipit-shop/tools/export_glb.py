import numpy as np, json, struct, trimesh
import assemble as A

def normals(v, f):
    return np.asarray(trimesh.Trimesh(v, f, process=False).vertex_normals, np.float32)

def pack(meshes):
    """meshes: [(name, v_m, f, material_idx)] -> glb bytes"""
    bin_ = bytearray(); views = []; accs = []; prims_by_mesh = []
    def add_view(data, target):
        while len(bin_) % 4: bin_.append(0)
        off = len(bin_); bin_.extend(data)
        views.append({"buffer": 0, "byteOffset": off, "byteLength": len(data), "target": target})
        return len(views) - 1
    for name, v, f, mat in meshes:
        v = v.astype(np.float32); n = normals(v, f); idx = f.astype(np.uint32).ravel()
        pv = add_view(v.tobytes(), 34962); nv = add_view(n.tobytes(), 34962); iv = add_view(idx.tobytes(), 34963)
        accs.append({"bufferView": pv, "componentType": 5126, "count": len(v), "type": "VEC3", "min": v.min(0).tolist(), "max": v.max(0).tolist()})
        accs.append({"bufferView": nv, "componentType": 5126, "count": len(v), "type": "VEC3"})
        accs.append({"bufferView": iv, "componentType": 5125, "count": len(idx), "type": "SCALAR"})
        a = len(accs) - 3
        prims_by_mesh.append({"name": name, "primitives": [{"attributes": {"POSITION": a, "NORMAL": a + 1}, "indices": a + 2, "material": mat}]})
    mats = [
        {"name": "Frame_black_acetate", "doubleSided": False,
         "pbrMetallicRoughness": {"baseColorFactor": [0.006, 0.006, 0.007, 1], "metallicFactor": 0, "roughnessFactor": 0.16},
         "extensions": {"KHR_materials_clearcoat": {"clearcoatFactor": 1, "clearcoatRoughnessFactor": 0.04}}},
        {"name": "Lens_green", "doubleSided": True, "alphaMode": "BLEND",
         "pbrMetallicRoughness": {"baseColorFactor": [0.020, 0.046, 0.026, 0.9], "metallicFactor": 0, "roughnessFactor": 0.05},
         "extensions": {"KHR_materials_clearcoat": {"clearcoatFactor": 1, "clearcoatRoughnessFactor": 0.02}}},
        {"name": "Metal_silver_engraved", "doubleSided": False,
         "pbrMetallicRoughness": {"baseColorFactor": [0.80, 0.81, 0.83, 1], "metallicFactor": 1, "roughnessFactor": 0.26}},
    ]
    nodes = [{"name": "Sunglasses", "children": list(range(1, len(meshes) + 1))}] + [{"name": m["name"], "mesh": i} for i, m in enumerate(prims_by_mesh)]
    gltf = {"asset": {"version": "2.0", "generator": "pipit-gen"}, "scene": 0, "scenes": [{"nodes": [0]}], "nodes": nodes,
            "meshes": prims_by_mesh, "materials": mats, "accessors": accs, "bufferViews": views,
            "buffers": [{"byteLength": len(bin_)}], "extensionsUsed": ["KHR_materials_clearcoat"]}
    js = json.dumps(gltf, separators=(",", ":")).encode()
    while len(js) % 4: js += b" "
    while len(bin_) % 4: bin_.append(0)
    total = 12 + 8 + len(js) + 8 + len(bin_)
    return struct.pack("<III", 0x46546C67, 2, total) + struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(bin_), 0x004E4942) + bytes(bin_)

fr, le, me = A.load()
mm = 1e-3
def M(lst):
    v, f = A.merge(lst); return v * mm, f
meshes = [("Frame", *M(fr), 0), ("Lenses", *M(le), 1), ("Metal", *M(me), 2)]
data = pack(meshes)
open("aviator.glb", "wb").write(data)
print(len(data) / 1e6, "MB", [len(m[2]) for m in meshes])
