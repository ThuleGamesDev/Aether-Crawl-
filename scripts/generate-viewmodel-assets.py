#!/usr/bin/env python3
"""Generate crisp, locally-authored first-person equipment sprites."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1] / 'public/assets/maze/hands'
INK = '#20191a'
METAL = '#c9c7b9'
METAL_LIGHT = '#f4ead0'
METAL_DARK = '#777b79'
BRONZE = '#bd8747'
BRONZE_LIGHT = '#edc776'
WOOD = '#76502f'
WOOD_LIGHT = '#aa7d4a'
SKIN = '#cf936f'
SKIN_LIGHT = '#f0bf98'
SKIN_DARK = '#8c5745'
SLEEVE = '#653a32'
SLEEVE_LIGHT = '#9a5440'
LEATHER = '#493027'
CANVAS = (128, 160)


def polygon(draw, points, fill, outline: str | None = INK, width=3):
    draw.polygon(points, fill=fill)
    if outline:
        draw.line(points + [points[0]], fill=outline, width=width, joint='curve')


def line(draw, points, fill, width=2):
    draw.line(points, fill=fill, width=width, joint='curve')


def main_arm(draw):
    polygon(draw, [(83, 113), (101, 102), (125, 111), (127, 159), (64, 159), (61, 141), (68, 126)], SLEEVE, width=4)
    polygon(draw, [(91, 116), (108, 108), (124, 116), (126, 154), (91, 153), (75, 137)], SLEEVE_LIGHT, width=2)
    line(draw, [(78, 139), (93, 145), (124, 143)], BRONZE, 4)
    line(draw, [(82, 145), (96, 151), (124, 149)], BRONZE_LIGHT, 2)
    polygon(draw, [(73, 111), (87, 105), (103, 115), (106, 128), (93, 137), (76, 129), (68, 120)], SKIN, width=3)
    polygon(draw, [(76, 115), (87, 111), (98, 118), (98, 125), (87, 130), (77, 125)], SKIN_LIGHT, outline=None)
    line(draw, [(81, 128), (93, 133), (101, 128)], SKIN_DARK, 2)


def hand_grip(draw, center=(79, 101)):
    x, y = center
    polygon(draw, [(x - 12, y - 12), (x - 4, y - 20), (x + 8, y - 18), (x + 17, y - 9),
                   (x + 14, y + 7), (x + 6, y + 17), (x - 7, y + 13), (x - 14, y + 4)], SKIN, width=3)
    polygon(draw, [(x - 4, y - 13), (x + 8, y - 12), (x + 14, y - 6), (x + 10, y + 1),
                   (x + 2, y + 3), (x - 4, y - 4)], SKIN_LIGHT, outline=None)
    line(draw, [(x - 10, y - 2), (x + 1, y + 3), (x + 11, y + 1)], SKIN_DARK, 3)
    line(draw, [(x - 6, y + 6), (x + 5, y + 10)], '#a86c52', 2)


def hilt(draw, center=(79, 101)):
    x, y = center
    line(draw, [(x + 1, y + 15), (x + 8, y + 28)], WOOD, 9)
    line(draw, [(x + 1, y + 15), (x + 8, y + 28)], WOOD_LIGHT, 2)
    line(draw, [(x - 12, y + 11), (x + 14, y + 3)], BRONZE, 6)
    line(draw, [(x - 12, y + 10), (x + 14, y + 2)], BRONZE_LIGHT, 2)
    polygon(draw, [(x - 15, y + 9), (x - 12, y + 4), (x - 6, y + 7), (x - 8, y + 14)], BRONZE, width=2)
    polygon(draw, [(x + 11, y + 2), (x + 16, y - 3), (x + 21, y + 1), (x + 16, y + 7)], BRONZE, width=2)


def sword_blade(draw, curved=False):
    if curved:
        polygon(draw, [(85, 91), (68, 65), (53, 37), (35, 15), (46, 17), (65, 35), (80, 61), (97, 89)], METAL, width=3)
        line(draw, [(82, 81), (63, 51), (43, 22)], METAL_LIGHT, 3)
        line(draw, [(74, 67), (83, 63), (91, 72)], METAL_DARK, 2)
    else:
        polygon(draw, [(85, 91), (38, 17), (49, 13), (98, 87)], METAL, width=3)
        polygon(draw, [(84, 82), (44, 20), (49, 17), (94, 84)], METAL_LIGHT, outline=None)
        line(draw, [(92, 86), (54, 27)], METAL_DARK, 2)


def spear(draw):
    line(draw, [(60, 144), (91, 27)], WOOD, 11)
    line(draw, [(60, 144), (91, 27)], WOOD_LIGHT, 3)
    line(draw, [(65, 128), (68, 117)], '#d1a86c', 2)
    line(draw, [(84, 49), (87, 38)], '#d1a86c', 2)
    polygon(draw, [(84, 40), (91, 7), (108, 31), (96, 47)], METAL_DARK, width=3)
    polygon(draw, [(89, 35), (93, 13), (103, 31), (96, 39)], METAL_LIGHT, outline=None)
    line(draw, [(83, 40), (98, 45)], BRONZE, 5)
    line(draw, [(78, 57), (89, 60)], WOOD, 3)


def draw_main_weapon(name):
    image = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    main_arm(draw)
    if name == 'dory':
        spear(draw)
        hand_grip(draw, (76, 102))
    elif name in ('xiphos', 'empty'):
        if name == 'xiphos':
            sword_blade(draw)
            hilt(draw)
            hand_grip(draw, (80, 100))
        else:
            polygon(draw, [(64, 94), (72, 83), (87, 82), (99, 89), (101, 103), (92, 115), (77, 113), (68, 105)], SKIN, width=3)
            line(draw, [(75, 93), (91, 97), (99, 95)], SKIN_LIGHT, 3)
    elif name == 'kopis':
        sword_blade(draw, curved=True)
        hilt(draw)
        hand_grip(draw, (80, 100))
    elif name == 'labrys':
        line(draw, [(62, 141), (88, 49)], WOOD, 10)
        line(draw, [(62, 141), (88, 49)], WOOD_LIGHT, 3)
        polygon(draw, [(79, 58), (55, 43), (50, 25), (62, 18), (82, 32), (91, 27), (108, 17), (116, 27), (111, 45), (94, 60)], METAL_DARK, width=3)
        polygon(draw, [(61, 27), (81, 38), (83, 48), (61, 39)], METAL_LIGHT, outline=None)
        polygon(draw, [(92, 43), (109, 27), (105, 43), (94, 53)], METAL, outline=None)
        line(draw, [(80, 48), (94, 45)], BRONZE_LIGHT, 4)
        hand_grip(draw, (76, 102))
    elif name == 'ritual_staff':
        line(draw, [(65, 141), (87, 38)], WOOD, 10)
        line(draw, [(65, 141), (87, 38)], WOOD_LIGHT, 3)
        line(draw, [(70, 117), (73, 102)], BRONZE, 4)
        polygon(draw, [(78, 34), (85, 19), (98, 17), (108, 28), (101, 42), (86, 45)], '#4d7268', width=3)
        polygon(draw, [(86, 27), (96, 23), (101, 29), (95, 36), (87, 34)], '#b9ded0', outline=None)
        polygon(draw, [(91, 26), (96, 19), (102, 26), (96, 33)], '#f2d28b', outline=None)
        line(draw, [(80, 42), (105, 45)], BRONZE, 5)
        hand_grip(draw, (77, 103))
    elif name == 'hunting_bow':
        line(draw, [(81, 21), (91, 39), (94, 63), (88, 84), (77, 105)], WOOD, 7)
        line(draw, [(78, 23), (87, 42), (90, 63), (84, 84), (74, 102)], WOOD_LIGHT, 3)
        line(draw, [(81, 21), (77, 103)], METAL_LIGHT, 2)
        line(draw, [(77, 101), (59, 65), (42, 32)], METAL, 3)
        polygon(draw, [(40, 27), (35, 17), (44, 23)], METAL_LIGHT, width=2)
        line(draw, [(51, 53), (65, 58)], BRONZE, 4)
        hand_grip(draw, (77, 101))
    else:
        spear(draw)
        hand_grip(draw, (76, 102))
    image.save(ROOT / f'{name}.png', optimize=True)
    return image


def draw_offhand(name):
    image = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    if name == 'shield':
        # Show the shield's inner wood, rim, central grip, and the wrapped left hand.
        draw.ellipse((10, 7, 109, 112), fill=INK, outline=BRONZE, width=5)
        draw.ellipse((17, 14, 102, 104), fill='#765637', outline=BRONZE_LIGHT, width=3)
        for x in (31, 47, 63, 79, 92):
            line(draw, [(x, 19), (x + 2, 96)], '#553b2b', 4)
            line(draw, [(x + 3, 23), (x + 5, 91)], '#a47a49', 2)
        polygon(draw, [(52, 27), (73, 29), (82, 88), (62, 95)], '#543a2a', outline=BRONZE, width=4)
        polygon(draw, [(59, 37), (70, 37), (74, 78), (63, 81)], '#2c211d', outline='#d2aa65', width=3)
        line(draw, [(56, 61), (81, 59)], '#9e6d41', 4)
        line(draw, [(59, 66), (79, 64)], '#d2aa65', 2)
        for x, y in ((24, 34), (91, 35), (27, 83), (88, 82)):
            draw.rectangle((x, y, x + 3, y + 3), fill=BRONZE_LIGHT)
    elif name in ('sword', 'dagger', 'spear'):
        if name == 'spear':
            line(draw, [(34, 146), (65, 28)], WOOD, 10)
            line(draw, [(34, 146), (65, 28)], WOOD_LIGHT, 3)
            polygon(draw, [(59, 40), (67, 8), (84, 34), (72, 45)], METAL_DARK, width=3)
            polygon(draw, [(65, 35), (69, 14), (79, 34), (72, 40)], METAL_LIGHT, outline=None)
        else:
            sword_blade(draw, curved=name == 'dagger')
            hilt(draw, (79, 102))
        hand_grip(draw, (78, 102))
    elif name == 'focus':
        draw.ellipse((52, 28, 106, 83), fill=BRONZE, outline=INK, width=4)
        draw.ellipse((61, 37, 97, 73), fill='#5b7365', outline=BRONZE_LIGHT, width=3)
        polygon(draw, [(79, 43), (91, 55), (79, 67), (67, 55)], '#eef0d5', outline=None)
        line(draw, [(52, 78), (41, 109)], METAL_LIGHT, 4)
        hand_grip(draw, (70, 103))
    elif name == 'bow_draw':
        line(draw, [(55, 18), (68, 45), (73, 71), (65, 100)], WOOD, 7)
        line(draw, [(53, 18), (62, 45), (66, 70), (60, 100)], WOOD_LIGHT, 3)
        line(draw, [(53, 18), (61, 99)], METAL_LIGHT, 2)
        line(draw, [(25, 59), (90, 59)], METAL, 4)
        polygon(draw, [(91, 59), (79, 53), (79, 65)], METAL_LIGHT, width=2)
        hand_grip(draw, (47, 91))
    elif name == 'two_hand_grip':
        line(draw, [(57, 146), (86, 22)], WOOD, 11)
        line(draw, [(57, 146), (86, 22)], WOOD_LIGHT, 3)
        line(draw, [(62, 124), (66, 107)], BRONZE, 4)
        hand_grip(draw, (69, 91))
    else:
        polygon(draw, [(51, 93), (62, 80), (78, 80), (91, 91), (90, 106), (79, 119), (62, 115)], SKIN, width=3)
        line(draw, [(59, 93), (77, 98), (88, 95)], SKIN_LIGHT, 3)
    polygon(draw, [(0, 122), (20, 107), (40, 109), (55, 126), (50, 159), (0, 159)], SLEEVE, width=4)
    polygon(draw, [(6, 129), (22, 116), (39, 118), (48, 131), (45, 151), (7, 153)], SLEEVE_LIGHT, outline=None)
    line(draw, [(7, 142), (46, 138)], BRONZE, 4)
    line(draw, [(8, 148), (45, 144)], BRONZE_LIGHT, 2)
    if name == 'shield':
        polygon(draw, [(29, 129), (37, 105), (48, 84), (56, 80), (64, 86), (59, 105), (48, 132), (40, 141)], SKIN, width=3)
        line(draw, [(38, 121), (48, 101), (58, 91)], SKIN_LIGHT, 3)
        polygon(draw, [(48, 67), (54, 57), (65, 59), (72, 69), (68, 82), (58, 86), (48, 78)], SKIN, width=3)
        line(draw, [(52, 67), (64, 70), (70, 68)], SKIN_LIGHT, 3)
    elif name in ('sword', 'dagger', 'spear', 'focus', 'two_hand_grip', 'bow_draw', 'empty'):
        polygon(draw, [(31, 129), (39, 110), (52, 99), (67, 101), (75, 113), (68, 127), (50, 137), (40, 140)], SKIN, width=3)
        line(draw, [(38, 124), (53, 108), (67, 111)], SKIN_LIGHT, 3)
        hand_grip(draw, (78 if name not in ('focus', 'bow_draw', 'empty') else 61, 102))
    asset_name = {'sword': 'xiphos', 'dagger': 'kopis', 'spear': 'dory'}.get(name, name)
    image.save(ROOT / f'offhand_{asset_name}.png', optimize=True)
    return image


def draw_world_shield():
    image = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse((9, 6, 119, 121), fill='#7b382c', outline=INK, width=6)
    draw.ellipse((18, 15, 110, 112), fill=BRONZE, outline=BRONZE_LIGHT, width=4)
    draw.ellipse((43, 39, 85, 83), fill='#573b2c', outline='#f0cf82', width=4)
    line(draw, [(64, 17), (64, 110)], '#9b683d', 4)
    line(draw, [(21, 64), (107, 64)], '#9b683d', 4)
    for x, y in ((29, 29), (91, 29), (29, 91), (91, 91)):
        draw.rectangle((x, y, x + 4, y + 4), fill='#f0d487')
    image.save(ROOT / 'aspis.png', optimize=True)
    return image


def make_sheet(main, offhand):
    font = ImageFont.load_default()
    entries = [
        ('Spear + two-hand grip', main['dory'], offhand['two_hand_grip']),
        ('Xiphos + inner Aspis', main['xiphos'], offhand['shield']),
        ('Kopis', main['kopis'], offhand['dagger']),
        ('Labrys', main['labrys'], offhand['empty']),
        ('Hunting bow + draw', main['hunting_bow'], offhand['bow_draw']),
        ('Ritual staff + focus', main['ritual_staff'], offhand['focus']),
    ]
    sheet = Image.new('RGB', (900, 690), '#211f20')
    draw = ImageDraw.Draw(sheet)
    draw.text((20, 14), 'R6F5 · First-person equipment sprites · 128 × 160 px', font=font, fill='#e8c77d')
    for index, (label, right, left) in enumerate(entries):
        col, row = index % 3, index // 3
        x, y = 20 + col * 292, 52 + row * 305
        draw.rectangle((x, y, x + 272, y + 278), outline='#665744', width=1)
        for sprite, offset in ((right, 28), (left, 150)):
            thumb = sprite.resize((112, 140), Image.Resampling.NEAREST)
            sheet.paste(thumb, (x + offset, y + 22), thumb)
        draw.text((x + 10, y + 258), label, font=font, fill='#ded1b5')
    output = Path(__file__).resolve().parents[1] / 'docs/previews/R6F5_VIEWMODEL_ASSET_SHEET.png'
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, optimize=True)


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    main_assets = {name: draw_main_weapon(name) for name in ('empty', 'xiphos', 'kopis', 'dory', 'labrys', 'ritual_staff', 'hunting_bow')}
    offhand_assets = {name: draw_offhand(name) for name in ('empty', 'sword', 'dagger', 'spear', 'shield', 'focus', 'two_hand_grip', 'bow_draw')}
    for obsolete_name in ('offhand_sword.png', 'offhand_dagger.png', 'offhand_spear.png'):
        (ROOT / obsolete_name).unlink(missing_ok=True)
    draw_world_shield()
    make_sheet(main_assets, offhand_assets)
    print('Generated high-resolution local viewmodel sprites and preview sheet.')


if __name__ == '__main__':
    main()
