#!/usr/bin/env python3
"""Generate static, locally-authored pixel art for Maze of the Minotaur. No network or runtime AI."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
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

def palace_texture(kind):
    """Knossian limestone, painted plaster, and restrained bronze inlay for floors 1–5."""
    stone = rgb('#786a56')
    pale = rgb('#c2aa7b')
    light = rgb('#dfc58c')
    shadow = rgb('#403a32')
    bronze = rgb('#bd8c4b')
    red = rgb('#8e3931')
    teal = rgb('#54746c')
    ink = rgb('#272522')
    if kind == 'wall':
        im = Image.new('RGB', (64, 64), stone); d = ImageDraw.Draw(im)
        for row, y in enumerate(range(0, 64, 16)):
            offset = 0 if row % 2 == 0 else -16
            for x in range(offset, 80, 32):
                d.rectangle((x + 1, y + 1, x + 30, y + 14), fill=pale if (row + x // 32) % 3 else (164, 139, 101))
                line(d, [(x + 2, y + 13), (x + 29, y + 13)], shadow, 1)
                line(d, [(x + 4, y + 3), (x + 18, y + 3)], light, 1)
                d.point((x + 26, y + 6), fill=(194, 172, 131))
        # A painted, repeating bull-wave frieze uses the Palace palette without turning the wall into a flat checker.
        d.rectangle((0, 3, 63, 7), fill=red)
        d.rectangle((0, 8, 63, 9), fill=bronze)
        for x in range(4, 64, 16):
            line(d, [(x, 7), (x + 3, 4), (x + 7, 7), (x + 11, 4), (x + 14, 7)], pale, 1)
        greek_band(d, 56, bronze, shadow)
        for x, y in [(7, 22), (24, 38), (51, 25), (40, 48)]:
            d.rectangle((x, y, x + 2, y + 1), fill=red)
            d.point((x + 1, y + 3), fill=teal)
        return im
    if kind == 'floor':
        im = Image.new('RGB', (64, 64), rgb('#353129')); d = ImageDraw.Draw(im)
        for y in range(0, 64, 16):
            for x in range(0, 64, 16):
                shade = rgb('#9a8769') if (x // 16 + y // 16) % 3 else rgb('#8c795e')
                d.rectangle((x + 1, y + 1, x + 14, y + 14), fill=shade)
                line(d, [(x + 2, y + 13), (x + 13, y + 13)], rgb('#625846'), 1)
                d.point((x + 4, y + 4), fill=rgb('#c3ad85'))
        # Small inset bronze squares and a broken running wave keep the repeated floor readable in motion.
        for x, y in [(6, 6), (38, 22), (22, 38), (54, 54)]:
            d.rectangle((x, y, x + 3, y + 3), fill=bronze)
            d.point((x + 1, y + 1), fill=light)
        line(d, [(17, 30), (20, 27), (24, 28), (27, 25)], shadow, 1)
        line(d, [(45, 44), (48, 41), (52, 42)], teal, 1)
        return im
    if kind == 'ceiling':
        im = Image.new('RGB', (64, 64), rgb('#282725')); d = ImageDraw.Draw(im)
        for y in range(0, 64, 16):
            d.rectangle((0, y + 1, 63, y + 13), fill=rgb('#423a32'))
            line(d, [(0, y + 13), (63, y + 13)], ink, 2)
            for x in range(6, 64, 16):
                d.rectangle((x, y + 3, x + 7, y + 9), fill=rgb('#64513b'))
                d.point((x + 2, y + 4), fill=bronze)
        greek_band(d, 0, rgb('#84663f'), ink)
        return im
    if kind == 'door':
        im = Image.new('RGB', (64, 64), rgb('#31251f')); d = ImageDraw.Draw(im)
        d.rectangle((4, 2, 59, 63), fill=rgb('#704a30'))
        d.rectangle((8, 5, 55, 60), fill=rgb('#493326'))
        for x in (11, 21, 31, 41, 51):
            d.rectangle((x, 10, x + 3, 54), fill=rgb('#765536'))
            line(d, [(x + 1, 12), (x + 1, 51)], rgb('#a17947'), 1)
        d.rectangle((5, 7, 58, 11), fill=bronze)
        d.rectangle((5, 52, 58, 56), fill=bronze)
        greek_band(d, 17, pale, rgb('#493326'))
        greek_band(d, 39, bronze, rgb('#493326'))
        # Labrys mark inset into the lintel.
        d.rectangle((28, 24, 35, 39), fill=ink)
        d.polygon([(31, 26), (26, 23), (26, 30), (30, 32), (26, 35), (27, 39), (32, 36), (37, 39), (38, 35), (34, 32), (38, 29), (37, 24), (33, 27)], fill=light)
        return im
    im = Image.new('RGB', (64, 64), ink); d = ImageDraw.Draw(im)
    d.rectangle((5, 1, 58, 63), fill=rgb('#4b3025'))
    d.rectangle((12, 7, 51, 63), fill=red)
    d.rectangle((17, 13, 46, 63), fill=rgb('#be7137'))
    d.rectangle((21, 18, 42, 63), fill=rgb('#241c1a'))
    line(d, [(18, 12), (11, 5), (9, 1), (15, 5), (21, 13)], bronze, 2)
    line(d, [(46, 12), (53, 5), (55, 1), (49, 5), (43, 13)], bronze, 2)
    d.rectangle((28, 10, 35, 16), fill=bronze)
    d.rectangle((30, 8, 33, 19), fill=light)
    greek_band(d, 29, bronze, red)
    return im

def texture(theme, kind, cols):
    if theme == 'palace_foundations':
        return palace_texture(kind)
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
        d.rk,width=3)
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
    # Separate leather cuff and gold meander keep the left arm distinct from the weapon sprite.
    d.polygon([(7,69),(18,62),(29,65),(31,77),(20,84),(7,80)],fill=rgb('#9b7040'),outline=dark)
    line(d,[(9,72),(19,67),(28,70)],rgb('#e1bd72'),1)
    greek_band(d,87,rgb('#d0a55f'),sleeve)
    if name=='shield':
        d.ellipse((29,30,43,44),outline=rgb('#f0d487'),width=1)
        line(d,[(33,14),(36,19),(39,14)],rgb('#f0d487'),1)
    elif name in ('xiphos','kopis'):
        line(d,[(18,14),(24,30),(29,42)],rgb('#f0e5c7'),1)
    elif name=='dory':
        line(d,[(15,10),(18,5),(20,14)],rgb('#fff0cc'),1)
    elif name=='focus':
        d.point((49,39),fill=(255,255,240,255))
    elif name=='bow_draw':
        line(d,[(31,18),(38,36)],rgb('#f0e5c7'),1)
    elif name=='two_hand_grip':
        line(d,[(47,25),(51,17)],rgb('#fff0cc'),1)
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
def production_contact_sheet():
    repo_root = Path(__file__).resolve().parents[1]
    output = Image.new('RGB', (1140, 590), rgb('#211f1f'))
    draw = ImageDraw.Draw(output)
    font = ImageFont.load_default()
    draw.text((18, 14), 'R6E · Palace Foundations visual production pilot', font=font, fill=rgb('#e2c27f'))

    def row_cards(title, y, entries, card_width, card_height, art_box):
        draw.text((18, y), title, font=font, fill=rgb('#c9bda4'))
        start_x = 18
        card_y = y + 16
        for index, (label, relative_paths) in enumerate(entries):
            x = start_x + index * (card_width + 8)
            draw.rectangle((x, card_y, x + card_width, card_y + card_height), fill=rgb('#302c2a'), outline=rgb('#756447'))
            paths = relative_paths if isinstance(relative_paths, tuple) else (relative_paths,)
            box_x, box_y, box_w, box_h = art_box
            for slot, relative in enumerate(paths):
                source = Image.open(repo_root / relative).convert('RGBA')
                ratio = min(box_w / source.width, box_h / source.height)
                size = (max(1, round(source.width * ratio)), max(1, round(source.height * ratio)))
                source = source.resize(size, Image.Resampling.NEAREST)
                if len(paths) == 1:
                    target_x = x + box_x + (box_w - size[0]) // 2
                else:
                    slot_w = box_w // len(paths)
                    target_x = x + box_x + slot * slot_w + (slot_w - size[0]) // 2
                target_y = card_y + box_y + (box_h - size[1]) // 2
                output.paste(source, (target_x, target_y), source)
            draw.text((x + 6, card_y + card_height - 13), label, font=font, fill=rgb('#e1d6bf'))

    surfaces = [(kind.title(), f'public/assets/maze/tiles/palace_foundations_{kind}.png') for kind in ('wall', 'floor', 'ceiling', 'door', 'exit')]
    row_cards('MATERIALS · Palace Foundations, floors 1–5', 42, surfaces, 204, 118, (8, 4, 188, 92))
    landmarks = [
        ('Fresco Gallery', 'public/assets/maze/props/fresco_panel.png'),
        ('Pillared Hall', 'public/assets/maze/props/column_fragment.png'),
        ('Guardian Arena', 'public/assets/maze/props/bull_relief.png'),
        ('Wall Torch', 'public/assets/maze/props/wall_torch.png'),
        ('Votive Altar', 'public/assets/maze/props/chthonic_altar.png'),
    ]
    row_cards('ROOM ARCHITECTURE · entry/gallery, pillared hall, Guardian arena', 190, landmarks, 204, 118, (8, 4, 188, 92))
    equipment = [
        ('Xiphos + Aspis', ('public/assets/maze/hands/xiphos.png', 'public/assets/maze/hands/offhand_shield.png')),
        ('Dory + Grip', ('public/assets/maze/hands/dory.png', 'public/assets/maze/hands/offhand_two_hand_grip.png')),
        ('Labrys', 'public/assets/maze/hands/labrys.png'),
        ('Kopis', 'public/assets/maze/hands/kopis.png'),
        ('Bow + Draw', ('public/assets/maze/hands/hunting_bow.png', 'public/assets/maze/hands/offhand_bow_draw.png')),
        ('Staff + Focus', ('public/assets/maze/hands/ritual_staff.png', 'public/assets/maze/hands/offhand_focus.png')),
    ]
    row_cards('EQUIPMENT · two-hand set pairings and supported pilot silhouettes', 338, equipment, 176, 118, (4, 2, 168, 92))
    output.save(repo_root / 'docs/previews/R6E_WORLD_EQUIPMENT_SHEET.png', optimize=True)

production_contact_sheet()
print('Generated static Maze of the Minotaur pixel art:', sum(1 for p in ROOT.rglob('*.png')), 'PNG files at', ROOT)
