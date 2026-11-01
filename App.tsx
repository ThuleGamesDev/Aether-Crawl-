import React, { useEffect, useRef, useState } from 'react';
import { CLASSES } from './constants';
import { CLASS_ABILITY_LOADOUT, getAbility } from './combat/AbilityRegistry';
import FPSViewport from './components/FPSViewport';
import { FPSGameRuntime, type FPSGameSnapshot } from './engine/FPSGameRuntime';
import { loadFPSGame } from './services/fpsSave';
import type { ClassType, EquipmentSlot, ItemInstance } from './types';
import type { InputSystem } from './engine/InputSystem';

const CLASS_IDS = Object.keys(CLASSES) as ClassType[];
const EQUIPMENT_SLOTS: EquipmentSlot[] = ['weapon', 'armor', 'offhand', 'accessory'];

const App: React.FC = () => {
  const runtimeRef = useRef<FPSGameRuntime | null>(null);
  const inputRef = useRef<InputSystem | null>(null);
  const [mode, setMode] = useState<'MENU' | 'CLASS_SELECT' | 'CONTROLS' | 'PLAY'>('MENU');
  const [snapshot, setSnapshot] = useState<FPSGameSnapshot | null>(null);
  const [hasSave, setHasSave] = useState(false);
  const [saveWarning, setSaveWarning] = useState('');
  const [webglError, setWebglError] = useState('');
  const [mouseSensitivity, setMouseSensitivity] = useState(0.0025);

  useEffect(() => {
    const result = loadFPSGame();
    setHasSave(Boolean(result.save));
    if (result.invalid) setSaveWarning('The R1 save could not be read. Your older party save remains untouched.');
    try {
      const savedSensitivity = Number(window.localStorage.getItem('aether_fps_mouse_sensitivity'));
      if (Number.isFinite(savedSensitivity) && savedSensitivity >= 0.001 && savedSensitivity <= 0.006) setMouseSensitivity(savedSensitivity);
    } catch { /* Sensitivity storage is optional. */ }
  }, []);

  const beginRun = (classId: ClassType) => {
    const runtime = new FPSGameRuntime(classId);
    runtimeRef.current = runtime;
    setSnapshot(runtime.getSnapshot());
    setWebglError('');
    setMode('PLAY');
  };

  const continueRun = () => {
    const result = loadFPSGame();
    if (!result.save) {
      setSaveWarning(result.invalid ? 'The R1 save is invalid or unavailable. It has not been overwritten.' : 'No R1 save is available.');
      setHasSave(false);
      return;
    }
    const runtime = new FPSGameRuntime(result.save.player.classId, result.save);
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

  if (mode === 'MENU') return (
    <main className="fps-menu-screen">
      <div className="fps-menu-frame">
        <div className="fps-kicker">AETHER CRAWL · FPS R1</div>
        <h1>AETHER<br /><span>CRAWL</span></h1>
        <p className="fps-menu-subtitle">A solo dark-fantasy dungeon run.</p>
        <div className="fps-menu-actions">
          {hasSave && <button className="fps-button fps-button-primary" onClick={continueRun}>Continue Run</button>}
          <button className="fps-button fps-button-primary" onClick={() => setMode('CLASS_SELECT')}>New Run</button>
          <button className="fps-button" onClick={() => setMode('CONTROLS')}>Controls & Options</button>
        </div>
        {saveWarning && <p className="fps-menu-warning" role="status">{saveWarning}</p>}
        <p className="fps-menu-note">Find the way through the dungeon. Claim what the dead leave behind.</p>
      </div>
    </main>
  );

  if (mode === 'CLASS_SELECT') return (
    <main className="fps-menu-screen">
      <section className="fps-class-select">
        <button className="fps-back-button" onClick={() => setMode('MENU')}>← Main Menu</button>
        <div className="fps-kicker">CHOOSE YOUR CLASS</div>
        <h2>One hero enters the dungeon.</h2>
        <p className="fps-muted">Barbarian and Sorcerer have the deepest starting kits. Every class has a working primary, secondary, and skill.</p>
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
          <span>Class skill</span><b>1</b>
          <span>Sprint / dodge</span><b>Shift / Space</b>
          <span>Interact / inventory / map</span><b>E / I / Tab</b>
          <span>Pause</span><b>Esc</b>
        </div>
        <label className="fps-sensitivity">Mouse sensitivity <strong>{mouseSensitivity.toFixed(4)}</strong>
          <input type="range" min="0.001" max="0.006" step="0.0001" value={mouseSensitivity} onChange={event => updateSensitivity(Number(event.target.value))} />
        </label>
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
  const skill = getAbility(snapshot.skillAbilityId)!;

  return <main className="fps-game-shell">
    <FPSViewport runtime={runtime} mouseSensitivity={mouseSensitivity} onSnapshot={setSnapshot} onInputReady={input => { inputRef.current = input; }} onFailure={setWebglError} />
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
      <div className="fps-combat-log" aria-live="polite">{snapshot.log.slice(-3).map((line, index) => <div key={line + index}>{line}</div>)}</div>

      <footer className="fps-bottom-hud">
        <div className="fps-hud-hint">WASD MOVE · MOUSE LOOK · CLICK VIEW TO CAPTURE</div>
        <div className="fps-action-bar">
          <div className="fps-action-card"><kbd>LMB</kbd><strong>{primary.name}</strong><small>{player.equipment.weapon?.name ?? 'Unarmed'}</small><small className={snapshot.primaryCooldown > 0 ? 'fps-cooldown-active' : ''}>{snapshot.primaryCooldown > 0 ? snapshot.primaryCooldown.toFixed(1) + 's cooldown' : primary.kind === 'MELEE' ? 'Melee · Ready' : primary.kind === 'PROJECTILE' ? 'Projectile · Ready' : 'Area · Ready'}</small></div>
          <div className="fps-action-card"><kbd>RMB</kbd><strong>{secondary.name}</strong><small>{snapshot.secondaryCooldown > 0 ? snapshot.secondaryCooldown.toFixed(1) + 's' : secondary.chargeMinSeconds ? 'Hold to charge' : 'Ready'}</small></div>
          <button className="fps-action-card fps-skill-card" onClick={() => inputRef.current?.triggerSkill(1)}><kbd>1</kbd><strong>{skill.name}</strong><small>{snapshot.skillCooldown > 0 ? snapshot.skillCooldown.toFixed(1) + 's' : 'Skill'}</small></button>
        </div>
        <div className="fps-bottom-stats"><span>ARMOR {player.stats.armor}</span><span>LEVEL {snapshot.world.level}</span><span>{snapshot.enemies.filter(enemy => enemy.health > 0).length} HOSTILES</span></div>
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
        <p className="fps-overlay-copy">The simulation is paused. Your dungeon position and cooldowns are held until you resume.</p>
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

      {snapshot.mapOpen && <Overlay title={'Dungeon Map · Floor ' + snapshot.world.level} onClose={closeOverlay}>
        <DungeonMap snapshot={snapshot} />
      </Overlay>}

      {snapshot.roomOffer && <Overlay title={snapshot.roomOffer.title} onClose={() => { runtime.roomOffer = null; refreshSnapshot(); }}>
        <p className="fps-overlay-copy">{snapshot.roomOffer.description}</p>
        <div className="fps-room-choices">{snapshot.roomOffer.choices.map(choice => <button key={choice.id} className="fps-room-choice" onClick={() => { runtime.resolveRoomChoice(choice.id); refreshSnapshot(); }}><strong>{choice.label}</strong><span>{choice.detail}</span></button>)}</div>
      </Overlay>}

      {snapshot.gameOver && <Overlay title="You Have Fallen" onClose={returnToMenu}>
        <p className="fps-overlay-copy">Floor {snapshot.world.level} · Level {player.stats.level}. Your run can be saved before leaving.</p>
        <div className="fps-overlay-actions"><button className="fps-button fps-button-primary" onClick={saveRun}>Save Run</button><button className="fps-button" onClick={returnToMenu}>Main Menu</button></div>
      </Overlay>}
    </>}
    {webglError && <div className="fps-renderer-error"><div><div className="fps-kicker">WEBGL INITIALIZATION FAILED</div><h2>The dungeon could not be rendered.</h2><p>{webglError}</p><p>Try a browser with WebGL 2 enabled or updated graphics drivers.</p><button className="fps-button fps-button-primary" onClick={returnToMenu}>Return to Main Menu</button></div></div>}
  </main>;
};

const Overlay: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => <div className="fps-overlay-backdrop" role="dialog" aria-modal="true" aria-label={title}>
  <section className="fps-overlay-panel"><header><div className="fps-kicker">AETHER CRAWL</div><h2>{title}</h2><button aria-label="Close" onClick={onClose}>×</button></header><div className="fps-overlay-content">{children}</div></section>
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
  if (item.type === 'POTION') return /mana|mp/i.test(item.name) ? 'Restores ' + item.value + ' mana' : 'Restores ' + item.value + ' health';
  if (item.type === 'ACCESSORY') return (item.statBonus ?? 'Stat') + ' +' + item.value;
  return item.description;
}

function classMark(classId: ClassType): string {
  const marks: Record<ClassType, string> = { BARBARIAN: 'ᚱ', PALADIN: '✦', SORCERER: '⌁', ROGUE: '⌖', RANGER: '➶', CLERIC: '✚', MONK: '◉', NECROMANCER: '☠' };
  return marks[classId];
}

function biomeName(biome: string): string {
  const names: Record<string, string> = { dungeon: 'STONE DUNGEON', moss: 'MOSS DEPTHS', catacombs: 'CATACOMBS', frost: 'FROST HALLS', gilded: 'GILDED VAULT', obsidian: 'OBSIDIAN DEPTHS' };
  return names[biome] ?? biome.toUpperCase();
}

export default App;
