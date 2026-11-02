import type { InventoryGridPlacement, ItemInstance } from '../types';

export const INVENTORY_GRID_WIDTH = 10;
export const INVENTORY_GRID_HEIGHT = 5;
export const MAX_CONSUMABLE_STACK = 20;

export interface InventoryGridState {
  placements: InventoryGridPlacement[];
  overflowIds: string[];
}

export interface GridMoveResult extends InventoryGridState {
  moved: boolean;
  swapped: boolean;
}

/** Stable footprints keep the 10×5 bag readable without turning it into item Tetris. */
export function itemFootprint(item: ItemInstance): { width: number; height: number } {
  if (item.type === 'POTION' || item.type === 'SCROLL' || item.type === 'ACCESSORY') return { width: 1, height: 1 };
  if (item.type === 'SHIELD' || item.type === 'ARMOR') return { width: 2, height: 2 };
  if (item.type !== 'WEAPON') return { width: 1, height: 1 };
  if (item.baseId === 'labrys' || item.baseId === 'labyrinth_bow' || item.baseId === 'cyclopean_hammer') return { width: 2, height: 3 };
  if (item.visualType === 'staff') return { width: 1, height: 3 };
  if (item.visualType === 'spear' || item.visualType === 'bow' || item.visualType === 'axe' || item.visualType === 'mace') return { width: 2, height: 3 };
  if (item.visualType === 'dagger') return { width: 1, height: 2 };
  return { width: 1, height: 2 };
}

/** Keeps valid saved positions, then packs missing items in stable row-major order. */
export function normalizeInventoryGrid(
  items: readonly ItemInstance[],
  saved: readonly InventoryGridPlacement[] = [],
): InventoryGridState {
  const byId = new Map(items.map(item => [item.instanceId, item]));
  const placements: InventoryGridPlacement[] = [];
  const placed = new Set<string>();
  const occupied = Array.from({ length: INVENTORY_GRID_HEIGHT }, () => Array<boolean>(INVENTORY_GRID_WIDTH).fill(false));

  for (const entry of saved) {
    if (!entry || typeof entry.instanceId !== 'string' || placed.has(entry.instanceId)) continue;
    const item = byId.get(entry.instanceId);
    if (!item || !Number.isInteger(entry.x) || !Number.isInteger(entry.y)) continue;
    if (canPlace(item, entry.x, entry.y, occupied)) {
      occupy(item, entry.x, entry.y, occupied, true);
      placements.push({ instanceId: entry.instanceId, x: entry.x, y: entry.y });
      placed.add(entry.instanceId);
    }
  }

  const overflowIds: string[] = [];
  for (const item of items) {
    if (placed.has(item.instanceId)) continue;
    const spot = firstFit(item, occupied);
    if (!spot) { overflowIds.push(item.instanceId); continue; }
    occupy(item, spot.x, spot.y, occupied, true);
    placements.push({ instanceId: item.instanceId, ...spot });
    placed.add(item.instanceId);
  }
  return { placements, overflowIds };
}

/** Strict validation for persisted layouts; overflow items intentionally have no placement. */
export function validateInventoryGrid(items: readonly ItemInstance[], placements: unknown): placements is InventoryGridPlacement[] {
  if (!Array.isArray(placements) || placements.length > items.length) return false;
  const byId = new Map(items.map(item => [item.instanceId, item]));
  const ids = new Set<string>();
  const occupied = Array.from({ length: INVENTORY_GRID_HEIGHT }, () => Array<boolean>(INVENTORY_GRID_WIDTH).fill(false));
  for (const entry of placements) {
    if (!entry || typeof entry !== 'object') return false;
    const candidate = entry as InventoryGridPlacement;
    if (typeof candidate.instanceId !== 'string' || ids.has(candidate.instanceId) || !Number.isInteger(candidate.x) || !Number.isInteger(candidate.y)) return false;
    const item = byId.get(candidate.instanceId);
    if (!item || !canPlace(item, candidate.x, candidate.y, occupied)) return false;
    occupy(item, candidate.x, candidate.y, occupied, true);
    ids.add(candidate.instanceId);
  }
  return true;
}

/** Click/tap placement. Occupied targets perform an atomic swap when both footprints fit. */
export function moveInventoryGridItem(
  items: readonly ItemInstance[],
  saved: readonly InventoryGridPlacement[],
  instanceId: string,
  x: number,
  y: number,
): GridMoveResult {
  const current = normalizeInventoryGrid(items, saved);
  const source = current.placements.find(entry => entry.instanceId === instanceId);
  const moving = items.find(item => item.instanceId === instanceId);
  if (!moving || !Number.isInteger(x) || !Number.isInteger(y)) return { ...current, moved: false, swapped: false };

  const target = current.placements.find(entry => entry.instanceId !== instanceId && contains(items.find(item => item.instanceId === entry.instanceId)!, entry, x, y));
  const targetX = target?.x ?? x;
  const targetY = target?.y ?? y;
  const candidate = current.placements.filter(entry => entry.instanceId !== instanceId && (!source || entry.instanceId !== target?.instanceId));
  candidate.push({ instanceId, x: targetX, y: targetY });
  if (target && source) candidate.push({ instanceId: target.instanceId, x: source.x, y: source.y });
  if (!validateInventoryGrid(items, candidate)) return { ...current, moved: false, swapped: false };
  const normalized = normalizeInventoryGrid(items, candidate);
  return { ...normalized, moved: true, swapped: Boolean(target && source) };
}

/** Repackages on equipment/stack changes while preserving all items, including overflow. */
export function syncInventoryGrid(items: readonly ItemInstance[], saved?: readonly InventoryGridPlacement[]): InventoryGridPlacement[] {
  return normalizeInventoryGrid(items, saved).placements;
}

/** Splits malformed/legacy quantities into real instances and bounded consumable stacks. */
export function normalizeInventoryStacks(items: readonly ItemInstance[], reservedIds: readonly string[] = []): ItemInstance[] {
  const reserved = new Set([...reservedIds, ...items.map(item => item.instanceId)]);
  const emitted = new Set<string>();
  const result: ItemInstance[] = [];
  for (const source of items) {
    const stackable = consumableStackKey(source) !== null;
    let remaining = Number.isInteger(source.quantity) && source.quantity > 0 ? source.quantity : 1;
    let part = 0;
    while (remaining > 0) {
      const quantity = stackable ? Math.min(MAX_CONSUMABLE_STACK, remaining) : 1;
      let instanceId = source.instanceId;
      if (part > 0 || emitted.has(instanceId)) {
        const stem = source.instanceId + (stackable ? '_stack_' : '_unit_');
        let suffix = Math.max(2, part + 1);
        instanceId = stem + suffix;
        while (reserved.has(instanceId) || emitted.has(instanceId)) instanceId = stem + ++suffix;
      }
      result.push({ ...source, instanceId, quantity });
      emitted.add(instanceId);
      reserved.add(instanceId);
      remaining -= quantity;
      part += 1;
    }
  }
  return result;
}

/** Only identical consumables merge; equipment identities and affix rolls remain distinct. */
export function consumableStackKey(item: ItemInstance): string | null {
  if (item.type !== 'POTION' && item.type !== 'SCROLL') return null;
  return [item.baseId ?? item.id, item.itemLevel, item.rarity, item.consumableEffect ?? '', JSON.stringify(item.affixes ?? [])].join('|');
}

function firstFit(item: ItemInstance, occupied: boolean[][]): { x: number; y: number } | null {
  for (let y = 0; y < INVENTORY_GRID_HEIGHT; y += 1) {
    for (let x = 0; x < INVENTORY_GRID_WIDTH; x += 1) if (canPlace(item, x, y, occupied)) return { x, y };
  }
  return null;
}

function canPlace(item: ItemInstance, x: number, y: number, occupied: boolean[][]): boolean {
  const { width, height } = itemFootprint(item);
  if (x < 0 || y < 0 || x + width > INVENTORY_GRID_WIDTH || y + height > INVENTORY_GRID_HEIGHT) return false;
  for (let row = y; row < y + height; row += 1) for (let column = x; column < x + width; column += 1) if (occupied[row][column]) return false;
  return true;
}

function occupy(item: ItemInstance, x: number, y: number, occupied: boolean[][], value: boolean): void {
  const { width, height } = itemFootprint(item);
  for (let row = y; row < y + height; row += 1) for (let column = x; column < x + width; column += 1) occupied[row][column] = value;
}

function contains(item: ItemInstance, placement: InventoryGridPlacement, x: number, y: number): boolean {
  const { width, height } = itemFootprint(item);
  return x >= placement.x && x < placement.x + width && y >= placement.y && y < placement.y + height;
}
