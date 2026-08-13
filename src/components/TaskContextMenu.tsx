import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Task } from '../types';
import { Pencil, Eye, Check, RotateCcw, Bell, BellOff, Trash2, Plus, ListChecks, MessageSquare } from 'lucide-react';

export interface TaskMenuState {
  x: number;
  y: number;
  task: Task;
}

interface TaskContextMenuProps {
  state: TaskMenuState | null;
  onClose: () => void;
  onView: (task: Task) => void;
  onEdit: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onToggleNotifications: (task: Task) => void;
  onDelete: (task: Task) => void;
  /** Cria uma subtarefa sem sair do menu. */
  onAddSubtask: (task: Task, title: string) => void;
  /** Abre os detalhes já com o campo de comentário focado (tarefa finalizada). */
  onComment: (task: Task) => void;
}

export function TaskContextMenu({ state, onClose, onView, onEdit, onToggleComplete, onToggleNotifications, onDelete, onAddSubtask, onComment }: TaskContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [subtaskTitle, setSubtaskTitle] = useState('');
  // Quantas foram criadas nesta sessão do menu — o menu fica aberto para
  // permitir várias seguidas, então o contador é o retorno visual.
  const [added, setAdded] = useState(0);

  // Cada abertura do menu recomeça o quick add.
  useEffect(() => {
    setSubtaskTitle('');
    setAdded(0);
  }, [state?.task.id, state?.x, state?.y]);

  // Fecha ao clicar fora, rolar ou apertar Esc.
  useEffect(() => {
    if (!state) return;
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('mousedown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [state, onClose]);

  // Mantém o menu dentro da viewport.
  useLayoutEffect(() => {
    if (!state || !ref.current) return;
    const { offsetWidth: w, offsetHeight: h } = ref.current;
    const pad = 8;
    const x = Math.min(state.x, window.innerWidth - w - pad);
    const y = Math.min(state.y, window.innerHeight - h - pad);
    setPos({ x: Math.max(pad, x), y: Math.max(pad, y) });
  }, [state]);

  if (!state) return null;
  const task = state.task;

  const item = 'flex items-center gap-2.5 w-full text-left px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/10 hover:text-white transition-colors';

  const run = (fn: (t: Task) => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
    fn(task);
  };

  const subtaskTotal = task.subtasks?.length ?? 0;

  const submitSubtask = () => {
    const titulo = subtaskTitle.trim();
    if (!titulo) return;
    onAddSubtask(task, titulo);
    setSubtaskTitle('');
    setAdded(n => n + 1);
    inputRef.current?.focus();
  };

  return (
    <div
      ref={ref}
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-[100] w-60 py-1.5 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl shadow-black/40"
    >
      <div className="px-3 pb-1.5 mb-1 border-b border-white/5">
        <p className="text-xs font-medium text-white truncate">{task.title}</p>
      </div>

      {/* Quick add de subtarefa: Enter cria e o menu continua aberto para
          engatar a próxima. */}
      <div className="px-3 py-1.5" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            value={subtaskTitle}
            onChange={(e) => setSubtaskTitle(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') { e.preventDefault(); submitSubtask(); }
            }}
            placeholder="Nova subtarefa…"
            className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            onClick={(e) => { e.stopPropagation(); submitSubtask(); }}
            disabled={!subtaskTitle.trim()}
            title="Adicionar subtarefa (Enter)"
            className="shrink-0 p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
        {(subtaskTotal > 0 || added > 0) && (
          <p className="flex items-center gap-1.5 mt-1.5 text-[10px] text-zinc-500">
            <ListChecks size={11} />
            {subtaskTotal} no checklist
            {added > 0 && <span className="text-emerald-400">· +{added} agora</span>}
          </p>
        )}
      </div>
      <div className="my-1 border-t border-white/5" />

      <button className={item} onClick={run(onView)}><Eye size={15} className="text-zinc-500" /> Ver detalhes</button>
      <button className={item} onClick={run(onEdit)}><Pencil size={15} className="text-zinc-500" /> Editar</button>
      <button className={item} onClick={run(onToggleComplete)}>
        {task.completed
          ? <><RotateCcw size={15} className="text-zinc-500" /> Reabrir</>
          : <><Check size={15} className="text-emerald-400" /> Concluir</>}
      </button>
      {task.completed && (
        <button className={item} onClick={run(onComment)}>
          <MessageSquare size={15} className="text-indigo-400" /> Comentar
          {(task.comments?.length ?? 0) > 0 && (
            <span className="ml-auto text-[10px] font-semibold text-zinc-500">{task.comments!.length}</span>
          )}
        </button>
      )}
      <button className={item} onClick={run(onToggleNotifications)}>
        {task.notificationsEnabled
          ? <><BellOff size={15} className="text-zinc-500" /> Desativar lembretes</>
          : <><Bell size={15} className="text-indigo-400" /> Ativar lembretes</>}
      </button>
      <div className="my-1 border-t border-white/5" />
      <button className="flex items-center gap-2.5 w-full text-left px-3 py-1.5 text-sm text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors" onClick={run(onDelete)}>
        <Trash2 size={15} /> Excluir
      </button>
    </div>
  );
}
