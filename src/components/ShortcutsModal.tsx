import React from 'react';
import { Modal } from './Modal';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts: { keys: string[]; label: string }[] = [
  { keys: ['Ctrl', 'K'], label: 'Paleta de comandos (buscar ações e tarefas)' },
  { keys: ['N'], label: 'Nova tarefa' },
  { keys: ['/'], label: 'Buscar tarefas' },
  { keys: ['I'], label: 'Ir para Caixa de Entrada' },
  { keys: ['H'], label: 'Ir para Hoje' },
  { keys: ['C'], label: 'Ir para Calendário' },
  { keys: ['A'], label: 'Ir para Agenda' },
  { keys: ['L'], label: 'Ir para Lista' },
  { keys: ['?'], label: 'Abrir este guia de atalhos' },
  { keys: ['Esc'], label: 'Fechar janelas / modais' },
];

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Atalhos de teclado">
      <div className="space-y-1">
        {shortcuts.map(s => (
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
      <p className="text-[11px] text-zinc-500 mt-4">Os atalhos ficam inativos enquanto você digita em um campo ou com uma janela aberta.</p>
    </Modal>
  );
}
