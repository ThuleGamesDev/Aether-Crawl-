"""Locally authored, deterministic pixel parts and pose sheets for FPS pilot rigs."""
from copy import deepcopy
from pathlib import Path
import json
import math

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    Image = ImageDraw = ImageFont = None


CELL = 64
ATLAS_COLUMNS = 16
ATLAS_ROWS = 12
ATLAS_SIZE = (CELL * ATLAS_COLUMNS, CELL * ATLAS_ROWS)
RIGS = []


PALETTES = {
    'rat': {'ink': '#21191b', 'fur': '#71543d', 'lit': '#a18159', 'pale': '#d1c2a1', 'rose': '#9f5753', 'tooth': '#ead6b1', 'eye': '#f1b750', 'green': '#718b55'},
    'revenant': {'ink': '#1e2023', 'dark': '#36302e', 'bronze': '#8e6944', 'lit': '#c39457', 'bright': '#e0c67f', 'linen': '#c7baa0', 'red': '#572f35', 'skin': '#80786c', 'patina': '#477469'},
    'spider': {'ink': '#161e1b', 'chitin': '#36352b', 'olive': '#778341', 'lit': '#b5b76a', 'toxin': '#a4c253', 'eye': '#f0cf6c', 'web': '#d9d9ba', 'belly': '#514d32'},
    'enforcer': {'ink': '#25191c', 'dark': '#49373a', 'hide': '#70423c', 'red': '#913e3b', 'bronze': '#a87543', 'lit': '#d5a35b', 'pale': '#ddcfab', 'iron': '#49373a', 'eye': '#e0b356'},
    'gatekeeper': {'ink': '#211e1b', 'bronze': '#916b3f', 'lit': '#c99a53', 'bright': '#e8ca80', 'dark': '#4d4033', 'patina': '#587568', 'glow': '#9bcf9b', 'linen': '#c4b492'},
    'acolyte': {'ink': '#211920', 'dark': '#38262f', 'robe': '#583347', 'red': '#934657', 'lit': '#bf8b61', 'gold': '#c69b5c', 'bone': '#c8bea8', 'violet': '#9872ad', 'glow': '#dfb870'},
}


def col(value):
    value = value.lstrip('#')
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4))


def polygon(draw, points, fill, outline, width=2):
    draw.polygon(points, fill=col(fill))
    draw.line(points + [points[0]], fill=col(outline), width=width, joint='curve')


def rect(draw, box, fill, outline=None, width=1):
    draw.rectangle(box, fill=col(fill), outline=col(outline) if outline else None, width=width)


def authored_part(style, part):
    """Draw one intentionally authored anatomy or equipment layer at native scale."""
    p = PALETTES[style]
    image = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)

    if style == 'rat':
        if part == 'body':
            polygon(d, [(7, 34), (13, 22), (25, 15), (43, 17), (54, 27), (57, 40), (48, 49), (26, 51), (11, 45)], p['fur'], p['ink'], 3)
            polygon(d, [(19, 24), (29, 19), (43, 23), (48, 33), (42, 40), (26, 39)], p['lit'], p['fur'], 1)
            rect(d, (28, 29, 39, 33), p['green']); rect(d, (35, 35, 45, 38), p['fur'])
            for x, y in [(22, 43), (27, 46), (43, 43), (48, 39)]: rect(d, (x, y, x + 2, y + 1), p['pale'])
        elif part == 'tail':
            d.line([(51, 15), (43, 19), (36, 28), (25, 31), (18, 39), (8, 40), (4, 35)], fill=col(p['rose']), width=5, joint='curve')
            d.line([(50, 14), (43, 20), (36, 28), (26, 32)], fill=col(p['lit']), width=1)
        elif part == 'upper_leg':
            polygon(d, [(31, 8), (41, 10), (44, 16), (39, 20), (27, 19), (22, 14)], p['fur'], p['ink'], 2)
            rect(d, (27, 13, 40, 16), p['lit']); rect(d, (29, 13, 35, 14), p['pale'])
        elif part == 'lower_leg':
            polygon(d, [(27, 8), (38, 9), (41, 15), (34, 20), (23, 18), (24, 13)], p['fur'], p['ink'], 2)
            rect(d, (25, 13, 38, 16), p['lit']); rect(d, (23, 18, 40, 21), p['ink'])
            for x in (25, 31, 37): d.line((x, 18, x - 2, 22), fill=col(p['tooth']), width=1)
        elif part == 'head':
            polygon(d, [(10, 37), (13, 22), (23, 12), (39, 12), (48, 22), (50, 34), (43, 44), (25, 48), (14, 44)], p['fur'], p['ink'], 3)
            polygon(d, [(18, 25), (25, 17), (39, 19), (44, 28), (36, 36), (22, 35)], p['lit'], p['fur'], 1)
            rect(d, (38, 26, 44, 29), p['ink']); rect(d, (40, 26, 42, 27), p['eye'])
            rect(d, (44, 38, 53, 42), p['pale']); d.point((52, 38), fill=col(p['rose']))
        elif part == 'ear':
            polygon(d, [(20, 48), (16, 26), (24, 11), (39, 29), (36, 47)], p['fur'], p['ink'], 2)
            polygon(d, [(24, 38), (22, 25), (25, 19), (33, 31), (32, 39)], p['rose'], p['lit'], 1)
        elif part == 'muzzle':
            polygon(d, [(19, 31), (27, 25), (44, 27), (55, 34), (45, 40), (26, 41), (20, 37)], p['pale'], p['ink'], 2)
            rect(d, (49, 32, 55, 35), p['rose']); rect(d, (29, 38, 31, 44), p['tooth']); rect(d, (40, 38, 42, 43), p['tooth'])
        elif part == 'eye':
            rect(d, (17, 28, 47, 37), p['ink']); rect(d, (20, 30, 44, 34), p['eye']); rect(d, (31, 29, 36, 36), p['ink']); d.point((33, 30), fill=col(p['tooth']))

    elif style == 'spider':
        if part == 'abdomen':
            polygon(d, [(11, 35), (13, 19), (24, 10), (41, 11), (52, 20), (55, 37), (48, 49), (33, 55), (18, 49)], p['chitin'], p['ink'], 3)
            polygon(d, [(18, 23), (28, 16), (40, 18), (46, 26), (43, 36), (30, 42), (20, 35)], p['belly'], p['olive'], 1)
            for y in (23, 29, 35): d.line((24, y, 41, y - 2), fill=col(p['toxin'] if y == 29 else p['olive']), width=2)
            rect(d, (28, 45, 37, 48), p['lit'])
        elif part == 'thorax':
            polygon(d, [(15, 36), (18, 20), (29, 11), (42, 15), (49, 27), (44, 43), (32, 51), (20, 45)], p['olive'], p['ink'], 3)
            polygon(d, [(24, 24), (31, 17), (40, 22), (42, 32), (34, 42), (25, 37)], p['lit'], p['olive'], 1)
            d.line((29, 20, 34, 15, 39, 22), fill=col(p['web']), width=2)
        elif part.startswith('upper_'):
            if part.endswith('front'):
                polygon(d, [(31, 7), (39, 10), (32, 24), (18, 38), (10, 34), (21, 20)], p['olive'], p['ink'], 2)
                rect(d, (16, 29, 23, 33), p['lit']); d.line((23, 24, 31, 14), fill=col(p['toxin']), width=2)
            else:
                polygon(d, [(30, 7), (39, 10), (45, 23), (50, 37), (42, 41), (34, 28)], p['chitin'], p['ink'], 2)
                rect(d, (39, 27, 47, 31), p['olive']); d.line((34, 16, 40, 27), fill=col(p['lit']), width=2)
        elif part.startswith('lower_'):
            if part.endswith('front'):
                polygon(d, [(29, 7), (37, 10), (48, 22), (54, 39), (46, 44), (38, 29), (26, 18)], p['chitin'], p['ink'], 2)
                rect(d, (43, 27, 51, 31), p['lit']); d.line((47, 32, 55, 40), fill=col(p['toxin']), width=1)
            else:
                polygon(d, [(30, 7), (39, 11), (30, 25), (18, 40), (10, 36), (19, 21)], p['olive'], p['ink'], 2)
                rect(d, (15, 30, 23, 34), p['lit']); d.line((14, 35, 8, 43), fill=col(p['toxin']), width=1)
        elif part == 'head':
            polygon(d, [(15, 36), (17, 22), (27, 12), (41, 13), (49, 25), (45, 41), (31, 48), (19, 44)], p['chitin'], p['ink'], 3)
            for x, y in [(24, 25), (31, 20), (39, 23), (26, 32), (37, 31)]:
                rect(d, (x, y, x + 3, y + 4), p['eye']); d.point((x + 1, y + 1), fill=col(p['web']))
        elif part == 'fang':
            polygon(d, [(18, 9), (29, 18), (35, 30), (31, 48), (23, 55), (27, 36), (21, 27)], p['lit'], p['ink'], 2)
            rect(d, (24, 22, 29, 29), p['web']); rect(d, (25, 41, 31, 46), p['toxin'])

    else:
        if part == 'torso':
            if style == 'acolyte':
                polygon(d, [(19, 9), (43, 9), (54, 25), (49, 56), (58, 60), (7, 60), (16, 50), (12, 24)], p['robe'], p['ink'], 3)
                polygon(d, [(23, 17), (40, 17), (43, 43), (21, 46)], p['red'], p['robe'], 1)
                rect(d, (24, 27, 40, 32), p['gold']); rect(d, (29, 28, 35, 30), p['ink'])
                d.line((20, 43, 31, 48, 46, 42), fill=col(p['bone']), width=2)
            elif style == 'enforcer':
                polygon(d, [(19, 8), (42, 8), (53, 20), (49, 53), (59, 60), (5, 60), (15, 51), (12, 21)], p['hide'], p['ink'], 3)
                polygon(d, [(19, 18), (31, 12), (44, 19), (45, 40), (34, 48), (20, 39)], p['red'], p['bronze'], 2)
                rect(d, (22, 27, 42, 31), p['lit']); rect(d, (27, 22, 37, 25), p['ink'])
                d.line((14, 37, 28, 45, 47, 35), fill=col(p['pale']), width=3)
            else:
                metal = p['bronze']
                polygon(d, [(20, 8), (43, 8), (53, 21), (49, 55), (58, 60), (6, 60), (15, 51), (12, 21)], p['skin'] if style == 'revenant' else p['dark'], p['ink'], 3)
                polygon(d, [(19, 19), (25, 14), (40, 14), (47, 21), (44, 46), (20, 46)], metal, p['bright'] if style == 'gatekeeper' else p['lit'], 2)
                rect(d, (23, 24, 41, 28), p['dark']); rect(d, (26, 30, 38, 40), p['linen'] if style == 'gatekeeper' else p['red'])
                d.line((31, 31, 31, 41), fill=col(p['bright'] if style == 'gatekeeper' else p['lit']), width=2)
                d.line((21, 19, 44, 19), fill=col(p['bright'] if style == 'gatekeeper' else p['lit']), width=2)
                for x in (23, 42): rect(d, (x, 44, x + 3, 47), p['patina'] if style in ('revenant', 'gatekeeper') else p['bright'])
        elif part == 'head':
            if style == 'acolyte':
                polygon(d, [(12, 35), (16, 19), (28, 8), (42, 12), (51, 28), (45, 48), (32, 54), (17, 47)], p['bone'], p['ink'], 3)
                polygon(d, [(11, 30), (19, 10), (37, 5), (54, 24), (47, 31), (40, 21), (25, 20), (16, 36)], p['robe'], p['red'], 2)
                rect(d, (21, 31, 43, 36), p['ink']); rect(d, (25, 32, 29, 34), p['glow']); rect(d, (36, 32, 40, 34), p['glow'])
            elif style == 'enforcer':
                polygon(d, [(12, 37), (14, 20), (25, 10), (40, 12), (51, 27), (46, 45), (31, 52), (17, 47)], p['hide'], p['ink'], 3)
                polygon(d, [(14, 31), (20, 17), (31, 14), (45, 22), (47, 34), (40, 39), (21, 38)], p['bronze'], p['lit'], 2)
                rect(d, (21, 29, 43, 34), p['ink']); rect(d, (25, 30, 29, 32), p['eye']); rect(d, (36, 30, 40, 32), p['eye'])
                polygon(d, [(17, 23), (4, 7), (21, 17), (29, 22)], p['pale'], p['bronze'], 2)
                polygon(d, [(38, 22), (48, 15), (61, 5), (53, 24), (43, 29)], p['pale'], p['bronze'], 2)
            else:
                polygon(d, [(13, 37), (15, 20), (25, 9), (40, 10), (50, 24), (47, 41), (33, 51), (17, 46)], p['skin'] if style == 'revenant' else p['dark'], p['ink'], 3)
                if style == 'gatekeeper':
                    polygon(d, [(10, 30), (13, 13), (25, 4), (43, 5), (55, 21), (51, 33), (44, 26), (20, 26)], p['bronze'], p['bright'], 2)
                    rect(d, (21, 25, 43, 30), p['ink']); rect(d, (26, 26, 30, 28), p['glow']); rect(d, (36, 26, 40, 28), p['glow'])
                    polygon(d, [(25, 6), (30, 1), (34, 8), (39, 1), (43, 8), (38, 14), (28, 14)], p['lit'], p['ink'], 1)
                else:
                    polygon(d, [(11, 29), (14, 12), (26, 5), (44, 10), (51, 25), (44, 32), (20, 30)], p['bronze'], p['bright'], 2)
                    rect(d, (20, 25, 43, 30), p['ink']); rect(d, (25, 26, 30, 28), p['bright']); rect(d, (35, 26, 40, 28), p['bright'])
                    if style == 'revenant':
                        polygon(d, [(19, 9), (15, 2), (24, 8), (30, 1), (33, 8), (42, 2), (38, 11)], p['patina'], p['bright'], 1)
                        rect(d, (27, 34, 37, 37), p['patina'])
        elif part in ('upper_arm', 'lower_arm'):
            top = 7 if part == 'upper_arm' else 6
            bottom = 31 if part == 'upper_arm' else 30
            if style == 'acolyte':
                polygon(d, [(25, top), (39, top + 1), (44, bottom - 7), (35, bottom), (20, bottom - 10)], p['robe'], p['ink'], 2)
                rect(d, (23, bottom - 16, 39, bottom - 10), p['gold']); rect(d, (27, bottom - 14, 35, bottom - 12), p['red'])
            else:
                skin = p['skin'] if style == 'revenant' else p['hide'] if style == 'enforcer' else p['dark']
                armor = p['bronze'] if style != 'enforcer' else p['lit']
                polygon(d, [(24, top), (40, top + 2), (45, bottom - 7), (37, bottom), (20, bottom - 7)], skin, p['ink'], 2)
                rect(d, (21, bottom - 17, 42, bottom - 9), armor)
                rect(d, (25, bottom - 15, 29, bottom - 12), p['bright'] if style == 'gatekeeper' else p['lit'])
                rect(d, (34, bottom - 14, 38, bottom - 11), p['patina'] if style in ('revenant', 'gatekeeper') else p['red'])
        elif part in ('upper_leg', 'lower_leg'):
            top = 7 if part == 'upper_leg' else 5
            bottom = 30 if part == 'upper_leg' else 29
            if style == 'acolyte':
                polygon(d, [(22, top), (42, top), (45, bottom - 8), (37, bottom), (19, bottom - 6)], p['robe'], p['ink'], 2)
                rect(d, (22, bottom - 15, 41, bottom - 12), p['red'])
            else:
                armor = p['bronze'] if style != 'enforcer' else p['hide']
                polygon(d, [(23, top), (41, top + 2), (45, bottom - 9), (37, bottom), (19, bottom - 8)], armor, p['ink'], 2)
                rect(d, (21, bottom - 17, 42, bottom - 10), p['dark'] if style != 'enforcer' else p['red'])
                rect(d, (24, bottom - 15, 39, bottom - 13), p['bright'] if style == 'gatekeeper' else p['lit'])
                d.line((28, bottom - 12, 34, bottom - 12), fill=col(p['patina'] if style in ('revenant', 'gatekeeper') else p['pale']), width=1)
        elif part == 'foot':
            polygon(d, [(18, 11), (40, 8), (50, 20), (46, 31), (14, 31), (8, 23)], p['dark'] if style != 'acolyte' else p['robe'], p['ink'], 2)
            rect(d, (18, 14, 40, 18), p.get('lit', p.get('gold')))
        elif part == 'shield':
            if style == 'enforcer':
                polygon(d, [(32, 5), (52, 15), (50, 39), (32, 57), (13, 39), (11, 15)], p['red'], p['ink'], 3)
                polygon(d, [(32, 11), (44, 18), (43, 37), (32, 49), (20, 37), (19, 18)], p['bronze'], p['pale'], 2)
                rect(d, (29, 19, 35, 41), p['lit']); rect(d, (21, 27, 43, 33), p['lit'])
            else:
                metal = p['bronze'] if style != 'acolyte' else p['robe']
                edge = p['bright'] if style in ('gatekeeper', 'revenant') else p['gold'] if style == 'acolyte' else p['lit']
                d.ellipse((7, 5, 57, 59), fill=col(metal), outline=col(p['ink']), width=3)
                d.ellipse((13, 11, 51, 53), fill=col(p['dark'] if style != 'acolyte' else p['red']), outline=col(edge), width=2)
                d.ellipse((22, 20, 42, 42), fill=col(edge), outline=col(p['ink']), width=2)
                rect(d, (30, 13, 34, 50), edge); rect(d, (15, 30, 49, 34), edge)
                for x, y in [(19, 16), (43, 16), (19, 44), (43, 44)]: rect(d, (x, y, x + 2, y + 2), p.get('patina', p.get('violet', edge)))
        elif part == 'weapon':
            handle = p['dark'] if style != 'acolyte' else p['robe']
            metal = p.get('bright', p.get('glow'))
            d.line((31, 51, 32, 16), fill=col(handle), width=6)
            if style == 'enforcer':
                polygon(d, [(29, 25), (13, 20), (9, 8), (27, 12), (34, 10), (53, 17), (48, 28)], p['lit'], p['ink'], 2)
                rect(d, (16, 18, 24, 21), p['pale']); rect(d, (37, 18, 47, 22), p['pale'])
            elif style == 'acolyte':
                d.line((32, 22, 32, 7), fill=col(p['gold']), width=4)
                d.ellipse((22, 3, 42, 22), fill=col(p['violet']), outline=col(p['ink']), width=2)
                d.ellipse((27, 7, 37, 17), fill=col(p['glow']))
            else:
                polygon(d, [(30, 23), (25, 8), (32, 3), (39, 9), (35, 25), (39, 34), (25, 34)], metal, p['ink'], 2)
                d.line((23, 31, 41, 31), fill=col(p['lit']), width=4)
                rect(d, (29, 43, 35, 48), p['lit'])
                if style == 'gatekeeper': rect(d, (28, 10, 35, 13), p['glow'])
        elif part == 'cloak':
            polygon(d, [(18, 8), (44, 8), (54, 35), (59, 58), (5, 58), (12, 34)], p['robe'] if style == 'acolyte' else p['red'], p['ink'], 3)
            d.line((20, 18, 17, 50), fill=col(p['lit']), width=2); d.line((42, 18, 47, 50), fill=col(p['gold'] if style == 'acolyte' else p['bronze']), width=2)
            for y in (35, 43, 51): rect(d, (27, y, 36, y + 2), p['gold'] if style == 'acolyte' else p['lit'])

    return image


def authored_view_part(style, part, view):
    """Build front, three-quarter, and back views from the same authored anatomy layers."""
    image = authored_part(style, part)
    if view == 'threeQuarter':
        side = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
        narrow = image.resize((54, CELL), Image.Resampling.NEAREST)
        side.alpha_composite(narrow, (5, 0))
        # The far plane loses a little light; the opposite view mirrors the whole rig in WebGL.
        pixels = side.load()
        for y in range(CELL):
            for x in range(5, 32):
                red, green, blue, alpha = pixels[x, y]
                if alpha:
                    pixels[x, y] = (round(red * 0.78), round(green * 0.78), round(blue * 0.78), alpha)
        if part in ('torso', 'head', 'shield'):
            p = PALETTES[style]
            d = ImageDraw.Draw(side)
            accent = p.get('bright', p.get('gold', p.get('lit')))
            d.line((43, 12, 43, 43), fill=col(accent), width=1)
        return side

    p = PALETTES[style]
    if view == 'front':
        # Humanoid front views are deliberately bilateral while retaining each pilot's authored armor and palette.
        half = image.crop((1, 0, 32, CELL))
        image = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
        image.alpha_composite(half, (0, 0))
        image.alpha_composite(half.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (32, 0))
        d = ImageDraw.Draw(image)
        if part == 'head':
            eye = p.get('glow', p.get('eye', p.get('bright', p.get('lit'))))
            d.rectangle((22, 26, 27, 29), fill=col(eye))
            d.rectangle((37, 26, 42, 29), fill=col(eye))
            d.point((24, 26), fill=col(p.get('tooth', p.get('bright', eye))))
            d.point((39, 26), fill=col(p.get('tooth', p.get('bright', eye))))
        elif part == 'torso':
            accent = p.get('bright', p.get('gold', p.get('lit')))
            d.line((32, 16, 32, 43), fill=col(accent), width=2)
            if style == 'enforcer':
                d.polygon([(24, 18), (32, 22), (40, 18), (38, 29), (32, 33), (26, 29)], fill=col(p['red']), outline=col(p['ink']))
            elif style == 'acolyte':
                d.polygon([(28, 22), (32, 18), (36, 22), (32, 35)], fill=col(p['glow']), outline=col(p['gold']))
        elif part == 'shield':
            d.ellipse((27, 25, 37, 35), fill=col(p.get('bright', p.get('gold', p.get('lit')))), outline=col(p['ink']))
        return image

    if view != 'back':
        raise ValueError('Unknown authored humanoid view: ' + view)
    image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    d = ImageDraw.Draw(image)
    if part == 'head':
        shell = p.get('robe', p.get('bronze', p.get('dark', p.get('hide'))))
        trim = p.get('bright', p.get('gold', p.get('lit')))
        d.polygon([(15, 28), (17, 15), (27, 8), (39, 8), (49, 17), (48, 34), (42, 42), (23, 42)], fill=col(shell), outline=col(p['ink']))
        d.line((32, 13, 32, 39), fill=col(trim), width=2)
        d.line((20, 35, 26, 40, 32, 42, 38, 40, 44, 35), fill=col(p.get('patina', p.get('red', trim))), width=2)
    elif part == 'torso':
        back = p.get('dark', p.get('robe', p.get('hide')))
        armor = p.get('bronze', p.get('red', p.get('gold', p.get('lit'))))
        d.polygon([(20, 16), (27, 12), (37, 12), (44, 16), (42, 42), (32, 47), (22, 42)], fill=col(back), outline=col(p['ink']))
        d.line((32, 17, 32, 45), fill=col(armor), width=3)
        d.line((20, 20, 28, 25, 36, 25, 44, 20), fill=col(p.get('bright', p.get('gold', armor))), width=2)
        for y in (31, 37, 43):
            d.rectangle((28, y, 36, y + 1), fill=col(p.get('patina', p.get('red', armor))))
    elif part == 'cloak':
        d.line((31, 12, 31, 53), fill=col(p.get('gold', p.get('bronze', p.get('lit')))), width=2)
        d.line((14, 47, 31, 51, 49, 47), fill=col(p.get('bright', p.get('gold', p.get('lit')))), width=2)
    elif part == 'shield':
        d.line((32, 12, 32, 52), fill=col(p.get('dark', p.get('ink'))), width=4)
        d.line((20, 29, 44, 29), fill=col(p.get('lit', p.get('gold', p.get('bright')))), width=3)
        d.ellipse((26, 24, 38, 36), outline=col(p.get('bright', p.get('gold', p.get('lit')))), width=2)
    elif part in ('upper_arm', 'lower_arm', 'upper_leg', 'lower_leg', 'foot'):
        stripe = p.get('patina', p.get('red', p.get('gold', p.get('lit'))))
        d.line((26, 13, 38, 19), fill=col(stripe), width=2)
        d.line((25, 28, 37, 34), fill=col(p.get('bright', p.get('lit', stripe))), width=1)
    return image


def layer(layer_id, art, parent, attach, pivot=(32, 32), order=0, flip=False):
    return {'id': layer_id, 'art': art, 'parent': parent, 'attach': list(attach), 'pivot': list(pivot), 'order': order, 'flipX': flip}


def human_layers(style, heavy=False, mage=False):
    layers = [
        layer('cloak', 'cloak', 'torso', (0, 0), (32, 32), 0) if mage or style == 'revenant' else None,
        layer('legUpperL', 'upper_leg', 'torso', (-9, 9), (32, 8), 1),
        layer('legUpperR', 'upper_leg', 'torso', (9, 9), (32, 8), 2, True),
        layer('legLowerL', 'lower_leg', 'legUpperL', (1, 19), (32, 5), 3),
        layer('legLowerR', 'lower_leg', 'legUpperR', (-1, 19), (32, 5), 4, True),
        layer('footL', 'foot', 'legLowerL', (0, 18), (29, 15), 5),
        layer('footR', 'foot', 'legLowerR', (0, 18), (29, 15), 6, True),
        layer('torso', 'torso', 'root', (48, 64), (32, 51), 8),
        layer('armUpperL', 'upper_arm', 'torso', (-15 if heavy else -13, -10), (32, 8), 7),
        layer('armUpperR', 'upper_arm', 'torso', (13 if heavy else 11, -10), (32, 8), 9, True),
        layer('armLowerL', 'lower_arm', 'armUpperL', (-1, 19), (32, 6), 10),
        layer('armLowerR', 'lower_arm', 'armUpperR', (1, 19), (32, 6), 12, True),
        layer('head', 'head', 'torso', (0, -25), (32, 48), 11),
        layer('weapon', 'weapon', 'armLowerR', (0, 25), (32, 49), 14),
    ]
    if not mage:
        layers.append(layer('shield', 'shield', 'armLowerL', (0, -10), (32, 32), 13))
    return [entry for entry in layers if entry]


def humanoid_clips(heavy=False, mage=False, guardian=False):
    swing = 0.8 if heavy or guardian else 0.62
    lift = -0.9 if heavy or guardian else -0.67
    return {
        'idle': [
            {'t': 0, 'layers': {'torso': {'y': 0}, 'head': {'rotation': 0.015}}},
            {'t': 0.5, 'layers': {'torso': {'y': 1.1}, 'head': {'rotation': -0.018}}},
            {'t': 1, 'layers': {'torso': {'y': 0}, 'head': {'rotation': 0.015}}},
        ],
        'run': [
            {'t': 0, 'layers': {'torso': {'y': 0}, 'armUpperL': {'rotation': -0.42}, 'armUpperR': {'rotation': 0.42}, 'legUpperL': {'rotation': 0.48}, 'legUpperR': {'rotation': -0.48}, 'legLowerL': {'rotation': -0.18}, 'legLowerR': {'rotation': 0.18}}},
            {'t': 0.25, 'layers': {'torso': {'y': 2}, 'armUpperL': {'rotation': -0.05}, 'armUpperR': {'rotation': 0.05}, 'legUpperL': {'rotation': 0.12}, 'legUpperR': {'rotation': -0.12}, 'legLowerL': {'rotation': -0.58}, 'legLowerR': {'rotation': 0.02}}},
            {'t': 0.5, 'layers': {'torso': {'y': 0}, 'armUpperL': {'rotation': 0.42}, 'armUpperR': {'rotation': -0.42}, 'legUpperL': {'rotation': -0.48}, 'legUpperR': {'rotation': 0.48}, 'legLowerL': {'rotation': 0.18}, 'legLowerR': {'rotation': -0.18}}},
            {'t': 0.75, 'layers': {'torso': {'y': 2}, 'armUpperL': {'rotation': 0.05}, 'armUpperR': {'rotation': -0.05}, 'legUpperL': {'rotation': -0.12}, 'legUpperR': {'rotation': 0.12}, 'legLowerL': {'rotation': 0.02}, 'legLowerR': {'rotation': -0.58}}},
            {'t': 1, 'layers': {'torso': {'y': 0}, 'armUpperL': {'rotation': -0.42}, 'armUpperR': {'rotation': 0.42}, 'legUpperL': {'rotation': 0.48}, 'legUpperR': {'rotation': -0.48}, 'legLowerL': {'rotation': -0.18}, 'legLowerR': {'rotation': 0.18}}},
        ],
        'alert': [{'t': 0, 'layers': {'torso': {'y': -1}, 'head': {'rotation': -0.12}, 'armUpperL': {'rotation': 0.12}, 'armUpperR': {'rotation': -0.16}}}, {'t': 1, 'layers': {'torso': {'y': 1}, 'head': {'rotation': 0.08}, 'armUpperL': {'rotation': -0.08}, 'armUpperR': {'rotation': 0.1}}}],
        'melee_windup': [{'t': 0, 'layers': {'torso': {'rotation': -0.02}, 'armUpperR': {'rotation': 0.06}, 'armLowerR': {'rotation': 0.08}, 'shield': {'rotation': -0.06}}}, {'t': 1, 'layers': {'torso': {'rotation': -0.12}, 'armUpperR': {'rotation': lift}, 'armLowerR': {'rotation': 0.28}, 'armUpperL': {'rotation': -0.15}, 'shield': {'rotation': -0.16}}}],
        'melee_impact': [{'t': 0, 'layers': {'torso': {'rotation': -0.12}, 'armUpperR': {'rotation': lift}, 'armLowerR': {'rotation': 0.28}}}, {'t': 0.32, 'layers': {'torso': {'rotation': 0.2}, 'armUpperR': {'rotation': swing}, 'armLowerR': {'rotation': -0.18}, 'shield': {'rotation': 0.12}}}, {'t': 1, 'layers': {'torso': {'rotation': 0.18}, 'armUpperR': {'rotation': swing * 0.86}, 'armLowerR': {'rotation': -0.12}}}],
        'melee_recovery': [{'t': 0, 'layers': {'torso': {'rotation': 0.18}, 'armUpperR': {'rotation': swing * 0.86}, 'armLowerR': {'rotation': -0.12}}}, {'t': 0.38, 'layers': {'torso': {'rotation': 0.08}, 'armUpperR': {'rotation': 0.18}, 'armLowerR': {'rotation': 0.02}}}, {'t': 1, 'layers': {'torso': {'rotation': 0}, 'armUpperR': {'rotation': 0}, 'armLowerR': {'rotation': 0}, 'armUpperL': {'rotation': 0}, 'shield': {'rotation': 0}}}],
        'cast_windup': [{'t': 0, 'layers': {'torso': {'rotation': 0}, 'armUpperR': {'rotation': 0.05}}}, {'t': 1, 'layers': {'torso': {'rotation': -0.04}, 'armUpperR': {'rotation': -0.78}, 'armLowerR': {'rotation': 0.2}, 'armUpperL': {'rotation': -0.5}, 'armLowerL': {'rotation': -0.22}, 'weapon': {'y': 3}}}],
        'cast_impact': [{'t': 0, 'layers': {'armUpperR': {'rotation': -0.78}, 'armLowerR': {'rotation': 0.2}, 'armUpperL': {'rotation': -0.5}, 'armLowerL': {'rotation': -0.22}, 'weapon': {'y': 3}}}, {'t': 0.35, 'layers': {'armUpperR': {'rotation': -0.92}, 'armLowerR': {'rotation': 0.34}, 'armUpperL': {'rotation': -0.62}, 'weapon': {'y': 6}}}, {'t': 1, 'layers': {'armUpperR': {'rotation': -0.92}, 'armLowerR': {'rotation': 0.34}, 'armUpperL': {'rotation': -0.62}, 'weapon': {'y': 6}}}],
        'cast_recovery': [{'t': 0, 'layers': {'armUpperR': {'rotation': -0.92}, 'armLowerR': {'rotation': 0.34}, 'armUpperL': {'rotation': -0.62}, 'weapon': {'y': 6}}}, {'t': 0.45, 'layers': {'armUpperR': {'rotation': -0.42}, 'armLowerR': {'rotation': 0.08}, 'armUpperL': {'rotation': -0.2}, 'weapon': {'y': 2}}}, {'t': 1, 'layers': {'armUpperR': {'rotation': 0}, 'armLowerR': {'rotation': 0}, 'armUpperL': {'rotation': 0}, 'weapon': {'y': 0}}}],
        'guard_windup': [{'t': 0, 'layers': {'shield': {'rotation': 0}, 'armUpperL': {'rotation': 0}}}, {'t': 1, 'layers': {'shield': {'rotation': -0.3}, 'armUpperL': {'rotation': -0.24}, 'torso': {'rotation': 0.03}}}],
        'guard_impact': [{'t': 0, 'layers': {'shield': {'rotation': -0.3}, 'armUpperL': {'rotation': -0.24}, 'torso': {'rotation': 0.03}}}, {'t': 0.3, 'layers': {'shield': {'rotation': -0.42}, 'armUpperL': {'rotation': -0.32}, 'torso': {'rotation': -0.06}}}, {'t': 1, 'layers': {'shield': {'rotation': -0.36}, 'armUpperL': {'rotation': -0.26}, 'torso': {'rotation': -0.03}}}],
        'guard_recovery': [{'t': 0, 'layers': {'shield': {'rotation': -0.36}, 'armUpperL': {'rotation': -0.26}, 'torso': {'rotation': -0.03}}}, {'t': 1, 'layers': {'shield': {'rotation': 0}, 'armUpperL': {'rotation': 0}, 'torso': {'rotation': 0}}}],
        'lunge_windup': [{'t': 0, 'layers': {'torso': {'y': 0}, 'armUpperR': {'rotation': 0.04}, 'legUpperL': {'rotation': 0}}}, {'t': 1, 'layers': {'torso': {'rotation': -0.18, 'y': -3}, 'armUpperR': {'rotation': -0.55}, 'legUpperL': {'rotation': -0.32}, 'legUpperR': {'rotation': 0.36}}}],
        'lunge_impact': [{'t': 0, 'layers': {'torso': {'rotation': -0.18, 'y': -3}, 'armUpperR': {'rotation': -0.55}, 'legUpperL': {'rotation': -0.32}, 'legUpperR': {'rotation': 0.36}}}, {'t': 0.35, 'layers': {'torso': {'rotation': 0.22, 'y': 1}, 'armUpperR': {'rotation': 0.82}, 'armLowerR': {'rotation': -0.32}, 'legUpperL': {'rotation': 0.4}, 'legUpperR': {'rotation': -0.45}}}, {'t': 1, 'layers': {'torso': {'rotation': 0.2}, 'armUpperR': {'rotation': 0.78}, 'armLowerR': {'rotation': -0.28}}}],
        'lunge_recovery': [{'t': 0, 'layers': {'torso': {'rotation': 0.2}, 'armUpperR': {'rotation': 0.78}, 'armLowerR': {'rotation': -0.28}}}, {'t': 1, 'layers': {'torso': {'rotation': 0}, 'armUpperR': {'rotation': 0}, 'armLowerR': {'rotation': 0}, 'legUpperL': {'rotation': 0}, 'legUpperR': {'rotation': 0}}}],
        'hurt': [{'t': 0, 'layers': {'torso': {'rotation': 0.14, 'x': -2}, 'head': {'rotation': 0.18}, 'armUpperR': {'rotation': 0.38}, 'armUpperL': {'rotation': -0.3}}}, {'t': 0.45, 'layers': {'torso': {'rotation': 0.07, 'x': -1}, 'head': {'rotation': 0.08}, 'armUpperR': {'rotation': 0.17}, 'armUpperL': {'rotation': -0.12}}}, {'t': 1, 'layers': {}}],
        'stagger': [{'t': 0, 'layers': {'torso': {'rotation': 0.22, 'x': -3}, 'head': {'rotation': 0.25}, 'armUpperR': {'rotation': -0.52}, 'armUpperL': {'rotation': 0.42}, 'legUpperL': {'rotation': -0.12}}}, {'t': 0.4, 'layers': {'torso': {'rotation': -0.16, 'x': 2}, 'head': {'rotation': -0.18}, 'armUpperR': {'rotation': -0.34}, 'armUpperL': {'rotation': 0.3}}}, {'t': 1, 'layers': {}}],
        'death': [{'t': 0, 'layers': {'torso': {'rotation': 0.02}, 'head': {'rotation': 0}, 'armUpperL': {'rotation': 0}, 'armUpperR': {'rotation': 0}}}, {'t': 0.46, 'layers': {'torso': {'rotation': 1.05, 'y': -10}, 'head': {'rotation': 0.72}, 'armUpperL': {'rotation': -1.0}, 'armUpperR': {'rotation': 0.95}, 'legUpperL': {'rotation': 0.55}, 'legUpperR': {'rotation': -0.5}, 'shield': {'rotation': 0.28}}}, {'t': 1, 'layers': {'torso': {'rotation': 1.48, 'y': -17}, 'head': {'rotation': 1.15}, 'armUpperL': {'rotation': -1.35}, 'armUpperR': {'rotation': 1.22}, 'legUpperL': {'rotation': 0.82}, 'legUpperR': {'rotation': -0.72}, 'shield': {'rotation': 0.55}}}],
    }


def rat_clips():
    return {
        'idle': [{'t': 0, 'layers': {'body': {'y': 0}, 'head': {'rotation': 0.015}}}, {'t': 0.5, 'layers': {'body': {'y': 0.7}, 'head': {'rotation': -0.02}}}, {'t': 1, 'layers': {'body': {'y': 0}, 'head': {'rotation': 0.015}}}],
        'run': [{'t': 0, 'layers': {'body': {'y': 0}, 'hindUpperL': {'rotation': 0.45}, 'hindUpperR': {'rotation': -0.45}, 'hindLowerL': {'rotation': -0.55}, 'hindLowerR': {'rotation': 0.08}, 'foreUpperL': {'rotation': -0.2}, 'foreUpperR': {'rotation': 0.2}, 'tail': {'rotation': -0.08}}}, {'t': 0.25, 'layers': {'body': {'y': 3}, 'hindUpperL': {'rotation': 0.04}, 'hindUpperR': {'rotation': -0.04}, 'hindLowerL': {'rotation': -0.12}, 'hindLowerR': {'rotation': 0.12}, 'foreUpperL': {'rotation': 0.04}, 'foreUpperR': {'rotation': -0.04}, 'tail': {'rotation': 0.12}}}, {'t': 0.5, 'layers': {'body': {'y': 0}, 'hindUpperL': {'rotation': -0.45}, 'hindUpperR': {'rotation': 0.45}, 'hindLowerL': {'rotation': 0.08}, 'hindLowerR': {'rotation': -0.55}, 'foreUpperL': {'rotation': 0.2}, 'foreUpperR': {'rotation': -0.2}, 'tail': {'rotation': -0.1}}}, {'t': 0.75, 'layers': {'body': {'y': 3}, 'hindUpperL': {'rotation': -0.04}, 'hindUpperR': {'rotation': 0.04}, 'hindLowerL': {'rotation': 0.12}, 'hindLowerR': {'rotation': -0.12}, 'foreUpperL': {'rotation': -0.04}, 'foreUpperR': {'rotation': 0.04}, 'tail': {'rotation': 0.13}}}, {'t': 1, 'layers': {'body': {'y': 0}, 'hindUpperL': {'rotation': 0.45}, 'hindUpperR': {'rotation': -0.45}, 'hindLowerL': {'rotation': -0.55}, 'hindLowerR': {'rotation': 0.08}, 'foreUpperL': {'rotation': -0.2}, 'foreUpperR': {'rotation': 0.2}, 'tail': {'rotation': -0.08}}}],
        'alert': [{'t': 0, 'layers': {'head': {'rotation': -0.12}, 'tail': {'rotation': -0.1}, 'body': {'y': -1}}}, {'t': 1, 'layers': {'head': {'rotation': 0.08}, 'tail': {'rotation': 0.14}, 'body': {'y': 1}}}],
        'melee_windup': [{'t': 0, 'layers': {'head': {'rotation': 0}, 'body': {'rotation': 0}}}, {'t': 1, 'layers': {'head': {'rotation': 0.22}, 'body': {'rotation': -0.12}, 'tail': {'rotation': -0.22}, 'hindUpperL': {'rotation': -0.18}, 'hindUpperR': {'rotation': -0.18}}}],
        'melee_impact': [{'t': 0, 'layers': {'head': {'rotation': 0.22}, 'body': {'rotation': -0.12}, 'tail': {'rotation': -0.22}}}, {'t': 0.3, 'layers': {'head': {'rotation': -0.42}, 'body': {'rotation': 0.18}, 'tail': {'rotation': 0.24}, 'hindUpperL': {'rotation': 0.22}, 'hindUpperR': {'rotation': -0.18}}}, {'t': 1, 'layers': {'head': {'rotation': -0.36}, 'body': {'rotation': 0.12}, 'tail': {'rotation': 0.18}}}],
        'melee_recovery': [{'t': 0, 'layers': {'head': {'rotation': -0.36}, 'body': {'rotation': 0.12}, 'tail': {'rotation': 0.18}}}, {'t': 1, 'layers': {}}],
        'leap_windup': [{'t': 0, 'layers': {'body': {'y': 0}}}, {'t': 1, 'layers': {'body': {'rotation': -0.12, 'y': -4}, 'head': {'rotation': 0.2}, 'hindUpperL': {'rotation': 0.48}, 'hindUpperR': {'rotation': 0.48}, 'foreUpperL': {'rotation': 0.48}, 'foreUpperR': {'rotation': 0.48}, 'tail': {'rotation': -0.36}}}],
        'leap_impact': [{'t': 0, 'layers': {'body': {'rotation': -0.12, 'y': -4}, 'head': {'rotation': 0.2}, 'hindUpperL': {'rotation': 0.48}, 'hindUpperR': {'rotation': 0.48}, 'foreUpperL': {'rotation': 0.48}, 'foreUpperR': {'rotation': 0.48}, 'tail': {'rotation': -0.36}}}, {'t': 0.28, 'layers': {'body': {'rotation': 0.12, 'y': 2}, 'head': {'rotation': -0.38}, 'hindUpperL': {'rotation': -0.55}, 'hindUpperR': {'rotation': -0.5}, 'foreUpperL': {'rotation': -0.48}, 'foreUpperR': {'rotation': -0.45}, 'hindLowerL': {'rotation': 0.6}, 'hindLowerR': {'rotation': 0.58}, 'tail': {'rotation': 0.32}}}, {'t': 1, 'layers': {'body': {'rotation': 0.1, 'y': 1}, 'head': {'rotation': -0.32}}}],
        'leap_recovery': [{'t': 0, 'layers': {'body': {'rotation': 0.1, 'y': 1}, 'head': {'rotation': -0.32}}}, {'t': 1, 'layers': {}}],
        'cast_windup': [{'t': 0, 'layers': {}}, {'t': 1, 'layers': {}}], 'cast_impact': [{'t': 0, 'layers': {}}, {'t': 1, 'layers': {}}], 'cast_recovery': [{'t': 0, 'layers': {}}, {'t': 1, 'layers': {}}],
        'guard_windup': [{'t': 0, 'layers': {}}, {'t': 1, 'layers': {}}], 'guard_impact': [{'t': 0, 'layers': {}}, {'t': 1, 'layers': {}}], 'guard_recovery': [{'t': 0, 'layers': {}}, {'t': 1, 'layers': {}}],
        'hurt': [{'t': 0, 'layers': {'body': {'rotation': 0.25, 'x': -2}, 'head': {'rotation': 0.2}, 'tail': {'rotation': -0.2}}}, {'t': 1, 'layers': {}}],
        'stagger': [{'t': 0, 'layers': {'body': {'rotation': 0.32, 'x': -3}, 'head': {'rotation': 0.32}, 'tail': {'rotation': -0.3}, 'hindUpperL': {'rotation': -0.15}}}, {'t': 0.5, 'layers': {'body': {'rotation': -0.14, 'x': 2}, 'head': {'rotation': -0.12}}}, {'t': 1, 'layers': {}}],
        'death': [{'t': 0, 'layers': {'body': {'rotation': 0}, 'head': {'rotation': 0}}}, {'t': 0.46, 'layers': {'body': {'rotation': 1.15, 'y': -5}, 'head': {'rotation': 0.65}, 'hindUpperL': {'rotation': -0.72}, 'hindUpperR': {'rotation': 0.75}, 'tail': {'rotation': 0.6}}}, {'t': 1, 'layers': {'body': {'rotation': 1.45, 'y': -9}, 'head': {'rotation': 0.9}, 'hindUpperL': {'rotation': -0.9}, 'hindUpperR': {'rotation': 0.9}, 'tail': {'rotation': 0.75}}}],
    }


def make_rat():
    return {
        'visualId': 'cretan_cave_rat', 'name': 'Cretan Cave Rat', 'family': 'quadruped', 'worldHeight': 0.72, 'designHeight': 72, 'origin': [48, 63],
        'attackStyles': {'rat_bite': 'melee', 'rat_leap': 'leap'}, 'clips': rat_clips(),
        'layers': [
            layer('tail', 'tail', 'body', (-18, 3), (50, 15), 0),
            layer('hindUpperL', 'upper_leg', 'body', (-12, 6), (32, 8), 1), layer('hindUpperR', 'upper_leg', 'body', (-7, 6), (32, 8), 2, True),
            layer('hindLowerL', 'lower_leg', 'hindUpperL', (0, 9), (32, 8), 3), layer('hindLowerR', 'lower_leg', 'hindUpperR', (0, 9), (32, 8), 4, True),
            layer('body', 'body', 'root', (46, 40), (32, 34), 5),
            layer('foreUpperL', 'upper_leg', 'body', (12, 4), (32, 8), 6), layer('foreUpperR', 'upper_leg', 'body', (16, 4), (32, 8), 7, True),
            layer('foreLowerL', 'lower_leg', 'foreUpperL', (0, 9), (32, 8), 8), layer('foreLowerR', 'lower_leg', 'foreUpperR', (0, 9), (32, 8), 9, True),
            layer('head', 'head', 'body', (19, -6), (26, 43), 10), layer('ear', 'ear', 'head', (5, -19), (28, 46), 11),
            layer('muzzle', 'muzzle', 'head', (12, -4), (13, 33), 12), layer('eye', 'eye', 'head', (6, -16), (32, 32), 13),
        ],
    }


def spider_clips():
    legs = [f'{side}{index}{segment}' for side in ('L', 'R') for index in range(1, 5) for segment in ('Upper', 'Lower')]
    def wave(amount, phase):
        values = {}
        for index, key in enumerate(legs):
            sign = -1 if key.startswith('L') else 1
            lower = key.endswith('Lower')
            base = math.sin(phase + index * math.pi / 2) * amount * (0.68 if lower else 1)
            values[key] = {'rotation': round(sign * base, 4)}
        return values
    run_frames = []
    for t in (0, 0.25, 0.5, 0.75, 1):
        layers = wave(0.42, t * math.tau)
        layers['abdomen'] = {'y': 1 if t in (0.25, 0.75) else 0}
        layers['thorax'] = {'rotation': 0.025 if t < 0.5 else -0.025}
        run_frames.append({'t': t, 'layers': layers})
    resting = {key: {'rotation': 0} for key in legs}
    return {
        'idle': [{'t': 0, 'layers': {'abdomen': {'y': 0}, 'thorax': {'rotation': -0.015}}}, {'t': 0.5, 'layers': {'abdomen': {'y': 0.8}, 'thorax': {'rotation': 0.02}}}, {'t': 1, 'layers': {'abdomen': {'y': 0}, 'thorax': {'rotation': -0.015}}}],
        'run': run_frames,
        'alert': [{'t': 0, 'layers': {'thorax': {'y': -1}, 'fangL': {'rotation': -0.08}, 'fangR': {'rotation': 0.08}}}, {'t': 1, 'layers': {'thorax': {'y': 1}, 'fangL': {'rotation': 0.12}, 'fangR': {'rotation': -0.12}}}],
        'melee_windup': [{'t': 0, 'layers': {}}, {'t': 1, 'layers': {**wave(0.28, 0.2), 'thorax': {'y': -2, 'rotation': -0.1}, 'fangL': {'rotation': -0.28}, 'fangR': {'rotation': 0.28}}}],
        'melee_impact': [{'t': 0, 'layers': {**wave(0.28, 0.2), 'thorax': {'y': -2, 'rotation': -0.1}, 'fangL': {'rotation': -0.28}, 'fangR': {'rotation': 0.28}}}, {'t': 0.25, 'layers': {**wave(0.4, 1.7), 'thorax': {'y': 3, 'rotation': 0.16}, 'fangL': {'rotation': 0.48}, 'fangR': {'rotation': -0.48}}}, {'t': 1, 'layers': {**wave(0.34, 1.7), 'thorax': {'y': 2, 'rotation': 0.12}}}],
        'melee_recovery': [{'t': 0, 'layers': {**wave(0.34, 1.7), 'thorax': {'y': 2, 'rotation': 0.12}}}, {'t': 1, 'layers': {**resting, 'thorax': {'rotation': 0}}}],
        'leap_windup': [{'t': 0, 'layers': {}}, {'t': 1, 'layers': {**wave(0.3, 0.5), 'abdomen': {'y': -2}, 'thorax': {'y': -3, 'rotation': -0.1}}}],
        'leap_impact': [{'t': 0, 'layers': {**wave(0.3, 0.5), 'abdomen': {'y': -2}, 'thorax': {'y': -3, 'rotation': -0.1}}}, {'t': 0.3, 'layers': {**wave(0.68, 1.5), 'abdomen': {'y': 3}, 'thorax': {'y': 3, 'rotation': 0.2}}}, {'t': 1, 'layers': {**wave(0.52, 1.5), 'abdomen': {'y': 2}, 'thorax': {'y': 2, 'rotation': 0.14}}}],
        'leap_recovery': [{'t': 0, 'layers': {**wave(0.52, 1.5), 'abdomen': {'y': 2}, 'thorax': {'y': 2, 'rotation': 0.14}}}, {'t': 1, 'layers': {**resting, 'abdomen': {'y': 0}, 'thorax': {'rotation': 0}}}],
        'cast_windup': [{'t': 0, 'layers': {}}, {'t': 1, 'layers': {**wave(0.18, 0.2), 'thorax': {'y': -2}, 'fangL': {'rotation': -0.2}, 'fangR': {'rotation': 0.2}}}],
        'cast_impact': [{'t': 0, 'layers': {**wave(0.18, 0.2), 'thorax': {'y': -2}}}, {'t': 0.45, 'layers': {**wave(0.25, 1.2), 'thorax': {'y': 2}, 'fangL': {'rotation': 0.24}, 'fangR': {'rotation': -0.24}}}, {'t': 1, 'layers': {**wave(0.18, 1.2), 'thorax': {'y': 2}}}],
        'cast_recovery': [{'t': 0, 'layers': {**wave(0.18, 1.2), 'thorax': {'y': 2}}}, {'t': 1, 'layers': {**resting, 'thorax': {'y': 0}}}],
        'guard_windup': [{'t': 0, 'layers': {}}, {'t': 1, 'layers': {**wave(0.12, 0.3), 'thorax': {'y': -1}}}],
        'guard_impact': [{'t': 0, 'layers': {**wave(0.12, 0.3), 'thorax': {'y': -1}}}, {'t': 1, 'layers': {**resting, 'thorax': {'y': 0}}}],
        'guard_recovery': [{'t': 0, 'layers': {**resting, 'thorax': {'y': 0}}}, {'t': 1, 'layers': {**resting, 'thorax': {'y': 0}}}],
        'hurt': [{'t': 0, 'layers': {'abdomen': {'rotation': 0.15, 'x': -2}, 'thorax': {'rotation': 0.2}, 'fangL': {'rotation': -0.24}, 'fangR': {'rotation': 0.24}}}, {'t': 1, 'layers': {}}],
        'stagger': [{'t': 0, 'layers': {'abdomen': {'rotation': 0.26, 'x': -3}, 'thorax': {'rotation': 0.3}, **wave(0.5, 1)}}, {'t': 0.5, 'layers': {'abdomen': {'rotation': -0.18, 'x': 2}, 'thorax': {'rotation': -0.2}, **wave(0.45, 3)}}, {'t': 1, 'layers': {}}],
        'death': [{'t': 0, 'layers': {**resting, 'abdomen': {'y': 0}}}, {'t': 0.45, 'layers': {**wave(0.75, 0.6), 'abdomen': {'rotation': 1.2, 'y': -4}, 'thorax': {'rotation': 0.8, 'y': -3}}}, {'t': 1, 'layers': {**resting, 'abdomen': {'rotation': 1.45, 'y': -8}, 'thorax': {'rotation': 1.0, 'y': -5}}}],
    }


def make_spider():
    layers = [layer('abdomen', 'abdomen', 'thorax', (1, 17), (32, 33), 1), layer('thorax', 'thorax', 'root', (48, 39), (32, 32), 7), layer('head', 'head', 'thorax', (0, -13), (32, 35), 11)]
    for index in range(1, 5):
        art = 'upper_front' if index <= 2 else 'upper_rear'
        lower = 'lower_front' if index <= 2 else 'lower_rear'
        attach_y = (33, 40, 48, 54)[index - 1]
        x = 38 if index <= 2 else 42
        child_x = -13 if index <= 2 else 9
        layers.append(layer(f'L{index}Upper', art, 'thorax', (x - 48, attach_y - 39), (32, 8), index))
        layers.append(layer(f'L{index}Lower', lower, f'L{index}Upper', (child_x, 19), (32, 8), index + 1))
        layers.append(layer(f'R{index}Upper', art, 'thorax', (48 - x, attach_y - 39), (32, 8), 14 - index, True))
        layers.append(layer(f'R{index}Lower', lower, f'R{index}Upper', (-child_x, 19), (32, 8), 18 - index, True))
    layers.extend([layer('fangL', 'fang', 'head', (-6, 12), (27, 12), 12), layer('fangR', 'fang', 'head', (6, 12), (27, 12), 13, True)])
    return {'visualId': 'arachne_brood', 'name': "Arachne's Brood", 'family': 'arachnid', 'worldHeight': 0.94, 'designHeight': 96, 'origin': [48, 91], 'attackStyles': {'spider_venom_fang': 'melee', 'spider_web_projectile': 'cast', 'spider_side_lunge': 'leap'}, 'clips': spider_clips(), 'layers': layers}


def make_human(visual_id, name, style, height, family, heavy=False, mage=False, guardian=False):
    clips = humanoid_clips(heavy, mage, guardian)
    if style == 'enforcer':
        clips['melee_windup'] = [{'t': 0, 'layers': {}}, {'t': 1, 'layers': {'torso': {'rotation': -0.22, 'y': -1}, 'armUpperR': {'rotation': -1.1}, 'armLowerR': {'rotation': 0.45}, 'armUpperL': {'rotation': -0.28}, 'shield': {'rotation': -0.16}}}]
        clips['melee_impact'] = [{'t': 0, 'layers': {'torso': {'rotation': -0.22, 'y': -1}, 'armUpperR': {'rotation': -1.1}, 'armLowerR': {'rotation': 0.45}}}, {'t': 0.25, 'layers': {'torso': {'rotation': 0.28, 'y': 1}, 'armUpperR': {'rotation': 0.92}, 'armLowerR': {'rotation': -0.25}}}, {'t': 1, 'layers': {'torso': {'rotation': 0.22}, 'armUpperR': {'rotation': 0.78}, 'armLowerR': {'rotation': -0.2}}}]
        clips['lunge_windup'] = [{'t': 0, 'layers': {}}, {'t': 1, 'layers': {'torso': {'rotation': -0.25, 'y': -4}, 'armUpperR': {'rotation': -0.9}, 'legUpperL': {'rotation': -0.38}, 'legUpperR': {'rotation': 0.42}, 'head': {'rotation': -0.12}}}]
        clips['lunge_impact'] = [{'t': 0, 'layers': {'torso': {'rotation': -0.25, 'y': -4}, 'armUpperR': {'rotation': -0.9}, 'legUpperL': {'rotation': -0.38}, 'legUpperR': {'rotation': 0.42}}}, {'t': 0.3, 'layers': {'torso': {'rotation': 0.36, 'y': 2}, 'armUpperR': {'rotation': 0.95}, 'armLowerR': {'rotation': -0.4}, 'legUpperL': {'rotation': 0.4}, 'legUpperR': {'rotation': -0.5}}}, {'t': 1, 'layers': {'torso': {'rotation': 0.28}, 'armUpperR': {'rotation': 0.8}, 'armLowerR': {'rotation': -0.28}}}]
    if style == 'revenant':
        clips['guard_impact'][1]['layers']['shield'] = {'rotation': -0.55, 'x': 2}
        clips['guard_impact'][1]['layers']['armUpperL'] = {'rotation': -0.45}
    if style == 'acolyte':
        clips['melee_windup'] = deepcopy(clips['cast_windup'])
        clips['melee_impact'] = deepcopy(clips['cast_impact'])
        clips['melee_recovery'] = deepcopy(clips['cast_recovery'])
        clips['guard_windup'] = [{'t': 0, 'layers': {}}, {'t': 1, 'layers': {'armUpperL': {'rotation': -0.72}, 'armLowerL': {'rotation': 0.3}, 'armUpperR': {'rotation': -0.3}}}]
        clips['guard_impact'] = [{'t': 0, 'layers': {'armUpperL': {'rotation': -0.72}, 'armLowerL': {'rotation': 0.3}, 'armUpperR': {'rotation': -0.3}}}, {'t': 1, 'layers': {'armUpperL': {'rotation': -0.82}, 'armLowerL': {'rotation': 0.22}, 'armUpperR': {'rotation': -0.35}}}]
        clips['guard_recovery'] = [{'t': 0, 'layers': {'armUpperL': {'rotation': -0.82}, 'armLowerL': {'rotation': 0.22}, 'armUpperR': {'rotation': -0.35}}}, {'t': 1, 'layers': {'armUpperL': {'rotation': 0}, 'armLowerL': {'rotation': 0}, 'armUpperR': {'rotation': 0}}}]
        for clip in clips.values():
            for frame in clip:
                frame.get('layers', {}).pop('shield', None)
    return {'visualId': visual_id, 'name': name, 'family': family, 'worldHeight': height, 'designHeight': 112, 'origin': [48, 108], 'attackStyles': {}, 'clips': clips, 'layers': human_layers(style, heavy, mage)}


RIGS = [
    make_rat(), make_spider(),
    make_human('bronze_revenant', 'Bronze Revenant', 'revenant', 1.66, 'humanoid', heavy=False),
    make_human('bull_cult_enforcer', 'Bull-Cult Enforcer', 'enforcer', 1.82, 'heavyHumanoid', heavy=True),
    make_human('guardian_bronze_gatekeeper', 'Bronze Gatekeeper', 'gatekeeper', 1.98, 'heavyHumanoid', heavy=True, guardian=True),
    make_human('chthonic_acolyte', 'Chthonic Acolyte', 'acolyte', 1.68, 'caster', mage=True),
]
RIG_BY_ID = {rig['visualId']: rig for rig in RIGS}
RIG_BY_ID['bronze_revenant']['attackStyles'] = {'revenant_xiphos': 'melee', 'revenant_shield_bash': 'melee', 'revenant_shield_guard': 'guard'}
RIG_BY_ID['bull_cult_enforcer']['attackStyles'] = {'enforcer_heavy_cleave': 'melee', 'enforcer_charge': 'lunge', 'enforcer_roar': 'cast'}
RIG_BY_ID['guardian_bronze_gatekeeper']['attackStyles'] = {'gatekeeper_shield_bash': 'melee', 'gatekeeper_sweep': 'melee', 'gatekeeper_guard': 'guard'}
RIG_BY_ID['chthonic_acolyte']['attackStyles'] = {'acolyte_underworld_bolt': 'cast', 'acolyte_curse': 'cast', 'acolyte_votive_ward': 'guard'}


def attach_pose_preview(atlas, rig, phase, view='threeQuarter'):
    output = Image.new('RGBA', (112, 112), (0, 0, 0, 0))
    clips = rig['clips']
    clip_name = {'Idle': 'idle', 'Run': 'run', 'Windup': 'melee_windup', 'Impact': 'melee_impact', 'Hurt': 'hurt', 'Death': 'death'}[phase]
    clip = clips.get(clip_name, clips['idle'])
    t = {'Idle': 0.24, 'Run': 0.17, 'Windup': 0.68, 'Impact': 0.34, 'Hurt': 0.35, 'Death': 0.75}[phase]
    pose = sample_pose(clip, t)
    by_id = {layer['id']: layer for layer in rig['layers']}
    scale = min(1.0, 92 / rig['designHeight'])
    pixel_origin = (56, 105)
    memo = {}

    def point_for(layer_id):
        if layer_id in memo:
            return memo[layer_id]
        spec = by_id[layer_id]
        parent = spec['parent']
        if parent == 'root':
            attach = spec['attach']
            px, py = attach[0] - rig['origin'][0], attach[1] - rig['origin'][1]
            angle = 0.0
        else:
            px, py, angle = point_for(parent)
            attach = spec['attach']
            radians = angle
            dx, dy = attach[0], attach[1]
            px += dx * math.cos(radians) + dy * math.sin(radians)
            py += -dx * math.sin(radians) + dy * math.cos(radians)
        transform = pose.get(layer_id, {})
        px += transform.get('x', 0)
        py -= transform.get('y', 0)
        angle += transform.get('rotation', 0)
        memo[layer_id] = (px, py, angle)
        return memo[layer_id]

    for spec in sorted(rig['layers'], key=lambda entry: entry['order']):
        cell = spec.get('viewCells', {}).get(view, spec['cell'])
        art = atlas.crop((cell[0], cell[1], cell[0] + CELL, cell[1] + CELL))
        if spec['flipX']:
            art = art.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        rotated = art
        px, py, angle = point_for(spec['id'])
        rotated = art.rotate(math.degrees(angle), resample=Image.Resampling.NEAREST, center=tuple(spec['pivot']), expand=False)
        x = round(pixel_origin[0] + px * scale - spec['pivot'][0] * scale)
        y = round(pixel_origin[1] + py * scale - spec['pivot'][1] * scale)
        rotated = rotated.resize((round(CELL * scale), round(CELL * scale)), Image.Resampling.NEAREST)
        output.alpha_composite(rotated, (x, y))
    return output


def sample_pose(clip, time):
    frames = clip
    left = frames[0]
    right = frames[-1]
    for index in range(1, len(frames)):
        if time <= frames[index]['t']:
            left, right = frames[index - 1], frames[index]
            break
    span = max(0.0001, right['t'] - left['t'])
    t = max(0, min(1, (time - left['t']) / span))
    layers = set(left.get('layers', {})) | set(right.get('layers', {}))
    sampled = {}
    for layer_id in layers:
        a = left.get('layers', {}).get(layer_id, {})
        b = right.get('layers', {}).get(layer_id, {})
        sampled[layer_id] = {key: a.get(key, 0) + (b.get(key, 0) - a.get(key, 0)) * t for key in set(a) | set(b)}
    return sampled


def validate_manifest(manifest):
    ids = set()
    for rig in manifest['rigs'].values():
        if rig['visualId'] in ids:
            raise ValueError('Duplicate visual id: ' + rig['visualId'])
        ids.add(rig['visualId'])
        layer_ids = {entry['id'] for entry in rig['layers']}
        if len(layer_ids) != len(rig['layers']):
            raise ValueError('Duplicate layer id: ' + rig['visualId'])
        for entry in rig['layers']:
            x, y = entry['cell']
            if x < 0 or y < 0 or x + CELL > manifest['atlasWidth'] or y + CELL > manifest['atlasHeight']:
                raise ValueError('Atlas bounds exceeded: ' + rig['visualId'] + '/' + entry['id'])
            views = entry.get('viewCells')
            if rig['family'] in ('humanoid', 'heavyHumanoid', 'caster'):
                if not views or set(views) != {'front', 'threeQuarter', 'back'}:
                    raise ValueError('Humanoid layer needs front, three-quarter, and back atlas cells: ' + rig['visualId'] + '/' + entry['id'])
                if views['threeQuarter'] != entry['cell']:
                    raise ValueError('Three-quarter cell must match the default layer cell: ' + rig['visualId'] + '/' + entry['id'])
                for view, cell in views.items():
                    vx, vy = cell
                    if vx < 0 or vy < 0 or vx + CELL > manifest['atlasWidth'] or vy + CELL > manifest['atlasHeight']:
                        raise ValueError('Directional atlas bounds exceeded: ' + rig['visualId'] + '/' + entry['id'] + '/' + view)
            if not (0 <= entry['pivot'][0] < CELL and 0 <= entry['pivot'][1] < CELL):
                raise ValueError('Pivot outside source cell: ' + rig['visualId'] + '/' + entry['id'])
            if entry['parent'] != 'root' and entry['parent'] not in layer_ids:
                raise ValueError('Unknown parent: ' + rig['visualId'] + '/' + entry['id'])
        for clip_name, clip in rig['clips'].items():
            if len(clip) < 2 or clip[0]['t'] != 0 or clip[-1]['t'] != 1:
                raise ValueError('Clip needs endpoints: ' + rig['visualId'] + '/' + clip_name)
            if any(frame['t'] < 0 or frame['t'] > 1 for frame in clip):
                raise ValueError('Clip timing outside [0, 1]: ' + rig['visualId'] + '/' + clip_name)
            for frame in clip:
                if set(frame.get('layers', {})) - layer_ids:
                    raise ValueError('Clip references unknown layer: ' + rig['visualId'] + '/' + clip_name)
    return True


def generate_character_rig_assets(root):
    root = Path(root)
    atlas = Image.new('RGBA', ATLAS_SIZE, (0, 0, 0, 0))
    cell_lookup = {}
    cell_index = 0
    for rig in RIGS:
        style = rig['visualId']
        style_key = {'cretan_cave_rat': 'rat', 'arachne_brood': 'spider', 'bronze_revenant': 'revenant', 'bull_cult_enforcer': 'enforcer', 'guardian_bronze_gatekeeper': 'gatekeeper', 'chthonic_acolyte': 'acolyte'}[style]
        for entry in rig['layers']:
            directional = rig['family'] in ('humanoid', 'heavyHumanoid', 'caster')
            views = ('front', 'threeQuarter', 'back') if directional else ('threeQuarter',)
            view_cells = {}
            for view in views:
                key = style_key + '/' + entry['art'] + '/' + view
                if key not in cell_lookup:
                    if cell_index >= ATLAS_COLUMNS * ATLAS_ROWS:
                        raise ValueError('Character rig atlas capacity exceeded.')
                    column, row = cell_index % ATLAS_COLUMNS, cell_index // ATLAS_COLUMNS
                    x, y = column * CELL, row * CELL
                    image = authored_view_part(style_key, entry['art'], view)
                    if image.getbbox() is None:
                        raise ValueError('Empty authored art cell: ' + key)
                    if image.getbbox()[0] <= 0 or image.getbbox()[1] <= 0 or image.getbbox()[2] >= CELL or image.getbbox()[3] >= CELL:
                        raise ValueError('Art touches atlas cell boundary: ' + key)
                    atlas.alpha_composite(image, (x, y))
                    cell_lookup[key] = [x, y]
                    cell_index += 1
                view_cells[view] = cell_lookup[key]
            entry['cell'] = view_cells['threeQuarter']
            if directional:
                entry['viewCells'] = view_cells

    manifest = {
        'schemaVersion': 2,
        'atlasPath': '/assets/maze/characters/character_rigs.png',
        'atlasWidth': ATLAS_SIZE[0],
        'atlasHeight': ATLAS_SIZE[1],
        'cellSize': CELL,
        'contactSheetPath': 'docs/previews/R6E_CHARACTER_DIRECTION_SHEET.png',
        'rigs': {rig['visualId']: {**rig, 'fallbackSprite': f"/assets/maze/enemies/{rig['visualId']}.png"} for rig in RIGS},
    }
    validate_manifest(manifest)

    character_dir = root / 'characters'
    character_dir.mkdir(parents=True, exist_ok=True)
    fallback_dir = root / 'enemies'
    for rig in RIGS:
        preview = attach_pose_preview(atlas, rig, 'Idle')
        bounds = preview.getchannel('A').getbbox()
        if not bounds:
            raise ValueError('Pilot fallback has no visible alpha: ' + rig['visualId'])
        crop = preview.crop(bounds)
        scale = min(60 / crop.width, 60 / crop.height)
        size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
        crop = crop.resize(size, Image.Resampling.NEAREST)
        fallback = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        fallback_draw = ImageDraw.Draw(fallback)
        fallback_draw.ellipse((8, 57, 56, 62), fill=(20, 18, 17, 118))
        fallback.alpha_composite(crop, ((64 - size[0]) // 2, max(0, 60 - size[1])))
        fallback.save(fallback_dir / (rig['visualId'] + '.png'), optimize=True)
    atlas.save(character_dir / 'character_rigs.png', optimize=True)
    manifest_path = root.parent.parent.parent / 'data/generated/characterRigs.json'
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')

    preview_dir = root.parent.parent.parent / 'docs/previews'
    preview_dir.mkdir(parents=True, exist_ok=True)
    columns = ['Idle', 'Run', 'Windup', 'Impact', 'Hurt', 'Death']
    margin, label_w, label_h, cell_w, cell_h = 14, 112, 20, 154, 132
    sheet = Image.new('RGB', (margin + label_w + len(columns) * cell_w + margin, margin + label_h + len(RIGS) * cell_h + margin), (27, 25, 27))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for column, title in enumerate(columns):
        x = margin + label_w + column * cell_w
        draw.text((x + 5, margin), title, font=font, fill=(226, 190, 118))
    for row, rig in enumerate(RIGS):
        y = margin + label_h + row * cell_h
        draw.text((margin, y + 55), rig['name'], font=font, fill=(208, 202, 184))
        for column, title in enumerate(columns):
            x = margin + label_w + column * cell_w
            draw.rectangle((x, y + 18, x + cell_w - 5, y + cell_h - 4), fill=(34, 31, 32), outline=(76, 66, 55))
            preview = attach_pose_preview(atlas, rig, title)
            sheet.paste(preview, (x + 20, y + 23), preview)
    sheet.save(preview_dir / 'FPS_R3A_CHARACTER_CONTACT_SHEET.png', optimize=True)

    humanoids = [rig for rig in RIGS if rig['family'] in ('humanoid', 'heavyHumanoid', 'caster')]
    columns = [('front', 'idle'), ('front', 'impact'), ('threeQuarter', 'idle'), ('threeQuarter', 'impact'), ('back', 'idle'), ('back', 'impact')]
    margin, label_w, label_h, cell_w, cell_h = 14, 146, 20, 130, 130
    direction_sheet = Image.new('RGB', (margin + label_w + len(columns) * cell_w + margin, margin + label_h + len(humanoids) * cell_h + margin), (26, 27, 29))
    direction_draw = ImageDraw.Draw(direction_sheet)
    for column, (view, phase) in enumerate(columns):
        x = margin + label_w + column * cell_w
        direction_draw.text((x + 5, margin), view + ' ' + phase, font=font, fill=(224, 192, 126))
    for row, rig in enumerate(humanoids):
        y = margin + label_h + row * cell_h
        direction_draw.text((margin, y + 55), rig['name'], font=font, fill=(210, 204, 188))
        for column, (view, phase) in enumerate(columns):
            x = margin + label_w + column * cell_w
            direction_draw.rectangle((x, y + 2, x + cell_w - 4, y + cell_h - 3), fill=(37, 34, 34), outline=(94, 77, 59))
            preview = attach_pose_preview(atlas, rig, phase.capitalize(), view)
            bounds = preview.getchannel('A').getbbox()
            if not bounds or bounds[2] <= bounds[0] or bounds[3] <= bounds[1]:
                raise ValueError('Empty alpha render in direction sheet: ' + rig['visualId'] + '/' + view + '/' + phase)
            direction_sheet.paste(preview, (x + 8, y + 5), preview)
    direction_sheet.save(preview_dir / 'R6E_CHARACTER_DIRECTION_SHEET.png', optimize=True)
    print('Generated character rig atlas and contact sheets:', len(RIGS), 'pilot rigs,', cell_index, 'authored atlas cells')
