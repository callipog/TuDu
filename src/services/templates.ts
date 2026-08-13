import { db } from '../db';
import { Epic, Project, Task, Template, TemplateTask } from '../types';
import { columnsFor } from './boards';

/** Dias entre a criação da tarefa e o prazo — vira `dueInDays` no modelo. */
function diasAteEntrega(task: Task): number | undefined {
  if (!task.dueDate) return undefined;
  const base = task.startDate ?? task.createdAt;
  const dias = Math.round((new Date(task.dueDate).getTime() - new Date(base).getTime()) / 86400000);
  return dias >= 0 ? dias : undefined;
}

function moldeDaTarefa(task: Task): TemplateTask {
  return {
    title: task.title,
    description: task.description,
    urgency: task.urgency,
    tags: [...task.tags],
    estimateMinutes: task.estimateMinutes,
    subtasks: (task.subtasks ?? []).map(s => ({ title: s.title })),
    dueInDays: diasAteEntrega(task),
  };
}

export const templateService = {
  async list(): Promise<Template[]> {
    return (await db.templates.toArray()).sort((a, b) => a.name.localeCompare(b.name));
  },

  async remove(id: string): Promise<void> {
    await db.templates.delete(id);
  },

  /** Guarda uma tarefa como modelo (sem datas absolutas, sem anexos). */
  async saveTask(name: string, task: Task): Promise<Template> {
    const template: Template = {
      id: crypto.randomUUID(),
      name: name.trim() || task.title,
      kind: 'task',
      createdAt: new Date().toISOString(),
      task: moldeDaTarefa(task),
    };
    await db.templates.add(template);
    return template;
  },

  /** Guarda o projeto inteiro: épicos, colunas do board e as tarefas ativas. */
  async saveProject(name: string, project: Project, epics: Epic[], tasks: Task[]): Promise<Template> {
    const epicosOrdenados = epics.filter(e => e.projectId === project.id);
    const indicePorEpico = new Map(epicosOrdenados.map((e, i) => [e.id, i]));

    const template: Template = {
      id: crypto.randomUUID(),
      name: name.trim() || project.name,
      kind: 'project',
      createdAt: new Date().toISOString(),
      project: {
        name: project.name,
        color: project.color,
        description: project.description,
        columns: project.columns,
        readme: project.readme,
        epics: epicosOrdenados.map(e => ({ name: e.name, color: e.color, description: e.description })),
        tasks: tasks
          .filter(t => t.projectId === project.id && !t.archived && !t.deleted)
          .map(t => ({ ...moldeDaTarefa(t), epicIndex: indicePorEpico.get(t.epicId ?? '') ?? null })),
      },
    };
    await db.templates.add(template);
    return template;
  },

  /** Converte um molde em tarefa nova, resolvendo o prazo relativo. */
  materializeTask(molde: TemplateTask, extras: { projectId?: string; epicId?: string; order?: number }): Task {
    const agora = new Date();
    const due = molde.dueInDays != null ? new Date(agora.getTime() + molde.dueInDays * 86400000) : undefined;
    return {
      id: crypto.randomUUID(),
      title: molde.title,
      description: molde.description,
      urgency: molde.urgency,
      tags: [...molde.tags],
      completed: false,
      createdAt: agora.toISOString(),
      dueDate: due?.toISOString(),
      estimateMinutes: molde.estimateMinutes,
      subtasks: molde.subtasks.map(s => ({ id: crypto.randomUUID(), title: s.title, done: false })),
      notificationsEnabled: false,
      archived: false,
      deleted: false,
      order: -Date.now(),
      ...extras,
    };
  },

  /** Cria a tarefa a partir do modelo. */
  async createTaskFrom(template: Template, opts?: { projectId?: string; epicId?: string }): Promise<Task | null> {
    if (template.kind !== 'task' || !template.task) return null;
    const task = this.materializeTask(template.task, { projectId: opts?.projectId, epicId: opts?.epicId });
    await db.tasks.add(task);
    return task;
  },

  /**
   * Cria projeto, épicos e tarefas a partir do modelo. Devolve o id do projeto
   * novo para a interface já abrir nele.
   */
  async createProjectFrom(template: Template, nome?: string): Promise<string | null> {
    if (template.kind !== 'project' || !template.project) return null;
    const molde = template.project;
    const agora = new Date().toISOString();

    const project: Project = {
      id: crypto.randomUUID(),
      name: (nome ?? '').trim() || molde.name,
      color: molde.color,
      description: molde.description,
      status: 'active',
      archived: false,
      createdAt: agora,
      columns: molde.columns,
      readme: molde.readme,
    };
    await db.projects.add(project);

    const epicIds: string[] = [];
    for (let i = 0; i < molde.epics.length; i++) {
      const e = molde.epics[i];
      const epic: Epic = {
        id: crypto.randomUUID(),
        projectId: project.id,
        name: e.name,
        color: e.color,
        description: e.description,
        order: i,
        createdAt: agora,
      };
      await db.epics.add(epic);
      epicIds.push(epic.id);
    }

    // Tarefas entram na primeira coluna do board do projeto.
    const primeira = columnsFor(project)[0]?.id;
    const tarefas = molde.tasks.map((t, i) => ({
      ...this.materializeTask(t, {
        projectId: project.id,
        epicId: t.epicIndex != null ? epicIds[t.epicIndex] : undefined,
        order: i,
      }),
      status: primeira,
    }));
    if (tarefas.length > 0) await db.tasks.bulkAdd(tarefas);

    return project.id;
  }
};
