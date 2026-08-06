import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Tag } from '../types';
import { tagService, PREDEFINED_COLORS } from '../services/tags';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Trash2, Plus, Check, Globe, FolderKanban } from 'lucide-react';

interface ManageTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTagsUpdated: () => void;
}

export function ManageTagsModal({ isOpen, onClose, onTagsUpdated }: ManageTagsModalProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [editingColorId, setEditingColorId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string>(PREDEFINED_COLORS[0]);
  const [newScope, setNewScope] = useState<string>(''); // '' = global
  const projects = useLiveQuery(() => db.projects.filter(p => !p.archived).toArray(), []) ?? [];
  const projectName = (id?: string) => projects.find(p => p.id === id)?.name;

  useEffect(() => {
    if (isOpen) {
      setTags(tagService.getTags());
      setEditingColorId(null);
      setNewName('');
      setNewScope('');
      setNewColor(PREDEFINED_COLORS[0]);
    }
  }, [isOpen]);

  function refresh() {
    setTags(tagService.getTags());
    onTagsUpdated();
  }

  const handleDeleteTag = (id: string) => {
    tagService.deleteTag(id);
    refresh();
  };

  const handleChangeColor = (tag: Tag, color: string) => {
    tagService.addTag(tag.name, color, tag.projectId); // upsert no mesmo escopo
    setEditingColorId(null);
    refresh();
  };

  const handleChangeScope = (id: string, projectId: string) => {
    tagService.setScope(id, projectId || undefined);
    refresh();
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    tagService.addTag(name, newColor, newScope || undefined);
    setNewName('');
    setNewColor(PREDEFINED_COLORS[0]);
    refresh();
  };

  // Colisão é só dentro do escopo visível: "Bug" global e "Bug" do projeto X
  // apareceriam juntas na mesma tarefa, e a cor viraria sorteio.
  const nameExists = tags.some(t =>
    t.name.toLowerCase() === newName.trim().toLowerCase() &&
    (!t.projectId || t.projectId === (newScope || undefined))
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Tags">
      {/* Criar nova tag */}
      <div className="mb-5 p-3 rounded-xl border border-white/10 bg-white/[0.02]">
        <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-2">Nova tag</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
            placeholder="Nome da tag..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || nameExists}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-1.5 text-sm font-semibold"
          >
            <Plus size={16} /> Criar
          </button>
        </div>
        <div className="mt-3">
          <label className="block text-[11px] text-zinc-500 mb-1">Onde ela vale</label>
          <select
            value={newScope}
            onChange={(e) => setNewScope(e.target.value)}
            className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 appearance-none transition-colors"
          >
            <option value="">Global — aparece em todas as tarefas</option>
            {projects.map(p => <option key={p.id} value={p.id}>Só no projeto {p.name}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {PREDEFINED_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setNewColor(c)}
              className={`w-6 h-6 rounded-full ${c} ${c === newColor ? 'ring-2 ring-white scale-110' : 'hover:scale-110'} transition-transform`}
            />
          ))}
        </div>
        {nameExists && <p className="text-[11px] text-amber-400/80 mt-2">Já existe uma tag com esse nome neste escopo.</p>}
      </div>

      {/* Lista de tags */}
      <div className="space-y-2 max-h-[45vh] overflow-y-auto custom-scrollbar pr-1">
        {tags.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-4">Nenhuma tag criada.</p>
        ) : (
          tags.map(tag => (
            <div key={tag.id} className="bg-white/5 border border-white/10 p-3 rounded-lg">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setEditingColorId(editingColorId === tag.id ? null : tag.id)}
                    title="Alterar cor"
                    className={`w-4 h-4 rounded-full ${tag.color} ring-offset-2 ring-offset-[#111] hover:ring-2 hover:ring-white/40 transition-all`}
                  />
                  <span className="text-sm text-white font-medium">{tag.name}</span>
                  <span className={`flex items-center gap-1 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${
                    tag.projectId
                      ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                      : 'bg-white/5 text-zinc-500 border-white/10'
                  }`}>
                    {tag.projectId ? <FolderKanban size={9} /> : <Globe size={9} />}
                    {tag.projectId ? (projectName(tag.projectId) ?? 'projeto removido') : 'global'}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteTag(tag.id)}
                  className="text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 p-1.5 rounded-md transition-colors"
                  title="Excluir tag"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              {editingColorId === tag.id && (
                <div className="mt-3 pt-3 border-t border-white/5 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {PREDEFINED_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => handleChangeColor(tag, c)}
                        className={`w-6 h-6 rounded-full ${c} flex items-center justify-center ${c === tag.color ? 'ring-2 ring-white scale-110' : 'hover:scale-110'} transition-transform`}
                      >
                        {c === tag.color && <Check size={12} className="text-white" strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-500 mb-1">Onde ela vale</label>
                    <select
                      value={tag.projectId ?? ''}
                      onChange={(e) => handleChangeScope(tag.id, e.target.value)}
                      className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 appearance-none transition-colors"
                    >
                      <option value="">Global — aparece em todas as tarefas</option>
                      {projects.map(p => <option key={p.id} value={p.id}>Só no projeto {p.name}</option>)}
                    </select>
                    <p className="text-[10px] text-zinc-600 mt-1">
                      Mudar o escopo não mexe nas tarefas que já usam a tag.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={onClose}
          className="bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Fechar
        </button>
      </div>
    </Modal>
  );
}
