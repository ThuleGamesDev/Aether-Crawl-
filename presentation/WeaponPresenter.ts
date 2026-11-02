import * as THREE from 'three';
import type { PlayerCharacter, WeaponVisualType } from '../types';
import type { ActivePlayerAction, PlayerActionPhase } from '../player/PlayerCombat';
import { AssetManager } from './AssetManager';
import { getAbility } from '../combat/AbilityRegistry';

export const getWeaponVisualTypeForPlayer = (player: PlayerCharacter): WeaponVisualType => player.equipment.weapon?.visualType ?? (player.classId === 'MONK' ? 'unarmed' : player.classId === 'SORCERER' || player.classId === 'NECROMANCER' ? 'staff' : 'sword');

export interface WeaponPresentationPoseInput {
  weapon: WeaponVisualType;
  abilityId?: string;
  phase?: PlayerActionPhase;
  remainingSeconds?: number;
  moving: boolean;
  guarding: boolean;
  hasShield: boolean;
  elapsedSeconds: number;
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

/** Returns camera-space hand poses from the equipped weapon and real AbilityDefinition timing. */
export function getWeaponPresentationPose(input: WeaponPresentationPoseInput): WeaponPresentationPose {
  const ability = input.abilityId ? getAbility(input.abilityId) : undefined;
  const p = smooth(phaseProgress(input));
  const phase = input.phase;
  const moving = input.moving ? Math.sin(input.elapsedSeconds * 9.5) : Math.sin(input.elapsedSeconds * 1.5) * 0.08;
  const pose: WeaponPresentationPose = {
    weaponX: 0.68,
    weaponY: -0.48 + moving * 0.045,
    weaponZ: -1.05,
    weaponRotationX: 0,
    weaponRotationY: 0,
    weaponRotationZ: input.moving ? moving * 0.025 : 0,
    weaponScaleX: 0.72,
    weaponScaleY: 0.72,
    shieldVisible: input.hasShield,
    shieldX: -0.66 + moving * 0.018,
    shieldY: -0.43 + moving * 0.035,
    shieldZ: -1.12,
    shieldRotationZ: 0,
    shieldScale: 0.38,
  };

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
      const javelin = input.abilityId?.includes('javelin') ?? false;
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
      pose.shieldX = -0.34 + (phase === 'WINDUP' ? -p * 0.03 : phase === 'ACTIVE' ? 0.06 : (1 - p) * 0.06);
      pose.shieldY = -0.42 + (phase === 'WINDUP' ? -p * 0.04 : phase === 'ACTIVE' ? 0.02 : -p * 0.04);
      pose.shieldZ = phase === 'ACTIVE' ? -0.78 : -0.98;
      pose.shieldRotationZ = phase === 'WINDUP' ? -0.2 * p : phase === 'ACTIVE' ? 0.1 : 0.12 * (1 - p);
      pose.shieldScale = phase === 'ACTIVE' ? 0.46 : 0.42;
    }
  }
  return pose;
}

export class WeaponPresenter {
  private sprite: THREE.Sprite | null = null;
  private shield: THREE.Sprite;
  private currentKey = '';

  constructor(private readonly camera: THREE.PerspectiveCamera, private readonly assets: AssetManager) {
    this.shield = new THREE.Sprite(new THREE.SpriteMaterial({ map: assets.shieldTexture(), transparent: true, alphaTest: 0.08, depthTest: false, depthWrite: false, sizeAttenuation: false }));
    this.shield.name = 'FirstPersonAspis';
    this.shield.center.set(0.5, 0.45);
    this.shield.scale.set(0.38, 0.38, 1);
    this.shield.visible = false;
    camera.add(this.shield);
  }

  update(player: PlayerCharacter, action: ActivePlayerAction | null, isMoving: boolean, guarding: boolean, elapsedSeconds: number): void {
    const weapon = getWeaponVisualTypeForPlayer(player);
    const key = weapon + ':' + player.classId;
    if (key !== this.currentKey) this.setWeapon(weapon, player.classId, key);
    if (!this.sprite) return;
    const pose = getWeaponPresentationPose({
      weapon,
      abilityId: action?.abilityId,
      phase: action?.phase,
      remainingSeconds: action?.remainingSeconds,
      moving: isMoving,
      guarding,
      hasShield: Boolean(player.equipment.offhand),
      elapsedSeconds,
    });
    this.sprite.position.set(pose.weaponX, pose.weaponY, pose.weaponZ);
    this.sprite.rotation.set(pose.weaponRotationX, pose.weaponRotationY, pose.weaponRotationZ);
    this.sprite.scale.set(pose.weaponScaleX, pose.weaponScaleY, 1);
    this.shield.visible = pose.shieldVisible;
    this.shield.position.set(pose.shieldX, pose.shieldY, pose.shieldZ);
    this.shield.scale.set(pose.shieldScale, pose.shieldScale, 1);
    this.shield.rotation.z = pose.shieldRotationZ;
  }

  private setWeapon(weapon: WeaponVisualType, classId: string, key: string): void {
    if (this.sprite) {
      this.camera.remove(this.sprite);
      this.sprite.material.dispose();
    }
    const material = new THREE.SpriteMaterial({ map: this.assets.weaponTexture(weapon, classId), transparent: true, alphaTest: 0.08, depthTest: false, depthWrite: false, sizeAttenuation: false });
    this.sprite = new THREE.Sprite(material);
    this.sprite.name = 'FirstPersonWeapon';
    this.sprite.center.set(0.5, 0.45);
    this.sprite.scale.set(0.72, 0.72, 1);
    this.camera.add(this.sprite);
    this.currentKey = key;
  }

  dispose(): void {
    if (this.sprite) {
      this.camera.remove(this.sprite);
      this.sprite.material.dispose();
      this.sprite = null;
    }
    this.camera.remove(this.shield);
    this.shield.material.dispose();
  }
}
