#!/usr/bin/env python3
"""Generate deterministic, locally-authored Greek labyrinth wall textures."""
from argparse import ArgumentParser
from hashlib import sha256
from pathlib import Path
from random import Random

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / 'public/assets/maze/tiles'
WIDTH = 128
HEIGHT = 320
COURSE_HEIGHT = 64
VARIANT_COUNT = 3

THEMES = {
    'palace_foundations': {
        'grout': '#352d28', 'stone': ['#796950', '#8c795e', '#6e604d', '#a18b6a'],
        'light': '#c4ad84', 'edge': '#554838', 'deep': '#292522', 'accent': '#a34e3b',
        'accent_light': '#d28d62', 'moss': '#59746a', 'motif': 'meander',
    },
    'serpent_galleries': {
        'grout': '#26312b', 'stone': ['#4e5b48', '#68735a', '#414e40', '#78806a'],
        'light': '#a2a27b', 'edge': '#364238', 'deep': '#1c2420', 'accent': '#78916a',
        'accent_light': '#a6b584', 'moss': '#668461', 'motif': 'moss',
    },
    'cyclopean_halls': {
        'grout': '#2c2b29', 'stone': ['#5c5850', '#746d62', '#4d4b46', '#82796b'],
        'light': '#b0a28b', 'edge': '#3f3d39', 'deep': '#222220', 'accent': '#a27c52',
        'accent_light': '#c2a276', 'moss': '#70766c', 'motif': 'chisel',
    },
    'forgotten_cisterns': {
        'grout': '#273433', 'stone': ['#4b5d59', '#637974', '#40514e', '#738982'],
        'light': '#a9b9ad', 'edge': '#344441', 'deep': '#1d2827', 'accent': '#558b92',
        'accent_light': '#9cc2c2', 'moss': '#5f8b83', 'motif': 'mineral',
    },
    'chthonic_depths': {
        'grout': '#241f20', 'stone': ['#493b37', '#604b42', '#3d3332', '#6c5144'],
        'light': '#9e7c64', 'edge': '#352b2a', 'deep': '#171719', 'accent': '#a6473e',
        'accent_light': '#d0784e', 'moss': '#66514a', 'motif': 'ember',
    },
    'heart_of_the_maze': {
        'grout': '#211e20', 'stone': ['#393437', '#4b4344', '#302c30', '#55494a'],
        'light': '#877977', 'edge': '#2a2529', 'deep': '#131315', 'accent': '#a97b43',
        'accent_light': '#d1ab68', 'moss': '#665246', 'motif': 'gold_vein',
    },
}


def rgb(value):
    return tuple(int(value[index:index + 2], 16) for index in (1, 3, 5))


def shade(color, amount):
    return tuple(max(0, min(255, channel + amount)) for channel in color)


def draw_motif(draw, theme, bounds, rng):
    left, top, right, bottom = bounds
    center_x = (left + right) // 2
    center_y = (top + bottom) // 2
    palette = THEME_PALETTES[theme]
    motif = palette['motif']
    accent = palette['accent']
    light = palette['accent_light']

    if motif == 'meander':
        x = center_x - 9
        y = center_y - 5
        draw.line([(x, y), (x + 12, y), (x + 12, y + 8), (x + 4, y + 8), (x + 4, y + 3), (x + 8, y + 3)], fill=accent, width=2)
        draw.point((x + 2, y + 2), fill=light)
    elif motif == 'moss':
        for offset in (-4, 1, 5):
            draw.line([(center_x + offset, center_y - 8), (center_x + offset - 2, center_y - 2), (center_x + offset + 2, center_y + 2), (center_x + offset, center_y + 8)], fill=shade(rgb(accent), rng.choice((-16, 0, 12))), width=2)
    elif motif == 'chisel':
        draw.line([(center_x - 8, center_y + 5), (center_x - 2, center_y - 5), (center_x + 2, center_y + 1), (center_x + 8, center_y - 7)], fill=accent, width=2)
        draw.line([(center_x - 7, center_y + 8), (center_x + 7, center_y + 8)], fill=light, width=1)
    elif motif == 'mineral':
        draw.line([(center_x - 8, center_y - 8), (center_x - 2, center_y - 1), (center_x - 5, center_y + 3), (center_x + 1, center_y + 8)], fill=accent, width=2)
        draw.line([(center_x + 3, center_y - 7), (center_x + 7, center_y - 2)], fill=light, width=1)
    elif motif == 'ember':
        draw.line([(center_x - 7, center_y - 7), (center_x - 2, center_y - 1), (center_x - 4, center_y + 5), (center_x + 4, center_y + 8)], fill=accent, width=2)
        draw.point((center_x + 6, center_y + 7), fill=light)
    else:
        draw.line([(center_x - 9, center_y + 5), (center_x - 3, center_y + 1), (center_x + 2, center_y + 3), (center_x + 8, center_y - 6)], fill=accent, width=2)
        draw.point((center_x + 8, center_y - 6), fill=light)


def create_wall_texture(theme, variant):
    seed = int.from_bytes(sha256(f'{theme}:{variant}'.encode()).digest()[:8], 'big')
    rng = Random(seed)
    palette = THEME_PALETTES[theme]
    grout = rgb(palette['grout'])
    edge = rgb(palette['edge'])
    deep = rgb(palette['deep'])
    light = rgb(palette['light'])
    stones = [rgb(color) for color in palette['stone']]
    accent = rgb(palette['accent'])

    image = Image.new('RGBA', (WIDTH, HEIGHT), (*grout, 255))
    draw = ImageDraw.Draw(image)

    # Fine stone grain sits below the blockwork and stays sparse at first-person scale.
    for _ in range(360):
        x = rng.randrange(WIDTH)
        y = rng.randrange(HEIGHT)
        color = rng.choice((edge, deep, stones[0]))
        size = rng.choice((1, 2, 3))
        draw.rectangle((x, y, min(WIDTH - 1, x + size), min(HEIGHT - 1, y + size)), fill=(*shade(color, rng.choice((-8, 0, 8))), 255))

    for course in range(HEIGHT // COURSE_HEIGHT):
        top = course * COURSE_HEIGHT
        stagger = rng.randint(-24, 10) if (course + variant) % 2 else rng.randint(-10, 20)
        x = stagger
        while x < WIDTH:
            block_width = rng.choice((42, 46, 52, 58, 64, 70))
            left = x + 3
            right = x + block_width - 3
            block_top = top + 4
            block_bottom = min(HEIGHT - 3, top + COURSE_HEIGHT - 4)
            stone = rng.choice(stones)
            cut = rng.choice((2, 3, 4))
            polygon = [
                (left + cut, block_top), (right - cut, block_top),
                (right, block_top + cut), (right - 1, block_bottom - cut),
                (right - cut - 2, block_bottom), (left + cut, block_bottom - 1),
                (left, block_bottom - cut), (left + 1, block_top + cut),
            ]
            draw.polygon(polygon, fill=(*stone, 255))

            # Three-pixel bevels give each slab a readable silhouette under torchlight.
            draw.line([(left + cut, block_top + 1), (right - cut, block_top + 1)], fill=(*shade(light, -8), 255), width=2)
            draw.line([(left + 1, block_top + cut), (left + cut, block_top + 1)], fill=(*shade(light, -20), 255), width=2)
            draw.line([(left + 2, block_bottom - cut), (right - cut - 2, block_bottom - 1)], fill=(*shade(edge, -6), 255), width=3)
            draw.line([(right - 1, block_top + cut), (right - 2, block_bottom - cut)], fill=(*shade(deep, 8), 255), width=3)

            for _ in range(rng.randint(5, 10)):
                fleck_x = rng.randint(left + 5, max(left + 5, right - 6))
                fleck_y = rng.randint(block_top + 5, max(block_top + 5, block_bottom - 6))
                fleck_size = rng.choice((1, 2, 3))
                fleck_color = rng.choice((light, shade(stone, 18), shade(stone, -17), edge))
                draw.rectangle((fleck_x, fleck_y, fleck_x + fleck_size, fleck_y + rng.choice((1, 1, 2))), fill=(*fleck_color, 255))

            if rng.random() < 0.32:
                crack_x = rng.randint(left + 10, max(left + 10, right - 10))
                crack_y = rng.randint(block_top + 9, max(block_top + 9, block_bottom - 12))
                draw.line([(crack_x, crack_y), (crack_x + 3, crack_y + 5), (crack_x + 1, crack_y + 9)], fill=(*shade(edge, -5), 255), width=1)
                draw.point((crack_x - 1, crack_y + 1), fill=(*shade(light, -18), 255))

            if rng.random() < 0.20:
                draw_motif(draw, theme, (left + 5, block_top + 4, right - 5, block_bottom - 4), rng)

            x += block_width

    # Biome-specific environmental traces add identity without turning the wall into a signboard.
    if palette['motif'] == 'moss':
        for x in (17 + variant * 7, 91 - variant * 5):
            for y in range(42, HEIGHT - 18, 73):
                draw.ellipse((x, y, x + 4, y + 8), fill=(*shade(rgb(palette['moss']), rng.choice((-12, 0, 10))), 255))
    elif palette['motif'] == 'mineral':
        for _ in range(9):
            x = rng.randrange(5, WIDTH - 8)
            y = rng.randrange(8, HEIGHT - 8)
            draw.line([(x, y), (x + 3, y + 5), (x + 2, y + 10)], fill=(*palette_color(palette['accent_light']), 255), width=1)
    elif palette['motif'] == 'ember':
        for _ in range(5):
            x = rng.randrange(6, WIDTH - 7)
            y = rng.randrange(8, HEIGHT - 8)
            draw.line([(x, y), (x + 4, y + 5), (x + 2, y + 10)], fill=(*shade(accent, 12), 255), width=1)

    return image


def palette_color(value):
    return rgb(value)


def save_preview(preview_path):
    tile_width = WIDTH
    label_height = 20
    sheet = Image.new('RGBA', (tile_width * len(THEMES), (HEIGHT + label_height) * VARIANT_COUNT), (18, 17, 19, 255))
    draw = ImageDraw.Draw(sheet)
    for row, variant in enumerate(range(VARIANT_COUNT)):
        for column, theme in enumerate(THEMES):
            tile = create_wall_texture(theme, variant)
            x = column * tile_width
            y = row * (HEIGHT + label_height)
            draw.text((x + 4, y + 5), f'{theme.replace("_", " ")} · {variant + 1}', fill=(231, 215, 187, 255))
            sheet.alpha_composite(tile, (x, y + label_height))
    sheet.save(preview_path, optimize=True)


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--preview', type=Path, help='Also write a contact sheet to this path.')
    args = parser.parse_args()

    ASSET_ROOT.mkdir(parents=True, exist_ok=True)
    for theme in THEMES:
        for variant in range(VARIANT_COUNT):
            filename = f'{theme}_wall.png' if variant == 0 else f'{theme}_wall_variant_{variant + 1}.png'
            create_wall_texture(theme, variant).save(ASSET_ROOT / filename, optimize=True)
    if args.preview:
        args.preview.parent.mkdir(parents=True, exist_ok=True)
        save_preview(args.preview)
    print(f'Generated {len(THEMES) * VARIANT_COUNT} wall textures at {ASSET_ROOT}')


THEME_PALETTES = THEMES

if __name__ == '__main__':
    main()
