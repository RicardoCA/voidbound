"""Execute com Blender: blender -b -t 2 --python scripts/modelar-naves.py."""
from array import array
import random
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
# Largura, altura, comprimento, blindagem, faixa, configuração.
PROFILES = {
    "aegis": (27, 9, 49, 0x607185, 0xb1cad4, "shield"),
    "atlas": (22, 14, 53, 0x405770, 0xcc833e, "cargo"),
    "bastion": (21, 11, 54, 0x343c53, 0xe69037, "shield"),
    "bedrock": (20, 13, 48, 0x57583a, 0xd4a64c, "drill"),
    "behemoth": (26, 13, 56, 0x4d5339, 0xc69746, "tanks"),
    "caravan": (21, 14, 54, 0x685844, 0xd57529, "tanks"),
    "colossus": (30, 16, 59, 0x555b65, 0xac6235, "cargo"),
    "corvus": (28, 9, 34, 0x343d4b, 0xad8983, "vertical"),
    "excavator": (25, 13, 46, 0x353b49, 0xdc971e, "claw"),
    "forge": (21, 15, 48, 0x493c30, 0xdc892b, "drill"),
    "horizon": (27, 10, 49, 0xaaa8a3, 0x4d8c90, "survey"),
    "kestrel": (27, 7, 48, 0x6e5b47, 0xb39c70, "fork"),
    "leviathan": (27, 15, 56, 0x393f4c, 0xc17a39, "cargo"),
    "lumen": (19, 10, 51, 0x8c8e91, 0xa14338, "keel"),
    "mammoth": (27, 16, 52, 0x274650, 0xd78c2b, "claw"),
    "meridian": (22, 11, 48, 0x77849a, 0xd89d46, "cargo"),
    "nomad": (20, 9, 50, 0x626977, 0xd48436, "tail"),
    "odyssey": (25, 12, 50, 0xa4a59e, 0xb38650, "survey"),
    "peregrine": (28, 6, 55, 0x9392a8, 0xe0ab57, "delta"),
    "prospector": (22, 13, 48, 0x303748, 0xd7a852, "claw"),
    "quartz": (22, 13, 46, 0x715c77, 0xd4a95e, "drill"),
    "raptor": (28, 8, 50, 0x5e2d31, 0xca422e, "fork"),
    "sovereign": (27, 13, 56, 0x464656, 0xa2453b, "shield"),
    "sparrow": (26, 8, 49, 0x506079, 0xd28335, "delta"),
    "specter": (26, 8, 52, 0x493c58, 0x88658d, "fork"),
    "strata": (27, 10, 53, 0x8d8776, 0x926845, "survey"),
    "titan": (21, 13, 50, 0x46515c, 0xd39a31, "drill"),
    "titanforge": (26, 17, 53, 0x675747, 0xc5742e, "wheel"),
    "viper": (27, 8, 48, 0x42485c, 0xbb3a32, "delta"),
    "warden": (25, 12, 48, 0x425475, 0xd9933e, "shield"),
}


def xyz(x, y, z):
    return (x, -z, y)


def material(name, rgb, metallic=.45, glow=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    color = tuple(((rgb >> shift) & 255) / 255 for shift in (16, 8, 0))
    color = tuple(channel ** 2.2 for channel in color) + (1,)
    mat.diffuse_color = color
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = .58
    shader.inputs["Emission Color"].default_value = color
    shader.inputs["Emission Strength"].default_value = glow
    if name.endswith("· casco"):
        size = 64
        rng = random.Random(name)
        image = bpy.data.images.new(name + " · textura", width=size, height=size)
        pixels = array("f")
        for y in range(size):
            for x in range(size):
                a, b = x % 32, y % 32
                shade = .58 if a == 0 or b == 0 else .92 + rng.random() * .16
                if a in (3, 28) and b in (3, 28):
                    shade = .53
                pixels.extend(min(1, channel * shade) for channel in color[:3])
                pixels.append(1)
        image.pixels.foreach_set(pixels)
        image.pack()
        texture = mat.node_tree.nodes.new("ShaderNodeTexImage")
        texture.image = image
        mat.node_tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])
    return mat


def block(name, x, y, z, w, h, length, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(x, y, z))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (w, length, h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new("Chanfros", "BEVEL")
    bevel.width = min(w, h, length) * .16
    bevel.segments = 1
    return obj


def cylinder(name, a, b, radius, mat, vertices=12, tip=None):
    start, end = Vector(xyz(*a)), Vector(xyz(*b))
    axis = end - start
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices, radius1=radius, radius2=radius if tip is None else tip,
        depth=axis.length, location=(start + end) / 2,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = axis.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)


def plate(name, outline, y, thickness, mat):
    count = len(outline)
    vertices = [xyz(x, level, z) for level in (y, y + thickness) for x, z in outline]
    faces = [list(reversed(range(count))), list(range(count, count * 2))]
    faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    topology = bmesh.new()
    topology.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(topology, faces=list(topology.faces))
    topology.to_mesh(mesh)
    topology.free()
    uv = mesh.uv_layers.new()
    for polygon in mesh.polygons:
        for index in polygon.loop_indices:
            x, y, z = mesh.vertices[mesh.loops[index].vertex_index].co
            uv.data[index].uv = ((x if abs(polygon.normal.x) < .8 else y) / 16,
                                 (y if abs(polygon.normal.z) > .8 else z) / 16)

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(mat)
    return obj


def build(name, spec):
    width, height, length, color, accent, style = spec
    rng = random.Random(name)
    armor = material(name + " · casco", color)
    trim = material(name + " · faixas", accent)
    dark = material(name + " · juntas", 0x252c36)
    steel = material(name + " · metal exposto", 0x758591)
    glass = material(name + " · cabine", 0x176573, .25, .45)
    cyan = material(name + " · propulsão", 0x48dcec, .1, 2.5)
    amber = material(name + " · iluminação", 0xffa443, .1, 1.8)
    crystal = material(name + " · ferramenta energizada", 0x9c58e9, .2, .7) if name == "quartz" else trim
    collection = bpy.data.collections.new(name)
    scene = bpy.context.scene
    scene.collection.children.link(collection)
    bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children[name]

    w = width / 2
    nose = -length * .53
    tail = length * .43
    slender = style in {"fork", "delta", "keel", "tail"}
    nose_width = w * (.12 if slender else .53)
    body_width = w * (.43 if slender else .77)
    outline = [
        (-nose_width, nose), (nose_width, nose),
        (body_width, nose * .54), (body_width, tail * .74),
        (body_width * .72, tail), (-body_width * .72, tail),
        (-body_width, tail * .74), (-body_width, nose * .54),
    ]
    plate("Casco ventral", outline, -height * .45, height * .42, dark)
    plate("Blindagem principal", outline, -height * .04, height * .55, armor)
    plate("Cabine facetada", [
        (-body_width * .39, nose * .80), (body_width * .39, nose * .80),
        (body_width * .64, nose * .38), (-body_width * .64, nose * .38),
    ], height * .48, height * .23, glass)
    for side in (-1, 1):
        if slender:
            wing_tip = tail * (.85 if style != "fork" else -.38)
            plate("Asa enflechada", [
                (side * 3, nose * .48), (side * w, wing_tip),
                (side * w * .87, tail * .99), (side * 4, tail * .54),
            ], -.8, 1.55, armor)
            plate("Painel da asa", [
                (side * w * .57, wing_tip * .70),
                (side * w * .94, wing_tip),
                (side * w * .82, tail * .91),
            ], .77, .24, trim)
        elif style in {"cargo", "tanks"}:
            for bay in range(3):
                z = (bay - 1) * length * .19
                if style == "tanks":
                    cylinder("Tanque de carga", (side*w*.75, .8, z - 4), (side*w*.75, .8, z + 4), height*.38, armor)
                else:
                    block("Contêiner", side*w*.77, .3, z, w*.57, height*.75, length*.16, trim if bay == 1 else armor)
                block("Trava de carga", side*w*.92, height*.38, z, 1.2, .9, 3, steel)
        elif style in {"drill", "wheel", "claw"}:
            x = side*w*.8
            block("Braço de mineração", x, 0, nose*.44, w*.45, height*.53, length*.61, trim)
            if style == "claw":
                plate("Garra", [(x-1.5, nose*.49), (x+1.5, nose*.49),
                    (x+side*3, nose*.94), (x+side*1.2, nose*1.07)], -.8, 2.8, steel)
            elif style == "drill":
                for step in range(4):
                    z = nose*.61 - step*2.2
                    cylinder("Coroa de perfuração", (x, 0, z), (x, 0, z-2.55),
                             3.7-step*.64, steel if step % 2 else crystal, 10, 3.1-step*.70)
        elif style in {"survey", "shield"}:
            block("Módulo lateral blindado", side*w*.76, .8, 2, w*.59, height*.56, length*.72, armor)
            block("Faixa do módulo", side*w*.85, height*.32, 2, w*.15, .48, length*.43, trim)
        elif style == "vertical":
            block("Braço do painel", side*w*.53, 0, 0, w*.86, 2.6, 4, armor)
            block("Painel vertical", side*w*.99, 0, 0, 2, 24, 20, dark)
            for y in (-11, -5, 0, 5, 11):
                block("Nervura do painel", side*w*1.04, y, 0, 1.05, .65, 19, steel)
        for z in (-5, 1, 7, 12):
            x = side * body_width * rng.uniform(.48, .82)
            block("Junta de manutenção", x, height*.52, z, body_width*.26, .35, 2.5, dark)
            block("Luz de serviço", x, height*.74, z+.8, .76, .26, .47, amber)
        x = side * 4.7
        cylinder("Gôndola do motor", (x, -1, tail-8), (x, -1, 21), 2.55, armor)
        cylinder("Bocal do motor", (x, -1, 20), (x, -1, 21.45), 2.23, dark)
        cylinder("Núcleo propulsor", (x, -1, 21.4), (x, -1, 21.55), 1.64, cyan)
    if style == "wheel":
        cylinder("Cabeça escavadora", (0, 0, nose + 7), (0, 0, nose - 1), 8, dark, 20)
        cylinder("Coroa dentada", (0, 0, nose + 2), (0, 0, nose - 2), 8.45, trim, 20)
        for x, y in ((-5, 0), (5, 0), (0, -5), (0, 5)):
            block("Dente de corte", x, y, nose - 2.3, 2.2, 2.2, 1.8, steel)
    if name in {"aegis", "warden", "sovereign"}:
        for side in (-1, 1):
            x = side * w * .72
            cylinder("Torreta", (x, height*.43, 5), (x, height*.61, 5), 2.7, steel)
            cylinder("Canhão", (x, height*.64, 5), (x, height*.64, -5), .83, dark)
    if style == "keel":
        block("Quilha ventral", 0, -11, 5, 3.9, 18, 13, armor)
        block("Faixa da quilha", 0, -11, 11.5, 1.4, 17, .5, trim)
    if style == "tail":
        for x in (-5, 5):
            block("Deriva traseira", x, 5.5, 12, 1.6, 11, 14, trim).rotation_euler.y = x*.045
    if style == "survey":
        cylinder("Mastro", (0, 4, 6), (0, 10, 6), .8, steel)
        cylinder("Antena parabólica", (0, 9, 6), (0, 12, 4), 1.8, steel, 16, 5.2)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in collection.objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT / "public/models/naves" / (name + ".glb")),
                              export_format="GLB", use_selection=True)
    collection.hide_render = True
    collection.hide_viewport = True


(ROOT / "public/models/naves").mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
for ship, profile in PROFILES.items():
    build(ship, profile)
bpy.data.collections["sparrow"].hide_viewport = False
bpy.data.collections["sparrow"].hide_render = False
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "assets/blender/naves-frota.blend"), compress=True)
