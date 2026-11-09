import { Task } from '../types';
import { format, parseISO } from 'date-fns';
import { PendingReminder, stillPending } from './islandSnapshot';

export type { PendingReminder };

const FIRED_KEY = 'tudu_fired_notifications';
// Lembretes que venceram e ainda não foram resolvidos — é o que a ilha mostra.
// O toast do Windows some sozinho; estes ficam até a tarefa sair do caminho.
const PENDING_KEY = 'tudu_island_pending';
const MAX_PENDING = 50;
// Janela de "catch-up": eventos que passaram há mais que isso ao abrir o app
// são marcados como disparados silenciosamente (evita spam de tarefas antigas).
const GRACE_MS = 6 * 60 * 60 * 1000;
const TICK_MS = 30 * 1000;
export const DEFAULT_REMINDER_MINUTES = 30;

let currentTasks: Task[] = [];
let intervalId: ReturnType<typeof setInterval> | null = null;

const pendingListeners = new Set<() => void>();

function loadPending(): PendingReminder[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch {
    // ignore
  }
  return [];
}

function savePending(list: PendingReminder[]) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(0, MAX_PENDING)));
  } catch {
    // ignore
  }
  pendingListeners.forEach(cb => cb());
}

function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.tudu;
}

function loadFired(): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    if (raw) return new Set<string>(JSON.parse(raw));
  } catch {
    // ignore
  }
  return new Set<string>();
}

function saveFired(set: Set<string>) {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

function sendNotification(title: string, body: string) {
  if (isElectron()) {
    try {
      window.tudu!.notify(title, body);
      return;
    } catch {
      // cai no fallback web
    }
  }
  // Fallback para navegador (dev fora do Electron)
  if (typeof Notification !== 'undefined') {
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(p => {
        if (p === 'granted') new Notification(title, { body });
      });
    }
  }
}

/**
 * Avalia um evento agendado. Se já passou da hora e ainda não disparou:
 * dispara a notificação (se dentro da janela de catch-up) e marca como disparado.
 * Devolve 'sent' quando notificou, 'silent' quando só marcou (catch-up de
 * evento antigo) e null quando não fez nada.
 */
function maybeFire(fired: Set<string>, key: string, eventTime: number, now: number, title: string, body: string): 'sent' | 'silent' | null {
  if (fired.has(key)) return null;
  const diff = now - eventTime;
  if (diff < 0) return null; // ainda não chegou a hora
  // Marca como disparado mesmo fora da janela (catch-up silencioso)
  fired.add(key);
  if (diff <= GRACE_MS) {
    sendNotification(title, body);
    return 'sent';
  }
  return 'silent';
}

function tick() {
  const now = Date.now();
  const fired = loadFired();
  let changed = false;
  const novos: PendingReminder[] = [];

  for (const t of currentTasks) {
    if (!t.notificationsEnabled || !t.dueDate || t.completed || t.archived) continue;

    const due = parseISO(t.dueDate).getTime();
    if (Number.isNaN(due)) continue;

    const reminderMinutes = t.reminderMinutes ?? DEFAULT_REMINDER_MINUTES;
    const reminderTime = due - reminderMinutes * 60 * 1000;
    const horario = format(parseISO(t.dueDate), 'dd/MM · HH:mm');

    // Lembrete antecipado. Na ilha ele é o "próximo compromisso", não um
    // lembrete pendente: ainda não venceu nada.
    changed = maybeFire(
      fired,
      `${t.id}:reminder:${t.dueDate}`,
      reminderTime,
      now,
      `Lembrete: ${t.title}`,
      `Vence em ${reminderMinutes} min (${horario}).`
    ) !== null || changed;

    // Na hora exata do deadline
    const dueKey = `${t.id}:due:${t.dueDate}`;
    const noPrazo = maybeFire(
      fired,
      dueKey,
      due,
      now,
      `Prazo agora: ${t.title}`,
      `A tarefa vence agora (${horario}).`
    );
    changed = noPrazo !== null || changed;
    // Só vira pendente o que de fato notificou: o catch-up silencioso de prazos
    // antigos não deve encher a ilha ao abrir o app.
    if (noPrazo === 'sent') {
      novos.push({ id: dueKey, taskId: t.id, title: t.title, urgency: t.urgency, firedAt: now });
    }
  }

  if (changed) saveFired(fired);
  updatePending(novos);
}

/**
 * Junta os recém-vencidos à lista e tira os que não fazem mais sentido. A
 * limpeza só acontece com tarefas carregadas: na abertura o app passa por um
 * instante com a lista vazia, e isso não pode apagar os pendentes.
 */
function updatePending(novos: PendingReminder[]) {
  const atual = loadPending();
  let lista = atual;
  if (currentTasks.length > 0) {
    const porId = new Map(currentTasks.map(t => [t.id, t]));
    lista = atual.filter(p => stillPending(p, porId.get(p.taskId)));
  }
  const ids = new Set(lista.map(p => p.id));
  for (const n of novos) if (!ids.has(n.id)) lista = [n, ...lista];
  if (lista.length !== atual.length || lista.some((p, i) => p.id !== atual[i]?.id)) {
    savePending(lista);
  }
}

export const notificationService = {
  /** Atualiza a lista de tarefas monitoradas pelo agendador. */
  setTasks(tasks: Task[]) {
    currentTasks = tasks;
  },

  /** Inicia o agendador (idempotente). */
  start() {
    if (intervalId !== null) return;
    tick(); // avalia imediatamente ao abrir
    intervalId = setInterval(tick, TICK_MS);
  },

  stop() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  },

  /** Lembretes vencidos e não resolvidos, do mais novo para o mais antigo. */
  getPending(): PendingReminder[] {
    return loadPending();
  },

  /**
   * Adia um lembrete pendente pela ilha. Não mexe no prazo da tarefa: o
   * lembrete só some por `minutes` e volta como se tivesse acabado de vencer.
   */
  snooze(id: string, minutes = 10) {
    const lista = loadPending();
    const alvo = lista.find(p => p.id === id);
    if (!alvo) return;
    alvo.snoozedUntil = Date.now() + minutes * 60_000;
    savePending(lista);
  },

  /** Ouve mudanças na lista de pendentes. Devolve a função para parar. */
  onPendingChange(cb: () => void): () => void {
    pendingListeners.add(cb);
    return () => { pendingListeners.delete(cb); };
  },

  /** Dispara uma notificação avulsa (ex.: Pomodoro). */
  notify(title: string, body: string) {
    sendNotification(title, body);
  },

  /** Dispara uma notificação de teste imediata (usada na tela de Configurações). */
  test() {
    sendNotification('TuDu', 'Notificação de teste — está funcionando! 🔔');
  },

  /** Limpa o histórico de notificações já disparadas (usado ao resetar tarefas). */
  clearFired() {
    try {
      localStorage.removeItem(FIRED_KEY);
      localStorage.removeItem(PENDING_KEY);
    } catch { /* ignore */ }
    currentTasks = [];
    pendingListeners.forEach(cb => cb());
  }
};
