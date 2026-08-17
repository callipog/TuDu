import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';
import { Task, Urgency } from '../types';
import { Pomodoro, PomodoroMode } from '../hooks/usePomodoro';
import { Play, Pause, RotateCcw, SkipForward, Check, Search, Timer, Hourglass, Volume2, VolumeX, Repeat, CheckCircle2, ListChecks, Minus, Plus } from 'lucide-react';

interface PomodoroModalProps {
  isOpen: boolean;
  onClose: () => void;
  pomo: Pomodoro;
  /** Ativas e não concluídas, para escolher o foco. */
  tasks: Task[];
  /** Resolve o nome do projeto da tarefa (só o App sabe). */
  projectName: (id?: string) => string | undefined;
}

const R = 52;
const CIRC = 2 * Math.PI * R;

const urgencyDot: Record<Urgency, string> = {
  low: 'bg-emerald-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-rose-500',
};

const WORK_PRESETS = [15, 25, 45, 50];

function fmt(total: number) {
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = Math.floor(total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function fmtMin(min?: number) {
  if (!min) return null;
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h}h${String(r).padStart(2, '0')}` : `${h}h`;
}

/**
 * Campo de minutos com passo próprio. Substitui o spinner nativo do
 * `input[type=number]`, que o Chromium desenha fora do tema (o spinner em si
 * fica escondido por uma regra global em index.css).
 *
 * O valor digitado vive num estado local enquanto o campo está em edição:
 * comitar a cada tecla faria o campo saltar para o mínimo no instante em que
 * ficasse vazio, no meio de uma digitação legítima.
 */
function Stepper({ valor, onChange, rotulo }: { valor: number; onChange: (v: number) => void; rotulo: string }) {
  const [rascunho, setRascunho] = useState<string | null>(null);
  const mostrado = rascunho ?? String(valor);

  // Qualquer mudança vinda de fora (uma pílula de preset, os botões de passo)
  // descarta o que estava sendo digitado. Sem isto o campo continua exibindo o
  // rascunho antigo e passa a mentir sobre a duração que está valendo.
  useEffect(() => { setRascunho(null); }, [valor]);

  const passo = (delta: number) => {
    setRascunho(null);
    onChange(Math.min(180, Math.max(1, valor + delta)));
  };

  const comitar = () => {
    const n = Number(rascunho);
    setRascunho(null);
    if (Number.isFinite(n) && n >= 1) onChange(Math.min(180, Math.round(n)));
  };

  return (
    <div className="inline-flex items-stretch rounded-lg border border-white/10 bg-white/5 overflow-hidden">
      <button
        type="button"
        onClick={() => passo(-5)}
        title={`Diminuir ${rotulo}`}
        className="w-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
      >
        <Minus size={12} />
      </button>
      <div className="flex items-baseline gap-1 px-1.5 border-x border-white/5">
        <input
          type="number"
          min={1}
          max={180}
          value={mostrado}
          onChange={(e) => setRascunho(e.target.value)}
          onBlur={comitar}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          aria-label={`Minutos de ${rotulo}`}
          className="w-7 bg-transparent text-center text-[13px] font-mono tabular-nums text-white focus:outline-none"
        />
        <span className="text-[10px] text-zinc-500 pr-0.5">min</span>
      </div>
      <button
        type="button"
        onClick={() => passo(5)}
        title={`Aumentar ${rotulo}`}
        className="w-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
      >
        <Plus size={12} />
      </button>
    </div>
  );
}

export function PomodoroModal({ isOpen, onClose, pomo, tasks, projectName }: PomodoroModalProps) {
  const [busca, setBusca] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(false);

  const pausa = pomo.mode === 'break';
  const cronometro = pomo.kind === 'stopwatch';
  const tempo = cronometro ? pomo.elapsedSeconds : pomo.leftSeconds;
  const focada = tasks.find(t => t.id === pomo.focusId);

  // Sem tarefa escolhida a gaveta abre sozinha: é a decisão que falta tomar.
  useEffect(() => {
    if (isOpen) {
      setTrocando(!pomo.focusId);
      setBusca('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return tasks;
    return tasks.filter(t =>
      t.title.toLowerCase().includes(termo) ||
      (projectName(t.projectId) ?? '').toLowerCase().includes(termo));
  }, [tasks, busca, projectName]);

  const concluir = () => {
    const min = pomo.finish();
    setAviso(
      min <= 0
        ? 'Sessão encerrada — menos de 1 minuto, nada foi apontado.'
        : focada
          ? `${min} min ${min === 1 ? 'apontado' : 'apontados'} em "${focada.title}".`
          : `${min} min de foco — sem tarefa escolhida, nada foi apontado.`
    );
    setTimeout(() => setAviso(null), 5000);
  };

  const escolher = (id: string) => {
    pomo.setFocusId(id === pomo.focusId ? '' : id);
    if (id !== pomo.focusId) setTrocando(false);
  };

  const dica = pomo.running
    ? cronometro
      ? 'Contando. Use "Concluir" para parar e apontar o tempo na tarefa.'
      : pausa
        ? 'Pausa em andamento.'
        : 'Você pode fechar esta janela — o timer continua na barrinha do topo do app.'
    : pomo.active
      ? 'Pausado. Retome, ou conclua para apontar o que já foi trabalhado.'
      : cronometro
        ? 'Cronômetro livre: conta pra cima até você concluir.'
        : `Bloco de ${pomo.workMinutes} min. Escolha uma tarefa para o tempo virar apontamento.`;

  const acento = pausa ? '#10b981' : '#6366f1';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Modo foco" size="4xl" flush>
      <div className="flex-1 min-w-0 flex flex-col">

        {/* ---------------------------------------------------- palco */}
        <div className="px-7 py-6 flex flex-col sm:flex-row items-center gap-7 border-b border-white/10">
          <div className="relative w-[168px] h-[168px] shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
              {!cronometro && (
                <circle
                  cx="60" cy="60" r={R} fill="none"
                  stroke={acento}
                  strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={CIRC * (1 - pomo.progress)}
                  style={{ transition: 'stroke-dashoffset 0.3s linear' }}
                />
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[38px] leading-none font-bold text-white font-mono tabular-nums tracking-tight">
                {fmt(tempo)}
              </span>
              <span className="text-[11px] text-zinc-500 mt-1.5">
                {cronometro ? 'Tempo corrido' : pausa ? 'Pausa' : `Foco · bloco ${pomo.cycles + 1}`}
              </span>
            </div>
          </div>

          <div className="flex-1 min-w-0 w-full flex flex-col gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">
                {focada ? 'Trabalhando em' : 'Nenhuma tarefa escolhida'}
              </p>
              {focada ? (
                <>
                  <h3 className="text-[19px] font-semibold text-white leading-tight truncate">{focada.title}</h3>
                  <div className="flex items-center gap-2.5 flex-wrap mt-1.5 text-[11.5px] text-zinc-500">
                    {projectName(focada.projectId) && (
                      <span className="text-indigo-400/85 truncate max-w-[220px]">{projectName(focada.projectId)}</span>
                    )}
                    {(focada.subtasks?.length ?? 0) > 0 && (
                      <span>{focada.subtasks!.filter(s => s.done).length}/{focada.subtasks!.length} subtarefas</span>
                    )}
                    {fmtMin(focada.estimateMinutes) && <span>estimativa {fmtMin(focada.estimateMinutes)}</span>}
                    {fmtMin(focada.spentMinutes) && <span className="text-emerald-400/85">feito {fmtMin(focada.spentMinutes)}</span>}
                  </div>
                </>
              ) : (
                <p className="text-sm text-zinc-400">
                  O tempo será cronometrado, mas não vai virar apontamento em nenhuma tarefa.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={pomo.toggle}
                className={`flex items-center justify-center gap-2 text-sm font-semibold rounded-lg px-5 py-2.5 transition-colors ${
                  pomo.running
                    ? 'bg-white/10 hover:bg-white/15 text-white border border-white/15'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                }`}
              >
                {pomo.running ? <Pause size={16} /> : <Play size={16} />}
                {pomo.running ? 'Pausar' : pomo.active ? 'Retomar' : cronometro ? 'Iniciar cronômetro' : 'Iniciar foco'}
              </button>
              <button
                onClick={concluir}
                disabled={!pomo.active}
                title="Encerra a sessão e aponta o tempo na tarefa escolhida"
                className="flex items-center justify-center gap-2 text-sm font-semibold text-white bg-emerald-600/90 hover:bg-emerald-500 rounded-lg px-4 py-2.5 transition-colors disabled:opacity-30 disabled:hover:bg-emerald-600/90"
              >
                <CheckCircle2 size={15} /> Concluir e apontar
              </button>
              <button
                onClick={pomo.reset}
                title="Zerar sem apontar"
                className="p-2.5 rounded-lg text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                <RotateCcw size={15} />
              </button>
              {!cronometro && (
                <button
                  onClick={pomo.skip}
                  title={`Pular para ${pausa ? 'o foco' : 'a pausa'}`}
                  className="p-2.5 rounded-lg text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                >
                  <SkipForward size={15} />
                </button>
              )}
              <button
                onClick={() => setTrocando(v => !v)}
                className={`flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2.5 border transition-colors ${
                  trocando
                    ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                    : 'text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border-white/10'
                }`}
              >
                <ListChecks size={14} /> {focada ? 'Trocar tarefa' : 'Escolher tarefa'}
              </button>
            </div>

            <p className="text-[11px] text-zinc-500 leading-relaxed">{dica}</p>
            {aviso && <p className="text-[11px] text-emerald-400">{aviso}</p>}
          </div>
        </div>

        {/* ------------------------------------------------- gaveta */}
        {trocando && (
          <div className="px-7 py-4 border-b border-white/10 bg-white/[0.015]">
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  autoFocus
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por tarefa ou projeto..."
                  className="w-full pl-8 pr-3 py-2 bg-black/30 border border-white/10 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              {pomo.focusId && (
                <button
                  onClick={() => { pomo.setFocusId(''); }}
                  className="text-[11px] text-zinc-500 hover:text-white transition-colors shrink-0"
                >
                  Trabalhar sem tarefa
                </button>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-x-3 max-h-[192px] overflow-y-auto custom-scrollbar">
              {lista.length === 0 ? (
                <p className="text-[11px] text-zinc-500 px-1 py-3 col-span-full text-center">
                  {busca ? 'Nenhuma tarefa com esse termo.' : 'Nenhuma tarefa aberta.'}
                </p>
              ) : lista.map(t => {
                const escolhida = t.id === pomo.focusId;
                const proj = projectName(t.projectId);
                const est = fmtMin(t.estimateMinutes);
                const gasto = fmtMin(t.spentMinutes);
                const totalSub = t.subtasks?.length ?? 0;
                return (
                  <button
                    key={t.id}
                    onClick={() => escolher(t.id)}
                    className={`flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                      escolhida ? 'bg-indigo-500/10' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className={`shrink-0 mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${
                      escolhida ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-zinc-600'
                    }`}>
                      {escolhida && <Check size={10} strokeWidth={4} />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${urgencyDot[t.urgency]}`} />
                        <span className={`block truncate text-xs ${escolhida ? 'text-white font-medium' : 'text-zinc-200'}`}>
                          {t.title}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 flex-wrap mt-0.5 text-[10px] text-zinc-500">
                        {proj && <span className="text-indigo-400/80 truncate max-w-[130px]">{proj}</span>}
                        {totalSub > 0 && <span>{t.subtasks!.filter(s => s.done).length}/{totalSub} subtarefas</span>}
                        {est && <span>est. {est}</span>}
                        {gasto && <span className="text-emerald-400/80">feito {gasto}</span>}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* --------------------------------------------- tira inferior */}
        <div className="px-7 py-3 flex flex-col gap-2.5">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex bg-white/5 border border-white/10 rounded-lg p-0.5">
              {([
                { id: 'pomodoro' as const, label: 'Pomodoro', icon: <Timer size={12} /> },
                { id: 'stopwatch' as const, label: 'Cronômetro', icon: <Hourglass size={12} /> },
              ]).map(o => (
                <button
                  key={o.id}
                  onClick={() => pomo.setKind(o.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    pomo.kind === o.id ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {o.icon} {o.label}
                </button>
              ))}
            </div>

            {!cronometro && (
              <div className="flex bg-white/5 border border-white/10 rounded-lg p-0.5">
                {([
                  { id: 'work' as PomodoroMode, label: 'Foco' },
                  { id: 'break' as PomodoroMode, label: 'Pausa' },
                ]).map(m => (
                  <button
                    key={m.id}
                    onClick={() => pomo.setMode(m.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      pomo.mode === m.id
                        ? m.id === 'work' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}

            {!cronometro && (
              <button
                onClick={() => pomo.setAutoCycle(!pomo.autoCycle)}
                title="Ao fechar o bloco, emenda a pausa e o próximo sem você clicar"
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
                  pomo.autoCycle
                    ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                    : 'bg-white/5 border-white/10 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Repeat size={13} /> Ciclos automáticos
              </button>
            )}

            <button
              onClick={() => pomo.setSoundOn(!pomo.soundOn)}
              title={pomo.soundOn ? 'Desligar os avisos sonoros' : 'Ligar os avisos sonoros'}
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
                pomo.soundOn
                  ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                  : 'bg-white/5 border-white/10 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {pomo.soundOn ? <Volume2 size={13} /> : <VolumeX size={13} />} Som
            </button>

            <span className="ml-auto text-[11px] text-zinc-500 shrink-0">
              Ciclos hoje: <span className="text-zinc-300 font-semibold">{pomo.cycles}</span>
            </span>
          </div>

          {!cronometro && (
            <div className="flex items-center gap-4 flex-wrap pt-2.5 border-t border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-500 w-9">Foco</span>
                <div className="flex gap-1">
                  {WORK_PRESETS.map(p => (
                    <button
                      key={p}
                      onClick={() => pomo.setMinutes('work', p)}
                      className={`text-[11px] font-semibold w-8 py-1.5 rounded-md border transition-colors ${
                        pomo.workMinutes === p
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border-white/10'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <Stepper valor={pomo.workMinutes} onChange={(v) => pomo.setMinutes('work', v)} rotulo="foco" />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-500">Pausa</span>
                <Stepper valor={pomo.breakMinutes} onChange={(v) => pomo.setMinutes('break', v)} rotulo="pausa" />
              </div>

              <span className="text-[10px] text-zinc-600">
                Mudar a duração do bloco em andamento só vale para o próximo.
              </span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
