import Dexie, { type EntityTable } from 'dexie';
import { Task, Tag, Project, Epic, Persona } from './types';

// Create the database
const db = new Dexie('FocusDeskDatabase') as Dexie & {
  tasks: EntityTable<Task, 'id'>;
  tags: EntityTable<Tag, 'id'>;
  projects: EntityTable<Project, 'id'>;
  epics: EntityTable<Epic, 'id'>;
  personas: EntityTable<Persona, 'id'>;
};

// Schema declaration
db.version(1).stores({
  tasks: 'id, title, urgency, completed, createdAt, status', // indexed props
  tags: 'id, name' // indexed props
});

// v2: adiciona índice `archived` e garante defaults nos campos novos
// (notificações e arquivamento) para as tarefas já existentes.
db.version(2).stores({
  tasks: 'id, title, urgency, completed, createdAt, status, archived',
  tags: 'id, name'
}).upgrade(async (tx) => {
  await tx.table('tasks').toCollection().modify((task: Task) => {
    if (task.notificationsEnabled === undefined) task.notificationsEnabled = false;
    if (task.archived === undefined) task.archived = false;
  });
});

// v3: lixeira (deleted) e ordenação manual (order).
db.version(3).stores({
  tasks: 'id, title, urgency, completed, createdAt, status, archived, deleted, order',
  tags: 'id, name'
}).upgrade(async (tx) => {
  let i = 0;
  await tx.table('tasks').toCollection().modify((task: Task) => {
    if (task.deleted === undefined) task.deleted = false;
    if (task.order === undefined) task.order = i++;
  });
});

// v4: camada gerencial — projetos, épicos e personas + índices na Task.
db.version(4).stores({
  tasks: 'id, title, urgency, completed, createdAt, status, archived, deleted, order, projectId, epicId, assigneeId',
  tags: 'id, name',
  projects: 'id, name, status, archived, createdAt',
  epics: 'id, projectId, createdAt',
  personas: 'id, name, createdAt'
});

// v5: ordem manual dos épicos dentro do projeto (drag para reordenar).
db.version(5).stores({
  tasks: 'id, title, urgency, completed, createdAt, status, archived, deleted, order, projectId, epicId, assigneeId',
  tags: 'id, name',
  projects: 'id, name, status, archived, createdAt',
  epics: 'id, projectId, order, createdAt',
  personas: 'id, name, createdAt'
}).upgrade(async (tx) => {
  const epics = await tx.table('epics').toArray() as Epic[];
  const byProject = new Map<string, Epic[]>();
  for (const e of epics) {
    const list = byProject.get(e.projectId) ?? [];
    list.push(e);
    byProject.set(e.projectId, list);
  }
  for (const list of byProject.values()) {
    list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    for (let i = 0; i < list.length; i++) {
      await tx.table('epics').update(list[i].id, { order: i });
    }
  }
});

export { db };
