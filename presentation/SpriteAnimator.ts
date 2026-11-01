import * as THREE from 'three';
import type { BiomeId, WorldEnemy } from '../types';
import { AssetManager } from './AssetManager';

export function createEnemySprite(enemy: WorldEnemy, biome: BiomeId, assets: AssetManager): THREE.Sprite {
  const material = new THREE.SpriteMaterial({ map: assets.enemyTexture(enemy.visualId, biome), transparent: true, alphaTest: 0.08, depthTest: true, depthWrite: false, color: 0xffffff });
  const sprite = new THREE.Sprite(material);
  sprite.center.set(0.5, 0);
  sprite.name = 'WorldEnemy_' + enemy.id;
  const rat = enemy.visualId === 'giant_rat';
  sprite.scale.set(rat ? 0.88 : enemy.isBoss ? 1.5 : 0.98, rat ? 0.7 : enemy.isBoss ? 1.95 : 1.55, 1);
  sprite.position.set(enemy.position.x, 0.035, enemy.position.z);
  return sprite;
}

export function animateEnemySprite(sprite: THREE.Sprite, enemy: WorldEnemy, elapsedSeconds: number): void {
  const material = sprite.material as THREE.SpriteMaterial;
  const rat = enemy.visualId === 'giant_rat';
  const baseHeight = rat ? 0.7 : enemy.isBoss ? 1.95 : 1.55;
  const moving = enemy.state === 'APPROACH' || enemy.state === 'AGGRO';
  const bob = moving ? Math.abs(Math.sin(elapsedSeconds * 11 + enemy.position.x)) * 0.045 : Math.sin(elapsedSeconds * 2 + enemy.position.z) * 0.025;
  sprite.position.set(enemy.position.x, 0.035 + bob, enemy.position.z);
  sprite.rotation.z = enemy.state === 'ATTACK_WINDUP' ? Math.sin(elapsedSeconds * 14) * 0.08 : enemy.state === 'HURT' ? -0.12 : 0;
  if (enemy.state === 'ATTACK_WINDUP') {
    sprite.scale.y = baseHeight * 0.92;
    sprite.scale.x = (rat ? 0.88 : enemy.isBoss ? 1.5 : 0.98) * 1.08;
    material.color.set('#ffae72');
  } else if (enemy.state === 'ATTACK') {
    sprite.scale.y = baseHeight * 1.06;
    material.color.set('#ff875e');
  } else if (enemy.state === 'HURT') {
    sprite.scale.y = baseHeight;
    material.color.set('#fff0dc');
  } else if (enemy.state === 'DEAD') {
    sprite.scale.y = Math.max(0.18, baseHeight * (0.28 + enemy.stateTimer * 0.25));
    sprite.material.opacity = Math.max(0, Math.min(1, enemy.stateTimer / 1.1));
    sprite.visible = enemy.stateTimer > 0.02;
    material.color.set('#8f7b78');
  } else {
    sprite.visible = true;
    sprite.scale.x = rat ? 0.88 : enemy.isBoss ? 1.5 : 0.98;
    sprite.scale.y = baseHeight;
    sprite.material.opacity = 1;
    material.color.set('#ffffff');
  }
}
