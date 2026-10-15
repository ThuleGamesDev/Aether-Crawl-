# Aether Crawl roadmap

## Current goal: a production-ready Floors 1–5 slice

The first five floors are the current integration boundary. Existing exploration, combat, room, event, hazard, save and mobile systems should work as one normal expedition before more combat scope is added.

### Hardening status

**Code and automated checks: complete for this pass. Full slice acceptance: still open.**

Completed in this pass:

- Closed ordinary doors now block movement and remain interactable with E.
- Floor reachability uses the same closed-door rule as player collision.
- Mobile movement and look input are cancelled while the map or a room decision is open.
- Typecheck and production build pass; 116 automated tests pass.

Still required before calling Floors 1–5 accepted:

- Play a new run with an ordinary three-character party from party selection through the fifth-floor guardian.
- Save and reload during the run, including after room choices and after guardian victory before descent.
- Check combat intent readability, room pacing, keys/scrap, resting and optional elite pressure on desktop and a phone-sized screen.
- Tune the first-run experience from observed play; the current automated fixtures verify rules and state, not balance.

The full browser run was not available in the 2026-10-15 hardening environment: there was no local Chromium, and its remote browser could not reach the isolated local dev server. Do not mark the manual items complete based on the passing unit tests or the saved-fixture checks from earlier waves.

## Initiative and painted look — current follow-up

Completed:

- Explicit initiative for all classes and 28 monster definitions; shared initial gauge and initiative-scaled recovery.
- Armor/shield load, saved base-stat migration, visible INIT and working Party Stats.
- Painted first-five-floor wall/floor/gate and sword/shield, perspective ground, corrected prop baseline and fresh-floor facing.
- 126 automated tests, typecheck and production build pass. See [rules, art provenance and verification](INITIATIVE_AND_PAINTED_LOOK.md).
- Local Chromium browser smoke passed on desktop and two touch-emulated sizes: new game, stats, save/continue, input cancellation, and a Floor-5 boss fixture. This environment now has a usable local Chromium; the earlier hardening limitation above describes that earlier pass.

Still open:

- Full ordinary-party Floors 1–5 run, balance after initiative changes, and physical-phone performance/comfort.
- Full painted conversion of creatures, props, other weapons and later biomes; true vaulted geometry and exterior scenes.

## Completed foundations

- Static local asset pipeline with no runtime Gemini or AI dependency.
- First-person exploration, minimap and mobile movement controls.
- Combat 2.0 enemy intents and pilot abilities.
- Combat 2.5A semi-real-time timelines and Combat 2.5B direct party control, quick actions and feedback.
- Dungeon Gameplay 2.0 seeded rooms, side content, room events, environmental hazards, save/load and first-five-floor budgets.

## Deferred after slice acceptance

1. **World-space enemies, without navigation:** placement, projection, occlusion, distance/range presentation and target selection.
2. **Spatial enemy behavior:** approach/retreat/charge and line-of-sight/path behavior, after movement ownership and spatial rules are defined.

Neither step belongs in the current Floors 1–5 hardening change. Reassess the order after the ordinary-party mobile playtest.
