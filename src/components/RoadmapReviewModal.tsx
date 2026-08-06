import React from 'react';
import { Modal } from './Modal';
import { RoadmapPlan } from '../services/roadmap';
import { statusLabel } from '../services/boards';
import { columnsFor } from '../services/boards';
import { Bot, FolderKanban, AlertTriangle, Plus, CornerDownRight } from 'lucide-react';

interface RoadmapReviewModalProps {
  plan: RoadmapPlan | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const URGENCY_LABEL: Record<string, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica',
};
const URGENCY_CLS: Record<string, string> = {
  low: 'text-zinc-400', medium: 'text-blue-400', high: 'text-amber-400', critical: 'text-rose-400',
};

/**
 * Revisão do que um agente de IA propôs. É o freio do fluxo automático: nada
 * entra no banco sem o usuário ver o volume e a distribuição do que vem.
 */
export function RoadmapReviewModal({ plan, onConfirm, onCancel }: RoadmapReviewModalProps) {
  if (!plan) return null;

  const { project, epics, tasks, newTags, warnings, summary } = plan;
  const columns = columnsFor(project.record);
  const epicName = (id?: string) => epics.find(e => e.record.id === id)?.record.name;

  const porEtapa = columns
    .map(c => ({ label: c.label, n: tasks.filter(t => t.status === c.id).length }))
    .filter(x => x.n > 0);

  return (
    <Modal isOpen={!!plan} onClose={onCancel} title="Proposta de um agente" size="2xl">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/25">
          <Bot size={18} className="text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-sm text-zinc-300">
            Um agente conectado pela ponte local quer gravar no TuDu. Confira antes de aplicar —
            nada é criado sem o seu aval.
          </p>
        </div>

        {/* Destino */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-2">Destino</p>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${project.record.color}`} />
            <span className="text-sm font-semibold text-white">{project.record.name}</span>
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
              project.isNew
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-white/5 text-zinc-400 border-white/10'
            }`}>
              {project.isNew ? 'projeto novo' : 'projeto existente'}
            </span>
          </div>
        </div>

        {/* Resumo numérico */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { n: summary.epicsNovos, label: summary.epicsNovos === 1 ? 'épico novo' : 'épicos novos' },
            { n: summary.tarefas, label: summary.tarefas === 1 ? 'tarefa' : 'tarefas' },
            { n: summary.tagsNovas, label: summary.tagsNovas === 1 ? 'tag nova' : 'tags novas' },
          ].map(x => (
            <div key={x.label} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
              <p className="text-2xl font-bold text-white">{x.n}</p>
              <p className="text-[11px] text-zinc-500">{x.label}</p>
            </div>
          ))}
        </div>

        {porEtapa.length > 0 && (
          <p className="text-xs text-zinc-500">
            Distribuição: {porEtapa.map(x => `${x.n} em ${x.label}`).join(' · ')}
          </p>
        )}

        {/* Avisos do compilador */}
        {warnings.length > 0 && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 mb-1.5">
              <AlertTriangle size={13} /> {warnings.length} {warnings.length === 1 ? 'ajuste feito' : 'ajustes feitos'}
            </p>
            <ul className="space-y-1">
              {warnings.slice(0, 8).map((w, i) => (
                <li key={i} className="text-xs text-amber-200/80">• {w}</li>
              ))}
              {warnings.length > 8 && (
                <li className="text-xs text-amber-200/60">…e mais {warnings.length - 8}.</li>
              )}
            </ul>
          </div>
        )}

        {/* Épicos */}
        {epics.length > 0 && (
          <div>
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1.5">Épicos</p>
            <div className="flex flex-wrap gap-1.5">
              {epics.map(e => (
                <span key={e.record.id}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
                    e.isNew ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-white/5 border-white/10 text-zinc-400'
                  }`}>
                  {e.isNew ? <Plus size={11} /> : <FolderKanban size={11} />}
                  {e.record.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tarefas */}
        {tasks.length > 0 && (
          <div>
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1.5">Tarefas</p>
            <div className="max-h-64 overflow-y-auto custom-scrollbar rounded-xl border border-white/10 divide-y divide-white/5">
              {tasks.map(t => (
                <div key={t.id} className="p-2.5">
                  <div className="flex items-start gap-2">
                    <CornerDownRight size={13} className="text-zinc-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{t.title}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5 text-[11px] text-zinc-500">
                        <span className={URGENCY_CLS[t.urgency]}>{URGENCY_LABEL[t.urgency]}</span>
                        <span>· {statusLabel(t.status, false, columns)}</span>
                        {epicName(t.epicId) && <span>· {epicName(t.epicId)}</span>}
                        {t.dueDate && <span>· entrega {new Date(t.dueDate).toLocaleDateString('pt-BR')}</span>}
                        {t.subtasks && t.subtasks.length > 0 && <span>· {t.subtasks.length} subtarefas</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {newTags.length > 0 && (
          <p className="text-xs text-zinc-500">
            Tags que serão criadas: {newTags.map(t => t.name).join(', ')}
          </p>
        )}
      </div>

      <div className="flex justify-end items-center gap-2 mt-6 pt-4 border-t border-white/10">
        <button onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
          Recusar
        </button>
        <button onClick={onConfirm}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
          Aplicar no TuDu
        </button>
      </div>
    </Modal>
  );
}
