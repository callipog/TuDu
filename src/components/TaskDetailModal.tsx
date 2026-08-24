import React, { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { Task, Persona, Project, Epic } from '../types';
import { tagService } from '../services/tags';
import { Avatar } from './Avatar';
import { AttachmentsView } from './Attachments';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pencil, Bell, BellOff, Repeat, Check, CalendarClock, MessageSquare, Lock, Trash2, Send, Timer } from 'lucide-react';

interface TaskDetailModalProps {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void;
  onEdit: (task: Task) => void;
  assignee?: Persona;
  project?: Project;
  epic?: Epic;
  statusText?: string;
  /** Comentar só é liberado com a tarefa finalizada. */
  onAddComment?: (task: Task, text: string) => void;
  onDeleteComment?: (task: Task, commentId: string) => void;
  /** Lançamento manual de tempo — também liberado com a tarefa finalizada. */
  onAddTime?: (task: Task, minutes: number) => void;
  onDeleteTime?: (task: Task, entryId: string) => void;
  /** Marca/desmarca um item do checklist sem sair do detalhe. */
  onToggleSubtask?: (task: Task, subtaskId: string) => void;
  /** Abre com o campo de comentário focado (vindo do menu de contexto). */
  focusComments?: boolean;
}

const urgencyLabels: Record<Task['urgency'], { label: string; dot: string }> = {
  low: { label: 'Baixa', dot: 'bg-emerald-500' },
  medium: { label: 'Média', dot: 'bg-amber-500' },
  high: { label: 'Alta', dot: 'bg-orange-500' },
  critical: { label: 'Crítica', dot: 'bg-rose-500' },
};

const statusLabels: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'A Fazer',
  in_progress: 'Em Andamento',
  review: 'Revisando/Teste',
  done: 'Finalizado',
};

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function recurrenceText(task: Task): string {
  switch (task.recurrence) {
    case 'daily': return 'Diariamente';
    case 'weekly': return 'Semanalmente';
    case 'monthly': return 'Mensalmente';
    case 'everyN': return `A cada ${task.recurrenceInterval || 1} dia(s)`;
    case 'weekdays': {
      const days = (task.recurrenceWeekdays || []).slice().sort().map(d => WEEKDAY_LABELS[d]).join(', ');
      return days ? `Toda(s): ${days}` : 'Dias da semana';
    }
    default: return 'Não repete';
  }
}

function reminderLabel(min?: number): string {
  if (min == null) return '—';
  if (min < 60) return `${min} min antes`;
  if (min < 1440) return `${min / 60} h antes`;
  return `${min / 1440} dia(s) antes`;
}

/** "3h 30min" — minutos crus são difíceis de ler em estimativa. */
export function formatDuracao(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">{label}</p>
      <div className="text-sm text-white">{children}</div>
    </div>
  );
}

export function TaskDetailModal({ isOpen, task, onClose, onEdit, assignee, project, epic, statusText, onAddComment, onDeleteComment, onAddTime, onDeleteTime, onToggleSubtask, focusComments }: TaskDetailModalProps) {
  const [comment, setComment] = useState('');
  const [horas, setHoras] = useState('');
  const [minutos, setMinutos] = useState('');
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const podeComentar = !!task?.completed && !!onAddComment;
  const podeLancarTempo = !!task?.completed && !!onAddTime;

  // Troca de tarefa (ou fechar) descarta o rascunho não enviado.
  useEffect(() => {
    setComment('');
    setHoras('');
    setMinutos('');
  }, [task?.id, isOpen]);

  useEffect(() => {
    if (isOpen && focusComments && podeComentar) {
      // Espera o modal montar para o foco pegar.
      const t = setTimeout(() => commentRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [isOpen, focusComments, podeComentar, task?.id]);

  if (!task) return null;

  const comments = task.comments ?? [];
  const estouro = !!task.estimateMinutes && (task.spentMinutes ?? 0) > task.estimateMinutes;

  const entries = task.timeEntries ?? [];

  const lancarTempo = () => {
    const total = Math.round((Number(horas.replace(',', '.')) || 0) * 60 + (Number(minutos) || 0));
    if (!onAddTime || total <= 0) return;
    onAddTime(task, total);
    setHoras('');
    setMinutos('');
  };

  const enviarComentario = () => {
    const texto = comment.trim();
    if (!texto || !onAddComment) return;
    onAddComment(task, texto);
    setComment('');
    commentRef.current?.focus();
  };

  const urgency = urgencyLabels[task.urgency];
  const status = statusText || statusLabels[task.status || (task.completed ? 'done' : 'todo')] || task.status;
  const subtaskDone = task.subtasks?.filter(s => s.done).length ?? 0;
  const subtaskTotal = task.subtasks?.length ?? 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalhes da Tarefa">
      <div className="space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1">
        <div>
          <div className="flex items-start gap-2">
            {task.completed && <Check size={18} className="text-emerald-400 mt-0.5 shrink-0" />}
            <h3 className={`text-lg font-semibold ${task.completed ? 'line-through text-zinc-400' : 'text-white'}`}>{task.title}</h3>
          </div>
          {task.description && <p className="text-sm text-zinc-400 mt-2 whitespace-pre-wrap">{task.description}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Status">{status}</Field>
          <Field label="Criticidade">
            <span className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${urgency.dot}`}></span>{urgency.label}
            </span>
          </Field>
          <Field label="Início">
            {task.startDate
              ? <span className="flex items-center gap-1.5"><CalendarClock size={14} className="text-zinc-500" />{format(parseISO(task.startDate), "dd 'de' MMM yyyy · HH:mm", { locale: ptBR })}</span>
              : <span className="text-zinc-500">—</span>}
          </Field>
          <Field label="Data de entrega">
            {task.dueDate
              ? <span className="flex items-center gap-1.5"><CalendarClock size={14} className="text-zinc-500" />{format(parseISO(task.dueDate), "dd 'de' MMM yyyy · HH:mm", { locale: ptBR })}</span>
              : <span className="text-zinc-500">Sem prazo</span>}
          </Field>
          <Field label="Repetição">
            <span className="flex items-center gap-1.5">
              {task.recurrence && task.recurrence !== 'none' && <Repeat size={13} className="text-zinc-500" />}
              {recurrenceText(task)}
            </span>
          </Field>
          <Field label="Notificações">
            {task.notificationsEnabled
              ? <span className="flex items-center gap-1.5 text-indigo-400"><Bell size={14} /> Ativas · {reminderLabel(task.reminderMinutes)}</span>
              : <span className="flex items-center gap-1.5 text-zinc-500"><BellOff size={14} /> Desativadas</span>}
          </Field>
          {!!task.estimateMinutes && (
            <Field label="Estimativa">
              <span className="flex items-center gap-1.5">
                <Timer size={14} className="text-zinc-500" />{formatDuracao(task.estimateMinutes)}
              </span>
            </Field>
          )}
          <Field label="Criada em">
            {task.createdAt ? format(parseISO(task.createdAt), "dd/MM/yyyy", { locale: ptBR }) : '—'}
          </Field>
          {task.completed && (
            <Field label="Finalizada em">
              {task.completedAt
                ? <span className="flex items-center gap-1.5 text-emerald-400"><Check size={14} />{format(parseISO(task.completedAt), "dd 'de' MMM yyyy · HH:mm", { locale: ptBR })}</span>
                : <span className="text-zinc-500">—</span>}
            </Field>
          )}
          {project && (
            <Field label="Projeto">
              <span className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${project.color}`}></span>{project.name}
                {epic && <span className="text-zinc-500">· {epic.name}</span>}
              </span>
            </Field>
          )}
          {assignee && (
            <Field label="Responsável">
              <span className="flex items-center gap-2">
                <Avatar persona={assignee} size={20} />{assignee.name}{assignee.role ? <span className="text-zinc-500">· {assignee.role}</span> : null}
              </span>
            </Field>
          )}
        </div>

        {task.tags.length > 0 && (
          <Field label="Tags">
            <div className="flex items-center gap-2 flex-wrap mt-1">
              {task.tags.map((tag, idx) => (
                <span key={`${tag}-${idx}`} className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-300 bg-white/5 border border-white/10 rounded-md">
                  <span className={`w-1.5 h-1.5 rounded-full ${tagService.getTagColor(tag)}`}></span>{tag}
                </span>
              ))}
            </div>
          </Field>
        )}

        {subtaskTotal > 0 && (
          <Field label={`Subtarefas · ${subtaskDone}/${subtaskTotal}`}>
            <div className="space-y-1.5 mt-1">
              {task.subtasks!.map(sub => {
                const caixa = (
                  <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    sub.done
                      ? 'bg-indigo-500 border-indigo-500 text-white'
                      : `border-zinc-600${onToggleSubtask ? ' group-hover/sub:border-indigo-400' : ''}`
                  }`}>
                    {sub.done && <Check size={10} strokeWidth={4} />}
                  </span>
                );
                const texto = (
                  <span className={`text-sm text-left break-words ${sub.done ? 'line-through text-zinc-500' : 'text-white'}`}>{sub.title}</span>
                );
                // Sem handler (ex.: detalhe só de leitura) segue como estava.
                if (!onToggleSubtask) {
                  return <div key={sub.id} className="flex items-center gap-2">{caixa}{texto}</div>;
                }
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => onToggleSubtask(task, sub.id)}
                    aria-pressed={sub.done}
                    className="group/sub w-full flex items-center gap-2 text-left rounded-md -mx-1 px-1 py-0.5 hover:bg-white/5 transition-colors"
                  >
                    {caixa}{texto}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {task.attachments && task.attachments.length > 0 && (
          <Field label={`Anexos · ${task.attachments.length}`}>
            <div className="mt-1">
              <AttachmentsView attachments={task.attachments} />
            </div>
          </Field>
        )}

        {/* Tempo gasto: mesmo esquema do comentário — abre ao finalizar. */}
        {(onAddTime || entries.length > 0) && (
          <Field label={task.spentMinutes ? `Tempo gasto · ${formatDuracao(task.spentMinutes)}` : 'Tempo gasto'}>
            <div className="space-y-2 mt-1">
              {entries.map(e => (
                <div key={e.id} className="group/t flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                  <Timer size={13} className={`shrink-0 ${e.source === 'pomodoro' ? 'text-indigo-400' : 'text-zinc-500'}`} />
                  <span className="text-sm text-zinc-200">{formatDuracao(e.minutes)}</span>
                  <span className="text-[10px] text-zinc-500">
                    {e.source === 'pomodoro' ? 'Pomodoro' : 'Lançado à mão'} · {format(parseISO(e.startedAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </span>
                  {onDeleteTime && (
                    <button
                      onClick={() => onDeleteTime(task, e.id)}
                      title="Apagar lançamento"
                      className="ml-auto shrink-0 p-1 rounded-md text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-0 group-hover/t:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}

              {podeLancarTempo ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={horas}
                    onChange={(e) => setHoras(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lancarTempo(); } }}
                    placeholder="0"
                    className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-sm text-white text-center placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors [color-scheme:dark]"
                  />
                  <span className="text-xs text-zinc-500">h</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={minutos}
                    onChange={(e) => setMinutos(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lancarTempo(); } }}
                    placeholder="30"
                    className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-sm text-white text-center placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors [color-scheme:dark]"
                  />
                  <span className="text-xs text-zinc-500">min</span>
                  <button
                    onClick={lancarTempo}
                    disabled={!horas && !minutos}
                    className="ml-auto shrink-0 flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                  >
                    <Timer size={13} /> Lançar
                  </button>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <Lock size={12} /> O lançamento de tempo abre quando a tarefa for finalizada.
                </p>
              )}

              {task.estimateMinutes ? (
                <p className={`text-[11px] ${estouro ? 'text-rose-400' : 'text-zinc-500'}`}>
                  Estimativa: {formatDuracao(task.estimateMinutes)}
                  {estouro && ` · passou ${formatDuracao((task.spentMinutes ?? 0) - task.estimateMinutes)}`}
                </p>
              ) : null}
            </div>
          </Field>
        )}

        {/* Comentários: liberados só depois que a tarefa é finalizada. */}
        {(onAddComment || comments.length > 0) && (
          <Field label={comments.length > 0 ? `Comentários · ${comments.length}` : 'Comentários'}>
            <div className="space-y-2 mt-1">
              {comments.map(c => (
                <div key={c.id} className="group/c flex items-start gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                  <MessageSquare size={13} className="text-zinc-500 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-200 whitespace-pre-wrap break-words">{c.text}</p>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      {format(parseISO(c.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  {onDeleteComment && (
                    <button
                      onClick={() => onDeleteComment(task, c.id)}
                      title="Apagar comentário"
                      className="shrink-0 p-1 rounded-md text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-0 group-hover/c:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}

              {podeComentar ? (
                <div className="flex items-end gap-2">
                  <textarea
                    ref={commentRef}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); enviarComentario(); }
                    }}
                    placeholder="Como foi a entrega? O que ficou pendente?"
                    className="flex-1 h-16 resize-none bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button
                    onClick={enviarComentario}
                    disabled={!comment.trim()}
                    title="Comentar (Ctrl+Enter)"
                    className="shrink-0 flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                  >
                    <Send size={13} /> Comentar
                  </button>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <Lock size={12} /> Os comentários abrem quando a tarefa for finalizada.
                </p>
              )}
            </div>
          </Field>
        )}
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
        >
          Fechar
        </button>
        <button
          onClick={() => onEdit(task)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-all shadow-lg shadow-indigo-600/20"
        >
          <Pencil size={14} /> Editar
        </button>
      </div>
    </Modal>
  );
}
