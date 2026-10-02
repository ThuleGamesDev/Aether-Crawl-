import React from 'react';
import { ActiveRoomEvent, Character } from '../types';

interface RoomEventModalProps {
  activeEvent: ActiveRoomEvent;
  party: Character[];
  onResolve: () => void;
}

const RoomEventModal: React.FC<RoomEventModalProps> = ({ activeEvent, party, onResolve }) => {
  const { event, difficultyClass, results, scrapsFound, summary } = activeEvent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 md:p-6 animate-fadeIn select-none">
      <div className="bg-gradient-to-b from-gray-900 via-zinc-900 to-black border-2 border-amber-600/60 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-gray-100">
        
        {/* Header */}
        <div className="p-4 bg-zinc-950/80 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl p-2 bg-zinc-800 rounded-lg border border-amber-500/40 shadow-inner">
              {event.icon}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60">
                  Environmental Hazard
                </span>
                <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                  Target DC: {difficultyClass} ({event.primaryStat})
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold font-serif text-yellow-400 tracking-wide mt-0.5">
                {event.title}
              </h2>
            </div>
          </div>
        </div>

        {/* Narrative & Description */}
        <div className="px-5 py-3.5 bg-zinc-900/60 border-b border-zinc-800">
          <p className="text-xs md:text-sm text-zinc-300 italic leading-relaxed">
            "{event.description}"
          </p>
        </div>

        {/* Party Environmental Checks */}
        <div className="p-4 overflow-y-auto space-y-3.5 flex-1 custom-scrollbar">
          <div className="text-xs uppercase tracking-wider text-zinc-400 font-bold mb-1 flex items-center justify-between">
            <span>Party Environmental Checks (Influenced by Active Status & Conditions)</span>
            <span className="text-zinc-500 text-[11px]">{results.length} Checks Conducted</span>
          </div>

          {results.map((result) => {
            const char = party.find(c => c.id === result.characterId);
            const isCritSuccess = result.criticalSuccess;
            const isCritFail = result.criticalFailure;
            const isSuccess = result.success;

            return (
              <div
                key={result.characterId}
                className={`p-3.5 rounded-lg border transition-all ${
                  isSuccess
                    ? 'bg-zinc-900/80 border-emerald-600/40 hover:border-emerald-500/60'
                    : 'bg-zinc-900/80 border-rose-700/40 hover:border-rose-600/60'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm md:text-base">
                      {result.characterName}
                    </span>
                    <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                      {result.classType}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">
                      {result.baseStat}: {result.statValue} (+{result.statBonus})
                    </span>
                  </div>

                  {/* Outcome Tag */}
                  <div>
                    {isCritSuccess && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-yellow-950 text-yellow-300 border border-yellow-500/60 shadow">
                        ★ CRITICAL SUCCESS
                      </span>
                    )}
                    {!isCritSuccess && isSuccess && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/50">
                        ✓ CHECK PASSED
                      </span>
                    )}
                    {isCritFail && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-950 text-red-200 border border-red-600 shadow">
                        ✕ CRITICAL FAILURE
                      </span>
                    )}
                    {!isCritFail && !isSuccess && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-700">
                        ✕ CHECK FAILED
                      </span>
                    )}
                  </div>
                </div>

                {/* Roll breakdown and modifiers */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300 mb-2 font-mono bg-zinc-950/60 p-2 rounded border border-zinc-800/80">
                  <span className="text-zinc-400">
                    🎲 Roll: <strong className="text-white">{result.roll}</strong>
                  </span>
                  <span>+</span>
                  <span className="text-zinc-300">
                    Stat: <strong className="text-white">+{result.statBonus}</strong>
                  </span>

                  {result.modifiers.length > 0 && (
                    <>
                      <span>+</span>
                      <div className="flex flex-wrap gap-1">
                        {result.modifiers.map((mod, idx) => (
                          <span
                            key={idx}
                            className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border ${
                              mod.value >= 0
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
                                : 'bg-red-950/60 text-rose-300 border-rose-700/50'
                            }`}
                          >
                            {mod.label}
                          </span>
                        ))}
                      </div>
                    </>
                  )}

                  <span className="ml-auto font-bold">
                    = <span className={isSuccess ? 'text-emerald-400 text-sm' : 'text-rose-400 text-sm'}>{result.totalScore}</span> vs DC {result.difficultyClass}
                  </span>
                </div>

                {/* Consequence summary */}
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <p className="italic text-zinc-200">{result.logSummary}</p>
                  
                  {/* Resource changes */}
                  <div className="flex items-center gap-2 shrink-0 font-mono">
                    {result.hpChange < 0 && (
                      <span className="text-rose-400 font-bold bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800">
                        {result.hpChange} HP
                      </span>
                    )}
                    {result.mpChange < 0 && (
                      <span className="text-blue-400 font-bold bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800">
                        {result.mpChange} MP
                      </span>
                    )}
                    {result.mpChange > 0 && (
                      <span className="text-cyan-300 font-bold bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
                        +{result.mpChange} MP
                      </span>
                    )}
                    {result.statusApplied && (
                      <span className="text-amber-300 font-bold bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                        +{result.statusApplied}
                      </span>
                    )}
                  </div>
                </div>

                {/* HP/MP bar of character */}
                {char && (
                  <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center gap-4 text-[11px] font-mono text-zinc-400">
                    <div className="flex-1 flex items-center gap-2">
                      <span className="w-6 text-rose-400 font-bold">HP</span>
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-600 transition-all duration-300"
                          style={{ width: `${Math.max(0, Math.min(100, (char.stats.hp / char.stats.maxHp) * 100))}%` }}
                        />
                      </div>
                      <span className="text-zinc-300 text-[10px]">{char.stats.hp}/{char.stats.maxHp}</span>
                    </div>

                    <div className="flex-1 flex items-center gap-2">
                      <span className="w-6 text-blue-400 font-bold">MP</span>
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all duration-300"
                          style={{ width: `${Math.max(0, Math.min(100, (char.stats.mp / char.stats.maxMp) * 100))}%` }}
                        />
                      </div>
                      <span className="text-zinc-300 text-[10px]">{char.stats.mp}/{char.stats.maxMp}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="text-xs text-zinc-400">
            <span className="font-semibold text-amber-400">{summary}</span>
            {scrapsFound && scrapsFound > 0 ? (
              <span className="ml-2 text-yellow-300 font-bold">
                (+{scrapsFound} scrap salvaged from disarmed mechanisms!)
              </span>
            ) : null}
          </div>

          <button
            onClick={onResolve}
            className="w-full md:w-auto px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 active:scale-95 text-white font-bold font-serif tracking-wider rounded-lg shadow-lg border border-amber-400/50 transition-all text-sm cursor-pointer"
          >
            BRACE PARTY & RESUME DELVE
          </button>
        </div>

      </div>
    </div>
  );
};

export default RoomEventModal;
