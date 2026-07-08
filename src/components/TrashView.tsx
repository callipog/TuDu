import React, { useMemo, useState } from 'react';
import { Task, Urgency } from '../types';
import { tagService } from '../services/tags';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2, ArchiveRestore, Search } from 'lucide-react';

interface TrashViewProps {
  tasks: Task[];
  onRestore: (task: Task) => void;
  onDeletePermanent: (ids: string[]) => void;
  onEmptyTrash: () => void;
}

const urgencyMeta: Record<Urgency, { label: string; dot: string; text: string }> = {
  low: { label: 'Baixa', dot: 'bg-emerald-500', text: 'text-emerald-400' },
  medium: { label: 'Média', dot: 'bg-amber-500', text: 'text-amber-400' },
  high: { label: 'Alta', dot: 'bg-orange-500', text: 'text-orange-400' },
  critical: { label: 'Crítica', dot: 'bg-rose-500', text: 'text-rose-400' },
};

export function TrashView({ tasks, onRestore, onDeletePermanent, onEmptyTrash }: TrashViewProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return tasks
      .filter(t => !search.trim() || t.title.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
  }, [tasks, search]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center gap-3 mb-4 shrink-0">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar na lixeira..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>
        {tasks.length > 0 && (
          <button
            onClick={onEmptyTrash}
            className="flex items-center gap-1.5 text-sm font-medium text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/80 border border-rose-500/30 rounded-lg px-3 py-2 transition-colors"
          >
            <Trash2 size={15} /> Esvaziar lixeira
          </button>
        )}
      </div>

      <p className="text-[11px] text-zinc-500 mb-3 shrink-0">Itens na lixeira são apagados definitivamente após 30 dias.</p>

      {tasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-20 text-zinc-500">
          <Trash2 size={40} className="mb-4 opacity-40" />
          <p className="text-sm">A lixeira está vazia.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-500 italic py-10 text-center">Nada encontrado na lixeira.</p>
      ) : (
        <div className="rounded-2xl border border-white/10 overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="hidden md:grid grid-cols-[1fr_130px_140px_180px] gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/10 text-[10px] uppercase font-bold tracking-wider text-zinc-500 shrink-0">
            <span>Tarefa</span>
            <span>Criticidade</span>
            <span>Excluída em</span>
            <span>Ações</span>
          </div>
          <div className="divide-y divide-white/5 overflow-y-auto custom-scrollbar flex-1 min-h-0">
            {filtered.map(task => {
              const meta = urgencyMeta[task.urgency];
              return (
                <div key={task.id} className="grid grid-cols-1 md:grid-cols-[1fr_130px_140px_180px] gap-2 md:gap-4 px-5 py-4 items-center hover:bg-white/[0.03] transition-colors">
                  <div className="min-w-0">
                    <h4 className="text-sm font-medium text-zinc-300 truncate">{task.title}</h4>
                    {task.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        {task.tags.map((tag, idx) => (
                          <span key={`${tag}-${idx}`} className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-zinc-400 bg-white/5 border border-white/10 rounded">
                            <span className={`w-1.5 h-1.5 rounded-full ${tagService.getTagColor(tag)}`}></span>{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full ${meta.dot}`}></span>
                    <span className={meta.text}>{meta.label}</span>
                  </div>
                  <div className="text-xs text-zinc-400">
                    {task.deletedAt ? format(parseISO(task.deletedAt), "dd/MM/yy HH:mm", { locale: ptBR }) : <span className="text-zinc-600">—</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onRestore(task)}
                      title="Restaurar"
                      className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <ArchiveRestore size={13} /> Restaurar
                    </button>
                    <button
                      onClick={() => onDeletePermanent([task.id])}
                      title="Apagar definitivamente"
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 size={14} />
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
