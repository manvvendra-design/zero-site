# Zero Universe: NASA's free Apollo Lunar Module model (NASA-3D-Resources) made game-ready in Blender.
# Real size, split into descent and ascent stages, physically based materials, crinkled foil and
# ambient-occlusion (soft contact shadow) baked into textures. Nothing here is AI-generated.
import bpy, bmesh, sys, math, mathutils
src, outdir = sys.argv[-2], sys.argv[-1]
RES = 2048; SCALE = 1.38; CUT = 3.02  # metres: parts that start above the deck belong to the ascent stage
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
meshes = [o for o in sc.objects if o.type == 'MESH']
for o in meshes:
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
for o in [o for o in sc.objects if o.type != 'MESH']: bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
lm = bpy.context.active_object
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
lm.data.transform(mathutils.Matrix.Scale(SCALE, 4))
zmin = min(v.co.z for v in lm.data.vertices)
lm.data.transform(mathutils.Matrix.Translation((0, 0, -zmin)))
# split into loose parts, then regroup by stage
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.0005)
bpy.ops.mesh.separate(type='LOOSE'); bpy.ops.object.mode_set(mode='OBJECT')
parts = [o for o in sc.objects if o.type == 'MESH']
asc, desc = [], []
for o in parts:
    zs = [ (o.matrix_world @ v.co).z for v in o.data.vertices ]
    (asc if min(zs) > CUT else desc).append(o)
def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join()
    o = bpy.context.active_object; o.name = name; o.data.name = name; return o
D = join(desc, 'descent'); A = join(asc, 'ascent')
# pieces of the cabin's grey skin that hang below the deck line: move them to the ascent stage too
# (not the porch rails at the front, -Y, and not the black thruster deflectors on the corners)
grey = {i for i, m in enumerate(D.data.materials) if m and m.name.split('.')[0] in ('blinn4SG', 'blinn3SG', 'initialShadingGr', 'blinn2SG')}
bpy.ops.object.select_all(action='DESELECT'); D.select_set(True); bpy.context.view_layer.objects.active = D
bm = bmesh.new(); bm.from_mesh(D.data)
islands, seen = [], set()
for f in bm.faces:
    if f.index in seen: continue
    st, isl = [f], []; seen.add(f.index)
    while st:
        g = st.pop(); isl.append(g)
        for v in g.verts:
            for h in v.link_faces:
                if h.index not in seen: seen.add(h.index); st.append(h)
    islands.append(isl)
for f in bm.faces: f.select = False
moved = 0
for isl in islands:
    zs = [v.co.z for f in isl for v in f.verts]; ys = [v.co.y for f in isl for v in f.verts]
    if max(zs) > 3.3 and min(ys) > -1.5 and all(f.material_index in grey for f in isl):
        for f in isl: f.select = True
        moved += len(isl)
bm.to_mesh(D.data); bm.free()
print('moved to ascent', moved)
if moved:
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.separate(type='SELECTED'); bpy.ops.object.mode_set(mode='OBJECT')
    extra = [o for o in sc.objects if o.type == 'MESH' and o not in (D, A)]
    A = join([A] + extra, 'ascent')
print('descent faces', len(D.data.polygons), 'ascent faces', len(A.data.polygons))

# physically based materials (base colour, metal, roughness), with crinkled foil on the blankets
def setup(m, base, metal, rough, foil=0.0):
    nt = m.node_tree; b = nt.nodes.get('Principled BSDF')
    if not any(n.type == 'TEX_IMAGE' for n in nt.nodes): b.inputs['Base Color'].default_value = (*base, 1)
    b.inputs['Metallic'].default_value = metal; b.inputs['Roughness'].default_value = rough
    if foil > 0:
        tc = nt.nodes.new('ShaderNodeTexCoord')
        n1 = nt.nodes.new('ShaderNodeTexNoise'); n1.inputs['Scale'].default_value = 3.0; n1.inputs['Detail'].default_value = 8; n1.inputs['Roughness'].default_value = 0.62
        vo = nt.nodes.new('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = 7.0; vo.feature = 'F1'
        mx = nt.nodes.new('ShaderNodeMath'); mx.operation = 'ADD'
        bu = nt.nodes.new('ShaderNodeBump'); bu.inputs['Strength'].default_value = foil; bu.inputs['Distance'].default_value = 0.02
        nt.links.new(tc.outputs['Object'], n1.inputs['Vector']); nt.links.new(tc.outputs['Object'], vo.inputs['Vector'])
        nt.links.new(n1.outputs['Fac'], mx.inputs[0]); nt.links.new(vo.outputs['Distance'], mx.inputs[1])
        nt.links.new(mx.outputs[0], bu.inputs['Height']); nt.links.new(bu.outputs['Normal'], b.inputs['Normal'])
for m in bpy.data.materials:
    if not m.node_tree or not m.node_tree.nodes.get('Principled BSDF'): continue
    c = tuple(m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value)[:3]
    if c[0] > 0.7 and c[2] < 0.1: setup(m, (0.86, 0.6, 0.2), 1.0, 0.3, 0.55)        # gold Kapton foil, descent stage
    elif c[0] > 0.6 and c[2] < 0.05: setup(m, (0.72, 0.45, 0.14), 1.0, 0.35, 0.35)  # amber foil and struts
    elif c[0] > 0.9 and c[2] > 0.5 and c[2] < 0.6: setup(m, (0.9, 0.86, 0.6), 0.9, 0.3)
    elif c[0] < 0.1: setup(m, (0.025, 0.025, 0.028), 0.2, 0.42, 0.3)               # black thermal blanket
    elif c[0] < 0.3: setup(m, (0.2, 0.2, 0.21), 0.6, 0.5)
    elif c[0] > 0.95: setup(m, (0.85, 0.85, 0.83), 0.1, 0.6)
    else: setup(m, (c[0] * 0.9, c[1] * 0.9, c[2] * 0.92), 0.55, 0.45)               # anodised aluminium panels of the cabin

# second UV map for the baked textures
for o in (D, A):
    uv = o.data.uv_layers.new(name='bake'); o.data.uv_layers.active = uv
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.002, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')

# the ground, only as a shadow-caster for the bake
bpy.ops.mesh.primitive_plane_add(size=60); ground = bpy.context.active_object
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 48
sc.render.bake.margin = 6
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (1, 1, 1, 1)

def bake(o, kind, name, hide=()):
    img = bpy.data.images.new(name, RES, RES, alpha=False, float_buffer=False)
    img.colorspace_settings.name = 'Non-Color'
    nodes = []
    for m in o.data.materials:
        if not m: continue
        n = m.node_tree.nodes.new('ShaderNodeTexImage'); n.image = img
        uvn = m.node_tree.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'bake'; m.node_tree.links.new(uvn.outputs['UV'], n.inputs['Vector'])
        m.node_tree.nodes.active = n; nodes.append((m, n, uvn))
    for h in hide: h.hide_render = True
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    if kind == 'AO':
        sc.world.light_settings.distance = 1.2
        bpy.ops.object.bake(type='AO', uv_layer='bake')
    else:
        bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT', uv_layer='bake')
    for h in hide: h.hide_render = False
    img.filepath_raw = f'{outdir}/{name}.png'; img.file_format = 'PNG'; img.save()
    for m, n, uvn in nodes: m.node_tree.nodes.remove(n); m.node_tree.nodes.remove(uvn)
    print('baked', name)

bake(D, 'AO', 'lm_descent_ao', hide=(A,))   # as it stands today, without the cabin on top
bake(D, 'NORMAL', 'lm_descent_nrm')
bake(A, 'AO', 'lm_ascent_ao')
bake(A, 'NORMAL', 'lm_ascent_nrm')
bpy.data.objects.remove(ground)
# export: glTF uses Y up; Blender -Y (the ladder side) becomes +Z, same as the game's ladder leg
for o in (D, A):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    for m in o.data.materials:   # export plain PBR values; the foil bump is in the baked normal map
        if m: 
            b = m.node_tree.nodes['Principled BSDF']
            for l in list(b.inputs['Normal'].links): m.node_tree.links.remove(l)
    bpy.ops.export_scene.gltf(filepath=f'{outdir}/lm_{o.name}.glb', use_selection=True, export_format='GLB', export_texcoords=True, export_normals=True, export_apply=True, export_yup=True)
print('done')
