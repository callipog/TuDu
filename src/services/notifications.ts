import { Task } from '../types';
import { format, parseISO } from 'date-fns';

const FIRED_KEY = 'tudu_fired_notifications';
// Janela de "catch-up": eventos que passaram há mais que isso ao abrir o app
// são marcados como disparados silenciosamente (evita spam de tarefas antigas).
const GRACE_MS = 6 * 60 * 60 * 1000;
const TICK_MS = 30 * 1000;
export const DEFAULT_REMINDER_MINUTES = 30;

let currentTasks: Task[] = [];
let intervalId: ReturnType<typeof setInterval> | null = null;

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
 * Retorna true se o conjunto `fired` foi alterado.
 */
function maybeFire(fired: Set<string>, key: string, eventTime: number, now: number, title: string, body: string): boolean {
  if (fired.has(key)) return false;
  const diff = now - eventTime;
  if (diff < 0) return false; // ainda não chegou a hora
  if (diff <= GRACE_MS) {
    sendNotification(title, body);
  }
  // Marca como disparado mesmo fora da janela (catch-up silencioso)
  fired.add(key);
  return true;
}

function tick() {
  const now = Date.now();
  const fired = loadFired();
  let changed = false;

  for (const t of currentTasks) {
    if (!t.notificationsEnabled || !t.dueDate || t.completed || t.archived) continue;

    const due = parseISO(t.dueDate).getTime();
    if (Number.isNaN(due)) continue;

    const reminderMinutes = t.reminderMinutes ?? DEFAULT_REMINDER_MINUTES;
    const reminderTime = due - reminderMinutes * 60 * 1000;
    const horario = format(parseISO(t.dueDate), 'dd/MM · HH:mm');

    // Lembrete antecipado
    changed = maybeFire(
      fired,
      `${t.id}:reminder:${t.dueDate}`,
      reminderTime,
      now,
      `Lembrete: ${t.title}`,
      `Vence em ${reminderMinutes} min (${horario}).`
    ) || changed;

    // Na hora exata do deadline
    changed = maybeFire(
      fired,
      `${t.id}:due:${t.dueDate}`,
      due,
      now,
      `Prazo agora: ${t.title}`,
      `A tarefa vence agora (${horario}).`
    ) || changed;
  }

  if (changed) saveFired(fired);
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
    try { localStorage.removeItem(FIRED_KEY); } catch { /* ignore */ }
    currentTasks = [];
  }
};
