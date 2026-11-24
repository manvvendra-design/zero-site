# 3D models

`lm_descent.glb`, `lm_ascent.glb` and their `_ao` / `_nrm` textures come from NASA's free
**Apollo Lunar Module** model in [NASA-3D-Resources](https://github.com/nasa/NASA-3D-Resources)
(`3D Models/Apollo Lunar Module`). NASA's media guidelines allow free use; the NASA insignia is not used
and nothing implies NASA endorsement.

Made game-ready in Blender 5.3 by `tools/blender/prep_lm.py` (run with the `bpy` Python module):
- Draco compression removed first with `tools/blender/undraco.mjs` (gltf-transform), since Blender's
  Python module ships without the Draco library.
- Scaled ×1.38 to the real height (about 7 m) and set on the ground.
- Split into the descent stage (still on the Moon today) and the ascent stage (crew cabin).
- Physically based metal and roughness values; crinkled foil on the blankets baked into a normal map.
- Ambient occlusion (soft contact shadow) baked with Cycles into a second UV map.
- Then `gltf-transform dedup` and `quantize`.

No AI-generated geometry or textures.
