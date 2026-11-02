#!/usr/bin/env python3
"""Build the deterministic local pixel atlas and compact R3B effect gallery."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw, ImageFont

PROJECT_ROOT = Path(__file__).resolve().parents[1]
CELL = 32
COLUMNS = 6
FRAMES = [
    'bronze_slash', 'spear_thrust', 'shield_impact', 'metal_sparks', 'blood_hit', 'poison_splash',
    'venom_droplets', 'web_impact', 'web_threads', 'fire_burst', 'flame_core', 'fire_embers',
    'stone_shockwave', 'stone_dust', 'stone_chips', 'oracle_spark', 'chthonic_bolt', 'soul_ash',
    'boss_death_burst', 'laurel_light', 'water_splash', 'bronze_impact', 'guardian_sigil',
]

INK = '#20191b'
IVORY = '#fff0c4'
GOLD = '#e1b66a'
BRONZE = '#a96f42'
RUST = '#853b39'
RED = '#c64f4e'
CORAL = '#ef9270'
VENOM = '#a8c75a'
VENOM_LIGHT = '#d4e687'
WEB = '#e2e7c9'
FIRE = '#e65b36'
EMBER = '#ffb950'
STONE = '#b18b66'
STONE_LIGHT = '#e0c597'
CYAN = '#8edce0'
BLUE = '#58a9b4'
PURPLE = '#8f5b7c'
PINK = '#d58da0'


def make_frame(name: str) -> Image.Image:
    image = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    if name == 'bronze_slash':
        draw.arc((3, 3, 28, 28), 205, 325, fill=RUST, width=6)
        draw.arc((4, 4, 27, 27), 205, 325, fill=GOLD, width=3)
        draw.arc((7, 7, 24, 24), 210, 320, fill=IVORY, width=1)
        draw.rectangle((4, 18, 7, 21), fill=IVORY)
        draw.rectangle((25, 8, 28, 11), fill=GOLD)
    elif name == 'spear_thrust':
        draw.rectangle((2, 15, 24, 17), fill=BRONZE)
        draw.rectangle((5, 13, 21, 14), fill=GOLD)
        draw.polygon([(21, 16), (27, 11), (29, 16), (27, 21)], fill=IVORY)
        draw.rectangle((4, 18, 17, 19), fill=RUST)
        draw.rectangle((0, 14, 3, 18), fill=IVORY)
    elif name == 'shield_impact':
        for box, color, width in [((4, 4, 27, 27), BRONZE, 2), ((8, 8, 23, 23), IVORY, 2)]:
            draw.ellipse(box, outline=color, width=width)
        for x, y in [(15, 1), (26, 7), (29, 16), (24, 27), (14, 29), (4, 24), (1, 14), (7, 5)]:
            draw.rectangle((x, y, x + 2, y + 2), fill=GOLD)
    elif name == 'metal_sparks':
        for p, q, color, width in [
            ((16, 14), (16, 2), IVORY, 2), ((18, 14), (27, 5), GOLD, 2),
            ((19, 16), (31, 16), IVORY, 2), ((18, 18), (27, 27), GOLD, 2),
            ((14, 18), (8, 28), IVORY, 2), ((13, 15), (3, 10), GOLD, 2),
        ]:
            draw.line((p, q), fill=color, width=width)
        draw.rectangle((13, 13, 19, 19), fill=BRONZE)
        draw.rectangle((15, 14, 17, 17), fill=IVORY)
    elif name == 'blood_hit':
        draw.ellipse((10, 9, 22, 23), fill=RUST)
        draw.ellipse((12, 10, 20, 20), fill=RED)
        draw.rectangle((14, 12, 18, 17), fill=CORAL)
        for box in [(3, 6, 6, 9), (26, 5, 28, 8), (5, 23, 8, 26), (24, 24, 28, 27), (15, 2, 17, 5)]:
            draw.ellipse(box, fill=RED if box[0] % 2 else RUST)
    elif name == 'poison_splash':
        draw.polygon([(14, 3), (19, 11), (17, 14), (26, 14), (21, 18), (23, 25), (16, 21), (10, 27), (11, 19), (5, 16), (12, 14)], fill=VENOM)
        draw.rectangle((14, 8, 17, 20), fill=VENOM_LIGHT)
        draw.rectangle((9, 14, 23, 17), fill='#c6dc73')
    elif name == 'venom_droplets':
        for box, color in [((4, 5, 10, 11), VENOM), ((21, 4, 27, 10), VENOM_LIGHT), ((12, 11, 20, 19), VENOM), ((3, 22, 9, 28), VENOM_LIGHT), ((23, 22, 29, 28), VENOM)]:
            draw.ellipse(box, fill=color)
        draw.rectangle((15, 7, 17, 11), fill=IVORY)
    elif name == 'web_impact':
        for end in [(16, 2), (27, 5), (30, 16), (26, 27), (16, 30), (5, 26), (2, 16), (6, 5)]:
            draw.line((16, 16, *end), fill=WEB, width=1)
        draw.ellipse((5, 5, 27, 27), outline=WEB, width=1)
        draw.ellipse((10, 10, 22, 22), outline='#aab99b', width=1)
        draw.rectangle((14, 14, 17, 17), fill=IVORY)
    elif name == 'web_threads':
        draw.line((3, 4, 28, 27), fill=WEB, width=2)
        draw.line((28, 4, 3, 27), fill=WEB, width=2)
        draw.line((16, 1, 15, 30), fill='#bac8ad', width=1)
        draw.line((1, 16, 30, 15), fill='#bac8ad', width=1)
        draw.rectangle((13, 13, 18, 18), fill=IVORY)
    elif name == 'fire_burst':
        draw.polygon([(16, 1), (23, 11), (21, 18), (27, 14), (25, 25), (18, 30), (7, 27), (5, 19), (10, 13), (11, 20), (14, 14)], fill=RUST)
        draw.polygon([(16, 5), (20, 15), (17, 22), (23, 19), (21, 26), (14, 27), (9, 23), (13, 17), (13, 21)], fill=FIRE)
        draw.polygon([(16, 14), (19, 22), (16, 26), (12, 24)], fill=IVORY)
    elif name == 'flame_core':
        draw.polygon([(16, 4), (22, 13), (20, 22), (16, 27), (10, 22), (11, 14)], fill=EMBER)
        draw.polygon([(16, 10), (19, 18), (16, 24), (13, 19)], fill=IVORY)
        draw.rectangle((15, 7, 17, 12), fill='#fff9dd')
    elif name == 'fire_embers':
        for x, y, size in [(5, 7, 3), (22, 4, 2), (25, 16, 3), (6, 22, 2), (17, 26, 3), (13, 11, 2)]:
            draw.rectangle((x, y, x + size, y + size + 1), fill=EMBER if y % 2 else IVORY)
    elif name == 'stone_shockwave':
        draw.ellipse((4, 7, 27, 25), outline=STONE, width=3)
        draw.arc((7, 9, 24, 22), 190, 340, fill=STONE_LIGHT, width=2)
        for x, y in [(13, 3), (25, 13), (5, 17), (18, 26)]:
            draw.rectangle((x, y, x + 3, y + 2), fill=STONE_LIGHT)
    elif name == 'stone_dust':
        for box in [(4, 17, 12, 23), (9, 12, 19, 22), (17, 15, 28, 22), (6, 21, 24, 26)]:
            draw.rectangle(box, fill=STONE if box[0] % 2 else '#8e735b')
        for x, y in [(9, 13), (18, 11), (24, 15)]:
            draw.rectangle((x, y, x + 2, y + 2), fill=STONE_LIGHT)
    elif name == 'stone_chips':
        draw.polygon([(5, 23), (9, 9), (14, 22)], fill=STONE)
        draw.polygon([(14, 26), (18, 7), (23, 24)], fill=STONE_LIGHT)
        draw.polygon([(23, 21), (27, 13), (29, 23)], fill='#907054')
        draw.rectangle((3, 26, 8, 28), fill=STONE_LIGHT)
    elif name == 'oracle_spark':
        draw.line((16, 2, 11, 12, 17, 14, 10, 25, 16, 21, 20, 29), fill=BLUE, width=5)
        draw.line((16, 2, 11, 12, 17, 14, 10, 25, 16, 21, 20, 29), fill=CYAN, width=2)
        draw.rectangle((21, 7, 25, 10), fill=IVORY)
    elif name == 'chthonic_bolt':
        draw.line((17, 1, 10, 10, 18, 14, 12, 22, 19, 20, 15, 30), fill='#4d3146', width=7)
        draw.line((17, 1, 10, 10, 18, 14, 12, 22, 19, 20, 15, 30), fill=PURPLE, width=3)
        draw.rectangle((13, 8, 16, 11), fill=PINK)
    elif name == 'soul_ash':
        for box, color in [((8, 20, 12, 25), PURPLE), ((16, 10, 20, 17), PINK), ((21, 21, 26, 26), '#70485f')]:
            draw.rectangle(box, fill=color)
        draw.line((10, 19, 12, 13, 14, 10), fill=PINK, width=2)
        draw.line((21, 19, 20, 14, 22, 11), fill=PURPLE, width=2)
        draw.rectangle((14, 24, 17, 27), fill=IVORY)
    elif name == 'boss_death_burst':
        draw.ellipse((5, 5, 26, 26), fill=RUST, outline=GOLD, width=2)
        draw.ellipse((10, 9, 21, 22), fill=INK)
        draw.rectangle((12, 12, 14, 14), fill=IVORY)
        draw.rectangle((18, 12, 20, 14), fill=IVORY)
        draw.rectangle((14, 18, 18, 19), fill=GOLD)
        for box in [(15, 0, 17, 4), (27, 15, 31, 17), (1, 15, 5, 17), (15, 27, 17, 31)]:
            draw.rectangle(box, fill=IVORY)
    elif name == 'laurel_light':
        draw.ellipse((8, 8, 23, 23), outline=GOLD, width=2)
        draw.line((12, 22, 16, 11, 20, 22), fill='#a7cb91', width=2)
        draw.rectangle((15, 13, 17, 19), fill=IVORY)
        for x, y in [(15, 3), (4, 15), (26, 15), (15, 27)]:
            draw.rectangle((x, y, x + 2, y + 2), fill='#d8ebb0')
    elif name == 'water_splash':
        draw.arc((4, 8, 28, 27), 195, 345, fill=BLUE, width=3)
        draw.arc((8, 12, 24, 23), 200, 340, fill=CYAN, width=2)
        for x, y, size in [(5, 7, 3), (12, 2, 2), (24, 5, 3), (27, 12, 2), (8, 23, 2)]:
            draw.ellipse((x, y, x + size, y + size + 1), fill=CYAN)
    elif name == 'bronze_impact':
        draw.polygon([(16, 3), (22, 10), (28, 16), (21, 22), (16, 29), (10, 22), (3, 16), (10, 10)], fill=BRONZE)
        draw.polygon([(16, 7), (20, 12), (24, 16), (20, 20), (16, 25), (12, 20), (8, 16), (12, 12)], fill=GOLD)
        draw.rectangle((14, 13, 18, 18), fill=IVORY)
    elif name == 'guardian_sigil':
        draw.ellipse((3, 3, 28, 28), outline=RED, width=2)
        draw.ellipse((8, 8, 23, 23), outline=CORAL, width=1)
        draw.rectangle((14, 4, 17, 27), fill=RED)
        draw.rectangle((4, 14, 27, 17), fill=RED)
        draw.rectangle((11, 11, 20, 20), outline=IVORY, width=1)
        draw.rectangle((14, 14, 17, 17), fill=IVORY)
    return image


def generate_mythic_vfx_atlas(project_root: Path = PROJECT_ROOT) -> None:
    asset_root = project_root / 'public/assets/maze/vfx'
    manifest_path = project_root / 'data/generated/mythicVfxAtlas.json'
    preview_path = project_root / 'docs/previews/FPS_R3B_MYTHIC_VFX_GALLERY.png'
    asset_root.mkdir(parents=True, exist_ok=True)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    preview_path.parent.mkdir(parents=True, exist_ok=True)

    atlas = Image.new('RGBA', (COLUMNS * CELL, ((len(FRAMES) + COLUMNS - 1) // COLUMNS) * CELL), (0, 0, 0, 0))
    entries = {}
    for index, frame_id in enumerate(FRAMES):
        x, y = (index % COLUMNS) * CELL, (index // COLUMNS) * CELL
        atlas.alpha_composite(make_frame(frame_id), (x, y))
        entries[frame_id] = {'x': x, 'y': y, 'width': CELL, 'height': CELL}
    atlas_path = asset_root / 'mythic_vfx_atlas.png'
    atlas.save(atlas_path, optimize=True)

    manifest = {
        'schemaVersion': 1,
        'atlasPath': '/assets/maze/vfx/mythic_vfx_atlas.png',
        'previewPath': '/previews/FPS_R3B_MYTHIC_VFX_GALLERY.png',
        'width': atlas.width,
        'height': atlas.height,
        'cellSize': CELL,
        'columns': COLUMNS,
        'frames': entries,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')

    card_width, card_height = 152, 144
    title_height = 58
    gallery = Image.new('RGB', (COLUMNS * card_width, title_height + ((len(FRAMES) + COLUMNS - 1) // COLUMNS) * card_height), '#17181d')
    gd = ImageDraw.Draw(gallery)
    font = ImageFont.load_default()
    gd.text((22, 13), 'MAZE OF THE MINOTAUR  |  R3B MYTHIC VFX', fill='#ead7ae', font=font)
    gd.text((22, 32), 'Locally authored pixel atlas | static frames | world-space emitters', fill='#a6aaa7', font=font)
    for index, frame_id in enumerate(FRAMES):
        column, row = index % COLUMNS, index // COLUMNS
        left, top = column * card_width + 7, title_height + row * card_height + 6
        gd.rounded_rectangle((left, top, left + card_width - 14, top + card_height - 10), radius=4, fill='#22242a', outline='#41444a')
        sprite = make_frame(frame_id).resize((96, 96), Image.Resampling.NEAREST)
        gallery.paste(sprite, (left + (card_width - 14 - 96) // 2, top + 6), sprite)
        label = frame_id.replace('_', ' ').upper()
        gd.text((left + 7, top + 108), label, fill='#e7d9b7', font=font)
    gallery.save(preview_path, optimize=True)


if __name__ == '__main__':
    generate_mythic_vfx_atlas()
