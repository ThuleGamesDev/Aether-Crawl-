import {
  TileType,
  type AriadneThreadAction,
  type AriadneThreadJunction,
  type AriadneThreadProgress,
  type AriadneThreadRoute,
  type ArchitecturalRoom,
  type DungeonRoom,
  type FloorState,
  type Position,
} from '../types';
import type { MazeLawId } from '../types';
import { getMazeLaw } from '../data/mazeLaws';

export const ARIADNE_THREAD_INITIAL_CHARGES = 2;
export const ARIADNE_THREAD_MAX_CHARGES = 3;
export const ARIADNE_THREAD_GUARDIAN_CHARGE_REWARD = 1;

export type ThreadRisk = 'SAFE' | 'REWARD' | 'LOCKED';

export interface ThreadOfferChoice {
  action: AriadneThreadAction;
  routeId: string;
  arrow: string;
  cost: number;
  healthCost: number;
  risk: ThreadRisk;
  effect: string;
  enabled: boolean;
  disabledReason?: string;
}

export interface ThreadAnchorOffer {
  junctionId: string;
  charges: number;
  maxCharges: number;
  choices: [ThreadOfferChoice, ThreadOfferChoice];
}

export interface ThreadBlocker {
  x: number;
  z: number;
}

export interface ThreadEditContext {
  map: number[][];
  decorations?: number[][];
  floor: FloorState;
  junctionId: string;
  action: AriadneThreadAction;
  lawIds: readonly MazeLawId[];
  player: { x: number; z: number; health: number; maxHealth: number };
  enemies?: readonly (ThreadBlocker & { health: number })[];
  projectiles?: readonly ThreadBlocker[];
  loot?: readonly ThreadBlocker[];
  playerActionActive?: boolean;
}

export interface ThreadEditPlan {
  ok: boolean;
  reason?: string;
  map?: number[][];
  decorations?: number[][];
  progress?: AriadneThreadProgress;
  chargeCost?: number;
  healthCost?: number;
  junction?: AriadneThreadJunction;
  route?: AriadneThreadRoute;
}

export function createAriadneThreadProgress(
  junctions: readonly AriadneThreadJunction[],
  charges = ARIADNE_THREAD_INITIAL_CHARGES,
): AriadneThreadProgress {
  const boundedCharges = Number.isInteger(charges) ? Math.max(0, Math.min(ARIADNE_THREAD_MAX_CHARGES, charges)) : ARIADNE_THREAD_INITIAL_CHARGES;
  return {
    version: 1,
    charges: boundedCharges,
    maxCharges: ARIADNE_THREAD_MAX_CHARGES,
    anchorStates: junctions.map(junction => ({ junctionId: junction.id, discovered: false, used: false })),
    junctionChoices: [],
    topologyRevision: 0,
  };
}

export function awardThreadCharge(progress: AriadneThreadProgress | undefined, junctions: readonly AriadneThreadJunction[] = []): AriadneThreadProgress {
  const current = progress ?? createAriadneThreadProgress(junctions);
  return { ...current, charges: Math.min(current.maxCharges, current.charges + ARIADNE_THREAD_GUARDIAN_CHARGE_REWARD) };
}

export function openThreadAnchor(progress: AriadneThreadProgress, junctionId: string): AriadneThreadProgress | null {
  const anchor = progress.anchorStates.find(state => state.junctionId === junctionId);
  if (!anchor || anchor.used) return null;
  return {
    ...progress,
    anchorStates: progress.anchorStates.map(state => state.junctionId === junctionId ? { ...state, discovered: true } : state),
    openJunctionId: junctionId,
  };
}

export function closeThreadAnchor(progress: AriadneThreadProgress): AriadneThreadProgress {
  if (!progress.openJunctionId) return progress;
  return { ...progress, openJunctionId: undefined };
}

export function buildThreadAnchorOffer(args: {
  map: number[][];
  floor: FloorState;
  junctionId: string;
  lawIds: readonly MazeLawId[];
  player: { x: number; z: number; health: number; maxHealth: number };
  enemies?: readonly (ThreadBlocker & { health: number })[];
  projectiles?: readonly ThreadBlocker[];
  loot?: readonly ThreadBlocker[];
  playerActionActive?: boolean;
}): ThreadAnchorOffer | null {
  const junctions = args.floor.threadJunctions ?? [];
  const junction = junctions.find(candidate => candidate.id === args.junctionId);
  const progress = args.floor.threadProgress;
  if (!junction || !progress || !progress.anchorStates.some(state => state.junctionId === junction.id && state.discovered && !state.used)) return null;
  const reveal = makeOfferChoice(args, junction, junction.revealRoute);
  const seal = makeOfferChoice(args, junction, junction.sealRoute);
  return { junctionId: junction.id, charges: progress.charges, maxCharges: progress.maxCharges, choices: [reveal, seal] };
}

export function planAriadneThreadEdit(context: ThreadEditContext): ThreadEditPlan {
  const floor = context.floor;
  const progress = floor.threadProgress;
  const junction = floor.threadJunctions?.find(candidate => candidate.id === context.junctionId);
  if (!progress || !junction) return { ok: false, reason: 'This Thread Anchor is not part of the saved floor.' };
  if (progress.openJunctionId !== junction.id) return { ok: false, reason: 'Open the Thread Anchor before choosing a route.' };
  const anchor = progress.anchorStates.find(state => state.junctionId === junction.id);
  if (!anchor?.discovered || anchor.used || progress.junctionChoices.some(choice => choice.junctionId === junction.id)) {
    return { ok: false, reason: 'This Thread Anchor has already been woven.' };
  }

  const route = context.action === 'REVEAL_PASSAGE' ? junction.revealRoute : junction.sealRoute;
  if (route.action !== context.action) return { ok: false, reason: 'That route is not prepared at this anchor.' };
  const { chargeCost, healthCost } = threadCosts(context.action, context.lawIds, context.player.maxHealth);
  if (progress.charges < chargeCost) return { ok: false, reason: 'You do not have enough Thread Charges.' };
  if (context.player.health <= healthCost) return { ok: false, reason: 'There is not enough health to pay the Thread’s cost.' };
  if (context.playerActionActive) return { ok: false, reason: 'Finish your active action before weaving the passage.' };

  const changedKeys = new Set<string>();
  const nextMap = context.map.map(row => [...row]);
  const expectedTile = context.action === 'REVEAL_PASSAGE' ? TileType.WALL : TileType.EMPTY;
  const targetTile = context.action === 'REVEAL_PASSAGE' ? TileType.EMPTY : TileType.WALL;
  for (const cell of route.cells) {
    if (!isInBounds(nextMap, cell) || nextMap[cell.y][cell.x] !== expectedTile) {
      return { ok: false, reason: 'The saved passage no longer matches its prepared route.' };
    }
    if (isProtectedCell(floor, cell)) return { ok: false, reason: 'This route touches a protected room, gate, Guardian, or exit.' };
    if (isPositionNearCells(context.player, [cell], 0.64)
      || (context.enemies ?? []).some(enemy => enemy.health > 0 && isPositionNearCells(enemy, [cell], 0.58))
      || (context.projectiles ?? []).some(projectile => isPositionNearCells(projectile, [cell], 0.42))
      || (context.loot ?? []).some(drop => isPositionNearCells(drop, [cell], 0.42))) {
      return { ok: false, reason: 'Clear nearby combat, projectiles, and ground items before changing this passage.' };
    }
    const key = cellKey(cell);
    if (changedKeys.has(key)) return { ok: false, reason: 'The prepared passage contains duplicate cells.' };
    changedKeys.add(key);
    nextMap[cell.y][cell.x] = targetTile;
  }
  if (!route.cells.length) return { ok: false, reason: 'The prepared passage contains no editable cells.' };

  const start = { x: Math.floor(context.player.x), y: Math.floor(context.player.z) };
  const reachableBefore = floodFill(context.map, start);
  const reachableAfter = floodFill(nextMap, start);
  if (!reachableBefore.has(cellKey(start)) || !reachableAfter.has(cellKey(start))) return { ok: false, reason: 'The player route is not safe to edit.' };
  for (const key of reachableBefore) {
    if (context.action === 'SEAL_PASSAGE' && changedKeys.has(key)) continue;
    if (!reachableAfter.has(key)) return { ok: false, reason: 'This passage is the only route to part of the Labyrinth.' };
  }
  const required = collectRequiredPositions(context, reachableBefore);
  for (const point of required) {
    const key = cellKey({ x: Math.floor(point.x), y: Math.floor(point.z) });
    if (reachableBefore.has(key) && !reachableAfter.has(key)) return { ok: false, reason: 'This change would block a required room, encounter, exit, or reward.' };
  }

  const decorations = context.decorations?.map(row => [...row]);
  if (decorations) for (const cell of route.cells) decorations[cell.y][cell.x] = 0;
  const nextProgress: AriadneThreadProgress = {
    ...progress,
    charges: progress.charges - chargeCost,
    anchorStates: progress.anchorStates.map(state => state.junctionId === junction.id ? { ...state, discovered: true, used: true } : state),
    junctionChoices: [...progress.junctionChoices, {
      junctionId: junction.id,
      action: context.action,
      routeId: route.id,
      chargeCost,
      healthCost,
      topologyRevision: progress.topologyRevision + 1,
    }],
    topologyRevision: progress.topologyRevision + 1,
    openJunctionId: undefined,
  };
  return { ok: true, map: nextMap, decorations, progress: nextProgress, chargeCost, healthCost, junction, route };
}

export function validateAriadneThreadState(
  junctions: unknown,
  progress: unknown,
  map: number[][],
): boolean {
  if (!Array.isArray(junctions) || junctions.length > 2) return false;
  if (!progress || typeof progress !== 'object') return false;
  const state = progress as AriadneThreadProgress;
  if (state.version !== 1 || state.maxCharges !== ARIADNE_THREAD_MAX_CHARGES
    || !Number.isInteger(state.charges) || state.charges < 0 || state.charges > state.maxCharges
    || !Number.isInteger(state.topologyRevision) || state.topologyRevision < 0 || state.topologyRevision > junctions.length
    || !Array.isArray(state.anchorStates) || state.anchorStates.length !== junctions.length
    || !Array.isArray(state.junctionChoices) || state.junctionChoices.length > junctions.length) return false;

  const byId = new Map<string, AriadneThreadJunction>();
  for (const raw of junctions) {
    if (!isThreadJunction(raw, map) || byId.has(raw.id)) return false;
    byId.set(raw.id, raw);
  }
  const anchorIds = new Set<string>();
  for (const raw of state.anchorStates) {
    if (!raw || typeof raw.junctionId !== 'string' || anchorIds.has(raw.junctionId) || !byId.has(raw.junctionId)
      || typeof raw.discovered !== 'boolean' || typeof raw.used !== 'boolean') return false;
    anchorIds.add(raw.junctionId);
  }
  const choices = new Map<string, AriadneThreadProgress['junctionChoices'][number]>();
  for (let index = 0; index < state.junctionChoices.length; index += 1) {
    const choice = state.junctionChoices[index];
    const junction = byId.get(choice?.junctionId);
    if (!junction || choices.has(choice.junctionId) || !['REVEAL_PASSAGE', 'SEAL_PASSAGE'].includes(choice.action)
      || !Number.isInteger(choice.chargeCost) || choice.chargeCost < 0 || choice.chargeCost > state.maxCharges
      || !Number.isInteger(choice.healthCost) || choice.healthCost < 0 || choice.healthCost > 100_000
      || choice.topologyRevision !== index + 1) return false;
    const route = choice.action === 'REVEAL_PASSAGE' ? junction.revealRoute : junction.sealRoute;
    if (route.id !== choice.routeId) return false;
    const resultingTile = choice.action === 'REVEAL_PASSAGE' ? TileType.EMPTY : TileType.WALL;
    if (!route.cells.every(cell => map[cell.y]?.[cell.x] === resultingTile)) return false;
    choices.set(choice.junctionId, choice);
  }
  if (state.topologyRevision !== state.junctionChoices.length) return false;
  for (const anchor of state.anchorStates) {
    if (anchor.used !== choices.has(anchor.junctionId) || anchor.used && !anchor.discovered) return false;
  }
  if (state.openJunctionId !== undefined) {
    const opened = state.anchorStates.find(anchor => anchor.junctionId === state.openJunctionId);
    if (!opened || !opened.discovered || opened.used) return false;
  }
  for (const junction of byId.values()) {
    const choice = choices.get(junction.id);
    const inactiveRoute = choice?.action === 'REVEAL_PASSAGE' ? junction.sealRoute : junction.revealRoute;
    const inactiveTile = inactiveRoute.action === 'REVEAL_PASSAGE' ? TileType.WALL : TileType.EMPTY;
    if (!inactiveRoute.cells.every(cell => map[cell.y]?.[cell.x] === inactiveTile)) return false;
    if (!choice && (!junction.revealRoute.cells.every(cell => map[cell.y]?.[cell.x] === TileType.WALL)
      || !junction.sealRoute.cells.every(cell => map[cell.y]?.[cell.x] === TileType.EMPTY))) return false;
  }
  return true;
}

export function validateAriadneThreadFloor(
  junctions: unknown,
  progress: unknown,
  map: number[][],
  architectureRooms: readonly ArchitecturalRoom[] = [],
  rooms: readonly DungeonRoom[] = [],
): boolean {
  if (!Array.isArray(junctions) || junctions.length > 2) return false;
  if (junctions.length > 0 && !progress) return false;
  if (progress !== undefined && !validateAriadneThreadState(junctions, progress, map)) return false;
  const architecture = new Map((architectureRooms ?? []).map(room => [room.id, room]));
  const seenAnchors = new Set<string>();
  for (const raw of junctions) {
    if (!isThreadJunction(raw, map)) return false;
    const junction = raw;
    const anchorRoom = architecture.get(junction.anchorRoomId);
    const key = cellKey(junction.anchorPosition);
    if (!anchorRoom || anchorRoom.threadJunctionId !== junction.id || seenAnchors.has(key)
      || !anchorRoom.cells.some(cell => sameCell(cell, junction.anchorPosition))
      || map[junction.anchorPosition.y]?.[junction.anchorPosition.x] !== TileType.EMPTY) return false;
    seenAnchors.add(key);
    for (const route of [junction.revealRoute, junction.sealRoute]) {
      const destination = architecture.get(route.toRoomId);
      if (!destination || destination.id === anchorRoom.id) return false;
      for (const cell of route.cells) {
        if (architecture.get(route.fromRoomId)?.cells.some(candidate => sameCell(candidate, cell))
          || destination.cells.some(candidate => sameCell(candidate, cell))) return false;
        if (rooms.some(room => (room.gate && sameCell(room.gate, cell))
          || (room.type !== 'NORMAL' && (sameCell(room.anchor, cell)
            || (room.type === 'BOSS' || room.type === 'BOSS_ANTECHAMBER' || (room.type === 'COMBAT' || room.type === 'ELITE') && !room.resolved)
              && room.cells.some(candidate => sameCell(candidate, cell)))))) return false;
      }
    }
  }
  return true;
}

export function directionArrow(direction: AriadneThreadRoute['direction']): string {
  return direction === 'NORTH' ? '↑' : direction === 'EAST' ? '→' : direction === 'SOUTH' ? '↓' : '←';
}

function makeOfferChoice(
  args: Parameters<typeof buildThreadAnchorOffer>[0],
  junction: AriadneThreadJunction,
  route: AriadneThreadRoute,
): ThreadOfferChoice {
  const action = route.action;
  const { chargeCost, healthCost } = threadCosts(action, args.lawIds, args.player.maxHealth);
  let reason: string | undefined;
  let risk: ThreadRisk = 'SAFE';
  if (args.playerActionActive) reason = 'Finish your active action before weaving the passage.';
  else if (args.floor.threadProgress!.charges < chargeCost) reason = 'You do not have enough Thread Charges.';
  else if (args.player.health <= healthCost) reason = 'There is not enough health to pay the Thread’s cost.';
  else if (isPositionNearCells(args.player, route.cells, 0.64)
    || (args.enemies ?? []).some(enemy => enemy.health > 0 && isPositionNearCells(enemy, route.cells, 0.58))
    || (args.projectiles ?? []).some(projectile => isPositionNearCells(projectile, route.cells, 0.42))
    || (args.loot ?? []).some(drop => isPositionNearCells(drop, route.cells, 0.42))) {
    reason = 'Clear nearby combat, projectiles, and ground items before changing this passage.';
  } else {
    const plan = planAriadneThreadEdit({ ...args, junctionId: junction.id, action });
    if (!plan.ok) reason = plan.reason;
  }
  if (!reason && action === 'REVEAL_PASSAGE' && reachesKnownRewardRoom(args.floor, junction, route)) risk = 'REWARD';
  if (reason) risk = 'LOCKED';
  return {
    action,
    routeId: route.id,
    arrow: directionArrow(route.direction),
    cost: chargeCost,
    healthCost,
    risk,
    effect: action === 'REVEAL_PASSAGE' ? 'Open a prepared side passage without uncovering secret rooms.' : 'Close this optional loop while preserving every reachable floor cell.',
    enabled: !reason,
    ...(reason ? { disabledReason: reason } : {}),
  };
}

function threadCosts(action: AriadneThreadAction, lawIds: readonly MazeLawId[], maxHealth: number): { chargeCost: number; healthCost: number } {
  let chargeDelta = 0;
  let healthPercent = 0;
  if (action === 'REVEAL_PASSAGE') for (const lawId of lawIds) {
    const effect = getMazeLaw(lawId)?.threadEffect;
    chargeDelta += effect?.revealChargeDelta ?? 0;
    healthPercent += effect?.revealHealthCostPercent ?? 0;
  }
  const chargeCost = Math.max(0, Math.min(ARIADNE_THREAD_MAX_CHARGES, 1 + chargeDelta));
  const healthCost = Math.max(0, Math.ceil(Math.min(0.25, healthPercent) * Math.max(1, maxHealth)));
  return { chargeCost, healthCost };
}

function reachesKnownRewardRoom(floor: FloorState, junction: AriadneThreadJunction, route: AriadneThreadRoute): boolean {
  const layouts = floor.architectureRooms ?? [];
  const toRoom = layouts.find(room => room.id === route.toRoomId);
  if (!toRoom) return false;
  const cells = new Set(toRoom.cells.map(cellKey));
  return floor.rooms.some(room => room.discovered && room.type !== 'SECRET' && room.type !== 'LOCKED'
    && ['TREASURE', 'SHRINE', 'REST'].includes(room.type)
    && (cells.has(cellKey(room.anchor)) || room.cells.some(cell => cells.has(cellKey(cell)))));
}

function collectRequiredPositions(context: ThreadEditContext, reachable: Set<string>): Array<{ x: number; z: number }> {
  const required: Array<{ x: number; z: number }> = [{ x: context.player.x, z: context.player.z }];
  for (let z = 0; z < context.map.length; z += 1) for (let x = 0; x < (context.map[z]?.length ?? 0); x += 1) {
    if (context.map[z][x] === TileType.EXIT) required.push({ x: x + 0.5, z: z + 0.5 });
  }
  for (const room of context.floor.rooms) {
    const hiddenSecret = room.type === 'SECRET' && !room.discovered && !room.unlocked;
    if (!hiddenSecret && (room.type === 'BOSS' || room.type === 'BOSS_ANTECHAMBER' || !room.resolved && room.type !== 'NORMAL' || room.discovered || room.visited)) {
      required.push({ x: room.anchor.x + 0.5, z: room.anchor.y + 0.5 });
    }
    if ((room.type === 'SECRET' || room.type === 'LOCKED') && room.gate) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = room.gate.x + dx, z = room.gate.y + dz;
        if (reachable.has(`${x},${z}`)) required.push({ x: x + 0.5, z: z + 0.5 });
      }
    }
    if ((room.type === 'COMBAT' || room.type === 'ELITE') && !room.resolved) {
      for (const cell of room.cells) if (reachable.has(cellKey(cell))) required.push({ x: cell.x + 0.5, z: cell.y + 0.5 });
    }
  }
  for (const enemy of context.enemies ?? []) if (enemy.health > 0) required.push({ x: enemy.x, z: enemy.z });
  for (const drop of context.loot ?? []) required.push({ x: drop.x, z: drop.z });
  return required;
}

function floodFill(map: number[][], start: Position): Set<string> {
  if (!isWalkable(map[start.y]?.[start.x])) return new Set();
  const queue = [start], seen = new Set([cellKey(start)]);
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let index = 0; index < queue.length; index += 1) for (const [dx, dz] of directions) {
    const next = { x: queue[index].x + dx, y: queue[index].y + dz };
    const key = cellKey(next);
    if (seen.has(key) || !isWalkable(map[next.y]?.[next.x])) continue;
    seen.add(key);
    queue.push(next);
  }
  return seen;
}

function isWalkable(tile: number | undefined): boolean {
  return isThreadWalkableTile(tile);
}

/** Thread safety checks use the same closed-door rule as world collision and floor reachability. */
export function isThreadWalkableTile(tile: number | undefined): boolean {
  return tile === TileType.EMPTY || tile === TileType.EXIT;
}

function isProtectedCell(floor: FloorState, cell: Position): boolean {
  if ((floor.architectureRooms ?? []).some(room => room.roomShape === 'GUARDIAN_ARENA' && room.cells.some(candidate => sameCell(candidate, cell)))) return true;
  return floor.rooms.some(room => {
    if (room.gate && sameCell(room.gate, cell)) return true;
    if (room.type === 'BOSS' || room.type === 'BOSS_ANTECHAMBER') {
      return room.cells.some(candidate => sameCell(candidate, cell)) || sameCell(room.anchor, cell);
    }
    if ((room.type === 'COMBAT' || room.type === 'ELITE') && !room.resolved) return room.cells.some(candidate => sameCell(candidate, cell));
    return room.type !== 'NORMAL' && sameCell(room.anchor, cell);
  });
}

function isThreadJunction(value: unknown, map: number[][]): value is AriadneThreadJunction {
  if (!isThreadJunctionShape(value)) return false;
  const junction = value;
  const bounds = (cell: Position) => isPosition(cell) && cell.x < (map[0]?.length ?? 0) && cell.y < map.length;
  return bounds(junction.anchorPosition)
    && junction.revealRoute.cells.every(bounds)
    && junction.sealRoute.cells.every(bounds)
    && junction.revealRoute.direction !== junction.sealRoute.direction
    && junction.revealRoute.fromRoomId === junction.anchorRoomId
    && junction.sealRoute.fromRoomId === junction.anchorRoomId
    && junction.revealRoute.toRoomId !== junction.anchorRoomId
    && junction.sealRoute.toRoomId !== junction.anchorRoomId
    && ![...junction.revealRoute.cells, ...junction.sealRoute.cells].some(cell => sameCell(cell, junction.anchorPosition))
    && !junction.revealRoute.cells.some(cell => junction.sealRoute.cells.some(other => sameCell(cell, other)));
}

function isThreadRoute(value: unknown, action: AriadneThreadAction): value is AriadneThreadRoute {
  const route = value as AriadneThreadRoute;
  return Boolean(route && typeof route.id === 'string' && /^thread_route_[a-z0-9_]{1,96}$/.test(route.id)
    && route.action === action && ['NORTH', 'EAST', 'SOUTH', 'WEST'].includes(route.direction)
    && typeof route.fromRoomId === 'string' && typeof route.toRoomId === 'string'
    && Array.isArray(route.cells) && route.cells.length > 0 && route.cells.length <= 64
    && route.cells.every(isPosition) && new Set(route.cells.map(cellKey)).size === route.cells.length);
}

function isThreadJunctionShape(value: unknown): value is AriadneThreadJunction {
  const junction = value as AriadneThreadJunction;
  return Boolean(junction && typeof junction.id === 'string' && /^thread_[a-z0-9_]{1,96}$/.test(junction.id)
    && typeof junction.anchorRoomId === 'string' && isPosition(junction.anchorPosition)
    && isThreadRoute(junction.revealRoute, 'REVEAL_PASSAGE') && isThreadRoute(junction.sealRoute, 'SEAL_PASSAGE'));
}

function isPosition(value: unknown): value is Position {
  const position = value as Position;
  return Boolean(position && Number.isInteger(position.x) && Number.isInteger(position.y) && position.x >= 0 && position.y >= 0);
}

function isInBounds(map: number[][], cell: Position): boolean {
  return cell.y >= 0 && cell.y < map.length && cell.x >= 0 && cell.x < (map[cell.y]?.length ?? 0);
}

function isPositionNearCells(position: { x: number; z: number }, cells: Position[], radius: number): boolean {
  return cells.some(cell => {
    const nearestX = Math.max(cell.x, Math.min(position.x, cell.x + 1));
    const nearestZ = Math.max(cell.y, Math.min(position.z, cell.y + 1));
    return Math.hypot(position.x - nearestX, position.z - nearestZ) < radius;
  });
}

function cellKey(cell: Position): string { return `${cell.x},${cell.y}`; }
function sameCell(a: Position, b: Position): boolean { return a.x === b.x && a.y === b.y; }
