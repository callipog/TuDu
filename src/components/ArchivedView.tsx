import React, { useMemo, useState } from 'react';
import { Task, Urgency } from '../types';
import { tagService } from '../services/tags';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Archive, ArchiveRestore, Search } from 'lucide-react';

interface ArchivedViewProps {
  tasks: Task[];
  onUnarchive: (task: Task) => void;
  onClickTask: (task: Task) => void;
}

const urgencyMeta: Record<Urgency, { label: string; dot: string; text: string }> = {
  low: { label: 'Baixa', dot: 'bg-emerald-500', text: 'text-emerald-400' },
  medium: { label: 'Média', dot: 'bg-amber-500', text: 'text-amber-400' },
  high: { label: 'Alta', dot: 'bg-orange-500', text: 'text-orange-400' },
  critical: { label: 'Crítica', dot: 'bg-rose-500', text: 'text-rose-400' },
};

export function ArchivedView({ tasks, onUnarchive, onClickTask }: ArchivedViewProps) {
  const [search, setSearch] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<Urgency | 'all'>('all');
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
        if (tagFilter !== 'all' && !t.tags.includes(tagFilter)) return false;
        return true;
      })
      .sort((a, b) => (b.archivedAt || '').localeCompare(a.archivedAt || ''));
  }, [tasks, search, urgencyFilter, tagFilter]);

  const selectClass = 'bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none';

  return (
    <div className="flex-1 flex flex-col">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar arquivadas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>
        <select value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value as Urgency | 'all')} className={selectClass}>
          <option value="all">Todas as criticidades</option>
          <option value="low">Baixa</option>
          <option value="medium">Média</option>
          <option value="high">Alta</option>
          <option value="critical">Crítica</option>
        </select>
        <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className={selectClass}>
          <option value="all">Todas as tags</option>
          {allTags.map(tag => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
        <span className="text-xs text-zinc-500 ml-auto">{filtered.length} de {tasks.length}</span>
      </div>

      {/* Lista */}
      {tasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-20 text-zinc-500">
          <Archive size={40} className="mb-4 opacity-40" />
          <p className="text-sm">Nenhuma tarefa arquivada ainda.</p>
          <p className="text-xs mt-1 text-zinc-600">Use "Arquivar tudo" na coluna Finalizado para arquivar as concluídas.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-500 italic py-10 text-center">Nenhuma tarefa arquivada corresponde aos filtros.</p>
      ) : (
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          {/* Cabeçalho da lista */}
          <div className="hidden md:grid grid-cols-[1fr_140px_120px_140px_120px] gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/10 text-[10px] uppercase font-bold tracking-wider text-zinc-500">
            <span>Tarefa</span>
            <span>Criticidade</span>
            <span>Entrega</span>
            <span>Arquivada em</span>
            <span>Ações</span>
          </div>
          <div className="divide-y divide-white/5">
            {filtered.map(task => {
              const meta = urgencyMeta[task.urgency];
              return (
                <div
                  key={task.id}
                  onClick={() => onClickTask(task)}
                  className="grid grid-cols-1 md:grid-cols-[1fr_140px_120px_140px_120px] gap-2 md:gap-4 px-5 py-4 items-center hover:bg-white/[0.03] transition-colors cursor-pointer"
                >
                  {/* Tarefa + tags */}
                  <div className="min-w-0">
                    <h4 className="text-sm font-medium text-white truncate">{task.title}</h4>
                    {task.description && (
                      <p className="text-xs text-zinc-500 truncate mt-0.5">{task.description}</p>
                    )}
                    {task.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        {task.tags.map((tag, idx) => (
                          <span key={`${tag}-${idx}`} className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-zinc-300 bg-white/5 border border-white/10 rounded">
                            <span className={`w-1.5 h-1.5 rounded-full ${tagService.getTagColor(tag)}`}></span>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Criticidade */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full ${meta.dot}`}></span>
                    <span className={meta.text}>{meta.label}</span>
                  </div>
                  {/* Entrega */}
                  <div className="text-xs text-zinc-400">
                    {task.dueDate ? format(parseISO(task.dueDate), 'dd/MM/yy HH:mm') : <span className="text-zinc-600">—</span>}
                  </div>
                  {/* Arquivada em */}
                  <div className="text-xs text-zinc-400">
                    {task.archivedAt ? format(parseISO(task.archivedAt), "dd/MM/yy HH:mm", { locale: ptBR }) : <span className="text-zinc-600">—</span>}
                  </div>
                  {/* Ações */}
                  <div className="flex">
                    <button
                      onClick={(e) => { e.stopPropagation(); onUnarchive(task); }}
                      title="Desarquivar"
                      className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <ArchiveRestore size={13} /> Restaurar
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
