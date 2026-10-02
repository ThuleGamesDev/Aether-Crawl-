# First-person exploration

The dungeon remains a generated `number[][]` grid. The player now also has a continuous world transform:

- `x` and `y` are world coordinates; whole numbers mark tile boundaries.
- `angle` is a horizontal angle in radians. Zero faces east; positive angles turn clockwise.
- `Player.pos` and `Player.dir` remain derived, nearest-cell/cardinal fields for older gameplay code and saves.

The renderer reads the transform from a ref in its own animation loop. The app does not send every movement frame through React state. React updates when the player enters another tile, while the minimap samples the live transform at a lower rate.

## Input and movement

`services/firstPerson.ts` owns angle conversion, input normalization, movement, collision, grid-cell lookup, save migration, and look-ray interactions. Keyboard and touch input use the same `MovementInput` shape. Diagonal input is normalized, so it does not move faster than straight input.

Movement is delta-time based and runs only during exploration. A small player circle is tested against nearby grid cells. X and Y are resolved separately, allowing wall sliding. The movement loop also accumulates distance for footsteps and updates tile-based events only when the player enters a different cell.

Desktop uses WASD, mouse look, and optional arrow-key turning. A click on the canvas requests Pointer Lock when available. Menus, the map, and combat release it; closing a menu leaves it released until the player clicks the viewport again. Browsers without Pointer Lock use a drag-look fallback.

Mobile uses a virtual analog stick on the left side and horizontal drag on the right side. Those values feed the same movement loop. Vertical look is not simulated because the raycaster has no vertical camera axis.

## Interaction and map

E casts a short forward ray and picks the nearest visible door, exit, or floor prop. A wall stops the ray. Props now require E rather than being collected merely by walking over them. Exits still start their guardian encounter on entry; after the guardian is defeated, E can descend while looking at the exit.

The minimap uses the player's fractional position and angle. Fog of war is updated on tile entry, while the facing arrow is refreshed independently. Tab opens the larger map.

## Save compatibility

New saves include `player.transform`. If a save lacks it, `normalizePlayerTransform` converts the old integer tile coordinates to the tile center and maps N/E/S/W to the corresponding angle. The old `pos` and `dir` fields remain present for older gameplay consumers. Invalid or absent transform values fall back to the same migration path.

## Combat boundary

Combat remains turn-based and still owns its existing intents, actions, and enemy resolution. Exploration movement is inactive during combat and UI modals. The viewport remains full screen beneath its overlay HUD. This provides continuous spatial transforms for a later tactical combat pass without introducing enemy navigation, real-time attacks, projectiles, or runtime-generated assets.
