"""Blender sources and embedded-texture GLBs for planetary trade and communications.
Uses the same authored metal/UV/export toolkit as the scientific installations.
"""
from pathlib import Path
source = Path(__file__).with_name("modelar-instalacoes.py").read_text()
exec(source.split("builders=[")[0], globals())

def trading_post():
    base("ENTREPOSTO / CARGAS",orange)
    box("Armazém de excedentes",(-.60,.15,.95),(1.35,.70,1.28),steel)
    for z in [.55,.90,1.25]:
        box("Prateleira logística",(-.60,-.24,z),(1.30,.06,.06),orange)
        for x in [-1.02,-.61,-.20]:
            box("Caixa de frete",(x,-.15,z+.15),(.33,.35,.25),dark)
            for dx in [-.10,.10]: box("Trava da caixa",(x+dx,-.34,z+.15),(.035,.03,.27),edge,.002)
    for x in [-1.31,.12]:
        pipe("Montante do armazém",(x,.40,.35),(x,.40,1.80),.045,edge)
    box("Cobertura de carga",(-.60,.03,1.77),(1.54,1.0,.12),orange)
    console(.84,-.10,1.02,orange)
    box("Balança para mercadorias",(.77,-.04,.44),(.92,.72,.12),edge)
    for i in range(6):box("Grelha da balança",(.43+i*.13,-.04,.51),(.045,.60,.025),dark,.003)
    text("TRADE / 01",(-.60,-.49,1.72),.12,white)
    pipe("Antena comercial",(1.18,.37,.30),(1.18,.37,2.12),.03,steel)
    sphere("Sinalizador de pouso",(1.18,.37,2.14),(.07,.07,.07),cyan)
    for x in [-1.25,1.25]:
        for z in [.55,.70,.85]:box("Ventilação traseira",(x,.52,z),(.20,.03,.04),dark,.002)

def communications_post():
    base("COMUNICACOES / CONSELHO",blue)
    box("Rack de rádio",(-.88,.05,.96),(.80,.76,1.22),steel)
    for z in [.52,.78,1.04,1.30]:
        box("Módulo de transmissão",(-.88,-.35,z),(.66,.055,.19),dark)
        for i in range(3):cylinder("Indicador do rádio",(-1.08+i*.17,-.39,z+.03),.018,.018,cyan,"y",8)
    console(.12,-.18,.97,blue)
    box("Balcão de atendimento",(.63,-.17,.57),(1.37,.72,.38),steel)
    box("Tampo de documentos",(.63,-.17,.79),(1.43,.77,.08),dark)
    for i in range(3):box("Documentação de pedidos",(.73+i*.07,-.25,.85+i*.014),(.27,.34,.01),white,.001)
    cylinder("Mastro da antena",(.95,.32,1.34),.055,1.95,edge)
    # Parabolic array with concentric conductors and a receiver at the focus.
    for i in range(4):
        bpy.ops.mesh.primitive_torus_add(major_radius=.18+i*.13,minor_radius=.018,major_segments=24,minor_segments=6,location=(.95,.32,2.13-i*.045))
        finish(bpy.context.object,"Refletor concêntrico",steel)
    for angle in [0,pi/2,pi,3*pi/2]:
        pipe("Costela da parábola",(.95,.32,2.13),(.95+cos(angle)*.58,.32+sin(angle)*.58,2.0),.02,edge)
        pipe("Braço do receptor",(.95+cos(angle)*.40,.32+sin(angle)*.40,2.04),(.95,.32,2.53),.012,dark)
    sphere("Receptor de transmissões",(.95,.32,2.53),(.07,.07,.10),cyan)
    text("COMMS / HELP",(-.45,-.47,1.62),.12,white)
    box("Painel de mensagens",(-.45,-.43,1.83),(1.65,.07,.44),dark)
    for i in range(4):box("Pedidos no painel",(-.52,-.48,1.96-i*.08),(.99-i*.10,.01,.022),cyan,.002)

builders=[("entreposto-comercial",trading_post),("posto-comunicacoes",communications_post)]
exec("for filename,builder in builders:" + source.split("for filename,builder in builders:",1)[1],globals())
