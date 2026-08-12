import React, { useMemo } from 'react';
import { Task, Epic } from '../types';
import { StatusColor } from '../services/boards';
import { tagService } from '../services/tags';
import {
  parseISO, startOfDay, addDays, eachDayOfInterval, differenceInCalendarDays,
  format, isToday, getISOWeek
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface GanttViewProps {
  tasks: Task[];
  /** Épicos do projeto (já ordenados). Quando há épicos, a tabela é agrupada. */
  epics?: Epic[];
  statusLabel: (task: Task) => string;
  statusColor: (task: Task) => StatusColor;
  onSelect: (task: Task) => void;
}

const DAY_W = 34;
const ROW_H = 44;
const GROUP_H = 38; // linha de cabeçalho do épico
const HEADER_H = 88; // 4 linhas: mês / semana / dia / dia-da-semana
const GRID = '44px 210px 92px 92px 116px 96px';
const LEFT_W = 44 + 210 + 92 + 92 + 116 + 96;

const urgencyDot: Record<Task['urgency'], string> = {
  low: 'bg-emerald-500', medium: 'bg-amber-500', high: 'bg-orange-500', critical: 'bg-rose-500',
};
const urgencyLabel: Record<Task['urgency'], string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica',
};

/** Linha da tabela: cabeçalho de épico ou tarefa. */
type GanttRow =
  | { kind: 'group'; id: string; name: string; color: string; itens: Task[]; temas: string[] }
  | { kind: 'task'; id: string; task: Task; n: number };

export function GanttView({ tasks, epics, statusLabel, statusColor, onSelect }: GanttViewProps) {
  // Sem épicos, a tabela é uma lista simples (como antes). Com épicos, as
  // tarefas ficam sob um cabeçalho com o nome do épico e seus temas (tags).
  const rows = useMemo<GanttRow[]>(() => {
    const byDate = (a: Task, b: Task) =>
      (a.startDate || a.dueDate || '').localeCompare(b.startDate || b.dueDate || '');
    const sorted = tasks.slice().sort(byDate);
    const list = epics ?? [];
    const agrupar = list.length > 0 && sorted.some(t => t.epicId && list.some(e => e.id === t.epicId));
    if (!agrupar) return sorted.map((task, i) => ({ kind: 'task', id: task.id, task, n: i + 1 }));

    const baldes = [
      ...list.map(e => ({
        id: e.id,
        name: e.name,
        color: e.color || 'bg-zinc-500',
        itens: sorted.filter(t => t.epicId === e.id),
      })),
      {
        id: '__sem_epico__',
        name: 'Sem épico',
        color: 'bg-zinc-600',
        itens: sorted.filter(t => !t.epicId || !list.some(e => e.id === t.epicId)),
      },
    ].filter(b => b.itens.length > 0);

    const out: GanttRow[] = [];
    let n = 0;
    baldes.forEach(b => {
      const temas = [...new Set(b.itens.flatMap(t => t.tags))].sort();
      out.push({ kind: 'group', id: b.id, name: b.name, color: b.color, itens: b.itens, temas });
      b.itens.forEach(task => out.push({ kind: 'task', id: task.id, task, n: ++n }));
    });
    return out;
  }, [tasks, epics]);

  const { days, rangeStart } = useMemo(() => {
    const ds: Date[] = [];
    tasks.forEach(t => {
      if (t.startDate) ds.push(parseISO(t.startDate));
      if (t.dueDate) ds.push(parseISO(t.dueDate));
    });
    let min = ds.length ? new Date(Math.min(...ds.map(d => d.getTime()))) : new Date();
    let max = ds.length ? new Date(Math.max(...ds.map(d => d.getTime()))) : new Date();
    min = addDays(startOfDay(min), -2);
    max = addDays(startOfDay(max), 4);
    if (differenceInCalendarDays(max, min) < 20) max = addDays(min, 20);
    return { days: eachDayOfInterval({ start: min, end: max }), rangeStart: min };
  }, [tasks]);

  // Segmentos de mês para o cabeçalho (linha 1), agrupando dias do mesmo mês.
  const monthSegments = useMemo(() => {
    const segs: { label: string; count: number }[] = [];
    days.forEach(d => {
      const label = format(d, 'MMM yyyy', { locale: ptBR });
      const last = segs[segs.length - 1];
      if (last && last.label === label) last.count++;
      else segs.push({ label, count: 1 });
    });
    return segs;
  }, [days]);

  // Segmentos de semana (número ISO) para o cabeçalho (linha 2).
  const weekSegments = useMemo(() => {
    const segs: { label: string; count: number }[] = [];
    days.forEach(d => {
      const label = `S${getISOWeek(d)}`;
      const last = segs[segs.length - 1];
      if (last && last.label === label) last.count++;
      else segs.push({ label, count: 1 });
    });
    return segs;
  }, [days]);

  const spanOf = (t: Task): [Date, Date] | null => {
    const s = t.startDate ? startOfDay(parseISO(t.startDate)) : (t.dueDate ? startOfDay(parseISO(t.dueDate)) : null);
    const e = t.dueDate ? startOfDay(parseISO(t.dueDate)) : (t.startDate ? startOfDay(parseISO(t.startDate)) : null);
    return s && e ? [s, e] : null;
  };

  const bar = (s: Date, e: Date) => ({
    left: differenceInCalendarDays(s, rangeStart) * DAY_W,
    width: Math.max(1, differenceInCalendarDays(e, s) + 1) * DAY_W,
  });

  const barFor = (t: Task) => {
    const span = spanOf(t);
    return span ? bar(span[0], span[1]) : null;
  };

  // Barra "guarda-chuva" do épico: do início mais cedo ao término mais tarde.
  const barForGroup = (itens: Task[]) => {
    const spans = itens.map(spanOf).filter(Boolean) as [Date, Date][];
    if (spans.length === 0) return null;
    const s = new Date(Math.min(...spans.map(([a]) => a.getTime())));
    const e = new Date(Math.max(...spans.map(([, b]) => b.getTime())));
    return bar(s, e);
  };

  const timelineWidth = days.length * DAY_W;
  const cellHead = 'flex items-center px-2 text-[10px] uppercase font-bold tracking-wider text-zinc-500';

  if (tasks.length === 0) {
    return <p className="text-sm text-zinc-500 italic py-10 text-center">Nenhuma tarefa neste projeto para exibir no Gantt.</p>;
  }

  return (
    <div className="h-full min-h-0 overflow-auto custom-scrollbar rounded-2xl border border-white/10">
      <div className="inline-flex min-w-full">
        {/* Tabela (esquerda) */}
        <div className="sticky left-0 z-20 shrink-0 bg-[#0e0e10] border-r border-white/10" style={{ width: LEFT_W }}>
          <div className="grid sticky top-0 z-10 bg-[#0e0e10] border-b border-white/10" style={{ gridTemplateColumns: GRID, height: HEADER_H }}>
            <span className={cellHead}>ID</span>
            <span className={cellHead}>Atividade</span>
            <span className={cellHead}>Início</span>
            <span className={cellHead}>Término</span>
            <span className={cellHead}>Situação</span>
            <span className={cellHead}>Criticidade</span>
          </div>
          {rows.map(row => {
            if (row.kind === 'group') {
              const done = row.itens.filter(t => t.completed).length;
              return (
                <div
                  key={`g-${row.id}`}
                  className="flex items-center gap-2 px-3 bg-white/[0.05] border-b border-white/10"
                  style={{ height: GROUP_H }}
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${row.color}`}></span>
                  <span className="text-xs font-bold text-white truncate max-w-[190px]" title={row.name}>{row.name}</span>
                  <span className="text-[10px] font-semibold text-zinc-400 bg-white/10 px-1.5 py-0.5 rounded-full shrink-0">
                    {done}/{row.itens.length}
                  </span>
                  {row.temas.length > 0 && (
                    <div className="flex items-center gap-1 overflow-hidden" title={`Temas: ${row.temas.join(', ')}`}>
                      {row.temas.slice(0, 4).map(tema => (
                        <span key={tema} className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-zinc-300 bg-white/5 border border-white/10 rounded whitespace-nowrap">
                          <span className={`w-1.5 h-1.5 rounded-full ${tagService.getTagColor(tema)}`}></span>
                          {tema}
                        </span>
                      ))}
                      {row.temas.length > 4 && (
                        <span className="text-[10px] text-zinc-500 shrink-0">+{row.temas.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            const t = row.task;
            return (
              <div
                key={t.id}
                onClick={() => onSelect(t)}
                className="grid items-center border-b border-white/5 hover:bg-white/[0.03] cursor-pointer"
                style={{ gridTemplateColumns: GRID, height: ROW_H }}
              >
                <span className="px-2 text-[11px] font-mono text-zinc-600">{row.n}</span>
                <span className={`px-2 text-sm truncate ${t.completed ? 'line-through text-zinc-500' : 'text-white'}`}>{t.title}</span>
                <span className="px-2 text-xs text-zinc-400">{t.startDate ? format(parseISO(t.startDate), 'dd/MM/yy') : '—'}</span>
                <span className="px-2 text-xs text-zinc-400">{t.dueDate ? format(parseISO(t.dueDate), 'dd/MM/yy') : '—'}</span>
                <span className="px-2 flex items-center gap-1.5 text-xs text-zinc-400 truncate">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor(t).dot}`}></span>
                  <span className="truncate">{statusLabel(t)}</span>
                </span>
                <span className="px-2 flex items-center gap-1.5 text-xs text-zinc-400">
                  <span className={`w-2 h-2 rounded-full ${urgencyDot[t.urgency]}`}></span>{urgencyLabel[t.urgency]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Timeline (direita) */}
        <div className="relative" style={{ width: timelineWidth }}>
          {/* Cabeçalho: mês / semana / dia / dia-da-semana */}
          <div className="sticky top-0 z-10 bg-[#0e0e10] border-b border-white/10" style={{ height: HEADER_H }}>
            <div className="flex" style={{ height: HEADER_H / 4 }}>
              {monthSegments.map((m, idx) => (
                <div key={idx} className="flex items-center justify-center text-[10px] font-bold uppercase tracking-wider text-zinc-400 border-r border-white/10 capitalize overflow-hidden" style={{ width: m.count * DAY_W }}>
                  {m.label}
                </div>
              ))}
            </div>
            <div className="flex" style={{ height: HEADER_H / 4 }}>
              {weekSegments.map((w, idx) => (
                <div key={idx} className="flex items-center justify-center text-[10px] font-semibold text-indigo-300/80 border-r border-white/10 overflow-hidden" style={{ width: w.count * DAY_W }} title={`Semana ${w.label.slice(1)}`}>
                  {w.label}
                </div>
              ))}
            </div>
            <div className="flex" style={{ height: HEADER_H / 4 }}>
              {days.map((d, idx) => (
                <div key={idx} className={`flex items-center justify-center text-[10px] border-r border-white/5 ${isToday(d) ? 'bg-indigo-600 text-white font-bold' : 'text-zinc-400'}`} style={{ width: DAY_W }}>
                  {format(d, 'd')}
                </div>
              ))}
            </div>
            <div className="flex" style={{ height: HEADER_H / 4 }}>
              {days.map((d, idx) => {
                const wd = d.getDay();
                const weekend = wd === 0 || wd === 6;
                return (
                  <div key={idx} className={`flex items-center justify-center text-[9px] uppercase border-r border-white/5 ${weekend ? 'text-zinc-600' : 'text-zinc-500'}`} style={{ width: DAY_W }}>
                    {format(d, 'EEEEE', { locale: ptBR })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Linhas com barras */}
          {rows.map(row => {
            const grid = `repeating-linear-gradient(to right, transparent, transparent ${DAY_W - 1}px, rgba(255,255,255,0.05) ${DAY_W - 1}px, rgba(255,255,255,0.05) ${DAY_W}px)`;

            if (row.kind === 'group') {
              const g = barForGroup(row.itens);
              return (
                <div
                  key={`g-${row.id}`}
                  className="relative bg-white/[0.05] border-b border-white/10"
                  style={{ height: GROUP_H, backgroundImage: grid }}
                >
                  {g && (
                    <div
                      title={`${row.name} · ${row.itens.length} tarefa(s)`}
                      className={`absolute top-1/2 -translate-y-1/2 h-2.5 rounded-full opacity-70 ${row.color}`}
                      style={{ left: g.left + 2, width: g.width - 4 }}
                    />
                  )}
                </div>
              );
            }

            const t = row.task;
            const b = barFor(t);
            return (
              <div
                key={t.id}
                onClick={() => onSelect(t)}
                className="relative border-b border-white/5 cursor-pointer hover:bg-white/[0.02]"
                style={{ height: ROW_H, backgroundImage: grid }}
              >
                {b && (
                  <div
                    title={`${t.title} · ${statusLabel(t)}`}
                    className={`absolute top-1/2 -translate-y-1/2 h-6 rounded-md flex items-center px-2 overflow-hidden shadow-sm ${statusColor(t).bar} ${t.completed ? 'opacity-50' : ''}`}
                    style={{ left: b.left + 2, width: b.width - 4 }}
                  >
                    <span className="text-[10px] font-medium text-white truncate">{t.title}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
