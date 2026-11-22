"""Modelos editáveis e prancha de revisão do cercado de cultivo do Voidbound."""
from math import radians, pi, sin
from pathlib import Path
from random import Random
import sys

import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parents[1] / "assets" / "blender"
MODELS = OUT.parents[1] / "public" / "models" / "equipamentos-base"


def export_wood_texture(mat, base, bright):
    image = bpy.data.images.new(mat.name, width=64, height=64, alpha=False)
    rng = Random(mat.name)
    pixels = []
    for y in range(64):
        for x in range(64):
            grain = .48 + .18 * sin(y * 1.53 + sin(x * .14)) + rng.uniform(-.07, .07)
            pixels.extend([lo + (hi - lo) * grain for lo, hi in zip(base, bright)] + [1])
    image.pixels.foreach_set(pixels)
    image.pack()
    nodes = mat.node_tree.nodes
    shader = nodes.get("Principled BSDF")
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = image
    mat.node_tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])


def export_models():
    bpy.ops.wm.open_mainfile(filepath=str(OUT / "cercado-cultivo.blend"))
    MODELS.mkdir(parents=True, exist_ok=True)
    export_wood_texture(bpy.data.materials["Madeira alienígena · longarinas"], (.14, .060, .025), (.35, .165, .065))
    export_wood_texture(bpy.data.materials["Madeira alienígena · montantes"], (.093, .043, .021), (.25, .112, .042))
    glass = bpy.data.materials["Painel agrícola · vidro azul-petróleo"]
    glass.surface_render_method = "BLENDED"
    shader = glass.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Transmission Weight"].default_value = 0
    shader.inputs["Alpha"].default_value = .40

    for label, root_name, filename in (
        ("Teto para cultivo", "Teto · origem modular", "teto-cultivo"),
        ("Cerca de madeira", "Cerca · origem modular", "cerca-madeira"),
        ("Portão de cerca", "Portão · origem modular", "portao-cerca"),
    ):
        group = bpy.data.collections[label]
        root = group.objects[root_name]
        root.location = (0, 0, 0)
        root.rotation_euler = (0, 0, 0)
        pivots = [root]
        hinge = group.objects.get("Eixo do portão · gire no eixo Z")
        if hinge:
            hinge.name = "GateHinge"
            hinge.rotation_euler = (0, 0, 0)
            pivots.append(hinge)
        bpy.context.view_layer.update()

        for pivot in pivots:
            parts = [obj for obj in pivot.children if obj.type == "MESH"]
            bpy.ops.object.select_all(action="DESELECT")
            for part in parts:
                bevel = part.modifiers.get("Chanfros")
                if bevel:
                    if part.name.startswith(("Rebite", "Parafuso", "Fixação")):
                        part.modifiers.remove(bevel)
                    else:
                        bevel.segments = 1
                part.select_set(True)
            bpy.context.view_layer.objects.active = parts[0]
            bpy.ops.object.convert(target="MESH")
            bpy.ops.object.join()

        bpy.ops.object.select_all(action="DESELECT")
        for obj in group.objects:
            obj.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=str(MODELS / (filename + ".glb")), export_format="GLB", use_selection=True,
        )


if "--export" in sys.argv:
    export_models()
    sys.exit()

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def collection(name):
    group = bpy.data.collections.new(name)
    scene.collection.children.link(group)
    return group


def material(name, color, metal=0, roughness=.45):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    result.diffuse_color = (*color, 1)
    bsdf = result.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = roughness
    return result


def timber(name, base, bright):
    result = material(name, base, roughness=.61)
    nodes = result.node_tree.nodes
    links = result.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    grain_coord = nodes.new("ShaderNodeTexCoord")
    stretch = nodes.new("ShaderNodeVectorMath")
    stretch.operation = "MULTIPLY"
    stretch.inputs[1].default_value = (2, 5, 40)
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 5
    noise.inputs["Detail"].default_value = 2
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = .20
    ramp.color_ramp.elements[0].color = (*base, 1)
    ramp.color_ramp.elements[1].position = .80
    ramp.color_ramp.elements[1].color = (*bright, 1)
    links.new(grain_coord.outputs["Generated"], stretch.inputs[0])
    links.new(stretch.outputs["Vector"], noise.inputs["Vector"])
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    return result


wood = timber("Madeira alienígena · longarinas", (.14, .060, .025), (.35, .165, .065))
post_wood = timber("Madeira alienígena · montantes", (.093, .043, .021), (.25, .112, .042))
metal = material("Liga de titânio · grafite", (.095, .14, .17), .62, .30)
bolt = material("Fixações de aço escovado", (.40, .53, .57), .73, .29)
gasket = material("Borracha de vedação", (.024, .043, .042), .08, .64)
accent = material("Alça e marcações · âmbar", (.66, .34, .08), .43, .39)
glass = material("Painel agrícola · vidro azul-petróleo", (.19, .66, .61), .12, .17)
glass.node_tree.nodes.get("Principled BSDF").inputs["Transmission Weight"].default_value = .63
glass.node_tree.nodes.get("Principled BSDF").inputs["IOR"].default_value = 1.45


def empty(name, owner, parent=None, location=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    owner.objects.link(obj)
    obj.parent = parent
    obj.location = location
    return obj


def finish(obj, name, owner, parent, mat, bevel):
    obj.name = name
    for group in list(obj.users_collection):
        group.objects.unlink(obj)
    owner.objects.link(obj)
    obj.parent = parent
    obj.data.materials.append(mat)
    if bevel:
        edge = obj.modifiers.new("Chanfros", "BEVEL")
        edge.width, edge.segments = bevel, 2
        normals = obj.modifiers.new("Normais ponderadas", "WEIGHTED_NORMAL")
        normals.keep_sharp = True
    return obj


def box(name, owner, parent, location, size, mat, bevel=.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, owner, parent, mat, bevel)


def cylinder(name, owner, parent, location, radius, length, mat, axis="z"):
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=radius, depth=length, location=location)
    obj = finish(bpy.context.object, name, owner, parent, mat, .003)
    if axis == "y":
        obj.rotation_euler.x = pi / 2
    return obj


roof = collection("Teto para cultivo")
roof_root = empty("Teto · origem modular", roof)
roof_root.location = (-2.03, .03, .16)
roof_root.rotation_euler.z = radians(18)
for side in (-1, 1):
    box("Perfil externo", roof, roof_root, (side * .46, 0, .065), (.08, 1, .13), metal)
    box("Travessa externa", roof, roof_root, (0, side * .46, .065), (.86, .08, .13), metal)
    for x in (-.46, .46):
        box("Canto encaixável", roof, roof_root, (x, side * .46, .082), (.14, .14, .14), post_wood)
        cylinder("Fixação de canto", roof, roof_root, (x, side * .46, .155), .022, .011, bolt)

box("Travessa central", roof, roof_root, (0, 0, .055), (.047, .88, .084), metal)
for x in (-.228, .228):
    for side in (-1, 1):
        box("Vedação lateral", roof, roof_root, (x + side * .209, 0, .065), (.018, .878, .04), gasket)
        box("Vedação transversal", roof, roof_root, (x, side * .43, .065), (.418, .018, .04), gasket)
    box("Placa translúcida", roof, roof_root, (x, 0, .085), (.416, .858, .027), glass, .006)
for x in (-.28, .28):
    box("Presilha de acoplamento", roof, roof_root, (x, -.503, .041), (.086, .027, .042), accent)


def posts(owner, parent):
    for x in (-.448, .448):
        box("Montante", owner, parent, (x, 0, .386), (.105, .131, .772), post_wood, .016)
        box("Ponteira metálica", owner, parent, (x, 0, .774), (.113, .139, .041), metal)
        box("Sapata", owner, parent, (x, 0, .041), (.112, .14, .075), metal)
        for z in (.24, .56):
            cylinder("Parafuso do montante", owner, parent, (x, -.073, z), .016, .019, bolt, "y")


fence = collection("Cerca de madeira")
fence_root = empty("Cerca · origem modular", fence)
fence_root.location = (0, 0, .16)
fence_root.rotation_euler.z = radians(-16)
posts(fence, fence_root)
for z in (.24, .56):
    box("Longarina", fence, fence_root, (0, 0, z), (.85, .080, .122), wood)
for x in (-.25, 0, .25):
    box("Ripa de reforço", fence, fence_root, (x, .055, .395), (.045, .053, .47), post_wood)
for x in (-.33, .33):
    for z in (.24, .56):
        cylinder("Rebite", fence, fence_root, (x, -.047, z), .013, .018, bolt, "y")

gate = collection("Portão de cerca")
gate_root = empty("Portão · origem modular", gate)
gate_root.location = (2.03, .03, .16)
gate_root.rotation_euler.z = radians(-13)
posts(gate, gate_root)
hinge = empty("Eixo do portão · gire no eixo Z", gate, gate_root, (-.388, -.006, 0))
hinge.rotation_euler.z = radians(30)
for x in (.036, .74):
    box("Travessa vertical da folha", gate, hinge, (x, 0, .398), (.077, .077, .55), post_wood)
for z in (.24, .56):
    box("Travessa da folha", gate, hinge, (.39, 0, z), (.714, .083, .103), wood)
brace = box("Contraventamento", gate, hinge, (.385, .029, .403), (.733, .04, .067), wood)
brace.rotation_euler.y = radians(-25)
for z in (.255, .555):
    cylinder("Pino da dobradiça", gate, gate_root, (-.388, -.006, z), .028, .141, bolt)
    box("Chapa de dobradiça", gate, hinge, (.079, -.055, z), (.19, .035, .063), metal)
    for x in (.04, .124):
        cylinder("Rebite da dobradiça", gate, hinge, (x, -.077, z), .012, .013, bolt, "y")
box("Fecho de correr", gate, hinge, (.698, -.064, .55), (.13, .043, .056), metal)
box("Alavanca do fecho", gate, hinge, (.729, -.091, .57), (.052, .032, .065), accent)

studio = collection("Estúdio de apresentação")
floor = material("Pano de fundo · azul noite", (.018, .035, .052), .02, .83)
stage = material("Bases de exposição", (.038, .073, .091), .26, .53)
letter = material("Texto da prancha", (.66, .81, .91), roughness=1)
letter_shader = letter.node_tree.nodes.get("Principled BSDF")
letter_shader.inputs["Emission Color"].default_value = (.66, .81, .91, 1)
letter_shader.inputs["Emission Strength"].default_value = .85
box("Piso do estúdio", studio, None, (0, 0, -.09), (200, 200, .1), floor, 0)
for x in (-2.03, 0, 2.03):
    box("Base de apresentação", studio, None, (x, .05, .062), (1.66, 1.43, .194), stage, .065)


def area(name, location, power, diameter, color):
    data = bpy.data.lights.new(name, "AREA")
    data.energy, data.shape, data.size, data.color = power, "DISK", diameter, color
    lamp = bpy.data.objects.new(name, data)
    studio.objects.link(lamp)
    lamp.location = location
    lamp.rotation_euler = (-lamp.location).to_track_quat("-Z", "Y").to_euler()


area("Luz principal", (-3, -4, 6), 650, 5, (.88, .96, 1))
area("Luz de contorno", (2, 4, 5), 820, 4, (.63, .86, 1))
area("Reflexo quente", (3, -3, 3), 250, 3, (1, .80, .57))
scene.world = bpy.data.worlds.new("Luz ambiente")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .25

camera_data = bpy.data.cameras.new("Câmera da prancha")
camera_data.type = "ORTHO"
camera_data.ortho_scale = 6.5
camera = bpy.data.objects.new("Câmera da prancha", camera_data)
studio.objects.link(camera)
camera.location = (0, -6, 5)
camera.rotation_euler = (Vector((0, 0, .37)) - camera.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = camera


def label(body, x, y, size, align="LEFT"):
    data = bpy.data.curves.new(body, "FONT")
    data.body, data.size, data.align_x = body, size, align
    obj = bpy.data.objects.new(body, data)
    studio.objects.link(obj)
    obj.parent = camera
    obj.location = (x, y, -4)
    data.materials.append(letter)


label("CERCADO DE CULTIVO", -2.98, 1.31, .27)
label("VOIDBOUND   /   MODELOS DE CONSTRUÇÃO", -2.97, 1.12, .087)
for x, name, description in (
    (-2.03, "Teto para cultivo", "Painéis translúcidos e vedação"),
    (0, "Cerca de madeira", "Montantes e longarinas modulares"),
    (2.03, "Portão de cerca", "Folha articulada e fecho metálico"),
):
    label(name, x, -1.12, .145, "CENTER")
    label(description, x, -1.31, .081, "CENTER")

scene.render.engine = "CYCLES"
scene.cycles.samples = 16
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 1450, 760
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = "//cercado-cultivo-previa.png"
scene.view_settings.view_transform = "AgX"
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.object.select_all(action="DESELECT")
for screen in bpy.data.screens:
    for viewport in screen.areas:
        if viewport.type == "VIEW_3D":
            viewport.spaces.active.region_3d.view_perspective = "CAMERA"
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "cercado-cultivo.blend"))
bpy.ops.render.render(write_still=True)
