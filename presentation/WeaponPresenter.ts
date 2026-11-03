import * as THREE from 'three';
import type { PlayerCharacter, WeaponVisualType } from '../types';
import type { ActivePlayerAction, PlayerActionPhase } from '../player/PlayerCombat';
import { AssetManager } from './AssetManager';
import { getAbility } from '../combat/AbilityRegistry';
import { isFocusItem, isShieldItem, isTwoHandedItem } from '../services/equipmentRules';
import type { OffHandVisualType } from '../data/assetRegistry';

export const getWeaponVisualTypeForPlayer = (player: PlayerCharacter): WeaponVisualType =>
  player.equipment.mainHand?.visualType ??
  (player.classId === 'MONK' ? 'unarmed' : player.classId === 'SORCERER' || player.classId === 'NECROMANCER' ? 'staff' : 'sword');

export interface WeaponPresentationPoseInput {
  weapon: WeaponVisualType;
  abilityId?: string;
  phase?: PlayerActionPhase;
  remainingSeconds?: number;
  moving: boolean;
  guarding: boolean;
  hasShield: boolean;
  elapsedSeconds: number;
  actionHand?: 'mainHand' | 'offHand';
  offHandPose?: 'empty' | 'weapon' | 'shield' | 'focus' | 'twoHandGrip' | 'bowDraw';
  viewmodelEvent?: 'DODGE' | 'HIT_RECOIL' | 'ITEM_USE' | null;
  viewmodelEventProgress?: number;
}

export interface WeaponPresentationPose {
  weaponX: number;
  weaponY: number;
  weaponZ: number;
  weaponRotationX: number;
  weaponRotationY: number;
  weaponRotationZ: number;
  weaponScaleX: number;
  weaponScaleY: number;
  shieldVisible: boolean;
  shieldX: number;
  shieldY: number;
  shieldZ: number;
  shieldRotationZ: number;
  shieldScale: number;
  offHandVisible: boolean;
  offHandX: number;
  offHandY: number;
  offHandZ: number;
  offHandRotationZ: number;
  offHandScale: number;
}

/** Conservative camera-space estimate for preserving the center reticle and enemy tells. */
export function isWeaponPresentationCenterClear(pose: WeaponPresentationPose, halfWidth = 0.12, halfHeight = 0.16): boolean {
  const overlaps = (x: number, width: number, y: number, height: number) =>
    x - width / 2 < halfWidth && x + width / 2 > -halfWidth
    && y - height / 2 < halfHeight && y + height / 2 > -halfHeight;
  if (overlaps(pose.weaponX, pose.weaponScaleX, pose.weaponY, pose.weaponScaleY)) return false;
  if (pose.offHandVisible && overlaps(pose.offHandX, pose.offHandScale, pose.offHandY, pose.offHandScale)) return false;
  if (pose.shieldVisible && overlaps(pose.shieldX, pose.shieldScale, pose.shieldY, pose.shieldScale)) return false;
  return true;
}

export function createWeaponPresentationPoseState(): WeaponPresentationPose {
  return {
    weaponX: 0, weaponY: 0, weaponZ: 0,
    weaponRotationX: 0, weaponRotationY: 0, weaponRotationZ: 0,
    weaponScaleX: 0, weaponScaleY: 0,
    shieldVisible: false, shieldX: 0, shieldY: 0, shieldZ: 0, shieldRotationZ: 0, shieldScale: 0,
    offHandVisible: false, offHandX: 0, offHandY: 0, offHandZ: 0, offHandRotationZ: 0, offHandScale: 0,
  };
}

function phaseProgress(input: WeaponPresentationPoseInput): number {
  if (!input.phase || !input.abilityId) return 0;
  const ability = getAbility(input.abilityId);
  const duration = input.phase === 'WINDUP' ? ability?.windupSeconds
    : input.phase === 'ACTIVE' ? ability?.activeSeconds : ability?.recoverySeconds;
  return Math.max(0, Math.min(1, 1 - Math.max(0, input.remainingSeconds ?? 0) / Math.max(0.01, duration ?? 0.12)));
}

const smooth = (value: number): number => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

export function getOffHandPose(player: PlayerCharacter): NonNullable<WeaponPresentationPoseInput['offHandPose']> {
  const item = player.equipment.offHand;
  if (isShieldItem(item)) return 'shield';
  if (isFocusItem(item)) return 'focus';
  if (item?.type === 'WEAPON') return 'weapon';
  if (isTwoHandedItem(player.equipment.mainHand)) return player.equipment.mainHand?.visualType === 'bow' ? 'bowDraw' : 'twoHandGrip';
  if (player.equipment.mainHand?.visualType === 'spear') return 'twoHandGrip';
  return 'empty';
}

export function getOffHandVisual(player: PlayerCharacter, pose: NonNullable<WeaponPresentationPoseInput['offHandPose']>): OffHandVisualType {
  const item = player.equipment.offHand;
  if (pose === 'shield') return 'shield';
  if (pose === 'focus') return 'focus';
  if (pose === 'twoHandGrip') return 'twoHandGrip';
  if (pose === 'bowDraw') return 'bowDraw';
  if (pose === 'weapon' && item) {
    if (item.visualType === 'dagger') return 'dagger';
    if (item.visualType === 'spear') return 'spear';
    return 'sword';
  }
  return 'empty';
}

/** Returns camera-space hand poses from the equipped weapon and real AbilityDefinition timing. */
export function getWeaponPresentationPose(input: WeaponPresentationPoseInput, target = createWeaponPresentationPoseState()): WeaponPresentationPose {
  const ability = input.abilityId ? getAbility(input.abilityId) : undefined;
  const p = smooth(phaseProgress(input));
  const phase = input.phase;
  const moving = input.moving ? Math.sin(input.elapsedSeconds * 9.5) : Math.sin(input.elapsedSeconds * 1.5) * 0.08;
  const pose = target;
  pose.weaponX = 0.68;
  pose.weaponY = -0.48 + moving * 0.045;
  pose.weaponZ = -1.05;
  pose.weaponRotationX = 0;
  pose.weaponRotationY = 0;
  pose.weaponRotationZ = input.moving ? moving * 0.025 : 0;
  pose.weaponScaleX = 0.72;
  pose.weaponScaleY = 0.72;
  pose.shieldVisible = input.hasShield;
  pose.shieldX = -0.66 + moving * 0.018;
  pose.shieldY = -0.43 + moving * 0.035;
  pose.shieldZ = -1.12;
  pose.shieldRotationZ = 0;
  pose.shieldScale = 0.38;
  pose.offHandVisible = true;
  pose.offHandX = -0.66 + moving * 0.018;
  pose.offHandY = -0.45 + moving * 0.035;
  pose.offHandZ = -1.12;
  pose.offHandRotationZ = input.moving ? -moving * 0.025 : 0;
  pose.offHandScale = 0.67;

  if (phase && ability) {
    if (input.weapon === 'axe') {
      if (phase === 'WINDUP') {
        pose.weaponX = 0.74 - p * 0.025; pose.weaponY = -0.42 + p * 0.12; pose.weaponZ = -1.13;
        pose.weaponRotationZ = -0.92 * p - 0.08;
      } else if (phase === 'ACTIVE') {
        pose.weaponX = 0.67; pose.weaponY = -0.38 + p * 0.04; pose.weaponZ = -0.92;
        pose.weaponRotationZ = 0.64 - p * 0.22;
      } else {
        pose.weaponY = -0.38 + p * -0.1; pose.weaponZ = -0.96;
        pose.weaponRotationZ = 0.42 * (1 - p);
      }
    } else if (input.weapon === 'dagger') {
      if (phase === 'WINDUP') {
        pose.weaponX = 0.69 + p * 0.02; pose.weaponY = -0.48 + p * 0.1; pose.weaponZ = -1.12;
        pose.weaponRotationZ = 0.48 * p;
      } else if (phase === 'ACTIVE') {
        pose.weaponX = 0.66 - p * 0.025; pose.weaponY = -0.43; pose.weaponZ = -0.91;
        pose.weaponRotationZ = -0.68 + p * 0.2;
      } else {
        pose.weaponY = -0.43 + p * -0.05; pose.weaponZ = -0.96;
        pose.weaponRotationZ = -0.48 * (1 - p);
      }
    } else if (input.weapon === 'sword') {
      if (phase === 'WINDUP') {
        pose.weaponX = 0.72; pose.weaponY = -0.43 + p * 0.07; pose.weaponZ = -1.12;
        pose.weaponRotationZ = -0.56 * p;
      } else if (phase === 'ACTIVE') {
        pose.weaponX = 0.67 - p * 0.035; pose.weaponY = -0.41; pose.weaponZ = -0.91;
        pose.weaponRotationZ = 0.54 - p * 0.12;
      } else {
        pose.weaponY = -0.41 + p * -0.07; pose.weaponZ = -0.97;
        pose.weaponRotationZ = 0.38 * (1 - p);
      }
    } else if (input.weapon === 'spear') {
      const javelin = input.abilityId === 'ranger_volley' || (input.abilityId?.includes('javelin') ?? false);
      if (javelin) {
        if (phase === 'WINDUP') {
          pose.weaponX = 0.66; pose.weaponY = -0.33 + p * 0.03; pose.weaponZ = -1.16;
          pose.weaponRotationZ = -0.38 * p;
        } else if (phase === 'ACTIVE') {
          pose.weaponX = 0.63; pose.weaponY = -0.36; pose.weaponZ = -0.8;
          pose.weaponRotationZ = 0.08;
        } else {
          pose.weaponY = -0.42; pose.weaponZ = -0.98; pose.weaponRotationZ = 0.12 * (1 - p);
        }
      } else if (phase === 'WINDUP') {
        pose.weaponX = 0.61; pose.weaponY = -0.49 + p * 0.025; pose.weaponZ = -1.12;
        pose.weaponRotationZ = -0.08 * p;
      } else if (phase === 'ACTIVE') {
        pose.weaponX = 0.61; pose.weaponY = -0.49; pose.weaponZ = -1.12 + 0.34 * smooth(Math.min(1, p * 1.8));
        pose.weaponRotationZ = 0.025;
      } else {
        pose.weaponX = 0.61; pose.weaponY = -0.49; pose.weaponZ = -0.78 - 0.34 * p;
        pose.weaponRotationZ = 0;
      }
    } else if (input.weapon === 'bow') {
      if (phase === 'WINDUP') {
        pose.weaponX = 0.56 - p * 0.025; pose.weaponY = -0.39; pose.weaponZ = -1.13;
        pose.weaponRotationZ = -0.14 * p; pose.weaponScaleX = 0.72 * (1 + p * 0.08);
      } else if (phase === 'ACTIVE') {
        pose.weaponX = 0.61 + p * 0.05; pose.weaponY = -0.44; pose.weaponZ = -0.94;
        pose.weaponRotationZ = 0.06; pose.weaponScaleX = 0.78 - p * 0.06;
      } else {
        pose.weaponX = 0.66; pose.weaponY = -0.48; pose.weaponZ = -1.0;
        pose.weaponRotationZ = 0.02 * (1 - p);
      }
    } else if ((input.weapon === 'staff' || input.weapon === 'mace') && ability.meleeStyle !== 'BASH') {
      if (phase === 'WINDUP') {
        pose.weaponX = 0.68; pose.weaponY = -0.33 + p * 0.09; pose.weaponZ = -1.12;
        pose.weaponRotationZ = -0.06 * p;
      } else if (phase === 'ACTIVE') {
        pose.weaponX = 0.68; pose.weaponY = -0.24; pose.weaponZ = -0.99;
        pose.weaponRotationZ = 0.025;
      } else {
        pose.weaponX = 0.68; pose.weaponY = -0.24 - p * 0.2; pose.weaponZ = -0.99 - p * 0.06;
        pose.weaponRotationZ = 0.02 * (1 - p);
      }
    } else if (ability.meleeStyle === 'THRUST') {
      pose.weaponX = 0.61;
      pose.weaponY = -0.49;
      pose.weaponZ = phase === 'WINDUP' ? -1.08 - p * 0.08
        : phase === 'ACTIVE' ? -0.76 - p * 0.06 : -0.82 - p * 0.26;
      pose.weaponRotationZ = 0.015;
    } else if (ability.kind === 'PROJECTILE' || ability.kind === 'AOE') {
      pose.weaponX = 0.68;
      pose.weaponY = phase === 'WINDUP' ? -0.44 + p * 0.08 : phase === 'ACTIVE' ? -0.36 : -0.36 - p * 0.12;
      pose.weaponZ = phase === 'WINDUP' ? -1.1 : phase === 'ACTIVE' ? -0.98 : -0.98 - p * 0.06;
      pose.weaponRotationZ = phase === 'WINDUP' ? -0.08 * p : phase === 'ACTIVE' ? 0.025 : 0.025 * (1 - p);
    } else if (ability.meleeStyle === 'BASH') {
      pose.weaponY = -0.47 + (phase === 'WINDUP' ? p * 0.06 : phase === 'ACTIVE' ? 0.04 : -p * 0.04);
      pose.weaponZ = phase === 'ACTIVE' ? -0.88 : -1.02;
      pose.weaponRotationZ = phase === 'WINDUP' ? -0.14 * p : phase === 'ACTIVE' ? 0.13 : 0.12 * (1 - p);
    } else if (ability.meleeStyle === 'UNARMED') {
      pose.weaponX = 0.62;
      pose.weaponY = -0.43 + (phase === 'WINDUP' ? -0.04 * p : phase === 'ACTIVE' ? 0.03 : -0.03 * p);
      pose.weaponZ = phase === 'ACTIVE' ? -0.82 : -1.02;
      pose.weaponRotationZ = phase === 'WINDUP' ? 0.15 * p : phase === 'ACTIVE' ? -0.18 : -0.12 * (1 - p);
    }
  }

  const bash = phase && ability?.meleeStyle === 'BASH';
  if (input.hasShield) {
    if (input.guarding) {
      pose.shieldX = -0.58;
      pose.shieldY = -0.34 + moving * 0.018;
      pose.shieldZ = -0.89;
      pose.shieldRotationZ = -0.12;
      pose.shieldScale = 0.44;
    }
    if (bash) {
      pose.shieldX = -0.42 + (phase === 'WINDUP' ? -p * 0.02 : phase === 'ACTIVE' ? 0.02 : (1 - p) * 0.04);
      pose.shieldY = -0.42 + (phase === 'WINDUP' ? -p * 0.04 : phase === 'ACTIVE' ? 0.02 : -p * 0.04);
      pose.shieldZ = phase === 'ACTIVE' ? -0.78 : -0.98;
      pose.shieldRotationZ = phase === 'WINDUP' ? -0.2 * p : phase === 'ACTIVE' ? 0.1 : 0.12 * (1 - p);
      pose.shieldScale = phase === 'ACTIVE' ? 0.44 : 0.42;
    }
  }
  const offHandPose = input.offHandPose ?? (input.hasShield ? 'shield' : 'empty');
  if (offHandPose === 'shield') {
    pose.offHandX = pose.shieldX;
    pose.offHandY = pose.shieldY;
    pose.offHandZ = pose.shieldZ;
    pose.offHandRotationZ = pose.shieldRotationZ;
    pose.offHandScale = pose.shieldScale * 1.12;
  } else if (offHandPose === 'twoHandGrip') {
    pose.offHandX = 0.42 + moving * 0.012;
    pose.offHandY = -0.44 + moving * 0.025;
    pose.offHandZ = -0.97;
    pose.offHandRotationZ = 0.1;
    pose.offHandScale = 0.46;
    if (phase && ability) {
      if (ability.kind === 'PROJECTILE' || ability.kind === 'AOE' || input.weapon === 'staff' || input.weapon === 'mace') {
        pose.offHandX += phase === 'WINDUP' ? -0.03 * p : phase === 'ACTIVE' ? 0.08 * p : 0.04 * (1 - p);
        pose.offHandY += phase === 'WINDUP' ? 0.04 * p : phase === 'ACTIVE' ? 0.07 : 0;
        pose.offHandZ += phase === 'ACTIVE' ? 0.04 : 0;
        pose.offHandRotationZ += phase === 'WINDUP' ? -0.08 * p : phase === 'ACTIVE' ? 0.12 : 0.08 * (1 - p);
      } else if (ability.meleeStyle === 'THRUST') {
        pose.offHandZ = phase === 'WINDUP' ? -1.02 : phase === 'ACTIVE' ? -0.76 - 0.06 * p : -0.82 - 0.18 * p;
      }
    }
  } else if (offHandPose === 'bowDraw') {
    pose.offHandX = -0.42 + moving * 0.01;
    pose.offHandY = -0.4 + moving * 0.02;
    pose.offHandZ = -0.94;
    pose.offHandRotationZ = 0;
    pose.offHandScale = 0.42;
    if (phase && ability?.kind === 'PROJECTILE') {
      pose.offHandX = -0.24 + p * 0.13;
      pose.offHandY = -0.4 + (phase === 'WINDUP' ? p * 0.015 : 0);
      pose.offHandZ = phase === 'WINDUP' ? -1.02 - p * 0.05 : phase === 'ACTIVE' ? -0.91 : -0.96;
      pose.offHandRotationZ = phase === 'WINDUP' ? -0.04 * p : 0.03 * (1 - p);
    }
  }

  if (input.actionHand === 'offHand' && phase && ability) {
    // Move the captured melee action to the authored left-hand sprite; the main hand stays at idle.
    pose.weaponX = 0.68;
    pose.weaponY = -0.48 + moving * 0.045;
    pose.weaponZ = -1.05;
    pose.weaponRotationZ = input.moving ? moving * 0.025 : 0;
    pose.weaponScaleX = 0.72;
    pose.weaponScaleY = 0.72;
    pose.offHandX = phase === 'WINDUP' ? -0.72 + p * 0.035 : phase === 'ACTIVE' ? -0.56 + p * 0.04 : -0.62 - p * 0.04;
    pose.offHandY = phase === 'WINDUP' ? -0.45 + p * 0.06 : phase === 'ACTIVE' ? -0.38 : -0.42 - p * 0.04;
    pose.offHandZ = phase === 'WINDUP' ? -1.12 : phase === 'ACTIVE' ? -0.82 : -0.91;
    pose.offHandRotationZ = phase === 'WINDUP' ? 0.42 * p : phase === 'ACTIVE' ? -0.52 + p * 0.12 : -0.34 * (1 - p);
    pose.offHandScale = 0.55;
    if (ability.id === 'monk_flying_kick') {
      pose.weaponY -= phase === 'WINDUP' ? 0.04 * p : phase === 'ACTIVE' ? 0.08 : 0;
      pose.offHandY += phase === 'WINDUP' ? 0.05 * p : phase === 'ACTIVE' ? 0.08 : 0;
    }
  }

  if (input.abilityId === 'monk_flying_kick' && phase && ability) {
    pose.weaponX = 0.68 + (phase === 'ACTIVE' ? 0.05 : 0);
    pose.weaponY = -0.47 + (phase === 'WINDUP' ? -0.04 * p : phase === 'ACTIVE' ? 0.03 : 0);
    pose.weaponZ = phase === 'ACTIVE' ? -0.86 : -1.03;
    pose.weaponRotationZ = phase === 'WINDUP' ? -0.1 * p : phase === 'ACTIVE' ? 0.16 : 0.06 * (1 - p);
    pose.offHandX = -0.65 - (phase === 'ACTIVE' ? 0.04 : 0);
    pose.offHandY = -0.46 + (phase === 'WINDUP' ? 0.03 * p : phase === 'ACTIVE' ? 0.06 : 0);
    pose.offHandZ = phase === 'ACTIVE' ? -0.84 : -1.08;
    pose.offHandRotationZ = phase === 'WINDUP' ? 0.11 * p : phase === 'ACTIVE' ? -0.14 : -0.05 * (1 - p);
  }

  const eventProgress = smooth(input.viewmodelEventProgress ?? 0);
  if (input.viewmodelEvent === 'DODGE') {
    pose.weaponX += 0.12 * eventProgress;
    pose.weaponY += 0.1 * eventProgress;
    pose.weaponRotationZ += 0.12 * eventProgress;
    pose.offHandX += (offHandPose === 'twoHandGrip' ? 0.12 : -0.12) * eventProgress;
    pose.offHandY += 0.1 * eventProgress;
    pose.offHandRotationZ -= 0.12 * eventProgress;
  } else if (input.viewmodelEvent === 'HIT_RECOIL') {
    pose.weaponY -= 0.11 * eventProgress;
    pose.weaponZ += 0.07 * eventProgress;
    pose.weaponRotationZ -= 0.1 * eventProgress;
    pose.offHandY -= 0.08 * eventProgress;
    pose.offHandZ += 0.05 * eventProgress;
    pose.offHandRotationZ += 0.08 * eventProgress;
  } else if (input.viewmodelEvent === 'ITEM_USE') {
    pose.weaponX -= 0.24 * eventProgress;
    pose.weaponY += 0.19 * eventProgress;
    pose.weaponZ += 0.16 * eventProgress;
    pose.weaponRotationZ -= 0.18 * eventProgress;
  }
  return pose;
}

export class WeaponPresenter {
  private sprite: THREE.Sprite | null = null;
  private offHand: THREE.Sprite;
  private readonly pose = createWeaponPresentationPoseState();
  private readonly poseInput: WeaponPresentationPoseInput = {
    weapon: 'sword', moving: false, guarding: false, hasShield: false, elapsedSeconds: 0,
  };
  private currentWeapon: WeaponVisualType | null = null;
  private currentClassId: string | null = null;
  private currentMainHandId: string | null = null;
  private currentMainUnique = false;
  private currentOffHandId: string | null = null;
  private currentOffHandUnique = false;
  private currentOffHandVisual: OffHandVisualType | null = null;

  constructor(private readonly camera: THREE.PerspectiveCamera, private readonly assets: AssetManager) {
    this.offHand = new THREE.Sprite(new THREE.SpriteMaterial({ map: assets.offhandTexture('empty'), transparent: true, alphaTest: 0.08, depthTest: false, depthWrite: false, sizeAttenuation: false }));
    this.offHand.name = 'FirstPersonOffHand';
    this.offHand.renderOrder = 1000;
    this.offHand.frustumCulled = false;
    this.offHand.center.set(0.5, 0.45);
    this.offHand.scale.set(0.67, 0.67, 1);
    camera.add(this.offHand);
  }

  update(player: PlayerCharacter, action: ActivePlayerAction | null, isMoving: boolean, guarding: boolean, elapsedSeconds: number, viewmodelEvent: WeaponPresentationPoseInput['viewmodelEvent'] = null, viewmodelEventProgress = 0): void {
    const mainItem = player.equipment.mainHand;
    const equippedWeapon = getWeaponVisualTypeForPlayer(player);
    const weapon = action?.abilityId === 'ranger_volley' ? 'spear' : equippedWeapon;
    const actionWeaponItem = action?.weaponSlot === 'offHand' ? player.equipment.offHand : mainItem;
    const actionWeapon = action?.abilityId === 'ranger_volley' ? 'spear' : actionWeaponItem?.visualType ?? equippedWeapon;
    const offHandItem = player.equipment.offHand;
    const offHandPose = getOffHandPose(player);
    const offHandVisual = getOffHandVisual(player, offHandPose);
    const mainHandId = mainItem?.instanceId ?? 'unarmed';
    const mainUnique = Boolean(mainItem?.uniqueEffectId);
    const offHandId = offHandItem?.instanceId ?? 'empty';
    const offHandUnique = Boolean(offHandItem?.uniqueEffectId);
    if (weapon !== this.currentWeapon || player.classId !== this.currentClassId || mainHandId !== this.currentMainHandId || mainUnique !== this.currentMainUnique) {
      this.setWeapon(weapon, player.classId, mainUnique);
      this.currentWeapon = weapon;
      this.currentClassId = player.classId;
      this.currentMainHandId = mainHandId;
      this.currentMainUnique = mainUnique;
    }
    if (offHandId !== this.currentOffHandId || offHandUnique !== this.currentOffHandUnique || offHandVisual !== this.currentOffHandVisual) {
      this.setOffHand(offHandVisual, offHandUnique);
      this.currentOffHandId = offHandId;
      this.currentOffHandUnique = offHandUnique;
      this.currentOffHandVisual = offHandVisual;
    }
    if (!this.sprite) return;
    const input = this.poseInput;
    input.weapon = actionWeapon;
    input.abilityId = action?.abilityId;
    input.phase = action?.phase;
    input.remainingSeconds = action?.remainingSeconds;
    input.moving = isMoving;
    input.guarding = guarding;
    input.hasShield = isShieldItem(offHandItem);
    input.elapsedSeconds = elapsedSeconds;
    input.actionHand = action?.weaponSlot ?? 'mainHand';
    input.offHandPose = offHandPose;
    input.viewmodelEvent = viewmodelEvent;
    input.viewmodelEventProgress = viewmodelEventProgress;
    getWeaponPresentationPose(input, this.pose);
    const pose = this.pose;
    this.sprite.position.set(pose.weaponX, pose.weaponY, pose.weaponZ);
    this.sprite.rotation.set(pose.weaponRotationX, pose.weaponRotationY, pose.weaponRotationZ);
    this.sprite.scale.set(pose.weaponScaleX, pose.weaponScaleY, 1);
    this.offHand.visible = pose.offHandVisible;
    this.offHand.position.set(pose.offHandX, pose.offHandY, pose.offHandZ);
    this.offHand.scale.set(pose.offHandScale, pose.offHandScale, 1);
    this.offHand.rotation.z = pose.offHandRotationZ;
  }

  getDiagnostics(): {
    mainHandVisualId: WeaponVisualType | null;
    offHandVisualId: OffHandVisualType | null;
    mainHandAttachedToCamera: boolean;
    offHandAttachedToCamera: boolean;
    mainHandVisible: boolean;
    offHandVisible: boolean;
  } {
    return {
      mainHandVisualId: this.currentWeapon,
      offHandVisualId: this.currentOffHandVisual,
      mainHandAttachedToCamera: this.sprite?.parent === this.camera,
      offHandAttachedToCamera: this.offHand.parent === this.camera,
      mainHandVisible: this.sprite?.visible ?? false,
      offHandVisible: this.offHand.visible,
    };
  }

  private setOffHand(visual: OffHandVisualType, unique: boolean): void {
    this.offHand.material.map = this.assets.offhandTexture(visual);
    this.offHand.material.needsUpdate = true;
    this.offHand.material.color.set(unique ? '#ffe2a0' : '#ffffff');
  }

  private setWeapon(weapon: WeaponVisualType, classId: string, unique: boolean): void {
    if (!this.sprite) {
      const material = new THREE.SpriteMaterial({ map: this.assets.weaponTexture(weapon, classId), transparent: true, alphaTest: 0.08, depthTest: false, depthWrite: false, sizeAttenuation: false });
      this.sprite = new THREE.Sprite(material);
      this.sprite.name = 'FirstPersonMainHand';
      this.sprite.renderOrder = 1000;
      this.sprite.frustumCulled = false;
      this.sprite.center.set(0.5, 0.45);
      this.sprite.scale.set(0.72, 0.72, 1);
      this.camera.add(this.sprite);
    } else {
      this.sprite.material.map = this.assets.weaponTexture(weapon, classId);
      this.sprite.material.needsUpdate = true;
    }
    this.sprite.material.color.set(unique ? '#ffe2a0' : '#ffffff');
  }

  dispose(): void {
    if (this.sprite) {
      this.camera.remove(this.sprite);
      this.sprite.material.dispose();
      this.sprite = null;
    }
    this.camera.remove(this.offHand);
    this.offHand.material.dispose();
  }
}
