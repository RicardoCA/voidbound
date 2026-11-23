"""Gera a plataforma modular editável, o GLB do jogo e uma prévia."""
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/blender/elevador-modular.blend"
MODEL = ROOT / "public/models/equipamentos-base/elevador-modular.glb"

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
parts = []


def material(name, color, metallic=0, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    shader = mat.node_tree.nodes["Principled BSDF"]
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = .48
    shader.inputs["Emission Color"].default_value = (*color, 1)
    shader.inputs["Emission Strength"].default_value = emission
    return mat


steel = material("Aço azulado", (.12, .21, .26), .72)
frame = material("Chassi grafite", (.044, .071, .084), .68)
rubber = material("Piso antiderrapante", (.076, .102, .113), .18)
amber = material("Sinalização âmbar", (.90, .45, .078), .25)
mint = material("Luzes de bordo", (.19, .84, .68), .2, 1.4)
fastener = material("Fixações de titânio", (.34, .43, .48), .75)


def box(name, xyz, size, mat, bevel=0, angle=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler.z = angle
    obj.data.materials.append(mat)
    if bevel:
        edge = obj.modifiers.new("Chanfros", "BEVEL")
        edge.width, edge.segments = bevel, 1
    return obj


def part(name, xyz, size, mat, bevel=0, angle=0):
    parts.append(box(name, xyz, size, mat, bevel, angle))


part("Bandeja do chassi", (0, 0, .063), (.94, .94, .086), frame, .024)
part("Carcaça do motor", (0, 0, .019), (.35, .42, .038), steel, .012)
for x in [-.27, .27]:
    part("Sapata da guia", (x, 0, .033), (.115, .74, .046), steel, .012)
for side in [-1, 1]:
    part("Longarina lateral", (side * .443, 0, .089), (.09, .78, .066), steel, .014)
    part("Travessa", (0, side * .443, .089), (.78, .09, .066), steel, .014)
    part("Luz lateral", (side * .49, 0, .085), (.007, .29, .019), mint, .004)
    part("Luz de aproximação", (0, side * .49, .085), (.29, .007, .019), mint, .004)
    for other in [-1, 1]:
        x, y = side * .417, other * .417
        part("Protetor de canto", (x, y, .088), (.142, .142, .072), amber, .019)
        part("Parafuso de canto", (x, y, .123), (.036, .036, .004), fastener, .002, .7854)
        for shift in [-.04, .04]:
            part("Ranhura da travessa", (side * .28 + shift, other * .443, .123), (.032, .055, .004), frame, .002, .38)

for x in [-.247, 0, .247]:
    part("Painel do piso", (x, 0, .112), (.232, .73, .018), rubber, .007)
    for y in [-.27, -.18, -.09, 0, .09, .18, .27]:
        part("Ressalto antiderrapante", (x, y, .122), (.12, .018, .006), fastener, .002, .32 if x >= 0 else -.32)

floor = material("Fundo da prévia", (.021, .033, .043))
box("Piso da prévia", (0, 0, -.026), (200, 200, .05), floor)
scene.world = bpy.data.worlds.new("Ambiente")
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .32


def aim(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()


for name, xyz, power, size, color in [
    ("Luz principal", (0, -2, 3), 230, 3, (.91, .98, 1)),
    ("Recorte", (-2, 2, 1.6), 180, 2, (.56, .90, 1)),
    ("Preenchimento", (2, 0, 1.4), 70, 2, (1, .79, .54)),
]:
    lamp = bpy.data.lights.new(name, "AREA")
    lamp.energy, lamp.size, lamp.color = power, size, color
    obj = bpy.data.objects.new(name, lamp)
    scene.collection.objects.link(obj)
    obj.location = xyz
    aim(obj, (0, 0, 0))

camera = bpy.data.objects.new("Câmera da prévia", bpy.data.cameras.new("Câmera da prévia"))
scene.collection.objects.link(camera)
camera.location = (1.6, -2.3, 1.85)
aim(camera, (0, 0, .02))
camera.data.type, camera.data.ortho_scale = "ORTHO", 1.64
scene.camera = camera
scene.render.engine = "CYCLES"
scene.cycles.samples = 16
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 960, 740
scene.render.resolution_percentage = 100
scene.render.filepath = "//elevador-modular-previa.png"
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
# Bake the bevels and merge the deck into one mesh for the runtime.
bpy.ops.object.select_all(action="DESELECT")
for obj in parts:
    bpy.context.view_layer.objects.active = obj
    for modifier in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
bpy.context.object.name = "Plataforma modular"
MODEL.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(MODEL), use_selection=True)
if "--preview" in sys.argv:
    bpy.ops.render.render(write_still=True)
