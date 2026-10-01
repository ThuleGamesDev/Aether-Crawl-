# Static Asset Pipeline

## Runtime rule

Every gameplay image is a static repository file under `public/assets/`. React and Canvas do not call an image-generation API, create image data URLs, or synthesize replacement textures. Required floor assets are preloaded through `services/assetLoader.ts` and cached as `HTMLImageElement` instances. Rendering reuses those instances.

The title screen preloads the first floor's environment, possible enemies, player hands/weapons, and combat effects. A saved floor or new biome preloads its required environment and possible enemy sprites before it is shown. Already loaded assets are reused from the shared cache, so the full 25 MB registry is not downloaded before the first menu. A failed image load stops at a clear loading error; a missing image does not silently fall back to generic production art.

## Directory layout

```text
public/assets/
  environments/
    dungeon/       wall, floor, ceiling, door, exit
    moss/          wall, floor, ceiling, door, exit
    catacombs/     wall, floor, ceiling, door, exit
    obsidian/      wall, floor, ceiling, door, exit
    frost/         wall, floor, ceiling, door, exit
    gilded/        wall, floor, ceiling, door, exit
    lights/        one wall-light sprite per biome
  enemies/         one sprite per normal enemy and boss
  hands/           empty, sword, dagger, axe, mace, staff, bow, shield
  props/            common props and biome-specific additions
    biomes/
  vfx/              melee-hit, critical-hit, fire, poison, heal, magic, shield, stun, frost
```

## File and image rules

- Use lowercase kebab-case filenames with `.png` extensions.
- Environment wall, floor, ceiling, door, and exit files are opaque square tiles. Current crops are approximately 404 × 404 pixels.
- Enemy and boss sprites, hands/weapons, lights, props, and VFX use transparent PNGs with real alpha.
- Keep cutout sprites centered and fully inside their image bounds. Leave visual padding so canvas scaling and movement bob do not clip the silhouette.
- Do not add Base64 strings, inline raster data, huge inline SVGs, CSS-shaped VFX, or generated fallback textures to the runtime.
- Generated source sheets are cropped into individual named files before integration; the game reads only the finished files.

## Registry

`data/assetRegistry.ts` is the only place where gameplay IDs map to public asset paths.

- `biomeVisuals` maps a `BiomeId` to its environment surfaces, light, common props, themed props, and ambient tint.
- `enemyVisuals` maps stable enemy `visualId` values to sprite files and render scale.
- `weaponVisuals`, `shieldVisual`, `propVisuals`, and `vfxVisuals` map their gameplay/render keys to static PNG paths.
- `getLevelAssetPaths(level)` exposes the static files needed for a level; `collectAssetPaths()` returns the full unique list for completeness tests.

Gameplay definitions refer to stable IDs, not file paths. Enemy stats and boss selection live in `data/enemies.ts`; sprite scale and paths live in `data/assetRegistry.ts`.

## Add and verify assets

1. Add the final PNG to the matching directory with a stable filename.
2. Add or update its registry entry in `data/assetRegistry.ts`.
3. For enemies, add gameplay data in `data/enemies.ts` and refer to the registry key with `visualId`.
4. For biomes, populate wall, floor, ceiling, door, exit, light, and both themed prop slots.
5. Run `npm test`, `npm run typecheck`, and `npm run build`.

`tests/assetRegistry.test.ts` checks that every gameplay enemy has a registered image, every active biome has a complete environment and prop set, and every registered path exists in `public/assets/`.

## Saves

Save files contain gameplay data only. They do not contain static asset paths, data URLs, image bytes, or cached visual objects. Weapon visual types are derived at runtime; legacy saves are migrated during load.
