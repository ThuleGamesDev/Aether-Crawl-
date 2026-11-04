import React from 'react';
import { GamePhase } from '../types/syndicate';
import { Globe, Cpu, Shield, Volume2, VolumeX, Terminal, Settings } from 'lucide-react';
import { syndicateAudio } from '../engine/SyndicateAudio';

interface Props {
  credits: number;
  dailyIncome: number;
  day: number;
  territoriesControlled: number;
  totalTerritories: number;
  phase: GamePhase;
  setPhase: (phase: GamePhase) => void;
  crtEnabled: boolean;
  setCrtEnabled: (enabled: boolean) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
}

export const CyberTerminalHeader: React.FC<Props> = ({
  credits,
  dailyIncome,
  day,
  territoriesControlled,
  totalTerritories,
  phase,
  setPhase,
  crtEnabled,
  setCrtEnabled,
  isMuted,
  setIsMuted
}) => {
  const toggleMute = () => {
    const newMute = !isMuted;
    setIsMuted(newMute);
    syndicateAudio.setMuted(newMute);
    syndicateAudio.playSound('CLICK');
  };

  return (
    <header className="relative z-30 flex flex-wrap items-center justify-between border-b border-cyan-900/60 bg-slate-950/90 px-4 py-2.5 backdrop-blur-md shadow-lg">
      {/* Brand & Logo */}
      <div className="flex items-center space-x-3">
        <div className="flex h-9 w-9 items-center justify-center rounded border border-cyan-400 bg-cyan-950/80 text-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.4)]">
          <Terminal className="h-5 w-5 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-bold tracking-widest text-cyan-400 text-lg uppercase font-serif">EUROCORP</h1>
            <span className="rounded bg-cyan-950 px-1.5 py-0.5 text-[10px] font-mono text-cyan-300 border border-cyan-800">SYNDICATE WARS</span>
          </div>
          <p className="text-[10px] text-slate-400 font-mono">EXECUTIVE COMMAND SYSTEM // DAY {day}</p>
        </div>
      </div>

      {/* Global Status Counters */}
      <div className="hidden md:flex items-center space-x-6 text-xs font-mono">
        <div className="flex items-center space-x-2 border-r border-slate-800 pr-4">
          <span className="text-slate-400">CREDITS:</span>
          <span className="font-bold text-amber-400 text-sm">₢ {credits.toLocaleString()}</span>
        </div>

        <div className="flex items-center space-x-2 border-r border-slate-800 pr-4">
          <span className="text-slate-400">REVENUE:</span>
          <span className="font-bold text-emerald-400 text-sm">+₢ {dailyIncome.toLocaleString()}/day</span>
        </div>

        <div className="flex items-center space-x-2">
          <Globe className="h-4 w-4 text-cyan-400" />
          <span className="text-slate-400">TERRITORIES:</span>
          <span className="font-bold text-cyan-300">{territoriesControlled} / {totalTerritories}</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex items-center space-x-1">
        <button
          onClick={() => { setPhase('GLOBAL_MAP'); syndicateAudio.playSound('CLICK'); }}
          className={`flex items-center space-x-1.5 rounded px-3 py-1.5 text-xs font-bold transition-all ${
            phase === 'GLOBAL_MAP'
              ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(0,240,255,0.5)]'
              : 'text-cyan-400 hover:bg-cyan-950/60'
          }`}
        >
          <Globe className="h-3.5 w-3.5" />
          <span>WORLD MAP</span>
        </button>

        <button
          onClick={() => { setPhase('RESEARCH'); syndicateAudio.playSound('CLICK'); }}
          className={`flex items-center space-x-1.5 rounded px-3 py-1.5 text-xs font-bold transition-all ${
            phase === 'RESEARCH'
              ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(0,240,255,0.5)]'
              : 'text-cyan-400 hover:bg-cyan-950/60'
          }`}
        >
          <Cpu className="h-3.5 w-3.5" />
          <span>R&D LAB</span>
        </button>

        <button
          onClick={() => { setPhase('ARMORY'); syndicateAudio.playSound('CLICK'); }}
          className={`flex items-center space-x-1.5 rounded px-3 py-1.5 text-xs font-bold transition-all ${
            phase === 'ARMORY'
              ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(0,240,255,0.5)]'
              : 'text-cyan-400 hover:bg-cyan-950/60'
          }`}
        >
          <Shield className="h-3.5 w-3.5" />
          <span>ARMORY</span>
        </button>

        <button
          onClick={() => { setPhase('SETTINGS'); syndicateAudio.playSound('CLICK'); }}
          className="rounded p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-900 transition-colors"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>

        <button
          onClick={toggleMute}
          className="rounded p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-900 transition-colors"
          title={isMuted ? "Unmute Sound" : "Mute Sound"}
        >
          {isMuted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4 text-cyan-400" />}
        </button>

        <button
          onClick={() => setCrtEnabled(!crtEnabled)}
          className={`rounded border px-2 py-1 text-[10px] font-mono transition-all ${
            crtEnabled ? 'border-cyan-400 bg-cyan-950 text-cyan-300' : 'border-slate-700 text-slate-500'
          }`}
          title="Toggle CRT Scanlines"
        >
          CRT
        </button>
      </nav>
    </header>
  );
};
