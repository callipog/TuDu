import React from 'react';
import { Check, Bell, BellOff, Pencil, Repeat, ListChecks } from 'lucide-react';
import { Task, SubTask } from '../types';
import { format, parseISO, isPast } from 'date-fns';
import { tagService } from '../services/tags';

export function TaskItem({ title, description, urgency, tags, completed, time, notificationsEnabled, recurrence, subtasks, onToggle, onToggleNotifications, onEdit, onClick }: { key?: React.Key; title: string; description?: string; urgency: Task['urgency']; tags: string[]; completed?: boolean; time?: string; notificationsEnabled?: boolean; recurrence?: Task['recurrence']; subtasks?: SubTask[]; onToggle?: () => void; onToggleNotifications?: () => void; onEdit?: () => void; onClick?: () => void }) {
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

  const dueDate = time ? parseISO(time) : undefined;
  const formattedDue = dueDate ? format(dueDate, 'dd/MM · HH:mm') : undefined;
  const isOverdue = dueDate ? isPast(dueDate) && !completed : false;
  const isRecurring = recurrence && recurrence !== 'none';
  const subtaskTotal = subtasks?.length ?? 0;
  const subtaskDone = subtasks?.filter(s => s.done).length ?? 0;

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
        <div className="flex items-center gap-0.5 shrink-0 ml-2">
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              title="Editar tarefa"
              className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Pencil size={13} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleNotifications?.(); }}
            title={notificationsEnabled ? 'Notificações ativas' : 'Notificações desativadas'}
            className={`p-1 rounded-md transition-colors ${notificationsEnabled ? 'text-indigo-400 hover:text-indigo-300' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            {notificationsEnabled ? <Bell size={14} /> : <BellOff size={14} />}
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 pl-9 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {tags.map((tag, idx) => {
            const bgBase = tagService.getTagColor(tag);
            return (
               <span key={`${tag}-${idx}`} className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium text-zinc-300 bg-white/5 border border-white/10 rounded-md truncate max-w-full">
                <span className={`w-1.5 h-1.5 shrink-0 rounded-full ${bgBase}`}></span>
                <span className="truncate">{tag}</span>
              </span>
            );
          })}
          {subtaskTotal > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-zinc-400 bg-white/5 border border-white/10 rounded-md" title="Subtarefas concluídas">
              <ListChecks size={11} /> {subtaskDone}/{subtaskTotal}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isRecurring && <Repeat size={12} className="text-zinc-500" aria-label="Tarefa recorrente" />}
          {formattedDue && (
            <span className={`text-xs font-mono ${isOverdue ? 'text-rose-500 font-bold' : 'text-zinc-400'}`}>
              {isOverdue ? `${formattedDue} · Atrasado` : formattedDue}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
