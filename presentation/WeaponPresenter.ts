import * as THREE from 'three';
import type { PlayerCharacter, WeaponVisualType } from '../types';
import type { ActivePlayerAction } from '../player/PlayerCombat';
import { AssetManager } from './AssetManager';

const weaponFor = (player: PlayerCharacter): WeaponVisualType => player.equipment.weapon?.visualType ?? (player.classId === 'MONK' ? 'unarmed' : player.classId === 'SORCERER' || player.classId === 'NECROMANCER' ? 'staff' : 'sword');

export class WeaponPresenter {
  private sprite: THREE.Sprite | null = null;
  private currentKey = '';

  constructor(private readonly camera: THREE.PerspectiveCamera, private readonly assets: AssetManager) {}

  update(player: PlayerCharacter, action: ActivePlayerAction | null, isMoving: boolean, elapsedSeconds: number): void {
    const weapon = weaponFor(player);
    const key = weapon + ':' + player.classId;
    if (key !== this.currentKey) this.setWeapon(weapon, player.classId, key);
    if (!this.sprite) return;
    const phase = action?.phase;
    const gait = isMoving ? Math.sin(elapsedSeconds * 10) : Math.sin(elapsedSeconds * 1.4) * 0.08;
    const swing = phase === 'WINDUP' ? -0.22 : phase === 'ACTIVE' ? 0.38 : phase === 'RECOVERY' ? 0.13 : 0;
    this.sprite.position.set(0.68 + gait * 0.04, -0.48 + gait * 0.055 + swing * 0.18, -1.05);
    this.sprite.rotation.z = swing + (isMoving ? Math.sin(elapsedSeconds * 10) * 0.025 : 0);
    this.sprite.rotation.x = phase === 'WINDUP' ? 0.2 : 0;
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
  }
}
