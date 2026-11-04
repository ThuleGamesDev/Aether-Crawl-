import React from 'react';
import { Territory, Mission } from '../types/syndicate';
import { Globe, AlertTriangle, ShieldAlert, DollarSign, Crosshair, ChevronRight } from 'lucide-react';
import { syndicateAudio } from '../engine/SyndicateAudio';

interface Props {
  territories: Territory[];
  missions: Mission[];
  onSelectMission: (mission: Mission) => void;
  updateTaxRate: (territoryId: string, taxRate: number) => void;
}

export const GlobalStrategyMap: React.FC<Props> = ({
  territories,
  missions,
  onSelectMission,
  updateTaxRate
}) => {
  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950 p-6 flex flex-col font-mono text-slate-100 custom-scrollbar">
      {/* Title Header */}
      <div className="flex items-center justify-between mb-6 border-b border-cyan-900 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-cyan-400 font-serif tracking-widest uppercase">GLOBAL TERRITORY CONTROL</h2>
          <p className="text-xs text-slate-400">EUROCORP STRATEGIC TACTICAL OVERLAY // SELECT MISSION OR ADJUST TAXATION</p>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-cyan-300 font-bold">12 GLOBAL REGIONS ACTIVE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
        {/* Interactive World Map Canvas/Graphic */}
        <div className="lg:col-span-2 cyber-panel relative rounded-lg p-4 flex flex-col justify-between overflow-hidden">
          <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#00f0ff_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Map Grid Container with Pins */}
          <div className="relative h-full w-full min-h-[380px] bg-slate-950/80 rounded border border-cyan-950 flex items-center justify-center p-4">
            {/* World Vector Outline Background */}
            <div className="absolute inset-0 flex items-center justify-center text-cyan-950 font-serif text-8xl font-black select-none pointer-events-none opacity-40">
              WORLD MAP
            </div>

            {/* Territory Interactive Pins */}
            {territories.map((terr) => {
              const mission = missions.find(m => m.id === terr.missionId);
              const isPlayer = terr.controlledBy === 'EUROCORP';

              return (
                <div
                  key={terr.id}
                  style={{ left: `${terr.coords.x}%`, top: `${terr.coords.y}%` }}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                  onClick={() => {
                    if (mission) {
                      onSelectMission(mission);
                      syndicateAudio.playSound('CLICK');
                    }
                  }}
                >
                  {/* Pin Dot */}
                  <div className={`relative flex h-5 w-5 items-center justify-center rounded-full border border-slate-900 shadow-lg transition-transform group-hover:scale-125 ${
                    isPlayer ? 'bg-cyan-500 shadow-[0_0_12px_rgba(0,240,255,0.8)]' : 'bg-red-600 shadow-[0_0_12px_rgba(239,68,68,0.8)]'
                  }`}>
                    <Crosshair className="h-3 w-3 text-slate-950" />
                  </div>

                  {/* Hover Tooltip */}
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 cyber-panel rounded p-2 text-[10px] z-30 shadow-2xl">
                    <p className="font-bold text-cyan-300 uppercase">{terr.name}</p>
                    <p className="text-slate-400">FACTION: {terr.controlledBy}</p>
                    <p className="text-emerald-400">INCOME: +₢ {terr.dailyIncome}/day</p>
                    {mission && (
                      <p className="text-amber-400 font-bold mt-1">CLICK TO BRIEF MISSION</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Territory List & Tax Controls */}
        <div className="cyber-panel rounded-lg p-4 flex flex-col space-y-3 overflow-y-auto custom-scrollbar">
          <h3 className="text-sm font-bold text-cyan-400 border-b border-cyan-900 pb-2 uppercase">TERRITORY MANAGEMENT</h3>

          <div className="space-y-2.5 flex-1 overflow-y-auto pr-1">
            {territories.map((terr) => {
              const mission = missions.find(m => m.id === terr.missionId);

              return (
                <div
                  key={terr.id}
                  className="bg-slate-900/80 border border-slate-800 rounded p-3 hover:border-cyan-800 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-100 text-xs">{terr.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${
                      terr.controlledBy === 'EUROCORP' ? 'border-cyan-500 text-cyan-300 bg-cyan-950' : 'border-red-500 text-red-400 bg-red-950'
                    }`}>
                      {terr.controlledBy}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] my-1 text-slate-400">
                    <span>TAX REVENUE:</span>
                    <span className="text-emerald-400 font-bold">+₢ {terr.dailyIncome.toLocaleString()}</span>
                  </div>

                  {/* Tax Rate Slider */}
                  <div className="my-2 border-t border-slate-800/60 pt-1.5 text-[10px]">
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>TAX RATE: {terr.taxRate}%</span>
                      <span className={terr.rebellionRisk > 40 ? 'text-red-400 font-bold' : 'text-slate-400'}>
                        REBELLION RISK: {terr.rebellionRisk}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      value={terr.taxRate}
                      onChange={(e) => updateTaxRate(terr.id, Number(e.target.value))}
                      className="w-full accent-cyan-400 h-1 cursor-pointer"
                    />
                  </div>

                  {/* Mission Launch Button if Available */}
                  {mission && (
                    <button
                      onClick={() => {
                        onSelectMission(mission);
                        syndicateAudio.playSound('CLICK');
                      }}
                      className="w-full mt-2 cyber-button text-[10px] py-1.5 flex items-center justify-center space-x-1"
                    >
                      <Crosshair className="h-3.5 w-3.5" />
                      <span>DISPATCH MISSION</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
