"""Cinco personagens low-poly e uma prancha de apresentação do Voidbound."""
from math import pi, radians
from pathlib import Path
import sys

import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parents[1] / "assets" / "blender"
MODELS = OUT.parents[1] / "public" / "models" / "monstros"


def export_models():
    bpy.ops.wm.open_mainfile(filepath=str(OUT / "zumbis-voidbound.blend"))
    MODELS.mkdir(parents=True, exist_ok=True)
    for index, name in enumerate((
        "Astronauta perdido", "Mineiro soterrado", "Colono fúngico",
        "Sentinela oxidado", "Derivante glacial",
    )):
        group = bpy.data.collections[name]
        root = group.objects[name + " · origem"]
        root.location = (0, 0, 0)
        root.rotation_euler = (0, 0, 0)
        bpy.context.view_layer.update()
        bpy.ops.object.select_all(action="DESELECT")
        parts = [obj for obj in group.objects if obj.type == "MESH"]
        for part in parts:
            transform = part.matrix_world.copy()
            part.parent = None
            part.matrix_world = transform
            part.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]
        bpy.ops.object.convert(target="MESH")
        bpy.ops.object.join()
        bpy.ops.export_scene.gltf(
            filepath=str(MODELS / f"zumbi-{index}.glb"), export_format="GLB", use_selection=True,
        )


if "--export" in sys.argv:
    export_models()
    sys.exit()

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def material(name, rgb, metallic=0, glow=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    shader.inputs["Roughness"].default_value = .48
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Emission Color"].default_value = (*rgb, 1)
    shader.inputs["Emission Strength"].default_value = glow
    return mat


def collection(name):
    group = bpy.data.collections.new(name)
    scene.collection.children.link(group)
    return group


def attach(obj, name, group, parent, mat):
    obj.name = name
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    group.objects.link(obj)
    obj.parent = parent
    obj.data.materials.append(mat)
    return obj


def box(name, group, parent, at, size, mat, bevel=.022):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    obj = bpy.context.object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        edge = obj.modifiers.new("Arestas", "BEVEL")
        edge.width = bevel
        edge.segments = 1
        normals = obj.modifiers.new("Normais", "WEIGHTED_NORMAL")
        normals.keep_sharp = True
    return attach(obj, name, group, parent, mat)


def gem(name, group, parent, at, size, mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=at)
    obj = attach(bpy.context.object, name, group, parent, mat)
    obj.scale = size
    return obj


def empty(name, group, parent=None, at=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    group.objects.link(obj)
    obj.parent = parent
    obj.location = at
    return obj


rubber = material("Borracha e tecido escuro", (.035, .046, .055))
black = material("Sombras do rosto", (.016, .022, .022))
steel = material("Metal exposto", (.27, .32, .33), .68)
bone = material("Dentes", (.60, .56, .38))
boot = material("Botas de expedição", (.065, .075, .075))
visor = material("Vidro escuro do capacete", (.032, .115, .14), .68)
profiles = [
    ("Astronauta perdido", "TRAJE EVA RACHADO", (.32, .068, .081), (.44, .18, .12), (.27, .41, .32), (.06, .85, .74)),
    ("Mineiro soterrado", "CAPACETE E POEIRA MINERAL", (.36, .21, .071), (.70, .39, .073), (.39, .43, .23), (.96, .68, .12)),
    ("Colono fúngico", "ESPOROS E COLÔNIA ALIENÍGENA", (.19, .116, .24), (.39, .13, .42), (.32, .31, .44), (.69, .29, 1)),
    ("Sentinela oxidado", "PLACA TÁTICA CORROÍDA", (.11, .19, .17), (.29, .34, .22), (.38, .42, .32), (.66, .97, .25)),
    ("Derivante glacial", "GELO E TRAJE DE SOBREVIVÊNCIA", (.12, .26, .37), (.30, .54, .71), (.29, .45, .55), (.27, .83, 1)),
]


def zombie(index, profile):
    name, _, suit_rgb, trim_rgb, skin_rgb, eye_rgb = profile
    group = collection(name)
    root = empty(name + " · origem", group, at=((index - 2) * 1.53, 0, .12))
    root.rotation_euler.z = radians([12, -11, 7, -9, 10][index])
    suit = material(name + " · traje", suit_rgb)
    trim = material(name + " · acabamento", trim_rgb, .25)
    skin = material(name + " · pele", skin_rgb)
    eyes = material(name + " · olhos", eye_rgb, glow=2.5)
    width = [.59, .66, .57, .72, .53][index]
    lean = [-.08, .06, -.12, .12, -.14][index]
    chest = empty("Tronco", group, root, (0, 0, 1.28))
    chest.rotation_euler = (radians(-9), lean, radians(3))
    def part(name, at, size, mat, parent=chest, bevel=.022):
        return box(name, group, parent, at, size, mat, bevel)

    part("Jaqueta rasgada", (0, 0, 0), (width, .39, .56), suit)
    part("Cintura", (0, .005, -.29), (width * .88, .35, .105), rubber)
    part("Fecho da cintura", (.06, -.188, -.285), (.135, .037, .083), steel)
    part("Peitoral", (0, -.201, .07), (width * .76, .059, .233), trim)
    part("Gola", (0, 0, .306), (.33, .29, .095), rubber)
    part("Pescoço", (0, -.019, .369), (.19, .20, .12), skin)
    head = empty("Cabeça", group, chest, (lean, -.072, .601))
    head.rotation_euler = (radians([5, 14, 2, 9, 13][index]), lean * 2, radians([-8, 7, -14, 5, 12][index]))
    part("Crânio", (0, 0, 0), (.40, .36, .405), skin, head, .045)
    part("Mandíbula", (.015, -.052, -.157), (.288, .278, .12), skin, head)
    part("Boca aberta", (0, -.191, -.11), (.217, .026, .076), black, head, .009)
    for x in (-.072, -.024, .047):
        part("Dente", (x, -.206, -.083), (.027, .012, .033), bone, head, .002)
    for side in (-1, 1):
        part("Órbita", (side * .091, -.177, .037), (.115, .029, .075), black, head)
        part("Olho", (side * .086, -.197, .031), (.054, .014, .029), eyes, head, .003)
        ridge = part("Sobrancelha", (side * .097, -.183, .085), (.133, .042, .032), skin, head)
        ridge.rotation_euler.y = side * .14
    part("Nariz", (0, -.188, -.036), (.063, .052, .059), skin, head)

    def limb(name, start, end, size, mat, parent=root):
        a, b = Vector(start), Vector(end)
        obj = part(name, (a + b) / 2, (size[0], size[1], (b - a).length), mat, parent)
        obj.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
        return obj

    for side in (-1, 1):
        shoulder = (side * (width / 2 + .08), 0, .174)
        elbow = (side * (.41 + index * .019), -.13 if side == 1 else -.32, -.115 if side == 1 else -.015)
        palm = (side * (.42 + index * .02), -.52 if side == 1 else -.64, -.17 if side == 1 else -.06)
        limb("Manga", shoulder, elbow, (.199, .21), suit, chest)
        limb("Antebraço", elbow, palm, (.153, .162), skin if side < 0 else trim, chest)
        part("Mão", palm, (.16, .18, .105), skin, chest)
        for finger in range(3):
            digit = part("Dedo dobrado", (palm[0] + (finger - 1) * .045, palm[1] - .081, palm[2] - .03),
                         (.039, .11, .046), skin, chest, .008)
            digit.rotation_euler.x = -.45

        hip = (side * width * .25, 0, 1.03)
        knee = (side * (.16 + index * .012), -.07 if side == 1 else -.21, .62)
        ankle = (side * (.19 + index * .013), .09 if side == 1 else -.30, .185)
        limb("Perna do traje", hip, knee, (.237, .247), suit)
        limb("Canela", knee, ankle, (.179, .196), rubber if side == 1 else suit)
        part("Joelheira", (knee[0], knee[1] - .104, knee[2]), (.184, .068, .151), trim, root)
        part("Bota", (ankle[0], ankle[1] - .069, .101), (.24, .377, .202), boot, root)
        part("Sola", (ankle[0], ankle[1] - .072, .027), (.25, .395, .054), rubber, root)

    if index == 0:
        part("Mochila de suporte", (0, .254, .043), (.48, .22, .48), trim)
        part("Indicador EVA", (.13, -.244, .085), (.11, .022, .058), eyes)
        part("Casco do capacete", (0, .121, .044), (.48, .265, .471), trim, head, .045)
        part("Borda superior", (0, -.111, .212), (.47, .345, .079), rubber, head)
        broken = part("Visor quebrado", (.157, -.203, .015), (.119, .056, .293), visor, head)
        broken.rotation_euler.y = -.21
    elif index == 1:
        part("Capacete de mineração", (0, .013, .204), (.509, .438, .153), trim, head, .038)
        part("Aba do capacete", (0, -.098, .142), (.53, .354, .043), trim, head)
        part("Farol de mina", (.025, -.227, .198), (.129, .09, .098), steel, head)
        part("Lente do farol", (.025, -.279, .198), (.094, .019, .061), eyes, head)
        for at in [(-.245, -.18, .028), (.211, -.215, -.18), (.096, -.184, -.18)]:
            part("Faixa refletiva", at, (.178, .035, .035), trim)
    elif index == 2:
        for at, size in [((-.10, .08, .209), (.15, .14, .115)), ((.16, .08, .17), (.129, .137, .12)),
                         ((.231, .005, .257), (.10, .105, .078)), ((-.24, -.013, .215), (.114, .113, .082))]:
            gem("Cápsula de esporos", group, head, at, size, trim)
        for at, size in [((-.34, .035, .226), (.142, .115, .10)), ((-.26, -.13, .258), (.11, .10, .089))]:
            gem("Colônia no ombro", group, chest, at, size, trim)
        part("Manta rasgada", (.16, .221, -.086), (.24, .05, .68), suit)
    elif index == 3:
        part("Queixeira de proteção", (.09, -.103, -.171), (.244, .173, .105), steel, head)
        part("Placa craniana oxidada", (-.139, .04, .115), (.192, .328, .279), trim, head, .031)
        for side in (-1, 1):
            part("Ombreira reforçada", (side * .352, 0, .206), (.235, .328, .169), steel)
        part("Grelha do respirador", (.037, -.246, -.06), (.199, .052, .115), rubber)
        for x in [-.024, .027, .078]:
            part("Abertura da grelha", (x, -.278, -.058), (.019, .014, .064), trim)
    else:
        part("Gola térmica", (0, -.014, .332), (.477, .346, .111), trim)
        part("Capuz traseiro", (0, .12, .021), (.464, .281, .463), suit, head, .05)
        for at, size in [((-.18, -.039, .268), (.079, .096, .204)), ((-.256, -.03, .172), (.071, .076, .143)),
                         ((.145, .069, .216), (.093, .087, .154))]:
            crystal = gem("Cristal de gelo", group, head, at, size, trim)
            crystal.rotation_euler.y = -.22 if at[0] < 0 else .25
        gem("Geada no ombro", group, chest, (.22, -.053, .242), (.175, .15, .12), trim)
        part("Proteção térmica", (-.126, -.213, .12), (.118, .05, .231), steel)


for index, profile in enumerate(profiles):
    zombie(index, profile)

studio = collection("Estúdio e legendas")
floor = material("Fundo azul carvão", (.021, .035, .051))
stage = material("Base fosca", (.044, .072, .084), .22)
ink = material("Texto claro", (.64, .8, .88), glow=.8)
box("Piso", studio, None, (0, 0, -.09), (200, 200, .1), floor, 0)
for index in range(5):
    box("Base de apresentação", studio, None, ((index - 2) * 1.53, 0, .045),
        (1.34, 1.34, .15), stage, .04)


def area(name, at, power, radius, color):
    data = bpy.data.lights.new(name, "AREA")
    data.energy, data.shape, data.size, data.color = power, "DISK", radius, color
    light = bpy.data.objects.new(name, data)
    studio.objects.link(light)
    light.location = at
    light.rotation_euler = (Vector((0, 0, 1)) - light.location).to_track_quat("-Z", "Y").to_euler()


area("Luz frontal", (-3, -6, 6), 960, 7, (.92, .97, 1))
area("Recorte frio", (3, 3, 5), 1100, 5, (.61, .81, 1))
area("Preenchimento quente", (4, -4, 2.7), 430, 4, (1, .76, .58))
scene.world = bpy.data.worlds.new("Ambiente")
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .26
data = bpy.data.cameras.new("Câmera da prancha")
data.type, data.ortho_scale = "ORTHO", 8.3
camera = bpy.data.objects.new("Câmera da prancha", data)
studio.objects.link(camera)
camera.location = (0, -10, 4.05)
camera.rotation_euler = (Vector((0, 0, 1.17)) - camera.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = camera


def label(body, x, y, size, align="LEFT"):
    data = bpy.data.curves.new(body, "FONT")
    data.body, data.size, data.align_x = body, size, align
    obj = bpy.data.objects.new(body, data)
    studio.objects.link(obj)
    obj.parent = camera
    obj.location = (x, y, -5)
    data.materials.append(ink)


label("ZUMBIS DO VOIDBOUND", -3.77, 1.66, .29)
label("CINCO MODELOS DE PERSONAGEM", -3.76, 1.46, .101)
for i, (name, description, *_) in enumerate(profiles):
    label(name, (i - 2) * 1.53, -1.60, .124, "CENTER")
    label(description, (i - 2) * 1.53, -1.76, .056, "CENTER")

scene.render.engine = "CYCLES"
scene.cycles.samples = 12
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 1550, 820
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = "//zumbis-voidbound-previa.png"
bpy.context.preferences.filepaths.save_version = 0

for screen in bpy.data.screens:
    for viewport in screen.areas:
        if viewport.type == "VIEW_3D":
            viewport.spaces.active.region_3d.view_perspective = "CAMERA"
            viewport.spaces.active.shading.color_type = "MATERIAL"
bpy.ops.object.select_all(action="DESELECT")
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "zumbis-voidbound.blend"))
bpy.ops.render.render(write_still=True)
