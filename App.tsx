import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CLASSES } from './constants';
import { abilityTooltip, getAbility } from './combat/AbilityRegistry';
import FPSViewport from './components/FPSViewport';
import { FPSGameRuntime, type FPSGameSnapshot } from './engine/FPSGameRuntime';
import { loadMazeGame } from './services/mazeSave';
import { LABYRINTH_THEMES } from './data/mazeContent';
import type { ClassType } from './types';
import type { InputSystem } from './engine/InputSystem';
import type { RenderQuality } from './engine/SceneRenderer';
import type { VFXMode } from './presentation/vfxDefinitions';
import { shouldReleasePointerLockForUi } from './services/uiInputPolicy';
import InventoryPanel from './components/InventoryPanel';
import SkillUpgradeScreen from './components/SkillUpgradeScreen';
import MazeChroniclePanel from './components/MazeChroniclePanel';
import { getClassSkillKit } from './data/classSkillKits';
import { classPassiveStackSummary } from './player/ClassPassives';
import { isShieldItem } from './services/equipmentRules';
import { abilityStaminaCost } from './combat/CombatMastery';
import { getMazeLaw } from './data/mazeLaws';
import type { MazeLawId, MazeLawProgress } from './types';
import ActionGlyph, { actionGlyphForFamily, actionGlyphForSkill, type ActionGlyphKind } from './components/ActionGlyph';

const CLASS_IDS = Object.keys(CLASSES) as ClassType[];
const App: React.FC = () => {
  const runtimeRef = useRef<FPSGameRuntime | null>(null);
  const inputRef = useRef<InputSystem | null>(null);
  const [mode, setMode] = useState<'MENU' | 'CLASS_SELECT' | 'CONTROLS' | 'PLAY'>('MENU');
  const [snapshot, setSnapshot] = useState<FPSGameSnapshot | null>(null);
  const [hasSave, setHasSave] = useState(false);
  const [saveWarning, setSaveWarning] = useState('');
  const [migrationNotice, setMigrationNotice] = useState('');
  const [webglError, setWebglError] = useState('');
  const [mouseSensitivity, setMouseSensitivity] = useState(0.0025);
  const [uiScale, setUiScale] = useState(1);
  const [vfxMode, setVfxMode] = useState<VFXMode>('full');
  const [renderQuality, setRenderQuality] = useState<RenderQuality>('balanced');
  const [skillDetailsIndex, setSkillDetailsIndex] = useState<number | null>(null);

  useEffect(() => {
    const result = loadMazeGame();
    setHasSave(Boolean(result.save));
    if (result.invalid) setSaveWarning('A saved expedition is invalid or unavailable. Existing save data has not been overwritten.');
    else if (result.migrationRequired) setSaveWarning((result.migratedFromR1 ? 'An FPS-R1' : result.migratedFromR6D2 ? 'An R6D2' : result.migratedFromR6D1 ? 'An R6D1' : result.migratedFromR6C ? 'An R6C' : result.migratedFromR4B ? 'An FPS-R4B' : result.migratedFromR4A ? 'An FPS-R4A' : 'An FPS-R2A') + ' expedition is ready to migrate when you continue. Its original save is preserved until the new save is written.');
    try {
      const savedSensitivity = Number(window.localStorage.getItem('aether_fps_mouse_sensitivity'));
      if (Number.isFinite(savedSensitivity) && savedSensitivity >= 0.001 && savedSensitivity <= 0.006) setMouseSensitivity(savedSensitivity);
      const savedVfxMode = window.localStorage.getItem('aether_fps_vfx_mode_r3b');
      if (savedVfxMode === 'full' || savedVfxMode === 'reduced' || savedVfxMode === 'off') setVfxMode(savedVfxMode);
      const savedRenderQuality = window.localStorage.getItem('aether_fps_render_quality_r6f1');
      if (savedRenderQuality === 'performance' || savedRenderQuality === 'balanced' || savedRenderQuality === 'sharp') setRenderQuality(savedRenderQuality);
      const savedUiScale = Number(window.localStorage.getItem('aether_fps_ui_scale_r6f3'));
      if ([0.9, 1, 1.15, 1.25].includes(savedUiScale)) setUiScale(savedUiScale);
    } catch { /* Sensitivity storage is optional. */ }
  }, []);

  const freeCursorRequired = Boolean(snapshot && shouldReleasePointerLockForUi({
    inventoryOpen: snapshot.inventoryOpen,
    mapOpen: snapshot.mapOpen,
    paused: snapshot.paused,
    levelUpOpen: snapshot.levelUpOpen,
    roomOfferOpen: Boolean(snapshot.roomOffer),
    lawOfferOpen: Boolean(snapshot.lawOffer),
    threadOfferOpen: Boolean(snapshot.threadOffer),
    chronicleOpen: snapshot.chronicleOpen,
    gameOver: snapshot.gameOver,
  }));

  useLayoutEffect(() => {
    if (freeCursorRequired) inputRef.current?.handoffToUi();
  }, [freeCursorRequired]);

  const beginRun = (classId: ClassType) => {
    const runtime = new FPSGameRuntime(classId);
    setMigrationNotice('');
    runtimeRef.current = runtime;
    setSnapshot(runtime.getSnapshot());
    setWebglError('');
    setSkillDetailsIndex(null);
    setMode('PLAY');
  };

  const continueRun = () => {
    const result = loadMazeGame();
    if (!result.save) {
      setSaveWarning(result.invalid ? 'The save is invalid or unavailable. It has not been overwritten.' : 'No saved expedition is available.');
      setHasSave(false);
      return;
    }
    setSaveWarning('');
    const runtime = new FPSGameRuntime(result.save.player.classId, result.save);
    if (result.migrationRequired) {
      const saved = runtime.save();
      if (saved) {
        setHasSave(true);
        setMigrationNotice(result.migratedFromR1
          ? 'FPS-R1 progress migrated into the Labyrinth. The original save remains preserved.'
          : result.migratedFromR6D2
            ? 'R6D2 progress migrated safely. The existing floor and Thread routes remain intact.'
          : result.migratedFromR6D1
            ? 'R6D1 progress migrated safely. The existing floor and route remain intact.'
          : result.migratedFromR4A
            ? 'FPS-R4A item data moved to the expanded inventory safely. Your saved items were preserved.'
            : result.migratedFromR4B
              ? 'FPS-R4B equipment moved into the expanded loadout safely. Your saved items were preserved.'
              : 'FPS-R2A item data migrated successfully. Your items and Guardian rewards were preserved.');
      } else setMigrationNotice('Migration is ready, but the updated save could not be written. The original save is still intact.');
    } else setMigrationNotice('');
    runtimeRef.current = runtime;
    setSnapshot(runtime.getSnapshot());
    setWebglError('');
    setSkillDetailsIndex(null);
    setMode('PLAY');
  };

  const refreshSnapshot = () => {
    const runtime = runtimeRef.current;
    if (runtime) setSnapshot(runtime.getSnapshot());
  };

  const saveRun = () => {
    const saved = runtimeRef.current?.save() ?? false;
    if (saved) setHasSave(true);
    refreshSnapshot();
  };

  const returnToMenu = () => {
    if (runtimeRef.current) {
      setHasSave(runtimeRef.current.save());
    }
    runtimeRef.current = null;
    inputRef.current = null;
    setSnapshot(null);
    setMode('MENU');
  };

  const closeOverlay = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.paused = false;
    runtime.inventoryOpen = false;
    runtime.mapOpen = false;
    runtime.closeMazeChronicle();
    runtime.cancelHeldActions();
    refreshSnapshot();
  };

  const updateSensitivity = (value: number) => {
    setMouseSensitivity(value);
    try { window.localStorage.setItem('aether_fps_mouse_sensitivity', String(value)); } catch { /* Settings are optional. */ }
  };

  const updateVfxMode = (value: VFXMode) => {
    setVfxMode(value);
    try { window.localStorage.setItem('aether_fps_vfx_mode_r3b', value); } catch { /* Display settings are optional. */ }
  };

  const updateRenderQuality = (value: RenderQuality) => {
    setRenderQuality(value);
    try { window.localStorage.setItem('aether_fps_render_quality_r6f1', value); } catch { /* Display settings are optional. */ }
  };

  const updateUiScale = (value: number) => {
    if (![0.9, 1, 1.15, 1.25].includes(value)) return;
    setUiScale(value);
    try { window.localStorage.setItem('aether_fps_ui_scale_r6f3', String(value)); } catch { /* UI scale storage is optional. */ }
  };

  const openPauseMenu = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.closeMazeChronicle();
    runtime.paused = true;
    runtime.cancelHeldActions();
    refreshSnapshot();
  };

  const openMapFromPause = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.paused = false;
    runtime.inventoryOpen = false;
    runtime.mapOpen = true;
    runtime.cancelHeldActions();
    refreshSnapshot();
  };

  const openInventoryFromPause = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.paused = false;
    runtime.mapOpen = false;
    runtime.inventoryOpen = true;
    runtime.cancelHeldActions();
    refreshSnapshot();
  };

  if (mode === 'MENU') return (
    <main className="fps-menu-screen" style={{ '--fps-ui-scale': uiScale } as React.CSSProperties}>
      <div className="fps-menu-frame">
        <div className="fps-kicker">KNOSSOS · THE LABYRINTH</div>
        <h1>MAZE OF<br /><span>THE MINOTAUR</span></h1>
        <p className="fps-menu-subtitle">A descent into the dark heart beneath Knossos.</p>
        <div className="fps-menu-actions">
          {hasSave && <button className="fps-button fps-button-primary" onClick={continueRun}>Continue Run</button>}
          <button className="fps-button fps-button-primary" onClick={() => setMode('CLASS_SELECT')}>New Run</button>
          <button className="fps-button" onClick={() => setMode('CONTROLS')}>Controls & Options</button>
        </div>
        {saveWarning && <p className="fps-menu-warning" role="status">{saveWarning}</p>}
        <p className="fps-menu-note">Choose one hero. Find the guardian. Descend deeper.</p>
      </div>
    </main>
  );

  if (mode === 'CLASS_SELECT') return (
    <main className="fps-menu-screen" style={{ '--fps-ui-scale': uiScale } as React.CSSProperties}>
      <section className="fps-class-select">
        <button className="fps-back-button" onClick={() => setMode('MENU')}>← Main Menu</button>
        <div className="fps-kicker">CHOOSE YOUR CLASS</div>
        <h2>One hero enters the Labyrinth.</h2>
        <p className="fps-muted">Choose a champion of the old world. Each hero has a primary action, a secondary action and four rankable class skill slots.</p>
        <div className="fps-class-grid">
          {CLASS_IDS.map(classId => {
            const definition = CLASSES[classId];
            const kit = getClassSkillKit(classId);
            return <article className="fps-class-card" key={classId}>
              <div className="fps-class-mark">{classMark(classId)}</div>
              <h3>{definition.name}</h3>
              <p>{definition.description}</p>
              <div className="fps-class-stats">HP {definition.stats.maxHp} · MP {definition.stats.maxMp}</div>
              <div className="fps-class-attack">LMB / RMB follow equipped weapons · 1–4 are class skills</div>
              {kit && <div className="fps-class-kit-preview">
                <strong>{kit.name}</strong><span>{kit.identity}</span>
                <b>Passive · {kit.passive.name}</b><span>{kit.passive.description}</span>
                <small>Active skills · {kit.skills.map(skill => getAbility(skill.abilityId)?.name + ' · Lv ' + skill.unlockLevel).join(' / ')}</small>
                <small>Build paths · {kit.archetypes.map(archetype => archetype.name).join(' · ')}</small>
              </div>}
              <button className="fps-button fps-button-primary" onClick={() => beginRun(classId)}>Enter as {definition.name}</button>
            </article>;
          })}
        </div>
      </section>
    </main>
  );

  if (mode === 'CONTROLS') return (
    <main className="fps-menu-screen" style={{ '--fps-ui-scale': uiScale } as React.CSSProperties}>
      <section className="fps-controls-card">
        <button className="fps-back-button" onClick={() => setMode('MENU')}>← Main Menu</button>
        <div className="fps-kicker">CONTROLS</div>
        <h2>Direct control, no combat turns.</h2>
        <div className="fps-control-list">
          <span>Move / strafe</span><b>W A S D</b>
          <span>Look</span><b>Mouse</b>
          <span>Primary attack</span><b>Left Mouse</b>
          <span>Secondary attack</span><b>Right Mouse · hold to charge where supported</b>
          <span>Class skills</span><b>1–4</b>
          <span>Sprint / dodge</span><b>Shift / Space</b>
          <span>Shield parry</span><b>Q · shield required</b>
          <span>Interact / inventory / map</span><b>E / I / Tab</b>
          <span>Pause</span><b>Esc</b>
        </div>
        <label className="fps-sensitivity">Mouse sensitivity <strong>{mouseSensitivity.toFixed(4)}</strong>
          <input type="range" min="0.001" max="0.006" step="0.0001" value={mouseSensitivity} onChange={event => updateSensitivity(Number(event.target.value))} />
        </label>
        <label className="fps-vfx-setting">Combat visual effects
          <select value={vfxMode} onChange={event => updateVfxMode(event.target.value as VFXMode)}>
            <option value="full">Full</option>
            <option value="reduced">Reduced</option>
            <option value="off">Off</option>
          </select>
        </label>
        <label className="fps-vfx-setting">World render quality
          <select value={renderQuality} onChange={event => updateRenderQuality(event.target.value as RenderQuality)}>
            <option value="performance">Performance</option>
            <option value="balanced">Balanced</option>
            <option value="sharp">Sharp</option>
          </select>
        </label>
        <UiScaleControl value={uiScale} onChange={updateUiScale} />
        <p className="fps-muted">This changes only the pixel-art world canvas. The HUD stays at display resolution; nearest-neighbor sampling keeps authored pixel edges crisp.</p>
        <p className="fps-muted">Reduced lowers ordinary particle count and brightness. Off hides combat effects. Guardian attack warnings remain visible in every mode.</p>
        <p className="fps-muted">On touch screens, drag the left side of the view to move and the right side to look. Use the buttons in the lower-right corner for attacks, dodge, and shield parry.</p>
      </section>
    </main>
  );

  const runtime = runtimeRef.current;
  if (!runtime || !snapshot) return null;
  const player = snapshot.player;
  const target = snapshot.targetEnemy;
  const hasShield = isShieldItem(player.equipment.offHand);
  const hpPercent = Math.max(0, Math.min(100, player.stats.hp / snapshot.derivedStats.maxHealth * 100));
  const mpPercent = snapshot.derivedStats.maxMana > 0 ? Math.max(0, Math.min(100, player.stats.mp / snapshot.derivedStats.maxMana * 100)) : 0;
  const staminaPercent = Math.max(0, Math.min(100, (player.stats.stamina ?? snapshot.derivedStats.maxStamina) / snapshot.derivedStats.maxStamina * 100));
  const defenseLabel = snapshot.parryWindowSeconds > 0 ? 'PARRY OPEN · ' + snapshot.parryWindowSeconds.toFixed(1) + 's'
    : snapshot.parryRecoverySeconds > 0 ? 'PARRY RECOVERY · ' + snapshot.parryRecoverySeconds.toFixed(1) + 's'
      : snapshot.guarding ? 'ASPIS GUARDING · 9 STAMINA/S'
        : hasShield ? 'GUARD RMB · PARRY Q · 18 STAMINA' : 'DODGE SPACE · 22 STAMINA';
  const loadout = snapshot.resolvedActionLoadout;
  const actionStaminaCost = (ability: NonNullable<ReturnType<typeof getAbility>>, weaponSlot?: 'mainHand' | 'offHand'): number =>
    weaponSlot ? abilityStaminaCost(ability, player, weaponSlot) : 0;
  const staminaCostLabel = (ability: NonNullable<ReturnType<typeof getAbility>>, weaponSlot?: 'mainHand' | 'offHand') => {
    const cost = actionStaminaCost(ability, weaponSlot);
    if (!cost) return 'No stamina cost';
    return (typeof cost === 'number' ? Number.isInteger(cost) ? String(cost) : cost.toFixed(1) : cost) + ' STA';
  };
  const xpNeeded = 20 + player.stats.level * 20;
  const xpPercent = Math.max(0, Math.min(100, player.stats.xp / xpNeeded * 100));
  const activePrimary = snapshot.action?.actionSlot === 'PRIMARY' ? snapshot.action : null;
  const activeSecondary = snapshot.action?.actionSlot === 'SECONDARY' ? snapshot.action : null;
  const primary = activePrimary ? getAbility(activePrimary.abilityId) ?? loadout.primary.ability : loadout.primary.ability;
  const secondary = activeSecondary ? getAbility(activeSecondary.abilityId) ?? loadout.secondary.ability : loadout.secondary.ability;
  const primaryWeaponSlot = activePrimary?.weaponSlot ?? loadout.primary.weaponSlot;
  const secondaryWeaponSlot = activeSecondary?.weaponSlot ?? loadout.secondary.weaponSlot;
  const targetDistance = target ? Math.hypot(target.position.x - player.position.x, target.position.z - player.position.z) : Infinity;
  const targetActionValid = Boolean(target && ['MELEE', 'PROJECTILE', 'AOE'].includes(primary.kind) && targetDistance <= primary.range);
  const itemNameByInstanceId = (instanceId?: string | null, slot?: 'mainHand' | 'offHand') =>
    (instanceId ? Object.values(player.equipment).find(item => item?.instanceId === instanceId)?.name : undefined)
      ?? player.equipment[slot ?? 'mainHand']?.name ?? 'Unarmed';
  const primarySource = itemNameByInstanceId(activePrimary?.sourceItemInstanceId, primaryWeaponSlot);
  const secondarySource = itemNameByInstanceId(activeSecondary?.sourceItemInstanceId, secondaryWeaponSlot);
  const primaryHandLabel = primaryWeaponSlot === 'mainHand' ? 'Main hand' : 'Off hand';
  const secondaryHandLabel = secondaryWeaponSlot === 'mainHand' ? 'Main hand' : 'Off hand';
  const skills = [...loadout.classSkills].sort((a, b) => a.slot - b.slot).map((resolved, index) => {
    const id = resolved.abilityId;
    const rank = resolved.rank;
    const unlocked = resolved.unlocked;
    const unlockLevel = resolved.unlockLevel;
    const lockMessage = unlockLevel !== null && player.stats.level >= unlockLevel
      ? 'Not learned · choose with a skill point at level-up.'
      : 'Unlock at level ' + (unlockLevel ?? '?') + '.';
    const ability = resolved.ability;
    return {
      ability, rank, unlocked, unlockLevel, lockMessage,
      role: resolved.role,
      effectiveManaCost: ability.manaCost * snapshot.derivedStats.manaCostMultiplier,
      effectiveCooldown: ability.cooldownSeconds * snapshot.derivedStats.cooldownMultiplier,
      staminaCost: 0,
    };
  });
  const kit = getClassSkillKit(player.classId);
  const passiveSummary = classPassiveStackSummary(player.classPassiveState);
  const selectedSkillDetails = skillDetailsIndex === null ? null : skills[skillDetailsIndex] ?? null;

  return <main className="fps-game-shell" style={{ '--fps-ui-scale': uiScale } as React.CSSProperties}>
    <FPSViewport runtime={runtime} mouseSensitivity={mouseSensitivity} vfxMode={vfxMode} renderQuality={renderQuality} onSnapshot={setSnapshot} onInputReady={input => { inputRef.current = input; }} onFailure={setWebglError} />
    {!webglError && <>
      <div className="fps-vignette" aria-hidden="true" />
      <header className="fps-top-hud">
        <div className="fps-player-panel">
          <div className="fps-player-title"><span className="fps-player-glyph">{classMark(player.classId)}</span><span>{player.name}</span><small>LV {player.stats.level}</small></div>
          <div className="fps-resource-row"><span>HP</span><div className="fps-bar"><i className="fps-health-bar" style={{ width: hpPercent + '%' }} /></div><b>{Math.ceil(player.stats.hp)}/{Math.ceil(snapshot.derivedStats.maxHealth)}</b></div>
          <div className="fps-resource-row"><span>MP</span><div className="fps-bar"><i className="fps-mana-bar" style={{ width: mpPercent + '%' }} /></div><b>{Math.floor(player.stats.mp)}/{Math.floor(snapshot.derivedStats.maxMana)}</b></div>
          <div className="fps-resource-row"><span>STA</span><div className="fps-bar"><i className="fps-stamina-bar" style={{ width: staminaPercent + '%' }} /></div><b>{Math.floor(player.stats.stamina ?? snapshot.derivedStats.maxStamina)}/{Math.floor(snapshot.derivedStats.maxStamina)}</b></div>
          {(snapshot.parryWindowSeconds > 0 || snapshot.parryRecoverySeconds > 0 || snapshot.guarding) && <div className="fps-defense-hint">{defenseLabel}</div>}
          <div className="fps-resource-row fps-xp-row"><span>XP</span><div className="fps-bar"><i className="fps-xp-bar" style={{ width: xpPercent + '%' }} /></div><b>{player.stats.xp}/{xpNeeded}</b></div>
          <div className="fps-resource-ornaments">
            <div className="fps-thread-resource" aria-label={'Thread Charges ' + (snapshot.world.floor.threadProgress?.charges ?? 0) + ' of ' + (snapshot.world.floor.threadProgress?.maxCharges ?? 3)} title="Ariadne’s Thread">
              <ActionGlyph kind="focus" />
              <b>{snapshot.world.floor.threadProgress?.charges ?? 0}<small>/{snapshot.world.floor.threadProgress?.maxCharges ?? 3}</small></b>
            </div>
            {player.statusEffects.filter(status => status.durationSeconds > 0 && status.statusId !== 'prepared_damage').length > 0 && <div className="fps-status-icons" aria-label="Active effects">
              {player.statusEffects.filter(status => status.durationSeconds > 0 && status.statusId !== 'prepared_damage').map(status => {
                const statusId = status.statusId.toLowerCase();
                const glyph: ActionGlyphKind = statusId.includes('poison') || statusId.includes('venom') ? 'venom'
                  : statusId.includes('fire') || statusId.includes('burn') ? 'flame'
                    : statusId.includes('curse') || statusId.includes('slow') ? 'arcane' : 'focus';
                return <span className={'fps-status-icon fps-status-' + statusId} key={status.id} title={statusId.replace(/_/g, ' ') + ' · ' + status.durationSeconds.toFixed(1) + 's'} aria-label={statusId.replace(/_/g, ' ') + ', ' + status.durationSeconds.toFixed(1) + ' seconds'}>
                  <ActionGlyph kind={glyph} /><b>{status.durationSeconds.toFixed(0)}</b>
                </span>;
              })}
            </div>}
          </div>
        </div>
        <div className="fps-floor-label">FLOOR {snapshot.world.level}<span>{biomeName(snapshot.world.biome)}</span></div>
        <CompactMinimap snapshot={snapshot} onOpen={() => { runtime.mapOpen = true; runtime.inventoryOpen = false; runtime.cancelHeldActions(); refreshSnapshot(); }} />
        <div className="fps-top-actions">
          <button aria-label="Open pause menu" onClick={openPauseMenu}>MENU <kbd>ESC</kbd></button>
        </div>
      </header>

      <div className={'fps-crosshair fps-crosshair-' + loadout.primary.family.toLowerCase() + (targetActionValid ? ' target-lock' : '')} data-weapon-family={loadout.primary.family} aria-hidden="true"><i /><b /><i /></div>
      {target && <div className="fps-target-panel">
        <div><span>{target.isBoss ? 'GUARDIAN' : 'HOSTILE'}</span><strong>{target.name}</strong></div>
        <div className="fps-target-health"><i style={{ width: Math.max(0, target.health / target.maxHealth * 100) + '%' }} /></div>
        {target.maxPoise !== undefined && target.maxPoise > 0 && <><div className="fps-target-meter-label"><span>POISE</span><b>{Math.ceil(target.poise ?? target.maxPoise)}/{Math.ceil(target.maxPoise)}</b></div><div className="fps-target-poise"><i style={{ width: Math.max(0, Math.min(100, (target.poise ?? target.maxPoise) / target.maxPoise * 100)) + '%' }} /></div></>}
      </div>}
      {snapshot.incomingAttacks.length > 0 && <div className="fps-attack-read" role="region" aria-live="off" aria-label="Incoming attacks">
        {snapshot.incomingAttacks.map(attack => <div key={attack.id} className={attack.parryable ? 'fps-attack-parryable' : 'fps-attack-unparryable'}><b>{attack.direction}</b><strong>{attack.name}</strong><span>{attack.parryable ? 'Q PARRY' : 'DODGE / BLOCK'} · {attack.seconds.toFixed(1)}s</span></div>)}
      </div>}
      {snapshot.prompt && <div className="fps-interact-prompt">{snapshot.prompt}</div>}
      {snapshot.toast && <div className="fps-toast" role="status">{snapshot.toast}</div>}
      {migrationNotice && <div className="fps-migration-notice" role="status">{migrationNotice}</div>}
      <div className="fps-combat-log" aria-live="polite">{snapshot.log.slice(-3).map((line, index) => <div key={line + index}>{line}</div>)}</div>

      <footer className="fps-bottom-hud">
        <div className="fps-action-bar" aria-label="Combat actions">
          <section className="fps-action-group fps-weapon-action-group" aria-label="Weapon actions">
            <h2>WEAPON</h2>
            <div className="fps-action-cards">
              <div className="fps-action-card fps-weapon-card" title={abilityTooltip(primary, { staminaCost: actionStaminaCost(primary, primaryWeaponSlot) }) + `\n${primarySource} · ${primaryHandLabel}`}>
                <kbd>LMB</kbd><ActionGlyph kind={actionGlyphForFamily(loadout.primary.family)} />
                <span className="fps-action-copy"><strong>{primary.name}</strong><small>{primarySource}</small><small>{staminaCostLabel(primary, primaryWeaponSlot)}</small>
                  <small className={snapshot.primaryCooldown > 0 ? 'fps-cooldown-active' : ''}>{snapshot.primaryCooldown > 0 ? snapshot.primaryCooldown.toFixed(1) + 's cooldown' : 'Ready'}</small></span>
              </div>
              <div className={'fps-action-card fps-weapon-card' + (snapshot.guarding ? ' fps-guarding' : '')} title={abilityTooltip(secondary, { staminaCost: actionStaminaCost(secondary, secondaryWeaponSlot) }) + `\n${secondarySource} · ${secondaryHandLabel}`}>
                <kbd>RMB</kbd><ActionGlyph kind={actionGlyphForFamily(loadout.secondary.family)} />
                <span className="fps-action-copy"><strong>{secondary.name}</strong><small>{secondarySource}</small><small>{staminaCostLabel(secondary, secondaryWeaponSlot)}</small>
                  <small className={snapshot.secondaryCooldown > 0 ? 'fps-cooldown-active' : ''}>{snapshot.guarding ? 'Guarding' : snapshot.secondaryCooldown > 0 ? snapshot.secondaryCooldown.toFixed(1) + 's cooldown' : secondary.chargeMinSeconds ? 'Hold to charge' : 'Ready'}</small></span>
              </div>
            </div>
          </section>
          {hasShield && <section className="fps-action-group fps-defense-action-group" aria-label="Defense actions">
            <h2>DEFENSE</h2>
            <div className="fps-action-cards">
              <div className={'fps-action-card fps-parry-card' + (snapshot.parryWindowSeconds > 0 ? ' fps-parry-open' : '')} title="Timed shield parry. Costs 18 stamina; only marked attacks can be parried.">
                <kbd>Q</kbd><ActionGlyph kind="shield" /><span className="fps-action-copy"><strong>Parry</strong><small>{snapshot.parryWindowSeconds > 0 ? 'Window open' : snapshot.parryRecoverySeconds > 0 ? 'Recovery' : '18 stamina'}</small></span>
              </div>
            </div>
          </section>}
          <section className="fps-action-group fps-class-skill-group" aria-label="Class skills">
            <h2>CLASS SKILLS</h2>
            <div className="fps-action-cards">
          {skills.map((skill, index) => {
            if (!skill) return <div key={'empty-skill-' + index} className="fps-action-card fps-skill-card fps-action-card-empty" title={'Skill slot ' + (index + 1) + ' is empty'}><kbd>{index + 1}</kbd><ActionGlyph kind="arcane" /><span className="fps-action-copy"><strong>Empty</strong><small>No class skill</small></span></div>;
            const tooltip = skill.unlocked
              ? abilityTooltip(skill.ability, { manaCost: skill.effectiveManaCost, cooldownSeconds: skill.effectiveCooldown, staminaCost: 0 }) + ` Rank ${skill.rank}.`
              : abilityTooltip(skill.ability, { staminaCost: 0 }) + ` ${skill.lockMessage}`;
            const slotLabel = skill.unlocked ? 'Rank ' + skill.rank
              : player.stats.level >= (skill.unlockLevel ?? 1) ? 'Choose · skill point'
                : 'Unlock · Lv ' + (skill.unlockLevel ?? '?');
            const availability = !skill.unlocked ? 'Locked'
              : snapshot.skillCooldowns[index] > 0 ? snapshot.skillCooldowns[index].toFixed(1) + 's cooldown'
              : player.stats.mp < skill.effectiveManaCost ? 'Insufficient MP'
                : skill.effectiveManaCost.toFixed(skill.effectiveManaCost % 1 ? 1 : 0) + ' MP · Ready';
            const available = skill.unlocked && snapshot.skillCooldowns[index] <= 0 && player.stats.mp >= skill.effectiveManaCost;
            return <button key={skill.ability.id} className={'fps-action-card fps-skill-card' + (!available ? ' fps-skill-locked' : '')} title={tooltip} aria-label={skill.ability.name + ' · ' + slotLabel + ' · ' + availability} aria-disabled={!available} onMouseEnter={() => setSkillDetailsIndex(index)} onFocus={() => setSkillDetailsIndex(index)} onClick={() => { setSkillDetailsIndex(index); if (available) inputRef.current?.triggerSkill(index + 1); }}>
              <kbd>{index + 1}</kbd><ActionGlyph kind={actionGlyphForSkill(skill.ability)} /><span className="fps-action-copy"><strong>{skill.ability.name}</strong><small>{slotLabel}</small><small className={snapshot.skillCooldowns[index] > 0 || player.stats.mp < skill.effectiveManaCost ? 'fps-cooldown-active' : ''}>{availability}</small></span>
            </button>;
          })}
            </div>
          </section>
        </div>
        <div className="fps-bottom-stats"><span>ARMOR {Math.round(snapshot.derivedStats.armor)}</span><span>{snapshot.enemies.filter(enemy => enemy.health > 0).length} HOSTILES</span>{kit && <span className="fps-passive-hud" title={kit.passive.description}>{kit.passive.name}{passiveSummary ? ' · ' + passiveSummary : ''}</span>}</div>
      </footer>

      <div className="fps-mobile-hints" aria-hidden="true"><span>MOVE</span><span>LOOK</span></div>
      <div className="fps-mobile-actions">
        <button aria-label="Open inventory" onPointerDown={event => { event.preventDefault(); inputRef.current?.triggerInventory(); }}>BAG</button>
        <button aria-label="Interact" onPointerDown={event => { event.preventDefault(); inputRef.current?.triggerInteract(); }}>E</button>
        <button aria-label="Dodge" onPointerDown={event => { event.preventDefault(); inputRef.current?.triggerDodge(); }}>DODGE</button>
        {hasShield && <button aria-label="Shield parry" onPointerDown={event => { event.preventDefault(); inputRef.current?.triggerParry(); }}>PARRY</button>}
        <button className="fps-mobile-primary" aria-label="Primary Attack" onPointerDown={event => { event.preventDefault(); inputRef.current?.triggerPrimary(); }}>ATTACK</button>
        <button aria-label="Secondary Attack" onPointerDown={event => { event.preventDefault(); inputRef.current?.beginSecondary(); }} onPointerUp={event => { event.preventDefault(); inputRef.current?.endSecondary(); }} onPointerCancel={() => inputRef.current?.endSecondary()}>RMB</button>
        {skills.map((skill, index) => skill && <button key={'touch-skill-' + index} className="fps-mobile-skill-slot" aria-label={skill.unlocked ? skill.ability.name + ', rank ' + skill.rank : skill.ability.name + ', ' + skill.lockMessage} title={skill.unlocked ? abilityTooltip(skill.ability, { manaCost: skill.effectiveManaCost, cooldownSeconds: skill.effectiveCooldown }) + ` Rank ${skill.rank}.` : skill.lockMessage} disabled={!skill.unlocked} onPointerDown={event => { event.preventDefault(); setSkillDetailsIndex(index); inputRef.current?.triggerSkill(index + 1); }}>{index + 1}</button>)}
      </div>

      {selectedSkillDetails && <aside className="fps-skill-details" role="status" aria-live="polite">
        <button aria-label="Close skill details" onClick={() => setSkillDetailsIndex(null)}>×</button>
        <strong>{selectedSkillDetails.ability.name} · {selectedSkillDetails.unlocked ? 'Rank ' + selectedSkillDetails.rank : selectedSkillDetails.lockMessage}</strong>
        <span>{selectedSkillDetails.ability.description}</span>
        <small>{abilityTooltip(selectedSkillDetails.ability, { manaCost: selectedSkillDetails.effectiveManaCost, cooldownSeconds: selectedSkillDetails.effectiveCooldown, staminaCost: 0 }).replace(selectedSkillDetails.ability.name + ' — ', '')}</small>
      </aside>}

      {snapshot.paused && !snapshot.gameOver && <Overlay title="Paused" onClose={closeOverlay}>
        <p className="fps-overlay-copy">The simulation is paused. Your Labyrinth position and cooldowns are held until you resume.</p>
        <div className="fps-overlay-actions fps-pause-actions">
          <button className="fps-button fps-button-primary" onClick={closeOverlay}>Resume</button>
          <button className="fps-button" onClick={openMapFromPause}>Open Map <kbd>Tab</kbd></button>
          <button className="fps-button" onClick={openInventoryFromPause}>Inventory & Equipment <kbd>I</kbd></button>
          <button className="fps-button" onClick={() => { runtime.openMazeChronicle(); refreshSnapshot(); }}>Maze Chronicle</button>
          {(player.skillPoints ?? 0) > 0 && <button className="fps-button" onClick={() => { runtime.openSkillUpgradeScreen(); refreshSnapshot(); }}>Class Skills</button>}
          <button className="fps-button" onClick={saveRun}>Save Run</button>
          <button className="fps-button" onClick={returnToMenu}>Save & Main Menu</button>
        </div>
        <UiScaleControl value={uiScale} onChange={updateUiScale} />
      </Overlay>}

      {snapshot.chronicleOpen && <Overlay title="Maze Chronicle" onClose={() => { runtime.closeMazeChronicle(); refreshSnapshot(); }} className="fps-overlay-panel-wide">
        <MazeChroniclePanel chronicle={snapshot.world.mazeChronicle} activeLaws={snapshot.world.floor.lawProgress?.activeLaws ?? []} />
      </Overlay>}

      {snapshot.levelUpOpen && <Overlay title="Class Skill Progression" onClose={() => { runtime.deferSkillUpgrade(); refreshSnapshot(); }}>
        <SkillUpgradeScreen player={player} options={snapshot.skillUpgradeChoices} onChoose={abilityId => { runtime.chooseSkillUpgrade(abilityId); refreshSnapshot(); }} onLater={() => { runtime.deferSkillUpgrade(); refreshSnapshot(); }} />
      </Overlay>}

      {snapshot.inventoryOpen && <Overlay title="Inventory & Equipment" onClose={closeOverlay} className="fps-overlay-panel-wide fps-inventory-overlay">
        <InventoryPanel
          player={player}
          onEquip={instanceId => { const result = runtime.equip(instanceId); refreshSnapshot(); return result; }}
          onUnequip={slot => { const result = runtime.unequip(slot); refreshSnapshot(); return result; }}
          onUse={instanceId => { runtime.useItem(instanceId); refreshSnapshot(); }}
          onMove={(instanceId, x, y) => { const moved = runtime.moveItem(instanceId, x, y); if (moved) refreshSnapshot(); return moved; }}
          onSplit={instanceId => { const split = runtime.splitItem(instanceId); if (split) refreshSnapshot(); return split; }}
          onDrop={instanceId => { const dropped = runtime.dropItem(instanceId); if (dropped) refreshSnapshot(); return dropped; }}
        />
      </Overlay>}

      {snapshot.mapOpen && <Overlay title={'Labyrinth Map · Floor ' + snapshot.world.level} onClose={closeOverlay}>
        <DungeonMap snapshot={snapshot} />
      </Overlay>}

      {snapshot.roomOffer && <Overlay title={snapshot.roomOffer.title} onClose={() => { runtime.roomOffer = null; refreshSnapshot(); }}>
        <p className="fps-overlay-copy">{snapshot.roomOffer.description}</p>
        <div className="fps-room-choices">{snapshot.roomOffer.choices.map(choice => <button key={choice.id} className="fps-room-choice" onClick={() => { runtime.resolveRoomChoice(choice.id); refreshSnapshot(); }}><strong>{choice.label}</strong><span>{choice.detail}</span></button>)}</div>
      </Overlay>}

      {snapshot.lawOffer && <Overlay title="The Loom of Fate" onClose={() => { runtime.closeLawOffer(); refreshSnapshot(); }} className="fps-overlay-panel-wide">
        <p className="fps-overlay-copy">Every victory rewrites the Maze.</p>
        {snapshot.lawOffer.pendingLawId ? <LawReplacementPanel
          progress={snapshot.world.floor.lawProgress!}
          pendingLawId={snapshot.lawOffer.pendingLawId}
          onReplace={lawId => { runtime.replaceLaw(lawId); refreshSnapshot(); }}
          onBack={() => { runtime.cancelLawReplacement(); refreshSnapshot(); }}
        /> : <>
          <div className="fps-law-cards">{snapshot.lawOffer.lawIds.map(lawId => {
            const law = getMazeLaw(lawId)!;
            return <button key={law.lawId} className="fps-law-card" onClick={() => { runtime.selectLaw(law.lawId); refreshSnapshot(); }}>
              <span className="fps-law-category">{law.category}</span><strong>{law.lawId.replace(/_/g, ' ')}</strong>
              <span><b>What changes</b>{law.whatChanges}</span>
              <span><b>Danger</b>{law.danger}</span>
              <span><b>Reward</b>{law.reward}</span>
              <small className="fps-law-warning">The Beast will remember this choice.</small>
            </button>;
          })}</div>
          <p className="fps-law-capacity">Choose one Law. It changes a future floor; your current floor remains open until you descend.</p>
          <div className="fps-overlay-actions"><button className="fps-button" onClick={() => { runtime.closeLawOffer(); refreshSnapshot(); }}>Return to the Floor</button></div>
        </>}
      </Overlay>}

      {snapshot.threadOffer && <Overlay title="Ariadne's Thread" onClose={() => { runtime.closeThreadAnchor(); refreshSnapshot(); }} className="fps-overlay-panel-wide">
        <div className="fps-thread-offer-resource"><span>THREAD CHARGES</span><strong>{snapshot.threadOffer.charges}/{snapshot.threadOffer.maxCharges}</strong></div>
        <p className="fps-overlay-copy">Choose one prepared passage. The route will settle only after its safety checks pass, and this anchor can be woven once.</p>
        <div className="fps-thread-choices">{snapshot.threadOffer.choices.map(choice => <button key={choice.routeId} className={'fps-thread-choice ' + choice.risk.toLowerCase()} disabled={!choice.enabled} onClick={() => { runtime.chooseThreadRoute(choice.action); refreshSnapshot(); }}>
          <span className="fps-thread-route-heading"><b>{choice.arrow}</b><strong>{choice.action === 'REVEAL_PASSAGE' ? 'Reveal Passage' : 'Seal a Passage'}</strong><em>{choice.risk}</em></span>
          <span className="fps-thread-cost">Cost · {choice.cost} Thread Charge{choice.cost === 1 ? '' : 's'}{choice.healthCost > 0 ? ' + ' + choice.healthCost + ' HP' : ''}</span>
          <span>{choice.effect}</span>
          {!choice.enabled && <span className="fps-thread-disabled-reason">{choice.disabledReason}</span>}
        </button>)}</div>
        <div className="fps-overlay-actions"><button className="fps-button" onClick={() => { runtime.closeThreadAnchor(); refreshSnapshot(); }}>Return without weaving</button></div>
      </Overlay>}

      {snapshot.gameOver && <Overlay title="Lost to the Labyrinth" onClose={returnToMenu}>
        <p className="fps-overlay-copy">Floor {snapshot.world.level} · Level {player.stats.level}. Your run can be saved before leaving.</p>
        <div className="fps-overlay-actions"><button className="fps-button fps-button-primary" onClick={saveRun}>Save Run</button><button className="fps-button" onClick={returnToMenu}>Main Menu</button></div>
      </Overlay>}
    </>}
    {webglError && <div className="fps-renderer-error"><div><div className="fps-kicker">WEBGL INITIALIZATION FAILED</div><h2>The Labyrinth could not be rendered.</h2><p>{webglError}</p><p>Try a browser with WebGL 2 enabled or updated graphics drivers.</p><button className="fps-button fps-button-primary" onClick={returnToMenu}>Return to Main Menu</button></div></div>}
  </main>;
};

const Overlay: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; className?: string }> = ({ title, onClose, children, className = '' }) => {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const firstControl = panel?.querySelector<HTMLElement>('button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
    (firstControl ?? panel)?.focus({ preventScroll: true });
    return () => previouslyFocused?.focus({ preventScroll: true });
  }, []);

  const keepFocusInside = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return;
    const controls = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])
      .filter(control => control.offsetParent !== null);
    if (!controls.length) { event.preventDefault(); panelRef.current?.focus(); return; }
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || !panelRef.current?.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !panelRef.current?.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  };

  return <div className="fps-overlay-backdrop" role="dialog" aria-modal="true" aria-label={title}>
    <section ref={panelRef} tabIndex={-1} onKeyDown={keepFocusInside} className={'fps-overlay-panel ' + className}><header><div className="fps-kicker">MAZE OF THE MINOTAUR</div><h2>{title}</h2><button aria-label="Close" onClick={onClose}>×</button></header><div className="fps-overlay-content">{children}</div></section>
  </div>;
};

const UiScaleControl: React.FC<{ value: number; onChange: (value: number) => void }> = ({ value, onChange }) => <label className="fps-ui-scale-setting">
  <span><strong>Interface scale</strong><small>Adjust HUD and menu readability.</small></span>
  <select aria-label="Interface scale" value={value} onChange={event => onChange(Number(event.target.value))}>
    <option value={0.9}>90%</option>
    <option value={1}>100%</option>
    <option value={1.15}>115%</option>
    <option value={1.25}>125%</option>
  </select>
</label>;

const DungeonMap: React.FC<{ snapshot: FPSGameSnapshot }> = ({ snapshot }) => <div className="fps-map-wrap"><div className="fps-map-grid" style={{ gridTemplateColumns: 'repeat(' + (snapshot.world.map[0]?.length ?? 12) + ', minmax(0,1fr))' }}>
  {snapshot.world.map.map((row, z) => row.map((tile, x) => {
    const explored = Boolean(snapshot.world.explored[z]?.[x]);
    const playerCell = Math.floor(snapshot.player.position.x) === x && Math.floor(snapshot.player.position.z) === z;
    const threadAnchor = explored && (snapshot.world.floor.threadJunctions ?? []).some(junction => junction.anchorPosition.x === x && junction.anchorPosition.y === z
      && snapshot.world.floor.threadProgress?.anchorStates.some(state => state.junctionId === junction.id && state.discovered));
    const className = !explored ? 'unseen' : playerCell ? 'player' : threadAnchor ? 'thread-anchor' : tile === 1 ? 'wall' : tile === 3 ? 'exit' : tile === 2 ? 'door' : 'floor';
    return <i className={'fps-map-cell ' + className} key={x + ':' + z} title={threadAnchor ? 'Discovered Thread Anchor' : undefined} />;
  }))}
</div><p className="fps-muted">Unexplored rooms stay hidden. The cyan marker is your position, the gold marker is the floor exit, and teal marks a discovered Thread Anchor.</p></div>;

const LawReplacementPanel: React.FC<{ progress: MazeLawProgress; pendingLawId: MazeLawId; onReplace: (lawId: MazeLawId) => void; onBack: () => void }> = ({ progress, pendingLawId, onReplace, onBack }) => {
  const ordered = [...progress.activeLaws].sort((a, b) => a.acquiredOrder - b.acquiredOrder);
  const oldest = ordered[0]?.lawId;
  return <div className="fps-law-replacement">
    <p className="fps-overlay-copy">Your pattern holds three active Laws. Choose one to replace with <strong>{pendingLawId.replace(/_/g, ' ')}</strong>. The oldest Law is marked, but the choice is yours.</p>
    <div className="fps-room-choices">{ordered.map(active => <button key={active.lawId} className="fps-room-choice" onClick={() => onReplace(active.lawId)}>
      <strong>{active.lawId.replace(/_/g, ' ')}{active.lawId === oldest ? ' · Oldest' : ''}</strong>
      <span>{getMazeLaw(active.lawId)?.whatChanges ?? 'This Law shapes future Labyrinth floors.'}</span>
    </button>)}</div>
    <div className="fps-overlay-actions"><button className="fps-button" onClick={onBack}>Back to the Three Laws</button></div>
  </div>;
};

const CompactMinimap: React.FC<{ snapshot: FPSGameSnapshot; onOpen: () => void }> = ({ snapshot, onOpen }) => <button className="fps-mini-map-button" aria-label="Open dungeon map" onClick={onOpen}>
  <span>MAP</span>
  <i className="fps-mini-map-grid" style={{ gridTemplateColumns: 'repeat(' + (snapshot.world.map[0]?.length ?? 12) + ', minmax(0,1fr))' }} aria-hidden="true">
    {snapshot.world.map.map((row, z) => row.map((tile, x) => {
      const explored = Boolean(snapshot.world.explored[z]?.[x]);
      const playerCell = Math.floor(snapshot.player.position.x) === x && Math.floor(snapshot.player.position.z) === z;
      const threadAnchor = explored && (snapshot.world.floor.threadJunctions ?? []).some(junction => junction.anchorPosition.x === x && junction.anchorPosition.y === z
        && snapshot.world.floor.threadProgress?.anchorStates.some(state => state.junctionId === junction.id && state.discovered));
      const className = !explored ? 'unseen' : playerCell ? 'player' : threadAnchor ? 'thread-anchor' : tile === 3 ? 'exit' : tile === 2 ? 'door' : tile === 1 ? 'wall' : 'floor';
      return <i className={'fps-map-cell ' + className} key={x + ':' + z} />;
    }))}
  </i>
</button>;

function classMark(classId: ClassType): string {
  const marks: Record<ClassType, string> = { BARBARIAN: 'Λ', PALADIN: '◉', SORCERER: '☼', ROGUE: '⌁', RANGER: '➶', CLERIC: '⚕', MONK: '⊙', NECROMANCER: '☾' };
  return marks[classId];
}

function biomeName(biome: string): string {
  return LABYRINTH_THEMES[biome as keyof typeof LABYRINTH_THEMES]?.name.toUpperCase() ?? biome.toUpperCase();
}

export default App;
