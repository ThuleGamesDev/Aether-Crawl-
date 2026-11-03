import type { BiomeId, BiomeVisualDefinition, EnemyVisualDefinition, VFXType, WeaponVisualType } from '../types';
import { FLOOR_ENEMY_ROSTERS, FLOOR_GUARDIANS, getFloorGuardianDefinition, LABYRINTH_THEMES } from './mazeContent';
import { biomeBossDefinitions, enemyDefinitions, miniBossDefinitions, normalEnemyDefinitions } from './enemies';
import { CHARACTER_RIG_MANIFEST } from './characterRigs';

const asset = (path: string) => `/assets/${path}`;
const themeSlug: Record<BiomeId, string> = {
  dungeon: 'palace_foundations',
  moss: 'serpent_galleries',
  catacombs: 'cyclopean_halls',
  frost: 'forgotten_cisterns',
  gilded: 'chthonic_depths',
  obsidian: 'heart_of_the_maze',
};

const themed = (biomeId: BiomeId, kind: 'wall' | 'floor' | 'ceiling' | 'door' | 'exit') => asset(`maze/tiles/${themeSlug[biomeId]}_${kind}.png`);
const themedWallVariants = (biomeId: BiomeId): [string, string, string] => [
  themed(biomeId, 'wall'),
  asset(`maze/tiles/${themeSlug[biomeId]}_wall_variant_2.png`),
  asset(`maze/tiles/${themeSlug[biomeId]}_wall_variant_3.png`),
];
const props = {
  barrel: asset('maze/props/amphora.png'),
  crate: asset('maze/props/broken_amphora.png'),
  bones: asset('maze/props/labyrinth_tablet.png'),
};

export const biomeVisuals: Record<BiomeId, BiomeVisualDefinition> = Object.fromEntries(
  (Object.keys(themeSlug) as BiomeId[]).map(biomeId => [biomeId, {
    wall: themedWallVariants(biomeId)[0],
    wallVariants: themedWallVariants(biomeId),
    floor: themed(biomeId, 'floor'),
    ceiling: themed(biomeId, 'ceiling'),
    door: themed(biomeId, 'door'),
    exit: themed(biomeId, 'exit'),
    torch: asset('maze/props/wall_torch.png'),
    props: { ...props, extra: [asset('maze/props/offering_altar.png'), asset('maze/props/column_fragment.png')] as [string, string] },
    ambientColor: LABYRINTH_THEMES[biomeId].accent,
  }])
) as Record<BiomeId, BiomeVisualDefinition>;

const visualDefinitions = [
  ...enemyDefinitions.map(enemy => ({ visualId: enemy.fpsVisualId, scale: enemy.category === 'normal' ? 0.92 : 1.12, path: asset(`maze/enemies/${enemy.fpsVisualId}.png`) })),
  ...enemyDefinitions.map(enemy => ({ visualId: enemy.visualId, scale: enemy.category === 'normal' ? 0.92 : 1.12, path: asset(`enemies/${enemy.visualId.replace(/_/g, '-')}.png`) })),
  ...FLOOR_GUARDIANS.map(guardian => ({ visualId: guardian.visualId, scale: 1.32, path: asset(`maze/enemies/${guardian.visualId}.png`) })),
];

export const enemyVisuals: Record<string, EnemyVisualDefinition> = Object.fromEntries(
  visualDefinitions.map(visual => [visual.visualId, { sprite: visual.path ?? asset(`maze/enemies/${visual.visualId}.png`), scale: visual.scale }])
);

export const weaponVisuals: Record<WeaponVisualType, string> = {
  unarmed: asset('maze/hands/empty.png'),
  sword: asset('maze/hands/xiphos.png'),
  dagger: asset('maze/hands/kopis.png'),
  axe: asset('maze/hands/labrys.png'),
  mace: asset('maze/hands/ritual_staff.png'),
  staff: asset('maze/hands/ritual_staff.png'),
  bow: asset('maze/hands/hunting_bow.png'),
  spear: asset('maze/hands/dory.png'),
};

export type OffHandVisualType = 'empty' | 'sword' | 'dagger' | 'spear' | 'shield' | 'focus' | 'twoHandGrip' | 'bowDraw';
export const offhandVisuals: Record<OffHandVisualType, string> = {
  empty: asset('maze/hands/offhand_empty.png'),
  sword: asset('maze/hands/offhand_xiphos.png'),
  dagger: asset('maze/hands/offhand_kopis.png'),
  spear: asset('maze/hands/offhand_dory.png'),
  shield: asset('maze/hands/offhand_shield.png'),
  focus: asset('maze/hands/offhand_focus.png'),
  twoHandGrip: asset('maze/hands/offhand_two_hand_grip.png'),
  bowDraw: asset('maze/hands/offhand_bow_draw.png'),
};

export const shieldVisual = asset('maze/hands/aspis.png');
export const characterRigAtlasPath = CHARACTER_RIG_MANIFEST.atlasPath;
export const mythicVfxAtlasPath = asset('maze/vfx/mythic_vfx_atlas.png');

export const vfxVisuals: Record<VFXType, string> = {
  DAMAGE: asset('maze/vfx/bronze_impact.png'),
  HEAL: asset('maze/vfx/laurel_light.png'),
  ATTACK: asset('maze/vfx/bronze_impact.png'),
  FIREBALL: asset('maze/vfx/promethean_flame.png'),
  ENEMY_DEATH: asset('maze/vfx/soul_ash.png'),
  ICE: asset('maze/vfx/cistern_splash.png'),
  LIGHTNING: asset('maze/vfx/oracle_spark.png'),
  BUFF: asset('maze/vfx/laurel_light.png'),
  POISON: asset('maze/vfx/serpent_venom.png'),
  HOLY: asset('maze/vfx/laurel_light.png'),
  DARK: asset('maze/vfx/soul_ash.png'),
  DEBUFF: asset('maze/vfx/serpent_venom.png'),
  CRITICAL: asset('maze/vfx/bronze_impact.png'),
};

export const propVisuals = {
  amphora: props.barrel,
  brokenAmphora: props.crate,
  labyrinthTablet: props.bones,
  offeringAltar: asset('maze/props/offering_altar.png'),
  chthonicAltar: asset('maze/props/chthonic_altar.png'),
  columnFragment: asset('maze/props/column_fragment.png'),
  oilBowl: asset('maze/props/oil_bowl.png'),
  wallTorch: asset('maze/props/wall_torch.png'),
  frescoPanel: asset('maze/props/fresco_panel.png'),
  bullRelief: asset('maze/props/bull_relief.png'),
  cisternMirror: asset('maze/props/cistern_mirror.png'),
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
  if (decorationType === 7) return propVisuals.oilBowl;
  if (decorationType === 9) return propVisuals.frescoPanel;
  if (decorationType === 10) return propVisuals.bullRelief;
  return undefined;
};

export const getBiomeAssetPaths = (biomeId: BiomeId): string[] => {
  const biome = biomeVisuals[biomeId];
  return [...biome.wallVariants, biome.floor, biome.ceiling, biome.door, biome.exit, biome.torch, biome.props.barrel, biome.props.crate, biome.props.bones, ...biome.props.extra];
};

export function getEnemyVisualPath(visualId: string): string | undefined {
  return enemyVisuals[visualId]?.sprite;
}

export const getLevelAssetPaths = (level: number): string[] => {
  const explicitRoster = FLOOR_ENEMY_ROSTERS[level];
  const activeEnemies = explicitRoster
    ? explicitRoster.map(id => enemyDefinitions.find(enemy => enemy.id === id)).filter((enemy): enemy is (typeof enemyDefinitions)[number] => Boolean(enemy))
    : normalEnemyDefinitions.filter(enemy => (enemy.minLevel ?? 1) <= level);
  const boss = getFloorGuardianDefinition(level);
  return [...new Set([
    ...getBiomeAssetPaths(getBiomeIdForLevel(level)),
    ...activeEnemies.map(enemy => enemyVisuals[enemy.fpsVisualId]?.sprite).filter((path): path is string => Boolean(path)),
    enemyVisuals[boss.visualId].sprite,
    ...Object.values(weaponVisuals), ...Object.values(offhandVisuals), shieldVisual, mythicVfxAtlasPath,
    characterRigAtlasPath,
    ...Object.values(vfxVisuals),
  ])];
};

export const collectAssetPaths = (): string[] => [...new Set([
  ...Object.keys(biomeVisuals).flatMap(biomeId => getBiomeAssetPaths(biomeId as BiomeId)),
  ...Object.values(enemyVisuals).map(visual => visual.sprite),
  ...Object.values(weaponVisuals), ...Object.values(offhandVisuals), shieldVisual,
  mythicVfxAtlasPath,
  characterRigAtlasPath,
  ...Object.values(vfxVisuals),
  ...Object.values(propVisuals),
])];

export const mythicEnemyDefinitions = enemyDefinitions;
export const mythicMiniBossDefinitions = miniBossDefinitions;
export const mythicBiomeBossDefinitions = biomeBossDefinitions;
