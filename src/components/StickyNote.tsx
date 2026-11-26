import React, { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Pin, PinOff, ChevronsDownUp, ChevronsUpDown, Maximize2, X, Check, Plus, CalendarClock } from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import { db } from '../db';
import { taskService } from '../services/tasks';
import { columnsFor, doneColumnId, statusRgb, statusLabel } from '../services/boards';
import { LongWordText } from './LongWordText';
import type { StickyState } from '../tudu-api';
import type { Task } from '../types';

/* Canal com a janela principal: ela segura uma cópia das tarefas em memória e
   recarrega quando um card grava algo. (No sentido contrário o Dexie já avisa
   esta janela sozinho: mesma origem, mesmo banco.) */
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('tudu-tasks') : null;
function avisarApp(id: string) { channel?.postMessage({ type: 'changed', id }); }

const URG_DOT: Record<Task['urgency'], string> = {
  low: 'bg-emerald-500', medium: 'bg-amber-500', high: 'bg-orange-500', critical: 'bg-rose-500',
};
const URG_LABEL: Record<Task['urgency'], string> = { low: 'baixa', medium: 'média', high: 'alta', critical: 'crítica' };

const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

/**
 * Um card fixado na área de trabalho. Janela própria, sem moldura: o
 * cabeçalho (na cor da etapa) é por onde ela se arrasta.
 */
export function StickyNote({ taskId }: { taskId: string }) {
  const [state, setState] = useState<StickyState | null>(null);
  const [nova, setNova] = useState('');
  const [saindo, setSaindo] = useState(false);
  const fechou = useRef(false);

  const task = useLiveQuery(() => db.tasks.get(taskId), [taskId], 'carregando' as const);
  const project = useLiveQuery(
    () => (task && task !== 'carregando' && task.projectId ? db.projects.get(task.projectId) : undefined),
    [task && task !== 'carregando' ? task.projectId : undefined],
  );

  useEffect(() => { window.tudu?.sticky?.init().then(setState).catch(() => {}); }, []);
  useEffect(() => { document.title = task && task !== 'carregando' ? `${task.title} · TuDu` : 'TuDu · Card'; }, [task]);

  /* Concluída, arquivada ou apagada (aqui ou no app): o card some sozinho. */
  const acabou = task !== 'carregando' && (!task || task.completed || task.archived || task.deleted);
  useEffect(() => {
    if (!acabou || fechou.current) return;
    fechou.current = true;
    setSaindo(true);
    const t = setTimeout(() => window.tudu?.sticky?.close(), 900);
    return () => clearTimeout(t);
  }, [acabou]);

  if (task === 'carregando') return <div className="h-full bg-[#18181b]" />;
  if (!task) return <div className="h-full bg-[#18181b] grid place-items-center text-xs text-zinc-500">Tarefa não encontrada.</div>;

  const cur: Task = task;
  const cols = columnsFor(project);
  const rgb = statusRgb(task.status, task.completed, cols);
  const etapa = statusLabel(task.status, task.completed, cols);
  const subs = task.subtasks ?? [];
  const feitas = subs.filter(s => s.done).length;
  const due = task.dueDate ? parseISO(task.dueDate) : null;
  const atrasada = !!due && isPast(due) && !task.completed;
  const collapsed = !!state?.collapsed;
  const onTop = state?.onTop !== false;

  async function set(patch: { onTop?: boolean; collapsed?: boolean }) {
    setState(s => (s ? { ...s, ...patch } : s));
    const r = await window.tudu?.sticky?.set(patch).catch(() => null);
    if (r) setState(r);
  }

  async function toggleSub(id: string) {
    const next = subs.map(s => (s.id === id ? { ...s, done: !s.done } : s));
    await taskService.updateTask(cur.id, { subtasks: next });
    avisarApp(cur.id);
  }

  async function addSub() {
    const t = nova.trim();
    if (!t) return;
    setNova('');
    await taskService.addSubtask(cur.id, t);
    avisarApp(cur.id);
  }

  async function concluir() {
    const t = cur;
    const status = doneColumnId(cols);
    const completedAt = new Date().toISOString();
    await taskService.updateTask(t.id, { completed: true, status, completedAt });
    // Mesma regra do app: concluir uma recorrente gera a próxima.
    if (t.recurrence && t.recurrence !== 'none' && t.dueDate) {
      await taskService.createRecurringNext({ ...t, completed: true, status });
    }
    avisarApp(t.id);
  }

  return (
    <div className={`h-full flex flex-col bg-[#18181b] text-white overflow-hidden transition-all duration-500 ${saindo ? 'opacity-0 scale-95' : ''}`}>
      {/* Cabeçalho: cor da etapa, arrasta a janela */}
      <div
        className="h-10 shrink-0 flex items-center gap-1.5 pl-3 pr-1.5 border-b select-none"
        style={{ WebkitAppRegion: 'drag', background: `rgb(${rgb} / 0.16)`, borderColor: `rgb(${rgb} / 0.35)` } as React.CSSProperties}
        onDoubleClick={() => set({ collapsed: !collapsed })}
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: `rgb(${rgb})` }} />
        <span className="flex-1 min-w-0 truncate text-[11px] font-semibold" style={{ color: `rgb(${rgb})` }} title={collapsed ? task.title : etapa}>
          {collapsed ? task.title : etapa}
        </span>
        <div className="flex items-center" style={noDrag}>
          <button type="button" onClick={() => set({ onTop: !onTop })} title={onTop ? 'Deixar de ficar por cima' : 'Sempre por cima das janelas'}
            className={`p-1.5 rounded-md transition-colors ${onTop ? 'text-indigo-300 bg-indigo-500/20' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`}>
            {onTop ? <Pin size={13} /> : <PinOff size={13} />}
          </button>
          <button type="button" onClick={() => set({ collapsed: !collapsed })} title={collapsed ? 'Expandir' : 'Recolher só no título'}
            className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10">
            {collapsed ? <ChevronsUpDown size={13} /> : <ChevronsDownUp size={13} />}
          </button>
          <button type="button" onClick={() => window.tudu?.sticky?.openInApp()} title="Abrir no TuDu"
            className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10">
            <Maximize2 size={13} />
          </button>
          <button type="button" onClick={() => window.tudu?.sticky?.close()} title="Desafixar"
            className="p-1.5 rounded-md text-zinc-400 hover:text-rose-300 hover:bg-rose-500/10">
            <X size={14} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="flex-1 min-h-0 flex flex-col px-3 pt-2.5 pb-3">
          <h1 className="text-sm font-semibold leading-snug break-words"><LongWordText text={task.title} /></h1>
          <p className="mt-1 mb-2 flex items-center gap-1.5 text-[11px] text-zinc-400 flex-wrap">
            <span className={`w-1.5 h-1.5 rounded-full ${URG_DOT[task.urgency]}`} /> {URG_LABEL[task.urgency]}
            {due && <><span>·</span><span className={`flex items-center gap-1 ${atrasada ? 'text-rose-400' : ''}`}><CalendarClock size={11} />{format(due, 'dd/MM HH:mm')}</span></>}
            {subs.length > 0 && <><span>·</span><span>{feitas}/{subs.length}</span></>}
          </p>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar -mx-1 px-1 space-y-0.5">
            {subs.map(s => (
              <button key={s.id} type="button" onClick={() => toggleSub(s.id)} className="w-full flex items-center gap-2 text-left rounded-md px-1 py-1 hover:bg-white/5">
                <span className={`shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center ${s.done ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-zinc-500'}`}>
                  {s.done && <Check size={9} strokeWidth={4} />}
                </span>
                <LongWordText text={s.title} className={`flex-1 text-xs ${s.done ? 'line-through text-zinc-500' : 'text-zinc-200'}`} />
              </button>
            ))}
            {subs.length === 0 && <p className="text-[11px] text-zinc-500 px-1 py-1">Sem subtarefas. Anote os passos aqui embaixo.</p>}
          </div>

          <div className="flex gap-1.5 mt-2">
            <input
              value={nova}
              onChange={e => setNova(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }}
              placeholder="Nova subtarefa e Enter"
              aria-label="Nova subtarefa"
              className="flex-1 min-w-0 h-7 text-xs bg-white/5 border border-white/10 rounded-md px-2 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            <button type="button" onClick={addSub} title="Adicionar" className="h-7 w-7 grid place-items-center rounded-md bg-white/5 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/10">
              <Plus size={13} />
            </button>
          </div>
          <button type="button" onClick={concluir}
            className="mt-2 h-8 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
            <Check size={13} strokeWidth={3} /> Concluir tarefa
          </button>
        </div>
      )}
    </div>
  );
}
