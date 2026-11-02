import type { ClassType, DungeonRoom, EquipmentSlot, ItemInstance, PlayerCharacter, WorldEnemy, WorldLootDrop, WorldProjectile } from '../types';
import type { InputFrame } from './InputSystem';
import { createDungeonWorld, createFloorEnemies, createRoomOffer, findLookTarget, markExplored, randomSeed, type RoomOffer } from '../world/DungeonWorld';
import { raycastGrid, hasLineOfSight } from '../world/CollisionWorld';
import { updateEnemyBrains } from '../enemies/EnemyBrain';
import { updateProjectiles, type ProjectileImpact } from '../combat/ProjectileSystem';
import { calculateIncomingDamage, calculatePlayerDamage, projectileDirection, resolveAreaAttack, resolveMeleeAttack } from '../combat/DamageSystem';
import { CLASS_ABILITY_LOADOUT, getAbility } from '../combat/AbilityRegistry';
import { getEnemyAttackDefinition } from '../data/enemyAttacks';
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

export interface FPSGameSnapshot {
  player: PlayerCharacter;
  world: DungeonWorldState;
  enemies: WorldEnemy[];
  loot: WorldLootDrop[];
  action: ActivePlayerAction | null;
  primaryAbilityId: string;
  secondaryAbilityId: string;
  skillAbilityId: string;
  primaryCooldown: number;
  secondaryCooldown: number;
  skillCooldown: number;
  chargeProgress: number;
  isMoving: boolean;
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
      this.visualEvents.push({ kind: 'dodge', position: { x: this.player.position.x, y: 0.15, z: this.player.position.z }, color: '#97ddff', scale: 0.7 });
    }
    this.world = markExplored(this.world, this.player.position.x, this.player.position.z);
    this.updateGuardianDiscovery();

    this.processInput(input);
    const actionUpdate = this.combat.update(dt);
    if (actionUpdate.activeStarted && actionUpdate.action) this.resolvePlayerAction(actionUpdate.action);

    const enemyUpdate = updateEnemyBrains(this.enemies, this.world.map, this.player, dt);
    this.enemies = enemyUpdate.enemies;
    for (const enemyId of enemyUpdate.attacks) this.resolveEnemyAttack(enemyId);

    const projectileUpdate = updateProjectiles(this.projectiles, this.enemies, this.world.map, dt, this.player.position);
    this.projectiles = projectileUpdate.projectiles;
    this.enemies = projectileUpdate.enemies;
    this.processProjectileImpacts(projectileUpdate.impacts);
    this.processEnemyRewards();

    if (this.player.stats.hp <= 0) {
      this.player = { ...this.player, stats: { ...this.player.stats, hp: 0 } };
      this.gameOver = true;
      this.paused = true;
      this.addToast('You have fallen. Your run can still be saved for review.');
    }
    if (this.player.stats.mp < this.player.stats.maxMp) {
      this.player = { ...this.player, stats: { ...this.player.stats, mp: Math.min(this.player.stats.maxMp, this.player.stats.mp + dt * 0.7) } };
    }
    this.updatePlayerStatuses(dt);
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
      if (input.skillSlot === 1) this.startAbility(loadout.skill);
      else this.addToast('No skill learned in slot ' + input.skillSlot + ' yet.');
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
    if (result.ability) this.addLog(result.ability.name + '.');
  }

  private resolvePlayerAction(action: ActivePlayerAction): void {
    const ability = getAbility(action.abilityId);
    if (!ability) return;
    const damage = calculatePlayerDamage(this.player, ability, action.damageMultiplier);
    if (ability.kind === 'MELEE') {
      const result = resolveMeleeAttack(this.world.map, this.player, this.enemies, ability, damage);
      this.enemies = result.enemies;
      this.visualEvents.push({ kind: 'melee', position: { x: this.player.position.x + Math.cos(this.player.rotation.yaw) * 0.75, y: 0.9, z: this.player.position.z + Math.sin(this.player.rotation.yaw) * 0.75 }, color: '#ffd17b', scale: 1.2 });
      if (result.hitEnemyIds.length) this.addToast(ability.name + ' hit ' + result.hitEnemyIds.length + (result.hitEnemyIds.length === 1 ? ' foe.' : ' foes.'));
      return;
    }
    if (ability.kind === 'PROJECTILE') {
      if (this.projectiles.length >= 64) {
        this.addToast('The projectile field is full.');
        return;
      }
      const direction = projectileDirection(this.player.rotation.yaw, this.player.rotation.pitch);
      const damageMultiplier = action.damageMultiplier;
      this.projectiles.push({
        id: this.nextProjectileId++,
        position: { x: this.player.position.x + direction.x * 0.38, y: 1.3 + direction.y * 0.3, z: this.player.position.z + direction.z * 0.38 },
        velocity: { x: direction.x * (ability.projectileSpeed ?? 10), y: direction.y * (ability.projectileSpeed ?? 10), z: direction.z * (ability.projectileSpeed ?? 10) },
        radius: ability.id === 'sorcerer_charged_bolt' && damageMultiplier > 1.25 ? 0.19 : 0.13,
        damage,
        remainingSeconds: ability.range / Math.max(1, ability.projectileSpeed ?? 10),
        sourceAbilityId: ability.id,
        color: ability.projectileColor ?? '#8bddff',
      });
      this.visualEvents.push({ kind: 'impact', position: { x: this.player.position.x + direction.x * 0.35, y: 1.3, z: this.player.position.z + direction.z * 0.35 }, color: ability.projectileColor, scale: 0.55 });
      return;
    }
    if (ability.id === 'cleric_restoration') {
      const restored = Math.ceil(this.player.stats.maxHp * 0.35);
      this.player = { ...this.player, stats: { ...this.player.stats, hp: Math.min(this.player.stats.maxHp, this.player.stats.hp + restored) } };
      this.visualEvents.push({ kind: 'area', position: { x: this.player.position.x, y: 0.8, z: this.player.position.z }, color: '#8cf2b4', scale: 1.25 });
      this.addToast('Restoration recovered ' + restored + ' health.');
      return;
    }
    const selfCentered = ability.id === 'barbarian_ground_slam' || ability.id === 'paladin_smite' || ability.id === 'paladin_consecration';
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
    this.visualEvents.push({ kind: 'area', position: { x: centerX, y: 0.12, z: centerZ }, color: ability.projectileColor ?? '#ffb65b', scale: radius });
    this.addToast(ability.name + (result.hitEnemyIds.length ? ' hit ' + result.hitEnemyIds.length + '.' : '.'));
  }

  private processProjectileImpacts(impacts: ProjectileImpact[]): void {
    for (const impact of impacts) {
      this.visualEvents.push({ kind: 'impact', position: impact.position, color: impact.color, scale: impact.enemyId ? 0.95 : 0.6 });
      if (impact.playerHit) {
        if (this.controllerState.invulnerabilitySeconds > 0) { this.addToast('Attack dodged.'); continue; }
        const owner = this.enemies.find(enemy => enemy.id === impact.ownerEnemyId);
        if (!owner) continue;
        const damage = calculateIncomingDamage(owner, this.player);
        this.player = { ...this.player, stats: { ...this.player.stats, hp: Math.max(0, this.player.stats.hp - damage) } };
        if (impact.abilityId === 'lamia_drain') this.enemies = this.enemies.map(enemy => enemy.id === owner.id ? { ...enemy, health: Math.min(enemy.maxHealth, enemy.health + Math.ceil(damage * 0.45)) } : enemy);
        this.addToast(owner.name + ' struck you for ' + damage + '.');
      }
      if (impact.enemyId) {
        this.addToast('Hit.');
        if (impact.abilityId === 'necromancer_soul_drain') {
          this.player = { ...this.player, stats: { ...this.player.stats, hp: Math.min(this.player.stats.maxHp, this.player.stats.hp + 5) } };
        }
      }
    }
  }

  private resolveEnemyAttack(enemyId: string): void {
    const enemy = this.enemies.find(candidate => candidate.id === enemyId && candidate.health > 0);
    if (!enemy) return;
    const attack = getEnemyAttackDefinition(enemy.attackSetId, enemy.activeAttackId);
    if (!attack) return;
    const distance = Math.hypot(enemy.position.x - this.player.position.x, enemy.position.z - this.player.position.z);
    const hasSight = hasLineOfSight(this.world.map, enemy.position.x, enemy.position.z, this.player.position.x, this.player.position.z, 0.15);
    const yaw = enemy.facingYaw ?? Math.atan2(this.player.position.z - enemy.position.z, this.player.position.x - enemy.position.x);
    const toPlayer = Math.atan2(this.player.position.z - enemy.position.z, this.player.position.x - enemy.position.x);
    const angleDelta = Math.atan2(Math.sin(toPlayer - yaw), Math.cos(toPlayer - yaw));
    const inRange = distance <= attack.range + 0.28;
    const inShape = attack.shape === 'MELEE' ? inRange
      : attack.shape === 'CONE' ? inRange && Math.abs(angleDelta) <= (attack.arcRadians ?? 1.1) / 2
      : attack.shape === 'SLAM' || attack.shape === 'RITUAL' ? distance <= (attack.radius ?? attack.range)
      : false;
    if (attack.shape === 'PROJECTILE' || attack.shape === 'DRAIN') {
      if (!hasSight || distance > attack.range || this.projectiles.length >= 64) return;
      const dx = this.player.position.x - enemy.position.x, dz = this.player.position.z - enemy.position.z;
      const horizontal = Math.max(0.001, Math.hypot(dx, dz));
      const speed = attack.projectileSpeed ?? 6;
      this.projectiles.push({
        id: this.nextProjectileId++,
        position: { x: enemy.position.x, y: 1.1, z: enemy.position.z },
        velocity: { x: dx / horizontal * speed, y: (0.95 - 1.1) / horizontal * speed, z: dz / horizontal * speed },
        radius: 0.17, damage: Math.max(1, Math.round(enemy.damage * attack.damageMultiplier)),
        remainingSeconds: attack.range / speed, sourceAbilityId: attack.id,
        color: attack.projectileColor ?? attack.telegraphColor, faction: 'ENEMY', ownerEnemyId: enemy.id,
      });
      return;
    }
    if (!hasSight || !inShape) return;
    if (this.controllerState.invulnerabilitySeconds > 0) {
      this.visualEvents.push({ kind: 'dodge', position: { x: this.player.position.x, y: 0.35, z: this.player.position.z }, color: '#a2e8ff', scale: 1 });
      this.addToast('Attack dodged.');
      return;
    }
    const damage = Math.max(1, Math.round(calculateIncomingDamage(enemy, this.player) * attack.damageMultiplier));
    this.player = { ...this.player, stats: { ...this.player.stats, hp: Math.max(0, this.player.stats.hp - damage) } };
    this.visualEvents.push({ kind: 'enemyHit', position: { x: this.player.position.x, y: 0.8, z: this.player.position.z }, color: '#f46d63', scale: 1 });
    this.addToast(enemy.name + ' hit for ' + damage + '.');
  }

  private processEnemyRewards(): void {
    let changed = false;
    let guardianDefeated = false;
    this.enemies = this.enemies.map(enemy => {
      if (enemy.health > 0) return enemy;
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
      if (experience.levelsGained) this.addToast('Level ' + this.player.stats.level + ' reached. Your core stats improved.');
      const item = makeEnemyDrop(enemy, this.world.level);
      this.loot = [...this.loot, { id: item.instanceId, position: { x: enemy.position.x, y: 0, z: enemy.position.z }, item }];
      this.visualEvents.push({ kind: 'enemyDeath', position: { x: enemy.position.x, y: 0.4, z: enemy.position.z }, color: '#f4bc72', scale: 1.1 });
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

  private updatePlayerStatuses(deltaSeconds: number): void {
    if (!this.player.statusEffects.length) return;
    const statusEffects = this.player.statusEffects.map(status => ({ ...status, durationSeconds: status.durationSeconds - deltaSeconds })).filter(status => status.durationSeconds > 0);
    this.player = { ...this.player, statusEffects };
  }

  interact(): void {
    const drop = this.getLookedAtLoot();
    if (drop) {
      this.loot = this.loot.filter(item => item.id !== drop.id);
      this.player = { ...this.player, inventory: [...this.player.inventory, drop.item] };
      this.visualEvents.push({ kind: 'pickup', position: { ...drop.position, y: 0.35 }, color: '#ffd36d', scale: 0.85 });
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
    return { world: this.world, player: this.player, enemies: this.enemies, projectiles: this.projectiles, loot: this.loot, action: this.combat.action, isMoving: this.isMoving, cameraBob: this.cameraBob, events: this.visualEvents.splice(0) };
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
      primaryCooldown: this.combat.getCooldown(loadout.primary),
      secondaryCooldown: this.combat.getCooldown(loadout.secondary),
      skillCooldown: this.combat.getCooldown(loadout.skill),
      chargeProgress: this.chargeStartedAt === null ? 0 : Math.min(1, (this.elapsedSeconds - this.chargeStartedAt) / 1),
      isMoving: this.isMoving,
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
