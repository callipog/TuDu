import React from 'react';
import { Check } from 'lucide-react';

/** Linha de opção liga/desliga das Configurações: caixinha, ícone, rótulo e dica. */
export function CheckRow({ checked, onChange, disabled, icon, label, hint }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; icon: React.ReactNode; label: string; hint?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-3 py-2 text-left ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-zinc-500'}`}>
        {checked && <Check size={10} strokeWidth={4} />}
      </span>
      <span className="text-zinc-400">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-white">{label}</span>
        {hint && <span className="block text-[11px] text-zinc-500">{hint}</span>}
      </span>
    </button>
  );
}
