# Aether Crawl Art Direction

## Visual identity

Aether Crawl uses a dark fantasy, first-person dungeon-crawler look with the chunky silhouettes and textured surfaces of early 1990s RPGs. The target is a lightly stylized pixel-painted image: readable at the game's 800 × 450 render resolution, with hand-painted wear, hard-edged clusters, and restrained glow.

The references are genre touchstones only. Do not reproduce a recognizable character, level, interface, or asset from another game.

## Shared rules

- Use a consistent front or slight 3/4-front view for creatures, handheld objects, and props.
- Keep the light source above and left of the subject.
- Separate materials clearly: rough stone, damp soil, bone, timber, iron, ice, gold, and volcanic glass should not share the same surface treatment.
- Favor strong silhouettes and high-value contrast. Important forms must remain readable when reduced on mobile screens.
- Use restrained ambient darkness; magic and fire provide the strongest local color.
- Avoid text, UI, health bars, logos, watermarks, and painted-in backgrounds on cutout sprites.
- Keep environmental surfaces opaque and tile-sized. Keep characters, weapons, lights, props, and effects on transparent backgrounds.

## Biome palettes

| Biome | Materials and palette | Light accent |
| --- | --- | --- |
| Stone Dungeon | Charcoal, cold slate, worn oak, aged iron | Amber |
| Moss | Wet stone, roots, dark soil, moss greens | Green |
| Catacombs | Brown-black limestone, bone, faded crimson cloth | Candle red |
| Obsidian | Black basalt, sharp glass, volcanic cracks | Violet and ember |
| Frost | Ice-blue stone, snow, dark navy shadow | Cyan |
| Gilded | Ivory marble, tarnished gold, burgundy details | Warm gold |

Each biome needs its own surface structure and material cues. A palette swap on the same wall is not sufficient.

## Environment guidelines

- Wall tiles should have large forms and visible seams that survive raycast scaling.
- Floor tiles should read from above and avoid a strong horizon or perspective scene.
- Ceiling tiles should have deeper values than the wall and floor to preserve the first-person light falloff.
- Doors and exits should face the player and remain visually distinct from ordinary walls.
- Lights should have a compact silhouette and a flame color tied to the biome.
- Props should sit clearly against the rendered world and retain transparent edges.

## Enemy guidelines

- Give each enemy a distinct outline and one memorable shape or material cue.
- Use a consistent front or slight 3/4-front pose and ground line.
- Keep full silhouettes inside the sprite frame. Small enemies may use less of the frame; bosses should occupy more of it and carry stronger shape language.
- Do not distinguish enemy types with color alone.
- Do not include text, floor planes, interface elements, or built-in HP bars.

## Weapon and hand guidelines

- First-person weapons use a shared lower-screen camera angle, glove, and forearm treatment.
- Keep the weapon pointing upward into the play area with enough transparent margin for movement bob.
- Preserve a common hand position across empty hand, sword, dagger, axe, mace, staff, bow, and shield sprites.
- Keep the offhand shield and dominant-hand weapon readable as separate forms.

## VFX guidelines

- VFX are short, high-contrast accents that do not obscure the target or combat UI.
- Use transparent backgrounds and a compact center of mass.
- Keep each effect distinct by shape as well as color: slashes, starbursts, flames, clouds, sigils, wards, stun stars, and ice shards should read differently.
- Effects should fade through canvas opacity while the underlying art remains a static PNG.
