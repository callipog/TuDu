import { db } from '../db';
import { Project, Epic, ProjectStatus } from '../types';

/** Ordena épicos pela ordem manual (fallback: data de criação). */
export function sortEpics(list: Epic[]): Epic[] {
  return [...list].sort((a, b) =>
    (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
    (a.createdAt || '').localeCompare(b.createdAt || '')
  );
}

export const projectService = {
  async getAll(): Promise<Project[]> {
    return await db.projects.orderBy('createdAt').toArray();
  },

  async create(data: { name: string; color: string; description?: string }): Promise<Project> {
    const project: Project = {
      id: crypto.randomUUID(),
      name: data.name,
      color: data.color,
      description: data.description,
      status: 'active',
      archived: false,
      createdAt: new Date().toISOString(),
    };
    await db.projects.add(project);
    return project;
  },

  async update(id: string, updates: Partial<Project>): Promise<void> {
    await db.projects.update(id, updates);
  },

  async setStatus(id: string, status: ProjectStatus): Promise<void> {
    await db.projects.update(id, { status });
  },

  async setArchived(id: string, archived: boolean): Promise<void> {
    await db.projects.update(id, { archived });
  },

  /** Exclui o projeto, seus épicos e desvincula as tarefas. */
  async remove(id: string): Promise<void> {
    const epics = await db.epics.where('projectId').equals(id).toArray();
    await db.epics.bulkDelete(epics.map(e => e.id));
    await db.tasks.where('projectId').equals(id).modify({ projectId: undefined, epicId: undefined });
    await db.projects.delete(id);
  },

  // ---- Épicos ----
  async getEpics(projectId: string): Promise<Epic[]> {
    return sortEpics(await db.epics.where('projectId').equals(projectId).toArray());
  },

  async createEpic(projectId: string, name: string, color?: string): Promise<Epic> {
    const siblings = await db.epics.where('projectId').equals(projectId).toArray();
    const maxOrder = siblings.reduce((m, e) => Math.max(m, e.order ?? -1), -1);
    const epic: Epic = {
      id: crypto.randomUUID(),
      projectId,
      name,
      color,
      order: maxOrder + 1,
      createdAt: new Date().toISOString(),
    };
    await db.epics.add(epic);
    return epic;
  },

  /** Grava a nova ordem dos épicos (ids na sequência desejada). */
  async reorderEpics(ids: string[]): Promise<void> {
    await db.transaction('rw', db.epics, async () => {
      for (let i = 0; i < ids.length; i++) {
        await db.epics.update(ids[i], { order: i });
      }
    });
  },

  async updateEpic(id: string, updates: Partial<Epic>): Promise<void> {
    await db.epics.update(id, updates);
  },

  async removeEpic(id: string): Promise<void> {
    await db.tasks.where('epicId').equals(id).modify({ epicId: undefined });
    await db.epics.delete(id);
  },
};
