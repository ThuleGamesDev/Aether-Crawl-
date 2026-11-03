import { createDungeonWorld, type DungeonWorldState } from '../../world/DungeonWorld';
import { SceneRenderer, type RenderQuality } from '../../engine/SceneRenderer';
import { createPlayerCharacter, createItemInstance } from '../../player/PlayerProgression';
import { ITEM_BASE_BY_ID } from '../../data/itemBases';
import { TileType, type ItemInstance, type WorldEnemy, type WorldEnemyState } from '../../types';
import type { ActivePlayerAction } from '../../player/PlayerCombat';

type EnemyVisualId = 'cretan_cave_rat' | 'arachne_brood' | 'bronze_revenant' | 'bull_cult_enforcer'
  | 'guardian_bronze_gatekeeper' | 'chthonic_acolyte';
type LoadoutId = 'xiphos-aspis' | 'dory-two-hand-grip' | 'kopis' | 'labrys' | 'bow-draw' | 'staff-focus';

const canvas = document.querySelector<HTMLCanvasElement>('#world')!;
const seed = 0x6f1f1;
const world = createDungeonWorld(1, seed);
const mapSize = 23;
world.map = Array.from({ length: mapSize }, (_, z) => Array.from({ length: mapSize }, (_, x) =>
  x === 0 || z === 0 || x === mapSize - 1 || z === mapSize - 1 ? TileType.WALL : TileType.EMPTY));
world.decorations = Array.from({ length: mapSize }, () => Array.from({ length: mapSize }, () => 0));
world.explored = Array.from({ length: mapSize }, () => Array.from({ length: mapSize }, () => true));
world.floor = { ...world.floor, rooms: [], architectureRooms: [], threadJunctions: [], lawHazards: [], lawSpawns: [] };
world.worldRevision += 1;

const player = createPlayerCharacter('PALADIN', { x: 11.5, y: 0, z: 4.5 });
player.rotation = { yaw: Math.PI / 2, pitch: -0.04 };
let renderer: SceneRenderer | null = null;
let enemy: WorldEnemy | null = null;
let action: ActivePlayerAction | null = null;
let viewmodelEvent: 'DODGE' | 'HIT_RECOIL' | 'ITEM_USE' | null = null;
let viewmodelEventProgress = 0;
let moving = false;
let guarding = false;
let elapsedSeconds = 0.42;
let baselinePixels: Uint8Array | null = null;

const item = (baseId: string, instanceId: string): ItemInstance => {
  const base = ITEM_BASE_BY_ID[baseId];
  if (!base) throw new Error(`R6F1 fixture item base missing: ${baseId}`);
  return createItemInstance({ ...base, quantity: 1 }, instanceId, 1);
};

const loadouts: Record<LoadoutId, { main: string; off: string | null }> = {
  'xiphos-aspis': { main: 'xiphos', off: 'aspis' },
  'dory-two-hand-grip': { main: 'dory_spear', off: null },
  kopis: { main: 'kopis', off: null },
  labrys: { main: 'labrys', off: null },
  'bow-draw': { main: 'labyrinth_bow', off: null },
  'staff-focus': { main: 'chthonic_staff', off: 'sun_focus' },
};

function applyLoadout(id: LoadoutId): void {
  const selected = loadouts[id];
  player.equipment.mainHand = item(selected.main, `r6f1-main-${id}`);
  player.equipment.offHand = selected.off ? item(selected.off, `r6f1-off-${id}`) : null;
  action = null;
  viewmodelEvent = null;
  render();
}

function createEnemy(visualId: EnemyVisualId, distance: number, state: WorldEnemyState = 'IDLE'): WorldEnemy {
  return {
    id: `r6f1-${visualId}`,
    definitionId: visualId,
    name: visualId,
    visualId,
    position: { x: 11.5, y: 0, z: 4.5 + distance },
    collisionRadius: 0.3,
    health: 80,
    maxHealth: 80,
    damage: 10,
    xpReward: 20,
    state,
    stateTimer: 0.18,
    attackCooldown: 0,
    attackRange: 1.7,
    attackTelegraphSeconds: 0.62,
    attackSetId: 'revenant',
    attackIndex: 0,
    facingYaw: -Math.PI / 2,
    rewardGranted: false,
    isBoss: visualId === 'guardian_bronze_gatekeeper',
    statusEffects: [],
  };
}

function render(): void {
  if (!renderer) return;
  renderer.renderFrame({
    world,
    player,
    enemies: enemy ? [enemy] : [],
    projectiles: [],
    loot: [],
    action,
    isMoving: moving,
    guarding,
    paused: false,
    cameraBob: 0,
    viewmodelEvent,
    viewmodelEventProgress,
    deltaSeconds: 1 / 60,
    elapsedSeconds,
    events: [],
  });
}

function readPixels(): Uint8Array {
  render();
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('R6F1 fixture requires WebGL 2.');
  gl.finish();
  const pixels = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  return pixels;
}

function comparePixels(reference: Uint8Array, pixels: Uint8Array) {
  if (reference.length !== pixels.length) return { changedPixels: Number.POSITIVE_INFINITY, bounds: null };
  let changedPixels = 0;
  let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
  for (let index = 0; index < pixels.length; index += 4) {
    const changed = Math.abs(pixels[index] - reference[index]) > 6
      || Math.abs(pixels[index + 1] - reference[index + 1]) > 6
      || Math.abs(pixels[index + 2] - reference[index + 2]) > 6;
    if (!changed) continue;
    changedPixels += 1;
    const pixel = index / 4;
    const x = pixel % canvas.width;
    const y = Math.floor(pixel / canvas.width);
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { changedPixels, bounds: changedPixels ? { minX, minY, maxX, maxY } : null };
}

function actionForCurrentWeapon(phase: ActivePlayerAction['phase']): ActivePlayerAction {
  const visual = player.equipment.mainHand?.visualType;
  const abilityId = visual === 'spear' || visual === 'sword' ? 'paladin_arming_sword'
    : visual === 'dagger' ? 'rogue_quick_stab'
      : visual === 'axe' ? 'barbarian_cleave'
        : visual === 'bow' ? 'ranger_shortbow' : 'necromancer_bone_shard';
  return { abilityId, phase, remainingSeconds: 0.04, damageMultiplier: 1, weaponSlot: 'mainHand' };
}

async function boot(): Promise<void> {
  renderer = new SceneRenderer(canvas, world, 'balanced');
  applyLoadout('xiphos-aspis');
  setEnemy('cretan_cave_rat');
  render();
  window.__r6f1 = {
    seed,
    loadouts: Object.keys(loadouts),
    enemyIds: ['cretan_cave_rat', 'arachne_brood', 'bronze_revenant', 'bull_cult_enforcer', 'guardian_bronze_gatekeeper', 'chthonic_acolyte'],
    setQuality(quality: RenderQuality) { renderer?.setRenderQuality(quality); render(); },
    setLoadout(id: LoadoutId) { applyLoadout(id); },
    setEnemy(visualId: EnemyVisualId | null, distance = 5.5, state: WorldEnemyState = 'IDLE') {
      enemy = visualId ? createEnemy(visualId, distance, state) : null;
      render();
    },
    setEnemyDistance(distance: number) {
      if (enemy) enemy.position.z = 4.5 + distance;
      render();
    },
    setEnemyState(state: WorldEnemyState) {
      if (enemy) { enemy.state = state; enemy.stateTimer = state === 'DEAD' ? 0.7 : 0.18; }
      render();
    },
    setWallOcclusion(enabled: boolean) {
      world.map[7][11] = enabled ? TileType.WALL : TileType.EMPTY;
      world.worldRevision += 1;
      render();
    },
    setAction(phase: ActivePlayerAction['phase'] | null) { action = phase ? actionForCurrentWeapon(phase) : null; render(); },
    setMovement(movingState: boolean) { moving = movingState; render(); },
    setGuarding(guardingState: boolean) { guarding = guardingState; render(); },
    setViewmodelEvent(event: 'DODGE' | 'HIT_RECOIL' | 'ITEM_USE' | null, progress = 0.5) { viewmodelEvent = event; viewmodelEventProgress = progress; render(); },
    setElapsedSeconds(value: number) { elapsedSeconds = value; render(); },
    diagnostics() { render(); return renderer?.getDiagnostics() ?? null; },
    captureBaseline() { baselinePixels = readPixels(); return { byteLength: baselinePixels.length, width: canvas.width, height: canvas.height }; },
    compareToBaseline() {
      if (!baselinePixels) throw new Error('Call captureBaseline before compareToBaseline.');
      return comparePixels(baselinePixels, readPixels());
    },
    dispose() { renderer?.dispose(); renderer = null; },
  };
  document.querySelector('#fixture-status')!.textContent = 'ready';
}

function setEnemy(visualId: EnemyVisualId): void {
  enemy = createEnemy(visualId, 5.5);
}

declare global {
  interface Window {
    __r6f1?: {
      seed: number;
      loadouts: string[];
      enemyIds: string[];
      setQuality: (quality: RenderQuality) => void;
      setLoadout: (id: LoadoutId) => void;
      setEnemy: (visualId: EnemyVisualId | null, distance?: number, state?: WorldEnemyState) => void;
      setEnemyDistance: (distance: number) => void;
      setEnemyState: (state: WorldEnemyState) => void;
      setWallOcclusion: (enabled: boolean) => void;
      setAction: (phase: ActivePlayerAction['phase'] | null) => void;
      setMovement: (moving: boolean) => void;
      setGuarding: (guarding: boolean) => void;
      setViewmodelEvent: (event: 'DODGE' | 'HIT_RECOIL' | 'ITEM_USE' | null, progress?: number) => void;
      setElapsedSeconds: (value: number) => void;
      diagnostics: () => ReturnType<SceneRenderer['getDiagnostics']> | null;
      captureBaseline: () => { byteLength: number; width: number; height: number };
      compareToBaseline: () => { changedPixels: number; bounds: { minX: number; minY: number; maxX: number; maxY: number } | null };
      dispose: () => void;
    };
  }
}

void boot();
