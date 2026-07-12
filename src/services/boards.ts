import { Project } from '../types';

export interface BoardColumn {
  id: string;
  label: string;
}

/** Colunas padrão do Kanban (usadas quando o projeto não define as próprias). */
export const DEFAULT_COLUMNS: BoardColumn[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'A Fazer' },
  { id: 'in_progress', label: 'Em Andamento' },
  { id: 'review', label: 'Revisando/Teste' },
  { id: 'done', label: 'Finalizado' },
];

/** Badge colorido do status do projeto. */
export const PROJECT_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active: { label: 'Ativo', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  paused: { label: 'Pausado', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  done: { label: 'Concluído', cls: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' },
};

/** Colunas efetivas de um projeto (ou o padrão global fora de projetos). */
export function columnsFor(project?: Project | null): BoardColumn[] {
  return project?.columns && project.columns.length > 0 ? project.columns : DEFAULT_COLUMNS;
}

/** A última coluna é considerada "concluído" (marca completed=true). */
export function doneColumnId(columns: BoardColumn[]): string {
  return columns.length > 0 ? columns[columns.length - 1].id : 'done';
}

/** Rótulo legível de um status, resolvendo pelas colunas do projeto. */
export function statusLabel(status: string | undefined, completed: boolean, columns: BoardColumn[]): string {
  const id = status || (completed ? doneColumnId(columns) : columns[0]?.id);
  const inProject = columns.find(c => c.id === id);
  if (inProject) return inProject.label;
  const inDefault = DEFAULT_COLUMNS.find(c => c.id === id);
  return inDefault?.label || id || '—';
}
