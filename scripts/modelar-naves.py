"""Execute com Blender: blender -b -t 2 --python scripts/modelar-naves.py."""
from array import array
from math import cos, pi, sin
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
    shader.inputs["Metallic"].default_value = .22 if name.endswith("· casco") else metallic
    shader.inputs["Roughness"].default_value = .34 if "cabine" in name else .49
    shader.inputs["Emission Color"].default_value = color
    shader.inputs["Emission Strength"].default_value = glow
    if name.endswith("· casco"):
        size = 128
        rng = random.Random(name)
        image = bpy.data.images.new(name + " · textura", width=size, height=size)
        pixels = array("f")
        for y in range(size):
            for x in range(size):
                a, b = (x + 24 * (y // 32 % 2)) % 64, y % 32
                shade = .84 + rng.random() * .24 + .04 * sin(x * .23 + y * .44)
                if a in (0, 63) or b in (0, 31):
                    shade *= .54
                elif a in (1, 62) or b in (1, 30):
                    shade *= 1.23
                if a in (5, 58) and b in (5, 26):
                    shade *= .40
                if (x * 3 + y * 83) % 487 < 3:
                    shade *= 1.35
                pixels.extend(min(1, (.028 + channel * 1.40) * shade) for channel in color[:3])
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
    bevel = obj.modifiers.new("Bordas usinadas", "BEVEL")
    bevel.width = min(.55, thickness * .24)
    bevel.segments = 2
    obj.modifiers.new("Normais ponderadas", "WEIGHTED_NORMAL")
    return obj


def loft(name, stations, mat):
    """Shape the hull with octagonal bulkheads of varying width and height."""
    sections = [(-.66, 1), (.66, 1), (1, .46), (1, -.46),
                (.66, -1), (-.66, -1), (-1, -.46), (-1, .46)]
    vertices = [xyz(span * x, center + rise * y, z)
                for z, span, center, rise in stations for x, y in sections]
    faces = [tuple(reversed(range(8)))]
    for row in range(len(stations) - 1):
        for i in range(8):
            j = (i + 1) % 8
            faces.append((row*8+i, row*8+j, (row+1)*8+j, (row+1)*8+i))
    faces.append(tuple(range(len(vertices)-8, len(vertices))))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    topology = bmesh.new()
    topology.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(topology, faces=list(topology.faces))
    topology.to_mesh(mesh)
    topology.free()
    uv = mesh.uv_layers.new()
    for face in mesh.polygons:
        for index in face.loop_indices:
            x, y, z = mesh.vertices[mesh.loops[index].vertex_index].co
            uv.data[index].uv = ((z if abs(face.normal.x) > .6 else x) / 15, y / 25)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(mat)
    bevel = obj.modifiers.new("Borda da carenagem", "BEVEL")
    bevel.width = .34
    bevel.segments = 2
    obj.modifiers.new("Normais ponderadas", "WEIGHTED_NORMAL")
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

    w = width * .80
    nose = -length * .53
    tail = length * .43
    slender = style in {"fork", "delta", "keel", "tail"}
    body_width = w * (.43 if slender else .66)
    # The cross-sections describe the solid silhouette, including the rear view.
    forms = {
        "fork": (.08, .45, 1, .61, .89, .58),
        "delta": (.06, .39, .82, 1, .82, .69),
        "keel": (.34, .79, .95, .74, .70, .55),
        "tail": (.06, .66, .88, .65, 1, .81),
        "cargo": (.63, .91, .80, .84, 1, .91),
        "tanks": (.45, .83, .79, .83, .77, .70),
        "drill": (.35, .70, .96, .98, 1, .80),
        "wheel": (.52, .81, 1, .89, .94, .86),
        "claw": (.43, .82, .85, 1, .94, .75),
        "shield": (.29, .86, 1, .83, .99, .73),
        "survey": (.14, .51, .92, 1, .70, .63),
        "vertical": (.25, .66, .99, 1, .72, .31),
    }
    fractions = (-.53, -.34, -.13, .08, .29, .43)
    rises = (.14, .32, .49, .47, .43, .28)
    stations = [(length*f, body_width*span, -.3, height*rise)
                for f, span, rise in zip(fractions, forms[style], rises)]
    loft("Casco principal facetado", stations, armor)
    loft("Carenagem ventral", [
        (z + 1, span*.81, -height*.24, rise*.77)
        for z, span, _, rise in stations
    ], dark)
    loft("Cabine panorâmica", [
        (length * f, body_width * span, height * center, height * rise)
        for f, span, center, rise in (
            (-.38, .12, .29, .08), (-.28, .37, .44, .17),
            (-.16, .49, .53, .24), (-.06, .46, .49, .20), (.01, .29, .38, .09),
        )
    ], glass)
    # Split panels follow the shoulder contours and leave an exposed spine.
    for row, fraction in enumerate((-.26, -.08, .11, .28)):
        z = length * fraction
        span = body_width * (.59 if row == 0 else .76)
        y = height * (.31 if row == 0 else .43)
        for side in (-1, 1):
            plate("Blindagem da ombreira", [
                (side*span*.40, z-3.6), (side*span*.88, z-4),
                (side*span*1.16, z-.7), (side*span*.90, z+3.7),
                (side*span*.44, z+3),
            ], y, .7 + rng.random() * .51, trim if row == 2 else armor)
            for vent in range(4):
                block("Fenda de refrigeração", side*span*.63, y+.91,
                      z + (vent - 1.5)*.61, span*.23, .20, .23, dark)
    for side in (-1, 1):
        for rail in range(3):
            z = length * (.02 + .12 * rail)
            x = side * body_width * (.94 - .07 * rail)
            cylinder("Tubulação de serviço", (x, -.9, z - 3), (x, -.9, z + 3),
                     .46, trim, 8)
            block("Abraçadeira", x, -.9, z, 1.22, 1.25, .75, steel)
        if slender:
            tip = length * (.32 if style == "delta" else -.14)
            tip_width = w * (1.12 if name in {"specter", "peregrine"} else 1)
            root = body_width*.60
            outline = [(side*root, nose*.65), (side*w*.60, length*.02),
                       (side*tip_width, tip), (side*tip_width*.96, tip+5),
                       (side*w*.62, tail*.71), (side*root, tail*.62)]
            wing = plate("Asa de longarina dupla", outline, -1.5, 2.15, armor)
            wing.rotation_euler.y = side*.09
            plate("Faixa longa da asa", [
                (side*w*.55, length*.06), (side*tip_width*.91, tip+1.5),
                (side*tip_width*.86, tip+4), (side*w*.54, tail*.61),
            ], 1.5, .52, trim)
            for inner in (.53, .68, .82):
                z = tip*.62 + tail*.28
                block("Flape de manobra", side*tip_width*inner, .28, z,
                      w*.13, 1.48, 4.3, dark)
            if name in {"specter", "sparrow", "viper", "raptor"}:
                fin = plate("Deriva dorsal", [
                    (side*w*.48, tail*.28), (side*w*.56, tail*.31),
                    (side*w*.59, tail*.88), (side*w*.47, tail*.68),
                ], 0, height*.71, armor)
                fin.rotation_euler.y = side*.13
            block("Luz de navegação", side*tip_width*.93, .95, tip+2,
                  .72, .51, 1.8, cyan if side > 0 else amber)
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
        for section in range(3):
            z = 17 + section * 1.63
            cylinder("Colar da turbina", (x, -1, z), (x, -1, z + .38), 2.78,
                     steel if section != 1 else trim, 16)
        for vane in range(8):
            angle = vane * pi / 4
            detail = block("Aleta do bocal", x + 2.27*cos(angle), -1 + 2.27*sin(angle),
                           21.45, .48, .72, 1.3, steel)
            detail.rotation_euler.y = -angle
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
    depsgraph = bpy.context.evaluated_depsgraph_get()
    groups = {}
    for obj in collection.objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
        groups.setdefault(mesh.materials[0].name, []).append((obj.name, mesh, obj.matrix_world.copy()))
    exports = []
    for parts in groups.values():
        bpy.ops.object.select_all(action="DESELECT")
        for part_name, mesh, transform in parts:
            clone = bpy.data.objects.new(part_name + " · exportação", mesh)
            collection.objects.link(clone)
            clone.matrix_world = transform
            clone.select_set(True)
        bpy.context.view_layer.objects.active = clone
        if len(parts) > 1:
            bpy.ops.object.join()
        exports.append(bpy.context.object)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in exports:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT / "public/models/naves" / (name + ".glb")),
                              export_format="GLB", use_selection=True)
    for obj in exports:
        bpy.data.objects.remove(obj, do_unlink=True)
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
