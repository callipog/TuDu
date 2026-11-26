import { useCallback, useEffect, useRef, useState } from 'react';
import { notificationService } from '../services/notifications';
import { playCue, playEndSound, EndSound, END_SOUNDS } from '../services/sounds';

export type PomodoroKind = 'pomodoro' | 'stopwatch';
export type PomodoroMode = 'work' | 'break';

const PREFS_KEY = 'tudu_pomodoro_prefs';
const TICK_MS = 250;

interface Prefs {
  workMinutes: number;
  breakMinutes: number;
  /** Pausa longa, que entra no lugar da curta a cada `longEvery` focos. */
  longBreakMinutes: number;
  /** De quantos em quantos focos vem a pausa longa. 0 desliga. */
  longEvery: number;
  autoCycle: boolean;
  soundOn: boolean;
  /** Som tocado quando um bloco de foco fecha. */
  endSound: EndSound;
}

const DEFAULT_PREFS: Prefs = {
  workMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, longEvery: 4,
  autoCycle: false, soundOn: true, endSound: 'acorde',
};

function clampEvery(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 0) return DEFAULT_PREFS.longEvery;
  return Math.min(n, 12);
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        workMinutes: clampMinutes(p.workMinutes, 25),
        breakMinutes: clampMinutes(p.breakMinutes, 5),
        longBreakMinutes: clampMinutes(p.longBreakMinutes, 15),
        longEvery: p.longEvery === undefined ? DEFAULT_PREFS.longEvery : clampEvery(p.longEvery),
        autoCycle: !!p.autoCycle,
        soundOn: p.soundOn !== false,
        endSound: END_SOUNDS.includes(p.endSound) ? p.endSound : DEFAULT_PREFS.endSound,
      };
    }
  } catch { /* ignore */ }
  return DEFAULT_PREFS;
}

function clampMinutes(v: unknown, fallback: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 180);
}

interface Options {
  /** Lança minutos de foco na tarefa escolhida. Só blocos de trabalho. */
  onLogTime?: (taskId: string, minutes: number) => void;
}

/**
 * Máquina do modo foco. Vive no App (fora do modal) para que a barrinha do
 * topo e o modal olhem para o MESMO timer.
 *
 * O tempo é calculado a partir de timestamps (`endsAt` / `startedAt`), não de
 * um contador decrementado a cada segundo: `setInterval` atrasa quando a janela
 * fica em segundo plano ou a máquina suspende, e é exatamente aí que o timer
 * precisa continuar certo.
 */
export function usePomodoro({ onLogTime }: Options = {}) {
  // O App recria esse callback a cada render; guardá-lo num ref evita que os
  // efeitos daqui (em especial o da virada de bloco) reajam a isso.
  const logRef = useRef(onLogTime);
  logRef.current = onLogTime;

  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [kind, setKindState] = useState<PomodoroKind>('pomodoro');
  const [mode, setModeState] = useState<PomodoroMode>('work');
  /** A pausa atual é a longa? Só vale com `mode === 'break'`. */
  const [longBreak, setLongBreak] = useState(false);
  const [running, setRunning] = useState(false);
  const [cycles, setCycles] = useState(0);
  const [focusId, setFocusId] = useState<string>('');

  // Pomodoro (regressivo): sobra em ms quando parado; instante do fim quando rodando.
  const [leftMs, setLeftMs] = useState(prefs.workMinutes * 60_000);
  const endsAtRef = useRef<number | null>(null);

  // Cronômetro livre (progressivo): acumulado quando parado; início do trecho atual quando rodando.
  const [accumMs, setAccumMs] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  // Força re-render a cada tick sem guardar o relógio em estado.
  const [, setNow] = useState(0);

  const minutesFor = (m: PomodoroMode, long: boolean) =>
    m === 'work' ? prefs.workMinutes : long ? prefs.longBreakMinutes : prefs.breakMinutes;
  const totalMs = minutesFor(mode, longBreak) * 60_000;

  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  }, [prefs]);

  const cue = useCallback((n: Parameters<typeof playCue>[0]) => {
    if (prefs.soundOn) playCue(n);
  }, [prefs.soundOn]);

  /* ------------------------------------------------------------- leitura */

  const rawLeftMs = running && endsAtRef.current !== null
    ? Math.max(0, endsAtRef.current - Date.now())
    : leftMs;

  const elapsedMs = kind === 'stopwatch'
    ? (running && startedAtRef.current !== null ? accumMs + (Date.now() - startedAtRef.current) : accumMs)
    : totalMs - rawLeftMs;

  const leftSeconds = Math.ceil(rawLeftMs / 1000);
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const progress = kind === 'pomodoro' ? (totalMs > 0 ? 1 - rawLeftMs / totalMs : 0) : 0;

  /** Há sessão em andamento (rodando ou pausada com tempo já gasto). */
  const active = running || (kind === 'stopwatch' ? accumMs > 0 : rawLeftMs < totalMs);

  /* ------------------------------------------------------------- ações */

  const start = useCallback(() => {
    if (running) return;
    if (kind === 'pomodoro') {
      const restante = leftMs > 0 ? leftMs : totalMs;
      endsAtRef.current = Date.now() + restante;
      setLeftMs(restante);
    } else {
      startedAtRef.current = Date.now();
    }
    setRunning(true);
    cue('start');
  }, [running, kind, leftMs, totalMs, cue]);

  const pause = useCallback(() => {
    if (!running) return;
    if (kind === 'pomodoro') {
      setLeftMs(endsAtRef.current !== null ? Math.max(0, endsAtRef.current - Date.now()) : leftMs);
      endsAtRef.current = null;
    } else {
      setAccumMs(a => a + (startedAtRef.current !== null ? Date.now() - startedAtRef.current : 0));
      startedAtRef.current = null;
    }
    setRunning(false);
    cue('pause');
  }, [running, kind, leftMs, cue]);

  const toggle = useCallback(() => { running ? pause() : start(); }, [running, pause, start]);

  const reset = useCallback(() => {
    setRunning(false);
    endsAtRef.current = null;
    startedAtRef.current = null;
    setLeftMs(totalMs);
    setAccumMs(0);
  }, [totalMs]);

  /**
   * Encerra a sessão e aponta o que já foi trabalhado. É o "finalizar" que
   * faltava: o usuário para quando quiser, sem precisar esperar o bloco fechar.
   */
  const finish = useCallback(() => {
    const gastoMs = kind === 'stopwatch'
      ? accumMs + (running && startedAtRef.current !== null ? Date.now() - startedAtRef.current : 0)
      : totalMs - (running && endsAtRef.current !== null ? Math.max(0, endsAtRef.current - Date.now()) : leftMs);

    const minutos = Math.round(gastoMs / 60_000);
    if (mode === 'work' && focusId && minutos > 0) logRef.current?.(focusId, minutos);

    setRunning(false);
    endsAtRef.current = null;
    startedAtRef.current = null;
    setLeftMs(totalMs);
    setAccumMs(0);
    cue('finish');
    return minutos;
  }, [kind, accumMs, running, totalMs, leftMs, mode, focusId, cue]);

  const setKind = useCallback((k: PomodoroKind) => {
    setKindState(k);
    setRunning(false);
    endsAtRef.current = null;
    startedAtRef.current = null;
    setAccumMs(0);
    setLeftMs(minutesFor(mode, longBreak) * 60_000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, longBreak, prefs]);

  /** Troca manual de modo. `long` escolhe a pausa longa. */
  const setMode = useCallback((m: PomodoroMode, long = false) => {
    const isLong = m === 'break' && long;
    setModeState(m);
    setLongBreak(isLong);
    setRunning(false);
    endsAtRef.current = null;
    setLeftMs(minutesFor(m, isLong) * 60_000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs]);

  const setMinutes = useCallback((alvo: PomodoroMode | 'long', min: number) => {
    const key = alvo === 'work' ? 'workMinutes' : alvo === 'long' ? 'longBreakMinutes' : 'breakMinutes';
    const v = clampMinutes(min, DEFAULT_PREFS[key]);
    setPrefs(p => ({ ...p, [key]: v }));
    // Ajustar a duração do bloco atual só faz sentido com ele parado e intocado.
    const atual = mode === 'work' ? 'work' : longBreak ? 'long' : 'break';
    if (!running && alvo === atual) {
      endsAtRef.current = null;
      setLeftMs(v * 60_000);
    }
  }, [running, mode, longBreak]);

  const setLongEvery = useCallback((v: number) => setPrefs(p => ({ ...p, longEvery: clampEvery(v) })), []);
  const setEndSound = useCallback((v: EndSound) => setPrefs(p => ({ ...p, endSound: v })), []);

  /** Fecha o bloco atual agora (dispara a virada normal, com som e aviso). */
  const skip = useCallback(() => {
    if (kind !== 'pomodoro') return;
    if (running) endsAtRef.current = Date.now(); // a leitura vem daqui quando roda
    setLeftMs(0);
    setNow(Date.now());
  }, [kind, running]);

  const setAutoCycle = useCallback((v: boolean) => setPrefs(p => ({ ...p, autoCycle: v })), []);
  const setSoundOn = useCallback((v: boolean) => setPrefs(p => ({ ...p, soundOn: v })), []);

  /* ------------------------------------------------------------- relógio */

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  /* -------------------------------------------------- virada de bloco */

  // Guarda para a virada acontecer uma única vez por bloco.
  const viradaRef = useRef(false);
  useEffect(() => {
    // Sem exigir `running`: "Pular" com o bloco pausado também precisa virar,
    // senão o relógio fica parado em 00:00 sem nada acontecer.
    if (kind !== 'pomodoro') { viradaRef.current = false; return; }
    if (rawLeftMs > 0) { viradaRef.current = false; return; }
    if (viradaRef.current) return;
    viradaRef.current = true;

    const eraTrabalho = mode === 'work';
    // A pausa longa entra a cada `longEvery` focos fechados (contando este).
    const proximaLonga = eraTrabalho && prefs.longEvery > 0 && (cycles + 1) % prefs.longEvery === 0;
    if (eraTrabalho) {
      setCycles(c => c + 1);
      if (focusId) logRef.current?.(focusId, prefs.workMinutes);
    }

    notificationService.notify(
      'Foco · TuDu',
      eraTrabalho
        ? proximaLonga
          ? `Bloco de ${prefs.workMinutes} min concluído. Pausa longa de ${prefs.longBreakMinutes} min.`
          : `Bloco de ${prefs.workMinutes} min concluído. Pausa de ${prefs.breakMinutes} min.`
        : 'Pausa encerrada. Hora de voltar ao foco.'
    );
    if (prefs.soundOn) {
      if (eraTrabalho) playEndSound(prefs.endSound);
      else playCue('start');
    }

    const proximo: PomodoroMode = eraTrabalho ? 'break' : 'work';
    const proximoMs = minutesFor(proximo, proximaLonga) * 60_000;
    setModeState(proximo);
    setLongBreak(proximaLonga);
    setLeftMs(proximoMs);

    if (prefs.autoCycle && running) {
      // Emenda sozinho: o usuário não precisa clicar para a pausa começar.
      // Só se já estava rodando — pular com o bloco pausado mantém pausado.
      endsAtRef.current = Date.now() + proximoMs;
    } else {
      endsAtRef.current = null;
      setRunning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, kind, rawLeftMs, mode, focusId, prefs, cycles]);

  return {
    kind, mode, longBreak, running, cycles, focusId, active,
    workMinutes: prefs.workMinutes,
    breakMinutes: prefs.breakMinutes,
    longBreakMinutes: prefs.longBreakMinutes,
    longEvery: prefs.longEvery,
    autoCycle: prefs.autoCycle,
    soundOn: prefs.soundOn,
    endSound: prefs.endSound,
    /** Minutos do bloco atual (foco, pausa curta ou longa). */
    currentMinutes: minutesFor(mode, longBreak),
    leftSeconds, elapsedSeconds, progress,
    start, pause, toggle, reset, skip, finish,
    setKind, setMode, setMinutes, setFocusId, setAutoCycle, setSoundOn, setLongEvery, setEndSound,
  };
}

export type Pomodoro = ReturnType<typeof usePomodoro>;
