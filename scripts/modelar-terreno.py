"""Build six Blender voxel kits with embedded atlases for the procedural terrain."""
from pathlib import Path
from math import sin, cos, hypot, pi
from random import Random
import bpy

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/models/terreno"
TILE = 64
COLUMNS = 8
ROWS = 4
PITCH = TILE + 4
WIDTH, HEIGHT = COLUMNS * PITCH, ROWS * PITCH

# Rock, exposed crust, stratum color, and stratum frequency.
BIOMES = [
    ("rochoso", (.34,.23,.20), (.55,.37,.31), (.62,.42,.34), 4),
    ("desertico", (.55,.30,.145), (.78,.53,.26), (.84,.56,.28), 8),
    ("gelado", (.22,.48,.62), (.74,.89,.95), (.54,.80,.89), 5),
    ("florestal", (.28,.19,.125), (.25,.46,.18), (.44,.30,.18), 6),
    ("vulcanico", (.20,.14,.17), (.32,.19,.19), (.56,.23,.15), 3),
    ("oceanico", (.18,.34,.36), (.38,.58,.51), (.45,.64,.59), 6),
]
ORES = {
    2: (.72,.77,.79), 3: (.86,.41,.17), 4: (.72,.62,.89),
    5: (.235,.26,.29), 6: (.33,.68,.76), 7: (.35,.86,.71),
    8: (.63,.87,.99), 9: (.64,.75,.31), 10: (.68,.44,.22),
    11: (.93,.69,.20), 12: (.49,.43,.40),
}


def blend(a, b, amount):
    return tuple(x + (y-x)*amount for x, y in zip(a, b))


def patch(index, tile, variant, rock, crust, layer, frequency):
    rng = Random(7103 + tile * 91 + variant * 337)
    noise = [[rng.uniform(-1, 1) for _ in range(TILE)] for _ in range(TILE)]
    deposits = [(rng.uniform(.18,.82), rng.uniform(.16,.84), rng.uniform(.09,.19))
                for _ in range(5)]
    result = []
    for y in range(TILE):
        v = y / (TILE-1)
        row = []
        for x in range(TILE):
            u = x / (TILE-1)
            wave = sin(2*pi*(frequency*v + .17*sin(u*8 + index) + .08*sin(u*26+v*11)))
            grain = noise[y][x]
            coarse = sin(u*43+v*33)*sin(v*28-u*15)
            base = crust if variant == 2 or (variant == 1 and v > .83 + .04*coarse) else rock
            color = blend(base, layer, max(0, wave*.32 + coarse*.12))
            shade = .92 + .11*wave + .08*coarse + .13*grain
            if index == 4 and abs(wave + .25*coarse) < .055:
                color = blend(color, (.78,.24,.085), .66)
            if index == 2 and abs(sin(u*26+v*15+coarse)) < .085:
                color = blend(color, (.70,.89,.96), .35)
            if tile in ORES:
                field = max(
                    1 - hypot((u-cx)*(1.6 if tile in (4,7,8) else .86), (v-cy)*1.08) / radius
                    for cx,cy,radius in deposits
                ) + .13*coarse + .07*grain
                if field > -.08:
                    color = blend(color, (.11,.09,.11), .66)
                if field > .055:
                    color = ORES[tile]
                    # Broad bright facets with thin darker fracture lines.
                    facet = sin((u*1.2+v*1.65)*104 + tile*.7)
                    shade = .78 + .22*max(0, facet) + .36*max(0, field) + .1*grain
                    if tile == 9 and abs(sin((u+v*.36)*110)) < .35:
                        shade *= .55
                    if tile in (3, 6) and field > .55:
                        color = blend(color, (1,.88,.69), .27)
            row.append(tuple(max(0, min(1, c*shade)) for c in color) + (1,))
        result.append(row)
    return result


def atlas(index, name, rock, crust, layer, frequency):
    pixels = [0.] * (WIDTH*HEIGHT*4)
    # Tiles are arranged as 12 underground, 12 surface sides, and one dedicated surface top.
    # Ore tops reuse side patches to carry the same deposit through a block edge.
    for slot in range(25):
        variant, tile = divmod(slot, 12)
        image = patch(index, tile+1, variant, rock, crust, layer, frequency)
        ox, oy = (slot % COLUMNS)*PITCH, (slot // COLUMNS)*PITCH
        for y in range(PITCH):
            for x in range(PITCH):
                i = ((oy+y)*WIDTH+ox+x)*4
                pixels[i:i+4] = image[min(TILE-1,max(0,y-2))][min(TILE-1,max(0,x-2))]
    image = bpy.data.images.new("Atlas " + name, WIDTH, HEIGHT, alpha=False)
    image.pixels.foreach_set(pixels)
    image.pack()
    material = bpy.data.materials.new("Terreno " + name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = image
    shader = nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = .73 if index == 2 else .91
    material.node_tree.links.new(tex.outputs["Color"], shader.inputs["Base Color"])
    return material


def voxel(tile, surface, material, collection):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.object
    obj.name = f"voxel_{tile}_{int(surface)}"
    obj.data.materials.append(material)
    uv = obj.data.uv_layers.active.data
    for face in obj.data.polygons:
        # Blender +Z is the top of the block. Each face uses the full atlas patch.
        slot = tile-1
        if surface and face.normal.z >= 0:
            slot = 24 if tile == 1 and face.normal.z > .5 else 12+slot
        ox, oy = (slot % COLUMNS)*PITCH+2, (slot // COLUMNS)*PITCH+2
        for loop in face.loop_indices:
            x,y,z = obj.data.vertices[obj.data.loops[loop].vertex_index].co
            u,v = (x,y) if abs(face.normal.z) > .5 else ((y,z) if abs(face.normal.x) > .5 else (x,z))
            uv[loop].uv = ((ox+.5+(u+.5)*(TILE-1))/WIDTH, (oy+.5+(v+.5)*(TILE-1))/HEIGHT)
    for previous in list(obj.users_collection):
        previous.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


bpy.ops.wm.read_factory_settings(use_empty=True)
OUTPUT.mkdir(parents=True, exist_ok=True)
for index, (name, *palette) in enumerate(BIOMES):
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    material = atlas(index, name, *palette)
    objects = [voxel(tile, surface, material, collection)
               for surface in (False, True) for tile in range(1, 13)]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT / f"{name}.glb"),
                              export_format="GLB", use_selection=True)
    for position, obj in enumerate(objects):
        obj.location = ((position % 12)*1.25, -index*3.4 + (position//12)*1.25, 0)
        # Object names need only be unique inside each exported kit.
        obj.name = name + "_" + obj.name
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "assets/blender/terreno-biomas.blend"), compress=True)
