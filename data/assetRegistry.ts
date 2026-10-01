import type { BiomeId, BiomeVisualDefinition, EnemyVisualDefinition, VFXType, WeaponVisualType } from '../types';

const asset = (path: string) => `/assets/${path}`;

const commonProps = {
  barrel: asset('props/barrel.png'),
  crate: asset('props/crate.png'),
  bones: asset('props/bones.png'),
};

export const biomeVisuals: Record<BiomeId, BiomeVisualDefinition> = {
  dungeon: {
    wall: asset('environments/dungeon/wall.png'),
    floor: asset('environments/dungeon/floor.png'),
    ceiling: asset('environments/dungeon/ceiling.png'),
    door: asset('environments/dungeon/door.png'),
    exit: asset('environments/dungeon/exit.png'),
    torch: asset('environments/lights/dungeon.png'),
    props: { ...commonProps, extra: [asset('props/broken-pillar.png'), asset('props/chains.png')] },
    ambientColor: '#d68b3a',
  },
  moss: {
    wall: asset('environments/moss/wall.png'),
    floor: asset('environments/moss/floor.png'),
    ceiling: asset('environments/moss/ceiling.png'),
    door: asset('environments/moss/door.png'),
    exit: asset('environments/moss/exit.png'),
    torch: asset('environments/lights/moss.png'),
    props: { ...commonProps, extra: [asset('props/biomes/moss-roots.png'), asset('props/biomes/moss-mushrooms.png')] },
    ambientColor: '#7bce65',
  },
  catacombs: {
    wall: asset('environments/catacombs/wall.png'),
    floor: asset('environments/catacombs/floor.png'),
    ceiling: asset('environments/catacombs/ceiling.png'),
    door: asset('environments/catacombs/door.png'),
    exit: asset('environments/catacombs/exit.png'),
    torch: asset('environments/lights/catacombs.png'),
    props: { ...commonProps, extra: [asset('props/biomes/crypt-bone-shrine.png'), asset('props/biomes/crypt-banner.png')] },
    ambientColor: '#c36a63',
  },
  obsidian: {
    wall: asset('environments/obsidian/wall.png'),
    floor: asset('environments/obsidian/floor.png'),
    ceiling: asset('environments/obsidian/ceiling.png'),
    door: asset('environments/obsidian/door.png'),
    exit: asset('environments/obsidian/exit.png'),
    torch: asset('environments/lights/obsidian.png'),
    props: { ...commonProps, extra: [asset('props/biomes/obsidian-crystals.png'), asset('props/biomes/basalt-head.png')] },
    ambientColor: '#c04cdb',
  },
  frost: {
    wall: asset('environments/frost/wall.png'),
    floor: asset('environments/frost/floor.png'),
    ceiling: asset('environments/frost/ceiling.png'),
    door: asset('environments/frost/door.png'),
    exit: asset('environments/frost/exit.png'),
    torch: asset('environments/lights/frost.png'),
    props: { ...commonProps, extra: [asset('props/biomes/ice-spire.png'), asset('props/biomes/frost-chains.png')] },
    ambientColor: '#66c8ef',
  },
  gilded: {
    wall: asset('environments/gilded/wall.png'),
    floor: asset('environments/gilded/floor.png'),
    ceiling: asset('environments/gilded/ceiling.png'),
    door: asset('environments/gilded/door.png'),
    exit: asset('environments/gilded/exit.png'),
    torch: asset('environments/lights/gilded.png'),
    props: { ...commonProps, extra: [asset('props/biomes/gilded-urn.png'), asset('props/biomes/imperial-banner.png')] },
    ambientColor: '#f1c653',
  },
};

export const enemyVisuals: Record<string, EnemyVisualDefinition> = {
  giant_rat: { sprite: asset('enemies/giant-rat.png'), scale: 0.72 },
  acid_spider: { sprite: asset('enemies/acid-spider.png'), scale: 0.8 },
  goblin_scavenger: { sprite: asset('enemies/goblin-scavenger.png'), scale: 0.8 },
  skeleton_warrior: { sprite: asset('enemies/skeleton-warrior.png'), scale: 0.82 },
  bandit_rogue: { sprite: asset('enemies/bandit-rogue.png'), scale: 0.8 },
  orc_brute: { sprite: asset('enemies/orc-brute.png'), scale: 0.9 },
  dark_cultist: { sprite: asset('enemies/dark-cultist.png'), scale: 0.84 },
  green_slime: { sprite: asset('enemies/green-slime.png'), scale: 0.84 },
  cave_troll: { sprite: asset('enemies/cave-troll.png'), scale: 0.98 },
  fire_elemental: { sprite: asset('enemies/fire-elemental.png'), scale: 0.9 },
  specter: { sprite: asset('enemies/specter.png'), scale: 0.9 },
  stone_golem: { sprite: asset('enemies/stone-golem.png'), scale: 0.98 },
  vampire_spawn: { sprite: asset('enemies/vampire-spawn.png'), scale: 0.86 },
  beholder: { sprite: asset('enemies/beholder.png'), scale: 0.86 },
  ice_elemental: { sprite: asset('enemies/ice-elemental.png'), scale: 0.95 },
  void_dragon: { sprite: asset('enemies/void-dragon.png'), scale: 1.04 },
  chaos_knight: { sprite: asset('enemies/chaos-knight.png'), scale: 1.08 },
  dungeon_warden: { sprite: asset('enemies/dungeon-warden.png'), scale: 1.02 },
  giant_slime: { sprite: asset('enemies/giant-slime.png'), scale: 1.05 },
  cursed_knight: { sprite: asset('enemies/cursed-knight.png'), scale: 1.04 },
  bandit_king: { sprite: asset('enemies/bandit-king.png'), scale: 1.02 },
  mimic_queen: { sprite: asset('enemies/mimic-queen.png'), scale: 1.12 },
  the_necromancer: { sprite: asset('enemies/the-necromancer.png'), scale: 1.12 },
  moss_golem: { sprite: asset('enemies/moss-golem.png'), scale: 1.18 },
  lich_lord: { sprite: asset('enemies/lich-lord.png'), scale: 1.12 },
  frost_giant: { sprite: asset('enemies/frost-giant.png'), scale: 1.18 },
  golden_emperor: { sprite: asset('enemies/golden-emperor.png'), scale: 1.2 },
  obsidian_lord: { sprite: asset('enemies/obsidian-lord.png'), scale: 1.22 },
};

export const weaponVisuals: Record<WeaponVisualType, string> = {
  unarmed: asset('hands/empty.png'),
  sword: asset('hands/sword.png'),
  dagger: asset('hands/dagger.png'),
  axe: asset('hands/axe.png'),
  mace: asset('hands/mace.png'),
  staff: asset('hands/staff.png'),
  bow: asset('hands/bow.png'),
};

export const shieldVisual = asset('hands/shield.png');

export const vfxVisuals: Record<VFXType, string> = {
  DAMAGE: asset('vfx/melee-hit.png'),
  HEAL: asset('vfx/heal.png'),
  ATTACK: asset('vfx/melee-hit.png'),
  FIREBALL: asset('vfx/fire.png'),
  ENEMY_DEATH: asset('vfx/critical-hit.png'),
  ICE: asset('vfx/frost.png'),
  LIGHTNING: asset('vfx/magic.png'),
  BUFF: asset('vfx/shield.png'),
  POISON: asset('vfx/poison.png'),
  HOLY: asset('vfx/critical-hit.png'),
  DARK: asset('vfx/magic.png'),
  DEBUFF: asset('vfx/stun.png'),
  CRITICAL: asset('vfx/critical-hit.png'),
};

export const propVisuals = {
  barrel: asset('props/barrel.png'),
  crate: asset('props/crate.png'),
  bones: asset('props/bones.png'),
  brokenPillar: asset('props/broken-pillar.png'),
  chains: asset('props/chains.png'),
  rubble: asset('props/rubble.png'),
  skullPile: asset('props/skull-pile.png'),
  brazier: asset('props/brazier.png'),
};

export const getBiomeIdForLevel = (level: number): BiomeId => {
  if (level <= 5) return 'dungeon';
  if (level <= 10) return 'moss';
  if (level <= 15) return 'catacombs';
  if (level <= 20) return 'frost';
  if (level <= 25) return 'gilded';
  return 'obsidian';
};

export const getDecorationAsset = (biomeId: BiomeId, decorationType: number): string | undefined => {
  const biome = biomeVisuals[biomeId];
  if (decorationType === 1) return biome.torch;
  if (decorationType === 2) return biome.props.barrel;
  if (decorationType === 3) return biome.props.crate;
  if (decorationType === 4) return biome.props.bones;
  if (decorationType === 5) return biome.props.extra[0];
  if (decorationType === 6) return biome.props.extra[1];
  return undefined;
};

export const collectAssetPaths = (): string[] => [...new Set([
  ...Object.values(biomeVisuals).flatMap(biome => [
    biome.wall, biome.floor, biome.ceiling, biome.door, biome.exit, biome.torch,
    biome.props.barrel, biome.props.crate, biome.props.bones, ...biome.props.extra,
  ]),
  ...Object.values(enemyVisuals).map(visual => visual.sprite),
  ...Object.values(weaponVisuals), shieldVisual,
  ...Object.values(vfxVisuals),
  ...Object.values(propVisuals),
])];
