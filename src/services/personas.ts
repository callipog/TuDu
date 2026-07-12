import { db } from '../db';
import { Persona } from '../types';

export const personaService = {
  async getAll(): Promise<Persona[]> {
    return await db.personas.orderBy('name').toArray();
  },

  async create(data: { name: string; role?: string; color: string; notes?: string }): Promise<Persona> {
    const persona: Persona = {
      id: crypto.randomUUID(),
      name: data.name,
      role: data.role,
      color: data.color,
      notes: data.notes,
      createdAt: new Date().toISOString(),
    };
    await db.personas.add(persona);
    return persona;
  },

  async update(id: string, updates: Partial<Persona>): Promise<void> {
    await db.personas.update(id, updates);
  },

  /** Exclui a persona e desvincula as tarefas atribuídas a ela. */
  async remove(id: string): Promise<void> {
    await db.tasks.where('assigneeId').equals(id).modify({ assigneeId: undefined });
    await db.personas.delete(id);
  },
};

/** Iniciais para o avatar (até 2 letras). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
