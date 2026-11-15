"""Generate the editable base equipment collection and the game GLBs."""
from pathlib import Path
from random import Random
from math import pi
import bpy

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/models/equipamentos-base"
bpy.ops.wm.read_factory_settings(use_empty=True)
OUT.mkdir(parents=True, exist_ok=True)


def material(name, color, metal=0.0, rough=0.55, glow=0.0, texture=False):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    shader = nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metal
    shader.inputs["Roughness"].default_value = rough
    shader.inputs["Emission Color"].default_value = (*color, 1)
    shader.inputs["Emission Strength"].default_value = glow
    if texture:
        rng = Random(name)
        side = 128
        img = bpy.data.images.new(name + " · acabamento", side, side, alpha=False)
        pixels = []
        for y in range(side):
            grain = rng.uniform(-0.07, 0.07)
            for x in range(side):
                value = 1 + grain + rng.uniform(-0.12, 0.12)
                if (x * 11 + y * 23) % 197 < 2:
                    value += 0.35
                pixels.extend([min(1, channel * value) for channel in color] + [1])
        img.pixels.foreach_set(pixels)
        img.pack()
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = img
        mat.node_tree.links.new(tex.outputs["Color"], shader.inputs["Base Color"])
    return mat


armor = material("Aço azul escovado", (.18, .25, .32), .55, texture=True)
light = material("Alumínio acetinado", (.53, .59, .63), .6, texture=True)
dark = material("Grafite", (.038, .052, .065), .2, texture=True)
gold = material("Âmbar industrial", (.89, .45, .09), .2, texture=True)
copper = material("Cobre dos conectores", (.61, .27, .10), .66, texture=True)
cyan = material("Indicador de oxigênio", (.08, .87, .91), glow=.8)
amber = material("Indicador de bateria", (1, .52, .04), glow=.7)
ink = material("Serigrafia marfim", (.88, .92, .89), rough=.8)
glass = material("Vidro fotovoltaico", (.075, .19, .45), .4, .25, texture=True)
cell = material("Células fotovoltaicas", (.09, .31, .64), .48, .32, texture=True)
rib = material("Polímero de baú", (.29, .18, .105), .08, texture=True)


def mesh(name, mat):
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def box(name, loc, size, mat, bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = mesh(name, mat)
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("Chanfro", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod = obj.modifiers.new("Normais ponderadas", "WEIGHTED_NORMAL")
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def cylinder(name, loc, radius, length, mat, axis="z", vertices=16):
    rotation = {"x": (0, pi/2, 0), "y": (pi/2, 0, 0), "z": (0, 0, 0)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=length,
                                        location=loc, rotation=rotation)
    return mesh(name, mat)


def label(text, x, z, y, size=.11, mat=ink):
    bpy.ops.object.text_add(location=(x, y, z), rotation=(pi/2, 0, 0))
    obj = bpy.context.object
    obj.data.body = text
    obj.data.align_x = "CENTER"
    obj.data.size = size
    bpy.ops.object.convert(target="MESH")
    mesh(text, mat)


def fasteners(xs, zs, y):
    for x in xs:
        for z in zs:
            cylinder("Parafuso sextavado", (x, y, z), .024, .024, light, "y", 6)


def battery():
    box("Bandeja isolante", (0, 0, .09), (1.22, .92, .18), dark)
    box("Carcaça do acumulador", (0, 0, .62), (1.14, .84, 1.02), armor, .06)
    for x in [-.43, .43]:
        box("Barra de proteção", (x, 0, .68), (.14, .93, .91), gold)
        for z in [.3, .93]:
            box("Encaixe da barra", (x, -.48, z), (.17, .07, .12), dark)
    box("Painel frontal rebaixado", (0, -.46, .66), (.68, .07, .58), dark)
    label("VB / BAT-1200", 0, .79, -.5, .083)
    for i in range(6):
        box("Indicador de carga", (-.23 + i*.092, -.505, .65), (.066, .015, .085),
            amber, .008)
    label("ACUMULADOR", 0, .47, -.5, .073)
    for x in [-.31, .31]:
        cylinder("Isolador do terminal", (x, .05, 1.15), .115, .09, dark)
        cylinder("Terminal de cobre", (x, .05, 1.22), .073, .10, copper, vertices=8)
    fasteners([-.32, .32], [.43, .88], -.50)
    box("Dissipador traseiro", (0, .45, .62), (.61, .07, .58), dark)
    for x in [-.24, -.12, 0, .12, .24]:
        box("Aleta traseira", (x, .51, .62), (.038, .11, .49), light)


def oxygen():
    box("Chassi do purificador", (0, 0, .08), (1.28, .93, .16), dark)
    box("Gabinete de controle", (-.27, .05, .59), (.66, .81, .94), armor, .05)
    box("Painel branco", (-.27, -.39, .64), (.55, .064, .72), light)
    box("Visor de fluxo", (-.27, -.44, .69), (.43, .062, .27), dark)
    label("O2", -.27, .64, -.475, .19, cyan)
    label("GERADOR", -.27, .38, -.43, .09, dark)
    for z in [.28, 1.01]:
        box("Travessa da bomba", (.24, .04, z), (.61, .83, .13), armor)
    cylinder("Câmara pressurizada", (.34, .04, .65), .23, .83, light)
    for z in [.39, .88]:
        cylinder("Anel da câmara", (.34, .04, z), .247, .08, dark)
    cylinder("Linha de oxigênio", (.34, .04, 1.12), .049, .23, copper)
    cylinder("Válvula", (.34, .04, 1.23), .098, .05, gold, vertices=8)
    for index in range(5):
        box("Aleta de ventilação", (.32, -.34, .44 + index*.09), (.32, .13, .041), armor)
    fasteners([-.48, -.06], [.34, .91], -.43)
    box("Filtro removível", (-.27, .47, .61), (.47, .08, .58), dark)
    for z in [.43, .52, .61, .70, .79]:
        box("Grade do filtro", (-.27, .52, z), (.35, .06, .036), light)


def solar():
    box("Plinto de ancoragem", (0, 0, .05), (.69, .56, .10), dark)
    for x in [-.25, .25]:
        for y in [-.19, .19]:
            cylinder("Chumbador", (x, y, .105), .05, .04, light, vertices=6)
    cylinder("Coluna pivotante", (0, 0, .32), .095, .56, armor, vertices=10)
    cylinder("Eixo inclinável", (0, 0, .54), .095, .52, copper, "x")
    bpy.ops.object.empty_add(location=(0, 0, .59))
    panel = bpy.context.object
    panel.name = "Conjunto fotovoltaico inclinado"
    parts = [
        box("Moldura de alumínio", (0, 0, 0), (1.65, 1.08, .105), light),
        box("Vidro laminado azul", (0, 0, .055), (1.55, .98, .035), glass),
    ]
    for i in range(8):
        for j in range(5):
            parts.append(box("Célula de silício", ((i-3.5)*.19, (j-2)*.19, .078),
                             (.171, .169, .014), cell, .006))
    for x in [-.762, .762]:
        parts.append(box("Trilho coletor", (x, 0, .09), (.019, .96, .012), copper))
    for obj in parts:
        obj.parent = panel
    panel.rotation_euler.x = -.32


def chest(bays):
    width = 1.24 * bays
    box("Base do baú", (0, 0, .085), (width, .91, .17), dark)
    box("Corpo texturizado", (0, 0, .48), (width-.06, .83, .70), rib, .055)
    box("Tampa reforçada", (0, 0, .88), (width, .94, .18), armor, .051)
    box("Vedação", (0, 0, .792), (width-.03, .91, .042), dark, .01)
    for bay in range(bays):
        x = (bay - (bays-1)/2)*1.24
        box("Painel frontal", (x, -.429, .49), (.98, .076, .47), armor)
        box("Moldura da trava", (x, -.487, .71), (.22, .12, .24), light)
        box("Trava", (x, -.554, .713), (.104, .032, .139), gold)
        box("Indicador", (x+.28, -.488, .57), (.11, .023, .035), cyan, .006)
        label(f"CARGA {bay+1:02}", x, .38, -.471, .094)
        fasteners([x-.41, x+.41], [.35, .64], -.48)
        for dx in [-.32, .32]:
            cylinder("Dobradiça traseira", (x+dx, .46, .81), .059, .17, light, "x", 10)
        box("Reforço traseiro", (x, .435, .50), (.86, .07, .15), armor)
        for side in [-1, 1]:
            box("Reforço de canto", (x+side*.54, 0, .53), (.12, .94, .74), dark)
            box("Trilho da tampa", (x+side*.40, 0, .984), (.11, .75, .05), light)


wood = material("Madeira alienígena", (.34, .175, .085), rough=.78, texture=True)
wood_light = material("Madeira clara", (.46, .254, .126), rough=.72, texture=True)
wood_dark = material("Juntas de madeira", (.17, .084, .044), rough=.85, texture=True)
stone = material("Pedra da fogueira", (.28, .26, .25), rough=.9, texture=True)
flame = material("Chama exterior", (1, .22, .024), glow=1.4)
ember = material("Chama interior", (1, .66, .11), glow=2.2)


def timber(width, depth):
    # A continuous core closes the footprint. Each plank wraps around all four sides.
    box("Núcleo de madeira", (0, 0, .5), (width, depth, 1), wood_dark, 0)
    for row in range(5):
        z = (row + .5) / 5
        box("Tábua contínua", (0, 0, z), (width+.006, depth+.006, .186),
            wood_light if row % 3 == 0 else wood, .005)


def ladder():
    for x in [-.37, .37]:
        box("Montante", (x, 0, .5), (.13, .13, 1), wood, .012)
    for i in range(4):
        z = .125 + i*.25
        cylinder("Degrau torneado", (0, 0, z), .049, .78, wood_light, "x", 10)
        for x in [-.36, .36]:
            box("Amarração", (x, 0, z), (.155, .155, .07), wood_dark, .013)


def stairs():
    for i in range(4):
        h = (i+1)/4
        x = (i-1.5)/4
        box("Corpo do degrau", (x, 0, h/2), (.25, .76, h), wood, 0)
        box("Piso do degrau", (x, 0, h-.035), (.25, .764, .07), wood_light, .005)


def campfire():
    from math import cos, sin
    rng = Random(47)
    for i in range(9):
        angle = i * 2*pi/9
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=.17,
            location=(.48*cos(angle), .48*sin(angle), .115))
        rock = mesh("Pedra do anel", stone)
        rock.scale = (rng.uniform(.9, 1.18), rng.uniform(.9, 1.18), .85)
    for i in range(3):
        angle = i*pi/3
        log = cylinder("Lenha", (0, 0, .19+i*.042), .085, .81, wood, "x", 9)
        log.rotation_euler.z = angle
    for i in range(6):
        angle = i*pi/3
        bpy.ops.mesh.primitive_cone_add(vertices=5, radius1=.17, depth=.44,
            location=(.13*cos(angle), .13*sin(angle), .44))
        tongue = mesh("Língua de fogo", flame if i % 2 else ember)
        tongue.rotation_euler = (.24*sin(angle), -.24*cos(angle), angle)
    bpy.ops.mesh.primitive_cone_add(vertices=7, radius1=.13, depth=.64, location=(0, 0, .55))
    mesh("Núcleo incandescente", ember)


def door(opened):
    for x in [-.44, .44]:
        box("Batente de madeira", (x, 0, 1), (.12, .24, 2), wood_dark, .015)
    box("Travessa superior", (0, 0, 1.94), (1, .24, .12), wood_light)
    bpy.ops.object.empty_add(location=(-.38, 0, 0))
    hinge = bpy.context.object
    hinge.name = "Eixo da porta"
    leaf = [box("Folha maciça", (.38, 0, .94), (.76, .09, 1.84), wood_dark, .008)]
    for side in [-1, 1]:
        for j in range(4):
            leaf.append(box("Tábua vertical", (.095 + j*.19, side*.053, .94),
                            (.176, .018, 1.80), wood, .006))
        for z in [.24, 1.61]:
            leaf.append(box("Travessa da folha", (.38, side*.069, z),
                            (.73, .03, .109), wood_light, .009))
        leaf.append(box("Chapa da maçaneta", (.62, side*.069, .92),
                        (.13, .034, .23), dark))
        leaf.append(cylinder("Maçaneta", (.62, side*.108, .94), .049, .07, copper, "y"))
    for z in [.37, 1.48]:
        cylinder("Dobradiça", (-.38, 0, z), .034, .22, copper, vertices=10)
    for obj in leaf:
        obj.parent = hinge
    if opened:
        hinge.rotation_euler.z = pi/2


for index, (name, build) in enumerate([
    ("bateria", battery), ("gerador-oxigenio", oxygen), ("placa-solar", solar),
    ("bau", lambda: chest(1)), ("bau-duplo", lambda: chest(2)),
    ("bau-triplo", lambda: chest(3)), ("fogueira", campfire),
    ("escada-vertical", ladder), ("escada-madeira", stairs),
    ("parede-madeira", lambda: timber(1, .19)),
    ("bloco-madeira", lambda: timber(1, 1)),
    ("porta-fechada", lambda: door(False)), ("porta-aberta", lambda: door(True)),
]):
    before = set(bpy.data.objects)
    build()
    objects = set(bpy.data.objects) - before
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        for previous in list(obj.users_collection):
            previous.objects.unlink(obj)
        collection.objects.link(obj)
        obj.select_set(True)
    # Keep the Blender collection editable, but batch the runtime meshes by material.
    bpy.context.view_layer.update()
    batches = {}
    for obj in sorted(objects, key=lambda item: item.name):
        if obj.type != "MESH":
            continue
        copy = obj.copy()
        copy.data = obj.data.copy()
        copy.parent = None
        collection.objects.link(copy)
        copy.matrix_world = obj.matrix_world.copy()
        batches.setdefault(obj.data.materials[0].name, []).append(copy)
    baked = []
    for parts in batches.values():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in parts:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]
        if len(parts) > 1:
            bpy.ops.object.join()
        baked.append(parts[0])
    bpy.ops.object.select_all(action="DESELECT")
    for obj in baked:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT / f"{name}.glb"),
                              export_format="GLB", use_selection=True)
    for obj in baked:
        bpy.data.objects.remove(obj, do_unlink=True)
    for obj in objects:
        if not obj.parent:
            obj.location.x += index * 5

bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "assets/blender/equipamentos-base.blend"), compress=True)
