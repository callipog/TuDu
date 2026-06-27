import React from 'react';
import { Check } from 'lucide-react';
import { Task } from '../types';
import { format, parseISO } from 'date-fns';
import { tagService } from '../services/tags';

export function TaskItem({ title, description, urgency, tags, completed, time, onToggle, onClick }: { key?: React.Key; title: string; description?: string; urgency: Task['urgency']; tags: string[]; completed?: boolean; time?: string; onToggle?: () => void; onClick?: () => void }) {
  const urgencyStyles = {
    low: 'hover:border-emerald-500/50',
    medium: 'hover:border-amber-500/50',
    high: 'hover:border-orange-500/50',
    critical: 'hover:border-rose-500/50',
  };

  const urgencyColors = {
    low: 'bg-emerald-500',
    medium: 'bg-amber-500',
    high: 'bg-orange-500',
    critical: 'bg-rose-500',
  };

  const formattedTime = time ? format(parseISO(time), 'HH:mm') : undefined;

  return (
    <div onClick={onClick} className={`relative group p-4 rounded-2xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.06] transition-all cursor-pointer ${urgencyStyles[urgency]} ${completed ? 'opacity-50' : ''}`}>
      <div className={`absolute left-2.5 top-3 bottom-3 w-1 rounded-full ${urgencyColors[urgency]} opacity-60`} />
      <div className="flex justify-between items-start mb-2 pl-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <button onClick={(e) => { e.stopPropagation(); onToggle?.(); }} className={`mt-0.5 shrink-0 w-4 h-4 rounded border ${completed ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-zinc-500 hover:border-indigo-500'} flex items-center justify-center transition-colors`}>
            {completed && <Check size={10} strokeWidth={4} />}
          </button>
          <div className="min-w-0 flex-1">
             <h3 className={`text-sm font-medium break-words ${completed ? 'line-through text-zinc-400' : 'text-white'}`}>{title}</h3>
             {description && <p className="text-xs text-zinc-400 leading-relaxed mt-1 line-clamp-2 break-words">{description}</p>}
          </div>
        </div>
        {formattedTime && <span className="text-[10px] text-zinc-500 font-mono ml-4 shrink-0">{formattedTime}</span>}
        {!formattedTime && urgency === 'critical' && !completed && <span className="text-[10px] text-rose-500 font-bold uppercase tracking-tighter shrink-0 ml-4">Atrasado</span>}
      </div>
      
      <div className="mt-4 flex items-center gap-2 pl-9 flex-wrap">
        {tags.map((tag, idx) => {
          const bgBase = tagService.getTagColor(tag);
          return (
             <span key={`${tag}-${idx}`} className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium text-zinc-300 bg-white/5 border border-white/10 rounded-md truncate max-w-full">
              <span className={`w-1.5 h-1.5 shrink-0 rounded-full ${bgBase}`}></span>
              <span className="truncate">{tag}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
