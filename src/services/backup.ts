import { db } from '../db';
import { tagService } from './tags';
import { Task, Tag, Project, Epic, Persona, Template } from '../types';
import { format } from 'date-fns';

interface BackupPayload {
  app: string;
  schema: number;
  exportedAt: string;
  tasks: Task[];
  tags: Tag[];
  /** A partir do schema 2 o backup também leva a camada gerencial. */
  projects?: Project[];
  epics?: Epic[];
  personas?: Persona[];
  templates?: Template[];
}

const LAST_RUN_KEY = 'tudu_last_auto_backup';
const DIA_MS = 24 * 60 * 60 * 1000;

/** Monta o JSON completo do backup (usado no export manual e no automático). */
async function buildPayload(): Promise<string> {
  const [tasks, projects, epics, personas, templates] = await Promise.all([
    db.tasks.toArray(),
    db.projects.toArray(),
    db.epics.toArray(),
    db.personas.toArray(),
    db.templates.toArray(),
  ]);
  const payload: BackupPayload = {
    app: 'TuDu',
    schema: 2,
    exportedAt: new Date().toISOString(),
    tasks,
    tags: tagService.getTags(),
    projects,
    epics,
    personas,
    templates,
  };
  return JSON.stringify(payload, null, 2);
}

export const backupService = {
  buildPayload,
  /** Exporta tudo (tarefas, tags, projetos, épicos, personas e modelos). */
  async exportData(): Promise<void> {
    const blob = new Blob([await buildPayload()], { type: 'application/json' });
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
    return await this.importJson(await file.text());
  },

  /** Mesma importação, a partir do texto (usado ao restaurar da pasta de backup). */
  async importJson(text: string): Promise<{ tasks: number; tags: number }> {
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

    // Camada gerencial (schema 2+). Cada tabela é opcional: backup antigo
    // simplesmente não tem esses campos.
    const comId = (v: any) => v && typeof v === 'object' && typeof v.id === 'string';
    if (Array.isArray(data.projects)) await db.projects.bulkPut(data.projects.filter(comId));
    if (Array.isArray(data.epics)) await db.epics.bulkPut(data.epics.filter(comId));
    if (Array.isArray(data.personas)) await db.personas.bulkPut(data.personas.filter(comId));
    if (Array.isArray(data.templates)) await db.templates.bulkPut(data.templates.filter(comId));

    return { tasks: validTasks.length, tags: validTags.length };
  },

  /**
   * Backup automático: grava no máximo uma vez por dia, na pasta configurada.
   * Chamado na abertura do app — quem fica com o TuDu aberto por semanas ganha
   * a checagem a cada 6 horas, feita pelo agendador em `startAutoBackup`.
   */
  async runAutoBackupIfDue(force = false): Promise<boolean> {
    const b = typeof window !== 'undefined' ? window.tudu : null;
    if (!b?.backup) return false;

    const state = await b.backup.state();
    if (!state.enabled && !force) return false;

    if (!force) {
      const last = Number(localStorage.getItem(LAST_RUN_KEY) || 0);
      const ultimoDoDisco = state.lastAt ? new Date(state.lastAt).getTime() : 0;
      const referencia = Math.max(last, ultimoDoDisco);
      if (referencia && Date.now() - referencia < DIA_MS) return false;
    }

    const result = await b.backup.write(await buildPayload());
    if (result.ok) {
      localStorage.setItem(LAST_RUN_KEY, String(Date.now()));
      return true;
    }
    console.error('Backup automático falhou', result.error);
    return false;
  },

  /** Liga a checagem periódica. Devolve a função para desligar. */
  startAutoBackup(): () => void {
    this.runAutoBackupIfDue().catch(() => {});
    const id = setInterval(() => { this.runAutoBackupIfDue().catch(() => {}); }, 6 * 60 * 60 * 1000);
    return () => clearInterval(id);
  }
};
