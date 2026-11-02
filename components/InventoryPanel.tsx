import React, { useEffect, useMemo, useState } from 'react';
import { getItemBase } from '../data/itemBases';
import { getUniqueItem } from '../data/uniqueItems';
import type { EquipmentSlot, ItemInstance, PlayerCharacter } from '../types';
import { compareDerivedStats, calculateDerivedStats } from '../player/DerivedStats';
import { equipItem, itemSlotFor } from '../player/PlayerProgression';
import { uniqueEffectRemaining } from '../player/UniqueEffects';
import { consumableEffect, describeAffix, describeItem } from '../services/itemization';
import { consumableStackKey, INVENTORY_GRID_HEIGHT, INVENTORY_GRID_WIDTH, itemFootprint, normalizeInventoryGrid } from '../services/inventoryGrid';
import { ItemIcon } from './ItemIcon';
import { CharacterStatsScreen } from './CharacterStatsScreen';

const EQUIPMENT_SLOTS: EquipmentSlot[] = ['weapon', 'armor', 'offhand', 'accessory'];

interface InventoryPanelProps {
  player: PlayerCharacter;
  onEquip(instanceId: string): void;
  onUnequip(slot: EquipmentSlot): void;
  onUse(instanceId: string): void;
  onMove(instanceId: string, x: number, y: number): boolean;
  onSplit(instanceId: string): boolean;
  onDrop(instanceId: string): boolean;
}

const InventoryPanel: React.FC<InventoryPanelProps> = ({ player, onEquip, onUnequip, onUse, onMove, onSplit, onDrop }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [activeScreen, setActiveScreen] = useState<'INVENTORY' | 'CHARACTER_STATS'>('INVENTORY');
  const grid = useMemo(() => normalizeInventoryGrid(player.inventory, player.inventoryGrid), [player.inventory, player.inventoryGrid]);
  const allItems = [...player.inventory, ...Object.values(player.equipment).filter((item): item is ItemInstance => Boolean(item))];
  const selected = allItems.find(item => item.instanceId === selectedId) ?? null;
  const selectedInInventory = Boolean(selected && player.inventory.some(item => item.instanceId === selected.instanceId));
  const placements = new Map(grid.placements.map(placement => [placement.instanceId, placement]));
  const inventoryById = new Map(player.inventory.map(item => [item.instanceId, item]));
  const overflow = grid.overflowIds.map(id => inventoryById.get(id)).filter((item): item is ItemInstance => Boolean(item));
  const derived = calculateDerivedStats(player);

  useEffect(() => {
    if (selectedId && !allItems.some(item => item.instanceId === selectedId)) setSelectedId(null);
  }, [selectedId, player.inventory, player.equipment]);

  const selectPlacement = (instanceId: string, x: number, y: number) => {
    if (selectedInInventory && selectedId && selectedId !== instanceId) {
      if (onMove(selectedId, x, y)) { setSelectedId(null); setMessage('Inventory position updated.'); }
      else setMessage('Those items do not fit in that position.');
      return;
    }
    setSelectedId(instanceId);
    setMessage('');
  };

  const clickCell = (x: number, y: number) => {
    if (!selectedInInventory || !selectedId) return;
    if (onMove(selectedId, x, y)) { setSelectedId(null); setMessage('Inventory position updated.'); }
    else setMessage('That position is blocked or outside the bag.');
  };

  const equipmentChanges = selected && selectedInInventory && itemSlotFor(selected)
    ? compareDerivedStats(player, equipItem(player, selected.instanceId)).filter(row => Math.abs(row.delta) >= 0.01)
    : [];
  const unique = selected?.uniqueEffectId ? getUniqueItem(selected.uniqueEffectId) : undefined;
  const selectedSlot = selected ? EQUIPMENT_SLOTS.find(slot => player.equipment[slot]?.instanceId === selected.instanceId) : undefined;
  const activeUniqueSeconds = selected?.uniqueEffectId ? uniqueEffectRemaining(player, selected.uniqueEffectId as Parameters<typeof uniqueEffectRemaining>[1]) : 0;

  const quickEquip = (item: ItemInstance) => {
    if (!itemSlotFor(item)) return;
    onEquip(item.instanceId);
    setMessage('Equipment updated.');
  };

  const useSelected = () => {
    if (!selected) return;
    onUse(selected.instanceId);
    setMessage('');
  };

  const dropSelected = () => {
    if (!selected || !selectedInInventory) return;
    if (onDrop(selected.instanceId)) { setSelectedId(null); setMessage('One item dropped nearby.'); }
  };

  const splitSelected = () => {
    if (!selected || !onSplit(selected.instanceId)) { setMessage('This stack cannot be split.'); return; }
    setMessage('Consumable stack split into two stacks.');
  };

  const selectedEffect = selected ? consumableEffect(selected) : null;
  const canUse = Boolean(selected && selectedEffect && (selectedEffect === 'HEALTH'
    ? player.stats.hp < derived.maxHealth
    : player.stats.mp < derived.maxMana));
  const requirement = selected ? getItemBase(selected.baseId)?.requiredLevel ?? 1 : 1;
  const footprint = selected ? itemFootprint(selected) : null;

  return <div className="fps-inventory-root">
    <nav className="fps-inventory-tabs" role="tablist" aria-label="Inventory screens">
      <button type="button" role="tab" aria-selected={activeScreen === 'INVENTORY'} className={activeScreen === 'INVENTORY' ? 'active' : ''} onClick={() => setActiveScreen('INVENTORY')}>Inventory & Equipment <span>{player.inventory.length}</span></button>
      <button type="button" role="tab" aria-selected={activeScreen === 'CHARACTER_STATS'} className={activeScreen === 'CHARACTER_STATS' ? 'active' : ''} onClick={() => setActiveScreen('CHARACTER_STATS')}>Character Stats</button>
    </nav>
    {activeScreen === 'CHARACTER_STATS' ? <CharacterStatsScreen player={player} derived={derived} /> : <div className="fps-inventory-layout">
    <section className="fps-inventory-equipment" aria-label="Equipped items">
      <div className="fps-inventory-section-heading"><h3>Equipment</h3><span>4 slots</span></div>
      <div className="fps-equipment-list">{EQUIPMENT_SLOTS.map(slot => {
        const item = player.equipment[slot];
        return <article className={'fps-equipment-slot' + (item?.instanceId === selectedId ? ' selected' : '')} key={slot}>
          <button className="fps-equipment-select" onClick={() => item && setSelectedId(item.instanceId)} aria-label={item ? 'Inspect ' + describeItem(item) : slot + ' slot empty'}>
            <span className="fps-equipment-icon">{item ? <ItemIcon item={item} /> : <i>◇</i>}</span>
            <span className="fps-equipment-copy"><small>{slot.toUpperCase()}</small><strong>{item ? describeItem(item) : 'Empty'}</strong>{item && <small>{item.rarity} · Item Level {item.itemLevel}</small>}</span>
          </button>
          {item && <button className="fps-small-action" onClick={() => onUnequip(slot)}>Unequip</button>}
        </article>;
      })}</div>
      <div className="fps-build-summary">
        <h3>Active build</h3>
        <StatLine label="Weapon power" value={derived.weaponPower} />
        <StatLine label="Armor" value={derived.armor} />
        <StatLine label="Attack speed" value={derived.attackSpeedMultiplier * 100} suffix="%" />
        <StatLine label="Critical chance" value={derived.criticalChance * 100} suffix="%" />
        <StatLine label="Health / Mana" value={Math.ceil(derived.maxHealth) + ' / ' + Math.floor(derived.maxMana)} />
        <StatLine label="Movement" value={derived.movementSpeedMultiplier * 100} suffix="%" />
      </div>
    </section>

    <section className="fps-inventory-grid-section" aria-label="Inventory grid">
      <div className="fps-inventory-section-heading"><h3>Bag · 10 × 5</h3><span>{player.inventory.length} items</span></div>
      <p className="fps-inventory-help">Select an item in the bag or overflow, then click an open cell to place it. Select another bag item to swap. Double-click or right-click equipment to quick-equip.</p>
      <div className="fps-grid-board" role="grid" aria-label="10 by 5 inventory bag">
        {Array.from({ length: INVENTORY_GRID_WIDTH * INVENTORY_GRID_HEIGHT }, (_, index) => {
          const x = index % INVENTORY_GRID_WIDTH, y = Math.floor(index / INVENTORY_GRID_WIDTH);
          return <button key={'cell:' + index} className="fps-grid-cell" style={{ left: (x * 10) + '%', top: (y * 20) + '%', width: '10%', height: '20%' }} aria-label={'Bag cell ' + (x + 1) + ', ' + (y + 1)} onClick={() => clickCell(x, y)} />;
        })}
        {grid.placements.map(placement => {
          const item = inventoryById.get(placement.instanceId);
          if (!item) return null;
          const size = itemFootprint(item);
          return <button
            key={item.instanceId}
            className={'fps-grid-item fps-rarity-' + item.rarity.toLowerCase() + (selectedId === item.instanceId ? ' selected' : '')}
            style={{ left: (placement.x * 10) + '%', top: (placement.y * 20) + '%', width: (size.width * 10) + '%', height: (size.height * 20) + '%' }}
            aria-label={describeItem(item) + ', ' + item.rarity + (item.quantity > 1 ? ', quantity ' + item.quantity : '')}
            onClick={event => { event.stopPropagation(); selectPlacement(item.instanceId, placement.x, placement.y); }}
            onDoubleClick={() => quickEquip(item)}
            onContextMenu={event => { event.preventDefault(); quickEquip(item); }}
          >
            <ItemIcon item={item} />
            <span className="fps-grid-item-name">{describeItem(item)}</span>
            {item.quantity > 1 && <b className="fps-grid-stack-count">{item.quantity}</b>}
          </button>;
        })}
      </div>
      {overflow.length > 0 && <div className="fps-overflow-stash" aria-label="Overflow storage">
        <div><strong>Overflow storage</strong><span>{overflow.length} safe-stored {overflow.length === 1 ? 'item' : 'items'}</span></div>
        <p>These items did not fit in the bag. They remain saved here and can be moved into the grid when space opens.</p>
        <div className="fps-overflow-items">{overflow.map(item => <button key={item.instanceId} className={'fps-overflow-item fps-rarity-' + item.rarity.toLowerCase() + (selectedId === item.instanceId ? ' selected' : '')} onClick={() => setSelectedId(item.instanceId)}><ItemIcon item={item} /><span>{describeItem(item)}</span>{item.quantity > 1 && <b>×{item.quantity}</b>}</button>)}</div>
      </div>}
      {message && <p className="fps-inventory-message" role="status">{message}</p>}
    </section>

    <section className="fps-inventory-detail" aria-label="Selected item details">
      <div className="fps-inventory-section-heading"><h3>Item details</h3><span>{selected ? selected.rarity : 'Build'}</span></div>
      {selected ? <>
        <div className={'fps-detail-hero fps-rarity-' + selected.rarity.toLowerCase()}><ItemIcon item={selected} /><div><small>{selected.type} · {selected.rarity}</small><h4>{describeItem(selected)}</h4><span>Item Level {selected.itemLevel} · {footprint?.width}×{footprint?.height}</span></div></div>
        <p className="fps-detail-description">{selected.description}</p>
        <div className="fps-detail-base-stats"><b>Base</b><span>{baseItemSummary(selected)}</span><span>Requires level {requirement}</span>{selectedSlot && <span>Equipped in {selectedSlot}</span>}</div>
        {selected.affixes.length > 0 && <div className="fps-detail-affixes"><b>Modifiers</b>{selected.affixes.map((affix, index) => <span key={affix.id + ':' + index}>{describeAffix(affix.id, affix.value)}</span>)}</div>}
        {unique && <div className="fps-unique-rule"><b>Mythic unique · {unique.effectId}</b><p>{unique.effectSummary}</p><dl><dt>Trigger</dt><dd>{unique.triggerRule}</dd><dt>Cooldown</dt><dd>{unique.cooldownRule}</dd><dt>Limit</dt><dd>{unique.capRule}</dd></dl>{unique.requiredClass && player.classId !== unique.requiredClass && <small className="fps-unique-fallback">{unique.fallbackSummary}</small>}{activeUniqueSeconds > 0 && <small className="fps-unique-active">Active · {activeUniqueSeconds.toFixed(1)}s</small>}</div>}
        {equipmentChanges.length > 0 && <div className="fps-item-comparison"><b>After equip</b>{equipmentChanges.slice(0, 8).map(change => <span key={change.id} className={change.delta > 0 ? 'positive' : 'negative'}>{change.label} {formatDelta(change.delta, change.id)}</span>)}</div>}
        <div className="fps-detail-actions">
          {selectedSlot ? <button onClick={() => onUnequip(selectedSlot)}>Unequip</button> : itemSlotFor(selected) && <button disabled={requirement > player.stats.level} onClick={() => onEquip(selected.instanceId)}>{requirement > player.stats.level ? 'Level locked' : 'Equip'}</button>}
          {selected.type === 'POTION' && <button disabled={!canUse} onClick={useSelected}>Use</button>}
          {selectedInInventory && consumableStackKey(selected) && selected.quantity > 1 && <button onClick={splitSelected}>Split stack</button>}
          {selectedInInventory && <button className="fps-drop-action" onClick={dropSelected}>Drop 1 nearby</button>}
        </div>
      </> : <>
        <p className="fps-inventory-help">Select an item for its full stats, Unique rules, and before/after equipment comparison.</p>
        <div className="fps-build-summary fps-build-detail">
          <StatLine label="Strength" value={derived.strength} /><StatLine label="Dexterity" value={derived.dexterity} /><StatLine label="Intelligence" value={derived.intelligence} />
          <StatLine label="Physical damage" value={derived.physicalDamageMultiplier * 100} suffix="%" /><StatLine label="Spell damage" value={derived.spellDamageMultiplier * 100} suffix="%" />
          <StatLine label="Cast speed" value={derived.castSpeedMultiplier * 100} suffix="%" /><StatLine label="Critical damage" value={derived.criticalDamageMultiplier * 100} suffix="%" />
          <StatLine label="Cooldown recovery" value={(1 - derived.cooldownMultiplier) * 100} suffix="%" /><StatLine label="Mana cost reduction" value={(1 - derived.manaCostMultiplier) * 100} suffix="%" />
          <StatLine label="Projectile damage" value={derived.projectileDamageMultiplier * 100} suffix="%" /><StatLine label="Life on hit / kill" value={derived.lifeOnHit + ' / ' + derived.lifeOnKill} />
        </div>
      </>}
    </section>
    </div>}
  </div>;
};

const StatLine: React.FC<{ label: string; value: number | string; suffix?: string }> = ({ label, value, suffix = '' }) => <div className="fps-stat-line"><span>{label}</span><b>{typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(1)) + suffix : value}</b></div>;

function baseItemSummary(item: ItemInstance): string {
  if (item.type === 'WEAPON') return 'Weapon power +' + item.value;
  if (item.type === 'ARMOR' || item.type === 'SHIELD') return 'Armor +' + item.value;
  if (item.type === 'ACCESSORY') return (item.statBonus ?? 'Stat') + ' +' + item.value;
  const effect = consumableEffect(item);
  if (effect) return 'Restores ' + item.value + (effect === 'HEALTH' ? ' health' : ' mana') + (item.quantity > 1 ? ' · stack ' + item.quantity : '');
  return item.description;
}

function formatDelta(delta: number, id: string): string {
  const percent = id.includes('Multiplier') || id.includes('Chance') || id === 'cooldownRecovery' || id === 'manaCostReduction';
  const amount = Math.abs(delta) < 0.1 ? Math.abs(delta).toFixed(1) : Math.abs(delta).toFixed(0);
  return (delta > 0 ? '+' : '−') + amount + (percent ? '%' : '');
}

export default InventoryPanel;
