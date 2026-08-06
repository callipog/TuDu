import { db } from '../db';
import { Project, Epic, Task, SubTask, Urgency, Tag } from '../types';
import { columnsFor } from './boards';
import { sortEpics } from './projects';
import { tagService, PREDEFINED_COLORS } from './tags';

/**
 * Compilador de roadmap: converte o JSON "amigável para IA" em registros
 * válidos do banco.
 *
 * A IA escreve o que sabe fazer bem (conteúdo: fases, tarefas, prazos) e não
 * precisa inventar UUID, `order`, id de coluna nem data ISO. Tudo isso é
 * resolvido aqui, junto com a validação — nenhum payload externo chega ao
 * Dexie sem passar por este arquivo.
 *
 * Compilar NÃO grava nada: produz um plano que a interface mostra para o
 * usuário conferir. Só `applyPlan` escreve.
 */

/* ------------------------------------------------------------------ entrada */

export interface RoadmapInput {
  /** Projeto alvo: `id` mira um existente; `name` reaproveita pelo nome ou cria. */
  project?: {
    id?: string;
    name?: string;
    description?: string;
    color?: string;
    startDate?: string;
    endDate?: string;
  };
  epics?: {
    /** Apelido usado pelas tarefas para referenciar este épico. */
    key?: string;
    name: string;
    description?: string;
    color?: string;
  }[];
  tasks?: {
    title: string;
    description?: string;
    /** `key` ou nome do épico. */
    epic?: string;
    urgency?: string;
    /** Id ou rótulo da coluna. Sem isso, entra na primeira. */
    status?: string;
    startDate?: string;
    dueDate?: string;
    tags?: string[];
    subtasks?: string[];
  }[];
}

/* -------------------------------------------------------------------- plano */

export interface RoadmapPlan {
  project: { record: Project; isNew: boolean };
  epics: { record: Epic; isNew: boolean }[];
  tasks: Task[];
  newTags: Tag[];
  warnings: string[];
  summary: { epicsNovos: number; epicsExistentes: number; tarefas: number; tagsNovas: number };
}

const URGENCIES: Urgency[] = ['low', 'medium', 'high', 'critical'];
const MAX_TASKS = 200;
const MAX_EPICS = 50;

const clamp = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

/** Aceita 'YYYY-MM-DD' ou ISO completo. Devolve ISO, ou undefined se inválida. */
function toIso(value: unknown): string | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T09:00:00`) : new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

/* ---------------------------------------------------------------- compilação */

export async function compileRoadmap(input: RoadmapInput): Promise<RoadmapPlan> {
  const warnings: string[] = [];

  if (!input || typeof input !== 'object') throw new Error('Payload inválido: esperado um objeto.');

  const rawEpics = Array.isArray(input.epics) ? input.epics : [];
  const rawTasks = Array.isArray(input.tasks) ? input.tasks : [];
  if (rawEpics.length === 0 && rawTasks.length === 0) {
    throw new Error('Nada a criar: informe ao menos um épico ou uma tarefa.');
  }
  if (rawEpics.length > MAX_EPICS) throw new Error(`Épicos demais (limite de ${MAX_EPICS}).`);
  if (rawTasks.length > MAX_TASKS) throw new Error(`Tarefas demais (limite de ${MAX_TASKS}).`);

  /* -- projeto: por id, por nome, ou novo -- */
  const projects = await db.projects.toArray();
  const wanted = input.project ?? {};
  let project: Project | undefined;
  let projectIsNew = false;

  if (wanted.id) {
    project = projects.find(p => p.id === wanted.id);
    if (!project) throw new Error(`Projeto ${wanted.id} não encontrado.`);
  } else if (wanted.name) {
    project = projects.find(p => normalize(p.name) === normalize(wanted.name!));
  }

  if (!project) {
    const name = clamp(wanted.name, 80);
    if (!name) throw new Error('Informe o projeto de destino (id ou nome).');
    projectIsNew = true;
    project = {
      id: crypto.randomUUID(),
      name,
      color: PREDEFINED_COLORS.includes(String(wanted.color)) ? String(wanted.color) : 'bg-indigo-500',
      description: clamp(wanted.description, 500) || undefined,
      status: 'active',
      archived: false,
      createdAt: new Date().toISOString(),
      startDate: toIso(wanted.startDate),
      endDate: toIso(wanted.endDate),
    };
  }

  const columns = columnsFor(project);
  const firstColumn = columns[0]?.id ?? 'todo';

  /* -- épicos: reaproveita por nome, cria o que falta -- */
  const existingEpics = projectIsNew
    ? []
    : sortEpics(await db.epics.where('projectId').equals(project.id).toArray());
  let nextEpicOrder = existingEpics.reduce((m, e) => Math.max(m, e.order ?? -1), -1) + 1;

  const epics: { record: Epic; isNew: boolean }[] = [];
  /** Resolve `key` e nome (ambos minúsculos) para o épico. */
  const epicIndex = new Map<string, Epic>();
  for (const e of existingEpics) epicIndex.set(normalize(e.name), e);

  for (const raw of rawEpics) {
    const name = clamp(raw?.name, 80);
    if (!name) { warnings.push('Um épico sem nome foi ignorado.'); continue; }

    const found = epicIndex.get(normalize(name));
    if (found) {
      epics.push({ record: found, isNew: false });
      if (raw.key) epicIndex.set(normalize(raw.key), found);
      continue;
    }
    const record: Epic = {
      id: crypto.randomUUID(),
      projectId: project.id,
      name,
      description: clamp(raw?.description, 500) || undefined,
      color: PREDEFINED_COLORS.includes(String(raw?.color)) ? String(raw?.color) : undefined,
      order: nextEpicOrder++,
      createdAt: new Date().toISOString(),
    };
    epics.push({ record, isNew: true });
    epicIndex.set(normalize(name), record);
    if (raw.key) epicIndex.set(normalize(raw.key), record);
  }

  /* -- tags: reaproveita por nome (globais + as do projeto), cria o que falta --
     O que a IA cria nasce PRESO AO PROJETO: um roadmap gerado traz vocabulário
     daquele contexto, e despejar isso no espaço global poluiria todos os outros
     projetos. Reaproveitar uma global de mesmo nome continua valendo. */
  const currentTags = tagService.getVisibleTags(project.id);
  const tagIndex = new Map(currentTags.map(t => [normalize(t.name), t]));
  const newTags: Tag[] = [];

  const resolveTag = (name: string): string | null => {
    const clean = clamp(name, 30);
    if (!clean) return null;
    const found = tagIndex.get(normalize(clean));
    if (found) return found.name;
    const tag: Tag = {
      id: crypto.randomUUID(),
      name: clean,
      color: PREDEFINED_COLORS[(currentTags.length + newTags.length) % PREDEFINED_COLORS.length],
      projectId: project.id,
    };
    newTags.push(tag);
    tagIndex.set(normalize(clean), tag);
    return tag.name;
  };

  /* -- tarefas -- */
  const orderByColumn = new Map<string, number>();
  if (!projectIsNew) {
    const existingTasks = await db.tasks.where('projectId').equals(project.id).toArray();
    for (const t of existingTasks) {
      const col = t.status || firstColumn;
      orderByColumn.set(col, Math.max(orderByColumn.get(col) ?? -1, t.order ?? 0) + 1);
    }
  }

  const tasks: Task[] = [];
  for (const raw of rawTasks) {
    const title = clamp(raw?.title, 200);
    if (!title) { warnings.push('Uma tarefa sem título foi ignorada.'); continue; }

    // Coluna: aceita o id ou o rótulo, sem diferenciar maiúsculas.
    let status = firstColumn;
    if (raw?.status) {
      const match = columns.find(c => c.id === raw.status || normalize(c.label) === normalize(String(raw.status)));
      if (match) status = match.id;
      else warnings.push(`Etapa "${raw.status}" não existe em ${project.name}; "${title}" entrou em ${columns[0]?.label}.`);
    }

    let epicId: string | undefined;
    if (raw?.epic) {
      const found = epicIndex.get(normalize(String(raw.epic)));
      if (found) epicId = found.id;
      else warnings.push(`Épico "${raw.epic}" não encontrado; "${title}" ficou sem épico.`);
    }

    const urgency = URGENCIES.includes(raw?.urgency as Urgency) ? (raw!.urgency as Urgency) : 'medium';
    const startDate = toIso(raw?.startDate);
    const dueDate = toIso(raw?.dueDate);
    if (startDate && dueDate && new Date(dueDate) < new Date(startDate)) {
      warnings.push(`"${title}": entrega antes do início — a data de entrega foi descartada.`);
    }

    const subtasks: SubTask[] = Array.isArray(raw?.subtasks)
      ? raw!.subtasks.slice(0, 20).map(s => ({ id: crypto.randomUUID(), title: clamp(s, 200), done: false })).filter(s => s.title)
      : [];

    const tagNames = Array.isArray(raw?.tags)
      ? (raw!.tags.slice(0, 10).map(resolveTag).filter(Boolean) as string[])
      : [];

    const order = orderByColumn.get(status) ?? 0;
    orderByColumn.set(status, order + 1);

    tasks.push({
      id: crypto.randomUUID(),
      title,
      description: clamp(raw?.description, 2000) || undefined,
      urgency,
      tags: tagNames,
      completed: false,
      createdAt: new Date().toISOString(),
      status,
      startDate,
      dueDate: startDate && dueDate && new Date(dueDate) < new Date(startDate) ? undefined : dueDate,
      subtasks: subtasks.length > 0 ? subtasks : undefined,
      order,
      archived: false,
      deleted: false,
      notificationsEnabled: false,
      projectId: project.id,
      epicId,
    });
  }

  if (tasks.length === 0 && epics.every(e => !e.isNew) && !projectIsNew) {
    throw new Error('Nada de novo a criar com este payload.');
  }

  return {
    project: { record: project, isNew: projectIsNew },
    epics,
    tasks,
    newTags,
    warnings,
    summary: {
      epicsNovos: epics.filter(e => e.isNew).length,
      epicsExistentes: epics.filter(e => !e.isNew).length,
      tarefas: tasks.length,
      tagsNovas: newTags.length,
    },
  };
}

/* -------------------------------------------------------------- aplicação */

/** Grava o plano. Só deve ser chamado depois do aval do usuário. */
export async function applyPlan(plan: RoadmapPlan): Promise<{ projectId: string; tarefas: number; epicos: number }> {
  const novosEpicos = plan.epics.filter(e => e.isNew).map(e => e.record);

  await db.transaction('rw', db.projects, db.epics, db.tasks, async () => {
    if (plan.project.isNew) await db.projects.put(plan.project.record);
    if (novosEpicos.length > 0) await db.epics.bulkPut(novosEpicos);
    if (plan.tasks.length > 0) await db.tasks.bulkPut(plan.tasks);
  });

  if (plan.newTags.length > 0) {
    tagService.saveTags([...tagService.getTags(), ...plan.newTags]);
  }

  return { projectId: plan.project.record.id, tarefas: plan.tasks.length, epicos: novosEpicos.length };
}
