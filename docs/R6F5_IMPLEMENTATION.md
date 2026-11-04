# R6F5 High-Resolution Pixel Readability and Viewmodel Pass

R6F5 raises world readability while retaining the nearest-neighbor pixel-art style. It also gives weapons and shields more screen presence and replaces the upright enemy death presentation with a grounded corpse state. The work does not change combat balance, enemy stats, progression, or save fields.

## Findings before the pass

- Desktop **Balanced** used 68% of the CSS viewport for the WebGL drawing buffer, which enlarged low-resolution world pixels across the game view. Several procedural fallback sprites also started at 32×32 or 64×64.
- The HUD and menus already rendered at the browser's display resolution. World scaling is independent of UI scaling.
- Pixel art already used nearest-neighbor texture sampling without mipmaps; antialiasing was disabled. These choices remain in place.
- First-person gear was camera-attached and animated, but the old 64×64 hand sheets and small display scale made the Dory and Aspis read more like icons than foreground equipment.
- Death used an upright rig or billboard state. Some death rotations could turn the silhouette upside down without leaving a settled body on the floor.

## Render quality

The Controls page now offers **Performance**, **Balanced**, and **Crisp**. Balanced remains the default. The saved legacy value `sharp` migrates to `crisp` when read.

| Preset | Desktop buffer scale | Mobile buffer scale | 1920×1080 desktop buffer |
| --- | ---: | ---: | ---: |
| Performance | 0.75 | 0.45 | 1440×810 |
| Balanced (default) | 0.90 | 0.58 | 1728×972 |
| Crisp | 1.00 | 0.72 | 1920×1080 |

The framebuffer preserves viewport aspect ratio and is resized when the viewport or setting changes. CSS pixelation and nearest-neighbor sampling keep pixel edges hard; the DOM HUD remains at native display resolution. Mobile keeps a lower scale for fill-rate headroom.

At a fixed viewport, Balanced draws about 75% more framebuffer pixels than the former 0.68 scale; Crisp draws about 116% more. These are pixel-count comparisons, not frame-rate measurements. The browser/WebGL runtime was unavailable for performance capture, so the real GPU cost remains an open acceptance item.

## Viewmodels

- Spear, sword, bow, staff, empty-hand, and offhand hand sheets are now generated at **128×160**; the Aspis interior uses **128×128**. The Dory shaft and head have distinct material zones and a longer silhouette. The shield art shows its inner face with a visible hand, grip, and forearm.
- Weapon presentation gives the primary hand and shield more screen space, with a controlled idle sway and stronger movement response. Existing attack, thrust, block, bash, and recovery state motions are retained and now animate the larger artwork.
- Procedural fallbacks use the larger canvas and preserve nearest filtering. The offhand fallback draws the inside of a shield and connected arm rather than a loot-style shield icon.
- `scripts/generate-viewmodel-assets.py` authors the local PNGs from deterministic pixel clusters and creates [`R6F5_VIEWMODEL_ASSET_SHEET.png`](previews/R6F5_VIEWMODEL_ASSET_SHEET.png). That sheet validates asset composition only; it is not an in-game screenshot.

## Enemy death and corpse lifecycle

Death uses one shared 1.1 second presentation window. The rig now folds into a low, side-resting pose; the billboard falls laterally without shrinking upright. At the end of the fall, the renderer replaces the same enemy ID with one horizontal floor corpse at its final position. The corpse remains visible and has no target/collision interaction; health and dead-state filters continue to exclude it from targeting, attacks, room-clear checks, and AI. The ID-keyed renderer transition is idempotent, so updates do not create duplicate corpses.

## Palace Foundations

R6F4's weathered ashlar, restrained fresco and relief patches, beveled slab floor, and subdued ceiling remain intact. R6F5 adds readable bases, capitals, bronze side trim, a stone arch, an inner bronze arch line, and a keystone around the Palace exit. The geometry is created with the existing floor geometry and does not change floor topology or collision rules.

## Technical verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | Passed · 38 files, 350 tests |
| `npm run build` | Passed · Vite reports the existing large-chunk advisory (>500 kB) |
| `npm run test:r6f1-browser` | Skipped · Playwright Chromium is not installed; WebGL visuals unverified |
| `npm run test:run` | R6F1 and R2A browser checks skipped because Chromium is unavailable |
| Viewmodel generation determinism | Passed · SHA-256 hashes match across two generations |
| Render quality and UI scale persistence | Passed · 2 focused tests cover save/load, legacy migration, and invalid settings |
| In-game screenshots / GPU timing | Open · no real browser capture was available |

The project tests and build ran against the workspace's preinstalled dependency overlay; this is not a fresh lockfile-exact install. No gameplay balance or frame-rate improvement is claimed.

## Visual acceptance still required

Run `npm install`, then `npm run dev` and open `http://localhost:3000` in Chromium with WebGL 2 enabled. The local dev server started, but the available cloud browser could not connect to the workspace's loopback address, and Playwright Chromium is not installed. At device scale 1, capture actual gameplay under `artifacts/r6f5-browser-qa/`:

- Palace corridor and exit at 1366×768 in Balanced and 1920×1080 in Crisp.
- Myrmidon idle, attack windup, thrust, and recovery with the Dory.
- Hoplite idle, guard, and bash with Dory and Aspis.
- A living enemy at medium distance, then its collapse and settled corpse.
- HUD over the world and the inventory over the world, at both render presets.
- A short video or GIF of the spear thrust and shield bash, if capture is available.

Also compare Performance, Balanced, and Crisp for playability and record actual GPU/frame timing on the target desktop. The current unit tests cover render-scale selection, old-setting migration, asset dimensions and fallback, death phase progression, grounded corpse replacement, and Palace arch construction; they do not substitute for visual acceptance.
