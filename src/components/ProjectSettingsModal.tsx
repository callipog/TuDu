import React from 'react';
import { Modal } from './Modal';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { projectService, sortEpics } from '../services/projects';
import { PREDEFINED_COLORS } from '../services/tags';
import { columnsFor } from '../services/boards';
import { useSortableList } from '../hooks/useSortableList';
import { Avatar } from './Avatar';
import { ProjectStatus } from '../types';
import { Plus, Trash2, FolderKanban, GripVertical, Columns3 } from 'lucide-react';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  projectId: string | null;
  onClose: () => void;
  onDelete: (id: string, name: string) => void;
}

const statusLabels: Record<ProjectStatus, string> = { active: 'Ativo', paused: 'Pausado', done: 'Concluído' };

export function ProjectSettingsModal({ isOpen, projectId, onClose, onDelete }: ProjectSettingsModalProps) {
  const project = useLiveQuery(() => projectId ? db.projects.get(projectId) : undefined, [projectId]);
  const rawEpics = useLiveQuery(() => projectId ? db.epics.where('projectId').equals(projectId).toArray() : [], [projectId]) ?? [];
  const personas = useLiveQuery(() => db.personas.orderBy('name').toArray(), []) ?? [];
  const [newEpic, setNewEpic] = React.useState('');

  const epics = sortEpics(rawEpics);

  // Colunas do board (etapas). Inicializa com o padrão ao editar pela 1ª vez.
  const cols = columnsFor(project);
  const setCols = (next: { id: string; label: string }[]) => { if (project) projectService.update(project.id, { columns: next }); };

  // Arrastar para reordenar (hooks antes de qualquer return condicional).
  const epicSort = useSortableList(epics.map(e => e.id), (ids) => projectService.reorderEpics(ids));
  const colSort = useSortableList(cols.map(c => c.id), (ids) => setCols(ids.map(id => cols.find(c => c.id === id)!)));

  if (!project) return null;

  const up = (patch: Partial<typeof project>) => projectService.update(project.id, patch);
  const assignees = project.assigneeIds ?? [];
  const toggleAssignee = (id: string) => {
    const next = assignees.includes(id) ? assignees.filter(a => a !== id) : [...assignees, id];
    up({ assigneeIds: next });
  };
  const toDateInput = (iso?: string) => iso ? iso.slice(0, 10) : '';

  const addColumn = () => setCols([...cols, { id: crypto.randomUUID(), label: 'Nova etapa' }]);
  const renameColumn = (id: string, label: string) => setCols(cols.map(c => c.id === id ? { ...c, label } : c));
  const removeColumn = (id: string) => { if (cols.length > 1) setCols(cols.filter(c => c.id !== id)); };

  const field = 'w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configurações do Projeto" size="2xl">
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Nome</label>
            <input value={project.name} onChange={(e) => up({ name: e.target.value })} className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Status</label>
            <select value={project.status} onChange={(e) => up({ status: e.target.value as ProjectStatus })} className={`${field} appearance-none`}>
              {(Object.keys(statusLabels) as ProjectStatus[]).map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">Descrição</label>
          <textarea value={project.description || ''} onChange={(e) => up({ description: e.target.value })} placeholder="Contexto e objetivo do projeto..." className={`${field} h-20 resize-none`} />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Cor</label>
          <div className="flex flex-wrap gap-1.5">
            {PREDEFINED_COLORS.map(c => (
              <button key={c} onClick={() => up({ color: c })} className={`w-6 h-6 rounded-full ${c} ${c === project.color ? 'ring-2 ring-white scale-110' : 'hover:scale-110'} transition-transform`} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Início</label>
            <input type="date" value={toDateInput(project.startDate)} onChange={(e) => up({ startDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })} className={`${field} [color-scheme:dark]`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Término</label>
            <input type="date" value={toDateInput(project.endDate)} onChange={(e) => up({ endDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })} className={`${field} [color-scheme:dark]`} />
          </div>
        </div>

        {/* Responsáveis */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Responsáveis</label>
          {personas.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">Cadastre personas na Equipe para atribuir responsáveis.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {personas.map(p => {
                const on = assignees.includes(p.id);
                return (
                  <button key={p.id} onClick={() => toggleAssignee(p.id)}
                    className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border text-xs transition-colors ${on ? 'bg-indigo-600/20 border-indigo-500/50 text-white' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'}`}>
                    <Avatar persona={p} size={20} />
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Colunas do board */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 mb-1.5"><Columns3 size={13} /> Etapas do board</label>
          <div ref={colSort.containerRef} className="space-y-1.5">
            {cols.map((c, i) => (
              <div
                key={c.id}
                {...colSort.itemProps(c.id)}
                className={`flex items-center gap-2 bg-white/[0.02] border border-white/10 rounded-lg px-2 py-1.5 ${colSort.itemClass(c.id)}`}
              >
                <span {...colSort.handleProps(c.id)} title="Arraste para reordenar"
                  className="drag-handle shrink-0 p-0.5 -ml-0.5 text-zinc-600 hover:text-zinc-300 cursor-grab active:cursor-grabbing">
                  <GripVertical size={14} />
                </span>
                <span className="text-[10px] text-zinc-600 font-mono w-4 text-center shrink-0">{i + 1}</span>
                <input value={c.label} onChange={(e) => renameColumn(c.id, e.target.value)} className="flex-1 bg-transparent text-sm text-white focus:outline-none min-w-0" />
                <button onClick={() => removeColumn(c.id)} disabled={cols.length <= 1} className="p-1 text-zinc-500 hover:text-rose-400 disabled:opacity-20 transition-colors"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
          <button onClick={addColumn} className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"><Plus size={13} /> Adicionar etapa</button>
          <p className="text-[10px] text-zinc-600 mt-1.5">Arraste pelo <GripVertical size={10} className="inline -mt-0.5" /> para reordenar. A última etapa marca a tarefa como concluída.</p>
        </div>

        {/* Épicos com descrição */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Épicos</label>
          <div ref={epicSort.containerRef} className="space-y-2">
            {epics.map(ep => (
              <div
                key={ep.id}
                {...epicSort.itemProps(ep.id)}
                className={`rounded-lg border border-white/10 bg-white/[0.02] p-2.5 ${epicSort.itemClass(ep.id)}`}
              >
                <div className="flex items-center gap-2">
                  <span {...epicSort.handleProps(ep.id)} title="Arraste para reordenar"
                    className="drag-handle shrink-0 p-0.5 -ml-1 text-zinc-600 hover:text-zinc-300 cursor-grab active:cursor-grabbing">
                    <GripVertical size={14} />
                  </span>
                  <FolderKanban size={13} className="text-zinc-500 shrink-0" />
                  <input value={ep.name} onChange={(e) => projectService.updateEpic(ep.id, { name: e.target.value })} className="flex-1 bg-transparent text-sm text-white font-medium focus:outline-none min-w-0" />
                  <button onClick={() => projectService.removeEpic(ep.id)} className="p-1 text-zinc-500 hover:text-rose-400 transition-colors shrink-0"><Trash2 size={13} /></button>
                </div>
                <textarea
                  value={ep.description || ''}
                  onChange={(e) => projectService.updateEpic(ep.id, { description: e.target.value })}
                  placeholder="Descrição do épico (contexto das ações)..."
                  className="w-full mt-1.5 bg-black/20 border border-white/5 rounded-md px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none h-12"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <input
              value={newEpic}
              onChange={(e) => setNewEpic(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newEpic.trim()) { e.preventDefault(); projectService.createEpic(project.id, newEpic.trim()); setNewEpic(''); } }}
              placeholder="Novo épico..."
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <button onClick={() => { if (newEpic.trim()) { projectService.createEpic(project.id, newEpic.trim()); setNewEpic(''); } }} className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-zinc-300 transition-colors"><Plus size={16} /></button>
          </div>
          {epics.length > 1 && (
            <p className="text-[10px] text-zinc-600 mt-1.5">Arraste pelo <GripVertical size={10} className="inline -mt-0.5" /> para mudar a ordem — vale também para os filtros no board.</p>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/10">
        <button onClick={() => onDelete(project.id, project.name)} className="px-4 py-2 text-sm font-medium text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
          Excluir projeto
        </button>
        <button onClick={onClose} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">Concluído</button>
      </div>
    </Modal>
  );
}
