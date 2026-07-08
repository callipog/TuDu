import React from 'react';
import { Modal } from './Modal';
import { Task } from '../types';
import { tagService } from '../services/tags';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pencil, Bell, BellOff, Repeat, Check, CalendarClock } from 'lucide-react';

interface TaskDetailModalProps {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void;
  onEdit: (task: Task) => void;
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

const recurrenceLabels: Record<string, string> = {
  none: 'Não repete',
  daily: 'Diariamente',
  weekly: 'Semanalmente',
  monthly: 'Mensalmente',
};

function reminderLabel(min?: number): string {
  if (min == null) return '—';
  if (min < 60) return `${min} min antes`;
  if (min < 1440) return `${min / 60} h antes`;
  return `${min / 1440} dia(s) antes`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">{label}</p>
      <div className="text-sm text-white">{children}</div>
    </div>
  );
}

export function TaskDetailModal({ isOpen, task, onClose, onEdit }: TaskDetailModalProps) {
  if (!task) return null;

  const urgency = urgencyLabels[task.urgency];
  const status = statusLabels[task.status || (task.completed ? 'done' : 'todo')];
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
          <Field label="Data de entrega">
            {task.dueDate
              ? <span className="flex items-center gap-1.5"><CalendarClock size={14} className="text-zinc-500" />{format(parseISO(task.dueDate), "dd 'de' MMM yyyy · HH:mm", { locale: ptBR })}</span>
              : <span className="text-zinc-500">Sem prazo</span>}
          </Field>
          <Field label="Repetição">
            <span className="flex items-center gap-1.5">
              {task.recurrence && task.recurrence !== 'none' && <Repeat size={13} className="text-zinc-500" />}
              {recurrenceLabels[task.recurrence || 'none']}
            </span>
          </Field>
          <Field label="Notificações">
            {task.notificationsEnabled
              ? <span className="flex items-center gap-1.5 text-indigo-400"><Bell size={14} /> Ativas · {reminderLabel(task.reminderMinutes)}</span>
              : <span className="flex items-center gap-1.5 text-zinc-500"><BellOff size={14} /> Desativadas</span>}
          </Field>
          <Field label="Criada em">
            {task.createdAt ? format(parseISO(task.createdAt), "dd/MM/yyyy", { locale: ptBR }) : '—'}
          </Field>
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
              {task.subtasks!.map(sub => (
                <div key={sub.id} className="flex items-center gap-2">
                  <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${sub.done ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-zinc-600'}`}>
                    {sub.done && <Check size={10} strokeWidth={4} />}
                  </span>
                  <span className={`text-sm ${sub.done ? 'line-through text-zinc-500' : 'text-white'}`}>{sub.title}</span>
                </div>
              ))}
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
