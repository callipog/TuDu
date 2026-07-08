export type Urgency = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface SubTask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  urgency: Urgency;
  tags: string[];
  dueDate?: string;
  completed: boolean;
  createdAt: string;
  status?: TaskStatus;
  /** Se as notificações (popup do Windows) estão ativas para esta tarefa. */
  notificationsEnabled?: boolean;
  /** Antecedência, em minutos, do lembrete antecipado antes do deadline. */
  reminderMinutes?: number;
  /** Se a tarefa foi arquivada (some das views normais). */
  archived?: boolean;
  /** Data ISO em que a tarefa foi arquivada. */
  archivedAt?: string;
  /** Recorrência: ao concluir, gera a próxima ocorrência. */
  recurrence?: Recurrence;
  /** Checklist de subtarefas. */
  subtasks?: SubTask[];
}
