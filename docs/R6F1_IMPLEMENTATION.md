# R6F1 Render Visibility and Browser QA

R6F1 closes the first-person visibility blockers with a targeted renderer fix and a repeatable browser fixture. It does not change combat balance, item data, save fields, or dungeon progress.

## Root causes and fixes

- **First-person viewmodels were outside the rendered scene graph.** `WeaponPresenter` parents its hand sprites to the camera, but `SceneRenderer` rendered the scene without attaching that camera to it. The camera now belongs to the scene, so both camera children participate in the existing WebGL render. The sprites keep depth testing disabled against world geometry, use a high render order, and are not frustum-culled.
- **Some offhand artwork was cropped.** Generated hand, wrist, and forearm pixels extended below the 64×64 source image. The generator now keeps these parts inside the sprite and authors the Aspis interior with a visible grip and forearm. Each left-hand asset has its own drawing instead of reusing a mirrored right-hand image.
- **A two-handed Dory could present an empty offhand.** When no offhand item is equipped, the spear now selects the two-hand grip pose as a presentation-only rule.
- **The checked-in rig atlas did not match its manifest.** Comparing the remote `main` image against the current `characterRigs.json` showed empty alpha in all layers for the rat and spider and in all three directional views for the four humanoid rigs. This left the rig meshes with nothing to draw. Regenerating the atlas from the current authored rig data restores the six visuals and their 127 atlas cells; regression tests now reject empty rig views and empty local fallback sprites.
- **Enemy visibility must survive later load failures too.** Each pilot rig keeps its authored local sprite path as a visible fallback while the atlas loads, after an atlas load error, or when a rig cannot be constructed. The asset manager reports request, dimension, alpha, and local-image failures in development diagnostics; an invalid local image leaves its procedural fallback texture active.

`SceneRenderer.getDiagnostics()` reports world enemy count, rendered enemy visual count, approximate in-frustum count, atlas state/errors, current hand visual IDs and attachment, camera scene membership, drawing-buffer and CSS dimensions, render scale, quality, and Three.js draw statistics. In development, the current snapshot is also available as JSON on `canvas[data-r6f1-render-diagnostics]`.

## Render quality

The Controls page stores the choice in local storage. It scales only the WebGL canvas drawing buffer; the canvas remains at its CSS display size and the DOM HUD stays at native display resolution. All authored pixel textures continue to use nearest-neighbor sampling.

| Quality | Desktop scale | Mobile scale | 1280×720 buffer | 1920×1080 buffer |
| --- | ---: | ---: | ---: | ---: |
| Performance | 0.48 | 0.40 | 614×346 | 922×518 |
| Balanced | 0.68 | 0.54 | 870×490 | 1306×734 |
| Sharp | 0.84 | 0.68 | 1075×605 | 1613×907 |

Dimensions use the viewport CSS size, round to the nearest pixel, and preserve the viewport aspect ratio. The 0.92 maximum scale leaves room for high-density displays without forcing a native-resolution render.

## Automated validation

`tests/renderVisibilityR6F1.test.ts` covers the scene/camera attachment, six rig atlas cells and UV bounds, enemy animation/death cleanup, viewmodel creation and equipment updates, Dory two-hand presentation, action/event poses, render scales, and asynchronous atlas/weapon-image errors. The browser fixture at `tests/browser/r6f1.html` constructs its own fixed-seed 23×23 chamber and renderer. It does not launch or mutate the production game runtime.

Run the full checks with:

```bash
npm run typecheck
npm test
npm run build
npm run test:run
git diff --check
```

`npm run test:run` runs the existing R2A browser scenario and R6F1 when Playwright Chromium is installed. Set `CHROMIUM_PATH` if using a system Chromium. If it is missing, the command writes `artifacts/r6f1-browser-smoke/report.json` with `status: "skipped"`, says browser/WebGL visibility remains unverified, and prints the expected capture pattern. It does not label the visual acceptance as passed. Run just R6F1 with `npm run test:r6f1-browser`.

The R6F1 runner checks WebGL 2, asset readiness, draw calls, camera and hand visibility, actual framebuffer pixel changes from an in-view enemy, decreasing enemy pixel size with distance, full wall occlusion, and visible legacy-sprite fallback after a blocked atlas request. It captures both hands and one enemy for each loadout, plus each of the six enemy visual IDs, at both requested viewport sizes. At 1280×720 it also captures idle, attack windup/active/recovery, and an equipment change.

The regenerated [direction sheet](previews/R6E_CHARACTER_DIRECTION_SHEET.png) and [equipment sheet](previews/R6E_WORLD_EQUIPMENT_SHEET.png) show the checked-in atlas and corrected offhand artwork. They are asset previews; they are not browser captures.

Expected image paths, if browser capture is available:

- `artifacts/r6f1-browser-smoke/1280x720-loadout-xiphos-aspis.png`
- `artifacts/r6f1-browser-smoke/1280x720-loadout-dory-two-hand-grip.png`
- `artifacts/r6f1-browser-smoke/1280x720-loadout-kopis.png`
- `artifacts/r6f1-browser-smoke/1280x720-loadout-labrys.png`
- `artifacts/r6f1-browser-smoke/1280x720-loadout-bow-draw.png`
- `artifacts/r6f1-browser-smoke/1280x720-loadout-staff-focus.png`
- `artifacts/r6f1-browser-smoke/1920x1080-loadout-xiphos-aspis.png`
- `artifacts/r6f1-browser-smoke/1920x1080-loadout-dory-two-hand-grip.png`
- `artifacts/r6f1-browser-smoke/1920x1080-loadout-kopis.png`
- `artifacts/r6f1-browser-smoke/1920x1080-loadout-labrys.png`
- `artifacts/r6f1-browser-smoke/1920x1080-loadout-bow-draw.png`
- `artifacts/r6f1-browser-smoke/1920x1080-loadout-staff-focus.png`
- `artifacts/r6f1-browser-smoke/1280x720-enemy-cretan_cave_rat.png`
- `artifacts/r6f1-browser-smoke/1280x720-enemy-arachne_brood.png`
- `artifacts/r6f1-browser-smoke/1280x720-enemy-bronze_revenant.png`
- `artifacts/r6f1-browser-smoke/1280x720-enemy-bull_cult_enforcer.png`
- `artifacts/r6f1-browser-smoke/1280x720-enemy-guardian_bronze_gatekeeper.png`
- `artifacts/r6f1-browser-smoke/1280x720-enemy-chthonic_acolyte.png`
- `artifacts/r6f1-browser-smoke/1920x1080-enemy-cretan_cave_rat.png`
- `artifacts/r6f1-browser-smoke/1920x1080-enemy-arachne_brood.png`
- `artifacts/r6f1-browser-smoke/1920x1080-enemy-bronze_revenant.png`
- `artifacts/r6f1-browser-smoke/1920x1080-enemy-bull_cult_enforcer.png`
- `artifacts/r6f1-browser-smoke/1920x1080-enemy-guardian_bronze_gatekeeper.png`
- `artifacts/r6f1-browser-smoke/1920x1080-enemy-chthonic_acolyte.png`
- `artifacts/r6f1-browser-smoke/1280x720-lifecycle-idle.png`
- `artifacts/r6f1-browser-smoke/1280x720-lifecycle-attack-windup.png`
- `artifacts/r6f1-browser-smoke/1280x720-lifecycle-attack-active.png`
- `artifacts/r6f1-browser-smoke/1280x720-lifecycle-attack-recovery.png`
- `artifacts/r6f1-browser-smoke/1280x720-lifecycle-equipment-change.png`

Each run also writes `artifacts/r6f1-browser-smoke/report.json` with pixel evidence, diagnostics, checks, and the actual screenshot list.

## Manual browser run

1. Install the project dependencies and a Playwright Chromium browser, then run `npm run dev`.
2. Open `http://localhost:5173/tests/browser/r6f1.html` in a Chromium browser with WebGL 2 enabled. The fixture uses seed `0x6f1f1` and a fixed chamber.
3. Use the browser console to call `window.__r6f1.setLoadout('xiphos-aspis')`, `setEnemy('cretan_cave_rat')`, and `diagnostics()`. Other loadouts are `dory-two-hand-grip`, `kopis`, `labrys`, `bow-draw`, and `staff-focus`.
4. Inspect the canvas with `window.__r6f1.captureBaseline()`, then add an enemy and call `window.__r6f1.compareToBaseline()`. `setWallOcclusion(true)` places the fixture wall between the camera and enemy. Resize the browser to 1280×720 and 1920×1080 for the requested captures.

## Browser acceptance status

Current workspace run (2026-11-03): the first R6F1 test run reproduced the stale-atlas failure against the `main` image; after atlas regeneration, `npm test`, typecheck, and build pass against the regenerated asset. Playwright Chromium was not installed, so `npm run test:run` recorded a browser-QA skip and listed the 29 expected image paths without capturing screenshots. Real in-browser visibility and GPU cost remain unverified in this environment. Run the fixture in a supported Chromium/WebGL 2 browser before treating visual acceptance as complete; the unit tests do not substitute for that result.
