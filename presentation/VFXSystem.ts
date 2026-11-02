import * as THREE from 'three';
import type { AssetManager } from './AssetManager';

interface Particle {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  remaining: number;
  lifetime: number;
}

export type PixelEffectId = 'bronze_impact' | 'laurel_light' | 'promethean_flame' | 'soul_ash' | 'cistern_splash' | 'oracle_spark' | 'serpent_venom';

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

  burst(position: { x: number; y: number; z: number }, color: string, count = 8, scale = 1, effectId: PixelEffectId = 'bronze_impact'): void {
    for (let index = 0; index < Math.min(count, this.particles.length); index += 1) {
      const particle = this.particles[this.cursor];
      this.cursor = (this.cursor + 1) % this.particles.length;
      const angle = index * 2.399963 + this.cursor * 0.37;
      const vertical = ((index % 4) - 1.5) * 1.7;
      particle.sprite.visible = true;
      particle.sprite.position.set(position.x, position.y, position.z);
      particle.sprite.scale.setScalar((0.22 + (index % 3) * 0.07) * Math.min(1.8, scale));
      const material = particle.sprite.material as THREE.SpriteMaterial;
      material.map = this.assets.vfxTexture(effectId);
      material.color.set(color);
      material.opacity = 0.92;
      material.needsUpdate = true;
      particle.velocity.set(Math.cos(angle) * (1.25 + (index % 3) * 0.32), vertical, Math.sin(angle) * (1.25 + (index % 2) * 0.38));
      particle.remaining = 0.28 + (index % 3) * 0.08;
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
    material.map = this.assets.vfxTexture('oracle_spark');
    material.color.set(color);
    material.opacity = 0.72;
    material.needsUpdate = true;
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
