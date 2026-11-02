# Asset Pipeline

R2A's active renderer loads local pixel-art PNGs from `public/assets/maze/` through the existing `AssetManager`. Static art covers six labyrinth depth themes, all registered enemy silhouettes and five unique Guardians, first-person weapon hands and the Aspis, Greek props, and pixel VFX. Canvas-generated textures remain a synchronous fallback while local images load.

## Local art generation

```bash
python scripts/generate-maze-assets.py
```

This deterministic Pillow script has no network dependency and uses only local drawing primitives. It produces hard-edged PNGs at 32–96 px source dimensions. Three.js uses nearest-neighbor sampling, disables mipmaps for these sprites, and the WebGL canvas is upscaled with pixelated CSS rendering.

## Registry and ownership

- `data/assetRegistry.ts` maps stable gameplay visual IDs to local files.
- `AssetManager` caches each `CanvasTexture` per renderer and swaps its image source to the loaded local PNG.
- Enemy billboards use depth tests so walls occlude them; projectiles, particles, and loot use bounded pools or cached resources.
- `WorldGeometry` owns and disposes floor-specific geometry and materials. Shared textures remain owned by `AssetManager` until renderer disposal.
- The registered six biome keys remain save-stable implementation keys; their visible themes are authored as Labyrinth depth zones.

## Adding assets

Keep a 64 px character source sheet unless the sprite is a tiny VFX glyph or first-person weapon sheet. Use transparent backgrounds for billboards and props. Add stable visual IDs to the registry and generator together, then extend `tests/assetRegistry.test.ts` so every local path and registered enemy visual is checked.
