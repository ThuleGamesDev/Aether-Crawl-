# Maze of the Minotaur — World Bible

## Premise

Beneath the palace of Knossos, a labyrinth descends through the foundations of an old Cretan kingdom and into older, stranger places. A lone hero enters in pursuit of a way through. Every floor is a navigable ruin with side chambers, offerings, hazards, loot, and one required Guardian at its descent. The Minotaur is the unique master of the Maze and the long-term destination of the expedition; it is not repeated as a routine floor boss.

The game is an original dark-fantasy interpretation inspired by Greek myth and ancient Mediterranean material culture. It does not reproduce a specific historical site, mythic text, copyrighted creature design, or existing game level.

## World and tone

The tone is ominous, tactile, and heroic rather than a historical simulation. Limestone, bronze, and old painted plaster frame a place that has become a prison, temple, cistern, tomb, and machine over many generations. The player finds broken horns, battered walls, abandoned offerings, and accounts of earlier victims before any direct meeting with the Minotaur.

The art deliberately blends archaeological periods and mythic motifs. Cretan palace forms and fresco patterns sit beside heroic-age weapons, later Greek divine names, and chthonic cult imagery. This is an intentional fantasy chronology, not a claim that all motifs are contemporary historical evidence.

## The eight heroes

Technical `ClassType` IDs remain stable for saves and loadouts. The player chooses exactly one visible hero at expedition start.

| Stable ID | Name | Identity and first-wave action theme |
| --- | --- | --- |
| `BARBARIAN` | Myrmidon | Forceful bronze-age warrior; Labrys, Bronze Cleave, Heroic Strike, Ares’ Quake |
| `PALADIN` | Hoplite | Spear-and-shield defender; Dory Thrust, Aspis Bash, Sacred Phalanx |
| `SORCERER` | Oracle | Prophecy and elemental magic; Oracle’s Spark, Fatebound Bolt, Promethean Flame |
| `ROGUE` | Trickster | Daggers, deception, mobility; Kopis Strike, quick feint, Hermes’ Feint |
| `RANGER` | Hunter | Bow and javelin specialist; Artemis’ Arrow, charged Boar-Spear Arrow, Hunter’s Rain |
| `CLERIC` | Asclepiad | Healing rites and protection; Sacred Staff Strike, Temple Light, Asclepius’ Grace |
| `MONK` | Pankratiast | Unarmed martial combat; Pankration Strike and Olympian Kick |
| `NECROMANCER` | Shadebinder | Chthonic spirits, curses, soul magic; Styx Shard, Hades’ Grasp, Underworld Eruption |

All eight retain working primary, secondary, and skill actions. The Myrmidon and Oracle receive the most complete pilot treatment in this wave; broader class kits remain future work.

## Monster families

Stable legacy enemy IDs are retained where the creature role is a presentation migration. Explicit canonical Guardian IDs are added for floor progression. Active names, art, and attacks follow the new setting.

- **Cave and ruin scavengers:** Cretan Cave Rat, Arachne’s Brood, Tomb Plunderer, Labyrinth Raider.
- **Bound warriors and cult:** Bronze Revenant, Bull-Cult Enforcer, Chthonic Acolyte, Cursed Champion.
- **Chthonic and elemental forms:** Stygian Ooze, Restless Shade, Forge Wraith, Cistern Nereid, Empusa.
- **Ancient works and deep predators:** Bronze Automaton, Cyclopean Brute, Gorgon Seer, Chthonic Drake.
- **Floor Guardians:** Bronze Gatekeeper, Serpent Priestess, Cyclopean Mason, Lamia of the Cistern, Threadbound Warden.

Guardians are placed in a reachable, open arena at the exit. Telegraphs communicate their attacks before damage resolves. Optional elite definitions may remain in the registry, but active spawns use an explicit mythic roster rather than a generic fallback.

## Material culture and items

Weapons include the Xiphos, Kopis, Dory, Hunting Bow, Javelin, Labrys, Bronze Mace, and Ritual Staff. Defensive equipment includes the Aspis, Bronze Cuirass, Linothorax, Bronze Greaves, Boar-Tusk Helmet, and Laurel Circlet. Consumables and relics include Healing Draughts, Ambrosial Tonics, Nectar Flasks, Offering Bowls, Chthonic Seals, Ariadne’s Tokens, and Broken Labyrinth Tablets.

The current inventory uses its existing equipment slots and item-instance model. The internal floor-key counter is presented as Ariadne’s Tokens; R2A adds no separate currency economy and does not implement the future affix or unique-item system.

## Labyrinth depths

The six internal biome keys remain stable implementation identifiers. Their visible progression is:

| Floors | Visible zone | Character |
| --- | --- | --- |
| 1–5 | The Palace Foundations | Weathered Cretan limestone, old bronze portals, faded bull frescos |
| 6–10 | The Serpent Galleries | Votive niches, serpent patterns, humid stone and toxic haze |
| 11–15 | The Cyclopean Halls | Monolithic blocks, broken columns, abandoned building works |
| 16–20 | The Forgotten Cisterns | Black pools, mossed chambers, doubled reflections |
| 21–25 | The Chthonic Depths | Oxblood altars, funerary seals, underworld shadows |
| 26+ | The Heart of the Maze | Monumental walls, bull reliefs, signs of the unique Minotaur |

Each generated floor has a start, a connected main route, optional spaces, a Guardian arena, and an explicit interactable descent. Defeating the Guardian unlocks the exit but never forces the next-floor transition.

## Guardian hierarchy

1. **Bronze Gatekeeper** — a prepared shield bash, broad slow sword sweep, and short guard phase teach spacing and dodge timing.
2. **Serpent Priestess** — a venom orb, readable poison cone, and short coil ritual teach projectile and area avoidance.
3. **Cyclopean Mason** — a heavy slam, thrown block, and wide ground shockwave reward distance and deliberate movement.
4. **Lamia of the Cistern** — a fast lunge, limited life-drain bolt, and bounded retreat pressure the player without indefinite kiting.
5. **Threadbound Warden** — a curse bolt and ritual shield give way at half health to delayed red sigils and a stronger curse pattern.

Guardian actions follow real-time windup, active, and recovery phases. Telegraphs mark the danger before damage. Player movement, wall collision, Dodge, and Hoplite shield block are valid ways to avoid or mitigate attacks; no encounter relies on hidden instant damage.

## Combat readability

The six early enemy families express their role through a small set of stable attacks: the Rat leaps, the Revenant guards and bashes, Arachne's Brood controls space with venom and web, the Bull-Cult Enforcer commits to a telegraphed charge, the Acolyte pressures from range, and the Tomb Plunderer throws a javelin before briefly retreating. These patterns use line of sight, attack cooldowns, authored telegraph times, and short recovery windows. Poison, Burn, Slow, Stagger, Weakness, and Guard are simulation-time effects rather than turn-based statuses.

The same five non-Minotaur Guardian identities may cycle on later floors until future content replaces them. The Minotaur is a single later main boss with a configurable depth, not an alias for any of these Guardians.

## Visual rules

- Dark Fantasy Retro FPS Pixel Art with hard nearest-neighbor edges.
- Limited limestone, charcoal, bronze, patina, oxblood, and oil-flame palettes.
- Strong monster silhouettes readable at first-person distances.
- Greek meanders, columns, painted plaster, amphorae, oil bowls, votive altars, tablets, and bull reliefs establish place.
- Keep the world dim but readable; keep HUD and interaction text crisp at full screen resolution.
- Use local static artwork and procedural transforms for a small first-wave animation layer. No runtime image generation or AI service.

## Excluded from the active identity

Generic medieval castles, Nordic runes, Roman legionaries, standard fantasy orcs, recurring Minotaur clones, party formation, turn order, tactical combat menus, and detached combat scenes do not belong in the active game path. Historical legacy code and R1 documents may retain former names for provenance but do not define current gameplay.
