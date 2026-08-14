import React, { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';

export interface PromptState {
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
}

/**
 * Substitui o window.prompt, que o Electron não implementa: lá ele devolve
 * null sem abrir nada, e a ação simplesmente não acontecia.
 */
export function PromptDialog({ state, onClose }: { state: PromptState | null; onClose: () => void }) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state) return;
    setValue(state.defaultValue ?? '');
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 60);
    return () => clearTimeout(t);
  }, [state]);

  if (!state) return null;

  const confirmar = () => {
    const texto = value.trim();
    if (!texto) return;
    state.onConfirm(texto);
    onClose();
  };

  return (
    <Modal isOpen={!!state} onClose={onClose} title={state.title}>
      {state.message && <p className="text-sm text-zinc-400 mb-4">{state.message}</p>}
      <label className="block text-xs font-medium text-zinc-400 mb-1">{state.label ?? 'Nome'}</label>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
          if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        }}
        placeholder={state.placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
      />
      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={confirmar}
          disabled={!value.trim()}
          className="px-5 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white transition-all shadow-lg shadow-indigo-600/20"
        >
          {state.confirmLabel ?? 'Salvar'}
        </button>
      </div>
    </Modal>
  );
}
