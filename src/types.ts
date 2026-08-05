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

export type AttachmentType = 'link' | 'code' | 'image' | 'file';

export interface Attachment {
  id: string;
  type: AttachmentType;
  title?: string;
  /** URL (link), texto (code) ou dataURL (image/file). */
  content: string;
  /** Linguagem opcional para anexos de código. */
  language?: string;
  /** MIME do arquivo (para type='file'). */
  mime?: string;
}

export type ProjectStatus = 'active' | 'paused' | 'done';

export interface Project {
  id: string;
  name: string;
  color: string;
  description?: string;
  status: ProjectStatus;
  archived?: boolean;
  createdAt: string;
  /** Personas responsáveis pelo projeto. */
  assigneeIds?: string[];
  /** Datas planejadas do projeto (ISO). */
  startDate?: string;
  endDate?: string;
  /** Colunas customizadas do board (id + rótulo). Vazio = usa o padrão. */
  columns?: { id: string; label: string }[];
  /** Documentação do projeto em Markdown (estilo README). */
  readme?: string;
  /** Arquivos anexados ao projeto (pdf, etc.). */
  attachments?: Attachment[];
}

export interface Epic {
  id: string;
  projectId: string;
  name: string;
  color?: string;
  description?: string;
  /** Ordem manual dentro do projeto (arrastar para reordenar). */
  order?: number;
  createdAt: string;
}

/** "Persona" gerencial — não é um usuário logado, é uma etiqueta rica (offline). */
export type PersonaStatus = 'active' | 'inactive';

export interface Persona {
  id: string;
  name: string;
  role?: string;
  color: string;
  notes?: string;
  /** Situação da pessoa na equipe. Ausente = ativo (compatibilidade). */
  status?: PersonaStatus;
  createdAt: string;
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
  /** Data de início planejada (ISO) — usada no Gantt. */
  startDate?: string;
  /** Coluna do board. Ids padrão em TaskStatus, mas pode ser coluna customizada. */
  status?: TaskStatus | string;
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
  /** Projeto ao qual a tarefa pertence (opcional). */
  projectId?: string;
  /** Épico dentro do projeto (opcional). */
  epicId?: string;
  /** Persona responsável (opcional). */
  assigneeId?: string;
  /** Anexos (links, código, imagens). */
  attachments?: Attachment[];
}
