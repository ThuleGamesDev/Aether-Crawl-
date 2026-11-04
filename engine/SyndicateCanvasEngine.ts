import { Agent, Entity, Vehicle, ParticleEffect, LaserBeam } from '../types/syndicate';

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  rotation: number; // 0, 90, 180, 270 degrees
}

export class SyndicateCanvasEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: CameraState = { x: 500, y: 500, zoom: 1.0, rotation: 0 };
  private rainParticles: { x: number; y: number; speed: number; length: number }[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Failed to get 2D context');
    this.ctx = context;

    // Initialize rain
    for (let i = 0; i < 150; i++) {
      this.rainParticles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        speed: 12 + Math.random() * 8,
        length: 10 + Math.random() * 15
      });
    }
  }

  public setCamera(cam: Partial<CameraState>) {
    this.camera = { ...this.camera, ...cam };
  }

  public getCamera(): CameraState {
    return this.camera;
  }

  // World (x, y) to Screen Projection considering camera and rotation
  public worldToScreen(worldX: number, worldY: number, worldZ: number = 0) {
    let dx = worldX - this.camera.x;
    let dy = worldY - this.camera.y;

    // Apply camera rotation
    const rad = (this.camera.rotation * Math.PI) / 180;
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);

    // Isometric 2.5D projection
    const isoX = (rx - ry) * 0.8;
    const isoY = (rx + ry) * 0.4 - worldZ * 0.8;

    const screenX = this.canvas.width / 2 + isoX * this.camera.zoom;
    const screenY = this.canvas.height / 2 + isoY * this.camera.zoom;

    return { x: screenX, y: screenY };
  }

  // Screen to World (Approximate ground plane Z=0)
  public screenToWorld(screenX: number, screenY: number) {
    const isoX = (screenX - this.canvas.width / 2) / this.camera.zoom;
    const isoY = (screenY - this.canvas.height / 2) / this.camera.zoom;

    // Invert isometric
    const rx = (isoX / 0.8 + isoY / 0.4) / 2;
    const ry = (isoY / 0.4 - isoX / 0.8) / 2;

    // Invert rotation
    const rad = (-this.camera.rotation * Math.PI) / 180;
    const worldX = rx * Math.cos(rad) - ry * Math.sin(rad) + this.camera.x;
    const worldY = rx * Math.sin(rad) + ry * Math.cos(rad) + this.camera.y;

    return { x: worldX, y: worldY };
  }

  public render(
    agents: Agent[],
    entities: Entity[],
    vehicles: Vehicle[],
    particles: ParticleEffect[],
    lasers: LaserBeam[],
    selectionBox: { startX: number; startY: number; endX: number; endY: number } | null,
    targetMarker: { x: number; y: number; time: number } | null,
    orbitalBeam: { x: number; y: number; radius: number; life: number } | null
  ) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.clearRect(0, 0, width, height);

    // 1. Dark Void background
    this.ctx.fillStyle = '#030712';
    this.ctx.fillRect(0, 0, width, height);

    // 2. Render City Map Grid & Road Infrastructure
    this.renderCityGrid();

    // 3. Render Vehicles
    vehicles.forEach(vehicle => this.renderVehicle(vehicle));

    // 4. Render Persuadertron Waves & Thrall Connection Lines
    agents.forEach(agent => {
      if (agent.status === 'ALIVE' && agent.inventory[agent.activeWeaponIndex]?.id === 'persuader' && agent.isFiring) {
        this.renderPersuaderWave(agent);
      }
    });

    // 5. Render Entities (Civilians, Police, Enemy Guards, Thralls)
    entities.forEach(entity => this.renderEntity(entity));

    // 6. Render Player Agents
    agents.forEach(agent => this.renderAgent(agent));

    // 7. Render Particles & Projectiles
    this.renderParticles(particles);
    this.renderLasers(lasers);

    // 8. Render Orbital Satellite Laser Strike
    if (orbitalBeam) {
      this.renderOrbitalBeam(orbitalBeam);
    }

    // 9. Rain & Atmospheric FX
    this.renderRain();

    // 10. Selection Box
    if (selectionBox) {
      this.ctx.strokeStyle = '#00f0ff';
      this.ctx.lineWidth = 1.5;
      this.ctx.setLineDash([4, 4]);
      const w = selectionBox.endX - selectionBox.startX;
      const h = selectionBox.endY - selectionBox.startY;
      this.ctx.strokeRect(selectionBox.startX, selectionBox.startY, w, h);
      this.ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
      this.ctx.fillRect(selectionBox.startX, selectionBox.startY, w, h);
      this.ctx.setLineDash([]);
    }

    // 11. Target Click Marker
    if (targetMarker && targetMarker.time > 0) {
      const pos = this.worldToScreen(targetMarker.x, targetMarker.y);
      const alpha = Math.min(1, targetMarker.time);
      const size = 18 * (1 - targetMarker.time * 0.3);

      this.ctx.save();
      this.ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
      this.ctx.stroke();

      // Crosshair lines
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x - size - 4, pos.y);
      this.ctx.lineTo(pos.x + size + 4, pos.y);
      this.ctx.moveTo(pos.x, pos.y - size - 4);
      this.ctx.lineTo(pos.x, pos.y + size + 4);
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  private renderCityGrid() {
    const mapSize = 1600;
    const step = 80;

    // Ground Asphalt Base
    const p1 = this.worldToScreen(0, 0);
    const p2 = this.worldToScreen(mapSize, 0);
    const p3 = this.worldToScreen(mapSize, mapSize);
    const p4 = this.worldToScreen(0, mapSize);

    this.ctx.fillStyle = '#0a101d';
    this.ctx.beginPath();
    this.ctx.moveTo(p1.x, p1.y);
    this.ctx.lineTo(p2.x, p2.y);
    this.ctx.lineTo(p3.x, p3.y);
    this.ctx.lineTo(p4.x, p4.y);
    this.ctx.closePath();
    this.ctx.fill();

    // Road Lines & Pavement Blocks
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    this.ctx.lineWidth = 1;

    for (let x = 0; x <= mapSize; x += step) {
      const start = this.worldToScreen(x, 0);
      const end = this.worldToScreen(x, mapSize);
      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y);
      this.ctx.lineTo(end.x, end.y);
      this.ctx.stroke();
    }

    for (let y = 0; y <= mapSize; y += step) {
      const start = this.worldToScreen(0, y);
      const end = this.worldToScreen(mapSize, y);
      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y);
      this.ctx.lineTo(end.x, end.y);
      this.ctx.stroke();
    }

    // Render Buildings with Neon Signs
    const buildings = [
      { x: 200, y: 200, w: 240, h: 240, z: 120, label: 'EUROCORP R&D', color: '#00f0ff' },
      { x: 600, y: 200, w: 280, h: 200, z: 160, label: 'EXECUTIVE ACTION', color: '#ff6600' },
      { x: 1000, y: 300, w: 220, h: 260, z: 140, label: 'CYBER TOWER', color: '#a855f7' },
      { x: 300, y: 700, w: 320, h: 220, z: 180, label: 'NEO PLAZA', color: '#39ff14' },
      { x: 800, y: 800, w: 260, h: 260, z: 150, label: 'CHURCH OF EPOCH', color: '#ef4444' }
    ];

    buildings.forEach(b => this.renderBuilding(b.x, b.y, b.w, b.h, b.z, b.label, b.color));
  }

  private renderBuilding(x: number, y: number, w: number, h: number, z: number, label: string, color: string) {
    const groundP1 = this.worldToScreen(x, y);
    const groundP2 = this.worldToScreen(x + w, y);
    const groundP3 = this.worldToScreen(x + w, y + h);
    const groundP4 = this.worldToScreen(x, y + h);

    const roofP1 = this.worldToScreen(x, y, z);
    const roofP2 = this.worldToScreen(x + w, y, z);
    const roofP3 = this.worldToScreen(x + w, y + h, z);
    const roofP4 = this.worldToScreen(x, y + h, z);

    // Front Wall Left
    this.ctx.fillStyle = '#060d1a';
    this.ctx.beginPath();
    this.ctx.moveTo(groundP1.x, groundP1.y);
    this.ctx.lineTo(groundP4.x, groundP4.y);
    this.ctx.lineTo(roofP4.x, roofP4.y);
    this.ctx.lineTo(roofP1.x, roofP1.y);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.strokeStyle = '#1e293b';
    this.ctx.stroke();

    // Front Wall Right
    this.ctx.fillStyle = '#0a1526';
    this.ctx.beginPath();
    this.ctx.moveTo(groundP4.x, groundP4.y);
    this.ctx.lineTo(groundP3.x, groundP3.y);
    this.ctx.lineTo(roofP3.x, roofP3.y);
    this.ctx.lineTo(roofP4.x, roofP4.y);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.strokeStyle = '#1e293b';
    this.ctx.stroke();

    // Roof Top
    this.ctx.fillStyle = '#0f172a';
    this.ctx.beginPath();
    this.ctx.moveTo(roofP1.x, roofP1.y);
    this.ctx.lineTo(roofP2.x, roofP2.y);
    this.ctx.lineTo(roofP3.x, roofP3.y);
    this.ctx.lineTo(roofP4.x, roofP4.y);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    // Neon Billboard on Roof Front
    const midX = (roofP4.x + roofP3.x) / 2;
    const midY = (roofP4.y + roofP3.y) / 2 - 12;

    this.ctx.save();
    this.ctx.fillStyle = color;
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 10;
    this.ctx.font = 'bold 11px "Chakra Petch", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(label, midX, midY);
    this.ctx.restore();
  }

  private renderAgent(agent: Agent) {
    if (agent.status === 'DEAD') return;

    const pos = this.worldToScreen(agent.x, agent.y);

    // Selected Ring & Health Gauge
    if (agent.selected) {
      this.ctx.save();
      this.ctx.strokeStyle = '#00f0ff';
      this.ctx.lineWidth = 2;
      this.ctx.shadowColor = '#00f0ff';
      this.ctx.shadowBlur = 8;
      this.ctx.beginPath();
      this.ctx.ellipse(pos.x, pos.y, 16 * this.camera.zoom, 9 * this.camera.zoom, 0, 0, Math.PI * 2);
      this.ctx.stroke();

      // Health Bar above agent
      const hpPercent = agent.hp / agent.maxHp;
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      this.ctx.fillRect(pos.x - 18, pos.y - 32, 36, 5);
      this.ctx.fillStyle = hpPercent > 0.5 ? '#10b981' : hpPercent > 0.2 ? '#f59e0b' : '#ef4444';
      this.ctx.fillRect(pos.x - 18, pos.y - 32, 36 * hpPercent, 5);
      this.ctx.restore();
    }

    // Agent Cyber Trench Coat Body
    this.ctx.save();
    
    // Shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    this.ctx.beginPath();
    this.ctx.ellipse(pos.x, pos.y, 10, 5, 0, 0, Math.PI * 2);
    this.ctx.fill();

    if (agent.status === 'DOWN') {
      // Downed Agent
      this.ctx.fillStyle = '#64748b';
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y - 4, 8, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
      return;
    }

    // Trench Coat (Dark leather)
    this.ctx.fillStyle = '#0f172a';
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y - 12, 9 * this.camera.zoom, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = '#334155';
    this.ctx.stroke();

    // Cyber Visor Glow (Cyan for EuroCorp Agent)
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 6;
    this.ctx.fillRect(pos.x - 3, pos.y - 15, 6, 3);

    // Active Weapon
    const weapon = agent.inventory[agent.activeWeaponIndex];
    if (weapon) {
      this.ctx.fillStyle = weapon.color;
      this.ctx.fillRect(pos.x + 6, pos.y - 10, 6, 2);
    }

    // Name Tag
    this.ctx.fillStyle = '#cbd5e1';
    this.ctx.font = '9px "Chakra Petch", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(agent.name, pos.x, pos.y - 22);

    this.ctx.restore();
  }

  private renderEntity(entity: Entity) {
    const pos = this.worldToScreen(entity.x, entity.y);

    this.ctx.save();

    // Persuaded Thrall Glow Collar
    if (entity.isPersuaded) {
      this.ctx.strokeStyle = '#39ff14';
      this.ctx.lineWidth = 1.5;
      this.ctx.shadowColor = '#39ff14';
      this.ctx.shadowBlur = 6;
      this.ctx.beginPath();
      this.ctx.ellipse(pos.x, pos.y, 12 * this.camera.zoom, 7 * this.camera.zoom, 0, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // Body
    this.ctx.fillStyle = entity.isPersuaded ? '#15803d' : entity.color;
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y - 10, 7 * this.camera.zoom, 0, Math.PI * 2);
    this.ctx.fill();

    // Visor/Eyes
    this.ctx.fillStyle = entity.type === 'ENEMY_AGENT' ? '#ef4444' : entity.type === 'POLICE' ? '#3b82f6' : '#fef08a';
    this.ctx.fillRect(pos.x - 2, pos.y - 12, 4, 2);

    this.ctx.restore();
  }

  private renderVehicle(vehicle: Vehicle) {
    const pos = this.worldToScreen(vehicle.x, vehicle.y);

    this.ctx.save();
    this.ctx.fillStyle = vehicle.color;

    // Vehicle Chassis
    const width = 36 * this.camera.zoom;
    const height = 18 * this.camera.zoom;

    this.ctx.fillRect(pos.x - width / 2, pos.y - height / 2 - 6, width, height);
    this.ctx.strokeStyle = '#334155';
    this.ctx.strokeRect(pos.x - width / 2, pos.y - height / 2 - 6, width, height);

    // Headlights Beam
    this.ctx.fillStyle = 'rgba(254, 240, 138, 0.2)';
    this.ctx.beginPath();
    this.ctx.moveTo(pos.x + width / 2, pos.y - 4);
    this.ctx.lineTo(pos.x + width / 2 + 40, pos.y - 18);
    this.ctx.lineTo(pos.x + width / 2 + 40, pos.y + 10);
    this.ctx.closePath();
    this.ctx.fill();

    // Police flashing lights
    if (vehicle.type === 'POLICE_CAR') {
      const flash = Math.floor(Date.now() / 200) % 2 === 0;
      this.ctx.fillStyle = flash ? '#ef4444' : '#3b82f6';
      this.ctx.fillRect(pos.x - 2, pos.y - height / 2 - 8, 4, 3);
    }

    this.ctx.restore();
  }

  private renderPersuaderWave(agent: Agent) {
    const pos = this.worldToScreen(agent.x, agent.y);
    const radius = 120 * this.camera.zoom;
    const pulse = (Date.now() / 300) % 1;

    this.ctx.save();
    this.ctx.strokeStyle = `rgba(57, 255, 20, ${1 - pulse})`;
    this.ctx.lineWidth = 2;
    this.ctx.shadowColor = '#39ff14';
    this.ctx.shadowBlur = 12;

    this.ctx.beginPath();
    this.ctx.ellipse(pos.x, pos.y, radius * pulse, radius * pulse * 0.5, 0, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.restore();
  }

  private renderParticles(particles: ParticleEffect[]) {
    particles.forEach(p => {
      const pos = this.worldToScreen(p.x, p.y);
      const alpha = p.life / p.maxLife;

      this.ctx.save();
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = alpha;

      if (p.type === 'EXPLOSION') {
        this.ctx.shadowColor = p.color;
        this.ctx.shadowBlur = 12;
      }

      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, p.size * this.camera.zoom, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });
  }

  private renderLasers(lasers: LaserBeam[]) {
    lasers.forEach(laser => {
      const start = this.worldToScreen(laser.startX, laser.startY);
      const end = this.worldToScreen(laser.endX, laser.endY);

      this.ctx.save();
      this.ctx.strokeStyle = laser.color;
      this.ctx.lineWidth = 2.5;
      this.ctx.shadowColor = laser.color;
      this.ctx.shadowBlur = 10;
      this.ctx.globalAlpha = laser.life;

      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y - 8);
      this.ctx.lineTo(end.x, end.y - 8);
      this.ctx.stroke();

      this.ctx.restore();
    });
  }

  private renderOrbitalBeam(orbital: { x: number; y: number; radius: number; life: number }) {
    const pos = this.worldToScreen(orbital.x, orbital.y);
    const radius = orbital.radius * this.camera.zoom;

    this.ctx.save();

    // Red Pillar from Sky
    const gradient = this.ctx.createLinearGradient(pos.x, 0, pos.x, pos.y);
    gradient.addColorStop(0, 'rgba(239, 68, 68, 0.1)');
    gradient.addColorStop(1, 'rgba(239, 68, 68, 0.9)');

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.moveTo(pos.x - radius, 0);
    this.ctx.lineTo(pos.x + radius, 0);
    this.ctx.lineTo(pos.x + radius, pos.y);
    this.ctx.lineTo(pos.x - radius, pos.y);
    this.ctx.closePath();
    this.ctx.fill();

    // Ground Impact Blast Circle
    this.ctx.fillStyle = 'rgba(255, 102, 0, 0.6)';
    this.ctx.shadowColor = '#ef4444';
    this.ctx.shadowBlur = 25;
    this.ctx.beginPath();
    this.ctx.ellipse(pos.x, pos.y, radius, radius * 0.5, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  private renderRain() {
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    this.ctx.lineWidth = 1;

    this.rainParticles.forEach(drop => {
      drop.y += drop.speed;
      drop.x -= 2;

      if (drop.y > this.canvas.height) {
        drop.y = -20;
        drop.x = Math.random() * this.canvas.width;
      }

      this.ctx.beginPath();
      this.ctx.moveTo(drop.x, drop.y);
      this.ctx.lineTo(drop.x - 3, drop.y + drop.length);
      this.ctx.stroke();
    });

    this.ctx.restore();
  }
}
