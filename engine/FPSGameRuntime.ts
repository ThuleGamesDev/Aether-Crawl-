import type { ClassType, DerivedCharacterStats, DungeonRoom, EquipmentSlot, ItemInstance, MazeLawDraft, MazeLawId, MazeLawSynergyId, PlayerCharacter, StatusApplication, WorldEnemy, WorldLootDrop, WorldProjectile } from '../types';
import type { InputFrame } from './InputSystem';
import { createDungeonWorld, createFloorEnemies, createRoomOffer, findLookTarget, markExplored, randomSeed, type RoomOffer } from '../world/DungeonWorld';
import { raycastGrid, hasLineOfSight, isWorldSolid, moveWithEntitySlide, moveWithWallSlide } from '../world/CollisionWorld';
import { updateEnemyBrains } from '../enemies/EnemyBrain';
import { isVisibleProjectileImpact, MAX_PROJECTILE_PIERCE, updateProjectiles, type ProjectileImpact } from '../combat/ProjectileSystem';
import { applyEnemyDamage, calculateIncomingDamage, calculatePlayerDamage, getAreaTargetIds, getMeleeTargetIds, projectileDirection, resolveAreaAttack, resolveChainAttack, resolveMeleeAttack } from '../combat/DamageSystem';
import { CLASS_ABILITY_LOADOUT, getAbility, getSkillAbilityId } from '../combat/AbilityRegistry';
import { getEnemyAttackDefinition, isEnemyAttackParryable } from '../data/enemyAttacks';
import { getEnemyAttackTelegraphDescriptor, getGuardianTelegraphEffect } from '../data/enemyAttackTelegraph';
import { getFloorGuardianDefinition } from '../data/mazeContent';
import { getEnemyDefinition } from '../data/enemies';
import { createPlayerControllerState, updatePlayerController, type PlayerControllerState } from '../player/PlayerController';
import { PlayerCombat, type ActivePlayerAction } from '../player/PlayerCombat';
import { addInventoryItem, consumePotion, createPlayerCharacter, grantExperience, moveInventoryItem, refreshPlayerDerivedCaps, removeInventoryUnit, rollEnemyDrop, splitInventoryStack, tryEquipItem, tryUnequipItem } from '../player/PlayerProgression';
import { floorRandom } from '../services/floorRandom';
import { createLootInstance } from '../services/itemization';
import { spawnFacingAngle } from '../services/firstPerson';
import { saveMazeGame, type MazeRunSave } from '../services/mazeSave';
import type { KeyValueStorage } from '../services/fpsSave';
import type { DungeonWorldState } from '../world/DungeonWorld';
import type { VisualEvent } from './SceneRenderer';
import { applyRealtimeStatus, cleanseRealtimeStatuses, hasRealtimeStatus, tickRealtimeStatuses } from '../combat/StatusSystem';
import { getEnemyVfxSurface, resolveSurfaceEffect, type PixelEffectId } from '../presentation/vfxDefinitions';
import { calculateDerivedStats } from '../player/DerivedStats';
import { applyLivingLabyrinth } from '../world/LivingLabyrinth';
import { createEmptyMazeLawProgress, createLawDraft, openLawDraft, selectMazeLaw } from '../services/lawDraft';
import { getMazeLaw } from '../data/mazeLaws';
import { rollItemStatusProc } from '../player/ItemCombatEffects';
import { consumeUniqueCharge, resolveUniqueTrigger, tickUniqueEffects } from '../player/UniqueEffects';
import { applySkillUpgrade, getClassSkillUnlockLevel, getRankedAbility, getSkillRank, getSkillUpgradeChoices, isClassSkillSlotUnlocked, normalizeSkillProgression, type SkillUpgradeOption } from '../player/SkillProgression';
import { normalizeClassPassiveState, recordClassBlock, recordClassDodge, recordClassHealing, recordClassKill, recordClassMeleeAction, recordMarkedPreyHit, resolveClassPassiveAction, tickClassPassiveState } from '../player/ClassPassives';
import type { EquipmentTransactionResult } from '../services/equipmentRules';
import { isShieldItem } from '../services/equipmentRules';
import { abilityPoiseDamage, applyEnemyPoiseDamage, enemyAttackContainsPoint, getEnemyPoiseProfile, initializeEnemyPoise, STAMINA_RULES, tickEnemyPoise } from '../combat/CombatMastery';
import { awardThreadCharge, buildThreadAnchorOffer, closeThreadAnchor as clearOpenThreadAnchor, createAriadneThreadProgress, openThreadAnchor as markThreadAnchorOpen, planAriadneThreadEdit, type ThreadAnchorOffer, type ThreadEditContext } from '../services/ariadneThread';
import type { AriadneThreadAction } from '../types';
import { createMazeChronicle, recordMazeChronicleEvent, type MazeChronicleEventInput } from '../services/mazeChronicle';

export interface FPSGameSnapshot {
  player: PlayerCharacter;
  derivedStats: DerivedCharacterStats;
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
  skillUpgradeChoices: SkillUpgradeOption[];
  levelUpOpen: boolean;
  chargeProgress: number;
  isMoving: boolean;
  guarding: boolean;
  paused: boolean;
  inventoryOpen: boolean;
  mapOpen: boolean;
  chronicleOpen: boolean;
  gameOver: boolean;
  roomOffer: RoomOffer | null;
  lawOffer: MazeLawDraft | null;
  threadOffer: ThreadAnchorOffer | null;
  prompt: string | null;
  targetEnemy: WorldEnemy | null;
  incomingAttacks: Array<{ id: string; name: string; seconds: number; parryable: boolean; direction: 'FRONT' | 'LEFT' | 'RIGHT' | 'BEHIND' }>;
  parryWindowSeconds: number;
  parryRecoverySeconds: number;
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
  viewmodelEvent: 'DODGE' | 'HIT_RECOIL' | 'ITEM_USE' | null;
  viewmodelEventProgress: number;
  events: VisualEvent[];
}

export class FPSGameRuntime {
  player: PlayerCharacter;
  world: DungeonWorldState;
  enemies: WorldEnemy[];
  projectiles: WorldProjectile[] = [];
  loot: WorldLootDrop[] = [];
  roomOffer: RoomOffer | null = null;
  private threadOffer: ThreadAnchorOffer | null = null;
  chronicleOpen = false;
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
  private levelUpOpen = false;
  private viewmodelEvent: FPSRenderState['viewmodelEvent'] = null;
  private viewmodelEventSeconds = 0;
  private viewmodelEventDuration = 0;

  constructor(classId: ClassType, save?: Pick<MazeRunSave, 'player' | 'world' | 'enemies' | 'loot' | 'combat'>) {
    if (save) {
      this.player = refreshPlayerDerivedCaps(normalizeSkillProgression(clonePlayer(save.player)));
      this.player = { ...this.player, classPassiveState: normalizeClassPassiveState(this.player.classId, this.player.classPassiveState) };
      this.world = cloneWorld(save.world);
      this.enemies = save.enemies.map(enemy => initializeEnemyPoise({ ...enemy, position: { ...enemy.position } }));
      this.loot = save.loot.map(drop => ({ ...drop, position: { ...drop.position }, item: { ...drop.item, affixes: [...drop.item.affixes] } }));
      this.combat.restore(save.combat);
    } else {
      this.world = createDungeonWorld(1, randomSeed());
      const yaw = spawnFacingAngle(this.world.map, { x: 1, y: 1 });
      this.player = createPlayerCharacter(classId, { x: 1.5, y: 0, z: 1.5 });
      this.player.rotation.yaw = yaw;
      this.enemies = createFloorEnemies(this.world).map(initializeEnemyPoise);
      this.addLog('Enter the Labyrinth beneath Knossos. A guardian seals every descent.');
    }
    this.random = floorRandom(this.world.seed ^ 0xA37E2);
    this.world = markExplored(this.world, this.player.position.x, this.player.position.z);
    this.updateGuardianDiscovery();
    this.updateVisibleDiscoveries();
    this.gameOver = this.player.stats.hp <= 0;
    this.levelUpOpen = !this.gameOver && (this.player.skillPoints ?? 0) > 0;
    const openThreadId = this.world.floor.threadProgress?.openJunctionId;
    if (openThreadId) this.rebuildThreadOffer(openThreadId);
  }

  update(deltaSeconds: number, input: InputFrame): void {
    const dt = Math.max(0, Math.min(0.05, deltaSeconds));
    this.elapsedSeconds += dt;
    if (this.viewmodelEventSeconds > 0) {
      this.viewmodelEventSeconds = Math.max(0, this.viewmodelEventSeconds - dt);
      if (this.viewmodelEventSeconds === 0) this.viewmodelEvent = null;
    }
    if (input.secondaryCanceled) this.cancelHeldActions();
    if (this.toastSeconds > 0) {
      this.toastSeconds = Math.max(0, this.toastSeconds - dt);
      if (this.toastSeconds === 0) this.toast = '';
    }
    if (input.pausePressed) {
      if (this.chronicleOpen) this.closeMazeChronicle();
      else if (this.threadOffer) this.closeThreadAnchor();
      else if (this.world.floor.lawProgress?.draft?.open) this.closeLawOffer();
      else if (this.levelUpOpen) { this.levelUpOpen = false; this.cancelHeldActions(); }
      else if (this.inventoryOpen || this.mapOpen) { this.inventoryOpen = false; this.mapOpen = false; }
      else {
        this.paused = !this.paused;
        if (this.paused) this.cancelHeldActions();
      }
    }
    if (input.inventoryPressed && !this.gameOver && !this.paused && !this.levelUpOpen && !this.chronicleOpen) {
      this.inventoryOpen = !this.inventoryOpen;
      this.mapOpen = false;
      if (this.inventoryOpen) this.cancelHeldActions();
    }
    if (input.mapPressed && !this.gameOver && !this.paused && !this.levelUpOpen && !this.chronicleOpen) {
      this.mapOpen = !this.mapOpen;
      this.inventoryOpen = false;
      if (this.mapOpen) this.cancelHeldActions();
    }
    if (this.paused || this.inventoryOpen || this.mapOpen || this.levelUpOpen || this.roomOffer || this.threadOffer || this.chronicleOpen || this.world.floor.lawProgress?.draft?.open || this.gameOver) return;

    this.tickLawHazards(dt);

    this.player = tickUniqueEffects(this.player, dt);
    this.player = { ...this.player, classPassiveState: tickClassPassiveState(this.player.classPassiveState, dt) };

    const movement = updatePlayerController(this.player, this.controllerState, input, this.world.map, dt, this.enemies);
    this.player = movement.player;
    this.controllerState = movement.state;
    this.isMoving = movement.isMoving;
    this.cameraBob = movement.cameraBob;
    if (movement.dodgeFailed) this.addToast(this.player.stats.stamina! < STAMINA_RULES.dodgeCost ? 'Not enough stamina to dodge.' : 'The dodge path is blocked.');
    if (movement.parryFailure === 'NO_SHIELD') this.addToast('A shield is required to parry.');
    else if (movement.parryFailure === 'NO_STAMINA') this.addToast('Not enough stamina to parry.');
    else if (movement.parryFailure === 'RECOVERY') this.addToast('Parry is recovering.');
    if (movement.parryStarted) {
      this.addToast('Parry window open.');
      this.visualEvents.push({ kind: 'impact', effectId: 'shield_impact', position: { x: this.player.position.x, y: 0.7, z: this.player.position.z }, color: '#70d7c6', scale: 0.52, sound: 'shield', surface: 'metal', sourceId: 'shield_parry' });
    }
    if (movement.dodgeStarted) {
      this.setViewmodelEvent('DODGE', 0.22);
      this.player = recordClassDodge(this.player);
      const unique = resolveUniqueTrigger(this.player, 'ariadnes_thread', 'DODGE_SUCCESS');
      if (unique.activated) {
        this.player = unique.player;
        this.addToast("Ariadne's Thread pulls you clear.");
        this.visualEvents.push({ kind: 'impact', effectId: 'laurel_light', position: { x: this.player.position.x, y: 0.55, z: this.player.position.z }, color: '#e7c879', scale: 0.55 });
      }
      this.addLog('Dodge.');
      this.visualEvents.push({ kind: 'dodge', position: { x: this.player.position.x, y: 0.15, z: this.player.position.z }, color: '#97ddff', scale: 0.7, sound: 'dodge' });
    }
    this.world = markExplored(this.world, this.player.position.x, this.player.position.z);
    this.updateGuardianDiscovery();
    this.updateVisibleDiscoveries();

    this.processInput(input);
    const actionUpdate = this.combat.update(dt);
    if (actionUpdate.activeStarted && actionUpdate.action) {
      let actionForHits = actionUpdate.action;
      for (const hitIndex of actionUpdate.activeHitIndices) {
        this.resolvePlayerAction({ ...actionForHits, hitIndex });
        actionForHits = this.combat.action ?? actionForHits;
      }
    }

    this.enemies = this.enemies.map(enemy => tickEnemyPoise(enemy, dt));
    const enemyUpdate = updateEnemyBrains(this.enemies, this.world.map, this.player, dt);
    this.enemies = enemyUpdate.enemies;
    this.updateVisibleDiscoveries();
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
    if (this.levelUpOpen) return;

    this.tickCombatStatuses(dt);
    this.processEnemyRewards();

    const derived = calculateDerivedStats(this.player);
    if (this.player.stats.mp < derived.maxMana) {
      this.player = { ...this.player, stats: { ...this.player.stats, mp: Math.min(derived.maxMana, this.player.stats.mp + dt * 0.7) } };
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
      if (abilityId && isClassSkillSlotUnlocked(this.player, input.skillSlot!)) this.startAbility(abilityId);
      else if (abilityId) this.addToast('Unlock this skill at level ' + (getClassSkillUnlockLevel(this.player.classId, input.skillSlot!) ?? '?') + '.');
      else if (input.skillSlot !== null) this.addToast('No skill learned in slot ' + input.skillSlot + ' yet.');
    }
    if (input.interactPressed) this.interact();
  }

  private startAbility(abilityId: string, chargeSeconds = 0): void {
    const ability = getAbility(abilityId);
    const projectileCount = ability?.kind === 'PROJECTILE' ? boundedProjectileCount(ability) : 0;
    if (ability?.kind === 'PROJECTILE' && this.projectiles.length + projectileCount > 64) {
      this.addToast('The projectile field is full.');
      return;
    }
    const result = this.combat.start(this.player, abilityId, chargeSeconds);
    if (result.error) { if (result.error !== 'Recovering from the current action.') this.addToast(result.error); return; }
    this.player = result.player;
    if (result.ability) {
      if (abilityId.startsWith('necromancer_')) {
        const seal = resolveUniqueTrigger(this.player, 'stygian_seal', 'SOUL_SKILL_CAST');
        if (seal.activated) {
          this.player = { ...seal.player, statusEffects: applyRealtimeStatus(seal.player.statusEffects, { statusId: 'GUARD', durationSeconds: 2.5, magnitude: seal.magnitude }, 'stygian_seal') };
          this.addToast('Stygian Seal wards your soulcraft for 2.5 seconds.');
        }
      }
      this.addLog(result.ability.name + '.');
      this.visualEvents.push({ kind: 'audio', position: { ...this.player.position }, sound: getAbilityStartSound(result.ability) });
    }
  }

  private resolvePlayerAction(action: ActivePlayerAction): void {
    const baseAbility = getAbility(action.abilityId);
    if (!baseAbility) return;
    const ability = getRankedAbility(this.player, action.abilityId) ?? baseAbility;
    const hitIndex = Math.max(0, action.hitIndex ?? 0);
    const counterTargets = ability.requiresCounterWindow ? this.enemies.filter(enemy => enemy.health > 0 && enemy.state === 'ATTACK_WINDUP'
      && Math.hypot(enemy.position.x - this.player.position.x, enemy.position.z - this.player.position.z) <= 3.2) : [];
    if (ability.requiresCounterWindow && this.controllerState.invulnerabilitySeconds <= 0 && counterTargets.length === 0) {
      this.addToast('Grappler’s Counter needs a dodge window or a nearby enemy windup.');
      return;
    }
    if (ability.dashDistance && hitIndex === 0) this.moveForSkill(ability);

    const areaCenter = ability.kind === 'AOE' && !ability.utilityOnly ? this.getAbilityAreaCenter(ability) : null;
    const meleeTargetIds = ability.kind === 'MELEE' ? getMeleeTargetIds(this.world.map, this.player, this.enemies, ability) : [];
    const areaTargetIds = areaCenter && ability.radius !== undefined
      ? getAreaTargetIds(this.world.map, areaCenter.x, areaCenter.z, ability.radius, this.enemies)
      : [];
    const projectileTarget = ability.kind === 'PROJECTILE' ? this.getTargetEnemy() : null;
    const targetIds = ability.kind === 'MELEE' ? meleeTargetIds : ability.kind === 'PROJECTILE' ? projectileTarget ? [projectileTarget.id] : [] : areaTargetIds;

    let passiveMultiplier = action.classPassiveResolved ? action.classPassiveMultiplier ?? 1 : 1;
    const shouldResolvePassive = Boolean(this.player.classPassiveState && !action.classPassiveResolved
      && (ability.element || targetIds.length > 0));
    if (shouldResolvePassive) {
      const targets = targetIds.map(id => this.enemies.find(enemy => enemy.id === id)).filter((enemy): enemy is WorldEnemy => Boolean(enemy));
      const passive = resolveClassPassiveAction(this.player, ability, targets);
      this.player = { ...this.player, classPassiveState: passive.state };
      passiveMultiplier = passive.damageMultiplier;
      this.combat.setClassPassiveResult(passiveMultiplier);
      if (passive.passiveName) this.addLog(passive.passiveName + ' empowers ' + ability.name + '.');
    }

    let damageMultiplier = action.damageMultiplier * passiveMultiplier;
    if (ability.kind === 'PROJECTILE' && hitIndex === 0) {
      const mark = consumeUniqueCharge(this.player, 'artemis_mark');
      if (mark.consumed) {
        this.player = mark.player;
        damageMultiplier *= 1.2;
        this.addToast("Artemis' Mark empowers the next projectile.");
      }
    }
    if (isFireAbility(ability) && hitIndex === 0) {
      const ember = consumeUniqueCharge(this.player, 'promethean_ember');
      if (ember.consumed) {
        this.player = ember.player;
        damageMultiplier *= 1.25;
        this.addToast('Promethean Ember flares through your next fire spell.');
      }
    }
    const hitCount = Math.max(1, action.hitCount ?? ability.activeHitCount ?? 1);
    const perHitMultiplier = ability.damagePerHitMultiplier ?? (hitCount > 1 ? 1 / hitCount : 1);
    damageMultiplier *= perHitMultiplier;
    if (ability.kind === 'PROJECTILE' && (ability.projectileCount ?? 1) > 1) damageMultiplier *= Math.max(0.1, Math.min(1, ability.damagePerProjectileMultiplier ?? 1));
    const damage = ability.damage > 0 ? calculatePlayerDamage(this.player, ability, damageMultiplier, this.random(), action.weaponSlot ?? 'mainHand') : 0;

    if (hitIndex === 0 && ability.selfStatuses?.length) {
      for (const status of ability.selfStatuses) {
        const powered = scaleStatusPower(status, calculateDerivedStats(this.player))!;
        this.player = { ...this.player, statusEffects: applyRealtimeStatus(this.player.statusEffects, powered, ability.id) };
      }
      this.visualEvents.push({ kind: 'area', effectId: abilityVfxEffect(ability.id) ?? 'laurel_light', position: { x: this.player.position.x, y: 0.16, z: this.player.position.z }, color: ability.projectileColor, scale: 0.75, sourceId: ability.id });
    }
    if (hitIndex === 0 && ability.selfEffect?.type === 'HEAL') {
      const maximumHealth = calculateDerivedStats(this.player).maxHealth;
      const requested = Math.max(0, Math.ceil(maximumHealth * (ability.selfEffect.amount ?? 0)));
      const restored = this.applyPlayerHealing(requested, ability.id, true);
      this.visualEvents.push({ kind: 'area', effectId: 'laurel_light', position: { x: this.player.position.x, y: 0.8, z: this.player.position.z }, color: '#8cf2b4', scale: 1.15, sound: 'heal' });
      this.addToast(ability.name + ' restored ' + restored + ' health.');
      return;
    }
    if (hitIndex === 0 && ability.selfEffect?.type === 'GUARD') {
      const effect: StatusApplication = { statusId: 'GUARD', durationSeconds: ability.selfEffect.durationSeconds ?? 2, magnitude: ability.selfEffect.magnitude ?? 0.3 };
      this.player = { ...this.player, statusEffects: applyRealtimeStatus(this.player.statusEffects, effect, ability.id) };
      this.visualEvents.push({ kind: 'area', effectId: 'laurel_light', position: { x: this.player.position.x, y: 0.15, z: this.player.position.z }, color: '#e9cb7a', scale: 1.5, sound: 'shield' });
    }
    if (hitIndex === 0 && ability.cleanseStatuses?.length) {
      const cleanse = cleanseRealtimeStatuses(this.player.statusEffects, ability.cleanseStatuses, 1);
      this.player = { ...this.player, statusEffects: cleanse.statuses };
      this.addToast(cleanse.removed.length ? ability.name + ' removed ' + cleanse.removed[0].toLowerCase() + '.' : 'No eligible status to cleanse.');
      if (cleanse.removed.length) this.visualEvents.push({ kind: 'area', effectId: 'laurel_light', position: { x: this.player.position.x, y: 0.72, z: this.player.position.z }, color: '#d9dfb3', scale: 0.8, sound: 'heal', sourceId: ability.id });
    }
    if (ability.requiresCounterWindow) {
      const counterIds = new Set(counterTargets.map(enemy => enemy.id));
      if (counterIds.size) this.enemies = this.enemies.map(enemy => {
        if (!counterIds.has(enemy.id)) return enemy;
        const profile = getEnemyPoiseProfile(enemy);
        if (profile) {
          const maximum = enemy.maxPoise ?? profile.maximum;
          return applyEnemyPoiseDamage(enemy, maximum / (enemy.isBoss ? profile.bossResistance : 1) + 1).enemy;
        }
        const seconds = enemy.isBoss ? 0.2 : 0.42;
        const effect = { statusId: 'STAGGER' as const, durationSeconds: seconds, magnitude: seconds };
        return { ...enemy, state: 'STAGGER', stateTimer: seconds, activeAttackId: undefined, telegraphPosition: undefined, statusEffects: applyRealtimeStatus(enemy.statusEffects, effect, ability.id) };
      });
    }
    if (ability.utilityOnly) {
      if (ability.selfStatuses?.length || ability.selfEffect?.type === 'GUARD') this.addToast(ability.name + ' is active.');
      if (ability.requiresCounterWindow && counterTargets.length) this.addToast(ability.name + ' interrupts ' + counterTargets.length + (counterTargets.length === 1 ? ' attack.' : ' attacks.'));
      return;
    }
    if (ability.kind === 'MELEE') {
      const result = resolveMeleeAttack(this.world.map, this.player, this.enemies, ability, damage);
      this.enemies = result.enemies;
      this.applyPlayerOnHitEffects(result.hitEnemyIds, ability, damage, action.weaponSlot ?? 'mainHand');
      if (ability.knockbackDistance && result.hitEnemyIds.length) this.knockbackEnemies(result.hitEnemyIds, ability.knockbackDistance);
      if (result.hitEnemyIds.length && !action.classMeleeRecorded) {
        this.player = recordClassMeleeAction(this.player, ability);
        this.combat.markClassMeleeRecorded();
      }
      if (result.hitEnemyIds.length && damageMultiplier >= 1.3) {
        const shockwave = resolveUniqueTrigger(this.player, 'cyclopean_mallet', 'HEAVY_MELEE_HIT', damage);
        if (shockwave.activated) {
          this.player = shockwave.player;
          const center = this.enemies.find(enemy => enemy.id === result.hitEnemyIds[0]);
          if (center) {
            const alreadyHit = new Set(result.hitEnemyIds);
            const candidates = this.enemies.filter(enemy => enemy.health > 0 && !alreadyHit.has(enemy.id));
            const wave = resolveAreaAttack(this.world.map, center.position.x, center.position.z, 1.35, candidates, Math.max(1, Math.round(damage * shockwave.magnitude)));
            const waveById = new Map(wave.enemies.map(enemy => [enemy.id, enemy]));
            this.enemies = this.enemies.map(enemy => waveById.get(enemy.id) ?? enemy);
            this.visualEvents.push({ kind: 'area', effectId: 'stone_shockwave', position: { x: center.position.x, y: 0.1, z: center.position.z }, color: '#d5b27a', scale: 1.35, sourceId: 'cyclopean_mallet' });
            this.addToast('Cyclopean Mallet sends one shockwave through nearby foes.');
          }
        }
      }
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
      if (result.hitEnemyIds.length && hasRealtimeStatus(this.player.statusEffects, 'COUNTER')) {
        this.player = { ...this.player, statusEffects: this.player.statusEffects.filter(status => status.statusId !== 'COUNTER') };
        this.addLog(this.player.classId === 'PALADIN' ? 'Hoplite counter strike.' : 'Counter strike.');
      }
      return;
    }
    if (ability.kind === 'PROJECTILE') {
      const count = boundedProjectileCount(ability);
      if (this.projectiles.length + count > 64) {
        this.addToast('The projectile field is full.');
        return;
      }
      const derived = calculateDerivedStats(this.player);
      const speed = (ability.projectileSpeed ?? 10) * derived.projectileSpeedMultiplier;
      const fan = count > 1 ? Math.max(0, Math.min(0.55, ability.projectileSpreadRadians ?? 0)) : 0;
      const lateral = this.player.equipment.mainHand?.visualType === 'bow' ? 0 : 0.2;
      for (let index = 0; index < count; index += 1) {
        const offset = count === 1 ? 0 : -fan + 2 * fan * index / (count - 1);
        const direction = projectileDirection(this.player.rotation.yaw + offset, this.player.rotation.pitch);
        const originX = this.player.position.x + direction.x * 0.42 - Math.sin(this.player.rotation.yaw) * lateral;
        const originZ = this.player.position.z + direction.z * 0.42 + Math.cos(this.player.rotation.yaw) * lateral;
        this.projectiles.push({
          id: this.nextProjectileId++,
          position: { x: originX, y: 1.28 + direction.y * 0.12, z: originZ },
          velocity: { x: direction.x * speed, y: direction.y * speed, z: direction.z * speed },
          radius: ability.projectileRadius ?? 0.13,
          damage,
          remainingSeconds: ability.range / Math.max(1, speed),
          sourceAbilityId: ability.id,
          color: ability.projectileColor ?? '#8bddff',
          faction: 'PLAYER',
          statusEffect: scaleStatusPower(ability.onHitStatus, derived),
          pierceRemaining: Math.min(MAX_PROJECTILE_PIERCE, Math.max(0, Math.floor(ability.pierceCount ?? 0))),
          hitEnemyIds: [],
        });
        this.visualEvents.push({ kind: 'cast', effectId: abilityVfxEffect(ability.id, ability.onHitStatus?.statusId) ?? (ability.manaCost > 0 ? 'chthonic_bolt' : 'oracle_spark'), position: { x: originX, y: 1.25, z: originZ }, direction: { x: direction.x, z: direction.z }, color: ability.projectileColor, scale: count > 1 ? 0.43 : 0.55, sourceId: ability.id });
      }
      return;
    }
    const center = areaCenter ?? this.getAbilityAreaCenter(ability);
    const radius = ability.radius ?? 1.6;
    const result = resolveAreaAttack(this.world.map, center.x, center.z, radius, this.enemies, damage, ability.statusDamageBonus);
    this.enemies = result.enemies;
    this.applyPlayerOnHitEffects(result.hitEnemyIds, ability, damage, action.weaponSlot ?? 'mainHand');
    let chainedHitCount = 0;
    if (ability.chain && result.hitEnemyIds.length) {
      const chain = resolveChainAttack(this.world.map, this.enemies, result.hitEnemyIds, ability.chain.maxJumps, ability.chain.jumpRange, Math.max(1, Math.round(damage * ability.chain.damageMultiplier)));
      this.enemies = chain.enemies;
      chainedHitCount = chain.hitEnemyIds.length;
      this.applyPlayerOnHitEffects(chain.hitEnemyIds, ability, Math.max(1, Math.round(damage * ability.chain.damageMultiplier)), action.weaponSlot ?? 'mainHand');
      for (const link of chain.links) {
        const from = this.enemies.find(enemy => enemy.id === link.fromId);
        const to = this.enemies.find(enemy => enemy.id === link.toId);
        if (!from || !to) continue;
        const distance = Math.max(0.001, Math.hypot(to.position.x - from.position.x, to.position.z - from.position.z));
        this.visualEvents.push({ kind: 'cast', effectId: 'oracle_spark', position: { x: to.position.x, y: 0.72, z: to.position.z }, direction: { x: (to.position.x - from.position.x) / distance, z: (to.position.z - from.position.z) / distance }, color: ability.projectileColor, scale: 0.5, sound: 'cast', sourceId: ability.id, ownerId: to.id });
      }
    }
    const effectId = statusVfxEffect(ability.onHitStatus?.statusId) ?? (ability.targeting === 'SELF' ? 'stone_shockwave' : 'bronze_impact');
    this.visualEvents.push({ kind: 'area', effectId: abilityVfxEffect(ability.id, ability.onHitStatus?.statusId) ?? effectId, position: { x: center.x, y: 0.12, z: center.z }, color: ability.projectileColor ?? '#ffb65b', scale: radius, sound: ability.onHitStatus?.statusId === 'BURN' ? 'cast' : undefined, sourceId: ability.id });
    const totalHits = result.hitEnemyIds.length + chainedHitCount;
    this.addToast(ability.name + (totalHits ? ' hit ' + totalHits + (totalHits === 1 ? ' foe.' : ' foes.') : '.'));
  }

  private moveForSkill(ability: NonNullable<ReturnType<typeof getAbility>>): void {
    const distance = Math.max(0, Math.min(2.5, ability.dashDistance ?? 0));
    if (distance <= 0) return;
    const moved = moveWithEntitySlide(this.world.map, this.player.position.x, this.player.position.z,
      Math.cos(this.player.rotation.yaw) * distance, Math.sin(this.player.rotation.yaw) * distance,
      this.enemies.filter(enemy => enemy.health > 0).map(enemy => ({ position: enemy.position, radius: enemy.collisionRadius ?? 0.3 })), 0.18);
    const actualDistance = Math.hypot(moved.x - this.player.position.x, moved.y - this.player.position.z);
    if (actualDistance <= 0.01) { this.addToast('The path is blocked.'); return; }
    this.player = { ...this.player, position: { ...this.player.position, x: moved.x, z: moved.y } };
    const veil = ability.element === 'ARCANE';
    this.visualEvents.push({ kind: veil ? 'cast' : 'dodge', effectId: veil ? 'oracle_spark' : 'bronze_slash', position: { x: moved.x, y: 0.28, z: moved.y }, direction: { x: Math.cos(this.player.rotation.yaw), z: Math.sin(this.player.rotation.yaw) }, color: ability.projectileColor, scale: 0.7, sound: veil ? 'cast' : 'dodge', sourceId: ability.id });
  }

  private getAbilityAreaCenter(ability: NonNullable<ReturnType<typeof getAbility>>): { x: number; z: number } {
    let x = this.player.position.x, z = this.player.position.z;
    if (ability.targeting === 'SELF') return { x, z };
    const dx = Math.cos(this.player.rotation.yaw), dz = Math.sin(this.player.rotation.yaw);
    const wall = raycastGrid(this.world.map, x, z, dx, dz, ability.range);
    const maximumDistance = wall ? Math.max(0.35, wall.distance - 0.22) : ability.range;
    let aimedDistance = Infinity;
    const alignmentTolerance = Math.max(0.28, Math.min(0.72, (ability.radius ?? 1.2) * 0.32));
    for (const enemy of this.enemies) {
      if (enemy.health <= 0 || enemy.state === 'DEAD') continue;
      const ex = enemy.position.x - x, ez = enemy.position.z - z;
      const along = ex * dx + ez * dz;
      const across = Math.abs(ex * dz - ez * dx);
      if (along <= 0.25 || along > maximumDistance || along >= aimedDistance || across > alignmentTolerance) continue;
      if (!hasLineOfSight(this.world.map, x, z, enemy.position.x, enemy.position.z, 0.15)) continue;
      aimedDistance = along;
    }
    const distance = Number.isFinite(aimedDistance) ? aimedDistance : maximumDistance;
    x += dx * distance;
    z += dz * distance;
    return { x, z };
  }

  private knockbackEnemies(enemyIds: readonly string[], requestedDistance: number): void {
    const ids = new Set(enemyIds);
    const distance = Math.max(0, Math.min(1.5, requestedDistance));
    this.enemies = this.enemies.map(enemy => {
      if (!ids.has(enemy.id) || enemy.health <= 0 || enemy.isBoss || distance <= 0) return enemy;
      let dx = enemy.position.x - this.player.position.x;
      let dz = enemy.position.z - this.player.position.z;
      const length = Math.hypot(dx, dz);
      if (length < 0.001) { dx = Math.cos(this.player.rotation.yaw); dz = Math.sin(this.player.rotation.yaw); }
      else { dx /= length; dz /= length; }
      const others = this.enemies.filter(candidate => candidate.id !== enemy.id && candidate.health > 0)
        .map(candidate => ({ position: candidate.position, radius: candidate.collisionRadius ?? 0.3 }));
      const moved = moveWithEntitySlide(this.world.map, enemy.position.x, enemy.position.z, dx * distance, dz * distance, others, enemy.collisionRadius ?? 0.28);
      return { ...enemy, position: { ...enemy.position, x: moved.x, z: moved.y } };
    });
  }

  private applyPlayerOnHitEffects(enemyIds: readonly string[], ability: NonNullable<ReturnType<typeof getAbility>>, hitDamage = ability.damage, weaponSlot: Extract<EquipmentSlot, 'mainHand' | 'offHand'> = 'mainHand'): void {
    const status = ability.onHitStatus ?? (ability.staggerSeconds ? { statusId: 'STAGGER' as const, durationSeconds: ability.staggerSeconds, magnitude: ability.staggerSeconds } : undefined);
    if (!enemyIds.length) return;
    const derived = calculateDerivedStats(this.player);
    if (derived.lifeOnHit > 0) {
      const restored = derived.lifeOnHit * enemyIds.length;
      this.applyPlayerHealing(restored, 'LIFE_ON_HIT');
    }
    const aimedTargetId = ability.kind === 'PROJECTILE' ? this.getTargetEnemy()?.id : undefined;
    if (aimedTargetId && enemyIds.includes(aimedTargetId) && ability.id.startsWith('ranger_')) this.player = recordMarkedPreyHit(this.player, aimedTargetId);
    const hitIds = new Set(enemyIds);
    const poiseDamage = abilityPoiseDamage(ability, this.player, weaponSlot);
    const broken: WorldEnemy[] = [];
    this.enemies = this.enemies.map(enemy => {
      if (!hitIds.has(enemy.id) || enemy.health <= 0) return enemy;
      const pilot = Boolean(getEnemyPoiseProfile(enemy));
      const statusPoiseDamage = status?.statusId === 'STAGGER' ? Math.max(8, status.magnitude * 36) : 0;
      const poise = pilot ? applyEnemyPoiseDamage(enemy, Math.max(poiseDamage, statusPoiseDamage)) : null;
      if (poise?.broken) broken.push(poise.enemy);
      let statuses = enemy.statusEffects ?? [];
      if (status && !(pilot && status.statusId === 'STAGGER')) {
        const powered = this.applyUniqueStatusPower(status, derived);
        const tuned = enemy.isBoss && status.statusId === 'STAGGER'
          ? { ...powered, durationSeconds: powered.durationSeconds * 0.62, magnitude: powered.magnitude * 0.62 }
          : enemy.isBoss && status.statusId === 'CURSE'
            ? { ...powered, durationSeconds: powered.durationSeconds * 0.5, magnitude: powered.magnitude * 0.5 }
            : powered;
        statuses = applyRealtimeStatus(statuses, tuned, ability.id);
      }
      const proc = rollItemStatusProc(derived, this.random);
      if (proc) {
        const magnitude = Math.max(1, Math.round(Math.max(1, hitDamage * 0.12) * proc.powerMultiplier));
        const powered = this.applyUniqueStatusPower({ statusId: proc.statusId, durationSeconds: proc.durationSeconds, magnitude }, derived);
        statuses = applyRealtimeStatus(statuses, powered, 'item_affix');
      }
      return { ...(poise?.enemy ?? enemy), statusEffects: statuses };
    });
    for (const enemy of broken) {
      this.visualEvents.push({ kind: 'impact', effectId: 'stone_shockwave', position: { x: enemy.position.x, y: 0.28, z: enemy.position.z }, color: '#f0d27c', scale: 0.72, sound: 'bronzeImpact', surface: 'metal', sourceId: 'poise_break', ownerId: enemy.id, priority: enemy.isBoss ? 'critical_hit' : 'ordinary_hit' });
      this.addLog(enemy.name + ' is staggered.');
    }
  }

  private applyPlayerHealing(amount: number, source: string, triggerLaurel = false): number {
    const maximum = calculateDerivedStats(this.player).maxHealth;
    const previous = this.player.stats.hp;
    const next = Math.max(0, Math.min(maximum, previous + Math.max(0, Number.isFinite(amount) ? amount : 0)));
    const restored = next - previous;
    this.player = { ...this.player, stats: { ...this.player.stats, hp: next } };
    this.player = recordClassHealing(this.player, previous, next, maximum);
    if (restored > 0 && triggerLaurel && source === 'cleric_restoration') {
      const laurel = resolveUniqueTrigger(this.player, 'laurel_asclepius', 'SELF_HEAL', restored);
      if (laurel.activated) {
        this.player = { ...laurel.player, statusEffects: applyRealtimeStatus(laurel.player.statusEffects, { statusId: 'GUARD', durationSeconds: 3, magnitude: laurel.magnitude }, 'laurel_asclepius') };
        this.addToast('Laurel of Asclepius wards you for 3 seconds.');
      }
    }
    return restored;
  }

  private applyUniqueStatusPower(status: StatusApplication, derived: DerivedCharacterStats): StatusApplication {
    let powered = scaleStatusPower(status, derived)!;
    if (status.statusId === 'POISON') {
      const fang = resolveUniqueTrigger(this.player, 'serpent_queen_fang', 'POISON_APPLIED', powered.magnitude);
      if (fang.activated) {
        this.player = fang.player;
        powered = { ...powered, magnitude: Math.max(1, Math.round(powered.magnitude * fang.magnitude)) };
        this.addToast("Serpent Queen's Fang deepens the poison.");
      }
    } else if (status.statusId === 'BURN') {
      const ember = resolveUniqueTrigger(this.player, 'promethean_ember', 'BURN_APPLIED', powered.magnitude);
      if (ember.activated) {
        this.player = ember.player;
        this.addToast('Promethean Ember stores one fire charge.');
      }
    }
    return powered;
  }

  private processProjectileImpacts(impacts: ProjectileImpact[]): void {
    for (const impact of impacts) {
      if (!isVisibleProjectileImpact(impact)) continue;
      const owner = impact.playerHit ? this.enemies.find(enemy => enemy.id === impact.ownerEnemyId) : undefined;
      const enemyAttack = owner ? getEnemyAttackDefinition(owner.attackSetId, impact.abilityId, owner.phase ?? 1) : undefined;
      const parried = Boolean(impact.playerHit && owner && enemyAttack
        && isEnemyAttackParryable(owner.attackSetId, impact.abilityId, owner.phase ?? 1)
        && this.tryResolveShieldParry(owner, enemyAttack));
      if (parried) continue;
      const dodged = Boolean(impact.playerHit && this.controllerState.invulnerabilitySeconds > 0);
      const blocked = Boolean(impact.playerHit && owner && this.controllerState.guarding && this.isFacingAttacker(owner));
      if (impact.playerHit) {
        if (dodged) { this.addToast('Attack dodged.'); this.consumePerfectDodgeCounter(); continue; }
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
        if (damage > 0) this.setViewmodelEvent('HIT_RECOIL', 0.2);
        if (blocked) { this.resolveUniqueBlock(owner, damage); this.recordClassPassiveBlock(); }
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
        const ability = getRankedAbility(this.player, impact.abilityId) ?? getAbility(impact.abilityId);
        if (ability) {
          this.applyPlayerOnHitEffects([impact.enemyId], ability, impact.damage ?? calculatePlayerDamage(this.player, ability));
          if (ability.kind === 'PROJECTILE') {
            const mark = resolveUniqueTrigger(this.player, 'artemis_mark', 'PROJECTILE_HIT');
            if (mark.activated) { this.player = mark.player; this.addToast("Artemis' Mark sights the next projectile."); }
          }
        }
        const healing = (ability?.healOnHit ?? 0);
        if (healing) this.applyPlayerHealing(healing, ability?.id ?? 'PROJECTILE_HIT');
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
    const attackOrigin = { ...enemy.position };
    const attackYaw = enemy.facingYaw ?? Math.atan2(this.player.position.z - enemy.position.z, this.player.position.x - enemy.position.x);
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
    const lineOrigin = attack.shape === 'SIGIL' ? target : attackOrigin;
    const hasSight = hasLineOfSight(this.world.map, lineOrigin.x, lineOrigin.z, this.player.position.x, this.player.position.z, 0.15);
    const inShape = enemyAttackContainsPoint(attack, attackOrigin, attackYaw, this.player.position, target);
    if (!hasSight || !inShape) return;
    if (this.tryResolveShieldParry(enemy, attack)) return;
    if (this.controllerState.invulnerabilitySeconds > 0) {
      this.visualEvents.push({ kind: 'dodge', position: { x: this.player.position.x, y: 0.35, z: this.player.position.z }, color: '#a2e8ff', scale: 1, sound: 'dodge' });
      this.addToast('Attack dodged.');
      this.consumePerfectDodgeCounter();
      return;
    }
    const blocked = this.controllerState.guarding && this.isFacingAttacker(enemy);
    const damage = attack.damageMultiplier > 0 ? Math.max(1, Math.round(calculateIncomingDamage(enemy, this.player, blocked) * attack.damageMultiplier)) : 0;
    if (damage > 0) {
      this.player = { ...this.player, stats: { ...this.player.stats, hp: Math.max(0, this.player.stats.hp - damage) } };
      this.setViewmodelEvent('HIT_RECOIL', 0.2);
    }
    if (blocked && damage > 0) { this.resolveUniqueBlock(enemy, damage); this.recordClassPassiveBlock(); }
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

  private tryResolveShieldParry(enemy: WorldEnemy, attack: NonNullable<ReturnType<typeof getEnemyAttackDefinition>>): boolean {
    if (attack.parryable !== true || !isShieldItem(this.player.equipment.offHand)
      || this.controllerState.parryWindowSeconds <= 0 || !this.isFacingAttacker(enemy)) return false;
    this.controllerState = { ...this.controllerState, parryWindowSeconds: 0, guarding: false };
    const derived = calculateDerivedStats(this.player);
    const oathBonus = enemy.attackCooldownMultiplier !== undefined && enemy.attackCooldownMultiplier < 1 ? 5 : 0;
    this.player = { ...this.player, stats: {
      ...this.player.stats,
      stamina: Math.min(derived.maxStamina, (this.player.stats.stamina ?? derived.maxStamina) + 6 + oathBonus),
      staminaRegenDelaySeconds: 0.35,
    } };
    const poiseDamage = (enemy.maxPoise ?? getEnemyPoiseProfile(enemy)?.maximum ?? 40) * (enemy.isBoss ? 0.3 : 0.36) + (oathBonus ? 8 : 0);
    let result: WorldEnemy | undefined;
    this.enemies = this.enemies.map(candidate => {
      if (candidate.id !== enemy.id || !getEnemyPoiseProfile(candidate)) return candidate;
      const applied = applyEnemyPoiseDamage(candidate, poiseDamage);
      result = applied.enemy;
      return applied.enemy;
    });
    this.visualEvents.push({ kind: 'impact', effectId: 'shield_impact', position: { x: this.player.position.x, y: 0.82, z: this.player.position.z }, color: '#70d7c6', scale: 0.95, sound: 'shield', surface: 'metal', sourceId: attack.id, ownerId: enemy.id, priority: enemy.isBoss ? 'critical_hit' : 'ordinary_hit' });
    if (result?.state === 'STAGGER') this.addToast('Perfect parry. ' + enemy.name + ' is staggered.');
    else this.addToast('Parried ' + attack.name + '.');
    this.addLog('Parry: ' + attack.name + '.');
    return true;
  }

  private resolveUniqueBlock(attacker: WorldEnemy, blockedDamage: number): void {
    const counter = resolveUniqueTrigger(this.player, 'aspis_bronze_gate', 'BLOCK_SUCCESS', blockedDamage);
    if (!counter.activated) return;
    this.player = counter.player;
    let countered = false;
    this.enemies = this.enemies.map(enemy => {
      if (enemy.id !== attacker.id || enemy.health <= 0 || countered) return enemy;
      countered = true;
      const health = Math.max(0, enemy.health - counter.magnitude);
      return { ...enemy, health, state: health <= 0 ? 'DEAD' : 'HURT', stateTimer: health <= 0 ? 1.1 : 0.18 };
    });
    if (!countered) return;
    this.visualEvents.push({ kind: 'impact', effectId: 'aspis_impact', position: { x: attacker.position.x, y: 0.75, z: attacker.position.z }, color: '#ffd675', scale: 0.72, sound: 'shield', sourceId: 'aspis_bronze_gate', ownerId: attacker.id, priority: 'critical_hit' });
    this.addLog('Aspis of the Bronze Gate counters for ' + counter.magnitude + '.');
    this.addToast('Bronze Gate countershock · ' + counter.magnitude + ' damage.');
  }

  private recordClassPassiveBlock(): void {
    const result = recordClassBlock(this.player);
    this.player = result.player;
    if (!result.activated) return;
    this.addLog('Unbroken Line opens a counter window.');
    this.addToast('Unbroken Line · next melee strike gains 18% damage.');
    this.visualEvents.push({ kind: 'impact', effectId: 'aspis_impact', position: { x: this.player.position.x, y: 0.75, z: this.player.position.z }, color: '#f0d17f', scale: 0.62, sound: 'shield', sourceId: 'unbroken_line' });
  }

  private consumePerfectDodgeCounter(): void {
    if (this.controllerState.perfectDodgeWindowSeconds <= 0) return;
    this.controllerState = { ...this.controllerState, perfectDodgeWindowSeconds: 0 };
    this.player = { ...this.player, statusEffects: applyRealtimeStatus(this.player.statusEffects, { statusId: 'COUNTER', durationSeconds: STAMINA_RULES.perfectDodgeCounterSeconds, magnitude: STAMINA_RULES.perfectDodgeCounterMagnitude }, 'perfect_dodge') };
    this.visualEvents.push({ kind: 'impact', effectId: 'laurel_light', position: { x: this.player.position.x, y: 0.75, z: this.player.position.z }, color: '#edc875', scale: 0.7 });
    this.addToast('Perfect dodge — next melee strike gains 18% damage.');
  }

  private processEnemyRewards(): void {
    let changed = false;
    let dropCount = 0;
    let guardianDefeated = false;
    this.enemies = this.enemies.map(enemy => {
      if (enemy.health > 0) {
        if (enemy.definitionId === 'guardian_threadbound_warden' && (enemy.phase ?? 1) < 2 && !enemy.phaseTransitioned && enemy.health <= enemy.maxHealth * 0.5) {
          this.visualEvents.push({ kind: 'bossPhase', effectId: 'guardian_sigil', position: { x: enemy.position.x, y: 0.06, z: enemy.position.z }, color: '#d34e4e', scale: 1.4, sound: 'bossPhase', sourceId: 'warden_phase_two', ownerId: enemy.id, priority: 'critical_hit' });
          this.addLog('The Threadbound Warden breaks its first seal. Red sigils spread through the chamber.');
          this.addToast('Threadbound Warden · Phase II');
          return { ...enemy, phase: 2, phaseTransitioned: true, activeAttackId: undefined, telegraphPosition: undefined, state: 'RECOVER', stateTimer: 0.72, attackCooldown: 0.55, phaseTransitionLockSeconds: 0.72, poise: enemy.maxPoise ?? enemy.poise, poiseBreakRecoverySeconds: 0, staggerImmunitySeconds: Math.max(enemy.staggerImmunitySeconds ?? 0, 0.85) };
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
      this.player = recordClassKill(this.player);
      const experience = grantExperience(this.player, enemy.xpReward);
      this.player = experience.player;
      if (experience.levelsGained) {
        this.levelUpOpen = (this.player.skillPoints ?? 0) > 0;
        this.addToast(this.levelUpOpen ? 'Level ' + this.player.stats.level + ' reached. Choose a class skill upgrade.' : 'Level ' + this.player.stats.level + ' reached. Your core stats improved.');
        this.visualEvents.push({ kind: 'audio', position: { ...this.player.position }, sound: 'levelUp' });
      }
      const derived = calculateDerivedStats(this.player);
      if (derived.lifeOnKill > 0) this.applyPlayerHealing(derived.lifeOnKill, 'LIFE_ON_KILL');
      const rewardRandom = seededLootRandom(this.world.seed, enemy.id);
      const item = enemy.lawRewardBaseId
        ? createLootInstance(enemy.lawRewardBaseId, 'law_reward_' + enemy.id, this.world.level, enemy.lawId === 'hall_of_echoes' || enemy.lawId === 'pillars_of_daedalus' ? 'RARE' : 'COMMON', rewardRandom)
        : rollEnemyDrop(enemy, this.world.level, rewardRandom);
      if (item) {
        this.loot = [...this.loot, { id: item.instanceId, position: { x: enemy.position.x, y: 0, z: enemy.position.z }, item }];
        dropCount += 1;
      }
      this.visualEvents.push({ kind: 'enemyDeath', effectId: enemy.isBoss ? 'guardian_death' : 'blood_hit', position: { x: enemy.position.x, y: 0.4, z: enemy.position.z }, color: '#f4bc72', scale: enemy.isBoss ? 1.35 : 0.85, sound: enemy.isBoss ? 'bossDeath' : undefined, sourceId: 'enemy_death_reward', ownerId: enemy.id, priority: enemy.isBoss ? 'critical_hit' : 'ordinary_hit' });
      this.addLog(enemy.name + ' defeated. +' + enemy.xpReward + ' XP.');
      if (enemy.definitionId === this.world.floor.guardianId) {
        guardianDefeated = true;
        const threadProgress = this.world.floor.threadProgress ?? createAriadneThreadProgress(this.world.floor.threadJunctions ?? []);
        const earnedThreadCharge = threadProgress.charges < threadProgress.maxCharges;
        this.world = { ...this.world, floor: {
          ...this.world.floor,
          guardianState: 'DESCENT_UNLOCKED',
          threadProgress: awardThreadCharge(threadProgress, this.world.floor.threadJunctions ?? []),
        } };
        if (earnedThreadCharge) this.addLog('The Guardian leaves one Thread Charge behind.');
      }
      if (enemy.roomId && !this.enemies.some(other => other.id !== enemy.id && other.roomId === enemy.roomId && other.health > 0)) {
        this.world = { ...this.world, floor: { ...this.world.floor, rooms: this.world.floor.rooms.map(room => room.id === enemy.roomId ? { ...room, resolved: true, visited: true, discovered: true } : room) } };
      }
      return rewarded;
    });
    if (guardianDefeated) {
      this.ensureGuardianDraft();
      this.persistRun();
      this.addToast('The Guardian falls. Descent unlocked; the rest of the floor remains open.');
    }
    else if (dropCount > 0) this.addToast(formatLootDropToast(dropCount));
    else if (changed) this.addToast('Enemy defeated.');
  }

  private tickCombatStatuses(deltaSeconds: number): void {
    if (this.player.statusEffects.length) {
      const tick = tickRealtimeStatuses(this.player.statusEffects, deltaSeconds);
      const maxHealth = calculateDerivedStats(this.player).maxHealth;
      const healthAfterDamage = Math.max(0, Math.min(maxHealth, this.player.stats.hp - tick.damage));
      this.player = { ...this.player, stats: { ...this.player.stats, hp: healthAfterDamage }, statusEffects: tick.statuses };
      if (tick.healing > 0 && healthAfterDamage > 0) this.applyPlayerHealing(tick.healing, 'REGEN');
      if (tick.ticks.length) this.visualEvents.push({ kind: 'impact', effectId: tick.ticks.some(effect => effect.statusId === 'BLEED') ? 'blood_hit' : tick.ticks.some(effect => effect.statusId === 'POISON') ? 'poison_splash' : 'fire_burst', position: { x: this.player.position.x, y: 0.8, z: this.player.position.z }, color: '#a8c65a', scale: 0.48 });
    }
    this.enemies = this.enemies.map(enemy => {
      if (enemy.health <= 0 || !enemy.statusEffects?.length) return enemy;
      const tick = tickRealtimeStatuses(enemy.statusEffects, deltaSeconds);
      if (tick.damage <= 0) return { ...enemy, statusEffects: tick.statuses };
      const health = applyEnemyDamage(enemy, tick.damage).enemy.health;
      return { ...enemy, health, statusEffects: tick.statuses, state: health <= 0 ? 'DEAD' : enemy.state === 'ATTACK_WINDUP' ? 'HURT' : enemy.state, stateTimer: health <= 0 ? 1.1 : enemy.state === 'ATTACK_WINDUP' ? 0.18 : enemy.stateTimer };
    });
  }

  interact(): void {
    const drop = this.getLookedAtLoot();
    if (drop) {
      const stored = addInventoryItem(this.player, drop.item);
      if (!stored.stored) { this.addToast('This item could not be stored safely. The world drop remains.'); return; }
      this.player = stored.player;
      this.loot = this.loot.filter(item => item.id !== drop.id);
      this.visualEvents.push({ kind: 'pickup', position: { ...drop.position, y: 0.35 }, color: '#ffd36d', scale: 0.85, sound: 'pickup' });
      const inOverflow = stored.overflowIds.includes(drop.item.instanceId);
      this.addToast(inOverflow ? drop.item.name + ' collected to overflow storage.' : drop.item.name + ' collected.');
      this.addLog((inOverflow ? 'Stored in overflow: ' : 'Collected ') + drop.item.name + '.');
      return;
    }
    const target = findLookTarget(this.world, this.player);
    if (!target) { this.addToast('Nothing to interact with.'); return; }
    if (target.kind === 'THREAD_ANCHOR') { this.openThreadAnchor(target.junctionId); return; }
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
      const progress = this.world.floor.lawProgress ?? createEmptyMazeLawProgress();
      if (!progress.draft?.selectedLawId) {
        this.world = { ...this.world, floor: { ...this.world.floor, lawProgress: openLawDraft(progress, this.world.floor.seed, this.world.floor.guardianId ?? getFloorGuardianDefinition(this.world.level).id, this.world.level) } };
        this.cancelHeldActions();
        this.persistRun();
        return;
      }
      this.advanceFloor();
      return;
    }
    if (target.kind === 'ROOM') {
      this.discoverRoom(target.room.id);
      const room = this.world.floor.rooms.find(candidate => candidate.id === target.room.id) ?? target.room;
      const offer = createRoomOffer(room);
      if (offer) { this.roomOffer = offer; this.cancelHeldActions(); return; }
      if (room.type === 'COMBAT' || room.type === 'ELITE') {
        if (this.enemies.some(enemy => enemy.roomId === room.id && enemy.health > 0)) this.addToast('Defeat the enemies in this chamber.');
        else this.addToast('This chamber is clear.');
        return;
      }
    }
  }

  openThreadAnchor(junctionId: string): boolean {
    if (this.combat.action || this.chargeStartedAt !== null || this.controllerState.guarding) {
      this.addToast('Finish your active action before opening the Thread Anchor.');
      return false;
    }
    const progress = this.world.floor.threadProgress;
    const nextProgress = progress && markThreadAnchorOpen(progress, junctionId);
    if (!nextProgress) { this.addToast('This Thread Anchor is unavailable.'); return false; }
    this.world = { ...this.world, floor: { ...this.world.floor, threadProgress: nextProgress } };
    this.cancelHeldActions();
    this.rebuildThreadOffer(junctionId);
    if (!this.threadOffer) {
      this.world = { ...this.world, floor: { ...this.world.floor, threadProgress: clearOpenThreadAnchor(nextProgress) } };
      this.addToast('This Thread Anchor has no valid prepared routes.');
      return false;
    }
    this.persistRun();
    return true;
  }

  closeThreadAnchor(): void {
    const progress = this.world.floor.threadProgress;
    if (progress?.openJunctionId) {
      this.world = { ...this.world, floor: { ...this.world.floor, threadProgress: clearOpenThreadAnchor(progress) } };
      this.persistRun();
    }
    this.threadOffer = null;
    this.cancelHeldActions();
  }

  chooseThreadRoute(action: AriadneThreadAction): boolean {
    const offer = this.threadOffer;
    if (!offer) return false;
    const choice = offer.choices.find(candidate => candidate.action === action);
    if (!choice) return false;
    if (!choice.enabled) { this.addToast(choice.disabledReason ?? 'That route cannot be woven now.'); return false; }
    const plan = planAriadneThreadEdit(this.threadEditContext(offer.junctionId, action));
    if (!plan.ok || !plan.map || !plan.progress || !plan.route || !plan.junction) {
      this.addToast(plan.reason ?? 'The route changed before the weave could settle.');
      this.rebuildThreadOffer(offer.junctionId);
      return false;
    }

    const maxHealth = calculateDerivedStats(this.player).maxHealth;
    this.player = { ...this.player, stats: { ...this.player.stats, hp: Math.max(1, Math.min(maxHealth, this.player.stats.hp - (plan.healthCost ?? 0))) } };
    this.world = {
      ...this.world,
      map: plan.map,
      decorations: plan.decorations ?? this.world.decorations,
      worldRevision: this.world.worldRevision + 1,
      floor: { ...this.world.floor, threadProgress: plan.progress },
    };
    this.recordChronicleEvent({ kind: 'THREAD_WOVEN', floor: this.world.level, junctionId: plan.junction.id, routeId: plan.route.id, action,
      chargeCost: plan.chargeCost ?? choice.cost, healthCost: plan.healthCost ?? choice.healthCost });
    this.enemies = this.enemies.map(enemy => ({ ...enemy, pathStep: undefined, pathTargetCell: undefined, pathRefreshSeconds: 0 }));
    this.threadOffer = null;
    this.cancelHeldActions();
    const actionName = action === 'REVEAL_PASSAGE' ? 'revealed' : 'sealed';
    const threadDirection = plan.route.direction === 'NORTH' ? { x: 0, z: -1 }
      : plan.route.direction === 'SOUTH' ? { x: 0, z: 1 }
        : plan.route.direction === 'EAST' ? { x: 1, z: 0 } : { x: -1, z: 0 };
    this.visualEvents.push({ kind: 'impact', effectId: 'ariadne_thread', position: { x: plan.junction.anchorPosition.x + 0.5, y: 0.58, z: plan.junction.anchorPosition.y + 0.5 }, color: '#60d8ce', direction: threadDirection, scale: 0.9, sourceId: 'ariadnes_thread_weave' });
    this.addToast('Thread passage ' + actionName + ' to the ' + plan.route.direction.toLowerCase() + '.');
    this.addLog('Ariadne’s Thread ' + actionName + ' a prepared passage.');
    this.persistRun();
    return true;
  }

  private threadEditContext(junctionId: string, action: AriadneThreadAction): ThreadEditContext {
    return {
      map: this.world.map,
      decorations: this.world.decorations,
      floor: this.world.floor,
      junctionId,
      action,
      lawIds: this.world.floor.lawProgress?.activeLaws.map(law => law.lawId) ?? [],
      player: { x: this.player.position.x, z: this.player.position.z, health: this.player.stats.hp, maxHealth: calculateDerivedStats(this.player).maxHealth },
      enemies: this.enemies.map(enemy => ({ x: enemy.position.x, z: enemy.position.z, health: enemy.health })),
      projectiles: this.projectiles.map(projectile => ({ x: projectile.position.x, z: projectile.position.z })),
      loot: this.loot.map(drop => ({ x: drop.position.x, z: drop.position.z })),
      playerActionActive: Boolean(this.combat.action || this.chargeStartedAt !== null || this.controllerState.guarding),
    };
  }

  private rebuildThreadOffer(junctionId: string): void {
    this.threadOffer = buildThreadAnchorOffer(this.threadEditContext(junctionId, 'REVEAL_PASSAGE'));
  }

  private attemptGate(x: number, z: number, room: DungeonRoom | undefined, isSecret: boolean): void {
    const useKey = !isSecret && this.world.floor.keys > 0;
    const brokenThread = isSecret && room?.lawId === 'broken_thread';
    if (brokenThread && room?.attempted) { this.addToast('The fractured seam has already resisted your search.'); return; }
    if (!useKey && !isSecret && room?.attempted) {
      this.addToast('The lock has already resisted. Find Ariadne’s Token.');
      return;
    }
    const derived = calculateDerivedStats(this.player);
    const stat = isSecret ? derived.dexterity : derived.strength;
    const success = useKey || this.rollCheck(stat, brokenThread ? 19 : isSecret ? 15 : 12 + Math.floor(this.world.level / 2));
    if (!success) {
      if (!isSecret) this.player = { ...this.player, stats: { ...this.player.stats, hp: Math.max(1, this.player.stats.hp - 3) } };
      if (brokenThread) this.player = { ...this.player, stats: { ...this.player.stats, hp: Math.max(1, this.player.stats.hp - Math.ceil(this.player.stats.maxHp * 0.1)) } };
      if ((!isSecret || brokenThread) && room) this.world = { ...this.world, floor: { ...this.world.floor, rooms: this.world.floor.rooms.map(candidate => candidate.id === room.id ? { ...candidate, attempted: true } : candidate) } };
      this.persistRun();
      this.addToast(brokenThread ? 'The fractured seam closes. The failed search costs health.' : isSecret ? 'The seam stays hidden.' : 'The lock holds. The strain costs 3 health.');
      return;
    }
    const map = this.world.map.map(row => [...row]);
    map[z][x] = 0;
    this.world = {
      ...this.world,
      map,
      worldRevision: this.world.worldRevision + 1,
      floor: { ...this.world.floor, keys: useKey ? this.world.floor.keys - 1 : this.world.floor.keys, rooms: this.world.floor.rooms.map(candidate => candidate.id === room?.id ? { ...candidate, discovered: true, unlocked: true, visited: true, ...(brokenThread ? { attempted: true } : {}) } : candidate) },
    };
    if (room) this.discoverRoom(room.id);
    this.persistRun();
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
      this.player = { ...this.player, stats: { ...this.player.stats, hp: Math.max(1, hp - Math.ceil(maxHp * 0.2)) } };
      const reward = createLootInstance('ares_votive', 'shrine_' + room.id, this.world.level, 'RARE', seededLootRandom(this.world.seed, 'shrine_' + room.id));
      const stored = addInventoryItem(this.player, reward);
      this.player = stored.player;
      if (!stored.stored) this.loot = [...this.loot, { id: reward.instanceId, position: { x: room.anchor.x + 0.72, y: 0, z: room.anchor.y + 0.5 }, item: reward }];
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
      const reward = createLootInstance('kopis', 'room_reward_' + room.id, this.world.level, rarity, seededLootRandom(this.world.seed, 'room_reward_' + room.id));
      this.loot = [...this.loot, { id: reward.instanceId, position: { x: room.anchor.x + 0.72, y: 0, z: room.anchor.y + 0.5 }, item: reward }];
      this.addToast('A reward appeared in the room. Press E to collect it.');
    } else if (choiceId === 'supplies') {
      const health = createLootInstance('healing_draught', 'room_health_' + room.id, this.world.level, 'COMMON', seededLootRandom(this.world.seed, 'room_health_' + room.id));
      const mana = createLootInstance('nectar_flask', 'room_mana_' + room.id, this.world.level, 'COMMON', seededLootRandom(this.world.seed, 'room_mana_' + room.id));
      const first = addInventoryItem(this.player, health);
      this.player = first.player;
      const second = addInventoryItem(this.player, mana);
      this.player = second.player;
      if (!first.stored || !second.stored) this.addToast('Supplies remain in the room because they could not be stored.');
    } else if (choiceId === 'disarm') {
      if (this.rollCheck(this.player.stats.dex, 13 + Math.floor(this.world.level / 3))) this.addToast('Trap safely disarmed.');
      else this.player = { ...this.player, stats: { ...this.player.stats, hp: Math.max(1, hp - Math.ceil(maxHp * 0.12)) } };
    } else if (choiceId === 'force') {
      this.player = { ...this.player, stats: { ...this.player.stats, hp: Math.max(1, hp - Math.ceil(maxHp * 0.18)) } };
    } else if (choiceId === 'tyche_sacrifice') {
      const cost = Math.ceil(maxHp * 0.2);
      if (hp <= cost) { this.addToast('You do not have enough health to offer blood.'); return; }
      this.player = { ...this.player, stats: { ...this.player.stats, hp: hp - cost } };
      this.createRoomReward(room, 'vault_rare_' + room.id, 'RARE');
    } else if (choiceId === 'tyche_disarm') {
      if (this.rollCheck(this.player.stats.dex, 15 + Math.floor(this.world.level / 2))) this.createRoomReward(room, 'vault_disarm_' + room.id, 'RARE');
      else {
        this.player = { ...this.player, stats: { ...this.player.stats, hp: Math.max(1, hp - Math.ceil(maxHp * 0.15)) } };
        this.addToast('The counterweight snaps shut. The trap costs health.');
      }
    } else if (choiceId === 'thread_cache') {
      this.createRoomReward(room, 'thread_cache_' + room.id, 'RARE');
    } else if (choiceId === 'leave') {
      this.addToast('You leave the cache untouched.');
    }
    const resolved = choiceId !== 'leave' || room.type === 'EVENT';
    this.world = { ...this.world, floor: { ...this.world.floor, rooms: this.world.floor.rooms.map(candidate => candidate.id === room.id ? { ...candidate, resolved } : candidate) } };
    this.roomOffer = null;
    if (!['leave', 'prepare', 'gear', 'fortune', 'investigate', 'key', 'disarm'].includes(choiceId)) this.addToast('Room resolved.');
    this.persistRun();
  }

  private createRoomReward(room: DungeonRoom, sourceId: string, rarity: 'COMMON' | 'RARE'): void {
    const reward = createLootInstance('kopis', sourceId, this.world.level, rarity, seededLootRandom(this.world.seed, sourceId));
    this.loot = [...this.loot.filter(drop => drop.id !== reward.instanceId), { id: reward.instanceId, position: { x: room.anchor.x + 0.72, y: 0, z: room.anchor.y + 0.5 }, item: reward }];
    this.addToast('A rare reward appeared. Press E to collect it.');
  }

  private rollCheck(stat: number, difficulty: number): boolean {
    return Math.floor(this.random() * 20) + 1 + Math.floor(stat / 3) >= difficulty;
  }

  private ensureGuardianDraft(): void {
    const floor = this.world.floor;
    if (floor.guardianState !== 'DESCENT_UNLOCKED' || !floor.guardianId) return;
    const progress = floor.lawProgress ?? createEmptyMazeLawProgress();
    if (progress.draft?.guardianId === floor.guardianId && progress.draft.floorLevel === floor.level) return;
    const draft = createLawDraft(floor.seed, floor.guardianId, floor.level);
    this.world = { ...this.world, floor: { ...floor, lawProgress: { ...progress, draft } } };
  }

  private tickLawHazards(deltaSeconds: number): void {
    const hazards = this.world.floor.lawHazards ?? [];
    if (!hazards.length) return;
    let triggered = false;
    const next = hazards.map(hazard => {
      const cooldownRemaining = Math.max(0, hazard.cooldownRemaining - deltaSeconds);
      if (cooldownRemaining > 0 || Math.hypot(this.player.position.x - hazard.x, this.player.position.z - hazard.z) > hazard.radius) return { ...hazard, cooldownRemaining };
      triggered = true;
      this.player = { ...this.player, statusEffects: applyRealtimeStatus(this.player.statusEffects, { statusId: 'POISON', durationSeconds: 2.5, magnitude: hazard.damage, tickIntervalSeconds: 1 }, hazard.id) };
      this.visualEvents.push({ kind: 'impact', effectId: 'poison_splash', position: { x: hazard.x, y: 0.05, z: hazard.z }, color: '#8fc45a', scale: 0.9, sourceId: hazard.id });
      return { ...hazard, cooldownRemaining: hazard.cooldownSeconds };
    });
    this.world = { ...this.world, floor: { ...this.world.floor, lawHazards: next } };
    if (triggered) this.addLog('Venom rises from the Serpent’s Bargain pool.');
  }

  selectLaw(lawId: MazeLawId): boolean {
    const progress = this.world.floor.lawProgress;
    const draft = progress?.draft;
    if (!progress || !draft?.open || draft.selectedLawId || !draft.lawIds.includes(lawId)) return false;
    if (progress.activeLaws.length >= 3 && !progress.activeLaws.some(law => law.lawId === lawId)) {
      this.world = { ...this.world, floor: { ...this.world.floor, lawProgress: { ...progress, draft: { ...draft, pendingLawId: lawId } } } };
      this.persistRun();
      return true;
    }
    return this.commitLawSelection(lawId);
  }

  replaceLaw(replacementId: MazeLawId): boolean {
    const progress = this.world.floor.lawProgress;
    const pendingLawId = progress?.draft?.pendingLawId;
    if (!progress || !pendingLawId || !progress.draft?.open) return false;
    const next = selectMazeLaw(progress, pendingLawId, replacementId);
    if (!next) { this.addToast('That Law cannot replace the selected thread.'); return false; }
    return this.finishLawSelection(next, pendingLawId);
  }

  cancelLawReplacement(): void {
    const progress = this.world.floor.lawProgress;
    if (!progress?.draft?.pendingLawId) return;
    this.world = { ...this.world, floor: { ...this.world.floor, lawProgress: { ...progress, draft: { ...progress.draft, pendingLawId: undefined } } } };
    this.persistRun();
  }

  closeLawOffer(): void {
    const progress = this.world.floor.lawProgress;
    if (!progress?.draft?.open) return;
    this.cancelHeldActions();
    this.world = { ...this.world, floor: { ...this.world.floor, lawProgress: { ...progress, draft: { ...progress.draft, open: false, pendingLawId: undefined } } } };
    this.persistRun();
  }

  private commitLawSelection(lawId: MazeLawId): boolean {
    const progress = this.world.floor.lawProgress;
    if (!progress) return false;
    const next = selectMazeLaw(progress, lawId);
    if (!next) { this.addToast('That Law cannot be woven into the current pattern.'); return false; }
    return this.finishLawSelection(next, lawId);
  }

  private finishLawSelection(progress: NonNullable<typeof this.world.floor.lawProgress>, lawId: MazeLawId): boolean {
    this.world = { ...this.world, floor: { ...this.world.floor, lawProgress: progress } };
    const draft = progress.draft;
    if (draft) this.recordChronicleEvent({ kind: 'LAW_CHOSEN', floor: draft.floorLevel, lawId, offerId: draft.offerId,
      ...(draft.replacedLawId ? { replacedLawId: draft.replacedLawId } : {}) });
    this.cancelHeldActions();
    this.addLog(getMazeLaw(lawId)?.lawId.replace(/_/g, ' ') + ' woven into the Maze.');
    this.addToast('The Law is woven. Press E at the descent to continue.');
    this.persistRun();
    return true;
  }

  private advanceFloor(): void {
    const progress = this.world.floor.lawProgress ?? createEmptyMazeLawProgress();
    if (!progress.draft?.selectedLawId) { this.addToast('Choose a Law before descending.'); return; }
    const nextWorldBase = createDungeonWorld(this.world.level + 1, randomSeed());
    const inheritedProgress = { ...progress, draft: undefined };
    const nextWorldWithLaws = applyLivingLabyrinth(nextWorldBase, inheritedProgress);
    const charges = this.world.floor.threadProgress?.charges ?? 2;
    const nextWorld: DungeonWorldState = { ...nextWorldWithLaws, floor: {
      ...nextWorldWithLaws.floor,
      threadProgress: createAriadneThreadProgress(nextWorldWithLaws.floor.threadJunctions ?? [], charges),
    }, mazeChronicle: this.world.mazeChronicle };
    const yaw = spawnFacingAngle(nextWorld.map, { x: 1, y: 1 });
    this.world = { ...markExplored(nextWorld, 1.5, 1.5), worldRevision: this.world.worldRevision + 1 };
    this.player = { ...this.player, position: { x: 1.5, y: 0, z: 1.5 }, rotation: { yaw, pitch: this.player.rotation.pitch } };
    this.enemies = createFloorEnemies(this.world).map(initializeEnemyPoise);
    this.projectiles = [];
    this.loot = (this.world.floor.lawHazards ?? []).flatMap(hazard => hazard.rewardBaseId ? [{
      id: 'law_reward_' + hazard.id,
      position: { x: hazard.x + 0.65, y: 0, z: hazard.z },
      item: createLootInstance(hazard.rewardBaseId, 'law_reward_' + hazard.id, this.world.level, 'COMMON', seededLootRandom(this.world.seed, hazard.id)),
    }] : []);
    this.roomOffer = null;
    this.combat.reset();
    this.controllerState = createPlayerControllerState();
    this.addLog('You descend to Labyrinth Floor ' + this.world.level + '.');
    this.addToast('The next depth awaits.');
    this.persistRun();
  }

  private getLookedAtLoot(): WorldLootDrop | null {
    const yaw = this.player.rotation.yaw;
    const forwardX = Math.cos(yaw), forwardZ = Math.sin(yaw);
    let best: WorldLootDrop | null = null, bestScore = Infinity;
    for (const drop of this.loot) {
      const dx = drop.position.x - this.player.position.x, dz = drop.position.z - this.player.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 2.2 || distance < 0.18) continue;
      const alignment = (dx * forwardX + dz * forwardZ) / distance;
      if (alignment < 0.72 || !hasLineOfSight(this.world.map, this.player.position.x, this.player.position.z, drop.position.x, drop.position.z, 0.1)) continue;
      const priority = drop.item.rarity === 'UNIQUE' ? 4 : drop.item.rarity === 'RARE' ? 3 : drop.item.rarity === 'MAGIC' ? 2 : 1;
      const score = distance - priority * 0.16;
      if (score >= bestScore) continue;
      best = drop;
      bestScore = score;
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
    if (drop) return 'E  Collect ' + drop.item.name + ' · ' + drop.item.rarity;
    const target = findLookTarget(this.world, this.player);
    if (!target) return null;
    if (target.kind === 'THREAD_ANCHOR') {
      const progress = this.world.floor.threadProgress;
      return 'E  Thread Anchor · ' + (progress?.charges ?? 0) + '/' + (progress?.maxCharges ?? 3) + ' Charges';
    }
    if (target.kind === 'DOOR') return 'E  Open door';
    if (target.kind === 'LOCKED') return this.world.floor.keys > 0 ? 'E  Use Ariadne’s Token' : 'E  Force locked gate';
    if (target.kind === 'SECRET') return 'E  Search for a secret';
    if (target.kind === 'EXIT') {
      if (this.world.floor.guardianState !== 'DESCENT_UNLOCKED') return 'Defeat the floor guardian to unlock descent';
      return this.world.floor.lawProgress?.draft?.selectedLawId ? 'E  Descend to Floor ' + (this.world.level + 1) : 'E  Weave a Law';
    }
    if (target.kind === 'ROOM') {
      if (target.room.lawId === 'vault_of_tyche' && target.room.unlocked) return 'E  Face Tyche’s trial';
      if (target.room.lawId === 'broken_thread' && target.room.unlocked) return 'E  Search the fractured cache';
      if (target.room.type === 'LOCKED' && target.room.unlocked) return 'E  Claim vault reward';
      if (target.room.type === 'COMBAT' || target.room.type === 'ELITE') return this.enemies.some(enemy => enemy.roomId === target.room.id && enemy.health > 0) ? 'Clear the chamber' : 'Chamber cleared';
      return 'E  ' + target.room.type.toLowerCase().replace(/_/g, ' ');
    }
    return null;
  }

  equip(instanceId: string): EquipmentTransactionResult {
    const reservedIds = this.loot.flatMap(drop => [drop.id, drop.item.instanceId]);
    const result = tryEquipItem(this.player, instanceId, reservedIds);
    if (!result.ok) { this.addToast(result.message ?? 'That item could not be equipped.'); return result; }
    this.combat.cancelActiveAction();
    this.player = result.player;
    this.addToast('Equipped ' + (this.player.equipment[result.slot!]?.name ?? 'item') + '.');
    return result;
  }

  /** Cancels held charge/guard input when the game yields to an overlay or browser state change. */
  cancelHeldActions(): void {
    this.chargeStartedAt = null;
    this.controllerState = { ...this.controllerState, guarding: false, guardExhausted: false };
  }

  moveItem(instanceId: string, x: number, y: number): boolean {
    const result = moveInventoryItem(this.player, instanceId, x, y);
    if (!result.moved) return false;
    this.player = result.player;
    return true;
  }

  splitItem(instanceId: string): boolean {
    const reservedIds = this.loot.flatMap(drop => [drop.id, drop.item.instanceId]);
    const player = splitInventoryStack(this.player, instanceId, reservedIds);
    if (!player) return false;
    this.player = player;
    this.addToast('Consumable stack split evenly.');
    return true;
  }

  unequip(slot: EquipmentSlot): EquipmentTransactionResult {
    const equippedName = this.player.equipment[slot]?.name ?? 'item';
    const reservedIds = this.loot.flatMap(drop => [drop.id, drop.item.instanceId]);
    const result = tryUnequipItem(this.player, slot, reservedIds);
    if (!result.ok) { this.addToast(result.message ?? 'That item could not be unequipped.'); return result; }
    this.combat.cancelActiveAction();
    this.player = result.player;
    this.addToast('Unequipped ' + equippedName + '.');
    return result;
  }

  useItem(instanceId: string): void {
    const next = consumePotion(this.player, instanceId);
    if (!next) { this.addToast('That item cannot be used now.'); return; }
    this.player = next;
    this.setViewmodelEvent('ITEM_USE', 0.3);
    this.addToast('Potion used.');
  }

  dropItem(instanceId: string): boolean {
    if (this.loot.length >= 64) { this.addToast('The room is too crowded to safely drop another item.'); return false; }
    const removed = removeInventoryUnit(this.player, instanceId);
    if (!removed) return false;
    let item = removed.item;
    if (this.loot.some(drop => drop.id === item.instanceId || drop.item.instanceId === item.instanceId)) {
      const occupied = new Set([
        ...this.loot.map(drop => drop.id), ...this.loot.map(drop => drop.item.instanceId),
        ...this.player.inventory.map(candidate => candidate.instanceId),
        ...Object.values(this.player.equipment).filter((candidate): candidate is ItemInstance => Boolean(candidate)).map(candidate => candidate.instanceId),
      ]);
      let suffix = 1;
      let instanceId = item.instanceId + '_world_' + suffix++;
      while (occupied.has(instanceId)) instanceId = item.instanceId + '_world_' + suffix++;
      item = { ...item, instanceId };
    }
    this.player = removed.player;
    const yaw = this.player.rotation.yaw;
    const desired = { x: this.player.position.x + Math.cos(yaw) * 0.72, y: 0, z: this.player.position.z + Math.sin(yaw) * 0.72 };
    const tile = this.world.map[Math.floor(desired.z)]?.[Math.floor(desired.x)];
    const position = isWorldSolid(tile) ? { x: this.player.position.x, y: 0, z: this.player.position.z } : desired;
    this.loot = [...this.loot, { id: item.instanceId, position, item }];
    this.addToast(item.name + ' dropped nearby.');
    return true;
  }

  save(storage?: KeyValueStorage): boolean {
    const success = this.persistRun(storage);
    this.addToast(success ? 'Run saved.' : 'Save failed. Storage is unavailable.');
    return success;
  }

  private persistRun(storage?: KeyValueStorage): boolean {
    const save = { player: this.player, world: this.world, enemies: this.enemies, loot: this.loot, combat: this.combat.snapshot() };
    const success = saveMazeGame(save, storage);
    this.lastSaveSucceeded = success;
    return success;
  }

  get saveSucceeded(): boolean | null { return this.lastSaveSucceeded; }

  chooseSkillUpgrade(abilityId: string): boolean {
    if (!this.levelUpOpen) return false;
    const upgraded = applySkillUpgrade(this.player, abilityId);
    if (!upgraded) { this.addToast('That skill choice is no longer available.'); return false; }
    this.player = upgraded;
    this.levelUpOpen = (this.player.skillPoints ?? 0) > 0;
    this.addToast(getAbility(abilityId)?.name + (getSkillRank(this.player, abilityId) === 1 ? ' learned.' : ' improved to Rank ' + getSkillRank(this.player, abilityId) + '.') + (this.levelUpOpen ? ' Choose another upgrade.' : ''));
    return true;
  }

  deferSkillUpgrade(): void {
    if (!this.levelUpOpen) return;
    this.levelUpOpen = false;
    this.cancelHeldActions();
    this.addToast('Skill point kept. Choose an upgrade from the HUD when ready.');
  }

  openSkillUpgradeScreen(): void {
    if ((this.player.skillPoints ?? 0) <= 0 || this.gameOver) return;
    this.paused = false;
    this.inventoryOpen = false;
    this.mapOpen = false;
    this.chronicleOpen = false;
    this.levelUpOpen = true;
    this.cancelHeldActions();
  }

  openMazeChronicle(): void {
    if (this.levelUpOpen || this.roomOffer || this.threadOffer || this.world.floor.lawProgress?.draft?.open) return;
    this.paused = false;
    this.inventoryOpen = false;
    this.mapOpen = false;
    this.chronicleOpen = true;
    this.cancelHeldActions();
  }

  closeMazeChronicle(): void {
    this.chronicleOpen = false;
    this.cancelHeldActions();
  }

  private recordChronicleEvent(event: MazeChronicleEventInput): boolean {
    const current = this.world.mazeChronicle;
    const next = recordMazeChronicleEvent(current, event);
    if (next === current) return false;
    this.world = { ...this.world, mazeChronicle: next };
    return true;
  }

  private discoverRoom(roomId: string): void {
    const room = this.world.floor.rooms.find(candidate => candidate.id === roomId);
    if (!room) return;
    const roomStateChanged = !room.discovered || !room.visited;
    if (roomStateChanged) {
      this.world = { ...this.world, floor: { ...this.world.floor, rooms: this.world.floor.rooms.map(candidate => candidate.id === roomId ? { ...candidate, discovered: true, visited: true } : candidate) } };
    }
    let changed = false;
    if (room.type !== 'NORMAL') changed = this.recordChronicleEvent({ kind: 'ROOM_FAMILY_DISCOVERED', floor: this.world.level, familyId: room.type }) || changed;
    const lawIds = room.lawIds ?? (room.lawId ? [room.lawId] : []);
    for (const lawId of lawIds) if (this.world.floor.manifestedLawIds?.includes(lawId)) {
      changed = this.recordChronicleEvent({ kind: 'LAW_MANIFESTED', floor: this.world.level, lawId }) || changed;
    }
    if (room.synergyId && this.world.floor.manifestedSynergyIds?.includes(room.synergyId)) {
      changed = this.recordChronicleEvent({ kind: 'SYNERGY_MANIFESTED', floor: this.world.level, synergyId: room.synergyId }) || changed;
    }
    if (changed || roomStateChanged) this.persistRun();
  }

  private updateVisibleDiscoveries(): void {
    let changed = false;
    for (const enemy of this.enemies) {
      if (enemy.health <= 0 || Math.hypot(enemy.position.x - this.player.position.x, enemy.position.z - this.player.position.z) > 8
        || !hasLineOfSight(this.world.map, this.player.position.x, this.player.position.z, enemy.position.x, enemy.position.z, 0.2)) continue;
      if (getEnemyDefinition(enemy.definitionId) || enemy.definitionId === this.world.floor.guardianId) {
        changed = this.recordChronicleEvent({ kind: 'ENEMY_FAMILY_DISCOVERED', floor: this.world.level, familyId: enemy.definitionId }) || changed;
      }
      if (enemy.lawId && this.world.floor.manifestedLawIds?.includes(enemy.lawId)) {
        changed = this.recordChronicleEvent({ kind: 'LAW_MANIFESTED', floor: this.world.level, lawId: enemy.lawId }) || changed;
      }
      const room = enemy.roomId ? this.world.floor.rooms.find(candidate => candidate.id === enemy.roomId) : undefined;
      if (room?.synergyId && this.world.floor.manifestedSynergyIds?.includes(room.synergyId)) {
        changed = this.recordChronicleEvent({ kind: 'SYNERGY_MANIFESTED', floor: this.world.level, synergyId: room.synergyId }) || changed;
      }
    }
    for (const hazard of this.world.floor.lawHazards ?? []) {
      if (Math.hypot(hazard.x - this.player.position.x, hazard.z - this.player.position.z) > 7
        || !hasLineOfSight(this.world.map, this.player.position.x, this.player.position.z, hazard.x, hazard.z, 0.1)) continue;
      if (this.world.floor.manifestedLawIds?.includes(hazard.lawId)) {
        changed = this.recordChronicleEvent({ kind: 'LAW_MANIFESTED', floor: this.world.level, lawId: hazard.lawId }) || changed;
      }
      if (hazard.synergyId && this.world.floor.manifestedSynergyIds?.includes(hazard.synergyId)) {
        changed = this.recordChronicleEvent({ kind: 'SYNERGY_MANIFESTED', floor: this.world.level, synergyId: hazard.synergyId as MazeLawSynergyId }) || changed;
      }
    }
    if (changed) this.persistRun();
  }

  private updateGuardianDiscovery(): void {
    const floor = this.world.floor;
    if (!floor.guardianId) return;
    if (floor.guardianState !== 'NOT_DISCOVERED') {
      if (floor.guardianState !== undefined && this.recordChronicleEvent({ kind: 'ROOM_FAMILY_DISCOVERED', floor: this.world.level, familyId: 'BOSS' })) this.persistRun();
      return;
    }
    const guardian = this.enemies.find(enemy => enemy.definitionId === floor.guardianId && enemy.health > 0);
    if (!guardian) return;
    const distance = Math.hypot(guardian.position.x - this.player.position.x, guardian.position.z - this.player.position.z);
    if (distance > 8 || !hasLineOfSight(this.world.map, this.player.position.x, this.player.position.z, guardian.position.x, guardian.position.z, 0.2)) return;
    const bossRoom = floor.rooms.find(room => room.type === 'BOSS');
    this.world = { ...this.world, floor: { ...floor, guardianState: 'ALIVE', rooms: floor.rooms.map(room => room.type === 'BOSS' ? { ...room, discovered: true, visited: true } : room) } };
    this.recordChronicleEvent({ kind: 'ROOM_FAMILY_DISCOVERED', floor: this.world.level, familyId: 'BOSS' });
    const bossLawIds = bossRoom?.lawIds ?? (bossRoom?.lawId ? [bossRoom.lawId] : []);
    for (const lawId of bossLawIds) if (this.world.floor.manifestedLawIds?.includes(lawId)) this.recordChronicleEvent({ kind: 'LAW_MANIFESTED', floor: this.world.level, lawId });
    this.persistRun();
    this.addLog(getFloorGuardianDefinition(this.world.level).entranceLine);
    this.addToast(getFloorGuardianDefinition(this.world.level).entranceLine);
  }

  getRenderState(): FPSRenderState {
    return { world: this.world, player: this.player, enemies: this.enemies, projectiles: this.projectiles, loot: this.loot, action: this.combat.action, isMoving: this.isMoving, guarding: this.controllerState.guarding, paused: this.paused || this.inventoryOpen || this.mapOpen || this.levelUpOpen || Boolean(this.roomOffer) || Boolean(this.threadOffer) || this.chronicleOpen || Boolean(this.world.floor.lawProgress?.draft?.open) || this.gameOver, cameraBob: this.cameraBob, viewmodelEvent: this.viewmodelEvent, viewmodelEventProgress: this.viewmodelEventDuration > 0 ? this.viewmodelEventSeconds / this.viewmodelEventDuration : 0, events: this.visualEvents.splice(0) };
  }

  private setViewmodelEvent(event: NonNullable<FPSRenderState['viewmodelEvent']>, durationSeconds: number): void {
    this.viewmodelEvent = event;
    this.viewmodelEventSeconds = durationSeconds;
    this.viewmodelEventDuration = durationSeconds;
  }

  getSnapshot(): FPSGameSnapshot {
    const loadout = CLASS_ABILITY_LOADOUT[this.player.classId];
    const incomingAttacks = this.enemies.filter(enemy => enemy.health > 0 && enemy.state === 'ATTACK_WINDUP'
      && Math.hypot(enemy.position.x - this.player.position.x, enemy.position.z - this.player.position.z) <= 10
      && hasLineOfSight(this.world.map, enemy.position.x, enemy.position.z, this.player.position.x, this.player.position.z, 0.15))
      .map(enemy => {
        const attack = getEnemyAttackDefinition(enemy.attackSetId, enemy.activeAttackId, enemy.phase ?? 1);
        const toward = Math.atan2(enemy.position.z - this.player.position.z, enemy.position.x - this.player.position.x);
        const delta = Math.atan2(Math.sin(toward - this.player.rotation.yaw), Math.cos(toward - this.player.rotation.yaw));
        const abs = Math.abs(delta);
        const direction: 'FRONT' | 'LEFT' | 'RIGHT' | 'BEHIND' = abs < 0.48 ? 'FRONT' : abs > 2.35 ? 'BEHIND' : delta > 0 ? 'RIGHT' : 'LEFT';
        return { id: enemy.id, name: attack?.name ?? enemy.name, seconds: Math.max(0, enemy.stateTimer), parryable: attack?.parryable === true, direction };
      })
      .sort((a, b) => a.seconds - b.seconds || a.id.localeCompare(b.id))
      .slice(0, 3);
    return {
      player: this.player,
      derivedStats: calculateDerivedStats(this.player),
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
      skillUpgradeChoices: getSkillUpgradeChoices(this.player),
      levelUpOpen: this.levelUpOpen,
      chargeProgress: this.chargeStartedAt === null ? 0 : Math.min(1, (this.elapsedSeconds - this.chargeStartedAt) / 1),
      isMoving: this.isMoving,
      guarding: this.controllerState.guarding,
      paused: this.paused,
      inventoryOpen: this.inventoryOpen,
      mapOpen: this.mapOpen,
      chronicleOpen: this.chronicleOpen,
      gameOver: this.gameOver,
      roomOffer: this.roomOffer,
      lawOffer: this.world.floor.lawProgress?.draft?.open ? this.world.floor.lawProgress.draft : null,
      threadOffer: this.threadOffer,
      prompt: this.paused || this.inventoryOpen || this.mapOpen || this.levelUpOpen || this.roomOffer || this.threadOffer || this.chronicleOpen || this.world.floor.lawProgress?.draft?.open ? null : this.getPrompt(),
      targetEnemy: this.getTargetEnemy(),
      incomingAttacks,
      parryWindowSeconds: this.controllerState.parryWindowSeconds,
      parryRecoverySeconds: this.controllerState.parryRecoverySeconds,
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
    inventoryGrid: player.inventoryGrid?.map(placement => ({ ...placement })),
    uniqueEffectStates: player.uniqueEffectStates?.map(state => ({ ...state })),
    skills: player.skills.map(skill => ({ ...skill })),
    classPassiveState: player.classPassiveState ? { ...player.classPassiveState } : undefined,
    statusEffects: player.statusEffects.map(status => ({ ...status })),
  };
}

function cloneWorld(world: DungeonWorldState): DungeonWorldState {
  return {
    ...world,
    map: world.map.map(row => [...row]),
    decorations: world.decorations.map(row => [...row]),
    explored: world.explored.map(row => [...row]),
    floor: {
      ...world.floor,
      rooms: world.floor.rooms.map(room => ({ ...room, anchor: { ...room.anchor }, cells: room.cells.map(cell => ({ ...cell })), gate: room.gate ? { ...room.gate } : undefined,
        ...(room.lawIds ? { lawIds: [...room.lawIds] } : {}) })),
      ...(world.floor.architectureRooms ? { architectureRooms: world.floor.architectureRooms.map(room => ({ ...room, cells: room.cells.map(cell => ({ ...cell })), landmarkIds: [...room.landmarkIds] })) } : {}),
      visitedCells: [...world.floor.visitedCells], pendingEffects: [...world.floor.pendingEffects],
    },
    mazeChronicle: world.mazeChronicle ? { ...world.mazeChronicle, events: world.mazeChronicle.events.map(event => ({ ...event })) } : createMazeChronicle(),
  };
}

function getAbilityStartSound(ability: NonNullable<ReturnType<typeof getAbility>>): NonNullable<VisualEvent['sound']> {
  if (ability.meleeStyle === 'BASH') return 'shield';
  if (ability.element) return 'cast';
  if (ability.meleeStyle === 'THRUST') return 'spear';
  if (ability.kind === 'MELEE') return 'blade';
  if (ability.manaCost > 0) return ability.selfEffect?.type === 'GUARD' || ability.selfStatuses?.some(status => status.statusId === 'GUARD') ? 'shield' : 'cast';
  return 'projectile';
}

function isFireAbility(ability: NonNullable<ReturnType<typeof getAbility>>): boolean {
  return ability.onHitStatus?.statusId === 'BURN' || /fire|flame|ember/i.test(ability.id);
}

function statusVfxEffect(statusId?: string): PixelEffectId | undefined {
  if (statusId === 'BLEED') return 'blood_hit';
  if (statusId === 'POISON') return 'arachne_venom';
  if (statusId === 'BURN') return 'promethean_flame';
  if (statusId === 'SLOW') return 'web_snare';
  if (statusId === 'WEAKNESS') return 'chthonic_bolt';
  if (statusId === 'CURSE') return 'chthonic_bolt';
  return undefined;
}

function seededLootRandom(floorSeed: number, key: string): () => number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) hash = Math.imul(hash ^ key.charCodeAt(index), 16777619);
  return floorRandom((floorSeed ^ hash ^ 0x71007) >>> 0);
}

function scaleStatusPower(status: StatusApplication | undefined, derived: DerivedCharacterStats): StatusApplication | undefined {
  if (!status) return undefined;
  const power = status.statusId === 'BLEED' ? derived.bleedPowerMultiplier
    : status.statusId === 'POISON' ? derived.poisonPowerMultiplier
      : status.statusId === 'BURN' ? derived.firePowerMultiplier : 1;
  return power === 1 ? status : { ...status, magnitude: Math.max(0, status.magnitude * power) };
}

export function formatLootDropToast(dropCount: number): string {
  return `Loot dropped. Press E to collect ${dropCount === 1 ? 'it' : 'them'}.`;
}

function boundedProjectileCount(ability: NonNullable<ReturnType<typeof getAbility>>): number {
  const requested = ability.projectileCount ?? 1;
  return Number.isFinite(requested) ? Math.max(1, Math.min(7, Math.floor(requested))) : 1;
}

function abilityVfxEffect(abilityId: string, statusId?: string): PixelEffectId | undefined {
  const statusEffect = statusVfxEffect(statusId);
  if (statusEffect) return statusEffect;
  if (/blood_oath/i.test(abilityId)) return 'blood_hit';
  if (/fireburst|promethean|flame/i.test(abilityId)) return 'promethean_flame';
  if (/necromancer_|soul_drain|chthonic|underworld|warden|curse|grasp/i.test(abilityId)) return 'chthonic_bolt';
  if (/ranger_volley|javelin/i.test(abilityId)) return 'dory_thrust';
  if (/sorcerer_|oracle|spark|lightning|charged_bolt/i.test(abilityId)) return 'oracle_spark';
  if (/web|snare/i.test(abilityId)) return 'web_snare';
  return undefined;
}
