import { Urgency } from '../types';
import { addDays, setHours, setMinutes, setSeconds, startOfDay, isBefore } from 'date-fns';

export interface ParsedQuickAdd {
  title: string;
  dueDate?: Date;
  tags: string[];
  urgency?: Urgency;
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0, dom: 0,
  segunda: 1, seg: 1,
  terca: 2, 'terça': 2, ter: 2,
  quarta: 3, qua: 3,
  quinta: 4, qui: 4,
  sexta: 5, sex: 5,
  sabado: 6, 'sábado': 6, sab: 6, 'sáb': 6,
};

const URGENCY: Record<string, Urgency> = {
  baixa: 'low', low: 'low',
  media: 'medium', 'média': 'medium', med: 'medium', medium: 'medium',
  alta: 'high', high: 'high',
  critica: 'critical', 'crítica': 'critical', crit: 'critical', critical: 'critical',
};

function nextWeekday(from: Date, target: number): Date {
  const cur = from.getDay();
  const diff = (target - cur + 7) % 7; // 0 = hoje
  return addDays(startOfDay(from), diff);
}

/**
 * Interpreta uma entrada em linguagem natural, ex.:
 *   "pagar boleto amanhã 14h #casa !alta"
 * Reconhece: hoje/amanhã, dias da semana (seg..dom), HH:mm / HHh, #tag, !urgência.
 */
export function parseQuickAdd(input: string): ParsedQuickAdd {
  const now = new Date();
  let dayBase: Date | null = null;
  let time: { h: number; m: number } | null = null;
  const tags: string[] = [];
  let urgency: Urgency | undefined;

  const strip = (re: RegExp) => { title = title.replace(re, ' '); };
  let title = ` ${input} `;

  // #tags
  title.replace(/#([\p{L}\d_-]+)/gu, (_m, tag) => { tags.push(tag); return _m; });
  strip(/#([\p{L}\d_-]+)/gu);

  // !urgência
  title.replace(/!([\p{L}]+)/gu, (_m, u) => {
    const key = u.toLowerCase();
    if (URGENCY[key]) urgency = URGENCY[key];
    return _m;
  });
  strip(/!([\p{L}]+)/gu);

  // datas relativas
  if (/\bhoje\b/i.test(title)) { dayBase = startOfDay(now); strip(/\bhoje\b/i); }
  else if (/\b(amanh[ãa])\b/i.test(title)) { dayBase = addDays(startOfDay(now), 1); strip(/\b(amanh[ãa])\b/i); }
  else {
    for (const [word, target] of Object.entries(WEEKDAYS)) {
      const re = new RegExp(`\\b${word}\\b`, 'iu');
      if (re.test(title)) { dayBase = nextWeekday(now, target); strip(re); break; }
    }
  }

  // horário: "14:30", "14h", "14h30", "9:5" -> normaliza
  const timeMatch = title.match(/\b(\d{1,2})(?::(\d{2})|h(\d{2})?)\b/i);
  if (timeMatch) {
    const h = parseInt(timeMatch[1], 10);
    const m = parseInt(timeMatch[2] || timeMatch[3] || '0', 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      time = { h, m };
      title = title.replace(timeMatch[0], ' ');
    }
  }

  // monta a data final
  let dueDate: Date | undefined;
  if (dayBase || time) {
    let d = dayBase ?? startOfDay(now);
    d = setSeconds(setMinutes(setHours(d, time?.h ?? 9), time?.m ?? 0), 0);
    // Só-horário no passado hoje -> joga para amanhã.
    if (!dayBase && time && isBefore(d, now)) d = addDays(d, 1);
    dueDate = d;
  }

  title = title.replace(/\s+/g, ' ').trim();
  return { title, dueDate, tags, urgency };
}
