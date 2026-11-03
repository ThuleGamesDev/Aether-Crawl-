# R6F3 UI Visual System

## Direction

The interface uses a restrained Greek dark-fantasy palette built around mythic obsidian, aged bronze, and warm ivory. The 3D labyrinth remains the focus during combat; inventory and character screens use a denser, scrollable ARPG layout. Typography stays native and sharply rendered so UI scale never resamples text.

## Color tokens

| Token | Value | Use |
| --- | --- | --- |
| Obsidian | `#111013` | Main overlay and HUD backing |
| Raised obsidian | `#1b191b` | Cards, selected panels, controls |
| Bronze | `#c89558` | Active controls, outlines, rarity accents |
| Bright bronze | `#e0bd82` | Keyboard focus and high-priority selection |
| Ivory | `#eee6d8` | Primary text |
| Secondary | `#b5aa99` | Supporting labels and explanations |
| Muted | `#948879` | Non-critical metadata |
| Health | `#d45e53` | Health resource |
| Mana | `#62b6d9` | Mana resource |
| Stamina | `#9dbd76` | Stamina resource |
| Poison | `#a8c978` | Poison and venom status |
| Curse | `#c4a2d0` | Curse status |

Rarity keeps its own item-specific color hierarchy. Positive and negative comparisons use both color and directional symbols, so meaning does not depend on color alone.

## Spacing and shape

- HUD spacing uses compact 4–12 px increments and stays within the outer screen margins.
- Menu and inventory panels use 9–14 px internal spacing; the inventory is capped at 1480 px and 94% of viewport height.
- Bronze borders are low contrast by default. Higher contrast is reserved for focus, selection, and meaningful rarity.
- The labyrinth motif appears as small framing details and never as a repeated full-screen border.

## Typography hierarchy

- Screen titles: serif display face, 22–26 px, ivory.
- Section headings: sans-serif, 11–12 px, bronze, uppercase with restrained tracking.
- Item names and current values: 11–16 px, ivory, semibold.
- Labels and secondary values: 9–11 px, secondary tone.
- Small metadata: 9 px minimum at the default UI scale; no display-only critical action depends on a hover tooltip.

## States and interaction

- Focus uses a visible 2 px bright-bronze outline with a dark separation ring.
- Selected inventory items use a clear border and inset contrast; rarity remains visible independently.
- Locked, cooling-down, and resource-starved skills retain their names and reasons while the button remains keyboard focusable when appropriate.
- Combat separates LMB/RMB weapon actions from 1–4 class skills. Q appears only when a shield grants parry.
- The target marker only changes to a valid-hit color when the current action can hit a visible target.
- Interface scale persists at 90%, 100%, 115%, or 125%.
- Reduced-motion preference disables nonessential UI transitions and overlay blur.

## Layout references

- Gameplay HUD: compact hero resources at top left, a small floor label, one map affordance, one pause-menu affordance, a centered category-aware reticle, and grouped weapon/defense/class action cards at the bottom.
- Inventory at desktop widths: equipment and paperdoll on the left, the 10×5 bag in the center, and selected-item data plus true derived-stat and resolver previews on the right. Each pane scrolls inside the fixed-height panel.
- Inventory on touch and short landscape displays: a single vertical pane with the same equipment, bag, and item details, within the overlay's own scroll region.
- Character stats: four explicit sections—Offense, Defense, Resources, and Utility—followed by equipped items and active unique/effect details.
- Authored labyrinth wall texture variants are previewed in [R6F3_WALL_TEXTURE_VARIANTS.png](previews/R6F3_WALL_TEXTURE_VARIANTS.png); this is an asset contact sheet, not a browser capture.

## Accessibility and scaling

- DOM text remains native and selectable; the 3D render scale does not affect UI sharpness.
- Interactive controls expose their state with native buttons, labels, and ARIA attributes.
- Focus styling is visible on both the game shell and menu screens.
- Safe-area insets are respected, touch controls use at least 44 px targets, and hover is not required to use the bag or equipment.
