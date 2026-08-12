import React, { useState, useRef } from 'react';
import { Check, Bell, BellOff, Pencil, Repeat, ListChecks, ChevronDown } from 'lucide-react';
import { Task, SubTask, Persona, Epic } from '../types';
import { format, parseISO, isPast } from 'date-fns';
import { tagService } from '../services/tags';
import { Avatar } from './Avatar';

export function TaskItem({ title, description, urgency, tags, completed, completedAt, time, notificationsEnabled, recurrence, subtasks, assignee, epic, projectId, onToggle, onToggleNotifications, onToggleSubtask, onEdit, onClick, onContextMenu }: { key?: React.Key; title: string; description?: string; urgency: Task['urgency']; tags: string[]; completed?: boolean; /** Quando a tarefa foi marcada como finalizada (ISO). */ completedAt?: string; time?: string; notificationsEnabled?: boolean; recurrence?: Task['recurrence']; subtasks?: SubTask[]; assignee?: Persona; epic?: Epic; projectId?: string; onToggle?: () => void; onToggleNotifications?: () => void; onToggleSubtask?: (subtaskId: string) => void; onEdit?: () => void; onClick?: () => void; onContextMenu?: (e: React.MouseEvent) => void }) {
  const [showSubtasks, setShowSubtasks] = useState(false);
  // Altura medida do checklist: o conteúdo fica sempre montado, então
  // scrollHeight já entrega o valor exato mesmo com o painel fechado.
  const [panelHeight, setPanelHeight] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const toggleSubtasks = () => {
    setPanelHeight(panelRef.current?.scrollHeight ?? 0);
    setShowSubtasks(v => !v);
  };

  const semAnimacao = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const panelStyle: React.CSSProperties = {
    maxHeight: showSubtasks ? panelHeight : 0,
    opacity: showSubtasks ? 1 : 0,
    marginTop: showSubtasks ? '0.75rem' : 0,
    transition: semAnimacao
      ? undefined
      : 'max-height 0.22s cubic-bezier(0.2, 0.9, 0.25, 1), opacity 0.18s ease-out, margin-top 0.22s cubic-bezier(0.2, 0.9, 0.25, 1)',
  };
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
  const doneAt = completed && completedAt ? parseISO(completedAt) : undefined;
  const subtaskTotal = subtasks?.length ?? 0;
  const subtaskDone = subtasks?.filter(s => s.done).length ?? 0;

  return (
    <div onClick={onClick} onContextMenu={onContextMenu} className={`relative group p-4 rounded-2xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.06] transition-all cursor-pointer ${urgencyStyles[urgency]} ${completed ? 'opacity-50' : ''}`}>
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
            const bgBase = tagService.getTagColor(tag, projectId);
            return (
               <span key={`${tag}-${idx}`} className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium text-zinc-300 bg-white/5 border border-white/10 rounded-md truncate max-w-full">
                <span className={`w-1.5 h-1.5 shrink-0 rounded-full ${bgBase}`}></span>
                <span className="truncate">{tag}</span>
              </span>
            );
          })}
          {subtaskTotal > 0 && (
            onToggleSubtask ? (
              <button
                onClick={(e) => { e.stopPropagation(); toggleSubtasks(); }}
                title={showSubtasks ? 'Ocultar subtarefas' : 'Marcar subtarefas sem abrir a tarefa'}
                className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium border rounded-md transition-colors ${
                  showSubtasks
                    ? 'text-white bg-indigo-500/20 border-indigo-500/40'
                    : 'text-zinc-400 bg-white/5 border-white/10 hover:text-white hover:bg-white/10'
                }`}
              >
                <ListChecks size={11} /> {subtaskDone}/{subtaskTotal}
                <ChevronDown size={10} className={`transition-transform ${showSubtasks ? 'rotate-180' : ''}`} />
              </button>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-zinc-400 bg-white/5 border border-white/10 rounded-md" title="Subtarefas concluídas">
                <ListChecks size={11} /> {subtaskDone}/{subtaskTotal}
              </span>
            )
          )}
          {epic && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-zinc-400 bg-white/5 border border-white/10 rounded-md truncate max-w-[120px]" title={`Épico: ${epic.name}`}>
              <span className={`w-1.5 h-1.5 shrink-0 rounded-full ${epic.color || 'bg-zinc-500'}`}></span>
              <span className="truncate">{epic.name}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end min-w-0 ml-auto">
          {assignee && <Avatar persona={assignee} size={22} />}
          {isRecurring && <Repeat size={12} className="text-zinc-500 shrink-0" aria-label="Tarefa recorrente" />}
          {doneAt && (
            <span
              title={`Finalizada em ${format(doneAt, "dd/MM/yyyy 'às' HH:mm")}`}
              className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-md whitespace-nowrap"
            >
              <Check size={10} strokeWidth={3} />
              {format(doneAt, 'dd/MM · HH:mm')}
            </span>
          )}
          {formattedDue && (
            <span className={`text-xs font-mono whitespace-nowrap ${isOverdue ? 'text-rose-500 font-bold' : 'text-zinc-400'}`}>
              {formattedDue}
            </span>
          )}
          {isOverdue && (
            <span className="text-[9px] uppercase font-bold tracking-wider text-rose-500 bg-rose-500/10 border border-rose-500/30 rounded px-1.5 py-0.5 whitespace-nowrap">
              Atrasado
            </span>
          )}
        </div>
      </div>

      {/* Checklist inline: marcar sem precisar abrir a tarefa. Fica sempre
          montado para que fechar também seja animado — desmontar cortaria a
          transição pela metade. */}
      {subtaskTotal > 0 && subtasks && onToggleSubtask && (
        <div
          ref={panelRef}
          onClick={(e) => e.stopPropagation()}
          aria-hidden={!showSubtasks}
          style={panelStyle}
          className={`subtasks-panel ${showSubtasks ? 'is-open' : 'pointer-events-none'}`}
        >
          <div>
            <div className="ml-9 pt-3 border-t border-white/10 space-y-1.5">
              {subtasks.map(sub => (
                <button
                  key={sub.id}
                  tabIndex={showSubtasks ? 0 : -1}
                  onClick={(e) => { e.stopPropagation(); onToggleSubtask(sub.id); }}
                  className="w-full flex items-center gap-2 text-left group/sub py-0.5"
                >
                  <span className={`shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                    sub.done ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-zinc-500 group-hover/sub:border-indigo-400'
                  }`}>
                    {sub.done && <Check size={9} strokeWidth={4} />}
                  </span>
                  <span className={`text-xs break-words ${sub.done ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                    {sub.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
