# Blender (headless) render of Tranquility Base on 20 July 1969, from NASA data.
# Terrain: LROC NAC DTM (2 m/px). Lander: NASA 3D Resources Apollo Lunar Module.
# Run: blender -b -P render_tranquility.py -- <out.png> [samples]
import bpy, json, math, sys, random
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/workspace/renders/tranquility_v1.png'
SAMPLES = int(argv[1]) if len(argv) > 1 else 128
D = '/workspace/data'
meta = json.load(open(f'{D}/apollo11/tile_a11.json'))
RANGE = meta['max'] - meta['min']
SIZE = (meta['size_px'] - 1) * meta['pixel_m']           # 2016 m
LM_Z = meta['lm'] - meta['min']

bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene

# ---------- terrain ----------
bpy.ops.mesh.primitive_grid_add(x_subdivisions=1008, y_subdivisions=1008, size=SIZE, calc_uvs=True)
ground = bpy.context.active_object
ground.name = 'Terrain'
img = bpy.data.images.load(f'{D}/apollo11/tile_a11_16bit.png')
img.colorspace_settings.name = 'Non-Color'
tex = bpy.data.textures.new('dtm', 'IMAGE'); tex.image = img; tex.extension = 'EXTEND'
m = ground.modifiers.new('dtm', 'DISPLACE'); m.texture = tex; m.texture_coords = 'UV'; m.mid_level = 0; m.strength = RANGE
# fine regolith relief the 2 m data cannot show
n = bpy.data.textures.new('micro', 'CLOUDS'); n.noise_scale = 0.6; n.noise_depth = 4
sub = ground.modifiers.new('sub', 'SUBSURF'); sub.levels = 0; sub.render_levels = 1; sub.subdivision_type = 'SIMPLE'
m2 = ground.modifiers.new('micro', 'DISPLACE'); m2.texture = n; m2.strength = 0.12; m2.mid_level = 0.5
bpy.ops.object.shade_smooth()

mat = bpy.data.materials.new('Regolith'); mat.use_nodes = True
nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
bsdf.inputs['Roughness'].default_value = 0.97
noise = nt.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 0.35; noise.inputs['Detail'].default_value = 8
ramp = nt.nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].color = (0.085, 0.082, 0.078, 1)
ramp.color_ramp.elements[1].color = (0.16, 0.155, 0.148, 1)
nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
nt.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.35
n2 = nt.nodes.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = 40; n2.inputs['Detail'].default_value = 12
nt.links.new(n2.outputs['Fac'], bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
ground.data.materials.append(mat)

# ---------- scattered rocks near the site ----------
random.seed(7)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1)
rock = bpy.context.active_object; rock.name = 'RockSrc'
dm = rock.modifiers.new('d', 'DISPLACE'); rt = bpy.data.textures.new('r', 'VORONOI'); rt.noise_scale = 0.6; dm.texture = rt; dm.strength = 0.35
rock.data.materials.append(mat)
rock.hide_render = True
def ground_z(x, y):
    hit, loc, *_ = ground.evaluated_get(bpy.context.evaluated_depsgraph_get()).ray_cast(Vector((x, y, 5000)), Vector((0, 0, -1)))
    return loc.z if hit else LM_Z
coll = bpy.data.collections.new('Rocks'); scn.collection.children.link(coll)
for i in range(900):
    r = 3 + random.random() ** 0.6 * 140
    a = random.random() * math.tau
    x, y = math.cos(a) * r, math.sin(a) * r
    s = 0.04 + random.random() ** 6 * 0.6
    o = rock.copy(); o.hide_render = False
    o.scale = (s * random.uniform(0.8, 1.4), s * random.uniform(0.8, 1.3), s * random.uniform(0.5, 0.9))
    o.rotation_euler = (random.random() * 3, random.random() * 3, random.random() * 3)
    o.location = (x, y, ground_z(x, y) + s * 0.15)
    coll.objects.link(o)

# ---------- lunar module (NASA 3D Resources) ----------
bpy.ops.import_scene.gltf(filepath=f'{D}/models/apollo_lm.glb')
parts = [o for o in bpy.context.selected_objects]
root = bpy.data.objects.new('LM', None); scn.collection.objects.link(root)
for o in parts:
    if o.parent is None: o.parent = root
bpy.context.view_layer.update()
pts = [o.matrix_world @ Vector(c) for o in parts if o.type == 'MESH' for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
h = hi.z - lo.z
k = 7.04 / h                                  # real LM height, footpad to top: about 7 m
root.scale = (k, k, k)
root.location = (-(lo.x + hi.x) / 2 * k, -(lo.y + hi.y) / 2 * k, LM_Z - lo.z * k - 0.15)
root.rotation_euler = (0, 0, math.radians(200))
print('LM raw height', h, 'scale', k)

# ---------- light: the Sun 11 degrees above the eastern horizon (local morning, as at landing) ----------
el = math.radians(11)
sun = bpy.data.lights.new('Sun', 'SUN'); sun.energy = 6.5; sun.angle = math.radians(0.53)
so = bpy.data.objects.new('Sun', sun); scn.collection.objects.link(so)
so.rotation_euler = Vector((-math.cos(el), 0, -math.sin(el))).to_track_quat('-Z', 'Y').to_euler()
scn.world = bpy.data.worlds.new('Space'); scn.world.use_nodes = True
bg = scn.world.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0, 0, 0, 1); bg.inputs['Strength'].default_value = 0

# ---------- camera: a photographer down-sun of the lander, eye height ----------
cx, cy = 17.0, -9.0
cam = bpy.data.cameras.new('Cam'); cam.lens = 30; cam.sensor_width = 36
co = bpy.data.objects.new('Cam', cam); scn.collection.objects.link(co)
co.location = (cx, cy, ground_z(cx, cy) + 1.6)
tgt = Vector((0, 0, LM_Z + 2.6))
co.rotation_euler = (tgt - co.location).to_track_quat('-Z', 'Y').to_euler()
scn.camera = co

# ---------- render ----------
scn.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
for dev_type in ('OPTIX', 'CUDA'):
    try:
        prefs.compute_device_type = dev_type; prefs.get_devices()
        if any(d.type == dev_type for d in prefs.devices): break
    except Exception: pass
for d in prefs.devices: d.use = d.type != 'CPU'
scn.cycles.device = 'GPU'
scn.cycles.samples = SAMPLES; scn.cycles.use_denoising = True
scn.render.resolution_x, scn.render.resolution_y = 1920, 1080
scn.view_settings.view_transform = 'AgX'; scn.view_settings.look = 'AgX - Medium High Contrast'
scn.view_settings.exposure = 0.3
scn.render.image_settings.file_format = 'PNG'
scn.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print('WROTE', OUT)
