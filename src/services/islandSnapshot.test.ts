// Roda com `node --test` (o Node 24 entende TypeScript sem compilar).
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Task } from '../types';
import { buildIslandSnapshot, stillPending, type PendingReminder, type FocusInput } from './islandSnapshot.ts';

const at = (d: number, h: number, m: number) => new Date(2026, 10, d, h, m).getTime();
const NOW = at(9, 14, 28);
const iso = (ms: number) => new Date(ms).toISOString();

function task(id: string, extra: Partial<Task> = {}): Task {
  return { id, title: 'Tarefa ' + id, urgency: 'medium', tags: [], completed: false, ...extra } as unknown as Task;
}

const idle: FocusInput = { running: false, active: false, kind: 'pomodoro', mode: 'work', leftSeconds: 1500, focusId: '', cycles: 0 };

function pending(t: Task, firedAt = NOW): PendingReminder {
  return { id: `${t.id}:due:${t.dueDate}`, taskId: t.id, title: t.title, urgency: t.urgency, firedAt };
}

test('o lembrete pendente só vale enquanto a tarefa ainda está de pé', () => {
  const t = task('a', { dueDate: iso(NOW) });
  const p = pending(t);
  assert.equal(stillPending(p, t), true);
  assert.equal(stillPending(p, { ...t, completed: true }), false);
  assert.equal(stillPending(p, { ...t, archived: true } as Task), false);
  assert.equal(stillPending(p, { ...t, dueDate: iso(NOW + 3600_000) }), false); // prazo mudou
  assert.equal(stillPending(p, undefined), false); // tarefa apagada
});

test('lembretes saem com título e urgência atuais da tarefa', () => {
  const t = task('a', { dueDate: iso(NOW), title: 'Nome antigo', urgency: 'low' });
  const p = pending(t, NOW - 60_000);
  const renomeada = { ...t, title: 'Nome novo', urgency: 'critical' as const };
  const s = buildIslandSnapshot({ tasks: [renomeada], pending: [p], focus: idle, now: NOW });
  assert.equal(s.reminders.length, 1);
  assert.equal(s.reminders[0].title, 'Nome novo');
  assert.equal(s.reminders[0].urgency, 'critical');
  assert.equal(s.reminders[0].firedAt, NOW - 60_000);
});

test('concluir a tarefa tira o lembrete da ilha', () => {
  const t = task('a', { dueDate: iso(NOW) });
  const s = buildIslandSnapshot({ tasks: [{ ...t, completed: true }], pending: [pending(t)], focus: idle, now: NOW });
  assert.deepEqual(s.reminders, []);
});

test('próxima é a tarefa com prazo mais perto que ainda não venceu nem foi feita', () => {
  const tasks = [
    task('passou', { dueDate: iso(NOW - 60_000) }),
    task('longe', { dueDate: iso(NOW + 90 * 60_000) }),
    task('perto', { dueDate: iso(NOW + 20 * 60_000) }),
    task('feita', { dueDate: iso(NOW + 5 * 60_000), completed: true }),
    task('sem-prazo'),
  ];
  const s = buildIslandSnapshot({ tasks, pending: [], focus: idle, now: NOW });
  assert.equal(s.next?.id, 'perto');
  assert.equal(s.next?.dueAt, NOW + 20 * 60_000);
});

test('o progresso do dia conta só o que vence hoje', () => {
  const tasks = [
    task('a', { dueDate: iso(at(9, 9, 0)), completed: true }),
    task('b', { dueDate: iso(at(9, 18, 0)) }),
    task('c', { dueDate: iso(at(9, 23, 0)), completed: true }),
    task('amanha', { dueDate: iso(at(10, 9, 0)) }),
    task('arquivada', { dueDate: iso(at(9, 10, 0)), archived: true } as Partial<Task>),
  ];
  const s = buildIslandSnapshot({ tasks, pending: [], focus: idle, now: NOW });
  assert.deepEqual(s.day, { done: 2, total: 3 });
});

test('foco: vai o instante do fim do bloco e o título da tarefa em foco', () => {
  const tasks = [task('w', { title: 'Wordmark em TuDu' })];
  const focus: FocusInput = { running: true, active: true, kind: 'pomodoro', mode: 'work', leftSeconds: 1062, focusId: 'w', cycles: 1 };
  const s = buildIslandSnapshot({ tasks, pending: [], focus, now: NOW });
  assert.equal(s.focus?.running, true);
  assert.equal(s.focus?.endsAt, NOW + 1062_000);
  assert.equal(s.focus?.taskTitle, 'Wordmark em TuDu');
});

test('foco parado e sem sessão não vai; cronômetro não tem fim de bloco', () => {
  assert.equal(buildIslandSnapshot({ tasks: [], pending: [], focus: idle, now: NOW }).focus, null);
  const crono: FocusInput = { ...idle, running: true, active: true, kind: 'stopwatch' };
  assert.equal(buildIslandSnapshot({ tasks: [], pending: [], focus: crono, now: NOW }).focus?.endsAt, null);
});
