import React, { useState } from 'react';
import { Agent, Weapon, AugmentSlot } from '../types/syndicate';
import { AUGMENTS_INFO, WEAPONS_CATALOG } from '../constants/syndicateContent';
import { Shield, Zap, Cpu, Activity, Plus, Check } from 'lucide-react';
import { syndicateAudio } from '../engine/SyndicateAudio';

interface Props {
  agents: Agent[];
  credits: number;
  unlockedWeapons: string[];
  upgradeAugment: (agentId: string, slot: AugmentSlot) => void;
  equipWeapon: (agentId: string, weapon: Weapon) => void;
}

export const AgentArmory: React.FC<Props> = ({
  agents,
  credits,
  unlockedWeapons,
  upgradeAugment,
  equipWeapon
}) => {
  const [activeAgentIndex, setActiveAgentIndex] = useState<number>(0);
  const agent = agents[activeAgentIndex];

  if (!agent) return null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950 p-6 flex flex-col font-mono text-slate-100 custom-scrollbar">
      {/* Title Header */}
      <div className="flex items-center justify-between mb-6 border-b border-cyan-900 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-cyan-400 font-serif tracking-widest uppercase">CYBERNETIC ARMORY & LOADOUT</h2>
          <p className="text-xs text-slate-400">AGENT AUGMENTATION FACILITY // UPGRADE NEURAL PATHWAYS & ARSENAL</p>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <Shield className="h-4 w-4 text-cyan-400" />
          <span className="text-cyan-300 font-bold">AVAILABLE CREDITS: ₢ {credits.toLocaleString()}</span>
        </div>
      </div>

      {/* Agent Switcher Tabs */}
      <div className="flex space-x-2 mb-6">
        {agents.map((ag, idx) => (
          <button
            key={ag.id}
            onClick={() => {
              setActiveAgentIndex(idx);
              syndicateAudio.playSound('CLICK');
            }}
            className={`flex-1 py-2 px-3 rounded border text-xs font-bold transition-all ${
              activeAgentIndex === idx
                ? 'border-cyan-400 bg-cyan-950 text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
            }`}
          >
            {ag.name} ({ag.codeName})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
        {/* Visual Wireframe Mannequin & Augments Column */}
        <div className="cyber-panel rounded-lg p-4 flex flex-col justify-between">
          <h3 className="text-sm font-bold text-cyan-400 border-b border-cyan-900 pb-2 uppercase">CYBERNETIC AUGMENTATIONS</h3>

          {/* Wireframe Agent Silhouette Graphics */}
          <div className="relative my-4 flex-1 min-h-[260px] bg-slate-950/80 border border-cyan-950 rounded flex items-center justify-center p-4">
            <div className="text-cyan-500/20 text-9xl font-black font-serif select-none">
              E-0{activeAgentIndex + 1}
            </div>

            {/* Central Agent Visor Avatar */}
            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2">
              <div className="h-20 w-20 rounded-full border-2 border-cyan-400 p-1 bg-slate-900 shadow-[0_0_15px_rgba(0,240,255,0.5)]">
                <img src={agent.avatar} alt={agent.name} className="h-full w-full rounded-full object-cover" />
              </div>
              <p className="font-bold text-cyan-300 text-sm">{agent.name}</p>
            </div>
          </div>

          {/* Augment Slots */}
          <div className="grid grid-cols-2 gap-2">
            {(['legs', 'arms', 'chest', 'brain'] as AugmentSlot[]).map((slot) => {
              const currentLevel = agent.augments[slot];
              const levelInfos = AUGMENTS_INFO[slot];
              const nextLevelInfo = levelInfos[currentLevel + 1];

              return (
                <div key={slot} className="bg-slate-900 border border-slate-800 rounded p-2 text-[10px]">
                  <div className="flex justify-between font-bold text-cyan-400 uppercase mb-1">
                    <span>{slot}</span>
                    <span>LVL {currentLevel}/3</span>
                  </div>
                  <p className="text-slate-300 truncate">{levelInfos[currentLevel]?.name}</p>

                  {nextLevelInfo ? (
                    <button
                      disabled={credits < nextLevelInfo.cost}
                      onClick={() => {
                        upgradeAugment(agent.id, slot);
                        syndicateAudio.playSound('STIM');
                      }}
                      className={`w-full mt-2 py-1 rounded text-[9px] font-bold border transition-all ${
                        credits >= nextLevelInfo.cost
                          ? 'cyber-button'
                          : 'border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed'
                      }`}
                    >
                      UPGRADE (₢ {nextLevelInfo.cost.toLocaleString()})
                    </button>
                  ) : (
                    <span className="block mt-2 text-center text-emerald-400 font-bold">MAXED OUT</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Current Equipped Inventory & Catalog */}
        <div className="lg:col-span-2 cyber-panel rounded-lg p-4 flex flex-col justify-between overflow-y-auto custom-scrollbar space-y-4">
          {/* Current Equipped Weapons */}
          <div>
            <h3 className="text-sm font-bold text-cyan-400 border-b border-cyan-900 pb-2 uppercase mb-3">
              EQUIPPED ARSENAL ({agent.inventory.length}/4)
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {agent.inventory.map((w, idx) => (
                <div key={idx} className="bg-slate-900 border border-cyan-900 rounded p-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-amber-400 text-xs">{w.name}</p>
                    <p className="text-[10px] text-slate-400">DAMAGE: {w.damage} | RANGE: {w.range}</p>
                  </div>
                  <Check className="h-4 w-4 text-emerald-400" />
                </div>
              ))}
            </div>
          </div>

          {/* Unlocked Weapon Catalog */}
          <div className="flex-1 overflow-y-auto">
            <h3 className="text-sm font-bold text-cyan-400 border-b border-cyan-900 pb-2 uppercase mb-3">
              UNLOCKED WEAPONS CATALOG
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {WEAPONS_CATALOG.filter(w => unlockedWeapons.includes(w.id)).map((w) => {
                const isEquipped = agent.inventory.some(inv => inv.id === w.id);

                return (
                  <div key={w.id} className="bg-slate-900/80 border border-slate-800 rounded p-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-200 text-xs">{w.name}</p>
                      <p className="text-[10px] text-slate-400">{w.description}</p>
                    </div>

                    {!isEquipped && agent.inventory.length < 4 && (
                      <button
                        onClick={() => {
                          equipWeapon(agent.id, w);
                          syndicateAudio.playSound('CLICK');
                        }}
                        className="cyber-button text-[10px] px-2.5 py-1"
                      >
                        EQUIP
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
