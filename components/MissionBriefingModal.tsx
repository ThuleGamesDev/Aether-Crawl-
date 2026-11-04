import React from 'react';
import { Mission } from '../types/syndicate';
import { Target, AlertOctagon, DollarSign, Crosshair, X, Play } from 'lucide-react';
import { syndicateAudio } from '../engine/SyndicateAudio';

interface Props {
  mission: Mission;
  onStartMission: (mission: Mission) => void;
  onClose: () => void;
}

export const MissionBriefingModal: React.FC<Props> = ({
  mission,
  onStartMission,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono">
      <div className="cyber-panel rounded-lg border-2 border-cyan-500 w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-cyan-900 bg-slate-950 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-cyan-400 animate-pulse" />
            <h2 className="text-xl font-bold text-cyan-400 font-serif tracking-wider uppercase">{mission.title}</h2>
          </div>
          <button
            onClick={() => { onClose(); syndicateAudio.playSound('CLICK'); }}
            className="text-slate-400 hover:text-cyan-400 font-bold p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-slate-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
            <div>
              <span className="text-slate-400">LOCATION:</span>
              <span className="ml-2 font-bold text-cyan-300">{mission.cityName}</span>
            </div>
            <div>
              <span className="text-slate-400">TARGET FACTION:</span>
              <span className="ml-2 font-bold text-red-400">{mission.enemyFaction}</span>
            </div>
            <div>
              <span className="text-slate-400">THREAT RATING:</span>
              <span className="ml-2 font-bold text-amber-400">CLASS {mission.threatLevel}</span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1">EXECUTIVE BRIEFING</h3>
            <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded border border-slate-800 leading-relaxed">
              {mission.briefing}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">PRIMARY OBJECTIVES</h3>
            <div className="space-y-1.5">
              {mission.objectives.map((obj) => (
                <div key={obj.id} className="flex items-center space-x-2 bg-slate-900 border border-slate-800 p-2 rounded text-xs">
                  <Crosshair className="h-4 w-4 text-cyan-400" />
                  <span className="text-slate-200">{obj.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-950 p-3 rounded border border-cyan-950">
            <span className="text-xs text-slate-400 font-bold">REWARD CREDITS UPON SUCCESS:</span>
            <span className="text-base font-bold text-emerald-400">₢ {mission.rewardCredits.toLocaleString()}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-900 bg-slate-950 flex justify-end space-x-3">
          <button
            onClick={() => { onClose(); syndicateAudio.playSound('CLICK'); }}
            className="px-4 py-2 rounded text-xs font-bold border border-slate-800 text-slate-400 hover:bg-slate-900"
          >
            ABORT BRIEFING
          </button>
          <button
            onClick={() => {
              onStartMission(mission);
              syndicateAudio.playSound('CLICK');
              syndicateAudio.speak('DEPLOYING SQUAD');
            }}
            className="cyber-button px-6 py-2 text-xs flex items-center space-x-2 shadow-[0_0_15px_rgba(0,240,255,0.5)]"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>DEPLOY TACTICAL SQUAD</span>
          </button>
        </div>
      </div>
    </div>
  );
};
