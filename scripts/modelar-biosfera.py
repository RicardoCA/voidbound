"""Gera a biosfera do Voidbound com Blender em modo background."""
from array import array
from math import cos, pi, sin
from pathlib import Path
from random import Random

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
BIOMES = [
    ("Basalto", 0x57434d, 0x625780, 0xc38bd7, ("lagarto", "rastejante")),
    ("Dunas", 0x846044, 0xa59455, 0xeda53f, ("lebre", "chacal")),
    ("Gelo", 0x617d93, 0x90bfcd, 0x81d9f5, ("lemure", "urso")),
    ("Jade", 0x68563d, 0x437d4e, 0xabd14b, ("cervo", "felino")),
    ("Cinzas", 0x49333e, 0x974543, 0xfa7540, ("tatu", "salamandra")),
    ("Maré", 0x496a59, 0x51a99c, 0x4ecda3, ("caranguejo", "vibora")),
]


def material(name, color, texture=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    rgba = tuple((((color >> shift) & 255) / 255) ** 2.2 for shift in (16, 8, 0)) + (1,)
    mat.diffuse_color = rgba
    shader.inputs["Base Color"].default_value = rgba
    shader.inputs["Roughness"].default_value = .76
    if texture:
        size = 64
        rng = Random(name)
        image = bpy.data.images.new(name, width=size, height=size)
        pixels = array("f")
        for y in range(size):
            for x in range(size):
                ripple = .9 + .14 * sin(y * .92 + sin(x * .38)) + rng.random() * .20
                pixels.extend(min(1, c * ripple) for c in rgba[:3])
                pixels.append(1)
        image.pixels.foreach_set(pixels)
        image.pack()
        node = mat.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = image
        mat.node_tree.links.new(node.outputs["Color"], shader.inputs["Base Color"])
    return mat


def oval(name, pos, scale, mat, facets=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=facets, ring_count=8, location=pos)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def branch(name, start, end, base, tip, mat):
    a, b = Vector(start), Vector(end)
    direction = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=9, radius1=base, radius2=tip,
                                     depth=direction.length, location=(a + b) / 2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    return obj


def plant(kind, bark, leaves, accent, seed):
    rng = Random(seed)
    branch("Tronco", (0, 0, 0), (.015, 0, .8), .068, .028, bark)
    for i in range(7):
        angle = i * 2.4
        z = .37 + i * .073
        if kind in (1, 5):
            z = .58 + i * .027
        elif kind == 2:
            z = .25 + i * .095
        reach = (.37 - i * .036) * (1.19 if kind in (1, 3, 5) else 1)
        tip = (cos(angle) * reach, sin(angle) * reach, z + (.07 if kind == 2 else .17))
        branch("Galho", (0, 0, z - .08), tip, .027, .007, bark)
        for j in range(3):
            offset = (tip[0] + (rng.random() - .5) * .18, tip[1] + (rng.random() - .5)*.18, tip[2] + j*.027)
            sizes = [(.16,.12,.065), (.23,.15,.047), (.15,.10,.077),
                     (.22,.18,.122), (.17,.078,.069), (.22,.078,.045)]
            leaf = oval("Folhagem", offset, sizes[kind], accent if j == 2 else leaves)
            leaf.rotation_euler.z = angle
    for i in range(5):
        angle = i * 2 * pi / 5
        spread = .37 if kind == 5 else .21
        branch("Raiz", (cos(angle)*spread, sin(angle)*spread, .012), (0, 0, .25 if kind == 5 else .13), .011, .041, bark)
    if kind == 2:
        for i in range(4):
            z = .36+i*.15
            reach = .31-i*.062
            branch("Copa conífera", (0,0,z), (0,0,z+.28), reach, .012, leaves)
    if kind in (0, 4):
        for i in range(4):
            angle = i*1.5
            r = .11+i*.031
            branch("Espora", (cos(angle)*r,sin(angle)*r,.56+i*.064),
                   (cos(angle)*(r+.087),sin(angle)*(r+.087),.71+i*.063), .048,.004,accent)


def fruit(kind, skin, leaves, accent):
    shape = [(.27,.24,.25),(.24,.23,.34),(.26,.23,.30),(.26,.24,.38),(.27,.21,.30),(.33,.27,.22)][kind]
    for index, x in enumerate((-.34, 0, .34)):
        z = shape[2] * (.75 if index != 1 else 1.02)
        oval("Fruta", (x, .10 if index != 1 else -.11, z), shape, skin)
        branch("Pedúnculo", (x, 0, z + shape[2] * .7), (x+.05, 0, z + shape[2] + .14), .031, .018, leaves)
        leaf = oval("Folha", (x+.14, 0, z + shape[2] + .05), (.17,.066,.028), leaves)
        leaf.rotation_euler.y = -.36
        if kind in (0, 4, 5):
            for i in range(5):
                angle = i * 2 * pi / 5
                oval("Nervura", (x+cos(angle)*shape[0]*.85, sin(angle)*shape[1]*.87, z),
                     (.036,.036,shape[2]*.4), accent, 8)


def animal(species, hostile, skin, accent, dark):
    crawler = species in ("lagarto", "rastejante", "salamandra", "vibora")
    crab = species == "caranguejo"
    tall = species in ("cervo", "chacal")
    heavy = species in ("urso", "tatu")
    body_z = .43 if tall else .31 if heavy else .22
    oval("Tronco", (-.05, 0, body_z), (.37, .25 if heavy or crab else .16,
                                      .22 if heavy else .14 if not crawler else .105), skin)
    muzzle = .34 if crab else .47
    head_z = body_z + (.23 if tall else .06)
    branch("Pescoço", (.17,0,body_z), (.34,0,head_z), .13, .10, skin)
    oval("Cabeça", (muzzle-.06,0,head_z), (.19,.13,.14), skin)
    oval("Focinho", (muzzle+.09,0,head_z-.045), (.14,.091,.067), accent)
    for side in (-1, 1):
        oval("Olho", (muzzle+.019, side*.117, head_z+.045), (.034,.017,.028), dark, 10)
        oval("Íris", (muzzle+.027,side*.129,head_z+.05), (.012,.008,.012), accent, 8)
        if species in ("lebre", "lemure", "chacal", "felino", "urso"):
            ear_height = .24 if species == "lebre" else .105
            ear = oval("Orelha", (muzzle-.11, side*.102, head_z+.1+ear_height*.52), (.061,.055,ear_height), accent)
            ear.rotation_euler.y = -.24
        if species == "cervo":
            root = (muzzle-.11, side*.095, head_z+.1)
            tip = (muzzle-.14, side*.19, head_z+.43)
            branch("Galhada", root, tip, .033, .009, accent)
            branch("Ponta da galhada", (tip[0],tip[1]-.025,tip[2]-.115),
                   (tip[0]+.14,tip[1],tip[2]+.01), .019, .004, accent)
        if species == "vibora":
            continue
        for x in ((-.25,-.09,.07,.23) if crab else (-.23,.21)):
            shoulder=(x, side*.115, body_z-.015)
            knee=(x+.05, side*(.31 if crab else .18), body_z*.48)
            foot=(x+.12, side*(.42 if crab else .19), .035)
            branch("Coxa", shoulder, knee, .085 if heavy else .057, .044, skin)
            branch("Pata", knee, foot, .046, .028, accent)
            oval("Pé", foot, (.083,.053,.039), dark, 10)
        if crab:
            branch("Braço da pinça", (.26,side*.14,.22), (.55,side*.32,.23), .068,.052, skin)
            for j in (-1,1):
                claw=oval("Pinça",(.59,side*.34+j*.047,.235),(.15,.056,.063),accent)
                claw.rotation_euler.z=j*.29
        if hostile and not crab:
            branch("Presa", (muzzle+.08,side*.071,head_z-.066),
                   (muzzle+.11,side*.071,head_z-.145), .021, .002, accent)
    if not crab:
        tail_length = .65 if crawler or species in ("lemure","felino") else .29
        previous = (-.28, 0, body_z)
        for i in range(4):
            t = (i+1)/4
            tail = (-.30-tail_length*t, sin(t*4)*.12, body_z*(1-t*.55)+sin(t*pi)*.12)
            branch("Cauda", previous, tail, .095*(1-(i/4)*.75), .088*(1-t*.84), skin)
            previous = tail
    if species in ("tatu","rastejante","salamandra","vibora","caranguejo"):
        for i in range(5):
            x = -.31+i*.119
            oval("Placa dorsal", (x,0,body_z+.105),(.098,.17,.043 if species=="tatu" else .067),accent)


def export_one(dataset, kind, type_name):
    biome, bark_color, foliage, fruit_color, species = dataset
    name = f"{type_name}-{kind}"
    collection = bpy.data.collections.new(f"{biome} · {type_name}")
    bpy.context.scene.collection.children.link(collection)
    bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children[collection.name]
    bark = material(name+" · casca", bark_color, True)
    leaves = material(name+" · folhas", foliage, True)
    accent = material(name+" · detalhes", fruit_color)
    dark = material(name+" · sombra", 0x263039)
    if type_name == "planta":
        plant(kind,bark,leaves,accent,name)
    elif type_name == "fruta":
        fruit(kind,material(name+" · casca da fruta",fruit_color,True),leaves,bark)
    else:
        hostile = type_name == "hostil"
        animal(species[int(hostile)],hostile,
               material(name+" · pele",bark_color if hostile else foliage,True),
               leaves if hostile else accent,dark)
    bpy.ops.object.select_all(action="DESELECT")
    groups = {}
    for obj in collection.objects:
        groups.setdefault(obj.data.materials[0].name, []).append(obj)
    for parts in groups.values():
        for obj in parts:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]
        if len(parts) > 1:
            bpy.ops.object.join()
        bpy.context.object.select_set(False)
    for obj in collection.objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT/"public/models/biosfera"/(name+".glb")),
                              export_format="GLB", use_selection=True)
    collection.hide_viewport = collection.hide_render = True


bpy.ops.wm.read_factory_settings(use_empty=True)
(ROOT/"public/models/biosfera").mkdir(parents=True, exist_ok=True)
for kind, biome in enumerate(BIOMES):
    for type_name in ("planta","fruta","pacifico","hostil"):
        export_one(biome,kind,type_name)
for collection in bpy.data.collections:
    if collection.name.startswith("Jade"):
        collection.hide_viewport = collection.hide_render = False
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/"assets/blender/biosfera.blend"),compress=True)
