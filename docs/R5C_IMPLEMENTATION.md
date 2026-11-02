# FPS-R5C — Copilot Review, Save and Input Hardening

## Baseline and scope

- Repository: `ThuleGamesDev/Aether-Crawl-`
- Base branch: `main`, commit `d61deda1b6597de756d1ce4f56d073ac6f68a592` (merge of R5B / PR #21)
- Feature branch: `codex/maze-of-the-minotaur-fps-r5c`
- R5C implementation commit: [20876957f000802728db79bad54a2bc8531fa02a](https://github.com/ThuleGamesDev/Aether-Crawl-/commit/20876957f000802728db79bad54a2bc8531fa02a)
- Save contract: Maze save version 4 remains unchanged; no migration is required.
- Gameplay scope: no new abilities, enemy behavior, combat balance, or dungeon systems.
- Dependencies and runtime services: no new package, AI, CDN, or network asset dependency.

## Implementation decisions

### Action-speed and save contract

`combat/actionSpeed.ts` is the single source for the derived speed range (`0.5–1.75`) and HASTE bonus cap (`0.35`). `DerivedStats`, `StatusSystem`, `PlayerCombat`, and the FPS save validator use this contract. The effective maximum is calculated as `1.75 × (1 + 0.35) = 2.3625`; defensive finite and range checks remain in place. Restoring an action keeps its captured speed and does not reapply status bonuses.

The regression uses a synthetic capped item fixture to exercise the maximum legal derived-stat boundary, then saves and restores an action while HASTE is present. This fixture validates the runtime cap and persistence boundary; it does not model a normal loot roll or test balance.

### Unique-state validation

Each unique definition now owns the persisted timer and charge bounds its runtime trigger emits. Save validation reads those values from the registry, keeps finite/nonnegative checks, rejects duplicate or unknown effects and invalid charges, and uses a named 16-entry safety ceiling combined with the catalog count. The v4 namespace, version, item IDs, and unique IDs are preserved.

### Cursor and UI handoff

`shouldReleasePointerLockForUi` is the shared policy for Inventory, Map, Pause, Level Up, Room Offer, and Game Over. `App.tsx` uses a transition-based layout effect, so an automatically opened level-up releases pointer lock and clears held actions before the browser paints the overlay. `InputSystem.handoffToUi()` does not reacquire pointer lock; only a later real viewport click can request it. Escape can defer a level-up without consuming the point or changing an already-paused state.

### Render and display corrections

- VFX pool snapshots are allocated once with the pool and updated in place. Slot priority and oldest eligible eviction behavior are unchanged.
- Derived item tags are computed once per equipped item, not once per affix.
- The unused `targetLoot` snapshot field is removed; the visible prompt performs the sole necessary loot lookup.
- Loot singular/plural text, Storm Invocation's two additional chain targets, total projectile fan angle, and periodic-status wording now match runtime behavior.
- The WeaponPresenter finding from PR #16 was already fixed before this wave and was left untouched.

## Files changed

- `combat/actionSpeed.ts`, `combat/AbilityRegistry.ts`, `combat/StatusSystem.ts`
- `player/DerivedStats.ts`, `player/PlayerCombat.ts`, `player/UniqueEffects.ts`
- `data/uniqueItems.ts`, `data/classSkillKits.ts`
- `services/fpsSave.ts`, `services/mazeSave.ts`, `services/uiInputPolicy.ts`
- `engine/FPSGameRuntime.ts`, `engine/InputSystem.ts`, `presentation/VFXSystem.ts`, `presentation/vfxDefinitions.ts`, `App.tsx`
- `tests/r5cHardening.test.ts`, `tests/vfxSystem.test.ts`
- `docs/COPILOT_REVIEW_RESOLUTION.md`, `docs/R5C_IMPLEMENTATION.md`, `docs/ROADMAP.md`, `README.md`

## Technical verification

- `npm run typecheck` — passed.
- `npm test` — passed: 258 tests in 27 files.
- `npm run build` — passed. Vite reported the existing size advisory for `three` (537.71 kB) and the application chunk (541.49 kB) after minification.
- `git diff --check` — passed.
- Targeted R5C/VFX/itemization run — passed: 32 tests in 3 files.
- Browser/WebGL smoke — not run. No system Chromium is installed and the configured Playwright Chromium executable is absent.
- Gameplay feel and balance — not simulated; these remain for the user's playtest.

## Known verification limits

The automated input checks cover policy selection, pointer-lock release, held-input clearing, the React skill-choice callback, and Escape deferral. A real browser click/touch session and WebGL rendering were not available in this environment. The production bundle warning is informational and did not fail the build.
