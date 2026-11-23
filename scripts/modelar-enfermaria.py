"""Gera a Câmara de Enfermaria editável, o GLB do jogo e uma prévia."""
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/blender/camara-enfermaria.blend"
MODEL = ROOT / "public/models/equipamentos-base/camara-enfermaria.glb"

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


shell = material("Esmalte cerâmico", (.64, .76, .75), .25)
base = material("Chassi grafite", (.045, .077, .105), .5)
seal = material("Vedação de borracha", (.032, .059, .066))
glass = material("Visor azul-petróleo", (.05, .29, .31), .52)
mint = material("Iluminação clínica", (.19, .90, .71), .1, 1.6)
coral = material("Sinalização médica", (.85, .11, .16), .25)
fastener = material("Titânio escovado", (.34, .43, .48), .7)


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
        edge.width, edge.segments = bevel, 3
    return obj


def part(name, xyz, size, mat, bevel=0, angle=0):
    parts.append(box(name, xyz, size, mat, bevel, angle))


part("Chassi inferior", (0, 0, .115), (1.79, .78, .20), base, .073)
part("Carroceria", (0, 0, .31), (1.82, .79, .33), shell, .103)
part("Junta da escotilha", (.19, 0, .46), (1.29, .65, .17), seal, .075)
part("Cúpula de observação", (.22, 0, .57), (1.22, .60, .29), glass, .133)
part("Estribo frontal", (.23, -.41, .17), (.91, .13, .09), base, .025)
for x in [-.69, .69]:
    for y in [-.28, .28]:
        part("Pé nivelador", (x, y, .038), (.24, .18, .076), fastener, .021)
for y in [-.377, .377]:
    part("Faixa luminosa da escotilha", (.24, y, .451), (1.05, .018, .016), mint, .005)
    part("Emblema médico horizontal", (-.55, y * 1.043, .328), (.206, .013, .061), coral, .005)
    part("Emblema médico vertical", (-.55, y * 1.044, .328), (.061, .013, .206), coral, .005)
for x in [.61, .67, .73]:
    part("Respiro frontal", (x, -.396, .275), (.023, .016, .079), seal, .006)
part("Console de triagem", (-.61, 0, .55), (.31, .52, .24), shell, .065)
part("Moldura do monitor", (-.62, -.104, .674), (.248, .242, .031), seal, .012)
part("Tela de diagnóstico", (-.62, -.108, .693), (.21, .184, .012), glass, .007)
for x, length in [(-.685, .043), (-.62, .115), (-.555, .057)]:
    part("Indicador biométrico", (x, -.107, .701), (.014, length, .008), mint, .002)
for x in [-.69, -.62, -.55]:
    part("Tecla clínica", (x, .075, .679), (.041, .038, .017), fastener, .006)
for y in [-.21, .21]:
    part("Trava da cúpula", (.76, y, .478), (.14, .10, .096), fastener, .018)
part("Alça da escotilha", (.45, -.342, .50), (.39, .069, .035), fastener, .012)

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
camera.location = (1.7, -3.2, 2.2)
aim(camera, (0, 0, .30))
camera.data.type, camera.data.ortho_scale = "ORTHO", 2.43
scene.camera = camera
scene.render.engine = "CYCLES"
scene.cycles.samples = 16
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 960, 740
scene.render.resolution_percentage = 100
scene.render.filepath = "//camara-enfermaria-previa.png"
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
# Bake the bevels and merge the chamber into one mesh for the runtime.
bpy.ops.object.select_all(action="DESELECT")
for obj in parts:
    bpy.context.view_layer.objects.active = obj
    for modifier in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
bpy.context.object.name = "Câmara de Enfermaria"
MODEL.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(MODEL), use_selection=True)
if "--preview" in sys.argv:
    bpy.ops.render.render(write_still=True)
