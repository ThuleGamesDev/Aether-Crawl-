# R6E Visual Production Pass

## Scope

R6E is a local, deterministic art and presentation pass for Palace Foundations (floors 1–5). It keeps the existing enemy, equipment, room, save, and combat identifiers. No save migration or gameplay balance changes were added.

The pilot includes these six stable enemy visual IDs:

| Enemy | Visual ID | Art treatment |
|---|---|---|
| Cretan Cave Rat | `cretan_cave_rat` | Layered quadruped with articulated legs, head, muzzle, eye, and tail |
| Arachne's Brood | `arachne_brood` | Layered arachnid with eight articulated legs, fangs, thorax, and abdomen |
| Bronze Revenant | `bronze_revenant` | Humanoid, directional atlas views, bronze shield and Xiphos |
| Bull-Cult Enforcer | `bull_cult_enforcer` | Heavy humanoid, directional views, horned helmet, hide, and Labrys |
| Bronze Gatekeeper | `guardian_bronze_gatekeeper` | Heavy humanoid Guardian, directional views, bronze armor and shield |
| Chthonic Acolyte | `chthonic_acolyte` | Caster, directional views, layered robe, relic, and staff |

## Character views and animation

The generated character atlas uses a 16-by-12 grid of 64-pixel cells. The four humanoid rigs carry distinct front, three-quarter, and back cells for every anatomical/equipment layer. `CharacterRigAnimator` chooses a view from the saved facing yaw and camera position, updates UVs in the existing layer geometry, and mirrors the three-quarter view for the opposite side. The atlas remains a single nearest-filtered local texture; view changes allocate no meshes, materials, or geometries.

Humanoid source views use separately authored symmetric front details, narrowed and shaded three-quarter parts, and back armor/helmet/cloth treatments. The rat and spider retain their own anatomical rigs and camera-facing flip behavior. The six static fallbacks are rendered from the same authored rig parts, so the loading fallback and atlas actor share the same pilot silhouettes.

Animation selection continues to read existing combat snapshots. The rigs retain idle, run, alert, windup, impact, recovery, hurt, stagger, and death clips. Player dodge, hit recoil, item use, and ability timing continue through the existing viewmodel events and `AbilityDefinition` timers. No enemy dodge state or gameplay timer was introduced.

## Palace architecture and equipment

Palace Foundations now has authored local limestone wall, slab floor, coffered ceiling, bronze-bound door, and Guardian exit tiles. Existing deterministic room generation continues to place its three visual anchors: entry/gallery frescoes, instanced pillared halls, and the bull-relief Guardian arena. Fresco, bull relief, wall torch, altar, and broken-column sprites use the same red plaster, limestone, teal, and bronze palette. Pillars use ten-sided limestone shafts with stone capitals/bases and an instanced bronze neck band. Wall torches still mount only to validated wall faces; architectural local lights retain the six-light cap and deterministic flicker phase.

The viewmodel art keeps the existing asset paths and equipment switching. The two reference pairings are Xiphos + Aspis and Dory + two-hand grip. Labrys, Kopis, Bow + draw hand, and Staff + focus are included in the source sheet. Camera-space poses keep hands low and outward; the R6E center-clear check covers the reticle area in both screen axes, including active Bow, shield bash, and Dory dodge poses.

Pixel filtering remains nearest-neighbor with mipmaps disabled. The desktop render scale stays at 0.56 across 1280×720, 1920×1080, and 2560×1440; UI text remains rendered by the separate high-resolution DOM layer. VFX pooling and world-space telegraph handling were not changed.

## Generated QA sheets

- [Character direction and impact sheet](previews/R6E_CHARACTER_DIRECTION_SHEET.png) shows all four humanoids at idle and impact in front, three-quarter, and back views.
- [World and equipment sheet](previews/R6E_WORLD_EQUIPMENT_SHEET.png) shows the five Palace tile materials, room landmarks, and six first-person equipment pairings.
- [R3A six-pilot animation sheet](previews/FPS_R3A_CHARACTER_CONTACT_SHEET.png) remains the reference for idle, run, windup, impact, hurt, and death across all six rigs.

The sheets are deterministic technical previews composited from the authored atlas cells at nearest-neighbor scale. They verify alpha presence, layer order, and consistent source scale. They are not screenshots from a player session.

## Asset and runtime constraints

- `scripts/generate-maze-assets.py` and `scripts/character_rig_authoring.py` are offline-only Pillow generators; no runtime AI, image-generation API, external CDN, or new engine is used.
- Generated character manifest schema is now version 2. It is runtime presentation data and does not change the persisted save schema.
- Existing asset IDs and paths remain stable. Six pilot fallback PNGs and the existing Palace/hand/prop PNGs are regenerated in place; character view variants share one atlas instead of adding one image per view.
- Character materials are shared per actor, geometry is created once per actor, room tiles and pillar parts remain instanced, local lights are capped at six, and `dispose()` releases owned resources. Existing VFX pool capacity remains 48 desktop / 24 mobile.

## Main review context

The R6D3 Copilot review appeared after that PR had merged. It left two comments on `engine/FPSGameRuntime.ts` (a repeated visible-discovery scan) and `services/mazeChronicle.ts` (an invalid Chronicle recovery path dropping its incoming event). R6E does not modify either area; those findings remain on the current main branch for a follow-up outside the visual production pass.

## Technical verification

| Command or check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm test` | Passed: 34 files, 319 tests |
| `npm run build` | Passed; Vite reports the existing large Three.js and application chunks |
| `npx vitest run tests/visualProductionR6E.test.ts tests/characterRigs.test.ts tests/labyrinthR6A.test.ts` | Passed: 3 files, 27 tests |
| `python3 scripts/generate-maze-assets.py` run twice, then SHA-256 verification | Passed: all 105 generated assets and preview hashes matched byte-for-byte |
| R6E-targeted `git diff --check` | Passed |
| Browser/WebGL screenshot | Not available: Playwright's Chromium executable and system Chromium/Firefox are absent in this runtime |

The tests validate registry paths for all six pilots and equipment views, manifest schema and atlas bounds, deterministic pose selection for idle/movement/attack/hurt/stagger/death, in-place UV changes for all three humanoid directions, center-reticle clearance for paired viewmodels, nearest filtering, three desktop render sizes, local-light limits, and owned-resource disposal. No gameplay or balance simulation was run.

## Known limits

The character work remains native-resolution pixel art composited as layered billboards, not skeletal 3D. The front and back views are authored as atlas alternatives; the three-quarter view is a narrowed, shaded treatment of the same anatomy. The technical sheets verify those source layers, while final camera-specific readability still benefits from a WebGL capture on a supported local browser.
