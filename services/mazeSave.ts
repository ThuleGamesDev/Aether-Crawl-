import type { EquipmentSlot, FloorState, ItemInstance, LegacyPlayerCharacter, PlayerCharacter, WorldEnemy, WorldLootDrop } from '../types';
import { isFPSRunSave, loadFPSGame, type FPSRunSave, type KeyValueStorage } from './fpsSave';
import type { DungeonWorldState } from '../world/DungeonWorld';
import { TileType } from '../types';
import { enemyDefinitions } from '../data/enemies';
import { getFloorGuardianDefinition } from '../data/mazeContent';
import { getAbility } from '../combat/AbilityRegistry';
import { CLASSES } from '../constants';
import { normalizeLegacyItem } from './itemization';
import { refreshPlayerDerivedCaps } from '../player/PlayerProgression';
import { getItemBase } from '../data/itemBases';
import { consumableStackKey, normalizeInventoryGrid, normalizeInventoryStacks, syncInventoryGrid, validateInventoryGrid, MAX_CONSUMABLE_STACK } from './inventoryGrid';
import { getUniqueItem, isUniqueEffectId, MAX_UNIQUE_EFFECT_STATE_COUNT } from '../data/uniqueItems';
import { createEmptyEquipment, getItemEquipmentSlots, isTwoHandedItem, MAX_INVENTORY_INSTANCES, validateEquipmentLoadout } from './equipmentRules';
import { createEmptyMazeLawProgress, createLawDraft } from './lawDraft';
import { validateLawProgress } from '../world/LivingLabyrinth';
import { createAriadneThreadProgress, validateAriadneThreadFloor } from './ariadneThread';

export const MAZE_SAVE_KEY = 'maze_of_the_minotaur_fps_r2a_save_v2';
export const MAZE_SAVE_VERSION = 7;
export interface MazeRunSave {
  version: 7;
  savedAt: number;
  player: PlayerCharacter;
  world: DungeonWorldState;
  enemies: WorldEnemy[];
  loot: WorldLootDrop[];
  combat?: FPSRunSave['combat'];
  migratedFrom?: 'FPS_R1' | 'FPS_R2A' | 'FPS_R4A' | 'FPS_R4B' | 'FPS_R6C' | 'FPS_R6D1';
}
export type MazeRunState = Pick<MazeRunSave, 'player' | 'world' | 'enemies' | 'loot' | 'combat'>;

export function saveMazeGame(save: MazeRunState, storage?: KeyValueStorage): boolean {
  try {
    const target = storage ?? defaultStorage();
    if (!target) return false;
    const inventory = normalizeInventoryStacks(save.player.inventory);
    if (inventory.length > MAX_INVENTORY_INSTANCES) return false;
    const player: PlayerCharacter = {
      ...save.player,
      inventory,
      inventoryGrid: normalizeInventoryGrid(inventory, save.player.inventoryGrid).placements,
      uniqueEffectStates: save.player.uniqueEffectStates ?? [],
    };
    const envelope: MazeRunSave = { ...save, player, world: withThreadProgress(withLawProgress(save.world)), version: MAZE_SAVE_VERSION, savedAt: Date.now() };
    if (!isMazeRunSave(envelope)) return false;
    target.setItem(MAZE_SAVE_KEY, JSON.stringify(envelope));
    return true;
  } catch { return false; }
}

export function loadMazeGame(storage?: KeyValueStorage): { save: MazeRunSave | null; invalid: boolean; migratedFromR1: boolean; migratedFromR2A: boolean; migratedFromR4A: boolean; migratedFromR4B: boolean; migratedFromR6C: boolean; migratedFromR6D1: boolean; migrationRequired: boolean } {
  const target = storage ?? defaultStorage();
  if (!target) return emptyLoadResult(true);
  try {
    const raw = target.getItem(MAZE_SAVE_KEY);
    if (raw) {
      const value: unknown = JSON.parse(raw);
      if (isMazeRunSave(value)) return emptyLoadResult(false, value);
      if (isLegacyMazeRunSaveV6(value)) {
        const migrated = migrateR6D1Save(value);
        return isMazeRunSave(migrated)
          ? { ...emptyLoadResult(false, migrated), migratedFromR6D1: true, migrationRequired: true }
          : emptyLoadResult(true);
      }
      if (isLegacyMazeRunSaveV5(value)) {
        const migrated = migrateR6CSave(value);
        return isMazeRunSave(migrated)
          ? { ...emptyLoadResult(false, migrated), migratedFromR6C: true, migrationRequired: true }
          : emptyLoadResult(true);
      }
      if (isLegacyMazeRunSaveV4(value)) {
        const migrated = migrateR4BSave(value);
        return isMazeRunSave(migrated)
          ? { ...emptyLoadResult(false, migrated), migratedFromR4B: true, migrationRequired: true }
          : emptyLoadResult(true);
      }
      if (isLegacyMazeRunSaveV3(value)) {
        const migrated = migrateR4ASave(value);
        return isMazeRunSave(migrated)
          ? { ...emptyLoadResult(false, migrated), migratedFromR4A: true, migrationRequired: true }
          : emptyLoadResult(true);
      }
      if (isLegacyMazeRunSaveV2(value)) {
        const migrated = migrateR2ASave(value);
        return isMazeRunSave(migrated)
          ? { ...emptyLoadResult(false, migrated), migratedFromR2A: true, migrationRequired: true }
          : emptyLoadResult(true);
      }
      return emptyLoadResult(true);
    }
  } catch { return emptyLoadResult(true); }
  const legacy = loadFPSGame(target);
  if (legacy.invalid) return emptyLoadResult(true);
  if (!legacy.save) return emptyLoadResult(false);
  try {
    const migrated = migrateR1Save(legacy.save);
    return isMazeRunSave(migrated)
      ? { ...emptyLoadResult(false, migrated), migratedFromR1: true, migrationRequired: true }
      : emptyLoadResult(true);
  } catch { return emptyLoadResult(true); }
}

function emptyLoadResult(invalid: boolean, save: MazeRunSave | null = null) {
  return { save, invalid, migratedFromR1: false, migratedFromR2A: false, migratedFromR4A: false, migratedFromR4B: false, migratedFromR6C: false, migratedFromR6D1: false, migrationRequired: false };
}

export function isMazeRunSave(value: unknown): value is MazeRunSave {
  if (!isRecord(value) || value.version !== MAZE_SAVE_VERSION || !Number.isFinite(value.savedAt)) return false;
  const legacyShape = { ...value, version: 1 };
  if (!isFPSRunSave(legacyShape, true, true, 'canonical')) return false;
  if (!validateEquipmentLoadout(value.player.equipment)) return false;
  const floor = value.world.floor as FloorState;
  const guardian = getFloorGuardianDefinition(value.world.level);
  if (floor.guardianId !== guardian.id || !['NOT_DISCOVERED', 'ALIVE', 'DEFEATED', 'DESCENT_UNLOCKED'].includes(String(floor.guardianState))) return false;
  if (!floor.lawProgress || !validateLawProgress(floor.lawProgress)) return false;
  if (!Array.isArray(floor.threadJunctions) || !floor.threadProgress
    || !validateAriadneThreadFloor(floor.threadJunctions, floor.threadProgress, value.world.map, floor.architectureRooms ?? [], floor.rooms)) return false;
  if (floor.guardianState === 'DESCENT_UNLOCKED' && (!floor.lawProgress.draft || floor.lawProgress.draft.guardianId !== guardian.id || floor.lawProgress.draft.floorLevel !== floor.level)) return false;
  const guardians = value.enemies.filter((enemy: WorldEnemy) => enemy.definitionId === guardian.id);
  if (guardians.length !== 1 || !guardians[0].isBoss) return false;
  if (floor.guardianState === 'DESCENT_UNLOCKED' && (guardians[0].health > 0 || !guardians[0].rewardGranted)) return false;
  if (value.combat !== undefined && value.combat !== null) {
    const combat = value.combat;
    if (!isRecord(combat) || !isRecord(combat.cooldowns) || Object.entries(combat.cooldowns).some(([id, cooldown]) => !getAbility(id) || !Number.isFinite(cooldown) || Number(cooldown) < 0)) return false;
  }
  const allItems = [...value.player.inventory, ...Object.values(value.player.equipment).filter(Boolean), ...value.loot.map((drop: WorldLootDrop) => drop.item)] as ItemInstance[];
  if (value.player.inventory.length > MAX_INVENTORY_INSTANCES) return false;
  if (new Set(allItems.map(item => item.instanceId)).size !== allItems.length) return false;
  if (!hasValidStackQuantities(value.player.inventory, Object.values(value.player.equipment).filter(Boolean) as ItemInstance[])) return false;
  if (!validateInventoryGrid(value.player.inventory, value.player.inventoryGrid)) return false;
  if (!isUniqueEffectStateList(value.player.uniqueEffectStates)) return false;
  return true;
}

interface LegacyMazeRunSaveCore extends Omit<FPSRunSave, 'version'> { version: 2 | 3 | 4; migratedFrom?: 'FPS_R1' | 'FPS_R2A' | 'FPS_R4A'; }
type LegacyMazeRunSaveV5 = Omit<MazeRunSave, 'version'> & { version: 5 };
type LegacyMazeRunSaveV6 = Omit<MazeRunSave, 'version'> & { version: 6 };
type LegacyMazeRunSaveV2 = LegacyMazeRunSaveCore & { version: 2 };
type LegacyMazeRunSaveV3 = LegacyMazeRunSaveCore & { version: 3 };
type LegacyMazeRunSaveV4 = LegacyMazeRunSaveCore & { version: 4 };

function isLegacyMazeRunSaveV3(value: unknown): value is LegacyMazeRunSaveV3 {
  return isLegacyMazeSaveCore(value, 3, true);
}

function isLegacyMazeRunSaveV6(value: unknown): value is LegacyMazeRunSaveV6 {
  if (!isRecord(value) || value.version !== 6 || !Number.isFinite(value.savedAt)
    || !isRecord(value.world) || !isRecord(value.world.floor)) return false;
  const normalized = { ...value, version: MAZE_SAVE_VERSION, world: withThreadProgress(value.world as DungeonWorldState) };
  return isMazeRunSave(normalized);
}

function isLegacyMazeRunSaveV2(value: unknown): value is LegacyMazeRunSaveV2 { return isLegacyMazeSaveCore(value, 2, false); }
function isLegacyMazeRunSaveV4(value: unknown): value is LegacyMazeRunSaveV4 { return isLegacyMazeSaveCore(value, 4, true); }
function isLegacyMazeRunSaveV5(value: unknown): value is LegacyMazeRunSaveV5 {
  if (!isRecord(value) || value.version !== 5 || !Number.isFinite(value.savedAt)) return false;
  if (!isFPSRunSave({ ...value, version: 1 }, true, true, 'canonical')) return false;
  const floor = value.world.floor as FloorState;
  const guardian = getFloorGuardianDefinition(value.world.level);
  const guardians = value.enemies.filter((enemy: WorldEnemy) => enemy.definitionId === guardian.id);
  return floor.guardianId === guardian.id && ['NOT_DISCOVERED', 'ALIVE', 'DEFEATED', 'DESCENT_UNLOCKED'].includes(String(floor.guardianState))
    && guardians.length === 1 && guardians[0].isBoss && (floor.guardianState !== 'DESCENT_UNLOCKED' || guardians[0].health <= 0 && guardians[0].rewardGranted);
}

function isLegacyMazeSaveCore(value: unknown, version: 2 | 3 | 4, isR4A: boolean): value is LegacyMazeRunSaveCore {
  if (!isRecord(value) || value.version !== version || !Number.isFinite(value.savedAt)) return false;
  if (!isFPSRunSave({ ...value, version: 1 }, isR4A, isR4A)) return false;
  const floor = value.world.floor as FloorState;
  const guardian = getFloorGuardianDefinition(value.world.level);
  const guardians = value.enemies.filter((enemy: WorldEnemy) => enemy.definitionId === guardian.id);
  if (floor.guardianId !== guardian.id || !['NOT_DISCOVERED', 'ALIVE', 'DEFEATED', 'DESCENT_UNLOCKED'].includes(String(floor.guardianState))) return false;
  if (guardians.length !== 1 || !guardians[0].isBoss) return false;
  if (floor.guardianState === 'DESCENT_UNLOCKED' && (guardians[0].health > 0 || !guardians[0].rewardGranted)) return false;
  return true;
}

/** R4B v4 migration preserves stable item identities while mapping the old four slots. */
export function migrateR4BSave(save: LegacyMazeRunSaveV4): MazeRunSave {
  assertUniqueLegacyItemIds(save);
  const player = normalizePlayerItems(save.player);
  return { ...save, version: 7, savedAt: Date.now(), migratedFrom: 'FPS_R4B', player, world: withThreadProgress(withLawProgress(save.world)) };
}

/** R4A migration preserves every stored instance and deterministically packs its old list. */
export function migrateR4ASave(save: LegacyMazeRunSaveV3): MazeRunSave {
  assertUniqueLegacyItemIds(save);
  const player = normalizePlayerItems(save.player);
  return { ...save, version: 7, savedAt: Date.now(), migratedFrom: 'FPS_R4A', player, world: withThreadProgress(withLawProgress(save.world)) };
}

/** R6C version-5 runs retain their exact inventory and world; only versioned Law state is initialized. */
export function migrateR6CSave(save: LegacyMazeRunSaveV5): MazeRunSave {
  const world = withLawProgress(save.world);
  return { ...save, version: 7, savedAt: Date.now(), migratedFrom: 'FPS_R6C', world: withThreadProgress(world) };
}

/** R6D1 version-6 runs retain their exact floor geometry; only per-floor Thread state is initialized. */
export function migrateR6D1Save(save: LegacyMazeRunSaveV6): MazeRunSave {
  return { ...save, version: 7, savedAt: Date.now(), migratedFrom: 'FPS_R6D1', world: withThreadProgress(save.world) };
}

/** In-memory conversion only. The v2 source key is replaced only after a valid v4 write. */
export function migrateR2ASave(save: LegacyMazeRunSaveV2): MazeRunSave {
  assertUniqueLegacyItemIds(save);
  const normalizedPlayer = normalizePlayerItems(save.player);
  const player = refreshPlayerDerivedCaps(normalizedPlayer);
  const enemies = save.enemies.map(enemy => ({
    ...enemy,
    lootTier: enemy.lootTier ?? (enemy.isBoss ? 'GUARDIAN' : save.world.floor.rooms.find(room => room.id === enemy.roomId)?.type === 'ELITE' ? 'ELITE' : 'NORMAL'),
  }));
  return {
    version: 7,
    savedAt: Date.now(),
    migratedFrom: 'FPS_R2A',
    player,
    enemies,
    loot: save.loot.map(drop => ({ ...drop, item: normalizeLegacyItem(drop.item) })),
    combat: save.combat,
    world: withThreadProgress(withLawProgress(save.world)),
  };
}

export function migrateR1Save(save: FPSRunSave): MazeRunSave {
  assertUniqueLegacyItemIds(save);
  const oldWorld = save.world;
  const oldHeight = oldWorld.map.length;
  const oldWidth = oldWorld.map[0].length;
  const size = 23;
  if (oldWidth > size - 2 || oldHeight > size - 2) throw new Error('The saved floor is too large to migrate safely.');
  const offsetX = Math.floor((size - oldWidth) / 2);
  const offsetZ = Math.floor((size - oldHeight) / 2);
  const map = Array.from({ length: size }, () => Array<number>(size).fill(TileType.WALL));
  const decorations = Array.from({ length: size }, () => Array<number>(size).fill(0));
  const explored = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  for (let z = 0; z < oldHeight; z += 1) for (let x = 0; x < oldWidth; x += 1) {
    map[z + offsetZ][x + offsetX] = oldWorld.map[z][x];
    decorations[z + offsetZ][x + offsetX] = oldWorld.decorations[z][x];
    explored[z + offsetZ][x + offsetX] = oldWorld.explored[z][x];
  }
  let exit = findExit(map);
  const legacyBossRoom = oldWorld.floor.rooms.find(room => room.type === 'BOSS');
  if (!exit && legacyBossRoom) exit = { x: legacyBossRoom.anchor.x + offsetX, y: legacyBossRoom.anchor.y + offsetZ };
  if (!exit) throw new Error('The saved floor has no safe descent location.');
  if (exit.x < 4 || exit.y < 4 || exit.x > size - 5 || exit.y > size - 5) throw new Error('The saved descent is too close to the map edge to migrate safely.');
  for (let z = exit.y - 3; z <= exit.y + 3; z += 1) for (let x = exit.x - 3; x <= exit.x + 3; x += 1) {
    map[z][x] = TileType.EMPTY;
    decorations[z][x] = 0;
  }
  map[exit.y][exit.x] = TileType.EXIT;

  const rooms = oldWorld.floor.rooms.map(room => ({
    ...room,
    anchor: { x: room.anchor.x + offsetX, y: room.anchor.y + offsetZ },
    cells: room.cells.map(cell => ({ x: cell.x + offsetX, y: cell.y + offsetZ })),
    ...(room.gate ? { gate: { x: room.gate.x + offsetX, y: room.gate.y + offsetZ } } : {}),
  }));
  let bossRoom = rooms.find(room => room.type === 'BOSS');
  if (!bossRoom) {
    bossRoom = { id: 'floor_' + oldWorld.level + '_' + (oldWorld.seed >>> 0) + '_migrated_guardian', type: 'BOSS', anchor: { ...exit }, cells: [], discovered: false, visited: false, resolved: false };
    rooms.push(bossRoom);
  }
  bossRoom.anchor = { ...exit };
  bossRoom.cells = [];
  for (let z = exit.y - 3; z <= exit.y + 3; z += 1) for (let x = exit.x - 3; x <= exit.x + 3; x += 1) bossRoom!.cells.push({ x, y: z });

  const floor: FloorState = {
    ...oldWorld.floor,
    rooms,
    pendingEncounterId: null,
    pendingEffects: [],
    visitedCells: oldWorld.floor.visitedCells.map(key => {
      const [x, z] = key.split(',').map(Number);
      return (x + offsetX) + ',' + (z + offsetZ);
    }),
    guardianId: getFloorGuardianDefinition(oldWorld.level).id,
    guardianState: 'NOT_DISCOVERED',
    lawProgress: createEmptyMazeLawProgress(),
  };
  const world: DungeonWorldState = { ...oldWorld, map, decorations, explored, floor, worldRevision: oldWorld.worldRevision + 1 };
  const player = normalizePlayerItems({
    ...save.player,
    name: CLASSES[save.player.classId].name,
    position: { ...save.player.position, x: save.player.position.x + offsetX, z: save.player.position.z + offsetZ },
    inventory: save.player.inventory.map(migrateItem),
  });
  const guardianDefinition = getFloorGuardianDefinition(oldWorld.level);
  const normalDefinitions = new Map(enemyDefinitions.map(definition => [definition.id, definition]));
  const oldBosses = save.enemies.filter(enemy => enemy.isBoss);
  const oldGuardian = oldBosses.find(enemy => enemy.roomId === legacyBossRoom?.id)
    ?? oldBosses.sort((a, b) => Math.hypot(a.position.x - (exit!.x + 0.5), a.position.z - (exit!.y + 0.5)) - Math.hypot(b.position.x - (exit!.x + 0.5), b.position.z - (exit!.y + 0.5)))[0];
  const oldGuardianId = oldGuardian?.id;
  const enemies: WorldEnemy[] = [];
  for (const enemy of save.enemies.filter(candidate => candidate.id !== oldGuardianId)) {
    const definition = normalDefinitions.get(enemy.definitionId);
    const position = { ...enemy.position, x: enemy.position.x + offsetX, z: enemy.position.z + offsetZ };
    if (insideArena(position, exit!)) {
      const relocated = findOpenCell(map, position, exit!, enemies, player.position);
      if (relocated) { position.x = relocated.x + 0.5; position.z = relocated.y + 0.5; }
    }
    enemies.push({
      ...enemy,
      name: definition?.fpsName ?? 'Restless Shade',
      visualId: definition?.fpsVisualId ?? 'restless_shade',
      attackSetId: definition?.attackSetId ?? 'shade',
      position,
      attackIndex: enemy.attackIndex ?? 0,
      lootTier: enemy.lootTier ?? 'NORMAL',
      isBoss: false,
    });
  }
  const spawn = findGuardianCell(map, exit, oldGuardian, offsetX, offsetZ, player.position, enemies);
  const oldHealthRatio = oldGuardian ? Math.max(0, Math.min(1, oldGuardian.health / oldGuardian.maxHealth)) : 1;
  // A claimed reward is authoritative even if a legacy save captured inconsistent health.
  const rewarded = Boolean(oldGuardian?.rewardGranted);
  const defeated = rewarded;
  const guardianEnemy: WorldEnemy = {
    id: oldGuardian?.id ?? 'enemy_' + oldWorld.level + '_' + (oldWorld.seed >>> 0) + '_' + guardianDefinition.id,
    definitionId: guardianDefinition.id,
    name: guardianDefinition.name,
    visualId: guardianDefinition.visualId,
    position: { x: spawn.x, y: 0, z: spawn.z },
    collisionRadius: 0.42,
    health: defeated ? 0 : Math.max(1, Math.round(guardianDefinition.health * oldHealthRatio)),
    maxHealth: guardianDefinition.health,
    damage: guardianDefinition.damage,
    xpReward: oldGuardian?.rewardGranted ? oldGuardian.xpReward : guardianDefinition.xpReward,
    state: defeated ? 'DEAD' : oldGuardian?.state === 'DEAD' ? 'IDLE' : oldGuardian?.state ?? 'IDLE',
    stateTimer: oldGuardian?.stateTimer ?? 0,
    attackCooldown: oldGuardian?.attackCooldown ?? 0.5,
    attackRange: 4.2,
    attackTelegraphSeconds: 0.9,
    attackSetId: guardianDefinition.attackSetId,
    attackIndex: 0,
    rewardGranted: rewarded,
    roomId: bossRoom.id,
    lootTier: 'GUARDIAN',
    isBoss: true,
  };
  enemies.push(guardianEnemy);
  floor.guardianState = rewarded ? 'DESCENT_UNLOCKED' : defeated ? 'DEFEATED' : 'NOT_DISCOVERED';
  if (floor.guardianState === 'DESCENT_UNLOCKED') bossRoom.resolved = true;
  const migratedWorld = withThreadProgress(withLawProgress(world));

  const migrated: MazeRunSave = {
    version: 7, savedAt: Date.now(), migratedFrom: 'FPS_R1',
    player, world: migratedWorld, enemies,
    loot: save.loot.map(drop => ({ ...drop, position: { ...drop.position, x: drop.position.x + offsetX, z: drop.position.z + offsetZ }, item: migrateItem(drop.item) })),
    combat: save.combat,
  };
  return migrated;
}

function withLawProgress(world: DungeonWorldState): DungeonWorldState {
  let lawProgress = world.floor.lawProgress ?? createEmptyMazeLawProgress();
  const guardianId = world.floor.guardianId ?? getFloorGuardianDefinition(world.level).id;
  if (world.floor.guardianState === 'DESCENT_UNLOCKED' && (!lawProgress.draft || lawProgress.draft.guardianId !== guardianId || lawProgress.draft.floorLevel !== world.floor.level)) {
    lawProgress = { ...lawProgress, draft: createLawDraft(world.floor.seed, guardianId, world.floor.level) };
  }
  return { ...world, floor: { ...world.floor, lawProgress } };
}

function withThreadProgress(world: DungeonWorldState): DungeonWorldState {
  const junctions = world.floor.threadJunctions ?? [];
  const progress = world.floor.threadProgress ?? createAriadneThreadProgress(junctions);
  return { ...world, floor: { ...world.floor, threadJunctions: junctions, threadProgress: progress } };
}

const ITEM_NAMES: Record<string, string> = {
  'Arming Sword': 'Bronze Xiphos', 'Iron Sword': 'Bronze Kopis', 'War Hammer': 'Bronze Mace',
  'Wooden Staff': 'Olive Ritual Staff', 'Shortbow': 'Hunting Bow', 'Round Shield': 'Aspis',
  'Leather Armor': 'Linen Cuirass', 'Chainmail': 'Bronze Cuirass', 'Health Potion': 'Healing Draught',
  'Mana Potion': 'Nectar Flask', 'Iron Key': 'Ariadne’s Token', 'Dungeon Cache': 'Bronze Armament',
  'Bone Charm': 'Chthonic Seal', 'Tough Rat Hide': 'Cretan Rat Pelt',
};
function migrateItem(item: ItemInstance): ItemInstance {
  const name = ITEM_NAMES[item.name] ?? item.name;
  return normalizeLegacyItem({ ...item, name, description: item.description.replace(/dungeon/ig, 'labyrinth').replace(/iron key/ig, 'Ariadne’s Token') });
}
function normalizePlayerItems(source: LegacyPlayerCharacter): PlayerCharacter {
  const equipment = createEmptyEquipment();
  const inventorySources = source.inventory.map(migrateItem);
  const usedIds = new Set<string>();
  const addInventory = (item: ItemInstance) => inventorySources.push(item);

  const routeLegacyItem = (legacySlot: keyof LegacyPlayerCharacter['equipment'], sourceItem: ItemInstance | null): void => {
    if (!sourceItem) return;
    const item = migrateItem(sourceItem);
    const compatible = getItemEquipmentSlots(item);
    let slot: EquipmentSlot | null = null;
    if (legacySlot === 'weapon' && compatible.includes('mainHand')) slot = 'mainHand';
    else if (legacySlot === 'offhand' && compatible.includes('offHand')) slot = 'offHand';
    else if (legacySlot === 'armor') slot = compatible.includes('torso') ? 'torso' : compatible[0] ?? null;
    else if (legacySlot === 'accessory') {
      if (compatible.includes('ring1') || compatible.includes('ring2')) slot = !equipment.ring1 ? 'ring1' : !equipment.ring2 ? 'ring2' : null;
      else slot = compatible[0] ?? null;
    }
    if (slot && equipment[slot] === null
      && !(slot === 'offHand' && isTwoHandedItem(equipment.mainHand))
      && !(slot === 'offHand' && item.type === 'WEAPON' && (!equipment.mainHand || equipment.mainHand.type !== 'WEAPON' || isTwoHandedItem(equipment.mainHand)))) {
      equipment[slot] = { ...item, quantity: 1 };
      if (item.quantity > 1) addInventory({ ...item, instanceId: item.instanceId + '_split_' + (item.quantity - 1), quantity: item.quantity - 1 });
    } else addInventory(item);
  };

  // Place the legacy weapon before off-hand, then route armor and accessories by authored base metadata.
  routeLegacyItem('weapon', source.equipment.weapon);
  routeLegacyItem('offhand', source.equipment.offhand);
  routeLegacyItem('armor', source.equipment.armor);
  routeLegacyItem('accessory', source.equipment.accessory);

  for (const item of [...inventorySources, ...Object.values(equipment).filter((entry): entry is ItemInstance => Boolean(entry))]) {
    if (!item.instanceId || usedIds.has(item.instanceId)) throw new Error('Legacy save contains a duplicate or empty item instance ID.');
    usedIds.add(item.instanceId);
  }
  const equippedIds = Object.values(equipment).filter((item): item is ItemInstance => Boolean(item)).map(item => item.instanceId);
  const inventory = normalizeInventoryStacks(inventorySources, equippedIds);
  if (inventory.length > MAX_INVENTORY_INSTANCES) throw new Error('Legacy inventory exceeds the safe migration storage limit.');
  const legacyEquippedArmor = (source.equipment.armor?.value ?? 0) + (source.equipment.offhand?.value ?? 0);
  const baseMaxHp = source.stats.baseMaxHp ?? source.stats.maxHp;
  const baseMaxMp = source.stats.baseMaxMp ?? source.stats.maxMp;
  const baseArmor = source.stats.baseArmor ?? Math.max(0, source.stats.armor - legacyEquippedArmor);
  const normalized = { ...source, equipment, inventory, stats: { ...source.stats, baseMaxHp, baseMaxMp, baseArmor } };
  return refreshPlayerDerivedCaps({
    ...normalized,
    inventoryGrid: normalizeInventoryGrid(inventory, source.inventoryGrid).placements,
    uniqueEffectStates: source.uniqueEffectStates ?? [],
  });
}

function assertUniqueLegacyItemIds(save: FPSRunSave | LegacyMazeRunSaveCore): void {
  const items = [
    ...save.player.inventory,
    ...Object.values(save.player.equipment).filter((item): item is ItemInstance => Boolean(item)),
    ...save.loot.map(drop => drop.item),
  ];
  const ids = new Set<string>();
  for (const item of items) {
    if (!item.instanceId || ids.has(item.instanceId)) throw new Error('Legacy save contains a duplicate or empty item instance ID.');
    ids.add(item.instanceId);
  }
}

function isUniqueEffectStateList(value: unknown): boolean {
  if (!Array.isArray(value) || value.length > MAX_UNIQUE_EFFECT_STATE_COUNT) return false;
  const seen = new Set<string>();
  for (const state of value) {
    if (!isRecord(state) || typeof state.effectId !== 'string' || !isUniqueEffectId(state.effectId) || seen.has(state.effectId)) return false;
    const definition = getUniqueItem(state.effectId);
    if (!definition
      || !Number.isFinite(state.cooldownRemaining) || state.cooldownRemaining < 0 || state.cooldownRemaining > definition.stateBounds.cooldownSeconds
      || !Number.isFinite(state.durationRemaining) || state.durationRemaining < 0 || state.durationRemaining > definition.stateBounds.durationSeconds
      || !Number.isInteger(state.charges) || state.charges < 0 || state.charges > definition.stateBounds.charges
      || (state.charges > 0 && state.durationRemaining <= 0)) return false;
    seen.add(state.effectId);
  }
  return true;
}
function hasValidStackQuantities(inventory: ItemInstance[], equipment: ItemInstance[]): boolean {
  return inventory.every(item => Number.isInteger(item.quantity) && item.quantity >= 1
      && (consumableStackKey(item) ? item.quantity <= MAX_CONSUMABLE_STACK : item.quantity === 1))
    && equipment.every(item => item.quantity === 1);
}
function findExit(map: number[][]): { x: number; y: number } | null {
  for (let y = 1; y < map.length - 1; y += 1) for (let x = 1; x < map[y].length - 1; x += 1) if (map[y][x] === TileType.EXIT) return { x, y };
  return null;
}
function insideArena(position: { x: number; z: number }, exit: { x: number; y: number }): boolean {
  return Math.max(Math.abs(Math.floor(position.x) - exit.x), Math.abs(Math.floor(position.z) - exit.y)) <= 3;
}
function findOpenCell(map: number[][], origin: { x: number; z: number }, exit: { x: number; y: number }, enemies: WorldEnemy[], playerPosition: { x: number; z: number }): { x: number; y: number } | undefined {
  const occupied = new Set(enemies.map(enemy => Math.floor(enemy.position.x) + ',' + Math.floor(enemy.position.z)));
  occupied.add(Math.floor(playerPosition.x) + ',' + Math.floor(playerPosition.z));
  const candidates: Array<{ x: number; y: number; distance: number }> = [];
  for (let y = 1; y < map.length - 1; y += 1) for (let x = 1; x < map[y].length - 1; x += 1) {
    if (insideArena({ x: x + 0.5, z: y + 0.5 }, exit) || map[y][x] === TileType.WALL || map[y][x] === TileType.DOOR || map[y][x] === TileType.LOCKED || map[y][x] === TileType.SECRET || occupied.has(x + ',' + y)) continue;
    candidates.push({ x, y, distance: Math.hypot(x + 0.5 - origin.x, y + 0.5 - origin.z) });
  }
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0];
}
function findGuardianCell(map: number[][], exit: { x: number; y: number }, oldGuardian: WorldEnemy | undefined, offsetX: number, offsetZ: number, playerPosition: { x: number; z: number }, enemies: WorldEnemy[]): { x: number; z: number } {
  const occupied = new Set(enemies.map(enemy => Math.floor(enemy.position.x) + ',' + Math.floor(enemy.position.z)));
  const oldPosition = oldGuardian ? { x: oldGuardian.position.x + offsetX, z: oldGuardian.position.z + offsetZ } : { x: exit.x + 0.5, z: exit.y + 0.5 };
  const candidates: Array<{ x: number; y: number; distance: number; fromPlayer: number }> = [];
  for (let y = exit.y - 3; y <= exit.y + 3; y += 1) for (let x = exit.x - 3; x <= exit.x + 3; x += 1) {
    if (x === exit.x && y === exit.y || map[y]?.[x] === undefined || [TileType.WALL, TileType.DOOR, TileType.LOCKED, TileType.SECRET].includes(map[y][x]) || occupied.has(x + ',' + y)) continue;
    candidates.push({ x, y, distance: Math.hypot(x + 0.5 - oldPosition.x, y + 0.5 - oldPosition.z), fromPlayer: Math.hypot(x + 0.5 - playerPosition.x, y + 0.5 - playerPosition.z) });
  }
  candidates.sort((a, b) => Number(a.fromPlayer < 1.5) - Number(b.fromPlayer < 1.5) || a.distance - b.distance);
  const cell = candidates[0];
  if (!cell) throw new Error('The migrated floor has no safe Guardian spawn in its arena.');
  return { x: cell.x + 0.5, z: cell.y + 0.5 };
}
function isRecord(value: unknown): value is Record<string, any> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function defaultStorage(): KeyValueStorage | null { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } }
