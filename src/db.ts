import Dexie, { type EntityTable } from 'dexie';
import { Task, Tag } from './types';

// Create the database
const db = new Dexie('FocusDeskDatabase') as Dexie & {
  tasks: EntityTable<
    Task,
    'id' // primary key "id" (for the typings only)
  >;
  tags: EntityTable<
    Tag,
    'id' // primary key "id"
  >;
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

export { db };
