import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

const Log: React.FC<{ logs: LogEntry[] }> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="w-full h-32 md:h-48 bg-black/80 border border-gray-600 rounded p-2 overflow-y-auto font-mono text-xs md:text-sm shadow-inner">
      {logs.map((log) => (
        <div key={log.id} className={`mb-1 ${
            log.type === 'combat' ? 'text-red-400' :
            log.type === 'loot' ? 'text-yellow-400' :
            log.type === 'story' ? 'text-blue-300 italic' : 'text-gray-300'
        }`}>
          {log.type !== 'story' && <span className="opacity-50 mr-2">{'>'}</span>}
          {log.text}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

export default Log;