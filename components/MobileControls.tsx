import React, { useRef, useState } from 'react';
import { Character, CombatMenu, GamePhase, Item } from '../types';
import { MovementInput } from '../services/firstPerson';

interface MobileControlsProps {
  phase: GamePhase;
  combatMenu: CombatMenu;
  activeCharacter: Character | null;
  inventory: Item[];
  isPlayerTurn: boolean;
  onMoveInput: (input: Pick<MovementInput, 'forward' | 'strafe'>) => void;
  onLook: (deltaX: number) => void;
  onInteract: () => void;
  onAction: (action: string) => void;
  onSubAction: (type: 'skill' | 'item', id: string) => void;
  onBack: () => void;
}

const idleMove = { forward: 0, strafe: 0 };

const MobileControls: React.FC<MobileControlsProps> = ({
  phase,
  combatMenu,
  activeCharacter,
  inventory,
  isPlayerTurn,
  onMoveInput,
  onLook,
  onInteract,
  onAction,
  onSubAction,
  onBack,
}) => {
  const [stick, setStick] = useState(idleMove);
  const stickPointerRef = useRef<number | null>(null);
  const stickCenterRef = useRef({ x: 0, y: 0 });
  const lookPointerRef = useRef<number | null>(null);
  const lastLookXRef = useRef(0);

  const updateStick = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = rect.width * 0.34;
    const dx = event.clientX - stickCenterRef.current.x;
    const dy = event.clientY - stickCenterRef.current.y;
    const length = Math.hypot(dx, dy);
    const scale = length > radius ? radius / length : 1;
    const next = {
      strafe: Math.max(-1, Math.min(1, (dx * scale) / radius)),
      forward: Math.max(-1, Math.min(1, (-dy * scale) / radius)),
    };
    setStick(next);
    onMoveInput(next);
  };

  const endStick = () => {
    stickPointerRef.current = null;
    setStick(idleMove);
    onMoveInput(idleMove);
  };

  const consumables = inventory.filter(item => item.type === 'POTION' || item.type === 'SCROLL');

  return (
    <div className="pointer-events-none absolute inset-0 z-30 select-none lg:hidden">
      {phase === 'EXPLORE' && (
        <>
          <div
            aria-label="Drag to look around"
            className="pointer-events-auto absolute right-0 top-[18%] h-[54%] w-1/2 touch-none"
            onPointerDown={event => {
              event.preventDefault();
              lookPointerRef.current = event.pointerId;
              lastLookXRef.current = event.clientX;
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={event => {
              if (lookPointerRef.current !== event.pointerId) return;
              event.preventDefault();
              const deltaX = event.clientX - lastLookXRef.current;
              lastLookXRef.current = event.clientX;
              onLook(deltaX);
            }}
            onPointerUp={event => {
              if (lookPointerRef.current === event.pointerId) lookPointerRef.current = null;
            }}
            onPointerCancel={() => { lookPointerRef.current = null; }}
          />
          <div
            aria-label="Move"
            className="pointer-events-auto absolute bottom-5 left-5 flex h-32 w-32 touch-none items-center justify-center rounded-full border border-white/35 bg-black/30 shadow-lg backdrop-blur-sm"
            onPointerDown={event => {
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              stickCenterRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
              stickPointerRef.current = event.pointerId;
              event.currentTarget.setPointerCapture(event.pointerId);
              updateStick(event);
            }}
            onPointerMove={event => {
              if (stickPointerRef.current === event.pointerId) {
                event.preventDefault();
                updateStick(event);
              }
            }}
            onPointerUp={endStick}
            onPointerCancel={endStick}
          >
            <span className="absolute h-1 w-1 rounded-full bg-white/60" />
            <span
              className="absolute h-12 w-12 rounded-full border border-amber-200/80 bg-amber-100/30 shadow-md"
              style={{ transform: 'translate(' + (stick.strafe * 36) + 'px, ' + (-stick.forward * 36) + 'px)' }}
            />
          </div>
          <div className="pointer-events-auto absolute bottom-6 right-4 flex flex-col items-end gap-2">
            <button
              onClick={onInteract}
              className="h-14 min-w-14 rounded-full border border-amber-200/70 bg-amber-700/80 px-4 text-sm font-black text-white shadow-lg active:scale-95"
            >
              E
            </button>
            <div className="grid grid-cols-3 gap-1">
              {[
                ['inventory', 'BAG'],
                ['skills', 'SKILL'],
                ['map', 'MAP'],
                ['stats', 'PARTY'],
                ['craft', 'CRAFT'],
              ].map(([action, label]) => (
                <button
                  key={action}
                  onClick={() => onAction(action)}
                  className="h-11 min-w-11 rounded-lg border border-white/20 bg-slate-950/85 px-1 text-[8px] font-bold text-white shadow-lg active:scale-95"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[10px] text-white/75">
            Drag right side to look
          </div>
        </>
      )}

      {phase === 'COMBAT' && combatMenu === 'MAIN' && (
        <div className="pointer-events-auto absolute bottom-4 left-1/2 grid -translate-x-1/2 grid-cols-5 gap-1.5 rounded-2xl border border-white/20 bg-black/80 p-2 shadow-xl backdrop-blur-md">
          {[
            ['attack', 'HIT', 'bg-red-800'],
            ['defend', 'GUARD', 'bg-blue-800'],
            ['skill', 'SKILL', 'bg-purple-800'],
            ['item', 'ITEM', 'bg-emerald-800'],
            ['run', 'FLEE', 'bg-amber-800'],
          ].map(([action, label, color]) => (
            <button
              key={action}
              onClick={() => onAction(action)}
              disabled={!isPlayerTurn}
              className={'min-h-12 min-w-12 rounded-xl border border-white/20 px-1 text-[9px] font-black text-white shadow disabled:opacity-50 ' + color}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {phase === 'COMBAT' && combatMenu !== 'MAIN' && (
        <div className="pointer-events-auto absolute bottom-4 left-1/2 flex max-h-[45dvh] w-[min(92vw,420px)] -translate-x-1/2 flex-col rounded-2xl border border-white/20 bg-slate-950/95 p-3 shadow-xl backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-amber-200">{combatMenu === 'SKILLS' ? 'Choose a skill' : 'Use an item'}</span>
            <button onClick={onBack} className="rounded border border-white/20 px-3 py-1 text-[10px] text-white/75">BACK</button>
          </div>
          <div className="space-y-1 overflow-y-auto">
            {combatMenu === 'SKILLS' && activeCharacter?.skills.map(skill => (
              <button
                key={skill.id}
                onClick={() => onSubAction('skill', skill.id)}
                disabled={!isPlayerTurn}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-xs disabled:opacity-50"
              >
                <span className="truncate text-white">{skill.name}</span><span className="shrink-0 text-blue-200">{skill.cost} MP</span>
              </button>
            ))}
            {combatMenu === 'ITEMS' && consumables.map(item => (
              <button
                key={item.id}
                onClick={() => onSubAction('item', item.id)}
                disabled={!isPlayerTurn}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-xs disabled:opacity-50"
              >
                <span className="truncate text-white">{item.icon} {item.name}</span><span className="shrink-0 text-white/60">x{item.quantity}</span>
              </button>
            ))}
            {combatMenu === 'ITEMS' && consumables.length === 0 && <p className="py-4 text-center text-xs text-white/50">No usable items.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileControls;
