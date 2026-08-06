import { db } from '../db';
import { columnsFor } from './boards';
import { sortEpics } from './projects';
import { compileRoadmap, applyPlan, RoadmapPlan, RoadmapInput } from './roadmap';

/**
 * Atendimento dos pedidos que chegam pela ponte local (agentes de IA).
 *
 * Leitura é respondida na hora. Escrita passa por uma revisão na tela — o
 * agente propõe, o usuário confirma. Só com "aplicar automaticamente" ligado
 * nas Configurações é que a escrita ocorre sem perguntar.
 */

export interface BridgeRequest {
  id: string;
  kind: 'listProjects' | 'getProject' | 'createRoadmap' | 'addTasks';
  payload: any;
}

export interface PendingReview {
  id: string;
  plan: RoadmapPlan;
}

const respond = (id: string, ok: boolean, extra: Record<string, unknown>) =>
  window.tudu?.bridge?.respond({ id, ok, ...extra });

export const respondOk = (id: string, data: unknown) => respond(id, true, { data });
export const respondError = (id: string, error: string, status = 400) =>
  respond(id, false, { error, status });

/* ------------------------------------------------------------------ leitura */

async function listProjects() {
  const [projects, epics, tasks] = await Promise.all([
    db.projects.toArray(),
    db.epics.toArray(),
    db.tasks.where('deleted').equals(0).toArray().catch(() => db.tasks.toArray()),
  ]);

  return {
    projects: projects
      .filter(p => !p.archived)
      .map(p => {
        const suas = tasks.filter(t => t.projectId === p.id && !t.deleted && !t.archived);
        return {
          id: p.id,
          name: p.name,
          status: p.status,
          description: p.description ?? null,
          startDate: p.startDate ?? null,
          endDate: p.endDate ?? null,
          etapas: columnsFor(p).map(c => c.label),
          epicos: sortEpics(epics.filter(e => e.projectId === p.id)).map(e => e.name),
          tarefas: { total: suas.length, concluidas: suas.filter(t => t.completed).length },
        };
      }),
  };
}

async function getProject(id: string) {
  const project = await db.projects.get(id);
  if (!project) throw new Error(`Projeto ${id} não encontrado.`);

  const [epics, tasks] = await Promise.all([
    db.epics.where('projectId').equals(id).toArray(),
    db.tasks.where('projectId').equals(id).toArray(),
  ]);
  const ativas = tasks.filter(t => !t.deleted && !t.archived);

  return {
    id: project.id,
    name: project.name,
    description: project.description ?? null,
    status: project.status,
    startDate: project.startDate ?? null,
    endDate: project.endDate ?? null,
    etapas: columnsFor(project).map(c => ({ id: c.id, label: c.label })),
    epicos: sortEpics(epics).map(e => ({ id: e.id, name: e.name, description: e.description ?? null })),
    tarefas: ativas.map(t => ({
      id: t.id,
      title: t.title,
      status: t.status ?? null,
      urgency: t.urgency,
      epico: epics.find(e => e.id === t.epicId)?.name ?? null,
      dueDate: t.dueDate ?? null,
      completed: t.completed,
    })),
  };
}

/* ---------------------------------------------------------------- escuta IPC */

/**
 * Liga o atendimento da ponte. Devolve a função para desligar.
 * `onReview` recebe as escritas que precisam do aval do usuário.
 */
export function startBridgeListener(handlers: {
  onReview: (review: PendingReview) => void;
  onCancel: (id: string) => void;
  onApplied?: (resumo: { tarefas: number; epicos: number }) => void;
}): () => void {
  if (!window.tudu?.bridge) return () => {};

  const offRequest = window.tudu.bridge.onRequest(async (req: BridgeRequest) => {
    try {
      if (req.kind === 'listProjects') {
        respondOk(req.id, await listProjects());
        return;
      }
      if (req.kind === 'getProject') {
        respondOk(req.id, await getProject(String(req.payload?.id ?? '')));
        return;
      }

      // Escrita: compila (sem gravar) e leva para revisão.
      const plan = await compileRoadmap(req.payload as RoadmapInput);
      const status = await window.tudu!.bridge.status();

      if (status?.autoApply) {
        const resumo = await applyPlan(plan);
        handlers.onApplied?.(resumo);
        respondOk(req.id, {
          status: 'aplicado',
          projectId: resumo.projectId,
          criados: plan.summary,
          avisos: plan.warnings,
        });
        return;
      }

      handlers.onReview({ id: req.id, plan });
    } catch (err) {
      respondError(req.id, err instanceof Error ? err.message : 'Falha ao processar o pedido.');
    }
  });

  const offCancel = window.tudu.bridge.onCancel(({ id }: { id: string }) => handlers.onCancel(id));

  return () => { offRequest(); offCancel(); };
}
