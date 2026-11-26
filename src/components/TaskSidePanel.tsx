import React, { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Pencil, Pin, ChevronUp, ChevronDown, Check, CalendarClock, Timer, MessageSquare, Repeat, Folder, Layers } from 'lucide-react';
import { format, parseISO, differenceInCalendarDays, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Task, Persona, Project, Epic } from '../types';
import { BoardColumn, doneColumnId } from '../services/boards';
import { tagService } from '../services/tags';
import { Avatar } from './Avatar';
import { Markdown } from './Markdown';
import { AttachmentsView } from './Attachments';
import { LongWordText } from './LongWordText';

const URG: Record<Task['urgency'], { label: string; dot: string }> = {
  low: { label: 'Baixa', dot: 'bg-emerald-500' },
  medium: { label: 'Média', dot: 'bg-amber-500' },
  high: { label: 'Alta', dot: 'bg-orange-500' },
  critical: { label: 'Crítica', dot: 'bg-rose-500' },
};

function hm(min: number) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? (m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`) : `${m} min`;
}

/** "Vence hoje às 18:00", "Atrasada há 2 dias", "Vence em 3 dias"... */
function dueText(task: Task): string | null {
  if (!task.dueDate) return null;
  const d = parseISO(task.dueDate);
  const hora = format(d, 'HH:mm');
  const dias = differenceInCalendarDays(d, new Date());
  if (task.completed) return `Prazo era ${format(d, "dd/MM 'às' HH:mm")}`;
  if (isPast(d)) {
    const atraso = -dias;
    return atraso <= 0 ? `Venceu hoje às ${hora}` : `Atrasada há ${atraso} ${atraso === 1 ? 'dia' : 'dias'}`;
  }
  if (dias === 0) return `Vence hoje às ${hora}`;
  if (dias === 1) return `Vence amanhã às ${hora}`;
  return `Vence em ${dias} dias`;
}

/** A linha de resumo: o "o que está rolando" sem precisar ler a tarefa toda. */
function summary(task: Task): string[] {
  const out: string[] = [];
  const due = dueText(task);
  if (due) out.push(due);
  const subs = task.subtasks ?? [];
  if (subs.length) out.push(`${subs.filter(s => s.done).length} de ${subs.length} subtarefas`);
  if (task.spentMinutes) out.push(task.estimateMinutes ? `${hm(task.spentMinutes)} de ${hm(task.estimateMinutes)}` : `${hm(task.spentMinutes)} apontados`);
  if (task.completed && task.completedAt) out.push(`concluída em ${format(parseISO(task.completedAt), 'dd/MM')}`);
  if (!out.length) out.push('Sem prazo, sem subtarefas — tudo em aberto.');
  return out;
}

/** Linha do tempo com o que o banco guarda: criação, foco, comentários, conclusão. */
function activity(task: Task): { at: string; text: string }[] {
  const ev: { at: string; text: string }[] = [{ at: task.createdAt, text: 'Criada' }];
  for (const t of task.timeEntries ?? []) ev.push({ at: t.startedAt, text: `${hm(t.minutes)} ${t.source === 'pomodoro' ? 'de foco' : 'apontados à mão'}` });
  for (const c of task.comments ?? []) ev.push({ at: c.createdAt, text: `Comentário: ${c.text}` });
  if (task.completedAt) ev.push({ at: task.completedAt, text: 'Concluída' });
  return ev.filter(e => e.at).sort((a, b) => b.at.localeCompare(a.at));
}

interface TaskSidePanelProps {
  task: Task | null;
  columns: BoardColumn[];
  assignee?: Persona;
  project?: Project;
  epic?: Epic;
  /** Tem anterior/próxima na mesma coluna? (↑↓) */
  hasPrev: boolean;
  hasNext: boolean;
  onNavigate: (dir: -1 | 1) => void;
  onClose: () => void;
  onMoveTo: (task: Task, columnId: string) => void;
  onToggleSubtask: (task: Task, subtaskId: string) => void;
  onToggleComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  /** Fixar na área de trabalho (só no app desktop). */
  onPin?: (task: Task) => void;
}

/**
 * Visão completa de uma tarefa num painel que desliza da direita. O board
 * continua à vista e utilizável atrás; Esc fecha, ↑↓ trocam de tarefa.
 */
export function TaskSidePanel({ task, columns, assignee, project, epic, hasPrev, hasNext, onNavigate, onClose, onMoveTo, onToggleSubtask, onToggleComplete, onEdit, onPin }: TaskSidePanelProps) {
  useEffect(() => {
    if (!task) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowUp' && hasPrev) { e.preventDefault(); onNavigate(-1); }
      else if (e.key === 'ArrowDown' && hasNext) { e.preventDefault(); onNavigate(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [task, hasPrev, hasNext, onNavigate, onClose]);

  const status = task ? (task.status || (task.completed ? doneColumnId(columns) : columns[0]?.id)) : '';
  const statusIdx = columns.findIndex(c => c.id === status);
  const acts = useMemo(() => (task ? activity(task) : []), [task]);
  const subs = task?.subtasks ?? [];
  const subDone = subs.filter(s => s.done).length;

  return (
    <AnimatePresence>
      {task && (
        <motion.aside
          key="painel"
          role="dialog"
          aria-label={`Tarefa: ${task.title}`}
          initial={{ x: '100%', opacity: 0.6 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0.6 }}
          transition={{ type: 'tween', duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="task-panel fixed top-8 right-0 bottom-0 z-[60] w-[min(460px,100vw)] flex flex-col bg-[#09090b] border-l border-white/10 shadow-[-24px_0_48px_-24px_rgba(0,0,0,0.7)]"
        >
          {/* Cabeçalho: contexto, navegação e ações */}
          <div className="flex items-center gap-1 px-4 h-12 border-b border-white/5 shrink-0">
            <div className="flex-1 min-w-0 flex items-center gap-1.5 text-[11px] text-zinc-500 truncate">
              {project && <><Folder size={12} className="shrink-0" /><span className="truncate">{project.name}</span></>}
              {epic && <><span>·</span><Layers size={12} className="shrink-0" /><span className="truncate">{epic.name}</span></>}
              {!project && !epic && <span>Tarefa</span>}
            </div>
            <button type="button" onClick={() => onNavigate(-1)} disabled={!hasPrev} title="Tarefa anterior (↑)" className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"><ChevronUp size={16} /></button>
            <button type="button" onClick={() => onNavigate(1)} disabled={!hasNext} title="Próxima tarefa (↓)" className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"><ChevronDown size={16} /></button>
            {onPin && <button type="button" onClick={() => onPin(task)} title="Fixar na área de trabalho" className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"><Pin size={15} /></button>}
            <button type="button" onClick={() => onEdit(task)} title="Editar tarefa" className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"><Pencil size={15} /></button>
            <button type="button" onClick={onClose} title="Fechar (Esc)" className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"><X size={16} /></button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 py-4 space-y-5">
            {/* Título + concluir */}
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => onToggleComplete(task)}
                title={task.completed ? 'Reabrir tarefa' : 'Concluir tarefa'}
                className={`mt-1 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${task.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-500 hover:border-emerald-400'}`}
              >
                {task.completed && <Check size={12} strokeWidth={4} />}
              </button>
              <h2 className={`text-lg font-semibold leading-snug break-words min-w-0 ${task.completed ? 'line-through text-zinc-500' : 'text-white'}`}>
                <LongWordText text={task.title} />
              </h2>
            </div>

            {/* Trilho de status: um clique move a tarefa */}
            <div>
              <div className="flex gap-1" role="radiogroup" aria-label="Etapa">
                {columns.map((c, i) => {
                  const now = c.id === status;
                  const past = statusIdx >= 0 && i < statusIdx;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={now}
                      onClick={() => !now && onMoveTo(task, c.id)}
                      title={now ? `Em ${c.label}` : `Mover para ${c.label}`}
                      className={`flex-1 min-w-0 text-[11px] leading-tight font-semibold px-1 py-1.5 min-h-[34px] rounded-lg border break-normal transition-colors ${
                        now ? 'bg-indigo-600 border-indigo-600 text-white'
                          : past ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/20'
                          : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {/* Quebra depois da barra ("Revisando/ Teste"), nunca no meio da palavra. */}
                      {c.label.replace(/\//g, '/​')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Resumo */}
            <p className="text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/25 rounded-lg px-3 py-2 leading-relaxed">
              {summary(task).join(' · ')}
            </p>

            {/* Detalhes em chips */}
            <div className="flex flex-wrap gap-1.5">
              <span className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md bg-white/5 border border-white/10 text-zinc-300">
                <span className={`w-1.5 h-1.5 rounded-full ${URG[task.urgency].dot}`} /> {URG[task.urgency].label}
              </span>
              {task.dueDate && (
                <span className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md bg-white/5 border border-white/10 text-zinc-300">
                  <CalendarClock size={12} /> {format(parseISO(task.dueDate), "EEE, dd/MM 'às' HH:mm", { locale: ptBR })}
                </span>
              )}
              {assignee && (
                <span className="flex items-center gap-1.5 text-[11px] pl-1 pr-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-zinc-300">
                  <Avatar persona={assignee} size={18} /> {assignee.name}
                </span>
              )}
              {task.recurrence && task.recurrence !== 'none' && (
                <span className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md bg-white/5 border border-white/10 text-zinc-300"><Repeat size={12} /> Recorrente</span>
              )}
              {!!task.spentMinutes && (
                <span className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md bg-white/5 border border-white/10 text-zinc-300"><Timer size={12} /> {hm(task.spentMinutes)}</span>
              )}
              {task.tags.map(tag => (
                <span key={tag} className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md bg-white/5 border border-white/10 text-zinc-300 max-w-full">
                  <span className={`w-1.5 h-1.5 shrink-0 rounded-full ${tagService.getTagColor(tag, task.projectId)}`} />
                  <span className="truncate">{tag}</span>
                </span>
              ))}
            </div>

            {/* Subtarefas */}
            {subs.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Subtarefas</h3>
                  <span className="text-[11px] text-zinc-500">{subDone}/{subs.length}</span>
                </div>
                <div className="h-1 rounded-full bg-white/10 overflow-hidden mb-2">
                  <div className="h-full bg-indigo-500 rounded-full transition-[width] duration-300" style={{ width: `${(subDone / subs.length) * 100}%` }} />
                </div>
                <div className="space-y-0.5">
                  {subs.map(s => (
                    <button key={s.id} type="button" onClick={() => onToggleSubtask(task, s.id)} className="w-full flex items-center gap-2.5 text-left rounded-md px-1 py-1 hover:bg-white/5">
                      <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${s.done ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-zinc-500'}`}>
                        {s.done && <Check size={10} strokeWidth={4} />}
                      </span>
                      <LongWordText text={s.title} className={`flex-1 text-sm ${s.done ? 'line-through text-zinc-500' : 'text-zinc-200'}`} />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Descrição */}
            {task.description && (
              <section>
                <h3 className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1.5">Descrição</h3>
                <div className="text-sm text-zinc-300 break-words"><Markdown content={task.description} /></div>
              </section>
            )}

            {task.attachments && task.attachments.length > 0 && (
              <section>
                <h3 className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1.5">Anexos</h3>
                <AttachmentsView attachments={task.attachments} />
              </section>
            )}

            {/* Atividade */}
            <section>
              <h3 className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1.5 flex items-center gap-1.5">
                Atividade {!!task.comments?.length && <span className="flex items-center gap-1 normal-case font-medium"><MessageSquare size={11} /> {task.comments.length}</span>}
              </h3>
              <ol className="border-l border-white/10 ml-1 space-y-2">
                {acts.slice(0, 12).map((a, i) => (
                  <li key={i} className="pl-3 relative text-xs">
                    <span className="absolute -left-[3.5px] top-1.5 w-1.5 h-1.5 rounded-full bg-zinc-600" />
                    <span className="text-zinc-500 tabular-nums">{format(parseISO(a.at), "dd/MM HH:mm")}</span>
                    <span className="text-zinc-300"> · <LongWordText text={a.text} /></span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
