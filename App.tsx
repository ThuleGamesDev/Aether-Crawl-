import React, { useEffect, useRef, useState } from 'react';
import { CLASSES } from './constants';
import { abilityTooltip, CLASS_ABILITY_LOADOUT, getAbility } from './combat/AbilityRegistry';
import FPSViewport from './components/FPSViewport';
import { FPSGameRuntime, type FPSGameSnapshot } from './engine/FPSGameRuntime';
import { loadMazeGame } from './services/mazeSave';
import { LABYRINTH_THEMES } from './data/mazeContent';
import type { ClassType } from './types';
import type { InputSystem } from './engine/InputSystem';
import type { VFXMode } from './presentation/vfxDefinitions';
import InventoryPanel from './components/InventoryPanel';
import SkillUpgradeScreen from './components/SkillUpgradeScreen';
import { getClassSkillKit } from './data/classSkillKits';
import { classPassiveStackSummary } from './player/ClassPassives';
import { getClassSkillUnlockLevel, getRankedAbility, getSkillRank } from './player/SkillProgression';

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
  const [vfxMode, setVfxMode] = useState<VFXMode>('full');
  const [skillDetailsIndex, setSkillDetailsIndex] = useState<number | null>(null);

  useEffect(() => {
    const result = loadMazeGame();
    setHasSave(Boolean(result.save));
    if (result.invalid) setSaveWarning('A saved expedition is invalid or unavailable. Existing save data has not been overwritten.');
    else if (result.migrationRequired) setSaveWarning((result.migratedFromR1 ? 'An FPS-R1' : result.migratedFromR4A ? 'An FPS-R4A' : 'An FPS-R2A') + ' expedition is ready to migrate when you continue. Its original save is preserved until the new save is written.');
    try {
      const savedSensitivity = Number(window.localStorage.getItem('aether_fps_mouse_sensitivity'));
      if (Number.isFinite(savedSensitivity) && savedSensitivity >= 0.001 && savedSensitivity <= 0.006) setMouseSensitivity(savedSensitivity);
      const savedVfxMode = window.localStorage.getItem('aether_fps_vfx_mode_r3b');
      if (savedVfxMode === 'full' || savedVfxMode === 'reduced' || savedVfxMode === 'off') setVfxMode(savedVfxMode);
    } catch { /* Sensitivity storage is optional. */ }
  }, []);

  useEffect(() => {
    if (!snapshot || !(snapshot.inventoryOpen || snapshot.mapOpen || snapshot.paused || snapshot.levelUpOpen || snapshot.roomOffer)) return;
    if (document.pointerLockElement) document.exitPointerLock?.();
    inputRef.current?.clearActiveInputs();
  }, [snapshot?.inventoryOpen, snapshot?.mapOpen, snapshot?.paused, snapshot?.roomOffer]);

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
          : result.migratedFromR4A
            ? 'FPS-R4A item data moved to the expanded inventory safely. Your saved items were preserved.'
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

  if (mode === 'MENU') return (
    <main className="fps-menu-screen">
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
    <main className="fps-menu-screen">
      <section className="fps-class-select">
        <button className="fps-back-button" onClick={() => setMode('MENU')}>← Main Menu</button>
        <div className="fps-kicker">CHOOSE YOUR CLASS</div>
        <h2>One hero enters the Labyrinth.</h2>
        <p className="fps-muted">Choose a champion of the old world. Each hero begins with a primary action, a secondary action and a class skill.</p>
        <div className="fps-class-grid">
          {CLASS_IDS.map(classId => {
            const definition = CLASSES[classId];
            const abilities = CLASS_ABILITY_LOADOUT[classId];
            const kit = getClassSkillKit(classId);
            return <article className="fps-class-card" key={classId}>
              <div className="fps-class-mark">{classMark(classId)}</div>
              <h3>{definition.name}</h3>
              <p>{definition.description}</p>
              <div className="fps-class-stats">HP {definition.stats.maxHp} · MP {definition.stats.maxMp}</div>
              <div className="fps-class-attack">{getAbility(abilities.primary)?.name} / {getAbility(abilities.secondary)?.name}</div>
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
    <main className="fps-menu-screen">
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
        <p className="fps-muted">Reduced lowers ordinary particle count and brightness. Off hides combat effects. Guardian attack warnings remain visible in every mode.</p>
        <p className="fps-muted">On touch screens, drag the left side of the view to move and the right side to look. Use the buttons in the lower-right corner for attacks and dodge.</p>
      </section>
    </main>
  );

  const runtime = runtimeRef.current;
  if (!runtime || !snapshot) return null;
  const player = snapshot.player;
  const target = snapshot.targetEnemy;
  const hpPercent = Math.max(0, Math.min(100, player.stats.hp / snapshot.derivedStats.maxHealth * 100));
  const mpPercent = snapshot.derivedStats.maxMana > 0 ? Math.max(0, Math.min(100, player.stats.mp / snapshot.derivedStats.maxMana * 100)) : 0;
  const xpNeeded = 20 + player.stats.level * 20;
  const xpPercent = Math.max(0, Math.min(100, player.stats.xp / xpNeeded * 100));
  const primary = getAbility(snapshot.primaryAbilityId)!;
  const secondary = getAbility(snapshot.secondaryAbilityId)!;
  const skills = snapshot.skillAbilityIds.map((id, index) => {
    const base = id ? getAbility(id) : null;
    if (!base || !id) return null;
    const rank = getSkillRank(player, id);
    const unlocked = rank > 0;
    const unlockLevel = getClassSkillUnlockLevel(player.classId, index + 1);
    const lockMessage = unlockLevel !== null && player.stats.level >= unlockLevel
      ? 'Not learned · choose with a skill point at level-up.'
      : 'Unlock at level ' + (unlockLevel ?? '?') + '.';
    const ability = unlocked ? getRankedAbility(player, id) ?? base : base;
    return {
      ability, rank, unlocked, unlockLevel, lockMessage,
      effectiveManaCost: ability.manaCost * snapshot.derivedStats.manaCostMultiplier,
      effectiveCooldown: ability.cooldownSeconds * snapshot.derivedStats.cooldownMultiplier,
    };
  });
  const kit = getClassSkillKit(player.classId);
  const passiveSummary = classPassiveStackSummary(player.classPassiveState);
  const selectedSkillDetails = skillDetailsIndex === null ? null : skills[skillDetailsIndex] ?? null;

  return <main className="fps-game-shell">
    <FPSViewport runtime={runtime} mouseSensitivity={mouseSensitivity} vfxMode={vfxMode} onSnapshot={setSnapshot} onInputReady={input => { inputRef.current = input; }} onFailure={setWebglError} />
    {!webglError && <>
      <div className="fps-vignette" aria-hidden="true" />
      <header className="fps-top-hud">
        <div className="fps-player-panel">
          <div className="fps-player-title"><span className="fps-player-glyph">{classMark(player.classId)}</span><span>{player.name}</span><small>LV {player.stats.level}</small></div>
          <div className="fps-resource-row"><span>HP</span><div className="fps-bar"><i className="fps-health-bar" style={{ width: hpPercent + '%' }} /></div><b>{Math.ceil(player.stats.hp)}/{Math.ceil(snapshot.derivedStats.maxHealth)}</b></div>
          <div className="fps-resource-row"><span>MP</span><div className="fps-bar"><i className="fps-mana-bar" style={{ width: mpPercent + '%' }} /></div><b>{Math.floor(player.stats.mp)}/{Math.floor(snapshot.derivedStats.maxMana)}</b></div>
          <div className="fps-resource-row fps-xp-row"><span>XP</span><div className="fps-bar"><i className="fps-xp-bar" style={{ width: xpPercent + '%' }} /></div><b>{player.stats.xp}/{xpNeeded}</b></div>
        </div>
        <div className="fps-floor-label">FLOOR {snapshot.world.level}<span>{biomeName(snapshot.world.biome)}</span></div>
        <CompactMinimap snapshot={snapshot} onOpen={() => { runtime.mapOpen = true; runtime.inventoryOpen = false; runtime.cancelHeldActions(); refreshSnapshot(); }} />
        <div className="fps-top-actions">
          <button onClick={() => { runtime.mapOpen = true; runtime.inventoryOpen = false; runtime.cancelHeldActions(); refreshSnapshot(); }}>Map <kbd>Tab</kbd></button>
          <button onClick={() => { runtime.inventoryOpen = true; runtime.mapOpen = false; runtime.cancelHeldActions(); refreshSnapshot(); }}>Inventory <kbd>I</kbd></button>
          <button onClick={saveRun}>Save</button>
          {(player.skillPoints ?? 0) > 0 && <button onClick={() => { runtime.openSkillUpgradeScreen(); refreshSnapshot(); }}>Skills <kbd>{player.skillPoints}</kbd></button>}
          <button onClick={() => { runtime.paused = true; runtime.cancelHeldActions(); refreshSnapshot(); }}>Menu <kbd>Esc</kbd></button>
        </div>
      </header>

      <div className="fps-crosshair" aria-hidden="true"><i /><b /><i /></div>
      {target && <div className="fps-target-panel">
        <div><span>{target.isBoss ? 'GUARDIAN' : 'HOSTILE'}</span><strong>{target.name}</strong></div>
        <div className="fps-target-health"><i style={{ width: Math.max(0, target.health / target.maxHealth * 100) + '%' }} /></div>
      </div>}
      {snapshot.prompt && <div className="fps-interact-prompt">{snapshot.prompt}</div>}
      {snapshot.toast && <div className="fps-toast" role="status">{snapshot.toast}</div>}
      {migrationNotice && <div className="fps-migration-notice" role="status">{migrationNotice}</div>}
      <div className="fps-combat-log" aria-live="polite">{snapshot.log.slice(-3).map((line, index) => <div key={line + index}>{line}</div>)}</div>

      <footer className="fps-bottom-hud">
        <div className="fps-hud-hint">WASD MOVE · MOUSE LOOK · CLICK VIEW TO CAPTURE</div>
        <div className="fps-action-bar" aria-label="Combat actions">
          <div className="fps-action-card" title={abilityTooltip(primary)}><kbd>LMB</kbd><strong>{primary.name}</strong><small>{player.equipment.weapon?.name ?? 'Unarmed'}</small><small className={snapshot.primaryCooldown > 0 ? 'fps-cooldown-active' : ''}>{snapshot.primaryCooldown > 0 ? snapshot.primaryCooldown.toFixed(1) + 's cooldown' : primary.kind === 'MELEE' ? 'Melee · Ready' : primary.kind === 'PROJECTILE' ? 'Projectile · Ready' : 'Area · Ready'}</small></div>
          <div className={'fps-action-card' + (snapshot.guarding ? ' fps-guarding' : '')} title={abilityTooltip(secondary)}><kbd>RMB</kbd><strong>{secondary.name}</strong><small>{snapshot.guarding ? 'Aspis Guard · Active' : snapshot.secondaryCooldown > 0 ? snapshot.secondaryCooldown.toFixed(1) + 's cooldown' : secondary.chargeMinSeconds ? 'Hold to charge' : player.equipment.offhand?.type === 'SHIELD' ? 'Tap Bash · Hold Guard' : 'Ready'}</small></div>
          {skills.map((skill, index) => {
            if (!skill) return <div key={'empty-skill-' + index} className="fps-action-card fps-action-card-empty" title={'Skill slot ' + (index + 1) + ' is empty'}><kbd>{index + 1}</kbd><strong>Empty</strong><small>Skill slot</small></div>;
            const tooltip = skill.unlocked
              ? abilityTooltip(skill.ability, { manaCost: skill.effectiveManaCost, cooldownSeconds: skill.effectiveCooldown }) + ` Rank ${skill.rank}.`
              : abilityTooltip(skill.ability) + ` ${skill.lockMessage}`;
            const slotLabel = skill.unlocked ? 'Rank ' + skill.rank
              : player.stats.level >= (skill.unlockLevel ?? 1) ? 'Choose · skill point'
                : 'Unlock · Lv ' + (skill.unlockLevel ?? '?');
            const availability = !skill.unlocked ? 'Locked'
              : snapshot.skillCooldowns[index] > 0 ? snapshot.skillCooldowns[index].toFixed(1) + 's cooldown'
                : skill.effectiveManaCost.toFixed(skill.effectiveManaCost % 1 ? 1 : 0) + ' MP · Ready';
            return <button key={skill.ability.id} className={'fps-action-card fps-skill-card' + (!skill.unlocked ? ' fps-skill-locked' : '')} title={tooltip} disabled={!skill.unlocked} onMouseEnter={() => setSkillDetailsIndex(index)} onFocus={() => setSkillDetailsIndex(index)} onClick={() => { setSkillDetailsIndex(index); inputRef.current?.triggerSkill(index + 1); }}><kbd>{index + 1}</kbd><strong>{skill.ability.name}</strong><small>{slotLabel}</small><small className={snapshot.skillCooldowns[index] > 0 ? 'fps-cooldown-active' : ''}>{availability}</small></button>;
          })}
        </div>
        <div className="fps-bottom-stats"><span>ARMOR {Math.round(snapshot.derivedStats.armor)}</span><span>LEVEL {snapshot.world.level}</span><span>{snapshot.enemies.filter(enemy => enemy.health > 0).length} HOSTILES</span>{kit && <span className="fps-passive-hud" title={kit.passive.description}>{kit.passive.name}{passiveSummary ? ' · ' + passiveSummary : ''}</span>}{player.statusEffects.filter(status => status.durationSeconds > 0 && status.statusId !== 'prepared_damage').map(status => <span key={status.id} className="fps-status-tag">{status.statusId} {status.durationSeconds.toFixed(0)}s</span>)}</div>
      </footer>

      <div className="fps-mobile-hints" aria-hidden="true"><span>MOVE</span><span>LOOK</span></div>
      <div className="fps-mobile-actions">
        <button aria-label="Open inventory" onPointerDown={event => { event.preventDefault(); inputRef.current?.triggerInventory(); }}>BAG</button>
        <button aria-label="Interact" onPointerDown={event => { event.preventDefault(); inputRef.current?.triggerInteract(); }}>E</button>
        <button aria-label="Dodge" onPointerDown={event => { event.preventDefault(); inputRef.current?.triggerDodge(); }}>DODGE</button>
        <button className="fps-mobile-primary" aria-label="Primary Attack" onPointerDown={event => { event.preventDefault(); inputRef.current?.triggerPrimary(); }}>ATTACK</button>
        <button aria-label="Secondary Attack" onPointerDown={event => { event.preventDefault(); inputRef.current?.beginSecondary(); }} onPointerUp={event => { event.preventDefault(); inputRef.current?.endSecondary(); }} onPointerCancel={() => inputRef.current?.endSecondary()}>RMB</button>
        {skills.map((skill, index) => skill && <button key={'touch-skill-' + index} className="fps-mobile-skill-slot" aria-label={skill.unlocked ? skill.ability.name + ', rank ' + skill.rank : skill.ability.name + ', ' + skill.lockMessage} title={skill.unlocked ? abilityTooltip(skill.ability, { manaCost: skill.effectiveManaCost, cooldownSeconds: skill.effectiveCooldown }) + ` Rank ${skill.rank}.` : skill.lockMessage} disabled={!skill.unlocked} onPointerDown={event => { event.preventDefault(); setSkillDetailsIndex(index); inputRef.current?.triggerSkill(index + 1); }}>{index + 1}</button>)}
      </div>

      {selectedSkillDetails && <aside className="fps-skill-details" role="status" aria-live="polite">
        <button aria-label="Close skill details" onClick={() => setSkillDetailsIndex(null)}>×</button>
        <strong>{selectedSkillDetails.ability.name} · {selectedSkillDetails.unlocked ? 'Rank ' + selectedSkillDetails.rank : selectedSkillDetails.lockMessage}</strong>
        <span>{selectedSkillDetails.ability.description}</span>
        <small>{abilityTooltip(selectedSkillDetails.ability, { manaCost: selectedSkillDetails.effectiveManaCost, cooldownSeconds: selectedSkillDetails.effectiveCooldown }).replace(selectedSkillDetails.ability.name + ' — ', '')}</small>
      </aside>}

      {snapshot.paused && !snapshot.gameOver && <Overlay title="Paused" onClose={closeOverlay}>
        <p className="fps-overlay-copy">The simulation is paused. Your Labyrinth position and cooldowns are held until you resume.</p>
        <div className="fps-overlay-actions"><button className="fps-button fps-button-primary" onClick={closeOverlay}>Resume</button><button className="fps-button" onClick={saveRun}>Save Run</button><button className="fps-button" onClick={returnToMenu}>Save & Main Menu</button></div>
      </Overlay>}

      {snapshot.levelUpOpen && <Overlay title="Class Skill Progression" onClose={() => { runtime.deferSkillUpgrade(); refreshSnapshot(); }}>
        <SkillUpgradeScreen player={player} options={snapshot.skillUpgradeChoices} onChoose={abilityId => { runtime.chooseSkillUpgrade(abilityId); refreshSnapshot(); }} onLater={() => { runtime.deferSkillUpgrade(); refreshSnapshot(); }} />
      </Overlay>}

      {snapshot.inventoryOpen && <Overlay title="Inventory & Equipment" onClose={closeOverlay} className="fps-overlay-panel-wide">
        <InventoryPanel
          player={player}
          onEquip={instanceId => { runtime.equip(instanceId); refreshSnapshot(); }}
          onUnequip={slot => { runtime.unequip(slot); refreshSnapshot(); }}
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

      {snapshot.gameOver && <Overlay title="Lost to the Labyrinth" onClose={returnToMenu}>
        <p className="fps-overlay-copy">Floor {snapshot.world.level} · Level {player.stats.level}. Your run can be saved before leaving.</p>
        <div className="fps-overlay-actions"><button className="fps-button fps-button-primary" onClick={saveRun}>Save Run</button><button className="fps-button" onClick={returnToMenu}>Main Menu</button></div>
      </Overlay>}
    </>}
    {webglError && <div className="fps-renderer-error"><div><div className="fps-kicker">WEBGL INITIALIZATION FAILED</div><h2>The Labyrinth could not be rendered.</h2><p>{webglError}</p><p>Try a browser with WebGL 2 enabled or updated graphics drivers.</p><button className="fps-button fps-button-primary" onClick={returnToMenu}>Return to Main Menu</button></div></div>}
  </main>;
};

const Overlay: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; className?: string }> = ({ title, onClose, children, className = '' }) => <div className="fps-overlay-backdrop" role="dialog" aria-modal="true" aria-label={title}>
  <section className={'fps-overlay-panel ' + className}><header><div className="fps-kicker">MAZE OF THE MINOTAUR</div><h2>{title}</h2><button aria-label="Close" onClick={onClose}>×</button></header><div className="fps-overlay-content">{children}</div></section>
</div>;

const DungeonMap: React.FC<{ snapshot: FPSGameSnapshot }> = ({ snapshot }) => <div className="fps-map-wrap"><div className="fps-map-grid" style={{ gridTemplateColumns: 'repeat(' + (snapshot.world.map[0]?.length ?? 12) + ', minmax(0,1fr))' }}>
  {snapshot.world.map.map((row, z) => row.map((tile, x) => {
    const explored = Boolean(snapshot.world.explored[z]?.[x]);
    const playerCell = Math.floor(snapshot.player.position.x) === x && Math.floor(snapshot.player.position.z) === z;
    const className = !explored ? 'unseen' : playerCell ? 'player' : tile === 1 ? 'wall' : tile === 3 ? 'exit' : tile === 2 ? 'door' : 'floor';
    return <i className={'fps-map-cell ' + className} key={x + ':' + z} />;
  }))}
</div><p className="fps-muted">Unexplored rooms stay hidden. The cyan marker is your position; the gold marker is the floor exit.</p></div>;

const CompactMinimap: React.FC<{ snapshot: FPSGameSnapshot; onOpen: () => void }> = ({ snapshot, onOpen }) => <button className="fps-mini-map-button" aria-label="Open dungeon map" onClick={onOpen}>
  <span>MAP</span>
  <i className="fps-mini-map-grid" style={{ gridTemplateColumns: 'repeat(' + (snapshot.world.map[0]?.length ?? 12) + ', minmax(0,1fr))' }} aria-hidden="true">
    {snapshot.world.map.map((row, z) => row.map((tile, x) => {
      const explored = Boolean(snapshot.world.explored[z]?.[x]);
      const playerCell = Math.floor(snapshot.player.position.x) === x && Math.floor(snapshot.player.position.z) === z;
      const className = !explored ? 'unseen' : playerCell ? 'player' : tile === 3 ? 'exit' : tile === 2 ? 'door' : tile === 1 ? 'wall' : 'floor';
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
