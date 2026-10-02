
import React from 'react';
import { GamePhase, CombatMenu, Skill, Item, Character } from '../types';

interface ControlsProps {
  onAction: (action: string) => void;
  phase: GamePhase;
  
  // Combat Specific
  combatMenu: CombatMenu;
  activeCharacter: Character | null; // The character currently taking a turn
  inventory: Item[];
  onSubAction: (type: 'skill' | 'item', id: string) => void;
  onBack: () => void;
  isPlayerTurn: boolean; 
}

const Controls: React.FC<ControlsProps> = ({ 
    onAction, phase, 
    combatMenu, activeCharacter, inventory, onSubAction, onBack,
    isPlayerTurn
}) => {
  const btnClass = "bg-gray-700 hover:bg-gray-600 active:bg-gray-800 text-white font-bold py-1 px-2 rounded border-b-4 border-gray-900 active:border-b-0 active:translate-y-1 transition-all select-none touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm h-10 shadow-lg";
  const combatBtnClass = "bg-gray-800 hover:bg-gray-700 text-white py-2 px-3 rounded border border-gray-600 mb-1 w-full text-left flex justify-between items-center text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-md";

  // COMBAT MODE CONTROLS
  if (phase === 'COMBAT') {
      if (!activeCharacter) return <div className="text-center text-gray-500">Wait...</div>;

      if (combatMenu === 'SKILLS') {
          return (
              <div className="w-full h-full flex flex-col bg-gray-900 p-2 rounded border border-gray-700 absolute top-0 left-0 z-20">
                  <h3 className="text-purple-400 font-bold mb-2 text-xs uppercase tracking-wider border-b border-gray-700 pb-1">
                      {activeCharacter.name}'s Skills
                  </h3>
                  <div className="flex-1 overflow-y-auto">
                    {activeCharacter.skills.map(skill => {
                        // Calculate Effect Power
                        let statVal = activeCharacter.stats.int;
                        if (skill.scalingStat === 'STR') statVal = activeCharacter.stats.str;
                        if (skill.scalingStat === 'DEX') statVal = activeCharacter.stats.dex;
                        const power = Math.floor(skill.basePower + (statVal * skill.scaling));
                        const label = skill.type === 'HEAL' || skill.type === 'BUFF' ? 'Heal' : 'Dmg';

                        return (
                            <button 
                                key={skill.id} 
                                onClick={() => onSubAction('skill', skill.id)} 
                                className={combatBtnClass}
                                disabled={!isPlayerTurn}
                            >
                                <span>{skill.name} <span className="text-gray-400 text-[10px] ml-1">({label}: {power})</span></span>
                                <span className="text-blue-400 text-xs">{skill.cost} MP</span>
                            </button>
                        );
                    })}
                  </div>
                  <button onClick={onBack} className="w-full text-center text-red-400 mt-2 py-2 hover:bg-gray-800 rounded border border-red-900 text-xs font-bold">CANCEL</button>
              </div>
          );
      }

      if (combatMenu === 'ITEMS') {
        const consumables = inventory.filter(i => i.type === 'POTION' || i.type === 'SCROLL');
        return (
            <div className="w-full h-full flex flex-col bg-gray-900 p-2 rounded border border-gray-700 absolute top-0 left-0 z-20">
                <h3 className="text-green-400 font-bold mb-2 text-xs uppercase tracking-wider border-b border-gray-700 pb-1">Use Item</h3>
                <div className="flex-1 overflow-y-auto">
                    {consumables.length === 0 && <p className="text-gray-500 text-center py-4 text-xs">No usable items.</p>}
                    {consumables.map(item => (
                        <button 
                            key={item.id} 
                            onClick={() => onSubAction('item', item.id)} 
                            className={combatBtnClass}
                            disabled={!isPlayerTurn}
                        >
                            <span className="truncate mr-2">{item.icon} {item.name}</span>
                            <span className="text-gray-400 text-xs">x{item.quantity}</span>
                        </button>
                    ))}
                </div>
                <button onClick={onBack} className="w-full text-center text-red-400 mt-2 py-2 hover:bg-gray-800 rounded border border-red-900 text-xs font-bold">CANCEL</button>
            </div>
        );
      }

      return (
        <div className="flex flex-col h-full">
            <div className="text-xs text-center text-yellow-500 mb-2 font-bold bg-gray-900 p-1 rounded border border-gray-700 flex justify-between px-2 items-center">
                <span>{activeCharacter.name}'s Turn</span>
                <span className="text-[10px] text-gray-400">HP: {activeCharacter.stats.hp} MP: {activeCharacter.stats.mp}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 h-full">
                <button onClick={() => onAction('attack')} disabled={!isPlayerTurn} className={`${btnClass} bg-red-900 hover:bg-red-800 border-red-950 text-[10px]`}>
                    ATTACK
                </button>
                <button onClick={() => onAction('defend')} disabled={!isPlayerTurn} className={`${btnClass} bg-blue-900 hover:bg-blue-800 border-blue-950 text-[10px]`}>
                    DEFEND
                </button>
                <button onClick={() => onAction('skill')} disabled={!isPlayerTurn} className={`${btnClass} bg-purple-900 hover:bg-purple-800 border-purple-950 text-[10px]`}>
                    SKILL
                </button>
                <button onClick={() => onAction('item')} disabled={!isPlayerTurn} className={`${btnClass} bg-green-900 hover:bg-green-800 border-green-950 text-[10px]`}>
                    ITEM
                </button>
                <button onClick={() => onAction('run')} disabled={!isPlayerTurn} className={`${btnClass} col-span-2 bg-yellow-900 hover:bg-yellow-800 border-yellow-950 text-[10px]`}>
                    FLEE
                </button>
            </div>
            {!isPlayerTurn && <div className="absolute top-[-40px] left-0 w-full flex justify-center pointer-events-none"><span className="text-xs text-yellow-500 animate-pulse font-bold bg-black px-2 py-1 rounded border border-yellow-900">ENEMY TURN</span></div>}
        </div>
      )
  }

  return null;
};

export default Controls;
