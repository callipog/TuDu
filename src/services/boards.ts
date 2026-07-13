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

/** Cores de um status (ponto/dot, barra do Gantt e texto). */
export interface StatusColor { dot: string; bar: string; text: string; }

/* Classes LITERAIS (o scanner do Tailwind não detecta strings montadas em runtime). */
const STATUS_COLOR: Record<string, StatusColor> = {
  backlog:     { dot: 'bg-zinc-400',    bar: 'bg-zinc-400/80',    text: 'text-zinc-400' },
  todo:        { dot: 'bg-blue-500',    bar: 'bg-blue-500/80',    text: 'text-blue-400' },
  in_progress: { dot: 'bg-amber-500',   bar: 'bg-amber-500/80',   text: 'text-amber-400' },
  review:      { dot: 'bg-purple-500',  bar: 'bg-purple-500/80',  text: 'text-purple-400' },
  done:        { dot: 'bg-emerald-500', bar: 'bg-emerald-500/80', text: 'text-emerald-400' },
};

const DONE_COLOR: StatusColor = { dot: 'bg-emerald-500', bar: 'bg-emerald-500/80', text: 'text-emerald-400' };

/* Paleta para colunas customizadas sem id conhecido (por posição). */
const FALLBACK_COLORS: StatusColor[] = [
  { dot: 'bg-sky-500',    bar: 'bg-sky-500/80',    text: 'text-sky-400' },
  { dot: 'bg-violet-500', bar: 'bg-violet-500/80', text: 'text-violet-400' },
  { dot: 'bg-pink-500',   bar: 'bg-pink-500/80',   text: 'text-pink-400' },
  { dot: 'bg-teal-500',   bar: 'bg-teal-500/80',   text: 'text-teal-400' },
  { dot: 'bg-orange-500', bar: 'bg-orange-500/80', text: 'text-orange-400' },
  { dot: 'bg-cyan-500',   bar: 'bg-cyan-500/80',   text: 'text-cyan-400' },
];

/** Cor de um status, resolvendo pelas colunas do projeto (a última coluna = concluído). */
export function statusColor(status: string | undefined, completed: boolean, columns: BoardColumn[]): StatusColor {
  const id = status || (completed ? doneColumnId(columns) : columns[0]?.id) || 'todo';
  if (STATUS_COLOR[id]) return STATUS_COLOR[id];
  if (id === doneColumnId(columns)) return DONE_COLOR;
  const idx = columns.findIndex(c => c.id === id);
  return FALLBACK_COLORS[(idx >= 0 ? idx : 0) % FALLBACK_COLORS.length];
}

/** Rótulo legível de um status, resolvendo pelas colunas do projeto. */
export function statusLabel(status: string | undefined, completed: boolean, columns: BoardColumn[]): string {
  const id = status || (completed ? doneColumnId(columns) : columns[0]?.id);
  const inProject = columns.find(c => c.id === id);
  if (inProject) return inProject.label;
  const inDefault = DEFAULT_COLUMNS.find(c => c.id === id);
  return inDefault?.label || id || '—';
}
