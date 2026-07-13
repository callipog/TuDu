import React, { useState } from 'react';
import { Modal } from './Modal';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { personaService } from '../services/personas';
import { PREDEFINED_COLORS } from '../services/tags';
import { Avatar } from './Avatar';
import { Plus, Trash2 } from 'lucide-react';

interface ManagePersonasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeletePersona: (id: string, name: string) => void;
}

export function ManagePersonasModal({ isOpen, onClose, onDeletePersona }: ManagePersonasModalProps) {
  const personas = useLiveQuery(() => db.personas.orderBy('name').toArray(), []) ?? [];
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [color, setColor] = useState(PREDEFINED_COLORS[0]);

  const create = async () => {
    if (!name.trim()) return;
    await personaService.create({ name: name.trim(), role: role.trim() || undefined, color });
    setName('');
    setRole('');
    setColor(PREDEFINED_COLORS[0]);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Personas da Equipe">
      <div className="mb-5 p-3 rounded-xl border border-white/10 bg-white/[0.02]">
        <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-2">Nova persona</p>
        <div className="space-y-2 mb-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } }}
            placeholder="Nome"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <div className="flex gap-2">
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } }}
              placeholder="Cargo (opcional)"
              className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button onClick={create} disabled={!name.trim()}
              className="shrink-0 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition-colors flex items-center gap-1.5 text-sm font-semibold">
              <Plus size={16} /> Criar
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PREDEFINED_COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={`w-5 h-5 rounded-full ${c} ${c === color ? 'ring-2 ring-white scale-110' : 'hover:scale-110'} transition-transform`} />
          ))}
        </div>
      </div>

      <div className="space-y-2 max-h-[45vh] overflow-y-auto custom-scrollbar pr-1">
        {personas.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-4">Nenhuma persona ainda.</p>
        ) : personas.map(p => (
          <div key={p.id} className={`flex items-center gap-3 bg-white/5 border border-white/10 p-3 rounded-lg transition-opacity ${p.status === 'inactive' ? 'opacity-60' : ''}`}>
            <Avatar persona={p} size={36} />
            <div className="flex-1 min-w-0">
              <input
                value={p.name}
                onChange={(e) => personaService.update(p.id, { name: e.target.value })}
                className="w-full bg-transparent text-sm text-white font-medium focus:outline-none"
              />
              <input
                value={p.role || ''}
                onChange={(e) => personaService.update(p.id, { role: e.target.value })}
                placeholder="Cargo"
                className="w-full bg-transparent text-xs text-zinc-400 focus:outline-none"
              />
            </div>
            <StatusToggle
              active={p.status !== 'inactive'}
              onChange={(active) => personaService.update(p.id, { status: active ? 'active' : 'inactive' })}
            />
            <div className="flex flex-wrap gap-1 max-w-[120px] justify-end">
              {PREDEFINED_COLORS.map(c => (
                <button key={c} type="button" onClick={() => personaService.update(p.id, { color: c })}
                  className={`w-4 h-4 rounded-full ${c} ${c === p.color ? 'ring-2 ring-white' : 'hover:scale-110'} transition-transform`} />
              ))}
            </div>
            <button onClick={() => onDeletePersona(p.id, p.name)} title="Excluir persona"
              className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors shrink-0">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <button onClick={onClose} className="bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">Fechar</button>
      </div>
    </Modal>
  );
}

/** Toggle Ativo/Inativo para a persona. */
function StatusToggle({ active, onChange }: { active: boolean; onChange: (active: boolean) => void }) {
  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <button
        type="button"
        role="switch"
        aria-checked={active}
        onClick={() => onChange(!active)}
        title={active ? 'Ativo — clique para inativar' : 'Inativo — clique para ativar'}
        className={`relative w-9 h-5 rounded-full transition-colors ${active ? 'bg-emerald-500' : 'bg-zinc-600'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-4' : ''}`} />
      </button>
      <span className={`text-[9px] uppercase font-bold tracking-wider ${active ? 'text-emerald-400' : 'text-zinc-500'}`}>
        {active ? 'Ativo' : 'Inativo'}
      </span>
    </div>
  );
}
