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

export { db };
