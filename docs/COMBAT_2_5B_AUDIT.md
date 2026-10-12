# Combat 2.5B audit and validation

Baseline: main `376fe655ef5879c686817c56183d71fee6905b9f`, merged Combat 2.5A tree `5eebecb92ae14d04b4bfefc182363d235c7ff3fa`.

## Baseline findings

- App owned active index, selected enemy, combat menu and READY-only Party picker, and implemented selection/subaction/UI key handlers.
- Controls offered a generic seven-button action menu; skills/items required opening a list. Desktop only had selection and pause hotkeys. Mobile duplicated the same route through a menu-oriented combat wrapper.
- Viewport used invisible equal-width screen columns for target picking, despite sprites being placed at different centers/bounds. It exposed existing static VFX, intent badges and per-enemy cast progress.
- CombatRuntime already supplied atomic player action resolution, one ref-owned clock, independent timers, timed Guard, interruption, bounded casts and one-shot outcomes. No rewrite was needed.
- Tooltip effect summaries now describe the actual resolver, including Soul Pact and lowest-health ally targeting. Existing group_heal/focus authored names/descriptions still merit a later content-semantics audit; their gameplay is preserved.
- Skills already had recovery overrides and typed effects, but no player cast time. Current skills remain instant. Enemy abilities, damage, armor, equipment, statuses, bosses, summons, XP and loot are retained.
- Audio supplied attack, enemy-hit, Defend and heal tones; App routed both sides through the same generic attack sound. There were no structured floating-number events.

## Decisions and final changes

- Preserve the active selection through recovery; select any living hero directly. Route key, canvas and touch actions through one control hook plus pure input helpers.
- Expose first four learned skills, a configurable encounter-local potion slot, living target/character cycles and a responsive common HUD. Additional skills and less frequent options remain in a tactical More panel.
- Keep immediate LMB/Guard/potion/Flee actions unbuffered. Offer one manual skill command only in the final 250 simulated ms; revalidate resources and the original offensive target at execution, and cancel safely on stun/death/selection change/end.
- Auto Basic OFF by default per encounter. ON attacks only with inactive READY heroes against the selected living target. Uses existing attack resolution, never skills/items/MP, and stops under pause.
- Add structured numeric/status/interrupt/phase events at their resolvers and runtime boundaries. Use compact bounded floating labels and distinct existing procedural audio styles. No log parsing, generated assets, hitstop or clock interference.
- Split landscape HUD into a side party column and two action rows after inspecting the first landscape render; all interactive buttons remain at least 44 px tall. Center/cap desktop dock at 760 px.
- Add only an optional unused rangeBand runtime field; no combat spatial dependency or world movement is introduced.
- Remove the obsolete READY-only Party picker. App shrinks from 1318 to 1249 lines; its new combat UI resides in dedicated components/hooks.

## Validation

- Application and test-source typecheck passes using available TypeScript 7.0.2. Test source typechecking uses a temporary Vitest declaration because actual Vitest is unavailable.
- 94 authored tests pass across nine test files, using Node 24 and the temporary assertion/mock adapter. Includes 19 new cases for input mapping, living target/party selection, resources, one-slot buffer, cancel/stun/target death, paused/slowed auto and queued actions, block/damage/status and one-shot phase/interrupt feedback.
- Production browser bundle passes using available Vite 8.3.3 with the temporary Tailwind 4 compatibility override; dependency versions and repository build configuration remain unchanged.
- Desktop browser smoke passes at 1366×768 and layout inspection at 2560×1080: encounter, LMB attack, recovery rejection, selection during recovery, F/digit selection, Q/E/R/F skills, Tab/Shift+Tab, potion, pause/resume, tactical menu, Auto toggle, Necromancer, victory, XP/loot and floor 6 save.
- Emulated touch smoke passes at 390×844 and 844×390: Attack, direct party/target cycling, four skill buttons, long-press details without skill consumption, potion, pause/resume, tactical panel/auto toggle, boss completion and return/save. Landscape checks verify all visible dock buttons are within screen bounds, at least 44 px tall, and reachable by hit testing.
- No page or console errors in the successful smoke flows. Captures inspected for desktop, portrait, landscape and ultrawide layout. Temporary browser/test/bundle artifacts stay outside the PR.

## Limitations and next wave

The exact declared npm dependency versions could not be installed here. Standard `npm test` using real Vitest and `npm run typecheck`/`npm run build` with the project versions still need verification in a dependency-enabled environment. Passing alternate tools is not presented as a pass of those exact commands. Touch is browser emulation, not a physical Android-device pacing test. Procedural audio routing was exercised; sound balance and audibility require listening on actual hardware.

Recommended next work: playtest manual vs Auto Basic encounter pressure on a phone, measure interrupt/Guard opportunities and quickbar readability, then tune authored recovery/cast values. Define spatial range thresholds and player/enemy position ownership before adding movement. Avoid layering navigation or party AI onto unvalidated pacing.
