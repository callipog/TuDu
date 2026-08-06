import React from 'react';
import { Modal } from './Modal';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const groups: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: 'Geral',
    items: [
      { keys: ['Ctrl', 'K'], label: 'Paleta de comandos (buscar ações e tarefas)' },
      { keys: ['N'], label: 'Nova tarefa' },
      { keys: ['/'], label: 'Buscar tarefas' },
      { keys: ['T'], label: 'Timer de foco (Pomodoro)' },
      { keys: [','], label: 'Configurações' },
      { keys: ['?'], label: 'Abrir este guia de atalhos' },
      { keys: ['Esc'], label: 'Fechar janelas / modais' },
    ],
  },
  {
    title: 'Navegar',
    items: [
      { keys: ['I'], label: 'Caixa de Entrada' },
      { keys: ['H'], label: 'Hoje' },
      { keys: ['C'], label: 'Calendário' },
      { keys: ['A'], label: 'Agenda' },
      { keys: ['L'], label: 'Lista' },
      { keys: ['P'], label: 'Projetos' },
      { keys: ['E'], label: 'Equipe' },
      { keys: ['R'], label: 'Relatórios' },
    ],
  },
];

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Atalhos de teclado">
      <div className="space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
        {groups.map(g => (
          <div key={g.title}>
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">{g.title}</p>
            {g.items.map(s => (
              <div key={s.label} className="flex items-center justify-between py-2 px-1 border-b border-white/5 last:border-0">
                <span className="text-sm text-zinc-300">{s.label}</span>
                <div className="flex items-center gap-1">
                  {s.keys.map(k => (
                    <kbd key={k} className="min-w-[24px] text-center px-2 py-1 text-xs font-mono font-semibold text-zinc-200 bg-white/10 border border-white/15 rounded-md shadow-sm">
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-zinc-500 mt-4">Os atalhos ficam inativos enquanto você digita em um campo ou com uma janela aberta.</p>
    </Modal>
  );
}
