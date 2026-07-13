import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Task } from '../types';
import { Pencil, Eye, Check, RotateCcw, Bell, BellOff, Trash2 } from 'lucide-react';

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
}

export function TaskContextMenu({ state, onClose, onView, onEdit, onToggleComplete, onToggleNotifications, onDelete }: TaskContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

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

  return (
    <div
      ref={ref}
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-[100] w-52 py-1.5 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl shadow-black/40"
    >
      <div className="px-3 pb-1.5 mb-1 border-b border-white/5">
        <p className="text-xs font-medium text-white truncate">{task.title}</p>
      </div>
      <button className={item} onClick={run(onView)}><Eye size={15} className="text-zinc-500" /> Ver detalhes</button>
      <button className={item} onClick={run(onEdit)}><Pencil size={15} className="text-zinc-500" /> Editar</button>
      <button className={item} onClick={run(onToggleComplete)}>
        {task.completed
          ? <><RotateCcw size={15} className="text-zinc-500" /> Reabrir</>
          : <><Check size={15} className="text-emerald-400" /> Concluir</>}
      </button>
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
