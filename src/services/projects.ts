import { db } from '../db';
import { Project, Epic, ProjectStatus } from '../types';

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
    return await db.epics.where('projectId').equals(projectId).sortBy('createdAt');
  },

  async createEpic(projectId: string, name: string, color?: string): Promise<Epic> {
    const epic: Epic = {
      id: crypto.randomUUID(),
      projectId,
      name,
      color,
      createdAt: new Date().toISOString(),
    };
    await db.epics.add(epic);
    return epic;
  },

  async updateEpic(id: string, updates: Partial<Epic>): Promise<void> {
    await db.epics.update(id, updates);
  },

  async removeEpic(id: string): Promise<void> {
    await db.tasks.where('epicId').equals(id).modify({ epicId: undefined });
    await db.epics.delete(id);
  },
};
