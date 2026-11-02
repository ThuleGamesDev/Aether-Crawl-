import React, { useEffect, useRef, useState } from 'react';
import { CLASSES } from './constants';
import { abilityTooltip, CLASS_ABILITY_LOADOUT, getAbility } from './combat/AbilityRegistry';
import FPSViewport from './components/FPSViewport';
import { FPSGameRuntime, type FPSGameSnapshot } from './engine/FPSGameRuntime';
import { loadMazeGame } from './services/mazeSave';
import { LABYRINTH_THEMES } from './data/mazeContent';
import type { ClassType, EquipmentSlot, ItemInstance } from './types';
import type { InputSystem } from './engine/InputSystem';
import type { VFXMode } from './presentation/vfxDefinitions';

const CLASS_IDS = Object.keys(CLASSES) as ClassType[];
const EQUIPMENT_SLOTS: EquipmentSlot[] = ['weapon', 'armor', 'offhand', 'accessory'];

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

  useEffect(() => {
    const result = loadMazeGame();
    setHasSave(Boolean(result.save));
    if (result.invalid) setSaveWarning('A saved expedition is invalid or unavailable. Existing save data has not been overwritten.');
    else if (result.migratedFromR1) setSaveWarning('An FPS-R1 expedition is ready to migrate when you continue. Its original save will be preserved.');
    try {
      const savedSensitivity = Number(window.localStorage.getItem('aether_fps_mouse_sensitivity'));
      if (Number.isFinite(savedSensitivity) && savedSensitivity >= 0.001 && savedSensitivity <= 0.006) setMouseSensitivity(savedSensitivity);
      const savedVfxMode = window.localStorage.getItem('aether_fps_vfx_mode_r3b');
      if (savedVfxMode === 'full' || savedVfxMode === 'reduced' || savedVfxMode === 'off') setVfxMode(savedVfxMode);
    } catch { /* Sensitivity storage is optional. */ }
  }, []);

  const beginRun = (classId: ClassType) => {
    const runtime = new FPSGameRuntime(classId);
    setMigrationNotice('');
    runtimeRef.current = runtime;
    setSnapshot(runtime.getSnapshot());
    setWebglError('');
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
    if (result.migratedFromR1) {
      runtime.save();
      setMigrationNotice('FPS-R1 progress migrated into the Labyrinth. The original save remains preserved.');
    } else setMigrationNotice('');
    runtimeRef.current = runtime;
    setSnapshot(runtime.getSnapshot());
    setWebglError('');
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
        <p className="fps-muted">Choose a champion of the old world. Each class begins with three working actions.</p>
        <div className="fps-class-grid">
          {CLASS_IDS.map(classId => {
            const definition = CLASSES[classId];
            const abilities = CLASS_ABILITY_LOADOUT[classId];
            return <article className="fps-class-card" key={classId}>
              <div className="fps-class-mark">{classMark(classId)}</div>
              <h3>{definition.name}</h3>
              <p>{definition.description}</p>
              <div className="fps-class-stats">HP {definition.stats.maxHp} · MP {definition.stats.maxMp}</div>
              <div className="fps-class-attack">{getAbility(abilities.primary)?.name} / {getAbility(abilities.skill)?.name}</div>
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
  const hpPercent = Math.max(0, Math.min(100, player.stats.hp / player.stats.maxHp * 100));
  const mpPercent = Math.max(0, Math.min(100, player.stats.mp / player.stats.maxMp * 100));
  const xpNeeded = 20 + player.stats.level * 20;
  const xpPercent = Math.max(0, Math.min(100, player.stats.xp / xpNeeded * 100));
  const primary = getAbility(snapshot.primaryAbilityId)!;
  const secondary = getAbility(snapshot.secondaryAbilityId)!;
  const skills = snapshot.skillAbilityIds.map(id => id ? getAbility(id) : null);

  return <main className="fps-game-shell">
    <FPSViewport runtime={runtime} mouseSensitivity={mouseSensitivity} vfxMode={vfxMode} onSnapshot={setSnapshot} onInputReady={input => { inputRef.current = input; }} onFailure={setWebglError} />
    {!webglError && <>
      <div className="fps-vignette" aria-hidden="true" />
      <header className="fps-top-hud">
        <div className="fps-player-panel">
          <div className="fps-player-title"><span className="fps-player-glyph">{classMark(player.classId)}</span><span>{player.name}</span><small>LV {player.stats.level}</small></div>
          <div className="fps-resource-row"><span>HP</span><div className="fps-bar"><i className="fps-health-bar" style={{ width: hpPercent + '%' }} /></div><b>{Math.ceil(player.stats.hp)}/{player.stats.maxHp}</b></div>
          <div className="fps-resource-row"><span>MP</span><div className="fps-bar"><i className="fps-mana-bar" style={{ width: mpPercent + '%' }} /></div><b>{Math.floor(player.stats.mp)}/{player.stats.maxMp}</b></div>
          <div className="fps-resource-row fps-xp-row"><span>XP</span><div className="fps-bar"><i className="fps-xp-bar" style={{ width: xpPercent + '%' }} /></div><b>{player.stats.xp}/{xpNeeded}</b></div>
        </div>
        <div className="fps-floor-label">FLOOR {snapshot.world.level}<span>{biomeName(snapshot.world.biome)}</span></div>
        <CompactMinimap snapshot={snapshot} onOpen={() => { runtime.mapOpen = true; runtime.inventoryOpen = false; refreshSnapshot(); }} />
        <div className="fps-top-actions">
          <button onClick={() => { runtime.mapOpen = true; runtime.inventoryOpen = false; refreshSnapshot(); }}>Map <kbd>Tab</kbd></button>
          <button onClick={() => { runtime.inventoryOpen = true; runtime.mapOpen = false; refreshSnapshot(); }}>Inventory <kbd>I</kbd></button>
          <button onClick={saveRun}>Save</button>
          <button onClick={() => { runtime.paused = true; refreshSnapshot(); }}>Menu <kbd>Esc</kbd></button>
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
          {skills.map((skill, index) => skill
            ? <button key={skill.id} className="fps-action-card fps-skill-card" title={abilityTooltip(skill)} onClick={() => inputRef.current?.triggerSkill(index + 1)}><kbd>{index + 1}</kbd><strong>{skill.name}</strong><small className={snapshot.skillCooldowns[index] > 0 ? 'fps-cooldown-active' : ''}>{snapshot.skillCooldowns[index] > 0 ? snapshot.skillCooldowns[index].toFixed(1) + 's cooldown' : skill.manaCost + ' MP · Ready'}</small></button>
            : <div key={'empty-skill-' + index} className="fps-action-card fps-action-card-empty" title={'Skill slot ' + (index + 1) + ' is empty'}><kbd>{index + 1}</kbd><strong>Empty</strong><small>Skill slot</small></div>)}
        </div>
        <div className="fps-bottom-stats"><span>ARMOR {player.stats.armor}</span><span>LEVEL {snapshot.world.level}</span><span>{snapshot.enemies.filter(enemy => enemy.health > 0).length} HOSTILES</span>{player.statusEffects.filter(status => status.durationSeconds > 0 && status.statusId !== 'prepared_damage').map(status => <span key={status.id} className="fps-status-tag">{status.statusId} {status.durationSeconds.toFixed(0)}s</span>)}</div>
      </footer>

      <div className="fps-mobile-hints" aria-hidden="true"><span>MOVE</span><span>LOOK</span></div>
      <div className="fps-mobile-actions">
        <button aria-label="Interact" onPointerDown={event => { event.preventDefault(); inputRef.current?.triggerInteract(); }}>E</button>
        <button aria-label="Dodge" onPointerDown={event => { event.preventDefault(); inputRef.current?.triggerDodge(); }}>DODGE</button>
        <button className="fps-mobile-primary" aria-label="Primary Attack" onPointerDown={event => { event.preventDefault(); inputRef.current?.triggerPrimary(); }}>ATTACK</button>
        <button aria-label="Secondary Attack" onPointerDown={event => { event.preventDefault(); inputRef.current?.beginSecondary(); }} onPointerUp={event => { event.preventDefault(); inputRef.current?.endSecondary(); }} onPointerCancel={() => inputRef.current?.endSecondary()}>RMB</button>
        <button className="fps-mobile-skill" aria-label="Class Skill" onPointerDown={event => { event.preventDefault(); inputRef.current?.triggerSkill(1); }}>SKILL</button>
      </div>

      {snapshot.paused && !snapshot.gameOver && <Overlay title="Paused" onClose={closeOverlay}>
        <p className="fps-overlay-copy">The simulation is paused. Your Labyrinth position and cooldowns are held until you resume.</p>
        <div className="fps-overlay-actions"><button className="fps-button fps-button-primary" onClick={closeOverlay}>Resume</button><button className="fps-button" onClick={saveRun}>Save Run</button><button className="fps-button" onClick={returnToMenu}>Save & Main Menu</button></div>
      </Overlay>}

      {snapshot.inventoryOpen && <Overlay title="Inventory & Equipment" onClose={closeOverlay}>
        <div className="fps-inventory-layout">
          <section><h3>Equipped</h3><div className="fps-equipment-list">{EQUIPMENT_SLOTS.map(slot => {
            const item = player.equipment[slot];
            return <div className="fps-equipment-slot" key={slot}><div><small>{slot.toUpperCase()}</small><strong>{item?.name ?? 'Empty'}</strong>{item && <span>Item Level {item.itemLevel} · {item.rarity} · {itemEffect(item)}</span>}</div>{item && <button onClick={() => { runtime.unequip(slot); refreshSnapshot(); }}>Unequip</button>}</div>;
          })}</div></section>
          <section><h3>Bag</h3><div className="fps-inventory-items">{player.inventory.length === 0 && <p className="fps-muted">Your bag is empty.</p>}{player.inventory.map(item => <InventoryItem key={item.instanceId} item={item} onEquip={() => { runtime.equip(item.instanceId); refreshSnapshot(); }} onUse={() => { runtime.useItem(item.instanceId); refreshSnapshot(); }} />)}</div></section>
        </div>
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

const Overlay: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => <div className="fps-overlay-backdrop" role="dialog" aria-modal="true" aria-label={title}>
  <section className="fps-overlay-panel"><header><div className="fps-kicker">MAZE OF THE MINOTAUR</div><h2>{title}</h2><button aria-label="Close" onClick={onClose}>×</button></header><div className="fps-overlay-content">{children}</div></section>
</div>;

const InventoryItem: React.FC<{ item: ItemInstance; onEquip: () => void; onUse: () => void }> = ({ item, onEquip, onUse }) => <article className="fps-item-card">
  <div className="fps-item-icon">{item.icon ?? '◇'}</div><div className="fps-item-info"><strong>{item.name}</strong><span>{item.type} · {item.rarity} · Item Level {item.itemLevel}</span><p>{item.description}</p><small>{itemEffect(item)}</small></div>
  <div className="fps-item-actions">{item.type === 'POTION' ? <button onClick={onUse}>Use</button> : item.type === 'WEAPON' || item.type === 'ARMOR' || item.type === 'SHIELD' || item.type === 'ACCESSORY' ? <button onClick={onEquip}>Equip</button> : null}</div>
</article>;

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

function itemEffect(item: ItemInstance): string {
  if (item.type === 'WEAPON') return 'Weapon Power +' + item.value;
  if (item.type === 'ARMOR' || item.type === 'SHIELD') return 'Defense +' + item.value;
  if (item.type === 'POTION') return /mana|mp|nectar|ambrosial/i.test(item.name) || /mana|_mp/i.test(item.id) ? 'Restores ' + item.value + ' mana' : 'Restores ' + item.value + ' health';
  if (item.type === 'ACCESSORY') return (item.statBonus ?? 'Stat') + ' +' + item.value;
  return item.description;
}

function classMark(classId: ClassType): string {
  const marks: Record<ClassType, string> = { BARBARIAN: 'Λ', PALADIN: '◉', SORCERER: '☼', ROGUE: '⌁', RANGER: '➶', CLERIC: '⚕', MONK: '⊙', NECROMANCER: '☾' };
  return marks[classId];
}

function biomeName(biome: string): string {
  return LABYRINTH_THEMES[biome as keyof typeof LABYRINTH_THEMES]?.name.toUpperCase() ?? biome.toUpperCase();
}

export default App;
