import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Template } from '../types';
import { templateService } from '../services/templates';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileStack, FolderKanban, ListChecks, Trash2, Plus, Tag as TagIcon } from 'lucide-react';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Cria a partir do modelo e devolve o que fazer depois (abrir projeto, etc.). */
  onUseTask: (template: Template) => void;
  onUseProject: (template: Template, nome: string) => void;
}

export function TemplatesModal({ isOpen, onClose, onUseTask, onUseProject }: TemplatesModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [novoNome, setNovoNome] = useState<Record<string, string>>({});

  async function recarregar() {
    setTemplates(await templateService.list());
  }

  useEffect(() => {
    if (isOpen) {
      recarregar();
      setNovoNome({});
    }
  }, [isOpen]);

  async function apagar(t: Template) {
    if (!window.confirm(`Apagar o modelo "${t.name}"? As tarefas e projetos já criados a partir dele não são afetados.`)) return;
    await templateService.remove(t.id);
    recarregar();
  }

  const tarefas = templates.filter(t => t.kind === 'task');
  const projetos = templates.filter(t => t.kind === 'project');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Modelos" size="2xl">
      <div className="space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1">
        {templates.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-12 text-zinc-500">
            <FileStack size={36} className="mb-3 opacity-40" />
            <p className="text-sm">Nenhum modelo salvo ainda.</p>
            <p className="text-xs mt-1 text-zinc-600 max-w-sm">
              Clique com o botão direito numa tarefa (ou abra um projeto) e escolha "Salvar como modelo"
              para reaproveitar depois, sem recriar tudo na mão.
            </p>
          </div>
        )}

        {projetos.length > 0 && (
          <div>
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-2">Projetos</p>
            <div className="space-y-2">
              {projetos.map(t => (
                <div key={t.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${t.project?.color || 'bg-zinc-500'}`}></span>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate">{t.name}</h4>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        {t.project?.epics.length ?? 0} épico(s) · {t.project?.tasks.length ?? 0} tarefa(s)
                        {' · '}salvo em {format(parseISO(t.createdAt), 'dd/MM/yy', { locale: ptBR })}
                      </p>
                    </div>
                    <button
                      onClick={() => apagar(t)}
                      title="Apagar modelo"
                      className="shrink-0 p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      value={novoNome[t.id] ?? ''}
                      onChange={(e) => setNovoNome(n => ({ ...n, [t.id]: e.target.value }))}
                      placeholder={`Nome do novo projeto (padrão: ${t.project?.name ?? t.name})`}
                      className="flex-1 min-w-0 bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                    <button
                      onClick={() => onUseProject(t, novoNome[t.id] ?? '')}
                      className="shrink-0 flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                    >
                      <FolderKanban size={13} /> Criar projeto
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tarefas.length > 0 && (
          <div>
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-2">Tarefas</p>
            <div className="space-y-2">
              {tarefas.map(t => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                  <ListChecks size={15} className="text-zinc-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm text-white truncate">{t.name}</h4>
                    <p className="text-[11px] text-zinc-500 flex items-center gap-2 flex-wrap">
                      {(t.task?.subtasks.length ?? 0) > 0 && <span>{t.task!.subtasks.length} subtarefa(s)</span>}
                      {t.task?.dueInDays != null && <span>prazo em {t.task.dueInDays} dia(s)</span>}
                      {(t.task?.tags.length ?? 0) > 0 && (
                        <span className="flex items-center gap-1"><TagIcon size={10} /> {t.task!.tags.join(', ')}</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => onUseTask(t)}
                    className="shrink-0 flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus size={13} /> Criar tarefa
                  </button>
                  <button
                    onClick={() => apagar(t)}
                    title="Apagar modelo"
                    className="shrink-0 p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
