import React from 'react';
import { Settings, Volume2, VolumeX, Monitor, Shield, X, Radio } from 'lucide-react';
import { syndicateAudio } from '../engine/SyndicateAudio';

interface Props {
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  crtEnabled: boolean;
  setCrtEnabled: (enabled: boolean) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({
  isMuted,
  setIsMuted,
  crtEnabled,
  setCrtEnabled,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono">
      <div className="cyber-panel rounded-lg border-2 border-cyan-500 w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-cyan-900 bg-slate-950 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Settings className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-cyan-400 font-serif tracking-wider uppercase">SYSTEM CONFIGURATION</h2>
          </div>
          <button
            onClick={() => { onClose(); syndicateAudio.playSound('CLICK'); }}
            className="text-slate-400 hover:text-cyan-400 font-bold p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Options List */}
        <div className="p-5 space-y-4 text-xs text-slate-200">
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded">
            <div className="flex items-center space-x-2">
              {isMuted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4 text-cyan-400" />}
              <span>SYNTHESIZER AUDIO & VOICE</span>
            </div>
            <button
              onClick={() => {
                const newMute = !isMuted;
                setIsMuted(newMute);
                syndicateAudio.setMuted(newMute);
                syndicateAudio.playSound('CLICK');
              }}
              className={`cyber-button px-3 py-1 text-[10px] ${isMuted ? 'cyber-button-danger' : ''}`}
            >
              {isMuted ? 'DISABLED' : 'ENABLED'}
            </button>
          </div>

          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded">
            <div className="flex items-center space-x-2">
              <Monitor className="h-4 w-4 text-cyan-400" />
              <span>RETRO CRT SCANLINES OVERLAY</span>
            </div>
            <button
              onClick={() => {
                setCrtEnabled(!crtEnabled);
                syndicateAudio.playSound('CLICK');
              }}
              className="cyber-button px-3 py-1 text-[10px]"
            >
              {crtEnabled ? 'ACTIVE' : 'OFF'}
            </button>
          </div>

          <div className="bg-slate-950 p-3 rounded border border-slate-900 text-[11px] text-slate-400 space-y-1">
            <p className="font-bold text-cyan-300">KEYBOARD SHORTCUTS:</p>
            <p>• WASD / ARROWS: Pan Camera</p>
            <p>• Q / E: Rotate Isometric Camera Angle</p>
            <p>• LEFT DRAG: Multi-Agent Selection Box</p>
            <p>• RIGHT CLICK: Move / Attack / Persuade Target</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-900 bg-slate-950 flex justify-end">
          <button
            onClick={() => { onClose(); syndicateAudio.playSound('CLICK'); }}
            className="cyber-button px-6 py-2 text-xs"
          >
            CONFIRM & RETURN
          </button>
        </div>
      </div>
    </div>
  );
};
