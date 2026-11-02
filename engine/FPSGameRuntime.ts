import type { ClassType, DungeonRoom, EquipmentSlot, ItemInstance, PlayerCharacter, StatusApplication, WorldEnemy, WorldLootDrop, WorldProjectile } from '../types';
import type { InputFrame } from './InputSystem';
import { createDungeonWorld, createFloorEnemies, createRoomOffer, findLookTarget, markExplored, randomSeed, type RoomOffer } from '../world/DungeonWorld';
import { raycastGrid, hasLineOfSight, moveWithWallSlide } from '../world/CollisionWorld';
import { updateEnemyBrains } from '../enemies/EnemyBrain';
import { isVisibleProjectileImpact, updateProjectiles, type ProjectileImpact } from '../combat/ProjectileSystem';
import { calculateIncomingDamage, calculatePlayerDamage, projectileDirection, resolveAreaAttack, resolveMeleeAttack } from '../combat/DamageSystem';
import { CLASS_ABILITY_LOADOUT, getAbility, getSkillAbilityId } from '../combat/AbilityRegistry';
import { getEnemyAttackDefinition } from '../data/enemyAttacks';
import { getEnemyAttackTelegraphDescriptor, getGuardianTelegraphEffect } from '../data/enemyAttackTelegraph';
import { getFloorGuardianDefinition } from '../data/mazeContent';
import { createPlayerControllerState, updatePlayerController, type PlayerControllerState } from '../player/PlayerController';
import { PlayerCombat, type ActivePlayerAction } from '../player/PlayerCombat';
import { consumePotion, createItemInstance, createPlayerCharacter, equipItem, grantExperience, makeEnemyDrop, unequipItem } from '../player/PlayerProgression';
import { floorRandom } from '../services/floorRandom';
import { spawnFacingAngle } from '../services/firstPerson';
import { saveMazeGame, type MazeRunSave } from '../services/mazeSave';
import type { KeyValueStorage } from '../services/fpsSave';
import type { DungeonWorldState } from '../world/DungeonWorld';
import type { VisualEvent } from './SceneRenderer';
import { applyRealtimeStatus, hasRealtimeStatus, tickRealtimeStatuses } from '../combat/StatusSystem';
import { getEnemyVfxSurface, resolveSurfaceEffect, type PixelEffectId } from '../presentation/vfxDefinitions';

export interface FPSGameSnapshot {
  player: PlayerCharacter;
  world: DungeonWorldState;
  enemies: WorldEnemy[];
  loot: WorldLootDrop[];
  action: ActivePlayerAction | null;
  primaryAbilityId: string;
  secondaryAbilityId: string;
  skillAbilityId: string;
  skillAbilityIds: Array<string | null>;
  primaryCooldown: number;
  secondaryCooldown: number;
  skillCooldown: number;
  skillCooldowns: number[];
  chargeProgress: number;
  isMoving: boolean;
  guarding: boolean;
  paused: boolean;
  inventoryOpen: boolean;
  mapOpen: boolean;
  gameOver: boolean;
  roomOffer: RoomOffer | null;
  prompt: string | null;
  targetEnemy: WorldEnemy | null;
  toast: string;
  log: string[];
}

export interface FPSRenderState {
  world: DungeonWorldState;
  player: PlayerCharacter;
  enemies: WorldEnemy[];
  projectiles: WorldProjectile[];
  loot: WorldLootDrop[];
  action: ActivePlayerAction | null;
  isMoving: boolean;
  guarding: boolean;
  paused: boolean;
  cameraBob: number;
  events: VisualEvent[];
}

export class FPSGameRuntime {
  player: PlayerCharacter;
  world: DungeonWorldState;
  enemies: WorldEnemy[];
  projectiles: WorldProjectile[] = [];
  loot: WorldLootDrop[] = [];
  roomOffer: RoomOffer | null = null;
  paused = false;
  inventoryOpen = false;
  mapOpen = false;
  gameOver = false;
  private controllerState: PlayerControllerState = createPlayerControllerState();
  private readonly combat = new PlayerCombat();
  private readonly random: () => number;
  private elapsedSeconds = 0;
  private nextProjectileId = 1;
  private chargeStartedAt: number | null = null;
  private isMoving = false;
  private cameraBob = 0;
  private toast = '';
  private toastSeconds = 0;
  private logs: string[] = [];
  private visualEvents: VisualEvent[] = [];
  private lastSaveSucceeded: boolean | null = null;

  constructor(classId: ClassType, save?: Pick<MazeRunSave, 'player' | 'world' | 'enemies' | 'loot' | 'combat'>) {
    if (save) {
      this.player = clonePlayer(save.player);
      this.world = cloneWorld(save.world);
      this.enemies = save.enemies.map(enemy => ({ ...enemy, position: { ...enemy.position } }));
      this.loot = save.loot.map(drop => ({ ...drop, position: { ...drop.position }, item: { ...drop.item, affixes: [...drop.item.affixes] } }));
      this.combat.restore(save.combat);
    } else {
      this.world = createDungeonWorld(1, randomSeed());
      const yaw = spawnFacingAngle(this.world.map, { x: 1, y: 1 });
      this.player = createPlayerCharacter(classId, { x: 1.5, y: 0, z: 1.5 });
      this.player.rotation.yaw = yaw;
      this.enemies = createFloorEnemies(this.world);
      this.addLog('Enter the Labyrinth beneath Knossos. A guardian seals every descent.');
    }
    this.random = floorRandom(this.world.seed ^ 0xA37E2);
    this.world = markExplored(this.world, this.player.position.x, this.player.position.z);
    this.updateGuardianDiscovery();
    this.gameOver = this.player.stats.hp <= 0;
  }

  update(deltaSeconds: number, input: InputFrame): void {
    const dt = Math.max(0, Math.min(0.05, deltaSeconds));
    this.elapsedSeconds += dt;
    if (this.toastSeconds > 0) {
      this.toastSeconds = Math.max(0, this.toastSeconds - dt);
      if (this.toastSeconds === 0) this.toast = '';
    }
    if (input.pausePressed) { this.paused = !this.paused; this.inventoryOpen = false; this.mapOpen = false; }
    if (input.inventoryPressed && !this.gameOver) { this.inventoryOpen = !this.inventoryOpen; this.mapOpen = false; }
    if (input.mapPressed && !this.gameOver) { this.mapOpen = !this.mapOpen; this.inventoryOpen = false; }
    if (this.paused || this.inventoryOpen || this.mapOpen || this.roomOffer || this.gameOver) return;

    const movement = updatePlayerController(this.player, this.controllerState, input, this.world.map, dt, this.enemies);
    this.player = movement.player;
    this.controllerState = movement.state;
    this.isMoving = movement.isMoving;
    this.cameraBob = movement.cameraBob;
    if (movement.dodgeStarted) {
      this.addLog('Dodge.');
      this.visualEvents.push({ kind: 'dodge', position: { x: this.player.position.x, y: 0.15, z: this.player.position.z }, color: '#97ddff', scale: 0.7, sound: 'dodge' });
    }
    this.world = markExplored(this.world, this.player.position.x, this.player.position.z);
    this.updateGuardianDiscovery();

    this.processInput(input);
    const actionUpdate = this.combat.update(dt);
    if (actionUpdate.activeStarted && actionUpdate.action) this.resolvePlayerAction(actionUpdate.action);

    const enemyUpdate = updateEnemyBrains(this.enemies, this.world.map, this.player, dt);
    this.enemies = enemyUpdate.enemies;
    for (const enemyId of enemyUpdate.telegraphs) {
      const enemy = this.enemies.find(candidate => candidate.id === enemyId);
      if (!enemy?.isBoss) continue;
      const attack = getEnemyAttackDefinition(enemy.attackSetId, enemy.activeAttackId, enemy.phase ?? 1);
      if (!attack) continue;
      const descriptor = getEnemyAttackTelegraphDescriptor(attack);
      const center = descriptor.center === 'target' ? enemy.telegraphPosition ?? enemy.position : enemy.position;
      const effectId = getGuardianTelegraphEffect(enemy.attackSetId, attack);
      const markerScale = effectId === 'warden_delayed_sigil' ? descriptor.radius : effectId === 'guardian_sigil' ? 0.48 : 0.4;
      const facingYaw = enemy.facingYaw ?? 0;
      this.visualEvents.push({
        kind: 'telegraph', effectId,
        position: { x: center.x, y: 0.045, z: center.z },
        direction: { x: Math.cos(facingYaw), z: Math.sin(facingYaw) },
        color: attack.telegraphColor, scale: markerScale,
        priority: 'guardian_telegraph', sourceId: attack.id, ownerId: enemy.id, sound: 'bossTelegraph',
      });
    }
    for (const enemyId of enemyUpdate.attacks) this.resolveEnemyAttack(enemyId);

    const projectileUpdate = updateProjectiles(this.projectiles, this.enemies, this.world.map, dt, this.player.position);
    this.projectiles = projectileUpdate.projectiles;
    this.enemies = projectileUpdate.enemies;
    this.processProjectileImpacts(projectileUpdate.impacts);
    this.processEnemyRewards();

    this.tickCombatStatuses(dt);
    this.processEnemyRewards();

    if (this.player.stats.mp < this.player.stats.maxMp) {
      this.player = { ...this.player, stats: { ...this.player.stats, mp: Math.min(this.player.stats.maxMp, this.player.stats.mp + dt * 0.7) } };
    }

    if (this.player.stats.hp <= 0) {
      this.player = { ...this.player, stats: { ...this.player.stats, hp: 0 } };
      this.gameOver = true;
      this.paused = true;
      this.addToast('You have fallen. Your run can still be saved for review.');
    }
  }

  private processInput(input: InputFrame): void {
    const loadout = CLASS_ABILITY_LOADOUT[this.player.classId];
    if (input.primaryPressed) this.startAbility(loadout.primary);
    if (input.secondaryPressed) {
      const ability = getAbility(loadout.secondary);
      if (ability?.chargeMinSeconds) this.chargeStartedAt = this.elapsedSeconds;
      else this.startAbility(loadout.secondary);
    }
    if (input.secondaryReleased && this.chargeStartedAt !== null) {
      const chargedFor = Math.max(0, this.elapsedSeconds - this.chargeStartedAt);
      this.chargeStartedAt = null;
      this.startAbility(loadout.secondary, chargedFor);
    }
    if (input.skillPressed) {
      const abilityId = input.skillSlot === null ? null : getSkillAbilityId(this.player.classId, input.skillSlot);
      if (abilityId) this.startAbility(abilityId);
      else if (input.skillSlot !== null) this.addToast('No skill learned in slot ' + input.skillSlot + ' yet.');
    }
    if (input.interactPressed) this.interact();
  }

  private startAbility(abilityId: string, chargeSeconds = 0): void {
    const ability = getAbility(abilityId);
    if (ability?.kind === 'PROJECTILE' && this.projectiles.length >= 64) {
      this.addToast('The projectile field is full.');
      return;
    }
    const result = this.combat.start(this.player, abilityId, chargeSeconds);
    if (result.error) { if (result.error !== 'Recovering from the current action.') this.addToast(result.error); return; }
    this.player = result.player;
    if (result.ability) {
      this.addLog(result.ability.name + '.');
      this.visualEvents.push({ kind: 'audio', position: { ...this.player.position }, sound: getAbilityStartSound(result.ability) });
    }
  }

  private resolvePlayerAction(action: ActivePlayerAction): void {
    const ability = getAbility(action.abilityId);
    if (!ability) return;
    const damage = calculatePlayerDamage(this.player, ability, action.damageMultiplier);
    if (ability.selfEffect?.type === 'HEAL') {
      const restored = Math.ceil(this.player.stats.maxHp * (ability.selfEffect.amount ?? 0));
      this.player = { ...this.player, stats: { ...this.player.stats, hp: Math.min(this.player.stats.maxHp, this.player.stats.hp + restored) } };
      this.visualEvents.push({ kind: 'area', effectId: 'laurel_light', position: { x: this.player.position.x, y: 0.8, z: this.player.position.z }, color: '#8cf2b4', scale: 1.15, sound: 'heal' });
      this.addToast(ability.name + ' restored ' + restored + ' health.');
      return;
    }
    if (ability.selfEffect?.type === 'GUARD') {
      const effect: StatusApplication = { statusId: 'GUARD', durationSeconds: ability.selfEffect.durationSeconds ?? 2, magnitude: ability.selfEffect.magnitude ?? 0.3 };
      this.player = { ...this.player, statusEffects: applyRealtimeStatus(this.player.statusEffects, effect, ability.id) };
      this.visualEvents.push({ kind: 'area', effectId: 'laurel_light', position: { x: this.player.position.x, y: 0.15, z: this.player.position.z }, color: '#e9cb7a', scale: 1.5, sound: 'shield' });
    }
    if (ability.kind === 'MELEE') {
      const result = resolveMeleeAttack(this.world.map, this.player, this.enemies, ability, damage);
      this.enemies = result.enemies;
      this.applyPlayerOnHitEffects(result.hitEnemyIds, ability);
      const effectId = ability.meleeStyle === 'THRUST' ? 'spear_thrust' : ability.meleeStyle === 'BASH' ? 'aspis_impact' : 'bronze_slash';
      const reach = Math.min(1, ability.range * 0.45);
      this.visualEvents.push({ kind: 'melee', effectId, position: { x: this.player.position.x + Math.cos(this.player.rotation.yaw) * reach, y: 0.9, z: this.player.position.z + Math.sin(this.player.rotation.yaw) * reach }, direction: { x: Math.cos(this.player.rotation.yaw), z: Math.sin(this.player.rotation.yaw) }, color: ability.projectileColor ?? '#ffd17b', scale: ability.meleeStyle === 'THRUST' ? 0.85 : 1.2, sourceId: ability.id });
      for (const id of result.hitEnemyIds) {
        const hit = this.enemies.find(enemy => enemy.id === id);
        if (!hit) continue;
        const surface = getEnemyVfxSurface(hit.visualId);
        const statusEffect = statusVfxEffect(ability.onHitStatus?.statusId);
        const effect = ability.meleeStyle === 'THRUST' && surface === 'metal' ? 'dory_thrust'
          : statusEffect ?? (surface === 'organic' ? 'blood_hit' : resolveSurfaceEffect(surface));
        const sound = statusEffect === 'arachne_venom' ? 'poison' : surface === 'metal' ? 'bronzeImpact' : surface === 'stone' ? 'stoneImpact' : 'enemyHit';
        this.visualEvents.push({ kind: 'enemyHit', effectId: effect, position: { x: hit.position.x, y: 0.65, z: hit.position.z }, scale: 0.7, sound, surface, sourceId: ability.id, ownerId: hit.id, priority: hit.isBoss ? 'critical_hit' : 'ordinary_hit' });
      }
      if (result.hitEnemyIds.length) this.addToast(ability.name + ' hit ' + result.hitEnemyIds.length + (result.hitEnemyIds.length === 1 ? ' foe.' : ' foes.'));
      if (this.player.classId === 'BARBARIAN' && hasRealtimeStatus(this.player.statusEffects, 'COUNTER')) {
        this.player = { ...this.player, statusEffects: this.player.statusEffects.filter(status => status.statusId !== 'COUNTER') };
        this.addLog('Myrmidon counter strike.');
      }
      return;
    }
    if (ability.kind === 'PROJECTILE') {
      if (this.projectiles.length >= 64) {
        this.addToast('The projectile field is full.');
        return;
      }
      const direction = projectileDirection(this.player.rotation.yaw, this.player.rotation.pitch);
      const lateral = this.player.equipment.weapon?.visualType === 'bow' ? 0 : 0.2;
      const originX = this.player.position.x + direction.x * 0.42 - Math.sin(this.player.rotation.yaw) * lateral;
      const originZ = this.player.position.z + direction.z * 0.42 + Math.cos(this.player.rotation.yaw) * lateral;
      this.projectiles.push({
        id: this.nextProjectileId++,
        position: { x: originX, y: 1.28 + direction.y * 0.12, z: originZ },
        velocity: { x: direction.x * (ability.projectileSpeed ?? 10), y: direction.y * (ability.projectileSpeed ?? 10), z: direction.z * (ability.projectileSpeed ?? 10) },
        radius: ability.projectileRadius ?? 0.13,
        damage,
        remainingSeconds: ability.range / Math.max(1, ability.projectileSpeed ?? 10),
        sourceAbilityId: ability.id,
        color: ability.projectileColor ?? '#8bddff',
        faction: 'PLAYER',
        statusEffect: ability.onHitStatus,
      });
      this.visualEvents.push({ kind: 'cast', effectId: abilityVfxEffect(ability.id, ability.onHitStatus?.statusId) ?? (ability.manaCost > 0 ? 'chthonic_bolt' : 'oracle_spark'), position: { x: originX, y: 1.25, z: originZ }, direction: { x: direction.x, z: direction.z }, color: ability.projectileColor, scale: 0.55, sourceId: ability.id });
      return;
    }
    const selfCentered = ability.targeting === 'SELF';
    let centerX = this.player.position.x, centerZ = this.player.position.z;
    if (!selfCentered) {
      const dx = Math.cos(this.player.rotation.yaw), dz = Math.sin(this.player.rotation.yaw);
      const wall = raycastGrid(this.world.map, centerX, centerZ, dx, dz, ability.range);
      const distance = wall ? Math.max(0.35, wall.distance - 0.22) : ability.range;
      centerX += dx * distance;
      centerZ += dz * distance;
    }
    const radius = ability.radius ?? 1.6;
    const result = resolveAreaAttack(this.world.map, centerX, centerZ, radius, this.enemies, damage);
    this.enemies = result.enemies;
    this.applyPlayerOnHitEffects(result.hitEnemyIds, ability);
    const effectId = statusVfxEffect(ability.onHitStatus?.statusId) ?? (ability.targeting === 'SELF' ? 'stone_shockwave' : 'bronze_impact');
    this.visualEvents.push({ kind: 'area', effectId, position: { x: centerX, y: 0.12, z: centerZ }, color: ability.projectileColor ?? '#ffb65b', scale: radius, sound: ability.onHitStatus?.statusId === 'BURN' ? 'cast' : undefined, sourceId: ability.id });
    this.addToast(ability.name + (result.hitEnemyIds.length ? ' hit ' + result.hitEnemyIds.length + '.' : '.'));
  }

  private applyPlayerOnHitEffects(enemyIds: readonly string[], ability: NonNullable<ReturnType<typeof getAbility>>): void {
    const status = ability.onHitStatus ?? (ability.staggerSeconds ? { statusId: 'STAGGER' as const, durationSeconds: ability.staggerSeconds, magnitude: ability.staggerSeconds } : undefined);
    if (!status || !enemyIds.length) return;
    const hitIds = new Set(enemyIds);
    this.enemies = this.enemies.map(enemy => {
      if (!hitIds.has(enemy.id) || enemy.health <= 0) return enemy;
      const tuned = enemy.isBoss && status.statusId === 'STAGGER'
        ? { ...status, durationSeconds: status.durationSeconds * 0.62, magnitude: status.magnitude * 0.62 }
        : status;
      return { ...enemy, statusEffects: applyRealtimeStatus(enemy.statusEffects, tuned, ability.id) };
    });
  }

  private processProjectileImpacts(impacts: ProjectileImpact[]): void {
    for (const impact of impacts) {
      if (!isVisibleProjectileImpact(impact)) continue;
      const owner = impact.playerHit ? this.enemies.find(enemy => enemy.id === impact.ownerEnemyId) : undefined;
      const dodged = Boolean(impact.playerHit && this.controllerState.invulnerabilitySeconds > 0);
      const blocked = Boolean(impact.playerHit && owner && this.controllerState.guarding && this.isFacingAttacker(owner));
      if (impact.playerHit) {
        if (dodged) { this.addToast('Attack dodged.'); this.primeMyrmidonCounter(); continue; }
        if (blocked) {
          this.visualEvents.push({ kind: 'impact', effectId: 'shield_impact', position: { x: this.player.position.x, y: 0.82, z: this.player.position.z }, color: '#e2c074', scale: 0.9, sound: 'shield', surface: 'metal', sourceId: impact.abilityId, ownerId: owner?.id, priority: 'critical_hit' });
        } else {
          const effect = abilityVfxEffect(impact.abilityId, impact.statusEffect?.statusId) ?? 'blood_hit';
          const sound = impact.statusEffect?.statusId === 'POISON' ? 'poison' : 'playerHit';
          this.visualEvents.push({ kind: 'enemyHit', effectId: effect, position: impact.position, color: impact.color, scale: 0.85, sound, surface: 'organic', sourceId: impact.abilityId, ownerId: this.player.id, priority: 'critical_hit' });
        }
        if (!owner) continue;
        const damage = calculateIncomingDamage(owner, this.player, blocked);
        this.player = { ...this.player, stats: { ...this.player.stats, hp: Math.max(0, this.player.stats.hp - damage) } };
        if (impact.statusEffect && !blocked) this.player = { ...this.player, statusEffects: applyRealtimeStatus(this.player.statusEffects, impact.statusEffect, impact.abilityId) };
        if (impact.healOwnerRatio) this.enemies = this.enemies.map(enemy => enemy.id === owner.id ? { ...enemy, health: Math.min(enemy.maxHealth, enemy.health + Math.ceil(damage * impact.healOwnerRatio!)) } : enemy);
        this.addToast(blocked ? 'Aspis blocked ' + owner.name + ' for ' + damage + '.' : owner.name + ' struck you for ' + damage + '.');
      }
      if (impact.enemyId) {
        const hit = this.enemies.find(enemy => enemy.id === impact.enemyId);
        const surface = impact.surface ?? getEnemyVfxSurface(hit?.visualId ?? '');
        const effect = abilityVfxEffect(impact.abilityId, impact.statusEffect?.statusId) ?? (surface === 'organic' ? 'blood_hit' : resolveSurfaceEffect(surface));
        const sound = impact.statusEffect?.statusId === 'POISON' ? 'poison' : surface === 'metal' ? 'bronzeImpact' : surface === 'stone' ? 'stoneImpact' : 'enemyHit';
        this.visualEvents.push({ kind: 'enemyHit', effectId: effect, position: impact.position, color: impact.color, scale: 0.8, sound, surface, sourceId: impact.abilityId, ownerId: impact.enemyId, priority: hit?.isBoss ? 'critical_hit' : 'ordinary_hit' });
        const ability = getAbility(impact.abilityId);
        if (ability?.healOnHit) this.player = { ...this.player, stats: { ...this.player.stats, hp: Math.min(this.player.stats.maxHp, this.player.stats.hp + ability.healOnHit) } };
        this.addToast(ability?.healOnHit ? 'Hades’ Grasp restores ' + ability.healOnHit + ' health.' : 'Hit.');
        continue;
      }
      if (impact.kind === 'world') {
        const surface = impact.surface ?? 'stone';
        const effect = resolveSurfaceEffect(surface);
        const sound = surface === 'metal' ? 'bronzeImpact' : surface === 'stone' ? 'stoneImpact' : undefined;
        this.visualEvents.push({ kind: 'impact', effectId: effect, position: impact.position, color: impact.color, scale: 0.72, sound, surface, sourceId: impact.abilityId, ownerId: impact.ownerEnemyId });
      }
    }
  }

  private resolveEnemyAttack(enemyId: string): void {
    let enemy = this.enemies.find(candidate => candidate.id === enemyId && candidate.health > 0);
    if (!enemy) return;
    const attack = getEnemyAttackDefinition(enemy.attackSetId, enemy.activeAttackId, enemy.phase ?? 1);
    if (!attack) return;
    if (attack.motion === 'RETREAT') {
      const away = Math.atan2(enemy.position.z - this.player.position.z, enemy.position.x - this.player.position.x);
      const moved = moveWithWallSlide(this.world.map, enemy.position.x, enemy.position.z, Math.cos(away) * (attack.motionSpeed ?? 2.8) * 0.42, Math.sin(away) * (attack.motionSpeed ?? 2.8) * 0.42, enemy.collisionRadius ?? 0.3);
      this.enemies = this.enemies.map(candidate => candidate.id === enemy!.id ? { ...candidate, position: { ...candidate.position, x: moved.x, z: moved.y } } : candidate);
      enemy = this.enemies.find(candidate => candidate.id === enemyId)!;
    } else if (attack.motion === 'CHARGE' || attack.motion === 'LEAP' || attack.motion === 'REPOSITION') {
      const dx = this.player.position.x - enemy.position.x, dz = this.player.position.z - enemy.position.z;
      const distanceBefore = Math.max(0.001, Math.hypot(dx, dz));
      const yaw = enemy.facingYaw ?? Math.atan2(dz, dx);
      const moveDistance = attack.motion === 'REPOSITION'
        ? Math.min(0.7, (attack.motionSpeed ?? 3) * 0.22)
        : Math.min(Math.max(0, distanceBefore - 0.62), (attack.motionSpeed ?? 4.8) * (attack.motion === 'LEAP' ? 0.28 : 0.48));
      const moveYaw = attack.motion === 'REPOSITION' ? yaw + (enemy.id.charCodeAt(enemy.id.length - 1) % 2 ? Math.PI / 2 : -Math.PI / 2) : yaw;
      const moved = moveWithWallSlide(this.world.map, enemy.position.x, enemy.position.z, Math.cos(moveYaw) * moveDistance, Math.sin(moveYaw) * moveDistance, enemy.collisionRadius ?? 0.3);
      this.enemies = this.enemies.map(candidate => candidate.id === enemy!.id ? { ...candidate, position: { ...candidate.position, x: moved.x, z: moved.y } } : candidate);
      enemy = this.enemies.find(candidate => candidate.id === enemyId)!;
    }

    if (attack.shape === 'BUFF') {
      if (attack.statusEffect) this.enemies = this.enemies.map(candidate => candidate.id === enemy!.id
        ? { ...candidate, statusEffects: applyRealtimeStatus(candidate.statusEffects, attack.statusEffect!, attack.id) }
        : candidate);
      this.visualEvents.push({ kind: 'cast', effectId: enemy.isBoss ? 'guardian_sigil' : 'laurel_light', position: { x: enemy.position.x, y: 0.08, z: enemy.position.z }, color: attack.telegraphColor, scale: 0.85, sound: 'cast', sourceId: attack.id, ownerId: enemy.id, priority: enemy.isBoss ? 'critical_hit' : 'ordinary_hit' });
      return;
    }

    if (attack.shape === 'PROJECTILE' || attack.shape === 'DRAIN') {
      const distance = Math.hypot(enemy.position.x - this.player.position.x, enemy.position.z - this.player.position.z);
      const hasSight = hasLineOfSight(this.world.map, enemy.position.x, enemy.position.z, this.player.position.x, this.player.position.z, 0.15);
      if (!hasSight || distance > attack.range || this.projectiles.length >= 64) return;
      const dx = this.player.position.x - enemy.position.x, dz = this.player.position.z - enemy.position.z;
      const horizontal = Math.max(0.001, Math.hypot(dx, dz));
      const speed = attack.projectileSpeed ?? 6;
      this.projectiles.push({
        id: this.nextProjectileId++,
        position: { x: enemy.position.x, y: 1.1, z: enemy.position.z },
        velocity: { x: dx / horizontal * speed, y: (1.12 - 1.1) / horizontal * speed, z: dz / horizontal * speed },
        radius: 0.16, damage: Math.max(1, Math.round(enemy.damage * attack.damageMultiplier)),
        remainingSeconds: attack.range / speed, sourceAbilityId: attack.id,
        color: attack.projectileColor ?? attack.telegraphColor, faction: 'ENEMY', ownerEnemyId: enemy.id,
        statusEffect: attack.statusEffect, healOwnerRatio: attack.healOwnerRatio,
      });
      const castEffect = /boulder/i.test(attack.id) ? 'stone_chips' : /javelin/i.test(attack.id) ? 'spear_thrust' : abilityVfxEffect(attack.id, attack.statusEffect?.statusId) ?? 'chthonic_bolt';
      this.visualEvents.push({ kind: 'cast', effectId: castEffect, position: { x: enemy.position.x, y: 1.05, z: enemy.position.z }, color: attack.projectileColor ?? attack.telegraphColor, scale: 0.42, direction: { x: dx / horizontal, z: dz / horizontal }, sourceId: attack.id, ownerId: enemy.id });
      return;
    }

    const target = attack.shape === 'SIGIL' && enemy.telegraphPosition ? enemy.telegraphPosition : this.player.position;
    const telegraph = getEnemyAttackTelegraphDescriptor(attack);
    const dx = target.x - enemy.position.x, dz = target.z - enemy.position.z;
    const distance = Math.hypot(dx, dz);
    const hasSight = hasLineOfSight(this.world.map, attack.shape === 'SIGIL' ? target.x : enemy.position.x, attack.shape === 'SIGIL' ? target.z : enemy.position.z, this.player.position.x, this.player.position.z, 0.15);
    const yaw = enemy.facingYaw ?? Math.atan2(dz, dx);
    const toPlayer = Math.atan2(this.player.position.z - enemy.position.z, this.player.position.x - enemy.position.x);
    const deltaAngle = Math.atan2(Math.sin(toPlayer - yaw), Math.cos(toPlayer - yaw));
    const inRange = distance <= telegraph.radius;
    const inShape = attack.shape === 'MELEE' || attack.shape === 'CHARGE' || attack.shape === 'CONE'
      ? inRange && (attack.shape !== 'CONE' && attack.shape !== 'CHARGE' || Math.abs(deltaAngle) <= telegraph.arcRadians / 2)
      : attack.shape === 'SLAM' || attack.shape === 'RITUAL' ? Math.hypot(this.player.position.x - enemy.position.x, this.player.position.z - enemy.position.z) <= telegraph.radius
      : attack.shape === 'SIGIL' ? Math.hypot(this.player.position.x - target.x, this.player.position.z - target.z) <= telegraph.radius
      : attack.shape === 'CURSE' ? distance <= telegraph.radius
      : false;
    if (!hasSight || !inShape) return;
    if (this.controllerState.invulnerabilitySeconds > 0) {
      this.visualEvents.push({ kind: 'dodge', position: { x: this.player.position.x, y: 0.35, z: this.player.position.z }, color: '#a2e8ff', scale: 1, sound: 'dodge' });
      this.addToast('Attack dodged.');
      this.primeMyrmidonCounter();
      return;
    }
    const blocked = this.controllerState.guarding && this.isFacingAttacker(enemy);
    const damage = attack.damageMultiplier > 0 ? Math.max(1, Math.round(calculateIncomingDamage(enemy, this.player, blocked) * attack.damageMultiplier)) : 0;
    if (damage > 0) this.player = { ...this.player, stats: { ...this.player.stats, hp: Math.max(0, this.player.stats.hp - damage) } };
    if (attack.statusEffect && !blocked) this.player = { ...this.player, statusEffects: applyRealtimeStatus(this.player.statusEffects, attack.statusEffect, attack.id) };
    const statusEffect = statusVfxEffect(attack.statusEffect?.statusId);
    const effectId = blocked ? 'shield_impact' : statusEffect ?? (attack.shape === 'SLAM' || attack.shape === 'SIGIL' ? 'stone_shockwave' : 'blood_hit');
    const impactCenter = blocked ? this.player.position
      : attack.shape === 'SLAM' || attack.shape === 'RITUAL' ? enemy.position
      : attack.shape === 'SIGIL' ? target
      : this.player.position;
    this.visualEvents.push({
      kind: blocked ? 'impact' : 'enemyHit',
      effectId,
      position: { x: impactCenter.x, y: attack.shape === 'SLAM' || attack.shape === 'RITUAL' || attack.shape === 'SIGIL' ? 0.045 : 0.8, z: impactCenter.z },
      color: blocked ? '#e2c074' : attack.telegraphColor,
      scale: 1,
      sound: blocked ? 'shield' : attack.statusEffect?.statusId === 'POISON' ? 'poison' : damage ? 'playerHit' : 'cast',
      surface: blocked ? 'metal' : 'organic',
      sourceId: attack.id,
      ownerId: enemy.id,
      priority: enemy.isBoss ? 'critical_hit' : 'ordinary_hit',
    });
    this.addToast(blocked ? 'Aspis blocked ' + enemy.name + ' for ' + damage + '.' : damage ? enemy.name + ' hit for ' + damage + '.' : attack.name + ' weakens you.');
  }

  private isFacingAttacker(enemy: WorldEnemy): boolean {
    const toward = Math.atan2(enemy.position.z - this.player.position.z, enemy.position.x - this.player.position.x);
    const delta = Math.atan2(Math.sin(toward - this.player.rotation.yaw), Math.cos(toward - this.player.rotation.yaw));
    return Math.abs(delta) <= 1.18;
  }

  private primeMyrmidonCounter(): void {
    if (this.player.classId !== 'BARBARIAN') return;
    this.player = { ...this.player, statusEffects: applyRealtimeStatus(this.player.statusEffects, { statusId: 'COUNTER', durationSeconds: 1.2, magnitude: 0.3 }, 'perfect_dodge') };
    this.visualEvents.push({ kind: 'impact', effectId: 'laurel_light', position: { x: this.player.position.x, y: 0.75, z: this.player.position.z }, color: '#edc875', scale: 0.7 });
    this.addToast('Perfect dodge — next melee strike gains 30% damage.');
  }

  private processEnemyRewards(): void {
    let changed = false;
    let guardianDefeated = false;
    this.enemies = this.enemies.map(enemy => {
      if (enemy.health > 0) {
        if (enemy.definitionId === 'guardian_threadbound_warden' && (enemy.phase ?? 1) < 2 && !enemy.phaseTransitioned && enemy.health <= enemy.maxHealth * 0.5) {
          this.visualEvents.push({ kind: 'bossPhase', effectId: 'guardian_sigil', position: { x: enemy.position.x, y: 0.06, z: enemy.position.z }, color: '#d34e4e', scale: 1.4, sound: 'bossPhase', sourceId: 'warden_phase_two', ownerId: enemy.id, priority: 'critical_hit' });
          this.addLog('The Threadbound Warden breaks its first seal. Red sigils spread through the chamber.');
          this.addToast('Threadbound Warden · Phase II');
          return { ...enemy, phase: 2, phaseTransitioned: true, activeAttackId: undefined, telegraphPosition: undefined, state: 'RECOVER', stateTimer: 0.72, attackCooldown: 0.55 };
        }
        return enemy;
      }
      if (enemy.definitionId === this.world.floor.guardianId && enemy.rewardGranted) {
        if (this.world.floor.guardianState !== 'DESCENT_UNLOCKED') {
          guardianDefeated = true;
          this.world = { ...this.world, floor: { ...this.world.floor, guardianState: 'DESCENT_UNLOCKED' } };
        }
        return enemy.state === 'DEAD' ? enemy : { ...enemy, state: 'DEAD' };
      }
      if (enemy.rewardGranted) return enemy;
      changed = true;
      const rewarded = { ...enemy, rewardGranted: true, state: 'DEAD' as const };
      const experience = grantExperience(this.player, enemy.xpReward);
      this.player = experience.player;
      if (experience.levelsGained) {
        this.addToast('Level ' + this.player.stats.level + ' reached. Your core stats improved.');
        this.visualEvents.push({ kind: 'audio', position: { ...this.player.position }, sound: 'levelUp' });
      }
      const item = makeEnemyDrop(enemy, this.world.level);
      this.loot = [...this.loot, { id: item.instanceId, position: { x: enemy.position.x, y: 0, z: enemy.position.z }, item }];
      this.visualEvents.push({ kind: 'enemyDeath', effectId: enemy.isBoss ? 'guardian_death' : 'blood_hit', position: { x: enemy.position.x, y: 0.4, z: enemy.position.z }, color: '#f4bc72', scale: enemy.isBoss ? 1.35 : 0.85, sound: enemy.isBoss ? 'bossDeath' : undefined, sourceId: 'enemy_death_reward', ownerId: enemy.id, priority: enemy.isBoss ? 'critical_hit' : 'ordinary_hit' });
      this.addLog(enemy.name + ' defeated. +' + enemy.xpReward + ' XP.');
      if (enemy.definitionId === this.world.floor.guardianId) {
        guardianDefeated = true;
        this.world = { ...this.world, floor: { ...this.world.floor, guardianState: 'DESCENT_UNLOCKED' } };
      }
      if (enemy.roomId && !this.enemies.some(other => other.id !== enemy.id && other.roomId === enemy.roomId && other.health > 0)) {
        this.world = { ...this.world, floor: { ...this.world.floor, rooms: this.world.floor.rooms.map(room => room.id === enemy.roomId ? { ...room, resolved: true, visited: true, discovered: true } : room) } };
      }
      return rewarded;
    });
    if (guardianDefeated) this.addToast('The Guardian falls. Descent unlocked; the rest of the floor remains open.');
    else if (changed) this.addToast('Loot dropped. Press E to collect.');
  }

  private tickCombatStatuses(deltaSeconds: number): void {
    if (this.player.statusEffects.length) {
      const tick = tickRealtimeStatuses(this.player.statusEffects, deltaSeconds);
      this.player = { ...this.player, stats: { ...this.player.stats, hp: Math.max(0, Math.min(this.player.stats.maxHp, this.player.stats.hp - tick.damage + tick.healing)) }, statusEffects: tick.statuses };
      if (tick.ticks.length) this.visualEvents.push({ kind: 'impact', effectId: tick.ticks.some(effect => effect.statusId === 'POISON') ? 'poison_splash' : 'fire_burst', position: { x: this.player.position.x, y: 0.8, z: this.player.position.z }, color: '#a8c65a', scale: 0.48 });
    }
    this.enemies = this.enemies.map(enemy => {
      if (enemy.health <= 0 || !enemy.statusEffects?.length) return enemy;
      const tick = tickRealtimeStatuses(enemy.statusEffects, deltaSeconds);
      if (tick.damage <= 0) return { ...enemy, statusEffects: tick.statuses };
      const health = Math.max(0, enemy.health - tick.damage);
      return { ...enemy, health, statusEffects: tick.statuses, state: health <= 0 ? 'DEAD' : enemy.state === 'ATTACK_WINDUP' ? 'HURT' : enemy.state, stateTimer: health <= 0 ? 1.1 : enemy.state === 'ATTACK_WINDUP' ? 0.18 : enemy.stateTimer };
    });
  }

  interact(): void {
    const drop = this.getLookedAtLoot();
    if (drop) {
      this.loot = this.loot.filter(item => item.id !== drop.id);
      this.player = { ...this.player, inventory: [...this.player.inventory, drop.item] };
      this.visualEvents.push({ kind: 'pickup', position: { ...drop.position, y: 0.35 }, color: '#ffd36d', scale: 0.85, sound: 'pickup' });
      this.addToast(drop.item.name + ' collected.');
      this.addLog('Collected ' + drop.item.name + '.');
      return;
    }
    const target = findLookTarget(this.world, this.player);
    if (!target) { this.addToast('Nothing to interact with.'); return; }
    if (target.kind === 'DOOR') {
      const map = this.world.map.map(row => [...row]);
      map[target.z][target.x] = 0;
      this.world = { ...this.world, map, worldRevision: this.world.worldRevision + 1 };
      this.addToast('Door opened.');
      return;
    }
    if (target.kind === 'LOCKED') { this.attemptGate(target.x, target.z, target.room, false); return; }
    if (target.kind === 'SECRET') { this.attemptGate(target.x, target.z, target.room, true); return; }
    if (target.kind === 'EXIT') {
      if (this.world.floor.guardianState !== 'DESCENT_UNLOCKED') { this.addToast('The floor guardian still seals the descent.'); return; }
      this.advanceFloor();
      return;
    }
    if (target.kind === 'ROOM') {
      const offer = createRoomOffer(target.room);
      if (offer) { this.roomOffer = offer; return; }
      if (target.room.type === 'COMBAT' || target.room.type === 'ELITE') {
        if (this.enemies.some(enemy => enemy.roomId === target.room.id && enemy.health > 0)) this.addToast('Defeat the enemies in this chamber.');
        else this.addToast('This chamber is clear.');
        return;
      }
    }
  }

  private attemptGate(x: number, z: number, room: DungeonRoom | undefined, isSecret: boolean): void {
    const useKey = !isSecret && this.world.floor.keys > 0;
    if (!useKey && !isSecret && room?.attempted) {
      this.addToast('The lock has already resisted. Find Ariadne’s Token.');
      return;
    }
    const stat = isSecret ? this.player.stats.dex : this.player.stats.str;
    const success = useKey || this.rollCheck(stat, isSecret ? 15 : 12 + Math.floor(this.world.level / 2));
    if (!success) {
      if (!isSecret) this.player = { ...this.player, stats: { ...this.player.stats, hp: Math.max(1, this.player.stats.hp - 3) } };
      if (!isSecret && room) this.world = { ...this.world, floor: { ...this.world.floor, rooms: this.world.floor.rooms.map(candidate => candidate.id === room.id ? { ...candidate, attempted: true } : candidate) } };
      this.addToast(isSecret ? 'The seam stays hidden.' : 'The lock holds. The strain costs 3 health.');
      return;
    }
    const map = this.world.map.map(row => [...row]);
    map[z][x] = 0;
    this.world = {
      ...this.world,
      map,
      worldRevision: this.world.worldRevision + 1,
      floor: { ...this.world.floor, keys: useKey ? this.world.floor.keys - 1 : this.world.floor.keys, rooms: this.world.floor.rooms.map(candidate => candidate.id === room?.id ? { ...candidate, discovered: true, unlocked: true, visited: true } : candidate) },
    };
    this.addToast(isSecret ? 'Forgotten passage found.' : useKey ? 'Ariadne’s Token used. Treasury opened.' : 'The bronze lock gives way.');
    this.addLog(isSecret ? 'A hidden limestone passage opens.' : useKey ? 'Ariadne’s Token opens a sealed treasury.' : 'The locked gate gives way.');
  }

  resolveRoomChoice(choiceId: string): void {
    if (!this.roomOffer) return;
    const room = this.world.floor.rooms.find(candidate => candidate.id === this.roomOffer?.roomId);
    if (!room) { this.roomOffer = null; return; }
    if (!this.roomOffer.choices.some(choice => choice.id === choiceId)) return;
    const hp = this.player.stats.hp, maxHp = this.player.stats.maxHp, mp = this.player.stats.mp, maxMp = this.player.stats.maxMp;
    if (choiceId === 'rest') this.player = { ...this.player, stats: { ...this.player.stats, hp: Math.min(maxHp, hp + Math.ceil(maxHp * 0.25)) } };
    else if (choiceId === 'meditate') this.player = { ...this.player, stats: { ...this.player.stats, mp: Math.min(maxMp, mp + Math.ceil(maxMp * 0.35)) } };
    else if (choiceId === 'prepare') {
      this.player = { ...this.player, statusEffects: [...this.player.statusEffects.filter(status => status.statusId !== 'prepared_damage'), { id: 'prepared_' + room.id, statusId: 'prepared_damage', durationSeconds: 35, magnitude: 4 }] };
      this.addToast('A damage blessing lasts for 35 seconds.');
    } else if (choiceId === 'blood') {
      if (hp <= Math.ceil(maxHp * 0.2)) { this.addToast('You do not have enough health to offer blood.'); return; }
      this.player = { ...this.player, stats: { ...this.player.stats, hp: Math.max(1, hp - Math.ceil(maxHp * 0.2)) }, inventory: [...this.player.inventory, createItemInstance({ id: 'shrine_charm_' + room.id, name: 'Ares’ Bronze Votive', description: 'A rare bronze charm taken from the Altar of Ares.', type: 'ACCESSORY', value: 4 + this.world.level, statBonus: 'STR', icon: '◇', quantity: 1 }, 'shrine_' + room.id, this.world.level, 'RARE')] };
    } else if (choiceId === 'aether') this.player = { ...this.player, stats: { ...this.player.stats, mp: Math.min(maxMp, mp + Math.ceil(maxMp * 0.4)) } };
    else if (choiceId === 'key') {
      if (this.world.floor.keys >= 3) this.addToast('You cannot carry more than three Ariadne’s Tokens.');
      else {
        this.world = { ...this.world, floor: { ...this.world.floor, keys: this.world.floor.keys + 1 } };
        this.addToast('You found Ariadne’s Token.');
      }
    }
    else if (choiceId === 'gear' || choiceId === 'fortune' || choiceId === 'investigate') {
      const rarity = room.type === 'LOCKED' || choiceId === 'fortune' ? 'RARE' : 'COMMON';
      const reward = createItemInstance({ id: 'vault_blade_' + room.id, name: 'Bronze Kopis of the Fallen', description: 'A balanced bronze weapon recovered from a sealed chamber.', type: 'WEAPON', value: 5 + this.world.level * 2, visualType: 'dagger', icon: '⌁', quantity: 1 }, 'room_reward_' + room.id, this.world.level, rarity);
      this.loot = [...this.loot, { id: reward.instanceId, position: { x: room.anchor.x + 0.72, y: 0, z: room.anchor.y + 0.5 }, item: reward }];
      this.addToast('A reward appeared in the room. Press E to collect it.');
    } else if (choiceId === 'supplies') {
      const health = createItemInstance({ id: 'room_health_' + room.id, name: 'Healing Draught', description: 'Restores health when used from your inventory.', type: 'POTION', value: 35, icon: '▣', quantity: 1 }, 'room_health_' + room.id, this.world.level);
      const mana = createItemInstance({ id: 'room_mana_' + room.id, name: 'Nectar Flask', description: 'Restores mana when used from your inventory.', type: 'POTION', value: 25, icon: '▣', quantity: 1 }, 'room_mana_' + room.id, this.world.level);
      this.player = { ...this.player, inventory: [...this.player.inventory, health, mana] };
    } else if (choiceId === 'disarm') {
      if (this.rollCheck(this.player.stats.dex, 13 + Math.floor(this.world.level / 3))) this.addToast('Trap safely disarmed.');
      else this.player = { ...this.player, stats: { ...this.player.stats, hp: Math.max(1, hp - Math.ceil(maxHp * 0.12)) } };
    } else if (choiceId === 'force') {
      this.player = { ...this.player, stats: { ...this.player.stats, hp: Math.max(1, hp - Math.ceil(maxHp * 0.18)) } };
    } else if (choiceId === 'leave') {
      this.addToast('You leave the cache untouched.');
    }
    const resolved = choiceId !== 'leave' || room.type === 'EVENT';
    this.world = { ...this.world, floor: { ...this.world.floor, rooms: this.world.floor.rooms.map(candidate => candidate.id === room.id ? { ...candidate, resolved } : candidate) } };
    this.roomOffer = null;
    if (!['leave', 'prepare', 'gear', 'fortune', 'investigate', 'key', 'disarm'].includes(choiceId)) this.addToast('Room resolved.');
  }

  private rollCheck(stat: number, difficulty: number): boolean {
    return Math.floor(this.random() * 20) + 1 + Math.floor(stat / 3) >= difficulty;
  }

  private advanceFloor(): void {
    const nextWorld = createDungeonWorld(this.world.level + 1, randomSeed());
    const yaw = spawnFacingAngle(nextWorld.map, { x: 1, y: 1 });
    this.world = { ...markExplored(nextWorld, 1.5, 1.5), worldRevision: this.world.worldRevision + 1 };
    this.player = { ...this.player, position: { x: 1.5, y: 0, z: 1.5 }, rotation: { yaw, pitch: this.player.rotation.pitch } };
    this.enemies = createFloorEnemies(this.world);
    this.projectiles = [];
    this.loot = [];
    this.roomOffer = null;
    this.combat.reset();
    this.controllerState = createPlayerControllerState();
    this.addLog('You descend to Labyrinth Floor ' + this.world.level + '.');
    this.addToast('The next depth awaits.');
    this.save();
  }

  private getLookedAtLoot(): WorldLootDrop | null {
    const yaw = this.player.rotation.yaw;
    const forwardX = Math.cos(yaw), forwardZ = Math.sin(yaw);
    let best: WorldLootDrop | null = null, bestDistance = Infinity;
    for (const drop of this.loot) {
      const dx = drop.position.x - this.player.position.x, dz = drop.position.z - this.player.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 2.2 || distance < 0.18 || distance >= bestDistance) continue;
      const alignment = (dx * forwardX + dz * forwardZ) / distance;
      if (alignment < 0.72 || !hasLineOfSight(this.world.map, this.player.position.x, this.player.position.z, drop.position.x, drop.position.z, 0.1)) continue;
      best = drop;
      bestDistance = distance;
    }
    return best;
  }

  private getTargetEnemy(): WorldEnemy | null {
    const direction = projectileDirection(this.player.rotation.yaw, this.player.rotation.pitch);
    let target: WorldEnemy | null = null, closest = Infinity;
    for (const enemy of this.enemies) {
      if (enemy.health <= 0 || enemy.state === 'DEAD') continue;
      const dx = enemy.position.x - this.player.position.x;
      const dy = 0.8 - 1.52;
      const dz = enemy.position.z - this.player.position.z;
      const distance = Math.hypot(dx, dy, dz);
      if (distance > 20 || distance >= closest) continue;
      const alignment = (dx * direction.x + dy * direction.y + dz * direction.z) / distance;
      if (alignment < 0.986 || !hasLineOfSight(this.world.map, this.player.position.x, this.player.position.z, enemy.position.x, enemy.position.z, 0.15)) continue;
      target = enemy;
      closest = distance;
    }
    return target;
  }

  private getPrompt(): string | null {
    const drop = this.getLookedAtLoot();
    if (drop) return 'E  Collect ' + drop.item.name;
    const target = findLookTarget(this.world, this.player);
    if (!target) return null;
    if (target.kind === 'DOOR') return 'E  Open door';
    if (target.kind === 'LOCKED') return this.world.floor.keys > 0 ? 'E  Use Ariadne’s Token' : 'E  Force locked gate';
    if (target.kind === 'SECRET') return 'E  Search for a secret';
    if (target.kind === 'EXIT') return this.world.floor.guardianState === 'DESCENT_UNLOCKED' ? 'E  Descend to Floor ' + (this.world.level + 1) : 'Defeat the floor guardian to unlock descent';
    if (target.kind === 'ROOM') {
      if (target.room.type === 'LOCKED' && target.room.unlocked) return 'E  Claim vault reward';
      if (target.room.type === 'COMBAT' || target.room.type === 'ELITE') return this.enemies.some(enemy => enemy.roomId === target.room.id && enemy.health > 0) ? 'Clear the chamber' : 'Chamber cleared';
      return 'E  ' + target.room.type.toLowerCase().replace(/_/g, ' ');
    }
    return null;
  }

  equip(instanceId: string): void {
    this.player = equipItem(this.player, instanceId);
  }

  unequip(slot: EquipmentSlot): void {
    this.player = unequipItem(this.player, slot);
  }

  useItem(instanceId: string): void {
    const next = consumePotion(this.player, instanceId);
    if (!next) { this.addToast('That item cannot be used now.'); return; }
    this.player = next;
    this.addToast('Potion used.');
  }

  save(storage?: KeyValueStorage): boolean {
    const save = { player: this.player, world: this.world, enemies: this.enemies, loot: this.loot, combat: this.combat.snapshot() };
    const success = saveMazeGame(save, storage);
    this.lastSaveSucceeded = success;
    this.addToast(success ? 'Run saved.' : 'Save failed. Storage is unavailable.');
    return success;
  }

  get saveSucceeded(): boolean | null { return this.lastSaveSucceeded; }

  private updateGuardianDiscovery(): void {
    const floor = this.world.floor;
    if (!floor.guardianId || floor.guardianState !== 'NOT_DISCOVERED') return;
    const guardian = this.enemies.find(enemy => enemy.definitionId === floor.guardianId && enemy.health > 0);
    if (!guardian) return;
    const distance = Math.hypot(guardian.position.x - this.player.position.x, guardian.position.z - this.player.position.z);
    if (distance > 8 || !hasLineOfSight(this.world.map, this.player.position.x, this.player.position.z, guardian.position.x, guardian.position.z, 0.2)) return;
    this.world = { ...this.world, floor: { ...floor, guardianState: 'ALIVE' } };
    this.addLog(getFloorGuardianDefinition(this.world.level).entranceLine);
    this.addToast(getFloorGuardianDefinition(this.world.level).entranceLine);
  }

  getRenderState(): FPSRenderState {
    return { world: this.world, player: this.player, enemies: this.enemies, projectiles: this.projectiles, loot: this.loot, action: this.combat.action, isMoving: this.isMoving, guarding: this.controllerState.guarding, paused: this.paused || this.inventoryOpen || this.mapOpen || Boolean(this.roomOffer) || this.gameOver, cameraBob: this.cameraBob, events: this.visualEvents.splice(0) };
  }

  getSnapshot(): FPSGameSnapshot {
    const loadout = CLASS_ABILITY_LOADOUT[this.player.classId];
    return {
      player: this.player,
      world: this.world,
      enemies: this.enemies,
      loot: this.loot,
      action: this.combat.action,
      primaryAbilityId: loadout.primary,
      secondaryAbilityId: loadout.secondary,
      skillAbilityId: loadout.skill,
      skillAbilityIds: [...loadout.skillSlots],
      primaryCooldown: this.combat.getCooldown(loadout.primary),
      secondaryCooldown: this.combat.getCooldown(loadout.secondary),
      skillCooldown: this.combat.getCooldown(loadout.skill),
      skillCooldowns: loadout.skillSlots.map(id => id ? this.combat.getCooldown(id) : 0),
      chargeProgress: this.chargeStartedAt === null ? 0 : Math.min(1, (this.elapsedSeconds - this.chargeStartedAt) / 1),
      isMoving: this.isMoving,
      guarding: this.controllerState.guarding,
      paused: this.paused,
      inventoryOpen: this.inventoryOpen,
      mapOpen: this.mapOpen,
      gameOver: this.gameOver,
      roomOffer: this.roomOffer,
      prompt: this.paused || this.inventoryOpen || this.mapOpen || this.roomOffer ? null : this.getPrompt(),
      targetEnemy: this.getTargetEnemy(),
      toast: this.toast,
      log: [...this.logs],
    };
  }

  private addLog(message: string): void {
    this.logs = [...this.logs.slice(-5), message];
  }

  private addToast(message: string): void {
    this.toast = message;
    this.toastSeconds = 2.2;
  }
}

function clonePlayer(player: PlayerCharacter): PlayerCharacter {
  return {
    ...player,
    position: { ...player.position },
    rotation: { ...player.rotation },
    stats: { ...player.stats },
    equipment: Object.fromEntries(Object.entries(player.equipment).map(([slot, item]) => [slot, item ? { ...item, affixes: [...item.affixes] } : null])) as PlayerCharacter['equipment'],
    inventory: player.inventory.map(item => ({ ...item, affixes: [...item.affixes] })),
    skills: player.skills.map(skill => ({ ...skill })),
    statusEffects: player.statusEffects.map(status => ({ ...status })),
  };
}

function cloneWorld(world: DungeonWorldState): DungeonWorldState {
  return {
    ...world,
    map: world.map.map(row => [...row]),
    decorations: world.decorations.map(row => [...row]),
    explored: world.explored.map(row => [...row]),
    floor: { ...world.floor, rooms: world.floor.rooms.map(room => ({ ...room, anchor: { ...room.anchor }, cells: room.cells.map(cell => ({ ...cell })), gate: room.gate ? { ...room.gate } : undefined })), visitedCells: [...world.floor.visitedCells], pendingEffects: [...world.floor.pendingEffects] },
  };
}

function getAbilityStartSound(ability: NonNullable<ReturnType<typeof getAbility>>): NonNullable<VisualEvent['sound']> {
  if (ability.meleeStyle === 'THRUST') return 'spear';
  if (ability.meleeStyle === 'BASH') return 'shield';
  if (ability.kind === 'MELEE') return 'blade';
  return ability.manaCost > 0 ? 'cast' : 'projectile';
}

function statusVfxEffect(statusId?: string): PixelEffectId | undefined {
  if (statusId === 'POISON') return 'arachne_venom';
  if (statusId === 'BURN') return 'promethean_flame';
  if (statusId === 'SLOW') return 'web_snare';
  if (statusId === 'WEAKNESS') return 'chthonic_bolt';
  return undefined;
}

function abilityVfxEffect(abilityId: string, statusId?: string): PixelEffectId | undefined {
  const statusEffect = statusVfxEffect(statusId);
  if (statusEffect) return statusEffect;
  if (/soul_drain|chthonic|underworld|warden|curse|grasp/i.test(abilityId)) return 'chthonic_bolt';
  if (/sorcerer_|oracle|spark|lightning|charged_bolt/i.test(abilityId)) return 'oracle_spark';
  if (/fireburst|promethean|flame/i.test(abilityId)) return 'promethean_flame';
  if (/web|snare/i.test(abilityId)) return 'web_snare';
  return undefined;
}
