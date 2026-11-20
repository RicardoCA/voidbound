"""Blender: textured, editable planetary workbench and material-batched game GLB."""
from pathlib import Path
from math import pi, sin
from random import Random
import bpy
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/models/equipamentos-base/bancada-planetaria.glb"
BLEND = ROOT / "assets/blender/bancada-planetaria.blend"
bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name, color, metallic=0, roughness=.65, grain=False, glow=0):
    mat=bpy.data.materials.new(name); mat.use_nodes=True; mat.diffuse_color=(*color,1)
    bsdf=mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value=(*color,1)
    bsdf.inputs["Metallic"].default_value=metallic
    bsdf.inputs["Roughness"].default_value=roughness
    bsdf.inputs["Emission Color"].default_value=(*color,1)
    bsdf.inputs["Emission Strength"].default_value=glow
    if grain:
        rng=Random(name); side=128; pixels=[]
        image=bpy.data.images.new(name+" · textura",width=side,height=side,alpha=False)
        for y in range(side):
            streak=rng.uniform(-.06,.06)
            for x in range(side):
                variation=1+streak+rng.uniform(-.08,.08)
                if grain=="wood": variation+=.11*sin(y*.36+sin(x*.07)*2)
                elif (x*17+y*31)%241<2: variation+=.3
                pixels.extend([max(0,min(1,c*variation)) for c in color]+[1])
        image.pixels.foreach_set(pixels); image.pack()
        tex=mat.node_tree.nodes.new("ShaderNodeTexImage"); tex.image=image
        mat.node_tree.links.new(tex.outputs["Color"],bsdf.inputs["Base Color"])
    return mat
steel=material("Ferro azulado escovado",(.19,.26,.30),.65,grain=True)
edge=material("Aço usinado",(.56,.62,.63),.8,.38,True)
dark=material("Grafite industrial",(.035,.05,.06),.2,grain=True)
wood=material("Madeira alienígena laminada",(.42,.245,.13),grain="wood")
green=material("Tapete de corte",(.075,.22,.17),roughness=.9,grain=True)
yellow=material("Faixas de segurança",(.86,.49,.085),.2,grain=True)
white=material("Marcação e plantas técnicas",(.65,.79,.76),roughness=.8)
copper=material("Cobre das ferramentas",(.55,.23,.09),.65,grain=True)
cyan=material("Visor de diagnóstico",(.04,.65,.73),.1,.3,glow=.5)

def finish(obj,name,mat):
    obj.name=name; obj.data.materials.append(mat); return obj

def box(name,loc,size,mat,bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); obj=finish(bpy.context.object,name,mat)
    obj.dimensions=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=obj.modifiers.new("Bordas usinadas","BEVEL"); mod.width=bevel; mod.segments=2
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=obj.modifiers.new("Normais ponderadas","WEIGHTED_NORMAL"); bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj

def cylinder(name,loc,radius,length,mat,axis="z",vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=length,location=loc,
        rotation={"z":(0,0,0),"x":(0,pi/2,0),"y":(pi/2,0,0)}[axis])
    return finish(bpy.context.object,name,mat)

def text(body,loc,size,mat):
    bpy.ops.object.text_add(location=loc,rotation=(pi/2,0,0)); obj=bpy.context.object
    obj.data.body=body; obj.data.size=size; obj.data.align_x="CENTER"; obj.data.extrude=.0005
    bpy.ops.object.convert(target="MESH"); return finish(bpy.context.object,body,mat)

# Two-tile work area; every side receives structural and surface detail.
for x in [-1.30,1.30]:
    for y in [-.40,.40]:
        box("Sapata de apoio",(x,y,.045),(.28,.26,.09),dark)
        box("Perna de ferro",(x,y,.48),(.13,.13,.88),steel)
        box("Proteção de canto",(x,y,.88),(.23,.23,.11),edge)
    box("Travessa lateral",(x,0,.25),(.10,.89,.10),steel)
for y in [-.40,.40]:
    box("Longarina inferior",(0,y,.26),(2.64,.10,.12),steel)
    box("Longarina superior",(0,y,.89),(2.75,.12,.14),steel)
box("Prateleira inferior",(0,0,.32),(2.58,.78,.065),steel)
for i in range(7):
    box("Ripa laminada do tampo",(0,(i-3)*.135,1.00),(2.98,.127,.14),wood)
for x in [-1.47,1.47]:
    box("Capa lateral do tampo",(x,0,1.00),(.055,1.02,.16),edge)
for y in [-.51,.51]:
    box("Cinta de contorno",(0,y,1.00),(3.02,.035,.16),steel)
    for x in [-1.35,-.8,0,.8,1.35]:
        cylinder("Rebite do tampo",(x,y,1.01),.023,.045,edge,"y",8)
# Drawer unit and handles.
box("Gabinete de gavetas",(.65,.10,.67),(1.03,.65,.40),steel)
for z in [.55,.72,.86]:
    box("Frente de gaveta",(.65,-.245,z),(.94,.045,.115),edge)
    box("Rebaixo do puxador",(.65,-.274,z),(.36,.018,.04),dark)
    box("Puxador",(.65,-.30,z),(.31,.025,.023),steel)
# Cutting mat, grid and ruler.
box("Tapete técnico",(-.32,-.015,1.083),(1.43,.72,.017),green,.004)
for i in range(12):
    box("Grade do tapete",(-.97+i*.115,-.015,1.094),(.002,.67,.001),white,0)
for i in range(6):
    box("Grade transversal",(-.32,-.32+i*.115,1.094),(1.37,.002,.001),white,0)
box("Régua de aço",(-.12,-.39,1.09),(1.12,.06,.014),edge,.003)
for i in range(25):
    box("Marcação métrica",(-.65+i*.043,-.4,1.100),(.002,.025 if i%5 else .045,.001),dark,0)
# Working vise with spindle and jaws.
box("Base da morsa",(-1.15,-.18,1.105),(.46,.42,.08),steel)
cylinder("Base giratória",(-1.15,-.18,1.16),.20,.08,edge)
for y in [-.31,-.03]:
    box("Corpo da mandíbula",(-1.15,y,1.27),(.39,.11,.20),steel)
    box("Mordente",(-1.15,y,1.375),(.37,.105,.025),edge,.004)
cylinder("Fuso da morsa",(-1.15,-.32,1.24),.035,.56,edge,"y")
cylinder("Manivela",(-1.15,-.60,1.24),.018,.34,steel,"x")
for x in [-1.31,-.99]: cylinder("Ponta da manivela",(x,-.60,1.24),.035,.055,dark,"x")
# Tool caddy, sockets, hammer and portable diagnostic terminal.
box("Bandeja de ferramentas",(.91,.32,1.13),(.91,.23,.10),dark)
for i in range(6): cylinder("Soquete",(.55+i*.13,.32,1.22),.036,.13,edge)
box("Cabo do martelo",(.11,.12,1.13),(.07,.38,.05),wood)
box("Cabeça do martelo",(.11,.29,1.16),(.28,.09,.095),edge)
for x in [.48,.68]:
    box("Chave de precisão",(x,-.10,1.12),(.035,.27,.018),edge)
    box("Empunhadura",(x,-.20,1.13),(.055,.12,.04),copper)
box("Terminal de diagnóstico",(1.03,-.20,1.16),(.49,.34,.15),dark)
box("Tela",(1.03,-.20,1.244),(.37,.22,.016),cyan,.003)
for i in range(3): box("Linhas do visor",(1.03,-.26+i*.045,1.254),(.27,.006,.002),white,0)
# Lower shelf stores physical supplies, not a second gameplay inventory.
box("Caixa de ferramentas",(-.70,.04,.50),(.77,.47,.28),dark)
box("Trava da caixa",(-.70,-.205,.52),(.09,.025,.12),yellow)
box("Alça da caixa",(-.70,.04,.66),(.29,.06,.04),edge)
for x in [.33,.60,.87]: cylinder("Bobina de fio",(x,.06,.47),.09,.20,copper)
for x in [-1.34,1.34]:
    for z in [.42,.55,.68]: box("Faixa de segurança",(x,-.475,z),(.12,.018,.065),yellow,.002)
text("VOIDBOUND / OFICINA",(0,-.535,.93),.085,white)
text("BANCADA PLANETARIA",(.65,-.277,.56),.040,dark)

# Batch only runtime copies so the Blender source remains fully editable.
source=[obj for obj in bpy.context.scene.objects if obj.type=="MESH"]
collection=bpy.data.collections.new("Bancada planetária · peças editáveis")
bpy.context.scene.collection.children.link(collection)
for obj in source:
    for old in list(obj.users_collection): old.objects.unlink(obj)
    collection.objects.link(obj)
bpy.context.view_layer.update()
batches={}
for obj in source:
    copy=obj.copy(); copy.data=obj.data.copy(); collection.objects.link(copy)
    batches.setdefault(obj.data.materials[0].name,[]).append(copy)
baked=[]
for parts in batches.values():
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts: part.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    if len(parts)>1: bpy.ops.object.join()
    baked.append(parts[0])
bpy.ops.object.select_all(action="DESELECT")
for obj in baked: obj.select_set(True)
OUT.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format="GLB",use_selection=True)
for obj in baked: bpy.data.objects.remove(obj,do_unlink=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND),compress=True)
print("BANCADA_EXPORTADA",str(OUT),len(source),"peças editáveis",len(batches),"materiais")
