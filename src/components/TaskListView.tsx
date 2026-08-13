import React, { useMemo, useState, useEffect } from 'react';
import { Task, Urgency, TaskStatus } from '../types';
import { StatusColor } from '../services/boards';
import { tagService } from '../services/tags';
import { taskMatches } from '../services/search';
import { format, parseISO, isPast } from 'date-fns';
import { Search, Pencil, Eye, Check, Bell, Repeat, ListChecks, ChevronUp, ChevronDown, Save, Trash2, Star } from 'lucide-react';

interface TaskListViewProps {
  tasks: Task[];
  onView: (task: Task) => void;
  onEdit: (task: Task) => void;
  onToggle: (task: Task) => void;
  onContext?: (e: React.MouseEvent, task: Task) => void;
  statusLabel?: (task: Task) => string;
  statusColor?: (task: Task) => StatusColor;
}

type SortKey = 'title' | 'status' | 'urgency' | 'due';
type SortDir = 'asc' | 'desc';

interface SavedFilter {
  name: string;
  search: string;
  urgency: Urgency | 'all';
  status: TaskStatus | 'all';
  tag: string;
  sortKey: SortKey | null;
  sortDir: SortDir;
}

const SAVED_KEY = 'tudu_list_saved_filters';

const urgencyMeta: Record<Urgency, { label: string; dot: string; text: string; rank: number }> = {
  low: { label: 'Baixa', dot: 'bg-emerald-500', text: 'text-emerald-400', rank: 0 },
  medium: { label: 'Média', dot: 'bg-amber-500', text: 'text-amber-400', rank: 1 },
  high: { label: 'Alta', dot: 'bg-orange-500', text: 'text-orange-400', rank: 2 },
  critical: { label: 'Crítica', dot: 'bg-rose-500', text: 'text-rose-400', rank: 3 },
};

const statusMeta: Record<TaskStatus, { label: string; rank: number }> = {
  backlog: { label: 'Backlog', rank: 0 },
  todo: { label: 'A Fazer', rank: 1 },
  in_progress: { label: 'Em Andamento', rank: 2 },
  review: { label: 'Revisão', rank: 3 },
  done: { label: 'Finalizado', rank: 4 },
};

function loadSaved(): SavedFilter[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function TaskListView({ tasks, onView, onEdit, onToggle, onContext, statusLabel, statusColor }: TaskListViewProps) {
  const [search, setSearch] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<Urgency | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [saved, setSaved] = useState<SavedFilter[]>(loadSaved);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => t.tags.forEach(tag => set.add(tag)));
    return [...set].sort();
  }, [tasks]);

  const statusOf = (t: Task): TaskStatus => (t.status || (t.completed ? 'done' : 'todo')) as TaskStatus;

  const filtered = useMemo(() => {
    const list = tasks.filter(t => {
      if (search.trim() && !taskMatches(t, search)) return false;
      if (urgencyFilter !== 'all' && t.urgency !== urgencyFilter) return false;
      if (statusFilter !== 'all' && statusOf(t) !== statusFilter) return false;
      if (tagFilter !== 'all' && !t.tags.includes(tagFilter)) return false;
      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (!sortKey) {
        // Padrão: por prazo crescente, sem prazo por último.
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      switch (sortKey) {
        case 'title': return a.title.localeCompare(b.title) * dir;
        case 'urgency': return (urgencyMeta[a.urgency].rank - urgencyMeta[b.urgency].rank) * dir;
        case 'status': return ((statusMeta[statusOf(a)]?.rank ?? 99) - (statusMeta[statusOf(b)]?.rank ?? 99)) * dir;
        case 'due': {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate) * dir;
        }
        default: return 0;
      }
    });
    return list;
  }, [tasks, search, urgencyFilter, statusFilter, tagFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortHead = ({ label, k }: { label: string; k: SortKey }) => (
    <button onClick={() => toggleSort(k)} className="flex items-center gap-1 hover:text-white transition-colors">
      {label}
      {sortKey === k && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
    </button>
  );

  // ---- Filtros salvos ----
  const persist = (list: SavedFilter[]) => {
    setSaved(list);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  };

  const saveCurrent = () => {
    const name = window.prompt('Nome para este filtro:');
    if (!name || !name.trim()) return;
    const entry: SavedFilter = { name: name.trim(), search, urgency: urgencyFilter, status: statusFilter, tag: tagFilter, sortKey, sortDir };
    persist([...saved.filter(s => s.name !== entry.name), entry]);
  };

  const applySaved = (name: string) => {
    const s = saved.find(x => x.name === name);
    if (!s) return;
    setSearch(s.search); setUrgencyFilter(s.urgency); setStatusFilter(s.status);
    setTagFilter(s.tag); setSortKey(s.sortKey); setSortDir(s.sortDir);
  };

  useEffect(() => { setSaved(loadSaved()); }, []);

  const selectClass = 'bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-3 shrink-0">
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
          {(Object.keys(statusMeta) as TaskStatus[]).map(k => <option key={k} value={k}>{statusMeta[k].label}</option>)}
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
      </div>

      {/* Filtros salvos */}
      <div className="flex flex-wrap items-center gap-2 mb-6 shrink-0">
        <Star size={13} className="text-zinc-500" />
        {saved.length === 0 ? (
          <span className="text-xs text-zinc-600">Nenhum filtro salvo</span>
        ) : (
          saved.map(s => (
            <span key={s.name} className="flex items-center gap-1 pl-2.5 pr-1 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-zinc-300">
              <button onClick={() => applySaved(s.name)} className="hover:text-white transition-colors">{s.name}</button>
              <button onClick={() => persist(saved.filter(x => x.name !== s.name))} className="p-0.5 text-zinc-500 hover:text-rose-400 transition-colors" title="Remover filtro">
                <Trash2 size={11} />
              </button>
            </span>
          ))
        )}
        <button onClick={saveCurrent} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors ml-1">
          <Save size={13} /> Salvar filtro atual
        </button>
        <span className="text-xs text-zinc-500 ml-auto">{filtered.length} de {tasks.length}</span>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500 italic py-10 text-center">Nenhuma tarefa corresponde aos filtros.</p>
      ) : (
        <div className="rounded-2xl border border-white/10 overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="hidden md:grid grid-cols-[1fr_130px_110px_130px_100px] gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/10 text-[10px] uppercase font-bold tracking-wider text-zinc-500 shrink-0">
            <SortHead label="Tarefa" k="title" />
            <SortHead label="Status" k="status" />
            <SortHead label="Criticidade" k="urgency" />
            <SortHead label="Entrega" k="due" />
            <span>Ações</span>
          </div>
          <div className="divide-y divide-white/5 overflow-y-auto custom-scrollbar flex-1 min-h-0">
            {filtered.map(task => {
              const meta = urgencyMeta[task.urgency];
              const status = statusLabel ? statusLabel(task) : (statusMeta[statusOf(task)]?.label ?? statusOf(task));
              const overdue = task.dueDate ? isPast(parseISO(task.dueDate)) && !task.completed : false;
              const subDone = task.subtasks?.filter(s => s.done).length ?? 0;
              const subTotal = task.subtasks?.length ?? 0;
              return (
                <div
                  key={task.id}
                  onClick={() => onView(task)}
                  onContextMenu={onContext ? (e) => onContext(e, task) : undefined}
                  className="grid grid-cols-1 md:grid-cols-[1fr_130px_110px_130px_100px] gap-2 md:gap-4 px-5 py-4 items-center hover:bg-white/[0.03] transition-colors cursor-pointer"
                >
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
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400 min-w-0">
                    {statusColor && <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor(task).dot}`}></span>}
                    <span className="truncate">{status}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full ${meta.dot}`}></span>
                    <span className={meta.text}>{meta.label}</span>
                  </div>
                  <div className={`text-xs ${overdue ? 'text-rose-500 font-semibold' : 'text-zinc-400'}`}>
                    {task.dueDate ? format(parseISO(task.dueDate), 'dd/MM/yy HH:mm') : <span className="text-zinc-600">—</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); onView(task); }} title="Ver detalhes" className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors">
                      <Eye size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onEdit(task); }} title="Editar" className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors">
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
