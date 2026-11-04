import { Agent, Entity, Vehicle, Mission, ParticleEffect, LaserBeam, Territory, ResearchProject, AugmentSlot, Weapon } from '../types/syndicate';
import { syndicateAudio } from '../engine/SyndicateAudio';

export interface GameTickResult {
  agents: Agent[];
  entities: Entity[];
  vehicles: Vehicle[];
  particles: ParticleEffect[];
  lasers: LaserBeam[];
  logs: string[];
  thrallCount: number;
  missionCompleted: boolean;
  orbitalBeam: { x: number; y: number; radius: number; life: number } | null;
}

export function updateTacticalGameTick(
  agents: Agent[],
  entities: Entity[],
  vehicles: Vehicle[],
  particles: ParticleEffect[],
  lasers: LaserBeam[],
  activeMission: Mission | null,
  orbitalBeam: { x: number; y: number; radius: number; life: number } | null
): GameTickResult {
  const logs: string[] = [];
  let thrallCount = 0;
  let missionCompleted = false;

  // 1. Update Particles & Lasers Countdown
  const updatedParticles = particles
    .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 1 }))
    .filter(p => p.life > 0);

  const updatedLasers = lasers
    .map(l => ({ ...l, life: l.life - 0.15 }))
    .filter(l => l.life > 0);

  let updatedOrbitalBeam = orbitalBeam;
  if (updatedOrbitalBeam) {
    updatedOrbitalBeam = { ...updatedOrbitalBeam, life: updatedOrbitalBeam.life - 0.05 };
    if (updatedOrbitalBeam.life <= 0) {
      updatedOrbitalBeam = null;
    }
  }

  // 2. Update Agents
  const updatedAgents = agents.map(agent => {
    if (agent.status === 'DEAD') return agent;

    let { x, y, targetX, targetY, hp, maxHp, shield, maxShield, ipa } = agent;

    // Movement calculation
    if (targetX !== null && targetY !== null) {
      const dx = targetX - x;
      const dy = targetY - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Speed bonus from leg augments and adrenaline
      const baseSpeed = 3.5;
      const speedMult = 1 + agent.augments.legs * 0.25 + (ipa.adrenaline / 100) * 0.4;
      const speed = baseSpeed * speedMult;

      if (dist < speed) {
        x = targetX;
        y = targetY;
        targetX = null;
        targetY = null;
      } else {
        x += (dx / dist) * speed;
        y += (dy / dist) * speed;
      }
    }

    // Shield Regen
    if (shield < maxShield && Math.random() < 0.05) {
      shield = Math.min(maxShield, shield + 2);
    }

    return { ...agent, x, y, targetX, targetY, shield };
  });

  // 3. Count Persuaded Thralls & Brainwash Nearby Entities
  let totalThralls = 0;

  const updatedEntities = entities.map(entity => {
    let { x, y, hp, maxHp, isPersuaded, state, targetX, targetY } = entity;

    // Check if in range of an agent holding Persuadertron
    if (!isPersuaded && hp > 0) {
      updatedAgents.forEach(agent => {
        if (agent.status === 'ALIVE') {
          const activeWp = agent.inventory[agent.activeWeaponIndex];
          if (activeWp && activeWp.id === 'persuader' && agent.isFiring) {
            const dx = entity.x - agent.x;
            const dy = entity.y - agent.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const persuadeRange = 140 * (1 + agent.augments.brain * 0.25);

            if (dist < persuadeRange) {
              isPersuaded = true;
              state = 'FOLLOW';
              logs.push(`PERSUADERTRON: ${entity.type} ${entity.name} BRAINWASHED!`);
              syndicateAudio.playSound('PERSUADE_SUCCESS');
            }
          }
        }
      });
    }

    if (isPersuaded) {
      totalThralls++;
      // Follow closest agent in ring formation
      const leader = updatedAgents.find(a => a.status === 'ALIVE');
      if (leader) {
        const angle = (Date.now() / 1000 + entity.id.charCodeAt(0)) % (Math.PI * 2);
        const radius = 45;
        const targetRingX = leader.x + Math.cos(angle) * radius;
        const targetRingY = leader.y + Math.sin(angle) * radius;

        const dx = targetRingX - x;
        const dy = targetRingY - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
          x += (dx / dist) * 2.8;
          y += (dy / dist) * 2.8;
        }
      }
    } else if (state === 'WANDER') {
      // Random civilian wandering
      if (Math.random() < 0.02) {
        targetX = x + (Math.random() * 80 - 40);
        targetY = y + (Math.random() * 80 - 40);
      }
      if (targetX !== null && targetY !== null) {
        const dx = targetX - x;
        const dy = targetY - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 2) {
          x += (dx / dist) * 1.2;
          y += (dy / dist) * 1.2;
        }
      }
    } else if (state === 'ATTACK' && entity.type === 'ENEMY_AGENT') {
      // Attack closest player agent
      const targetAgent = updatedAgents.find(a => a.status === 'ALIVE');
      if (targetAgent) {
        const dx = targetAgent.x - x;
        const dy = targetAgent.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 180) {
          x += (dx / dist) * 2.5;
          y += (dy / dist) * 2.5;
        } else if (Math.random() < 0.08) {
          // Fire weapon at agent
          lasers.push({
            id: Math.random().toString(),
            startX: x,
            startY: y,
            endX: targetAgent.x,
            endY: targetAgent.y,
            color: '#ef4444',
            life: 1.0
          });

          // Damage agent
          targetAgent.hp = Math.max(0, targetAgent.hp - 8);
          if (targetAgent.hp === 0) {
            targetAgent.status = 'DOWN';
            logs.push(`ALERT: ${targetAgent.name} HAS BEEN DOWNED!`);
            syndicateAudio.speak(`${targetAgent.name} DOWN`);
          }
          syndicateAudio.playSound('SMG');
        }
      }
    }

    return { ...entity, x, y, hp, isPersuaded, state, targetX, targetY };
  });

  // 4. Orbital Laser Damage
  if (updatedOrbitalBeam) {
    const ob = updatedOrbitalBeam;
    updatedEntities.forEach(ent => {
      const dx = ent.x - ob.x;
      const dy = ent.y - ob.y;
      if (Math.sqrt(dx * dx + dy * dy) < ob.radius) {
        ent.hp = 0;
        // Spawn explosion particles
        for (let i = 0; i < 5; i++) {
          particles.push({
            id: Math.random().toString(),
            x: ent.x,
            y: ent.y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            color: '#ef4444',
            size: 6,
            life: 20,
            maxLife: 20,
            type: 'EXPLOSION'
          });
        }
      }
    });
  }

  // 5. Check Objectives Completion
  if (activeMission && !activeMission.completed) {
    let allCompleted = true;

    activeMission.objectives.forEach(obj => {
      if (obj.type === 'PERSUADE' && obj.requiredCount) {
        obj.currentCount = totalThralls;
        if (totalThralls >= obj.requiredCount) {
          obj.completed = true;
        } else {
          allCompleted = false;
        }
      } else if (obj.type === 'ASSASSINATE') {
        const target = updatedEntities.find(e => e.name === obj.targetName);
        if (!target || target.hp <= 0) {
          obj.completed = true;
        } else {
          allCompleted = false;
        }
      } else if (obj.type === 'CLEAN_SWEEP') {
        const hostiles = updatedEntities.filter(e => e.type === 'ENEMY_AGENT' && e.hp > 0);
        if (hostiles.length === 0) {
          obj.completed = true;
        } else {
          allCompleted = false;
        }
      }
    });

    if (allCompleted) {
      missionCompleted = true;
      activeMission.completed = true;
      logs.push(`MISSION SUCCESS: ${activeMission.title} COMPLETED!`);
      syndicateAudio.speak('MISSION COMPLETED EXECUTIVE');
    }
  }

  return {
    agents: updatedAgents,
    entities: updatedEntities,
    vehicles,
    particles: updatedParticles,
    lasers: updatedLasers,
    logs,
    thrallCount: totalThralls,
    missionCompleted,
    orbitalBeam: updatedOrbitalBeam
  };
}
