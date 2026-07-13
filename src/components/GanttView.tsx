import React, { useMemo } from 'react';
import { Task } from '../types';
import { StatusColor } from '../services/boards';
import {
  parseISO, startOfDay, addDays, eachDayOfInterval, differenceInCalendarDays,
  format, isToday, getISOWeek
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface GanttViewProps {
  tasks: Task[];
  statusLabel: (task: Task) => string;
  statusColor: (task: Task) => StatusColor;
  onSelect: (task: Task) => void;
}

const DAY_W = 34;
const ROW_H = 44;
const HEADER_H = 88; // 4 linhas: mês / semana / dia / dia-da-semana
const GRID = '44px 210px 92px 92px 116px 96px';
const LEFT_W = 44 + 210 + 92 + 92 + 116 + 96;

const urgencyDot: Record<Task['urgency'], string> = {
  low: 'bg-emerald-500', medium: 'bg-amber-500', high: 'bg-orange-500', critical: 'bg-rose-500',
};
const urgencyLabel: Record<Task['urgency'], string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica',
};

export function GanttView({ tasks, statusLabel, statusColor, onSelect }: GanttViewProps) {
  const rows = useMemo(() => tasks.slice().sort((a, b) => {
    const as = a.startDate || a.dueDate || '';
    const bs = b.startDate || b.dueDate || '';
    return as.localeCompare(bs);
  }), [tasks]);

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

  const barFor = (t: Task) => {
    const s = t.startDate ? startOfDay(parseISO(t.startDate)) : (t.dueDate ? startOfDay(parseISO(t.dueDate)) : null);
    const e = t.dueDate ? startOfDay(parseISO(t.dueDate)) : (t.startDate ? startOfDay(parseISO(t.startDate)) : null);
    if (!s || !e) return null;
    const left = differenceInCalendarDays(s, rangeStart) * DAY_W;
    const width = Math.max(1, differenceInCalendarDays(e, s) + 1) * DAY_W;
    return { left, width };
  };

  const timelineWidth = days.length * DAY_W;
  const cellHead = 'flex items-center px-2 text-[10px] uppercase font-bold tracking-wider text-zinc-500';

  if (rows.length === 0) {
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
          {rows.map((t, i) => (
            <div
              key={t.id}
              onClick={() => onSelect(t)}
              className="grid items-center border-b border-white/5 hover:bg-white/[0.03] cursor-pointer"
              style={{ gridTemplateColumns: GRID, height: ROW_H }}
            >
              <span className="px-2 text-[11px] font-mono text-zinc-600">{i + 1}</span>
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
          ))}
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
          {rows.map(t => {
            const bar = barFor(t);
            return (
              <div
                key={t.id}
                onClick={() => onSelect(t)}
                className="relative border-b border-white/5 cursor-pointer hover:bg-white/[0.02]"
                style={{
                  height: ROW_H,
                  backgroundImage: `repeating-linear-gradient(to right, transparent, transparent ${DAY_W - 1}px, rgba(255,255,255,0.05) ${DAY_W - 1}px, rgba(255,255,255,0.05) ${DAY_W}px)`,
                }}
              >
                {bar && (
                  <div
                    title={`${t.title} · ${statusLabel(t)}`}
                    className={`absolute top-1/2 -translate-y-1/2 h-6 rounded-md flex items-center px-2 overflow-hidden shadow-sm ${statusColor(t).bar} ${t.completed ? 'opacity-50' : ''}`}
                    style={{ left: bar.left + 2, width: bar.width - 4 }}
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
