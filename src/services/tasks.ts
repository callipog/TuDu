import { db } from '../db';
import { Task, Urgency } from '../types';

export const taskService = {
  async getTasks(): Promise<Task[]> {
    return await db.tasks.orderBy('createdAt').reverse().toArray();
  },

  async createTask(task: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
    const newTask: Task = {
      ...task,
      id: Math.random().toString(36).substring(7),
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
  }
};

