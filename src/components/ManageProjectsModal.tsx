import React, { useState } from 'react';
import { Modal } from './Modal';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { projectService } from '../services/projects';
import { PREDEFINED_COLORS } from '../services/tags';
import { ProjectStatus } from '../types';
import { Plus, Trash2, ChevronRight, ChevronDown, FolderKanban, X } from 'lucide-react';

interface ManageProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleteProject: (id: string, name: string) => void;
}

const statusLabels: Record<ProjectStatus, string> = { active: 'Ativo', paused: 'Pausado', done: 'Concluído' };

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PREDEFINED_COLORS.map(c => (
        <button key={c} type="button" onClick={() => onChange(c)}
          className={`w-5 h-5 rounded-full ${c} ${c === value ? 'ring-2 ring-white scale-110' : 'hover:scale-110'} transition-transform`} />
      ))}
    </div>
  );
}

export function ManageProjectsModal({ isOpen, onClose, onDeleteProject }: ManageProjectsModalProps) {
  const projects = useLiveQuery(() => db.projects.orderBy('createdAt').toArray(), []) ?? [];
  const epics = useLiveQuery(() => db.epics.toArray(), []) ?? [];
  const [name, setName] = useState('');
  const [color, setColor] = useState(PREDEFINED_COLORS[0]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newEpic, setNewEpic] = useState('');

  const create = async () => {
    if (!name.trim()) return;
    await projectService.create({ name: name.trim(), color });
    setName('');
    setColor(PREDEFINED_COLORS[0]);
  };

  const addEpic = async (projectId: string) => {
    if (!newEpic.trim()) return;
    await projectService.createEpic(projectId, newEpic.trim());
    setNewEpic('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Projetos">
      {/* Novo projeto */}
      <div className="mb-5 p-3 rounded-xl border border-white/10 bg-white/[0.02]">
        <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-2">Novo projeto</p>
        <div className="flex gap-2 mb-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } }}
            placeholder="Nome do projeto..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button onClick={create} disabled={!name.trim()}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition-colors flex items-center gap-1.5 text-sm font-semibold">
            <Plus size={16} /> Criar
          </button>
        </div>
        <ColorPicker value={color} onChange={setColor} />
      </div>

      {/* Lista de projetos */}
      <div className="space-y-2 max-h-[45vh] overflow-y-auto custom-scrollbar pr-1">
        {projects.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-4">Nenhum projeto ainda.</p>
        ) : projects.map(p => {
          const projEpics = epics.filter(e => e.projectId === p.id);
          const isOpen = expanded === p.id;
          return (
            <div key={p.id} className="rounded-lg border border-white/10 bg-white/5">
              <div className="flex items-center gap-2 p-3">
                <button onClick={() => setExpanded(isOpen ? null : p.id)} className="text-zinc-500 hover:text-white">
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <span className={`w-3 h-3 rounded-full ${p.color}`}></span>
                <input
                  value={p.name}
                  onChange={(e) => projectService.update(p.id, { name: e.target.value })}
                  className="flex-1 bg-transparent text-sm text-white font-medium focus:outline-none min-w-0"
                />
                <select
                  value={p.status}
                  onChange={(e) => projectService.setStatus(p.id, e.target.value as ProjectStatus)}
                  className="bg-[#18181b] border border-white/10 rounded-md px-2 py-1 text-xs text-zinc-300 focus:outline-none appearance-none"
                >
                  {(Object.keys(statusLabels) as ProjectStatus[]).map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
                </select>
                <button onClick={() => onDeleteProject(p.id, p.name)} title="Excluir projeto"
                  className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>

              {isOpen && (
                <div className="px-3 pb-3 pl-9 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {projEpics.length === 0 && <span className="text-xs text-zinc-600 italic">Sem épicos.</span>}
                    {projEpics.map(ep => (
                      <span key={ep.id} className="flex items-center gap-1.5 pl-2 pr-1 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-zinc-300">
                        <FolderKanban size={11} className="text-zinc-500" />
                        {ep.name}
                        <button onClick={() => projectService.removeEpic(ep.id)} className="p-0.5 text-zinc-500 hover:text-rose-400 transition-colors">
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={expanded === p.id ? newEpic : ''}
                      onChange={(e) => setNewEpic(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEpic(p.id); } }}
                      placeholder="Novo épico..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                    <button onClick={() => addEpic(p.id)} className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-zinc-300 transition-colors">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <button onClick={onClose} className="bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">Fechar</button>
      </div>
    </Modal>
  );
}
