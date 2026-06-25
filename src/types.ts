export type Urgency = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';

export interface Tag {
  id: string;
  name: string;
  color: string;
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
}
