# R6F4 Palace Foundations Art and Readability Pass

## Scope

This pass improves the real Palace Foundations materials without changing dungeon layout rules, enemy behavior, equipment, combat balance, class data, or save data.

- Re-authored the three 128×320 Palace wall maps as weathered ashlar, an ochre fresco bay, and a carved labyrinth relief with pilasters. Placement remains coordinate-deterministic and groups material families in 2×2 wall-cell patches; the authored distribution is 85% ashlar, 12% fresco, and 3% relief.
- Replaced the Palace floor with a deterministic 256×256 patch of varied, beveled limestone slabs, restrained wear marks, and rare chipped/cracked plates. The ceiling now uses subdued coffer panels at the same authored scale.
- Fixed Palace floor and ceiling sampling: their textures now use `RepeatWrapping` and repeat once per four world units, matching the 4×4-cell art patch. Previously the repeat values were set while the cloned textures still used `ClampToEdgeWrapping`, stretching the small source image over the entire room.
- Made `generate-maze-assets.py` invoke the wall generator, so the single documented asset command produces the checked-in Palace wall maps after the shared biome assets. No new runtime generator or external asset dependency was added.

## Before and after

[`R6F4_PALACE_MATERIAL_COMPARISON.png`](previews/R6F4_PALACE_MATERIAL_COMPARISON.png) compares the R6F3 source maps with the R6F4 materials. The sheet is an authored nearest-neighbor texture preview; it is not a gameplay capture and does not close the WebGL acceptance item.

## Asset provenance

Every changed PNG is generated offline from local Pillow drawing primitives in `scripts/generate-wall-textures.py` and `scripts/generate-maze-assets.py`. The designs use project-authored stone, ochre, and bronze palettes. They contain no runtime AI, CDN dependency, or copied game texture.

## Runtime and performance

- Existing wall instancing is retained: at most three wall batches render the three registered variants, rather than one mesh per cell.
- Floor and ceiling remain one mesh each; no per-frame geometry is created. The six-light cap, culling behavior, nearest filtering, and no-mipmap policy are unchanged.
- The floor and ceiling sources grow from 64×64 to 256×256. At RGBA8 with no mipmaps, that is approximately 480 KiB of additional uncompressed texture storage for the active floor; actual driver allocation and frame rate were not measurable here.
- No FPS claim is made. GPU timing at 1920×1080 in Balanced and Sharp modes remains part of visual acceptance.

## Automated verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | Passed · 37 files, 346 tests |
| `npm run build` | Passed · existing Vite advisory for chunks over 500 kB |
| `python3 scripts/generate-maze-assets.py` twice | Determinism checked by hashing generated assets |
| Palace wall registry, dimensions, and distinct variants | Passed |
| Two-cell deterministic variant clusters and two generated seeds | Passed |
| Floor/ceiling repeat UVs, wall instance transforms, and collision cells | Passed |
| Runtime WebGL screenshots | Open · Playwright Chromium is not installed in this environment |

The local test environment supplied a preinstalled `lucide-react` 1.31.0 package to resolve imports added by the latest upstream UI commit; `bun.lock` declares 1.67.0. The renderer and game tests passed, but this was not a lockfile-exact dependency install.

## Open in-game capture acceptance

Capture from the running application, not from the material sheet. With the repository dependencies installed, run `npm run dev`, open `http://localhost:3000`, select **New Run**, choose a class, and enter Floor 1. Use browser viewport emulation at device scale 1. Save captures under `artifacts/r6f4-browser-qa/` with these names:

- `1366x768-balanced-seed-a-start.png`, `1366x768-sharp-seed-a-turn.png`, `1920x1080-balanced-seed-a-corridor.png`, and `1920x1080-sharp-seed-a-arena.png`.
- `seed-a-tight-turn.png`, `seed-a-guardian-arena.png`, and `seed-a-shrine-or-secret.png`.
- `seed-a-enemy-attack-xiphos-aspis.png`, plus POV captures for Dory/Two Hand and Staff.
- Repeat the start, corridor, and landmark captures on a second new run and record both world seeds.

Use the in-game render-quality setting for Balanced and Sharp. Confirm that the main route and enemy attack remain visible, that doors keep their interaction silhouette, and that the fresco/relief patches read as occasional landmarks. Browser QA is still required before calling the art pass visually accepted.
