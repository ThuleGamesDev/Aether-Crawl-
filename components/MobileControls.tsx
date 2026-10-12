import React, { useEffect, useRef, useState } from 'react';
import Controls from './Controls';
import { Character, CombatMenu, GamePhase, Item } from '../types';
import { MovementInput } from '../services/firstPerson';

interface MobileControlsProps {
  phase: GamePhase;
  combatMenu: CombatMenu;
  activeCharacter: Character | null;
  inventory: Item[];
  actionReady: boolean;
  paused: boolean;
  onPause: () => void;
  onCharacters: () => void;
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
  actionReady, paused, onPause, onCharacters,
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
  const moveCallbackRef = useRef(onMoveInput);
  moveCallbackRef.current = onMoveInput;
  useEffect(() => {
    stickPointerRef.current = null;
    lookPointerRef.current = null;
    setStick(idleMove);
    moveCallbackRef.current(idleMove);
  }, [phase]);

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
            onLostPointerCapture={endStick}
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

      {phase === 'COMBAT' && <div className="pointer-events-auto absolute bottom-4 left-1/2 w-[min(94vw,520px)] -translate-x-1/2 rounded-xl border border-white/20 bg-black/80 p-2 shadow-xl backdrop-blur-md">
        <Controls phase={phase} combatMenu={combatMenu} activeCharacter={activeCharacter} inventory={inventory} actionReady={actionReady} paused={paused} onPause={onPause} onCharacters={onCharacters} onAction={onAction} onSubAction={onSubAction} onBack={onBack} />
      </div>}

    </div>
  );
};

export default MobileControls;
