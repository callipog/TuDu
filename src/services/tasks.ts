import { supabase } from '../lib/supabase';
import { Task, Urgency } from '../types';

// Local storage fallback for when Supabase is not configured
const LOCAL_STORAGE_KEY = 'focus_desk_tasks';

function getLocalTasks(): Task[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [
      {
        id: '1',
        title: 'Configure o Supabase',
        description: 'Adicione suas variáveis de ambiente no menu Settings para ativar o banco de dados.',
        urgency: 'critical',
        tags: ['Setup'],
        completed: false,
        createdAt: new Date().toISOString()
      }
    ];
  } catch {
    return [];
  }
}

function saveLocalTasks(tasks: Task[]) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
}

export const taskService = {
  async getTasks(): Promise<Task[]> {
    if (!supabase) {
      console.warn('Supabase is not configured. Using local storage fallback.');
      return getLocalTasks();
    }

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching from Supabase, using local fallback:', error.message);
        return getLocalTasks();
      }

      return data.map(mapTaskFromDb);
    } catch (err: any) {
      console.warn('Error fetching from Supabase, using local fallback:', err.message);
      return getLocalTasks();
    }
  },

  async createTask(task: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
    if (!supabase) {
      const tasks = getLocalTasks();
      const newTask: Task = {
        ...task,
        id: Math.random().toString(36).substring(7),
        createdAt: new Date().toISOString()
      };
      saveLocalTasks([newTask, ...tasks]);
      return newTask;
    }

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([mapTaskToDb(task)])
        .select()
        .single();

      if (error) {
        console.warn('Error creating task in Supabase, using local fallback:', error.message);
        throw error;
      }

      return mapTaskFromDb(data);
    } catch (err: any) {
      console.warn('Falling back to local storage for createTask due to error:', err.message);
      const tasks = getLocalTasks();
      const newTask: Task = {
        ...task,
        id: Math.random().toString(36).substring(7),
        createdAt: new Date().toISOString()
      };
      saveLocalTasks([newTask, ...tasks]);
      return newTask;
    }
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    if (!supabase) {
      const tasks = getLocalTasks();
      const taskIndex = tasks.findIndex(t => t.id === id);
      if (taskIndex === -1) throw new Error('Task not found');
      
      const updatedTask = { ...tasks[taskIndex], ...updates };
      tasks[taskIndex] = updatedTask;
      saveLocalTasks(tasks);
      return updatedTask;
    }

    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.urgency !== undefined) dbUpdates.urgency = updates.urgency;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
    if (updates.completed !== undefined) dbUpdates.completed = updates.completed;

    try {
      const { data, error } = await supabase
        .from('tasks')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.warn('Error updating task in Supabase, using local fallback:', error.message);
        throw error;
      }

      return mapTaskFromDb(data);
    } catch (err: any) {
      console.warn('Falling back to local storage for updateTask due to error:', err.message);
      const tasks = getLocalTasks();
      const taskIndex = tasks.findIndex(t => t.id === id);
      if (taskIndex === -1) throw new Error('Task not found in local storage fallback');
      
      const updatedTask = { ...tasks[taskIndex], ...updates };
      tasks[taskIndex] = updatedTask;
      saveLocalTasks(tasks);
      return updatedTask;
    }
  },

  async deleteTask(id: string): Promise<void> {
    if (!supabase) {
      const tasks = getLocalTasks();
      saveLocalTasks(tasks.filter(t => t.id !== id));
      return;
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);

      if (error) {
        console.warn('Error deleting task in Supabase, using local fallback:', error.message);
        throw error;
      }
    } catch (err: any) {
      console.warn('Falling back to local storage for deleteTask due to error:', err.message);
      const tasks = getLocalTasks();
      saveLocalTasks(tasks.filter(t => t.id !== id));
    }
  }
};

// Helper functions to map between DB schema (snake_case) and Frontend schema (camelCase)
function mapTaskFromDb(dbTask: any): Task {
  return {
    id: dbTask.id,
    title: dbTask.title,
    description: dbTask.description,
    urgency: dbTask.urgency as Urgency,
    tags: dbTask.tags || [],
    dueDate: dbTask.due_date,
    completed: dbTask.completed,
    createdAt: dbTask.created_at,
  };
}

function mapTaskToDb(task: Partial<Task>): any {
  return {
    title: task.title,
    description: task.description,
    urgency: task.urgency,
    tags: task.tags,
    due_date: task.dueDate,
    completed: task.completed || false,
  };
}
