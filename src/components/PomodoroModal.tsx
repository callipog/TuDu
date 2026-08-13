import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Task } from '../types';
import { notificationService } from '../services/notifications';
import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react';

interface PomodoroModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[]; // ativas e não concluídas, para escolher o foco
  /** Lança o tempo do bloco na tarefa em foco (só blocos de trabalho). */
  onLogTime?: (taskId: string, minutes: number) => void;
}

const WORK = 25 * 60;
const BREAK = 5 * 60;
const R = 52;
const CIRC = 2 * Math.PI * R;

function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

// Estado mantido no componente, que fica sempre montado no App — o timer
// continua rodando mesmo com o modal fechado.
export function PomodoroModal({ isOpen, onClose, tasks, onLogTime }: PomodoroModalProps) {
  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [secondsLeft, setSecondsLeft] = useState(WORK);
  const [running, setRunning] = useState(false);
  const [focusId, setFocusId] = useState<string>('');
  const [cycles, setCycles] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSecondsLeft(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (secondsLeft > 0) return;
    const wasWork = mode === 'work';
    if (wasWork) {
      setCycles(c => c + 1);
      // Bloco de foco concluído vira apontamento na tarefa escolhida.
      if (focusId) onLogTime?.(focusId, Math.round(WORK / 60));
    }
    notificationService.notify(
      'Pomodoro · TuDu',
      wasWork ? 'Bloco concluído! Faça uma pausa de 5 minutos.' : 'Pausa encerrada. Hora de focar!'
    );
    const next = wasWork ? 'break' : 'work';
    setMode(next);
    setSecondsLeft(next === 'work' ? WORK : BREAK);
    setRunning(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const total = mode === 'work' ? WORK : BREAK;
  const progress = 1 - secondsLeft / total;
  const focusTask = tasks.find(t => t.id === focusId);

  const reset = () => { setRunning(false); setMode('work'); setSecondsLeft(WORK); };
  const skip = () => { setSecondsLeft(0); };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Foco · Pomodoro">
      <div className="flex flex-col items-center">
        {/* Modo */}
        <div className="flex bg-white/5 border border-white/10 rounded-lg p-0.5 mb-6">
          {(['work', 'break'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setSecondsLeft(m === 'work' ? WORK : BREAK); setRunning(false); }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${mode === m ? (m === 'work' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white') : 'text-zinc-400 hover:text-white'}`}
            >
              {m === 'work' ? 'Foco' : 'Pausa'}
            </button>
          ))}
        </div>

        {/* Anel de progresso */}
        <div className="relative w-40 h-40 mb-6">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
            <circle
              cx="60" cy="60" r={R} fill="none"
              stroke={mode === 'work' ? '#6366f1' : '#10b981'}
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - progress)}
              style={{ transition: 'stroke-dashoffset 0.5s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-white font-mono tabular-nums">{fmt(secondsLeft)}</span>
            <span className="text-[11px] text-zinc-500 mt-1">{mode === 'work' ? 'Concentre-se' : 'Relaxe'}</span>
          </div>
        </div>

        {/* Controles */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={reset} title="Reiniciar" className="p-3 rounded-full text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors">
            <RotateCcw size={18} />
          </button>
          <button
            onClick={() => setRunning(r => !r)}
            className="p-4 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-colors"
          >
            {running ? <Pause size={22} /> : <Play size={22} />}
          </button>
          <button onClick={skip} title="Pular" className="p-3 rounded-full text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors">
            <SkipForward size={18} />
          </button>
        </div>

        <p className="text-xs text-zinc-500 mb-4">Ciclos de foco concluídos: <span className="text-zinc-300 font-semibold">{cycles}</span></p>

        {/* Tarefa em foco */}
        <div className="w-full">
          <label className="block text-xs font-medium text-zinc-400 mb-1">Focar na tarefa (opcional)</label>
          <select
            value={focusId}
            onChange={(e) => setFocusId(e.target.value)}
            className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
          >
            <option value="">Nenhuma</option>
            {tasks.map(t => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
          {focusTask && (
            <p className="text-[11px] text-indigo-400 mt-2">Focando em: {focusTask.title}</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
