import { db } from '../db';
import { Task, SubTask, TaskComment } from '../types';
import { addDays, addWeeks, addMonths, parseISO } from 'date-fns';

/** Calcula a próxima data de entrega conforme a regra de recorrência. */
function computeNextDue(task: Task): string {
  const base = parseISO(task.dueDate!);
  switch (task.recurrence) {
    case 'daily': return addDays(base, 1).toISOString();
    case 'weekly': return addWeeks(base, 1).toISOString();
    case 'monthly': return addMonths(base, 1).toISOString();
    case 'everyN': return addDays(base, Math.max(1, task.recurrenceInterval || 1)).toISOString();
    case 'weekdays': {
      const days = (task.recurrenceWeekdays && task.recurrenceWeekdays.length)
        ? task.recurrenceWeekdays
        : [base.getDay()];
      // Procura o próximo dia da semana marcado (1..7 dias à frente).
      for (let i = 1; i <= 7; i++) {
        const cand = addDays(base, i);
        if (days.includes(cand.getDay())) return cand.toISOString();
      }
      return addDays(base, 7).toISOString();
    }
    default: return task.dueDate!;
  }
}

export const taskService = {
  async getTasks(): Promise<Task[]> {
    return await db.tasks.orderBy('createdAt').reverse().toArray();
  },

  async createTask(task: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
    const newTask: Task = {
      notificationsEnabled: false,
      archived: false,
      deleted: false,
      order: -Date.now(),
      ...task,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    await db.tasks.add(newTask);
    return newTask;
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    await db.tasks.update(id, updates);
    const updated = await db.tasks.get(id);
    if (!updated) throw new Error('Task not found');
    return updated;
  },

  /**
   * Acrescenta uma subtarefa lendo o estado atual do banco. Ler-e-gravar dentro
   * da transação evita que duas adições seguidas (quick add) se atropelem, o
   * que aconteceria ao montar o array a partir de uma cópia já defasada.
   */
  async addSubtask(id: string, title: string): Promise<SubTask[]> {
    return await db.transaction('rw', db.tasks, async () => {
      const task = await db.tasks.get(id);
      if (!task) throw new Error('Task not found');
      const subtasks = [...(task.subtasks ?? []), { id: crypto.randomUUID(), title, done: false }];
      await db.tasks.update(id, { subtasks });
      return subtasks;
    });
  },

  /** Acrescenta um comentário (mesma proteção contra corrida do addSubtask). */
  async addComment(id: string, text: string): Promise<TaskComment[]> {
    return await db.transaction('rw', db.tasks, async () => {
      const task = await db.tasks.get(id);
      if (!task) throw new Error('Task not found');
      const comments = [...(task.comments ?? []), { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() }];
      await db.tasks.update(id, { comments });
      return comments;
    });
  },

  /** Remove um comentário e devolve a lista resultante. */
  async removeComment(id: string, commentId: string): Promise<TaskComment[]> {
    return await db.transaction('rw', db.tasks, async () => {
      const task = await db.tasks.get(id);
      if (!task) throw new Error('Task not found');
      const comments = (task.comments ?? []).filter(c => c.id !== commentId);
      await db.tasks.update(id, { comments });
      return comments;
    });
  },

  /** Envia a tarefa para a lixeira (soft delete). */
  async deleteTask(id: string): Promise<void> {
    await db.tasks.update(id, { deleted: true, deletedAt: new Date().toISOString() });
  },

  /** Restaura uma tarefa da lixeira. */
  async restoreTask(id: string): Promise<void> {
    await db.tasks.update(id, { deleted: false, deletedAt: undefined });
  },

  /** Remove a tarefa em definitivo (não recuperável). */
  async permanentlyDelete(id: string): Promise<void> {
    await db.tasks.delete(id);
  },

  /** Esvazia a lixeira (remove em definitivo todas as tarefas deletadas). */
  async emptyTrash(): Promise<void> {
    await db.tasks.filter(t => t.deleted === true).delete();
  },

  /** Remove em definitivo tarefas na lixeira há mais de `days` dias. Retorna quantas. */
  async purgeExpired(days = 30): Promise<number> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const expired = await db.tasks
      .filter(t => t.deleted === true && !!t.deletedAt && parseISO(t.deletedAt).getTime() < cutoff)
      .toArray();
    await Promise.all(expired.map(t => db.tasks.delete(t.id)));
    return expired.length;
  },

  /** Apaga TODAS as tarefas (reset do banco de tarefas). */
  async clearAllTasks(): Promise<void> {
    await db.tasks.clear();
  },

  /** Persiste a nova ordem de um conjunto de tarefas (reordenação no Kanban). */
  async saveOrder(items: { id: string; order: number }[]): Promise<void> {
    await Promise.all(items.map(i => db.tasks.update(i.id, { order: i.order })));
  },

  /** Arquiva todas as tarefas concluídas (status done / completed) que ainda não estão arquivadas. */
  async archiveCompleted(): Promise<string[]> {
    const now = new Date().toISOString();
    const completed = await db.tasks
      .filter(t => t.completed === true && t.archived !== true && t.deleted !== true)
      .toArray();
    const ids = completed.map(t => t.id);
    await Promise.all(
      ids.map(id => db.tasks.update(id, { archived: true, archivedAt: now }))
    );
    return ids;
  },

  /** Desarquiva uma tarefa, trazendo-a de volta para as views normais. */
  async unarchiveTask(id: string): Promise<void> {
    await db.tasks.update(id, { archived: false, archivedAt: undefined });
  },

  /**
   * Cria a próxima ocorrência de uma tarefa recorrente (chamada ao concluir).
   * Respeita o término (nunca / após N ocorrências / até uma data).
   * Retorna a nova tarefa criada, ou null se não houver próxima ocorrência.
   */
  async createRecurringNext(task: Task): Promise<Task | null> {
    if (!task.recurrence || task.recurrence === 'none' || !task.dueDate) return null;

    // Término por contagem: esta conclusão consome uma ocorrência.
    let nextCount: number | undefined = undefined;
    if (task.recurrenceEndType === 'count') {
      const remaining = (task.recurrenceCount ?? 1) - 1;
      if (remaining <= 0) return null;
      nextCount = remaining;
    }

    const nextDue = computeNextDue(task);

    // Término por data.
    if (task.recurrenceEndType === 'date' && task.recurrenceEndDate) {
      if (parseISO(nextDue).getTime() > parseISO(task.recurrenceEndDate).getTime()) return null;
    }

    const next: Task = {
      ...task,
      id: crypto.randomUUID(),
      dueDate: nextDue,
      completed: false,
      // A ocorrência nova nasce em aberto: herdar o completedAt da anterior
      // faria ela aparecer como "finalizada em ..." sem nunca ter sido.
      completedAt: undefined,
      status: 'todo',
      createdAt: new Date().toISOString(),
      order: -Date.now(),
      archived: false,
      archivedAt: undefined,
      deleted: false,
      deletedAt: undefined,
      recurrenceCount: nextCount,
      // Reinicia o checklist da próxima ocorrência.
      subtasks: task.subtasks?.map(s => ({ ...s, done: false }))
    };
    await db.tasks.add(next);
    return next;
  }
};
