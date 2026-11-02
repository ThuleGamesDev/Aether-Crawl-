# Maze of the Minotaur Art Direction

## Mythic Greek Dark Fantasy Pixel Art

The Labyrinth is an ancient Cretan structure interpreted through a deliberate fantasy blend of Minoan palace ruins, Greek myth, later chthonic cult traditions, and heroic-age equipment. These references are intentionally not presented as a historically exact reconstruction.

### Visual rules

- Use crisp nearest-neighbor pixel edges at a configurable low internal render resolution.
- Keep silhouettes readable at first-person encounter distance, especially for the rat, bronze dead, serpent guardians, cyclopean brutes, and the later Minotaur.
- Build palettes from weathered limestone, charcoal shadow, bronze, verdigris, oxblood, and limited oil-flame gold.
- Use meander borders, bull reliefs, fresco fragments, columns, amphorae, votive altars, oil bowls, and cistern reflections as repeated cultural markers.
- Use contrast to keep pathways, telegraphs, threats, and loot legible in dim spaces.
- Keep interface text and icons sharp and high-resolution independently of the pixelated 3D render.
- Favor local static pixel-art assets; procedural pixel textures are a fallback and a supporting material layer, not the full art direction.

### Avoid

Generic medieval castles, Nordic runes, Roman legionary imagery, standard fantasy orcs, softened texture filtering, and mixed high-resolution painted portraits beside coarse pixel sprites as a permanent style.

The source sprite and texture sheets are generated locally by `scripts/generate-maze-assets.py`; the running game only loads static files and does not generate art or call an image service.

FPS-R3A adds a deterministic 2D rig atlas for six selected enemy pilots. Its locally authored pixel parts use anatomy-specific pivots and palettes; see [the R3A rig and animation notes](FPS_R3A_CHARACTER_RIGS.md) and [contact sheet](previews/FPS_R3A_CHARACTER_CONTACT_SHEET.png). Other enemies retain their local static sprite fallback until they receive deliberately authored parts and poses.
