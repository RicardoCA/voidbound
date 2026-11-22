"""Six detailed, textured planetary industry/science facilities. Blender sources + batched GLBs."""
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

# Common construction language: textured hull, vents, bolts, inspection panels.
blue=material("Azul científico",(.10,.28,.49),.55,grain=True)
orange=material("Laranja industrial",(.72,.27,.065),.4,grain=True)
purple=material("Violeta de laboratório",(.33,.20,.47),.3,grain=True)
glass=material("Vidro de amostras",(.12,.52,.60),.25,.24,glow=.12)
hot=material("Fornalha incandescente",(1,.18,.025),.3,.4,glow=2)
from math import cos

def sphere(name,loc,scale,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=loc)
    obj=finish(bpy.context.object,name,mat); obj.scale=scale; return obj

def pipe(name,a,b,r,mat):
    delta=Vector(b)-Vector(a); obj=cylinder(name,(Vector(a)+Vector(b))/2,r,delta.length,mat)
    obj.rotation_euler=delta.to_track_quat('Z','Y').to_euler(); return obj

def console(x,y,z,mat):
    box("Console blindado",(x,y,z),(.64,.34,.42),mat)
    box("Tela de diagnóstico",(x,y-.177,z+.05),(.48,.018,.22),cyan,.003)
    for j in range(4): box("Telemetria no visor",(x-.03,y-.19,z+.12-j*.045),(.31-j*.04,.006,.009),white,0)
    for j in range(3): cylinder("Botão de comando",(x-.18+j*.16,y-.19,z-.10),.029,.025,yellow,"y")

def base(label,mat):
    box("Chassi reforçado",(0,0,.14),(2.9,1.1,.22),dark)
    box("Deck aparafusado",(0,0,.29),(2.76,1.04,.09),steel)
    for x in [-1.3,1.3]:
        for y in [-.44,.44]:
            box("Sapata de nivelamento",(x,y,.055),(.25,.23,.10),edge)
            cylinder("Parafuso de ancoragem",(x,y,.33),.035,.025,yellow)
    for x in [-1.38,1.38]:
        box("Painel de inspeção lateral",(x,0,.22),(.025,.76,.13),mat)
        for i in range(7): box("Grelha lateral",(x*1.008,-.27+i*.09,.22),(.012,.028,.07),dark,.001)
    for i in range(14): box("Listras de segurança",(-1.18+i*.18,-.562,.16),(.09,.018,.065),yellow,.002)
    text(label,(0,-.57,.24),.07,white)

def refinery():
    base("REFINARIA / VOIDBOUND",orange)
    box("Fornalha pressurizada",(-.45,.08,.95),(1.18,.85,1.18),steel)
    box("Porta de carga",(-.45,-.36,.91),(.89,.09,.67),dark)
    box("Janela térmica",(-.45,-.415,1.02),(.68,.018,.27),hot)
    for i in range(5): box("Proteção térmica",(-.72+i*.135,-.438,1.02),(.032,.02,.31),edge,.003)
    cylinder("Colar da fornalha",(-.45,.08,1.60),.45,.12,orange)
    bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=.35,radius2=.53,depth=.35,location=(-.45,.08,1.82)); finish(bpy.context.object,"Funil de minério",steel)
    for x in [-.9,0]:
        pipe("Duto de extração",(x,.34,1.1),(x,.34,2.03),.085,dark)
        cylinder("Filtro da chaminé",(x,.34,2.05),.12,.15,edge)
        for j in range(4): cylinder("Aletas do filtro",(x,.34,1.97+j*.04),.135,.015,dark)
    box("Esteira de saída",(.85,-.01,.48),(.92,.65,.25),dark)
    for i in range(9): cylinder("Rolete da esteira",(.48+i*.09,-.01,.62),.035,.54,edge,"y")
    for i in range(3): box("Lingote processado",(.65+i*.17,-.03,.70),(.13,.35,.09),copper)
    console(.92,.22,1.06,orange)
    pipe("Tubulação de refrigeração",(-1.1,.4,.5),(-1.1,.4,1.5),.045,copper)
    for z in [.6,1.35]: pipe("Ligação térmica",(-1.1,.4,z),(-.5,.4,z),.04,copper)

def observatory():
    base("OBSERVATORIO / LENTE 06",blue)
    cylinder("Base azimutal",(-.35,.08,.47),.43,.28,steel)
    for i in range(12):
        a=i*pi/6; box("Reforço da base",(-.35+cos(a)*.40,.08+sin(a)*.40,.47),(.07,.07,.20),edge)
    cylinder("Eixo do telescópio",(-.35,.08,.88),.15,.65,blue)
    # Parabolic segmented mirror, actual bowl geometry rather than a sphere.
    verts=[(-.35,.08,1.20)]; rings=7; n=32
    for j in range(1,rings+1):
        r=j/rings*.78
        for i in range(n):
            a=2*pi*i/n; verts.append((-.35+r*cos(a),.08+r*sin(a),1.20+.85*r*r))
    faces=[]
    for i in range(n): faces.append((0,1+i,1+(i+1)%n))
    for j in range(rings-1):
        for i in range(n):
            a=1+j*n+i;b=1+j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
    mesh=bpy.data.meshes.new("Espelho parabólico");mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new("Antena parabólica segmentada",mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(edge)
    for i in range(8):
        a=i*pi/4; pipe("Braço do receptor",(-.35+cos(a)*.75,.08+sin(a)*.75,1.7),(-.35,.08,2.22),.018,blue)
    sphere("Sensor focal",(-.35,.08,2.20),(.11,.11,.16),cyan)
    for i in range(24):
        a=i*pi/12;pipe("Aro do espelho",(-.35+.79*cos(a),.08+.79*sin(a),1.73),(-.35+.79*cos(a+pi/12),.08+.79*sin(a+pi/12),1.73),.025,blue)
    console(.95,-.12,.63,blue)
    box("Servidor de cartografia",(1,.30,.80),(.45,.34,.76),dark)
    for j in range(7):box("Gaveta do servidor",(1,.118,.58+j*.08),(.34,.025,.035),edge,.002)

def probe():
    base("SONDA / GEOLOGIA",yellow)
    for x in [-.60,.60]:
        pipe("Pórtico de sondagem",(x,0,.33),(x,0,1.75),.065,steel)
        for z in [.5,1.2,1.65]:box("Trava do pórtico",(x,0,z),(.18,.16,.08),yellow)
    box("Cabeçote de perfuração",(0,0,1.60),(1.3,.48,.32),orange)
    cylinder("Motor da broca",(0,0,1.87),.22,.35,dark)
    cylinder("Haste perfuradora",(0,0,.91),.09,1.20,edge)
    for i in range(12):
        a=i*.9;box("Dente helicoidal",(.12*cos(a),.12*sin(a),.38+i*.07),(.17,.08,.045),copper,.004).rotation_euler.z=a
    console(-.97,-.10,.73,yellow)
    box("Bandeja de testemunhos",(.97,-.07,.45),(.57,.60,.15),dark)
    for i in range(4):
        cylinder("Tubo de amostra",(.8+i*.11,-.08,.67),.043,.35,glass)
        cylinder("Tampa numerada",(.8+i*.11,-.08,.86),.05,.04,yellow)
    pipe("Antena de telemetria",(.95,.35,.4),(.95,.35,1.55),.015,edge)
    sphere("Baliza geológica",(.95,.35,1.55),(.06,.06,.06),cyan)

def collector():
    base("COLETOR / AMBIENTE",green)
    for x in [-.75,.05,.85]:
        cylinder("Reservatório isolado",(x,.1,.75),.26,.83,steel)
        cylinder("Cinta do tanque",(x,.1,.60),.28,.05,edge)
        cylinder("Tampa do tanque",(x,.1,1.18),.28,.08,green)
        box("Indicador de nível",(x,-.17,.80),(.09,.025,.44),glass,.004)
        pipe("Cano de drenagem",(x,.1,1.2),(x,.1,1.52),.035,copper)
    bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=.18,radius2=1.10,depth=.42,location=(0,.1,1.7));finish(bpy.context.object,"Funil coletor resistente ao ácido",steel)
    cylinder("Tela de filtragem",(0,.1,1.92),1.08,.025,dark)
    for i in range(17):
        x=(i-8)*.12; length=2*(max(0,1.05**2-x*x)**.5)
        box("Grade do coletor",(x,.1,1.945),(.022,length,.025),edge,.002)
    console(1.08,-.37,.69,green)
    for x in [-1.15,1.15]:pipe("Suporte do funil",(x,.28,.34),(x*.8,.28,1.78),.035,green)

def weather():
    base("METEOROLOGIA / MET-01",blue)
    cylinder("Mastro meteorológico",(-.35,.12,1.24),.065,1.9,edge)
    for z in [.5,1.0,1.5,2.0]:cylinder("Abraçadeira",(-.35,.12,z),.09,.045,blue)
    for i in range(7):cylinder("Abrigo de sensores",(-.35,.12,1.2+i*.055),.25,.026,white)
    pipe("Travessa do anemômetro",(-.85,.12,2.24),(.15,.12,2.24),.025,steel)
    for i in range(3):
        a=i*2*pi/3;pipe("Braço anemométrico",(-.35,.12,2.3),(-.35+.43*cos(a),.12+.43*sin(a),2.3),.015,steel)
        sphere("Copo anemométrico",(-.35+.43*cos(a),.12+.43*sin(a),2.3),(.11,.11,.065),blue)
    pipe("Sensor de direção",(-.35,.12,2.35),(-.35,.12,2.58),.015,edge)
    box("Biruta rígida",(-.18,.12,2.53),(.45,.035,.10),yellow,.002)
    cylinder("Pluviômetro",(.6,.24,.72),.20,.70,white)
    cylinder("Boca do pluviômetro",(.6,.24,1.1),.25,.06,steel)
    console(.96,-.18,.64,blue)
    box("Painel de alimentação auxiliar",(-1.02,-.08,.51),(.52,.73,.08),dark)
    for i in range(4):box("Célula fotovoltaica auxiliar",(-1.02,-.35+i*.18,.56),(.45,.13,.012),blue,.001)

def lab():
    base("LABORATORIO / AMOSTRAS",purple)
    for x in [-1.2,0,1.2]:box("Módulo de bancada",(x,0,.68),(.72,.88,.72),steel)
    box("Tampo químico",(0,0,1.09),(2.7,1.04,.12),white)
    for x in [-1.16,1.16]:
        for z in [.48,.68,.88]:
            box("Gaveta de amostras",(x,-.455,z),(.59,.035,.15),purple)
            box("Puxador",(x,-.48,z),(.20,.025,.025),edge,.003)
    # Detailed microscope, illuminated sample, optics and focusing knobs.
    box("Base do microscópio",(-.60,-.10,1.20),(.52,.46,.10),dark)
    pipe("Braço do microscópio",(-.60,.08,1.24),(-.60,.08,1.8),.065,steel)
    pipe("Óptica",(-.60,.08,1.8),(-.60,-.19,1.67),.07,edge)
    cylinder("Objetiva",(-.60,-.19,1.55),.055,.17,dark)
    box("Lâmina iluminada",(-.60,-.18,1.32),(.30,.25,.025),cyan,.002)
    cylinder("Foco micrométrico",(-.45,.08,1.55),.08,.12,purple,"x")
    box("Bandeja de reagentes",(.05,.17,1.2),(.47,.42,.08),dark)
    for i in range(4):
        cylinder("Frasco de reagente",(-.1+i*.10,.17,1.39),.036,.29,glass)
        cylinder("Tampa de segurança",(-.1+i*.10,.17,1.55),.044,.035,purple)
    console(.92,-.13,1.36,purple)
    for x in [-1.25,1.25]:pipe("Estrutura do exaustor",(x,.45,1.1),(x,.45,1.91),.035,steel)
    box("Capela de exaustão",(0,.40,1.93),(2.65,.27,.18),dark)
    box("Iluminação da capela",(0,.35,1.82),(2.30,.04,.03),cyan,.003)
    for i in range(10):box("Filtro de ar",(-1+i*.22,.25,1.94),(.10,.025,.08),edge,.002)

builders=[("refinaria-planetaria",refinery),("observatorio-planetario",observatory),("sonda-geologica",probe),("coletor-climatico",collector),("estacao-meteorologica",weather),("laboratorio-amostras",lab)]
for filename,builder in builders:
    bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
    builder()
    source=[o for o in bpy.context.scene.objects if o.type=="MESH"]
    # Keep authored primitive UVs; map the custom parabolic dish explicitly.
    for obj in source:
        if not obj.data.uv_layers:
            uv=obj.data.uv_layers.new(name="UVMap")
            for loop in obj.data.loops:
                co=obj.data.vertices[loop.vertex_index].co
                uv.data[loop.index].uv=((co.x+1.5)/3,(co.y+.6)/1.2)
    # UVs on primitive meshes are preserved; texture images are embedded in GLB.
    batches={}
    for obj in source:
        copy=obj.copy();copy.data=obj.data.copy();bpy.context.collection.objects.link(copy)
        batches.setdefault(obj.data.materials[0].name,[]).append(copy)
    baked=[]
    for parts in batches.values():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in parts:obj.select_set(True)
        bpy.context.view_layer.objects.active=parts[0]
        if len(parts)>1:bpy.ops.object.join()
        baked.append(parts[0])
    bpy.ops.object.select_all(action="DESELECT")
    for obj in baked:obj.select_set(True)
    out=ROOT/"public/models/equipamentos-base"/(filename+".glb")
    out.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(out),export_format="GLB",use_selection=True)
    for obj in baked:bpy.data.objects.remove(obj,do_unlink=True)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/"assets/blender"/(filename+".blend")),compress=True)
    print("INSTALACAO_EXPORTADA",filename,len(source),"peças",len(batches),"materiais",flush=True)

# Exit cleanly after files are flushed; avoids headless audio teardown stalls.
import sys, os
sys.stdout.flush()
os._exit(0)
