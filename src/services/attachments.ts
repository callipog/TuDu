import { db } from '../db';
import { Attachment, Task } from '../types';

const MIGRATED_KEY = 'tudu_attachments_migrated';

function bridge() {
  return typeof window !== 'undefined' ? window.tudu ?? null : null;
}

/** Extensão a partir do MIME ou do nome original. */
function guessExt(mime?: string, title?: string): string {
  const doNome = title && title.includes('.') ? title.split('.').pop() ?? '' : '';
  if (doNome && /^[A-Za-z0-9]{1,8}$/.test(doNome)) return doNome.toLowerCase();
  const m = (mime || '').split('/')[1] || '';
  return m.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase();
}

function splitDataUrl(dataUrl: string): { base64: string; mime: string } | null {
  const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  const [, mime, isB64, data] = match;
  return { mime, base64: isB64 ? data : btoa(unescape(encodeURIComponent(decodeURIComponent(data)))) };
}

export const attachmentService = {
  /** Endereço para exibir o anexo: arquivo em disco ou o dataURL antigo. */
  src(a: Attachment): string {
    return a.file ? `tudu-file://attachments/${encodeURIComponent(a.file)}` : a.content;
  },

  /** Fora do Electron (dev no navegador) não há disco: continua em dataURL. */
  canUseDisk(): boolean {
    return !!bridge()?.files;
  },

  /** Grava o arquivo escolhido em disco e devolve o anexo já apontando para ele. */
  async fromFile(file: File, type: 'image' | 'file'): Promise<Attachment> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
      r.readAsDataURL(file);
    });

    const base = {
      id: crypto.randomUUID(),
      type,
      title: file.name,
      mime: file.type || undefined,
    };

    const b = bridge();
    const parts = splitDataUrl(dataUrl);
    if (b?.files && parts) {
      const saved = await b.files.save({ base64: parts.base64, ext: guessExt(file.type, file.name) });
      if (saved.ok && saved.file) {
        return { ...base, content: '', file: saved.file, size: saved.size };
      }
    }
    // Sem ponte (ou falha ao gravar): mantém o comportamento antigo.
    return { ...base, content: dataUrl, size: file.size };
  },

  /** Apaga o arquivo de um anexo removido (no-op para link/código). */
  async discard(a: Attachment): Promise<void> {
    if (a.file) await bridge()?.files.remove(a.file);
  },

  /**
   * Move para disco os anexos que ainda estão como dataURL dentro do banco.
   * Roda uma vez por instalação; tarefas na lixeira também entram, para o
   * banco não continuar carregando o peso delas.
   */
  async migrateLegacy(): Promise<number> {
    const b = bridge();
    if (!b?.files) return 0;
    if (localStorage.getItem(MIGRATED_KEY) === '1') return 0;

    const [tasks, projetos] = await Promise.all([db.tasks.toArray(), db.projects.toArray()]);
    let movidos = 0;

    // Projetos também guardam anexos (PDFs de escopo, por exemplo).
    for (const projeto of projetos) {
      const anexos = projeto.attachments ?? [];
      if (anexos.length === 0) continue;
      const { novos, mudou, movidos: n } = await this.migrateList(anexos);
      if (mudou) await db.projects.update(projeto.id, { attachments: novos });
      movidos += n;
    }

    for (const task of tasks) {
      const anexos = task.attachments ?? [];
      if (anexos.length === 0) continue;
      const { novos, mudou, movidos: n } = await this.migrateList(anexos);
      if (mudou) await db.tasks.update(task.id, { attachments: novos });
      movidos += n;
    }

    localStorage.setItem(MIGRATED_KEY, '1');
    return movidos;
  },

  /** Move para disco os dataURLs de uma lista de anexos. */
  async migrateList(anexos: Attachment[]): Promise<{ novos: Attachment[]; mudou: boolean; movidos: number }> {
    const b = bridge();
    const novos: Attachment[] = [];
    let mudou = false;
    let movidos = 0;

    for (const a of anexos) {
      const ehBinario = (a.type === 'image' || a.type === 'file') && !a.file && a.content.startsWith('data:');
      const parts = ehBinario ? splitDataUrl(a.content) : null;
      if (!parts || !b?.files) { novos.push(a); continue; }

      const saved = await b.files.save({ base64: parts.base64, ext: guessExt(a.mime || parts.mime, a.title) });
      if (saved.ok && saved.file) {
        novos.push({ ...a, content: '', file: saved.file, size: saved.size });
        mudou = true;
        movidos++;
      } else {
        novos.push(a);
      }
    }
    return { novos, mudou, movidos };
  },

  /**
   * Apaga arquivos que ninguém referencia mais. Varre tarefas E projetos —
   * esquecer os projetos apagaria os arquivos anexados a eles.
   */
  async pruneOrphans(tasks?: Task[]): Promise<number> {
    const b = bridge();
    if (!b?.files) return 0;
    const [lista, projetos] = await Promise.all([
      tasks ? Promise.resolve(tasks) : db.tasks.toArray(),
      db.projects.toArray(),
    ]);
    const usados = [
      ...lista.flatMap(t => (t.attachments ?? []).map(a => a.file)),
      ...projetos.flatMap(p => (p.attachments ?? []).map(a => a.file)),
    ].filter(Boolean) as string[];
    return await b.files.prune(usados);
  }
};
