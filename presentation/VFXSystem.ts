import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  remaining: number;
  lifetime: number;
}

export class VFXSystem {
  private readonly particles: Particle[] = [];
  private readonly geometry = new THREE.BoxGeometry(0.055, 0.055, 0.055);
  private cursor = 0;

  constructor(private readonly scene: THREE.Scene, capacity = 48) {
    for (let index = 0; index < capacity; index += 1) {
      const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.name = 'PooledPixelVFX';
      scene.add(mesh);
      this.particles.push({ mesh, velocity: new THREE.Vector3(), remaining: 0, lifetime: 0 });
    }
  }

  burst(position: { x: number; y: number; z: number }, color: string, count = 8, scale = 1): void {
    for (let index = 0; index < Math.min(count, this.particles.length); index += 1) {
      const particle = this.particles[this.cursor];
      this.cursor = (this.cursor + 1) % this.particles.length;
      const angle = index * 2.399963 + this.cursor * 0.37;
      const vertical = ((index % 4) - 1.5) * 1.7;
      particle.mesh.visible = true;
      particle.mesh.position.set(position.x, position.y, position.z);
      particle.mesh.scale.setScalar((0.65 + (index % 3) * 0.28) * scale);
      const material = particle.mesh.material as THREE.MeshBasicMaterial;
      material.color.set(color);
      material.opacity = 0.92;
      particle.velocity.set(Math.cos(angle) * (1.25 + (index % 3) * 0.32), vertical, Math.sin(angle) * (1.25 + (index % 2) * 0.38));
      particle.remaining = 0.28 + (index % 3) * 0.08;
      particle.lifetime = particle.remaining;
    }
  }

  trail(position: { x: number; y: number; z: number }, color: string): void {
    const particle = this.particles[this.cursor];
    this.cursor = (this.cursor + 1) % this.particles.length;
    particle.mesh.visible = true;
    particle.mesh.position.set(position.x, position.y, position.z);
    particle.mesh.scale.setScalar(0.34);
    const material = particle.mesh.material as THREE.MeshBasicMaterial;
    material.color.set(color);
    material.opacity = 0.72;
    particle.velocity.set(0, 0.15, 0);
    particle.remaining = 0.16;
    particle.lifetime = 0.16;
  }

  update(deltaSeconds: number): void {
    const dt = Math.max(0, Math.min(0.05, deltaSeconds));
    for (const particle of this.particles) {
      if (!particle.mesh.visible) continue;
      particle.remaining -= dt;
      if (particle.remaining <= 0) { particle.mesh.visible = false; continue; }
      particle.velocity.y -= 4.2 * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      const material = particle.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, particle.remaining / particle.lifetime);
      particle.mesh.scale.multiplyScalar(1 - Math.min(0.08, dt * 0.8));
    }
  }

  dispose(): void {
    for (const particle of this.particles) {
      this.scene.remove(particle.mesh);
      (particle.mesh.material as THREE.Material).dispose();
    }
    this.geometry.dispose();
    this.particles.length = 0;
  }
}
