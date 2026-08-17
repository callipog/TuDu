import React from 'react';
import { Pause, Play, Timer } from 'lucide-react';
import { Pomodoro } from '../hooks/usePomodoro';

interface PomodoroBarProps {
  pomo: Pomodoro;
  /** Reabre o painel completo. */
  onOpen: () => void;
}

function fmt(total: number) {
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = Math.floor(total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Barrinha do cabeçalho, no espírito da Dynamic Island: aparece quando há
 * sessão em andamento e o painel está fechado. O ponto é poder usar o app
 * (abrir a tarefa, ver subtarefas, consultar o projeto) sem perder o timer de
 * vista nem precisar deixar o modal aberto por cima.
 */
export function PomodoroBar({ pomo, onOpen }: PomodoroBarProps) {
  const pausa = pomo.mode === 'break';
  const tempo = pomo.kind === 'stopwatch' ? pomo.elapsedSeconds : pomo.leftSeconds;

  return (
    <div
      className={`flex items-center gap-1 rounded-full border pl-1 pr-1 py-1 transition-colors ${
        pausa
          ? 'bg-emerald-500/15 border-emerald-500/40'
          : 'bg-indigo-500/15 border-indigo-500/40'
      }`}
    >
      <button
        onClick={onOpen}
        title="Abrir o modo foco"
        className="flex items-center gap-2 pl-2 pr-1 py-0.5 rounded-full group"
      >
        <span className="relative flex items-center">
          <Timer size={13} className={pausa ? 'text-emerald-300' : 'text-indigo-300'} />
          {pomo.running && (
            <span
              className={`absolute -right-1 -top-1 w-1.5 h-1.5 rounded-full animate-pulse ${
                pausa ? 'bg-emerald-400' : 'bg-indigo-400'
              }`}
            />
          )}
        </span>
        <span className={`text-xs font-bold font-mono tabular-nums ${pausa ? 'text-emerald-200' : 'text-indigo-200'}`}>
          {fmt(tempo)}
        </span>
        <span className={`hidden xl:inline text-[10px] font-semibold uppercase tracking-wider ${pausa ? 'text-emerald-400/70' : 'text-indigo-400/70'}`}>
          {pomo.kind === 'stopwatch' ? 'Cronômetro' : pausa ? 'Pausa' : 'Foco'}
        </span>
      </button>

      <button
        onClick={pomo.toggle}
        title={pomo.running ? 'Pausar' : 'Retomar'}
        className={`p-1.5 rounded-full transition-colors ${
          pausa
            ? 'text-emerald-200 hover:bg-emerald-500/25'
            : 'text-indigo-200 hover:bg-indigo-500/25'
        }`}
      >
        {pomo.running ? <Pause size={13} /> : <Play size={13} />}
      </button>
    </div>
  );
}
