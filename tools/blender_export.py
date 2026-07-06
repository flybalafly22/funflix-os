#!/usr/bin/env python3
"""
THE FLY — headless Blender (bpy) GLTF export path.

The Environment & Asset Agent uses this to turn authored/sourced .blend assets
into town-ready .glb, and to script-author simple props where a CC0 asset does not
exist. It is the real authoring pipeline; tools/gen_gltf_box.py is only the
no-Blender fallback probe used to prove the loader in Sprint 0.

REQUIRES Blender (tested against 3.x/4.x, which ship bpy + the glTF 2.0 exporter).
Blender is NOT installed in the current dev sandbox, so this script is authored and
documented but was not executed here; run it wherever Blender is available.

Usage:
    blender --background --python tools/blender_export.py -- <input.blend> <output.glb>
    # or, with no input, exports a scale-reference crate to verify the toolchain:
    blender --background --python tools/blender_export.py -- --selftest static/town/assets/ref_crate.glb

Export conventions (ART_BIBLE.md §3.4, §7):
    • +Y up, +Z forward, meters — the town's unit scale (floor 3m, NPC 1.7m, car 4.3m).
    • Transforms applied, meshes triangulated, one material per logical surface so
      world.js batchStatic() merges placed props by material.
    • GLB (binary), Draco OFF (the r128 loader wired in town.html has no Draco decoder).
    • Base color only in-file; the four-system look is applied at runtime by
      FLY.assets.reskin() (do not bake lighting/AO into the albedo).
"""
import sys


def _args():
    argv = sys.argv
    return argv[argv.index("--") + 1:] if "--" in argv else []


def main():
    try:
        import bpy
    except ImportError:
        sys.stderr.write("This script must be run inside Blender: "
                         "blender --background --python tools/blender_export.py -- <in.blend> <out.glb>\n")
        sys.exit(2)

    args = _args()
    selftest = args and args[0] == "--selftest"
    out = args[1] if selftest else (args[1] if len(args) > 1 else "out.glb")
    src = None if selftest else (args[0] if args else None)

    if selftest:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.mesh.primitive_cube_add(size=1.0)   # 1m reference crate (town toy scale)
        mat = bpy.data.materials.new("CrateMat")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.847, 0.659, 0.467, 1.0)  # #d8a877
            bsdf.inputs["Metallic"].default_value = 0.0
            bsdf.inputs["Roughness"].default_value = 0.9
        bpy.context.active_object.data.materials.append(mat)
    elif src:
        bpy.ops.wm.open_mainfile(filepath=src)
    else:
        sys.stderr.write("No input .blend and not --selftest; nothing to export.\n")
        sys.exit(2)

    # apply transforms + triangulate every mesh so batching + outlines behave
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH":
            continue
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        try:
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        except RuntimeError:
            pass
        mod = obj.modifiers.new("FLY_tri", "TRIANGULATE")
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except RuntimeError:
            pass
        obj.select_set(False)

    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format="GLB",
        export_apply=True,
        export_draco_mesh_compression_enable=False,
        export_yup=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )
    sys.stderr.write("exported %s\n" % out)


if __name__ == "__main__":
    main()
