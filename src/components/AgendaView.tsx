import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Task } from '../types';
import { startOfWeek, addDays, isSameDay, isToday, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type ViewMode = 'week' | 'day';

interface AgendaViewProps {
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onCreateAt: (date: Date, hour: number) => void;
}

const HOUR_HEIGHT = 52;
const BLOCK_MINUTES = 45;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const urgencyBlock: Record<Task['urgency'], string> = {
  low: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-100',
  medium: 'bg-amber-500/20 border-amber-500/40 text-amber-100',
  high: 'bg-orange-500/20 border-orange-500/40 text-orange-100',
  critical: 'bg-rose-500/20 border-rose-500/40 text-rose-100',
};

interface Placed { task: Task; start: number; lane: number; laneCount: number; }

function layoutDay(dayTasks: Task[]): Placed[] {
  const items = dayTasks
    .map(t => {
      const d = parseISO(t.dueDate!);
      return { task: t, start: d.getHours() * 60 + d.getMinutes() };
    })
    .sort((a, b) => a.start - b.start);

  const laneEnds: number[] = [];
  const withLane = items.map(it => {
    let lane = laneEnds.findIndex(end => end <= it.start);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
    laneEnds[lane] = it.start + BLOCK_MINUTES;
    return { ...it, lane };
  });
  const laneCount = Math.max(1, laneEnds.length);
  return withLane.map(it => ({ ...it, laneCount }));
}

export function AgendaView({ tasks, onEditTask, onCreateAt }: AgendaViewProps) {
  const [mode, setMode] = useState<ViewMode>('week');
  const [refDate, setRefDate] = useState<Date>(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => {
    if (mode === 'day') return [refDate];
    const start = startOfWeek(refDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [mode, refDate]);

  const tasksWithTime = useMemo(() => tasks.filter(t => t.dueDate), [tasks]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_HEIGHT;
  }, []);

  const step = mode === 'day' ? 1 : 7;
  const isCurrent = mode === 'day' ? isToday(refDate) : days.some(isToday);
  const rangeLabel = mode === 'day'
    ? format(refDate, "EEEE, d 'de' MMMM yyyy", { locale: ptBR })
    : `${format(days[0], 'd MMM', { locale: ptBR })} – ${format(days[6], 'd MMM yyyy', { locale: ptBR })}`;

  const handleColumnClick = (day: Date, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const hour = Math.max(0, Math.min(23, Math.floor(y / HOUR_HEIGHT)));
    onCreateAt(day, hour);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Navegação */}
      <div className="flex items-center justify-between mb-4 shrink-0 gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-white capitalize">{rangeLabel}</h3>
        <div className="flex items-center gap-3">
          {/* Toggle semana/dia */}
          <div className="flex bg-white/5 border border-white/10 rounded-lg p-0.5">
            {(['week', 'day'] as ViewMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${mode === m ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'}`}
              >
                {m === 'week' ? 'Semana' : 'Dia'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {!isCurrent && (
              <button onClick={() => setRefDate(new Date())} className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded hover:bg-white/5 transition-colors">
                Ir até hoje
              </button>
            )}
            <button onClick={() => setRefDate(d => addDays(d, -step))} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => setRefDate(d => addDays(d, step))} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Cabeçalho de dias */}
      <div className="flex shrink-0 border-b border-white/10 pb-2 pr-3">
        <div className="w-16 shrink-0" />
        {days.map(day => (
          <div key={day.toISOString()} className="flex-1 text-center">
            <p className="text-[10px] uppercase text-zinc-500 font-bold">{format(day, 'EEE', { locale: ptBR })}</p>
            <p className={`text-sm font-semibold mt-0.5 w-7 h-7 mx-auto flex items-center justify-center rounded-full ${isToday(day) ? 'bg-indigo-600 text-white' : 'text-zinc-300'}`}>
              {format(day, 'd')}
            </p>
          </div>
        ))}
      </div>

      {/* Grade de horários */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pb-4">
        <div className="flex" style={{ height: HOUR_HEIGHT * 24 }}>
          <div className="w-16 shrink-0 relative">
            {HOURS.map(h => (
              <div
                key={h}
                className={`absolute right-2 text-xs text-zinc-400 font-mono ${h === 0 ? 'translate-y-0' : '-translate-y-1/2'}`}
                style={{ top: h * HOUR_HEIGHT }}
              >
                {h.toString().padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {days.map(day => {
            const dayTasks = tasksWithTime.filter(t => isSameDay(parseISO(t.dueDate!), day));
            const placed = layoutDay(dayTasks);
            return (
              <div
                key={day.toISOString()}
                onClick={(e) => handleColumnClick(day, e)}
                className={`flex-1 relative border-l border-b border-white/5 cursor-copy ${isToday(day) ? 'bg-indigo-500/[0.03]' : ''}`}
              >
                {HOURS.map(h => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-white/5 hover:bg-white/[0.03] transition-colors duration-200"
                    style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                  />
                ))}
                {placed.map(p => {
                  const top = (p.start / 60) * HOUR_HEIGHT;
                  const height = (BLOCK_MINUTES / 60) * HOUR_HEIGHT - 3;
                  const widthPct = 100 / p.laneCount;
                  return (
                    <button
                      key={p.task.id}
                      onClick={(e) => { e.stopPropagation(); onEditTask(p.task); }}
                      title={`${p.task.title} — clique para editar`}
                      className={`absolute rounded-md border px-1.5 py-1 text-left overflow-hidden transition-all hover:brightness-125 hover:z-10 cursor-pointer ${urgencyBlock[p.task.urgency]} ${p.task.completed ? 'opacity-50 line-through' : ''}`}
                      style={{ top, height, left: `calc(${p.lane * widthPct}% + 2px)`, width: `calc(${widthPct}% - 4px)` }}
                    >
                      <p className="text-[11px] font-semibold leading-tight truncate">{p.task.title}</p>
                      <p className="text-[9px] font-mono opacity-80">{format(parseISO(p.task.dueDate!), 'HH:mm')}</p>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
