import React from 'react';
import { Agent, Mission } from '../types/syndicate';
import { Zap, Shield, Flame, Target, Crosshair, Users, Activity, Radio, Compass, Car, RefreshCw } from 'lucide-react';
import { syndicateAudio } from '../engine/SyndicateAudio';

interface Props {
  agents: Agent[];
  activeMission: Mission | null;
  selectedAgentIds: string[];
  toggleSelectAgent: (id: string) => void;
  selectAllAgents: () => void;
  selectAgentWeapon: (agentId: string, weaponIndex: number) => void;
  updateIPA: (agentId: string, ipaType: 'adrenaline' | 'perception' | 'intelligence', value: number) => void;
  logs: string[];
  thrallCount: number;
  triggerOrbitalStrike: () => void;
  overdoseAgents: () => void;
}

export const TacticalHUD: React.FC<Props> = ({
  agents,
  activeMission,
  selectedAgentIds,
  toggleSelectAgent,
  selectAllAgents,
  selectAgentWeapon,
  updateIPA,
  logs,
  thrallCount,
  triggerOrbitalStrike,
  overdoseAgents
}) => {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col p-3 space-y-2">
      {/* Top Banner: Mission Objectives & Thrall Horde Badge */}
      <div className="flex items-center justify-between pointer-events-auto">
        {/* Mission Objectives HUD */}
        {activeMission && (
          <div className="cyber-panel flex items-center space-x-3 rounded px-3 py-1.5 text-xs text-slate-200">
            <Target className="h-4 w-4 text-cyan-400 animate-pulse" />
            <div className="font-mono">
              <span className="font-bold text-cyan-300 uppercase">{activeMission.cityName}:</span>
              <span className="ml-2 text-slate-300">
                {activeMission.objectives.map(obj => obj.text).join(' | ')}
              </span>
            </div>
          </div>
        )}

        {/* Thrall Count Badge */}
        <div className="cyber-panel-orange flex items-center space-x-2 rounded px-3 py-1.5 text-xs text-orange-400 font-mono font-bold">
          <Users className="h-4 w-4 text-orange-400 animate-bounce" />
          <span>THRALL HORDE: {thrallCount} CONVERTED</span>
        </div>
      </div>

      {/* Main HUD Dock */}
      <div className="pointer-events-auto flex flex-wrap lg:flex-nowrap items-stretch gap-2">
        {/* 4 Agent Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1">
          {agents.map((agent) => {
            const isSelected = selectedAgentIds.includes(agent.id);
            const isDead = agent.status === 'DEAD';
            const activeWeapon = agent.inventory[agent.activeWeaponIndex];

            return (
              <div
                key={agent.id}
                onClick={() => !isDead && toggleSelectAgent(agent.id)}
                className={`cyber-panel cursor-pointer rounded p-2 transition-all ${
                  isDead
                    ? 'opacity-40 border-red-900 bg-red-950/40'
                    : isSelected
                    ? 'border-cyan-400 bg-slate-900/90 shadow-[0_0_15px_rgba(0,240,255,0.25)]'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Agent Header */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-1.5">
                    <span className={`h-2 w-2 rounded-full ${isDead ? 'bg-red-500' : isSelected ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'}`} />
                    <span className="font-mono text-xs font-bold text-slate-100">{agent.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-cyan-400">{agent.codeName}</span>
                </div>

                {/* HP & Shield Bars */}
                <div className="space-y-1 mb-2 font-mono text-[9px]">
                  <div>
                    <div className="flex justify-between text-slate-400 mb-0.5">
                      <span>HEALTH</span>
                      <span className="text-emerald-400">{agent.hp}/{agent.maxHp}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${Math.max(0, (agent.hp / agent.maxHp) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-400 mb-0.5">
                      <span>SHIELD</span>
                      <span className="text-cyan-400">{agent.shield}/{agent.maxShield}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-cyan-400 transition-all duration-300"
                        style={{ width: `${Math.max(0, (agent.shield / agent.maxShield) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* IPA Stimulant Sliders */}
                <div className="space-y-1 my-2 border-t border-slate-800/80 pt-1.5 text-[9px] font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-orange-400">ADRENALINE</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={agent.ipa.adrenaline}
                      onChange={(e) => updateIPA(agent.id, 'adrenaline', Number(e.target.value))}
                      className="w-16 accent-orange-500 h-1 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-400">PERCEPTION</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={agent.ipa.perception}
                      onChange={(e) => updateIPA(agent.id, 'perception', Number(e.target.value))}
                      className="w-16 accent-cyan-400 h-1 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Active Weapon Selector */}
                <div className="mt-2 border-t border-slate-800 pt-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-300 mb-1">
                    <span>WEAPON:</span>
                    <span className="font-bold text-amber-400">{activeWeapon ? activeWeapon.name : 'UNARMED'}</span>
                  </div>
                  <div className="flex space-x-1">
                    {agent.inventory.map((weapon, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectAgentWeapon(agent.id, idx);
                          syndicateAudio.playSound('CLICK');
                        }}
                        className={`flex-1 rounded py-1 text-[9px] font-mono font-bold transition-colors ${
                          agent.activeWeaponIndex === idx
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                        }`}
                        title={weapon.name}
                      >
                        {weapon.category.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tactical Actions & Radio Chatter Log */}
        <div className="cyber-panel flex flex-col justify-between rounded p-2.5 w-full lg:w-72 font-mono text-xs space-y-2">
          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => { selectAllAgents(); syndicateAudio.playSound('CLICK'); }}
              className="cyber-button text-[10px] py-1.5"
            >
              SELECT SQUAD
            </button>

            <button
              onClick={() => { overdoseAgents(); syndicateAudio.playSound('STIM'); }}
              className="cyber-button text-[10px] py-1.5 border-orange-500 text-orange-400 hover:bg-orange-500 hover:text-slate-950"
            >
              MAX STIMULANT
            </button>

            <button
              onClick={() => { triggerOrbitalStrike(); syndicateAudio.playSound('ORBITAL'); }}
              className="cyber-button-danger text-[10px] py-1.5 col-span-2 font-bold"
            >
              ORBITAL STRIKE
            </button>
          </div>

          {/* Radio Chatter Log */}
          <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded p-2 overflow-y-auto max-h-24 custom-scrollbar text-[10px]">
            <div className="flex items-center space-x-1.5 text-cyan-400 mb-1 border-b border-slate-800 pb-1 font-bold">
              <Radio className="h-3 w-3 animate-pulse" />
              <span>SYNDICATE RADIO LOG</span>
            </div>
            {logs.slice(-5).map((log, i) => (
              <p key={i} className="text-slate-300 leading-tight my-0.5">
                {log}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
