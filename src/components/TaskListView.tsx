import React, { useMemo, useState } from 'react';
import { Task, Urgency, TaskStatus } from '../types';
import { tagService } from '../services/tags';
import { format, parseISO, isPast } from 'date-fns';
import { Search, Pencil, Eye, Check, Bell, Repeat, ListChecks } from 'lucide-react';

interface TaskListViewProps {
  tasks: Task[];
  onView: (task: Task) => void;
  onEdit: (task: Task) => void;
  onToggle: (task: Task) => void;
}

const urgencyMeta: Record<Urgency, { label: string; dot: string; text: string }> = {
  low: { label: 'Baixa', dot: 'bg-emerald-500', text: 'text-emerald-400' },
  medium: { label: 'Média', dot: 'bg-amber-500', text: 'text-amber-400' },
  high: { label: 'Alta', dot: 'bg-orange-500', text: 'text-orange-400' },
  critical: { label: 'Crítica', dot: 'bg-rose-500', text: 'text-rose-400' },
};

const statusLabels: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'A Fazer',
  in_progress: 'Em Andamento',
  review: 'Revisão',
  done: 'Finalizado',
};

export function TaskListView({ tasks, onView, onEdit, onToggle }: TaskListViewProps) {
  const [search, setSearch] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<Urgency | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');

  const allTags = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => t.tags.forEach(tag => set.add(tag)));
    return [...set].sort();
  }, [tasks]);

  const filtered = useMemo(() => {
    return tasks
      .filter(t => {
        if (search.trim()) {
          const q = search.toLowerCase();
          if (!t.title.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return false;
        }
        if (urgencyFilter !== 'all' && t.urgency !== urgencyFilter) return false;
        if (statusFilter !== 'all' && (t.status || (t.completed ? 'done' : 'todo')) !== statusFilter) return false;
        if (tagFilter !== 'all' && !t.tags.includes(tagFilter)) return false;
        return true;
      })
      .sort((a, b) => {
        // Sem prazo por último; com prazo em ordem crescente.
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [tasks, search, urgencyFilter, statusFilter, tagFilter]);

  const selectClass = 'bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none';

  return (
    <div className="flex-1 flex flex-col">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar tarefas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')} className={selectClass}>
          <option value="all">Todos os status</option>
          {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value as Urgency | 'all')} className={selectClass}>
          <option value="all">Todas as criticidades</option>
          <option value="low">Baixa</option>
          <option value="medium">Média</option>
          <option value="high">Alta</option>
          <option value="critical">Crítica</option>
        </select>
        <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className={selectClass}>
          <option value="all">Todas as tags</option>
          {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
        </select>
        <span className="text-xs text-zinc-500 ml-auto">{filtered.length} de {tasks.length}</span>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500 italic py-10 text-center">Nenhuma tarefa corresponde aos filtros.</p>
      ) : (
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_130px_110px_130px_100px] gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/10 text-[10px] uppercase font-bold tracking-wider text-zinc-500">
            <span>Tarefa</span>
            <span>Status</span>
            <span>Criticidade</span>
            <span>Entrega</span>
            <span>Ações</span>
          </div>
          <div className="divide-y divide-white/5">
            {filtered.map(task => {
              const meta = urgencyMeta[task.urgency];
              const status = statusLabels[(task.status || (task.completed ? 'done' : 'todo')) as TaskStatus];
              const overdue = task.dueDate ? isPast(parseISO(task.dueDate)) && !task.completed : false;
              const subDone = task.subtasks?.filter(s => s.done).length ?? 0;
              const subTotal = task.subtasks?.length ?? 0;
              return (
                <div
                  key={task.id}
                  onClick={() => onView(task)}
                  className="grid grid-cols-1 md:grid-cols-[1fr_130px_110px_130px_100px] gap-2 md:gap-4 px-5 py-4 items-center hover:bg-white/[0.03] transition-colors cursor-pointer"
                >
                  {/* Tarefa */}
                  <div className="min-w-0 flex items-start gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggle(task); }}
                      className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${task.completed ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-zinc-500 hover:border-indigo-500'}`}
                    >
                      {task.completed && <Check size={10} strokeWidth={4} />}
                    </button>
                    <div className="min-w-0">
                      <h4 className={`text-sm font-medium truncate ${task.completed ? 'line-through text-zinc-500' : 'text-white'}`}>{task.title}</h4>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        {task.tags.map((tag, idx) => (
                          <span key={`${tag}-${idx}`} className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-zinc-300 bg-white/5 border border-white/10 rounded">
                            <span className={`w-1.5 h-1.5 rounded-full ${tagService.getTagColor(tag)}`}></span>{tag}
                          </span>
                        ))}
                        {subTotal > 0 && (
                          <span className="flex items-center gap-1 text-[10px] text-zinc-400"><ListChecks size={11} />{subDone}/{subTotal}</span>
                        )}
                        {task.recurrence && task.recurrence !== 'none' && <Repeat size={11} className="text-zinc-500" />}
                        {task.notificationsEnabled && <Bell size={11} className="text-indigo-400" />}
                      </div>
                    </div>
                  </div>
                  {/* Status */}
                  <div className="text-xs text-zinc-400">{status}</div>
                  {/* Criticidade */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full ${meta.dot}`}></span>
                    <span className={meta.text}>{meta.label}</span>
                  </div>
                  {/* Entrega */}
                  <div className={`text-xs ${overdue ? 'text-rose-500 font-semibold' : 'text-zinc-400'}`}>
                    {task.dueDate ? format(parseISO(task.dueDate), 'dd/MM/yy HH:mm') : <span className="text-zinc-600">—</span>}
                  </div>
                  {/* Ações */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onView(task); }}
                      title="Ver detalhes"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                      title="Editar"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
