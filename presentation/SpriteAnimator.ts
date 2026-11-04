import * as THREE from 'three';
import type { BiomeId, WorldEnemy } from '../types';
import { AssetManager } from './AssetManager';
import { enemyVisuals } from '../data/assetRegistry';
import { getEnemyDeathProgress } from './enemyCorpsePresentation';
import { ENEMY_CORPSE_SETTLE_SECONDS } from '../constants/enemyDeath';

export function createEnemySprite(enemy: WorldEnemy, biome: BiomeId, assets: AssetManager, fallbackPath?: string): THREE.Sprite {
  const material = new THREE.SpriteMaterial({ map: assets.enemyTexture(enemy.visualId, biome, fallbackPath), transparent: true, alphaTest: 0.08, depthTest: true, depthWrite: false, color: 0xffffff });
  const sprite = new THREE.Sprite(material);
  sprite.center.set(0.5, 0);
  sprite.name = 'WorldEnemy_' + enemy.id;
  const rat = enemy.visualId === 'cretan_cave_rat' || enemy.visualId === 'giant_rat';
  const size = enemyVisuals[enemy.visualId]?.scale ?? 1;
  sprite.scale.set(rat ? 0.88 : enemy.isBoss ? 1.55 : 0.98 * size, rat ? 0.7 : enemy.isBoss ? 1.95 : 1.55 * size, 1);
  sprite.position.set(enemy.position.x, 0.035, enemy.position.z);
  return sprite;
}

export function animateEnemySprite(sprite: THREE.Sprite, enemy: WorldEnemy, elapsedSeconds: number): void {
  const material = sprite.material as THREE.SpriteMaterial;
  const rat = enemy.visualId === 'cretan_cave_rat' || enemy.visualId === 'giant_rat';
  const size = enemyVisuals[enemy.visualId]?.scale ?? 1;
  const baseWidth = rat ? 0.88 : enemy.isBoss ? 1.55 : 0.98 * size;
  const baseHeight = rat ? 0.7 : enemy.isBoss ? 1.95 : 1.55 * size;
  const moving = ['CHASE', 'APPROACH', 'AGGRO', 'REPOSITION', 'RETREAT'].includes(enemy.state);
  const phase = elapsedSeconds * (rat ? 13.5 : 10.5) + enemy.position.x * 2.1 + enemy.position.z;
  const gait = Math.sin(phase);
  let bob = 0;
  let scaleX = baseWidth, scaleY = baseHeight, tilt = 0;
  let tint = enemy.lawId === 'bronze_hounds' ? '#c89d59' : '#ffffff';
  let opacity = 1;
  if (moving) {
    bob = Math.max(0, gait) * (rat ? 0.055 : 0.035);
    scaleY *= 1 + Math.abs(gait) * 0.018;
    tilt = gait * (rat ? 0.04 : 0.025);
  } else if (enemy.state === 'IDLE') {
    const breath = Math.sin(elapsedSeconds * 2.2 + enemy.position.x) * 0.012;
    scaleY *= 1 + breath;
    scaleX *= 1 - breath * 0.45;
  }

  const windup = enemy.state === 'ATTACK_WINDUP' ? Math.min(1, Math.max(0, 1 - enemy.stateTimer / Math.max(0.08, enemy.attackTelegraphSeconds))) : 0;
  if (enemy.state === 'ALERT' || enemy.state === 'AGGRO') {
    scaleX *= 1.035;
    tint = '#e2bf86';
  } else if (enemy.state === 'ATTACK_WINDUP') {
    scaleX *= 1 + windup * (enemy.isBoss ? 0.12 : 0.08);
    scaleY *= 1 - windup * 0.1;
    tilt = -windup * 0.07;
    tint = windup > 0.7 ? '#ffcb75' : '#e8a86b';
  } else if (enemy.state === 'ATTACK_ACTIVE' || enemy.state === 'ATTACK') {
    scaleX *= 1.1;
    scaleY *= 1.035;
    tilt = -0.055;
    tint = '#ff9363';
  } else if (enemy.state === 'RECOVER') {
    scaleY *= 0.96;
    tint = '#d8c0a0';
  } else if (enemy.state === 'HURT') {
    scaleX *= 0.94;
    scaleY *= 1.04;
    tilt = -0.14;
    tint = '#fff0dc';
  } else if (enemy.state === 'STAGGER') {
    scaleX *= 0.9;
    scaleY *= 1.08;
    tilt = Math.sin(elapsedSeconds * 24) * 0.11;
    tint = '#e9e4ce';
  } else if (enemy.state === 'DEAD') {
    const fall = getEnemyDeathProgress(enemy);
    const settled = fall * fall * (3 - 2 * fall);
    scaleY *= 1 - settled * 0.16;
    scaleX *= 1 + settled * 0.08;
    tilt = (enemy.id.charCodeAt(enemy.id.length - 1) % 2 ? 1 : -1) * settled * 1.28;
    opacity = 1 - settled * 0.12;
    tint = '#b3a39a';
  }

  const status = enemy.statusEffects?.find(effect => effect.durationSeconds > 0);
  if (status && enemy.state !== 'HURT' && enemy.state !== 'STAGGER' && enemy.state !== 'DEAD') {
    tint = status.statusId === 'POISON' ? '#b3c96f' : status.statusId === 'BURN' ? '#f59a55' : status.statusId === 'SLOW' ? '#8fbfca' : status.statusId === 'GUARD' ? '#e0bd72' : '#d58d8e';
  }

  sprite.position.set(enemy.position.x, 0.035 + bob, enemy.position.z);
  sprite.rotation.z = tilt;
  sprite.scale.set(scaleX, scaleY, 1);
  material.color.set(tint);
  material.opacity = opacity;
  sprite.visible = enemy.state !== 'DEAD' || enemy.stateTimer > ENEMY_CORPSE_SETTLE_SECONDS;
}
