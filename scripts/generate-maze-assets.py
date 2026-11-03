#!/usr/bin/env python3
"""Generate static, locally-authored pixel art for Maze of the Minotaur. No network or runtime AI."""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib
from character_rig_authoring import generate_character_rig_assets
from mythic_vfx_atlas import generate_mythic_vfx_atlas

ROOT = Path(__file__).resolve().parents[1] / 'public/assets/maze'
THEMES = {
 'palace_foundations': ('#62594d','#98856b','#272521','#4b4035','#b3864d','#401f1e'),
 'serpent_galleries': ('#4b5548','#87906b','#202721','#39483b','#a1814e','#416146'),
 'cyclopean_halls': ('#55534e','#918879','#242321','#494640','#b17c48','#6a3830'),
 'forgotten_cisterns': ('#465552','#7f9890','#1c2928','#334542','#a98b58','#38656a'),
 'chthonic_depths': ('#393333','#756052','#171719','#342a2b','#a66b43','#671f24'),
 'heart_of_the_maze': ('#302b2b','#69605a','#131315','#282325','#bb8545','#7d2928'),
}

def rgb(hexcolor):
    return tuple(int(hexcolor[i:i+2], 16) for i in (1,3,5))
def px(draw, xy, color): draw.rectangle(xy, fill=color)
def line(draw, coords, fill, width=1): draw.line(coords, fill=fill, width=width)
def greek_band(draw, y, color, dark):
    # A repeated stepped meander in crisp two-pixel strokes.
    for x in range(2, 64, 12):
        line(draw, [(x,y),(x+7,y),(x+7,y+5),(x+3,y+5),(x+3,y+2),(x+10,y+2)], color, 2)
        line(draw, [(x+1,y+1),(x+6,y+1),(x+6,y+4),(x+4,y+4)], dark, 1)

def texture(theme, kind, cols):
    wall, lit, floor, floorlit, bronze, red = map(rgb, cols)
    im=Image.new('RGB',(64,64),wall if kind in ('wall','door') else floor)
    d=ImageDraw.Draw(im)
    if kind == 'wall':
        d.rectangle((0,0,63,63), fill=wall)
        for row,y in enumerate(range(0,64,12)):
            off=0 if row%2==0 else -8
            for x in range(off,72,16):
                d.rectangle((x+1,y+1,x+14,y+10), fill=lit if (row+x//16)%3 else rgb('#746a5a'))
                d.rectangle((x+1,y+9,x+14,y+10), fill=wall)
                d.point((x+4+(row%3),y+4), fill=rgb('#c4ad85'))
        greek_band(d, 4, bronze, wall); greek_band(d, 56, bronze, wall)
        # chipped limestone and tiny red pigment traces
        for x,y in [(12,25),(44,18),(26,42),(56,32),(7,48)]: d.rectangle((x,y,x+2,y+1), fill=rgb('#c5b594'))
        for x,y in [(30,27),(32,28),(33,29)]: d.point((x,y), fill=red)
    elif kind in ('floor','ceiling'):
        base=floor if kind=='floor' else rgb('#19191a')
        d.rectangle((0,0,63,63), fill=base)
        for y in range(0,64,16):
            for x in range((y//16%2)*8,64,16):
                d.rectangle((x+1,y+1,x+14,y+14), fill=floorlit if kind=='floor' else rgb('#302d2b'))
                d.rectangle((x+1,y+13,x+14,y+14), fill=base)
                d.point((x+4,y+5), fill=rgb('#706657'))
        greek_band(d, 2, bronze, base)
        if kind=='floor':
            line(d,[(45,28),(42,31),(43,34),(39,38)],rgb('#272625'),1)
            d.rectangle((18,41,20,42),fill=red)
    elif kind == 'door':
        d.rectangle((0,0,63,63), fill=rgb('#382920'))
        d.rectangle((5,3,58,62), fill=rgb('#745334'))
        for x in [10,20,30,40,50]: d.rectangle((x,8,x+2,57),fill=rgb('#513820'))
        d.rectangle((4,7,59,12),fill=bronze); d.rectangle((4,53,59,57),fill=bronze)
        greek_band(d,15,bronze,rgb('#745334')); greek_band(d,40,bronze,rgb('#745334'))
        d.rectangle((29,28,34,35),fill=rgb('#d0aa61'))
    elif kind == 'exit':
        d.rectangle((0,0,63,63),fill=rgb('#181616'))
        d.rectangle((6,2,57,63),fill=rgb('#3a2925'))
        d.rectangle((13,10,50,62),fill=rgb('#561f20'))
        d.rectangle((18,16,45,62),fill=rgb('#b16a38'))
        d.rectangle((22,20,41,62),fill=rgb('#221b1a'))
        # bull horn silhouette in bronze on the lintel
        line(d,[(23,13),(18,8),(16,4),(21,7),(26,13)],bronze,2)
        line(d,[(41,13),(46,8),(48,4),(43,7),(38,13)],bronze,2)
        d.rectangle((27,10,36,16),fill=bronze); d.rectangle((30,8,33,19),fill=rgb('#d6a65d'))
        greek_band(d,28,bronze,rgb('#561f20'))
    return im

for theme,cols in THEMES.items():
    for kind in ['wall','floor','ceiling','door','exit']:
        texture(theme,kind,cols).save(ROOT/'tiles'/f'{theme}_{kind}.png', optimize=True)

# Draw a compact 64 px sprite with a distinctive role silhouette and stable palette.
ENEMIES = [
'cretan_cave_rat','arachne_brood','tomb_plunderer','bronze_revenant','labyrinth_raider','bull_cult_enforcer','chthonic_acolyte','stygian_ooze','cyclopean_brute','forge_wraith','restless_shade','bronze_automaton','empusa','gorgon_seer','cistern_nereid','chthonic_drake','cursed_champion','bronze_gateward','stygian_ooze_matriarch','vow_broken_champion','tomb_robber_archon','labyrinth_maw','chthonic_hierophant','serpent_gate_colossus','restless_king','cistern_titan','bronze_tyrant','basalt_lord',
'guardian_bronze_gatekeeper','guardian_serpent_priestess','guardian_cyclopean_mason','guardian_lamia_cistern','guardian_threadbound_warden']

def enemy_sprite(name):
    seed=int(hashlib.sha256(name.encode()).hexdigest()[:8],16)
    metal=['#bb8950','#9c6f46','#826d54','#c29a60'][seed%4]
    shadow='#241f20'; bone='#d2c4a3'; skin=['#9a8c6c','#77866b','#a66e62','#777985'][(seed >> 4) % 4]
    red='#842f31'; teal='#5d9283'; eye='#f2bf65'
    im=Image.new('RGBA',(64,64),(0,0,0,0)); d=ImageDraw.Draw(im)
    if 'rat' in name:
        d.ellipse((9,35,49,55),fill=skin); d.ellipse((37,32,57,48),fill=skin); d.ellipse((42,27,48,35),fill=red); d.ellipse((51,35,62,41),fill=bone)
        d.polygon([(39,34),(40,23),(46,32)],fill=skin); d.polygon([(47,34),(54,25),(54,37)],fill=skin); d.arc((0,39,19,62),180,310,fill=red,width=3)
        d.rectangle((45,37,47,39),fill=shadow); d.point((57,38),fill=red)
    elif 'spider' in name or 'brood' in name:
        d.ellipse((22,25,42,49),fill=shadow,outline=metal); d.ellipse((25,13,39,31),fill=skin,outline=metal)
        for y in [23,31,40]:
            d.line((24,y,10,y-8),fill=metal,width=3); d.line((40,y,54,y-8),fill=metal,width=3)
        d.point((29,20),fill=eye); d.point((35,20),fill=eye)
    elif 'ooze' in name or 'maw' in name:
        d.pieslice((7,22,57,61),180,360,fill=skin,outline=teal); d.rectangle((7,42,57,53),fill=skin); d.ellipse((12,35,55,58),fill=skin)
        for x,y in [(19,42),(30,38),(42,45),(25,51)]: d.rectangle((x,y,x+3,y+3),fill=teal)
        d.line((19,48,46,48),fill=shadow,width=2); d.point((26,45),fill=eye)
    elif 'shade' in name or 'wraith' in name or 'empusa' in name or 'nereid' in name:
        aura=teal if 'nereid' in name else red if 'wraith' in name else '#79649b'
        d.polygon([(30,7),(22,18),(18,31),(14,50),(25,45),(30,56),(38,45),(50,52),(46,28),(41,16)],fill=aura)
        d.ellipse((24,14,40,33),fill=bone if 'empusa' not in name else skin)
        d.rectangle((26,23,29,26),fill=eye); d.rectangle((35,23,38,26),fill=eye)
        d.polygon([(17,51),(23,44),(25,57),(29,48),(33,60),(38,48),(43,57),(49,51),(44,63),(20,63)],fill=aura)
    elif 'cyclopean' in name or 'titan' in name or 'mason' in name or 'brute' in name or 'colossus' in name:
        d.polygon([(18,19),(13,26),(12,55),(21,61),(45,61),(53,54),(50,25),(44,18)],fill=skin,outline=metal)
        d.rectangle((20,31,45,53),fill=rgb(metal)); d.rectangle((24,21,41,37),fill=skin)
        d.ellipse((28,26,37,35),fill=bone); d.ellipse((31,28,35,33),fill=red)
        d.rectangle((14,35,22,49),fill=metal); d.rectangle((43,35,51,49),fill=metal)
        d.rectangle((23,53,29,63),fill=shadow); d.rectangle((37,53,43,63),fill=shadow)
    elif 'gatekeeper' in name:
        d.polygon([(14,23),(19,10),(44,10),(50,24),(46,55),(55,61),(10,61),(18,53)],fill=metal,outline=bone)
        d.rectangle((21,20,43,37),fill=shadow); d.rectangle((27,26,37,29),fill=eye)
        d.rectangle((21,36,43,51),fill=rgb('#85553a')); d.rectangle((26,39,38,46),fill=metal)
        d.ellipse((4,29,27,55),fill=rgb('#a67343'),outline=bone,width=2); d.ellipse((11,36,21,47),fill=red,outline=metal)
        d.line((47,38,57,7),fill=metal,width=4); d.polygon([(53,11),(60,2),(60,16)],fill=bone)
        d.rectangle((22,51,29,63),fill=shadow); d.rectangle((38,51,45,63),fill=shadow)
    elif 'automaton' in name or 'gateward' in name or 'tyrant' in name:
        d.rectangle((19,18,45,49),fill=metal,outline=bone); d.polygon([(18,19),(22,8),(42,8),(47,19),(42,25),(22,25)],fill=metal,outline=bone)
        d.rectangle((26,14,38,19),fill=shadow); d.point((29,16),fill=eye); d.point((35,16),fill=eye)
        d.rectangle((23,30,41,46),fill=shadow); d.rectangle((27,33,37,43),fill=metal); d.line((32,34,32,42),fill=red,width=2)
        d.rectangle((10,28,21,48),fill=metal); d.rectangle((43,28,54,48),fill=metal)
        d.rectangle((23,49,29,63),fill=shadow); d.rectangle((36,49,42,63),fill=shadow)
    elif 'plunderer' in name or 'raider' in name or 'archon' in name:
        d.polygon([(21,18),(27,8),(42,11),(47,22),(42,39),(25,38)],fill=rgb('#7a5b44'),outline=bone)
        d.rectangle((24,24,40,28),fill=shadow); d.point((29,25),fill=eye)
        d.polygon([(19,33),(44,31),(47,52),(41,58),(22,53)],fill=skin,outline=shadow)
        d.line((42,37,55,17),fill=metal,width=3); d.polygon([(53,18),(59,7),(60,23)],fill=bone)
        d.rectangle((23,52,29,63),fill=shadow); d.rectangle((38,52,44,63),fill=shadow)
    elif 'bull_cult' in name:
        d.polygon([(19,19),(23,8),(41,8),(46,21),(43,50),(50,61),(14,61),(22,50)],fill=skin,outline=bone)
        d.polygon([(23,17),(10,5),(27,11),(32,18),(37,11),(54,5),(42,18)],fill=metal,outline=metal)
        d.rectangle((25,23,40,29),fill=shadow); d.point((29,25),fill=red); d.point((36,25),fill=red)
        d.rectangle((21,33,43,50),fill=red); d.rectangle((27,37,38,45),fill=metal)
        d.line((44,40,56,14),fill=metal,width=5); d.polygon([(53,17),(61,4),(61,22)],fill=bone)
    elif 'guardian_serpent' in name or 'lamia' in name or 'gorgon' in name or 'serpent' in name:
        d.polygon([(22,31),(18,15),(25,6),(39,7),(46,17),(40,31),(44,47),(50,57),(18,57),(24,48)],fill=skin,outline=metal)
        d.polygon([(22,19),(12,11),(14,5),(25,14),(32,10),(39,13),(50,5),(53,12),(41,22)],fill=teal if 'serpent' in name or 'lamia' in name else metal)
        d.rectangle((24,23,40,36),fill=bone); d.point((28,27),fill=red); d.point((36,27),fill=red)
        d.line((22,42,40,42,49,48),fill=teal,width=4); d.line((41,47,50,42),fill=teal,width=3)
    elif 'threadbound' in name or 'hierophant' in name or 'priest' in name or 'acolyte' in name:
        d.polygon([(17,22),(24,10),(40,10),(48,22),(45,56),(53,63),(10,63),(19,54)],fill=red,outline=metal)
        d.ellipse((24,13,40,31),fill=bone); d.rectangle((28,23,36,28),fill=shadow)
        d.line((18,25,48,49),fill=metal,width=2); d.line((46,24,17,49),fill=metal,width=2)
        d.rectangle((29,32,35,54),fill=metal); d.point((32,39),fill=eye)
    else:
        # Bronze-linen humanoid: helmet, cuirass, shield and a hand-held weapon vary by stable ID.
        d.rectangle((20,19,44,49),fill=skin,outline=shadow); d.polygon([(18,20),(20,9),(43,9),(47,21),(41,25),(23,25)],fill=metal,outline=bone)
        d.rectangle((22,31,42,45),fill=metal); d.rectangle((26,34,38,39),fill=bone); d.line((31,35,31,42),fill=red,width=2)
        d.rectangle((14,30,23,44),fill=red if 'champion' in name else metal,outline=bone)
        d.line((45,33,53,12),fill=metal,width=3); d.polygon([(50,13),(55,3),(59,14)],fill=bone)
        d.rectangle((23,47,29,62),fill=shadow); d.rectangle((36,47,42,62),fill=shadow)
    # universal pixel highlights and a dark contour foot shadow
    d.ellipse((13,59,51,63),fill=(20,18,17,145))
    im.save(ROOT/'enemies'/f'{name}.png', optimize=True)

for name in ENEMIES: enemy_sprite(name)

# Ancient objects use their own hand-built silhouettes, with unfiltered pixel edges.
def prop(name):
    im=Image.new('RGBA',(64,64),(0,0,0,0)); d=ImageDraw.Draw(im)
    bronze=rgb('#b58850'); light=rgb('#d2b178'); clay=rgb('#a3543d'); dark=rgb('#342a27'); cream=rgb('#d0c09d'); green=rgb('#56766a')
    if name in ('amphora','broken_amphora'):
        d.ellipse((20,4,43,16),fill=bronze,outline=dark); d.rectangle((26,9,37,19),fill=clay)
        d.polygon([(25,17),(17,26),(15,48),(23,59),(41,59),(49,48),(47,26),(39,17)],fill=clay,outline=dark)
        d.rectangle((22,28,42,31),fill=bronze); d.line((21,24,12,28,13,39,17,41),fill=bronze,width=3); d.line((43,24,52,28,51,39,47,41),fill=bronze,width=3)
        d.rectangle((25,37,39,39),fill=light)
        if name=='broken_amphora': d.polygon([(15,46),(28,43),(27,52),(20,58)],fill=dark); d.line((25,41,34,47,31,56),fill=dark,width=2)
    elif name=='labyrinth_tablet':
        d.polygon([(13,7),(49,10),(52,57),(11,54)],fill=cream,outline=dark); greek_band(d,17,bronze,cream); greek_band(d,42,bronze,cream)
        d.rectangle((23,25,41,37),outline=red if False else clay,width=2); d.line((24,27,38,27,38,34,28,34,28,30,34,30),fill=clay,width=2)
    elif name=='offering_altar':
        d.rectangle((12,19,52,32),fill=cream,outline=dark); d.rectangle((17,32,47,55),fill=bronze,outline=dark); d.rectangle((9,54,55,60),fill=cream,outline=dark)
        d.rectangle((27,22,37,28),fill=clay); d.point((31,18),fill=light)
    elif name=='chthonic_altar':
        d.rectangle((10,17,54,31),fill=rgb('#49363a'),outline=dark,width=2)
        d.rectangle((16,31,48,53),fill=rgb('#30292b'),outline=bronze,width=2)
        d.rectangle((7,53,57,61),fill=rgb('#75604c'),outline=dark,width=2)
        d.polygon([(23,22),(28,18),(36,18),(41,22),(36,28),(28,28)],fill=rgb('#7c2e34'),outline=dark)
        d.rectangle((30,19,34,27),fill=light); d.point((32,16),fill=rgb('#e7794f'))
        greek_band(d,37,bronze,rgb('#30292b'))
    elif name=='column_fragment':
        d.rectangle((16,8,48,15),fill=cream,outline=dark); d.polygon([(20,15),(44,15),(40,49),(24,49)],fill=cream,outline=dark); d.rectangle((12,49,52,57),fill=bronze,outline=dark)
        for x in [25,31,37]: d.line((x,20,x-2,44),fill=rgb('#a99b7c'),width=2)
    elif name=='oil_bowl':
        d.ellipse((17,36,47,48),fill=bronze,outline=dark); d.polygon([(20,42),(26,54),(38,54),(44,42)],fill=bronze,outline=dark); d.rectangle((28,20,36,40),fill=light); d.polygon([(32,5),(25,22),(31,19),(35,26),(39,16)],fill=rgb('#e57e3e'))
    elif name=='wall_torch':
        d.ellipse((20,16,44,43),fill=rgb('#544333'),outline=dark,width=2)
        d.rectangle((27,35,37,51),fill=bronze,outline=dark)
        d.rectangle((22,48,42,55),fill=rgb('#725037'),outline=dark)
        d.rectangle((25,11,39,18),fill=light,outline=dark)
        d.polygon([(32,1),(25,15),(30,13),(27,23),(32,20),(36,26),(41,16),(36,17)],fill=rgb('#e46f35'),outline=rgb('#702d27'))
        d.polygon([(32,7),(29,17),(33,15),(34,21),(38,15)],fill=rgb('#f1cb72'))
        d.point((32,25),fill=rgb('#ffed9a'))
    elif name=='fresco_panel':
        d.rectangle((5,5,59,59),fill=rgb('#59483b'),outline=dark,width=3)
        d.rectangle((9,9,55,55),fill=rgb('#c0a777'),outline=bronze,width=2)
        d.rectangle((13,13,51,51),fill=rgb('#603c32'))
        greek_band(d,16,light,rgb('#603c32')); greek_band(d,43,bronze,rgb('#603c32'))
        d.polygon([(20,34),(23,25),(31,21),(40,24),(46,32),(42,40),(35,43),(24,41)],fill=rgb('#b5834e'),outline=dark)
        d.polygon([(22,27),(17,20),(27,24),(33,21),(40,24),(48,18),(44,28)],fill=cream,outline=dark)
        d.rectangle((27,31,30,34),fill=dark); d.rectangle((38,31,41,34),fill=dark)
    elif name=='bull_relief':
        d.rectangle((5,7,59,57),fill=rgb('#54483d'),outline=bronze,width=3)
        d.ellipse((18,21,47,48),fill=bronze,outline=dark); d.polygon([(20,26),(11,13),(27,21)],fill=bronze); d.polygon([(43,26),(54,13),(37,21)],fill=bronze)
        d.rectangle((24,29,42,39),fill=dark); d.rectangle((27,31,30,34),fill=light); d.rectangle((36,31,39,34),fill=light)
        line(d,[(21,39),(16,47),(23,45),(26,40)],cream,2); line(d,[(42,39),(49,47),(42,45),(38,40)],cream,2)
    elif name=='cistern_mirror':
        d.ellipse((8,4,56,59),fill=bronze,outline=dark,width=3); d.ellipse((14,10,50,53),fill=green,outline=light,width=2); d.line((19,37,44,20),fill=rgb('#bad0bd'),width=3); d.rectangle((27,59,37,63),fill=bronze)
    im.save(ROOT/'props'/f'{name}.png', optimize=True)
for n in ['amphora','broken_amphora','labyrinth_tablet','offering_altar','chthonic_altar','column_fragment','oil_bowl','wall_torch','fresco_panel','bull_relief','cistern_mirror']: prop(n)

# First-person pixel hands and weapon silhouettes.
def hand(name):
    im=Image.new('RGBA',(96,96),(0,0,0,0)); d=ImageDraw.Draw(im)
    skin=rgb('#be8b67'); sleeve=rgb('#6c4331'); dark=rgb('#2b2421'); bronze=rgb('#bc9054'); silver=rgb('#c4c0a8')
    d.polygon([(51,66),(71,54),(95,62),(95,95),(43,95)],fill=sleeve,outline=dark)
    d.polygon([(42,62),(53,53),(72,57),(75,73),(61,83),(40,78)],fill=skin,outline=dark)
    for x in [47,54,61]: d.line((x,62,x+5,69),fill=rgb('#d9ac83'),width=2)
    if name=='empty':
        d.polygon([(24,54),(38,47),(47,54),(42,69),(31,72)],fill=skin,outline=dark)
    elif name in ('xiphos','kopis','dory','labrys','ritual_staff','hunting_bow'):
        if name=='dory':
            d.line((57,72,79,7),fill=rgb('#71502f'),width=5); d.polygon([(77,16),(83,2),(84,18)],fill=silver,outline=dark); d.line((55,74,64,47),fill=bronze,width=2)
        elif name=='ritual_staff':
            d.line((56,75,69,10),fill=rgb('#65432b'),width=6); d.ellipse((63,4,78,19),fill=bronze,outline=dark); d.ellipse((67,7,74,15),fill=rgb('#e3b75c'))
        elif name=='labrys':
            d.line((55,73,68,26),fill=rgb('#65432b'),width=5); d.polygon([(62,29),(48,23),(49,9),(65,16),(71,8),(83,15),(78,31)],fill=silver,outline=dark); d.line((65,20,77,20),fill=bronze,width=2)
        elif name=='hunting_bow':
            d.arc((43,4,82,75),250,110,fill=rgb('#a9743a'),width=5); d.line((57,11,57,67),fill=rgb('#e5d5b2'),width=1); d.line((48,41,78,41),fill=silver,width=2); d.polygon([(78,41),(72,37),(72,45)],fill=silver)
        else:
            d.line((55,73,68,29),fill=rgb('#71502f'),width=6); d.polygon([(67,35),(70,6),(77,5),(75,34),(81,39),(68,43)],fill=silver,outline=dark)
            if name=='kopis': d.polygon([(70,8),(81,4),(80,28),(76,35),(74,18)],fill=rgb('#ddd5bd'),outline=dark)
            d.line((60,57,74,61),fill=bronze,width=4)
    im.save(ROOT/'hands'/f'{name}.png', optimize=True)
for n in ['empty','xiphos','kopis','labrys','ritual_staff','hunting_bow','dory']: hand(n)
# Off-hand views use separately authored left-arm silhouettes. The hand is not mirrored from a right-hand sprite.
def offhand(name):
    im=Image.new('RGBA',(96,96),(0,0,0,0)); d=ImageDraw.Draw(im)
    skin=rgb('#be8b67'); sleeve=rgb('#6c4331'); dark=rgb('#2b2421'); bronze=rgb('#bc9054'); silver=rgb('#c4c0a8'); linen=rgb('#d4c4a0')
    d.polygon([(0,60),(18,51),(35,55),(48,69),(42,87),(31,96),(0,96)],fill=sleeve,outline=dark)
    d.polygon([(16,62),(25,51),(39,53),(49,62),(47,74),(36,81),(20,75)],fill=skin,outline=dark)
    d.polygon([(31,60),(39,52),(48,54),(52,61),(47,67),(38,66)],fill=skin,outline=dark)
    for x in [34,39,44]: d.line((x,57,x+4,63),fill=rgb('#d9ac83'),width=2)
    if name in ('xiphos','kopis','dory'):
        d.line((39,66,19,15),fill=rgb('#71502f'),width=6)
        d.line((37,66,18,18),fill=bronze,width=2)
        if name=='dory':
            d.polygon([(15,19),(11,4),(21,14),(22,27)],fill=silver,outline=dark)
            d.line((25,31,40,26),fill=bronze,width=3)
        else:
            d.polygon([(18,29),(5,12),(13,8),(25,26),(29,32)],fill=silver,outline=dark)
            d.line((11,24,28,18),fill=bronze,width=4)
            if name=='kopis': d.polygon([(13,20),(2,6),(12,9),(21,25),(23,33)],fill=rgb('#ddd5bd'),outline=dark)
    elif name=='shield':
        d.polygon([(15,17),(29,11),(50,18),(57,37),(52,59),(36,70),(20,60),(13,40)],fill=rgb('#8b633a'),outline=dark)
        d.polygon([(20,21),(30,17),(45,23),(50,38),(46,54),(36,62),(24,54),(19,39)],fill=rgb('#bc9152'),outline=rgb('#d0b577'))
        d.ellipse((30,31,43,45),fill=rgb('#563b2c'),outline=rgb('#e1c17a'),width=2)
        d.line((35,22,37,56),fill=rgb('#95613b'),width=2); d.line((23,38,49,38),fill=rgb('#95613b'),width=2)
    elif name=='focus':
        d.line((42,64,52,43),fill=rgb('#71502f'),width=5)
        d.ellipse((35,25,63,53),fill=bronze,outline=dark,width=3)
        d.ellipse((41,31,57,47),fill=rgb('#e5bd69'),outline=linen,width=2)
        d.polygon([(49,34),(53,41),(49,46),(45,41)],fill=rgb('#fff0bb'))
        d.line((32,54,48,60),fill=linen,width=2)
    elif name=='bow_draw':
        d.line((31,16,46,63),fill=linen,width=2)
        d.polygon([(38,42),(46,34),(57,36),(63,43),(57,51),(47,52),(42,48)],fill=skin,outline=dark)
        d.line((48,42,73,42),fill=silver,width=2); d.polygon([(74,42),(67,38),(67,46)],fill=silver)
        d.line((50,40,56,46),fill=rgb('#d9ac83'),width=2)
    elif name=='two_hand_grip':
        d.polygon([(15,57),(27,48),(42,51),(48,62),(41,72),(25,72)],fill=skin,outline=dark)
        d.line((36,65,49,23),fill=rgb('#71502f'),width=7)
        for y in [55,60,65]: d.line((29,y,43,y+3),fill=rgb('#d9ac83'),width=2)
        d.line((38,65,50,63),fill=bronze,width=3)
    im.save(ROOT/'hands'/f'offhand_{name}.png', optimize=True)
for n in ['empty','xiphos','kopis','dory','shield','focus','two_hand_grip','bow_draw']: offhand(n)
# Shield cutout is also used as a world/hand prop.
im=Image.new('RGBA',(64,64),(0,0,0,0)); d=ImageDraw.Draw(im); d.ellipse((5,4,59,60),fill=rgb('#8b633a'),outline=rgb('#28221d'),width=3); d.ellipse((10,9,54,55),fill=rgb('#bc9152'),outline=rgb('#d0b577'),width=2); d.ellipse((23,22,41,40),fill=rgb('#563b2c'),outline=rgb('#e1c17a'),width=2); d.line((32,10,32,54),fill=rgb('#95613b'),width=2); d.line((12,32,52,32),fill=rgb('#95613b'),width=2); im.save(ROOT/'hands/aspis.png',optimize=True)

# Impact glyphs are static transparent pixel sheets used by VFX and loot.
def vfx(name):
    im=Image.new('RGBA',(32,32),(0,0,0,0)); d=ImageDraw.Draw(im)
    palettes={'bronze_impact':('#e4c16e','#a66c36'),'laurel_light':('#b7c985','#647e55'),'promethean_flame':('#f49a48','#b53e30'),'soul_ash':('#aa88c7','#4e436d'),'cistern_splash':('#9bc9bf','#497e82'),'oracle_spark':('#d6c48b','#9380bd'),'serpent_venom':('#b5c35b','#4f7548')}
    a,b=map(rgb,palettes[name]);
    if name=='bronze_impact':
        d.polygon([(16,1),(19,11),(29,5),(22,15),(31,17),(21,20),(27,29),(17,23),(12,31),(13,21),(2,24),(10,17),(2,10),(14,13)],fill=a); d.rectangle((14,13,18,19),fill=b)
    elif name=='laurel_light':
        d.arc((4,4,28,29),205,340,fill=a,width=3); d.arc((3,5,29,28),20,155,fill=a,width=3)
        for x,y in [(7,19),(9,13),(13,8),(21,8),(25,13),(26,19)]: d.ellipse((x,y,x+4,y+3),fill=b)
    elif name=='promethean_flame':
        d.polygon([(16,1),(22,11),(27,8),(25,18),(30,22),(22,29),(9,28),(3,21),(10,15),(9,9),(14,14)],fill=b); d.polygon([(16,8),(20,17),(17,15),(23,22),(15,27),(10,21)],fill=a)
    elif name=='soul_ash':
        d.ellipse((8,8,23,23),outline=a,width=3); d.arc((2,2,30,30),200,340,fill=b,width=2); d.rectangle((14,4,18,9),fill=a); d.rectangle((8,26,11,30),fill=b); d.rectangle((23,21,27,26),fill=a)
    elif name=='cistern_splash':
        d.polygon([(16,1),(20,13),(28,7),(22,18),(30,18),(20,22),(22,30),(16,24),(11,30),(12,22),(2,18),(12,17),(6,9)],fill=b); d.rectangle((14,10,18,19),fill=a)
    elif name=='oracle_spark':
        d.line((3,25,12,16,9,12,20,5,17,14,28,9,21,19,28,23,14,25),fill=a,width=3); d.rectangle((13,14,18,19),fill=b)
    else:
        d.ellipse((5,4,27,27),outline=b,width=3); d.polygon([(14,7),(19,15),(16,16),(19,24),(12,17),(15,16)],fill=a); d.rectangle((2,14,7,18),fill=b); d.rectangle((25,14,30,18),fill=b)
    im.save(ROOT/'vfx'/f'{name}.png',optimize=True)
for n in ['bronze_impact','laurel_light','promethean_flame','soul_ash','cistern_splash','oracle_spark','serpent_venom']: vfx(n)
generate_character_rig_assets(ROOT)
generate_mythic_vfx_atlas(Path(__file__).resolve().parents[1])
print('Generated static Maze of the Minotaur pixel art:', sum(1 for p in ROOT.rglob('*.png')), 'PNG files at', ROOT)
