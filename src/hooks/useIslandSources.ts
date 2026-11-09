import { useEffect, useRef, useState } from 'react';
import { Task } from '../types';
import { notificationService } from '../services/notifications';
import { buildIslandSnapshot } from '../services/islandSnapshot';
import type { Pomodoro } from './usePomodoro';

/* O "próximo compromisso" depende do relógio, não só das tarefas: quando o
   prazo passa, outra tarefa vira a próxima. 30s basta — é o mesmo ritmo do
   agendador de notificações. */
const CLOCK_MS = 30_000;

/**
 * Publica para o processo principal o retrato das fontes da ilha: lembretes
 * vencidos, próxima tarefa, modo foco e o progresso do dia. Fora do Electron
 * não faz nada.
 *
 * Só publica quando o retrato muda. O timer de foco não entra pelo segundo a
 * segundo: vai o instante em que o bloco acaba e a ilha conta sozinha.
 */
export function useIslandSources(tasks: Task[], pomo: Pomodoro) {
  const [pendingVersion, setPendingVersion] = useState(0);
  const [clock, setClock] = useState(0);
  const lastRef = useRef('');

  useEffect(() => notificationService.onPendingChange(() => setPendingVersion(v => v + 1)), []);

  useEffect(() => {
    const id = setInterval(() => setClock(c => c + 1), CLOCK_MS);
    return () => clearInterval(id);
  }, []);

  const { running, active, kind, mode, focusId, cycles, leftSeconds } = pomo;

  useEffect(() => {
    const island = typeof window !== 'undefined' ? window.tudu?.island : undefined;
    if (!island) return;
    const snapshot = buildIslandSnapshot({
      tasks,
      pending: notificationService.getPending(),
      focus: { running, active, kind, mode, leftSeconds, focusId, cycles },
      now: Date.now(),
    });
    const key = JSON.stringify(snapshot);
    if (key === lastRef.current) return;
    lastRef.current = key;
    island.publish(snapshot);
    // `leftSeconds` fica de fora de propósito: muda a cada segundo, e o retrato
    // só precisa dele no instante em que o foco liga, pausa ou troca de bloco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, pendingVersion, clock, running, active, kind, mode, focusId, cycles]);
}
