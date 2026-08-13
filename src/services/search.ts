import { Task } from '../types';

/** Nomes que só o App consegue resolver (projeto, épico, responsável). */
export interface SearchContext {
  projectName?: (id?: string) => string | undefined;
  epicName?: (id?: string) => string | undefined;
  assigneeName?: (id?: string) => string | undefined;
}

/**
 * Texto onde a busca procura: tudo que identifica a tarefa, não só o título.
 * Comentários e subtarefas entram porque é comum lembrar da tarefa por uma
 * anotação ("faltou teste de carga") e não pelo nome dela.
 */
function haystack(task: Task, ctx?: SearchContext): string {
  return [
    task.title,
    task.description ?? '',
    task.tags.join(' '),
    (task.subtasks ?? []).map(s => s.title).join(' '),
    (task.comments ?? []).map(c => c.text).join(' '),
    (task.attachments ?? []).map(a => a.title ?? '').join(' '),
    ctx?.projectName?.(task.projectId) ?? '',
    ctx?.epicName?.(task.epicId) ?? '',
    ctx?.assigneeName?.(task.assigneeId) ?? '',
  ].join('  ').toLowerCase();
}

/**
 * Cada palavra digitada precisa aparecer em algum campo — a ordem não importa,
 * então "carga teste" acha o mesmo que "teste carga".
 */
export function taskMatches(task: Task, query: string, ctx?: SearchContext): boolean {
  const termos = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (termos.length === 0) return true;
  const texto = haystack(task, ctx);
  return termos.every(t => texto.includes(t));
}
