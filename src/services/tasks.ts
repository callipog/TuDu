import { db } from '../db';
import { Task, Recurrence } from '../types';
import { addDays, addWeeks, addMonths, parseISO } from 'date-fns';

function computeNextDue(dueDate: string, recurrence: Recurrence): string {
  const base = parseISO(dueDate);
  switch (recurrence) {
    case 'daily': return addDays(base, 1).toISOString();
    case 'weekly': return addWeeks(base, 1).toISOString();
    case 'monthly': return addMonths(base, 1).toISOString();
    default: return dueDate;
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

  async deleteTask(id: string): Promise<void> {
    await db.tasks.delete(id);
  },

  /** Arquiva todas as tarefas concluídas (status done / completed) que ainda não estão arquivadas. */
  async archiveCompleted(): Promise<string[]> {
    const now = new Date().toISOString();
    const completed = await db.tasks
      .filter(t => t.completed === true && t.archived !== true)
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
   * Retorna a nova tarefa criada, ou null se a tarefa não for recorrente / sem prazo.
   */
  async createRecurringNext(task: Task): Promise<Task | null> {
    if (!task.recurrence || task.recurrence === 'none' || !task.dueDate) return null;
    const nextDue = computeNextDue(task.dueDate, task.recurrence);
    const next: Task = {
      ...task,
      id: crypto.randomUUID(),
      dueDate: nextDue,
      completed: false,
      status: 'todo',
      createdAt: new Date().toISOString(),
      archived: false,
      archivedAt: undefined,
      // Reinicia o checklist da próxima ocorrência.
      subtasks: task.subtasks?.map(s => ({ ...s, done: false }))
    };
    await db.tasks.add(next);
    return next;
  }
};

