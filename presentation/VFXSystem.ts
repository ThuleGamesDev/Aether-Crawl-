import * as THREE from 'three';
import type { AssetManager } from './AssetManager';

interface Particle {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  remaining: number;
  lifetime: number;
}

export type PixelEffectId = 'bronze_impact' | 'laurel_light' | 'promethean_flame' | 'soul_ash' | 'cistern_splash' | 'oracle_spark' | 'serpent_venom'
  | 'bronze_slash' | 'spear_thrust' | 'shield_impact' | 'blood_hit' | 'poison_splash' | 'web_impact' | 'fire_burst' | 'stone_shockwave' | 'chthonic_bolt' | 'boss_death_burst';

export class VFXSystem {
  private readonly particles: Particle[] = [];
  private cursor = 0;

  constructor(private readonly scene: THREE.Scene, private readonly assets: AssetManager, capacity = 48) {
    for (let index = 0; index < capacity; index += 1) {
      const material = new THREE.SpriteMaterial({ map: assets.vfxTexture('bronze_impact'), transparent: true, opacity: 0.9, depthWrite: false, alphaTest: 0.04, color: 0xffffff });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      sprite.frustumCulled = false;
      sprite.renderOrder = 4;
      sprite.name = 'PooledPixelVFX';
      scene.add(sprite);
      this.particles.push({ sprite, velocity: new THREE.Vector3(), remaining: 0, lifetime: 0 });
    }
  }

  burst(position: { x: number; y: number; z: number }, color: string, count = 8, scale = 1, effectId: PixelEffectId = 'bronze_impact', direction?: { x: number; z: number }): void {
    const forward = new THREE.Vector3(direction?.x ?? 0, 0, direction?.z ?? 1).normalize();
    const side = new THREE.Vector3(-forward.z, 0, forward.x);
    for (let index = 0; index < Math.min(count, this.particles.length); index += 1) {
      const particle = this.particles[this.cursor];
      this.cursor = (this.cursor + 1) % this.particles.length;
      const angle = index * 2.399963 + this.cursor * 0.37;
      const vertical = ((index % 4) - 1.5) * (effectId === 'stone_shockwave' ? 0.35 : 1.35);
      particle.sprite.visible = true;
      particle.sprite.position.set(position.x, position.y, position.z);
      const particleSize = effectId === 'spear_thrust' ? 0.18 : effectId === 'stone_shockwave' ? 0.27 : 0.22 + (index % 3) * 0.07;
      particle.sprite.scale.setScalar(particleSize * Math.min(1.8, scale));
      const material = particle.sprite.material as THREE.SpriteMaterial;
      const texture = this.assets.vfxTexture(effectId);
      if (material.map !== texture) { material.map = texture; material.needsUpdate = true; }
      material.color.set(color);
      material.opacity = 0.92;
      const radialX = Math.cos(angle) * (1.05 + (index % 3) * 0.24);
      const radialZ = Math.sin(angle) * (1.05 + (index % 2) * 0.28);
      if (effectId === 'spear_thrust') particle.velocity.set(forward.x * (1.9 + index * 0.08) + side.x * radialX * 0.18, vertical * 0.25, forward.z * (1.9 + index * 0.08) + side.z * radialX * 0.18);
      else if (effectId === 'bronze_slash') particle.velocity.set(side.x * (1.4 + index * 0.12) + forward.x * 0.28, vertical * 0.18, side.z * (1.4 + index * 0.12) + forward.z * 0.28);
      else if (effectId === 'stone_shockwave') particle.velocity.set(radialX * 0.72, 0.04, radialZ * 0.72);
      else particle.velocity.set(radialX, vertical, radialZ);
      particle.remaining = effectId === 'spear_thrust' ? 0.18 + (index % 2) * 0.04 : 0.26 + (index % 3) * 0.065;
      particle.lifetime = particle.remaining;
    }
  }

  trail(position: { x: number; y: number; z: number }, color: string): void {
    const particle = this.particles[this.cursor];
    this.cursor = (this.cursor + 1) % this.particles.length;
    particle.sprite.visible = true;
    particle.sprite.position.set(position.x, position.y, position.z);
    particle.sprite.scale.setScalar(0.16);
    const material = particle.sprite.material as THREE.SpriteMaterial;
    const texture = this.assets.vfxTexture('oracle_spark');
    if (material.map !== texture) { material.map = texture; material.needsUpdate = true; }
    material.color.set(color);
    material.opacity = 0.72;
    particle.velocity.set(0, 0.15, 0);
    particle.remaining = 0.16;
    particle.lifetime = 0.16;
  }

  update(deltaSeconds: number): void {
    const dt = Math.max(0, Math.min(0.05, deltaSeconds));
    for (const particle of this.particles) {
      if (!particle.sprite.visible) continue;
      particle.remaining -= dt;
      if (particle.remaining <= 0) { particle.sprite.visible = false; continue; }
      particle.velocity.y -= 4.2 * dt;
      particle.sprite.position.addScaledVector(particle.velocity, dt);
      const material = particle.sprite.material as THREE.SpriteMaterial;
      material.opacity = Math.max(0, particle.remaining / particle.lifetime);
      particle.sprite.scale.multiplyScalar(1 - Math.min(0.08, dt * 0.8));
    }
  }

  dispose(): void {
    for (const particle of this.particles) {
      this.scene.remove(particle.sprite);
      (particle.sprite.material as THREE.Material).dispose();
    }
    this.particles.length = 0;
  }
}
