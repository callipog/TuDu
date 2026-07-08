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
    await db.tasks.bulkPut(data.tasks as Task[]);
    if (Array.isArray(data.tags)) {
      tagService.saveTags(data.tags as Tag[]);
    }
    return { tasks: data.tasks.length, tags: Array.isArray(data.tags) ? data.tags.length : 0 };
  }
};
