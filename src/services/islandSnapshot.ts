// Retrato das fontes da ilha, montado no renderer (o único que enxerga o
// banco) e publicado para o processo principal, onde mora a fila de
// prioridade (electron/island-queue.cjs).
//
// Este arquivo é puro — só tipos importados, nenhuma dependência de runtime —
// para os testes rodarem direto no `node --test`.
import type { Task, Urgency } from '../types';

/** Um prazo que venceu com notificação ligada e ainda não foi resolvido. */
export interface PendingReminder {
  /** Mesma chave do disparo (`taskId:due:dueDate`): mudar o prazo cria outro. */
  id: string;
  taskId: string;
  title: string;
  urgency: Urgency;
  firedAt: number;
}

export interface IslandSnapshot {
  reminders: { id: string; taskId: string; title: string; urgency: Urgency; firedAt: number }[];
  /** A tarefa com horário mais perto que ainda não venceu. A fila decide se está perto o bastante. */
  next: { id: string; title: string; dueAt: number; urgency: Urgency } | null;
  focus: {
    running: boolean;
    kind: 'pomodoro' | 'stopwatch';
    mode: 'work' | 'break';
    /** Fim do bloco, para a ilha contar sozinha sem receber um tick por segundo. */
    endsAt: number | null;
    taskTitle: string;
    cycles: number;
  } | null;
  /** Tarefas com prazo hoje: o "3/7" do repouso. */
  day: { done: number; total: number };
}

/** O que a ilha precisa saber do modo foco (um recorte do usePomodoro). */
export interface FocusInput {
  running: boolean;
  active: boolean;
  kind: 'pomodoro' | 'stopwatch';
  mode: 'work' | 'break';
  leftSeconds: number;
  focusId: string;
  cycles: number;
}

/** A tarefa ainda justifica o lembrete? Concluída, arquivada ou com prazo novo, não. */
export function stillPending(p: PendingReminder, task: Task | undefined): boolean {
  if (!task || task.completed || task.archived || task.deletedAt || !task.dueDate) return false;
  return p.id === `${task.id}:due:${task.dueDate}`;
}

function dueAt(task: Task): number | null {
  if (!task.dueDate) return null;
  const ms = Date.parse(task.dueDate);
  return Number.isNaN(ms) ? null : ms;
}

function sameLocalDay(a: number, b: number): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

export function buildIslandSnapshot(input: {
  tasks: Task[];
  pending: PendingReminder[];
  focus: FocusInput | null;
  now: number;
}): IslandSnapshot {
  const { now } = input;
  const live = input.tasks.filter(t => !t.archived && !t.deletedAt);
  const byId = new Map(live.map(t => [t.id, t]));

  // Título e urgência vêm da tarefa, não do momento do disparo: se a pessoa
  // renomeou ou subiu a urgência depois, a ilha mostra o que vale agora.
  const reminders = input.pending
    .filter(p => stillPending(p, byId.get(p.taskId)))
    .map(p => {
      const t = byId.get(p.taskId)!;
      return { id: p.id, taskId: t.id, title: t.title, urgency: t.urgency, firedAt: p.firedAt };
    });

  let next: IslandSnapshot['next'] = null;
  let done = 0;
  let total = 0;
  for (const t of live) {
    const at = dueAt(t);
    if (at === null) continue;
    if (sameLocalDay(at, now)) {
      total++;
      if (t.completed) done++;
    }
    if (!t.completed && at > now && (!next || at < next.dueAt)) {
      next = { id: t.id, title: t.title, dueAt: at, urgency: t.urgency };
    }
  }

  let focus: IslandSnapshot['focus'] = null;
  const f = input.focus;
  if (f && (f.active || f.running)) {
    const task = f.focusId ? byId.get(f.focusId) : undefined;
    focus = {
      running: f.running,
      kind: f.kind,
      mode: f.mode,
      endsAt: f.running && f.kind === 'pomodoro' ? now + Math.max(0, f.leftSeconds) * 1000 : null,
      taskTitle: task ? task.title : '',
      cycles: f.cycles,
    };
  }

  return { reminders, next, focus, day: { done, total } };
}
