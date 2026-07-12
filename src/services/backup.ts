import { db } from '../db';
import { tagService } from './tags';
import { Task, Tag } from '../types';
import { format } from 'date-fns';

interface BackupPayload {
  app: string;
  schema: number;
  exportedAt: string;
  tasks: Task[];
  tags: Tag[];
}

export const backupService = {
  /** Exporta todas as tarefas (incl. arquivadas) e tags para um arquivo JSON. */
  async exportData(): Promise<void> {
    const tasks = await db.tasks.toArray();
    const tags = tagService.getTags();
    const payload: BackupPayload = {
      app: 'TuDu',
      schema: 1,
      exportedAt: new Date().toISOString(),
      tasks,
      tags
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tudu-backup-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Importa um backup. As tarefas são mescladas por id (bulkPut: adiciona ou
   * sobrescreve as existentes). Retorna a contagem importada.
   */
  async importData(file: File): Promise<{ tasks: number; tags: number }> {
    const text = await file.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Arquivo inválido (não é um JSON válido).');
    }
    if (!data || !Array.isArray(data.tasks)) {
      throw new Error('Arquivo de backup inválido: nenhuma tarefa encontrada.');
    }

    // Valida a forma dos registros antes de gravar (protege o banco de
    // arquivos corrompidos ou maliciosos).
    const validTasks = (data.tasks as any[]).filter(t =>
      t && typeof t === 'object' &&
      typeof t.id === 'string' && t.id.length > 0 && t.id.length <= 64 &&
      typeof t.title === 'string' &&
      ['low', 'medium', 'high', 'critical'].includes(t.urgency) &&
      Array.isArray(t.tags) && t.tags.every((tag: unknown) => typeof tag === 'string')
    ) as Task[];
    if (validTasks.length === 0) {
      throw new Error('Arquivo de backup inválido: nenhuma tarefa com formato válido.');
    }

    const validTags = Array.isArray(data.tags)
      ? (data.tags as any[]).filter(t =>
          t && typeof t === 'object' &&
          typeof t.id === 'string' && typeof t.name === 'string' && typeof t.color === 'string'
        ) as Tag[]
      : [];

    await db.tasks.bulkPut(validTasks);
    if (validTags.length > 0) {
      tagService.saveTags(validTags);
    }
    return { tasks: validTasks.length, tags: validTags.length };
  }
};
