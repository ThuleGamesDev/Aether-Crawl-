import React from 'react';
import { ResearchProject } from '../types/syndicate';
import { Cpu, CheckCircle2, PlayCircle, Clock, Zap } from 'lucide-react';
import { syndicateAudio } from '../engine/SyndicateAudio';

interface Props {
  researchProjects: ResearchProject[];
  credits: number;
  onStartResearch: (projectId: string) => void;
}

export const ResearchLab: React.FC<Props> = ({
  researchProjects,
  credits,
  onStartResearch
}) => {
  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950 p-6 flex flex-col font-mono text-slate-100 custom-scrollbar">
      {/* Title Header */}
      <div className="flex items-center justify-between mb-6 border-b border-cyan-900 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-cyan-400 font-serif tracking-widest uppercase">RESEARCH & DEVELOPMENT LAB</h2>
          <p className="text-xs text-slate-400">EUROCORP HIGH-TECH WEAPONRY & CYBERNETIC AUGMENTATION RESEARCH</p>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <Cpu className="h-4 w-4 text-cyan-400 animate-spin" />
          <span className="text-cyan-300 font-bold">AVAILABLE CREDITS: ₢ {credits.toLocaleString()}</span>
        </div>
      </div>

      {/* Research Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 overflow-y-auto custom-scrollbar pr-1">
        {researchProjects.map((project) => (
          <div
            key={project.id}
            className={`cyber-panel rounded-lg p-4 flex flex-col justify-between border transition-all ${
              project.completed
                ? 'border-emerald-700/80 bg-emerald-950/20'
                : project.active
                ? 'border-cyan-400 bg-slate-900/90 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{project.category}</span>
                {project.completed ? (
                  <span className="flex items-center space-x-1 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>UNLOCKED</span>
                  </span>
                ) : project.active ? (
                  <span className="flex items-center space-x-1 text-cyan-400 text-xs font-bold animate-pulse">
                    <Clock className="h-3.5 w-3.5" />
                    <span>IN PROGRESS ({project.daysRemaining} DAYS)</span>
                  </span>
                ) : (
                  <span className="text-amber-400 text-xs font-bold">₢ {project.cost.toLocaleString()}</span>
                )}
              </div>

              <h3 className="text-base font-bold text-slate-100 font-serif tracking-wide mb-1">{project.name}</h3>
              <p className="text-xs text-slate-300 mb-3">{project.description}</p>
            </div>

            {/* Research Action Button */}
            {!project.completed && (
              <div className="mt-4 border-t border-slate-800 pt-3">
                {project.active ? (
                  <div className="w-full bg-cyan-950/80 border border-cyan-800 rounded py-2 text-center text-xs font-bold text-cyan-300">
                    RESEARCHING... ({project.daysRemaining} DAYS REMAINING)
                  </div>
                ) : (
                  <button
                    disabled={credits < project.cost}
                    onClick={() => {
                      onStartResearch(project.id);
                      syndicateAudio.playSound('CLICK');
                    }}
                    className={`w-full py-2 text-xs font-bold rounded flex items-center justify-center space-x-1.5 transition-all ${
                      credits >= project.cost
                        ? 'cyber-button'
                        : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                    }`}
                  >
                    <PlayCircle className="h-4 w-4" />
                    <span>ALLOCATE RESEARCH BUDGET</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
