export type Urgency = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'weekdays' | 'everyN';
export type RecurrenceEnd = 'never' | 'count' | 'date';

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
  /** Data ISO da última conclusão (para relatórios). */
  completedAt?: string;
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
  /** Intervalo em dias para recorrência "everyN". */
  recurrenceInterval?: number;
  /** Dias da semana (0=Dom..6=Sáb) para recorrência "weekdays". */
  recurrenceWeekdays?: number[];
  /** Como a recorrência termina. */
  recurrenceEndType?: RecurrenceEnd;
  /** Ocorrências restantes (quando termina por contagem). */
  recurrenceCount?: number;
  /** Data ISO limite (quando termina por data). */
  recurrenceEndDate?: string;
  /** Checklist de subtarefas. */
  subtasks?: SubTask[];
  /** Ordem manual dentro da coluna do Kanban. */
  order?: number;
  /** Soft delete: tarefa na lixeira. */
  deleted?: boolean;
  /** Data ISO em que foi enviada para a lixeira. */
  deletedAt?: string;
}
