"""Cria a cena editável e as duas prévias dos sabres fotônicos no Blender."""
from math import cos, pi, sin
from pathlib import Path
import sys

import bpy
from mathutils import Quaternion, Vector

OUT = Path(__file__).resolve().parents[1] / "assets" / "blender"
MODELS = OUT.parents[1] / "public" / "models" / "sabres"
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def material(name, hex_color, metal=0.0, roughness=0.4, glow=0.0):
    srgb = [int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    rgb = tuple(c / 12.92 if c < .04045 else ((c + .055) / 1.055) ** 2.4 for c in srgb)
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    shader.inputs["Metallic"].default_value = metal
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Emission Color"].default_value = (*rgb, 1)
    shader.inputs["Emission Strength"].default_value = glow
    return mat


def collection(name):
    result = bpy.data.collections.new(name)
    scene.collection.children.link(result)
    return result


def move_to(obj, group):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    group.objects.link(obj)


class Saber:
    def __init__(self, label, x):
        self.group = collection(label)
        self.grip = bpy.data.objects.new(label, None)
        self.group.objects.link(self.grip)
        self.grip.location.x = x
        self.grip.rotation_euler = (.07, -.10, .21)

    def finish(self, name, mat, bevel=0):
        obj = bpy.context.object
        obj.name = name
        obj.data.materials.append(mat)
        obj.parent = self.grip
        move_to(obj, self.group)
        if bevel:
            modifier = obj.modifiers.new("Chanfros", "BEVEL")
            modifier.width = bevel
            modifier.segments = 2
            normals = obj.modifiers.new("Normais ponderadas", "WEIGHTED_NORMAL")
            normals.keep_sharp = True
        return obj

    def ring(self, name, z, height, lower, upper, mat, sides=32, bevel=.018):
        bpy.ops.mesh.primitive_cone_add(vertices=sides, radius1=lower, radius2=upper,
                                        depth=height, location=(0, 0, z))
        obj = self.finish(name, mat, bevel)
        for face in obj.data.polygons:
            face.use_smooth = sides > 12 and len(face.vertices) == 4
        return obj

    def panel(self, name, angle, radius, z, width, thick, height, mat, bevel=.023):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(radius * sin(angle), -radius * cos(angle), z))
        obj = bpy.context.object
        obj.scale = (width, thick, height)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        obj.rotation_euler.z = angle
        return self.finish(name, mat, bevel)

    def blade(self, start, length, radius, mat):
        self.ring("Lâmina · corpo", start + length / 2, length, radius, radius * .84, mat, bevel=0)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12,
                                             location=(0, 0, start + length))
        obj = self.finish("Lâmina · ponta arredondada", mat)
        obj.scale = (radius * .84, radius * .84, radius * 1.2)
        for face in obj.data.polygons:
            face.use_smooth = True


graphite = material("Grafite microtexturizado", "353E48", .48, .43)
rubber = material("Empunhadura de elastômero", "20252C", .02, .72)
steel = material("Titânio acetinado", "9DAEB9", .72, .27)
configurations = [
    ("Anã vermelha", "FF765F", "823A3D", 2.95, .088),
    ("Estrela amarela", "FFC75F", "AB8143", 3.30, .096),
    ("Estrela azul", "7DBBFF", "42739D", 3.42, .086),
    ("Gigante vermelha", "FF9952", "9D5938", 3.30, .124),
    ("Anã branca", "E9F5FF", "A9BAC3", 3.20, .080),
    ("Estrela de nêutrons", "CE9BFF", "6A557F", 3.38, .087),
]


def export_models():
    """Bate os chanfros e agrupa as malhas para o carregador do jogo."""
    bpy.ops.wm.open_mainfile(filepath=str(OUT / "sabres-fotonicos.blend"))
    MODELS.mkdir(parents=True, exist_ok=True)
    variants = ("red", "yellow", "blue", "giant", "white", "neutron")
    for variant, (label, *_) in zip(variants, configurations, strict=True):
        group = bpy.data.collections[label]
        root = group.objects[label]
        root.location = (0, 0, -.74)
        root.rotation_euler = (0, 0, 0)
        parts = [obj for obj in group.objects if obj.type == "MESH"]
        bpy.context.view_layer.update()
        baked = []
        for obj in parts:
            bpy.ops.object.select_all(action="DESELECT")
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.convert(target="MESH")
            obj.parent = None
            obj.location.z -= .74
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        batches = {
            "Empunhadura": [obj for obj in parts if not obj.name.startswith("Lâmina ·")],
            "Lamina": [obj for obj in parts if obj.name.startswith("Lâmina ·")],
        }
        for name, batch in batches.items():
            bpy.ops.object.select_all(action="DESELECT")
            for obj in batch:
                obj.select_set(True)
            bpy.context.view_layer.objects.active = batch[0]
            bpy.ops.object.join()
            mesh = bpy.context.object
            mesh.name = name
            if name == "Lamina":
                shader = mesh.data.materials[0].node_tree.nodes.get("Principled BSDF")
                shader.inputs["Emission Strength"].default_value = 1.25
            baked.append(mesh)
        bpy.ops.object.select_all(action="DESELECT")
        for obj in baked:
            obj.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(MODELS / f"{variant}.glb"),
                                  export_format="GLB", use_selection=True)
        for obj in baked:
            bpy.data.objects.remove(obj, do_unlink=True)


if "--export" in sys.argv:
    export_models()
    sys.exit()

spacing = 1.58
for index, (name, color, casing, length, radius) in enumerate(configurations):
    saber = Saber(name, (index - 2.5) * spacing)
    blade = material(f"{name} · plasma", color, roughness=.3, glow=7)
    trim = material(f"{name} · liga", casing, .6, .29)
    signal = material(f"{name} · indicador", color, .1, .28, 1.4)
    ring = saber.ring
    sides = [8, 32, 12, 8, 32, 6][index]
    grip_radius = [.20, .20, .18, .24, .17, .19][index]
    ring("Estrutura central", .78, 1.43, grip_radius, grip_radius, graphite, sides)
    ring("Tampa inferior", .13, .23, grip_radius + .045, grip_radius + .03, trim, sides)
    ring("Anel inferior", .28, .055, grip_radius + .035, grip_radius + .035, steel, sides)
    ring("Base do emissor", 1.38, .23, grip_radius + .01, .24, trim, sides)

    if index in (0, 3):
        for groove in range(6):
            z = .40 + groove * .118
            ring("Aro da empunhadura", z, .075, grip_radius + .025, grip_radius + .025, rubber, sides)
    elif index in (1, 4):
        ring("Capa de borracha", .72, .82, grip_radius + .013, grip_radius + .013, rubber)
        for angle in (-1.48, -.73, .73, 1.48, 2.26, 3.14, 4.02):
            saber.panel("Trilho longitudinal", angle, grip_radius, .73, .075, .064, .77, trim)
    else:
        for side in range(6):
            angle = side * pi / 3 - .22
            for segment in range(3):
                saber.panel("Placa segmentada", angle, grip_radius * .88,
                            .46 + segment * .29, .12, .083, .24, trim if segment == 1 else rubber)

    saber.panel("Placa do intertravamento", -.12, grip_radius + .022, 1.11, .145, .07, .26, steel)
    saber.panel("Ativador iluminado", -.12, grip_radius + .060, 1.135, .065, .037, .103, signal, .012)
    ring("Isolador do emissor", 1.53, .11, .16, .17, graphite)
    ring("Anel de foco", 1.606, .045, .174, .174, signal, bevel=.008)

    if index == 1:
        ring("Bocal expandido", 1.70, .17, .19, .27, trim)
        ring("Borda do bocal", 1.79, .045, .267, .267, steel, bevel=.009)
    elif index == 2:
        for side in range(3):
            angle = side * 2 * pi / 3 + .22
            prong = saber.panel("Haste de contenção", angle, .202, 1.72, .10, .112, .33, steel)
            prong.rotation_euler.rotate_axis("X", -.19)
    elif index == 3:
        ring("Colar blindado", 1.65, .20, .32, .30, trim, 8)
        for side in range(8):
            saber.panel("Aleta de resfriamento", side * pi / 4, .276, 1.65, .128, .097, .16, graphite)
        ring("Borda blindada", 1.76, .03, .27, .27, steel, 8, .008)
    elif index == 4:
        ring("Gargalo torneado", 1.66, .13, .16, .21, steel)
        ring("Disco de foco", 1.75, .09, .24, .24, trim)
    elif index == 5:
        for side in range(4):
            angle = side * pi / 2 + .36
            saber.panel("Pétala do emissor", angle, .219, 1.74, .185, .088, .30, trim, .035)
            saber.panel("Janela de contenção", angle, .267, 1.77, .087, .022, .135, signal, .01)
    else:
        ring("Bocal chanfrado", 1.70, .17, .26, .21, trim, 8)
        for side in range(4):
            saber.panel("Inserto do bocal", side * pi / 2 + .36, .228, 1.71, .09, .06, .11, steel)

    ring("Núcleo do projetor", 1.79, .055, radius * 1.3, radius * 1.3, signal, bevel=.01)
    saber.blade(1.80, length, radius, blade)

studio = collection("Estúdio e prévias")
letter = material("Tipografia clara", "BBCEDE", roughness=1, glow=.75)
muted = material("Tipografia de legenda", "7690AA", roughness=1, glow=.65)
backdrop = material("Fundo azul grafite", "111D2D", roughness=.95)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 2.4, 0), rotation=(pi / 2, 0, 0))
bpy.context.object.name = "Fundo do estúdio"
bpy.context.object.data.materials.append(backdrop)
move_to(bpy.context.object, studio)


def text(body, x, z, size, mat, align="LEFT"):
    data = bpy.data.curves.new(body, "FONT")
    data.body, data.size, data.align_x = body, size, align
    obj = bpy.data.objects.new(body, data)
    studio.objects.link(obj)
    obj.location = (x, -0.3, z)
    obj.rotation_euler.x = pi / 2
    data.materials.append(mat)
    return obj


for i, (name, *_) in enumerate(configurations):
    text(name, (i - 2.5) * spacing, -.36, .145, letter, "CENTER")

title = text("SABRES FOTÔNICOS", -4.77, 5.83, .33, letter)
subtitle = text("VOIDBOUND  /  SEIS CLASSES ESTELARES", -4.76, 5.54, .132, muted)
detail_title = text("EMPUNHADURAS E EMISSORES", -4.77, 2.65, .30, letter)
detail_subtitle = text("VOIDBOUND  /  DETALHES DOS MODELOS", -4.76, 2.40, .132, muted)


def camera(name, z):
    data = bpy.data.cameras.new(name)
    data.type, data.ortho_scale = "ORTHO", 10.25
    obj = bpy.data.objects.new(name, data)
    studio.objects.link(obj)
    obj.location = (0, -16, z)
    obj.rotation_euler.x = pi / 2
    return obj


def area(name, location, target, power, size, color):
    data = bpy.data.lights.new(name, "AREA")
    data.energy, data.shape, data.size, data.color = power, "DISK", size, color
    obj = bpy.data.objects.new(name, data)
    studio.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


area("Luz principal", (-3, -5, 5), (0, 0, 1), 780, 7, (.85, .93, 1))
area("Preenchimento", (4, -4, 1), (1, 0, 1), 420, 5, (.66, .79, 1))
area("Contorno quente", (1, 1.6, 4), (0, 0, 1), 790, 6, (1, .78, .62))
area("Reflexo frontal", (-2, -3, -.8), (0, 0, 1), 170, 4, (1, .88, .71))

scene.world = bpy.data.worlds.new("Ambiente do estúdio")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .26
scene.render.engine = "CYCLES"
scene.cycles.samples = 20
scene.cycles.use_denoising = True
scene.render.resolution_percentage = 100
scene.render.resolution_x = 1600
scene.view_settings.view_transform = "AgX"
scene.render.image_settings.file_format = "PNG"

composite = bpy.data.node_groups.new("Halo das lâminas", "CompositorNodeTree")
scene.compositing_node_group = composite
composite.interface.new_socket(name="Image", in_out="OUTPUT", socket_type="NodeSocketColor")
render = composite.nodes.new("CompositorNodeRLayers")
glare = composite.nodes.new("CompositorNodeGlare")
glare.inputs["Type"].default_value = "Fog Glow"
glare.inputs["Threshold"].default_value = 1.1
glare.inputs["Strength"].default_value = .60
output = composite.nodes.new("NodeGroupOutput")
composite.links.new(render.outputs["Image"], glare.inputs["Image"])
composite.links.new(glare.outputs["Image"], output.inputs["Image"])

front = camera("Prévia geral", 2.76)
close = camera("Close dos punhos", 1.10)
scene.camera = front
scene.render.resolution_y = 1100
scene.render.filepath = "//sabres-fotonicos-previa.png"
for obj in (detail_title, detail_subtitle):
    obj.hide_render = True

for screen in bpy.data.screens:
    for area_view in screen.areas:
        if area_view.type == "VIEW_3D":
            view = area_view.spaces.active
            view.region_3d.view_rotation = Quaternion((1, 0, 0), pi / 2)
            view.region_3d.view_location = (0, 0, 2.65)
            view.region_3d.view_distance = 11
            view.shading.color_type = "MATERIAL"
            view.overlay.show_overlays = False
            for obj in studio.objects:
                obj.hide_set(True)

bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "sabres-fotonicos.blend"))
bpy.ops.render.render(write_still=True)

scene.camera = close
scene.render.resolution_y = 575
scene.render.filepath = "//sabres-fotonicos-punhos.png"
for obj in (title, subtitle):
    obj.hide_render = True
for obj in (detail_title, detail_subtitle):
    obj.hide_render = False
for obj in scene.objects:
    if obj.name.startswith("Lâmina ·"):
        obj.hide_render = True
bpy.ops.render.render(write_still=True)
