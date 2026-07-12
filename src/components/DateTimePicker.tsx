import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  format, parse, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, isToday, addMonths, isBefore, startOfDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarClock, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DateTimePickerProps {
  value: string;                 // 'yyyy-MM-ddTHH:mm' ou ''
  onChange: (value: string) => void;
  min?: string;
  placeholder?: string;
}

const FMT = "yyyy-MM-dd'T'HH:mm";
const POP_W = 280;
const POP_H = 380;

function parseVal(v: string): Date | null {
  if (!v) return null;
  const d = parse(v, FMT, new Date());
  return isNaN(d.getTime()) ? null : d;
}

export function DateTimePicker({ value, onChange, min, placeholder = 'Selecionar data' }: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const selected = parseVal(value);
  const minDate = min ? parseVal(min) : null;
  const [viewMonth, setViewMonth] = useState<Date>(selected || new Date());

  const reposition = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow < POP_H && r.top > POP_H ? Math.max(8, r.top - POP_H - 6) : r.bottom + 6;
    const left = Math.min(r.left, window.innerWidth - POP_W - 8);
    setCoords({ top, left: Math.max(8, left) });
  };

  useLayoutEffect(() => {
    if (open) { setViewMonth(selected || new Date()); reposition(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!btnRef.current?.contains(e.target as Node) && !popRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onScroll); };
  }, [open]);

  const time = selected ? format(selected, 'HH:mm') : '00:00';
  const isMidnight = time === '00:00';

  const emit = (day: Date, hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(day);
    d.setHours(h || 0, m || 0, 0, 0);
    onChange(format(d, FMT));
  };
  const pickDay = (day: Date) => emit(day, time);
  const pickTime = (hhmm: string) => emit(selected || new Date(), hhmm || '00:00');

  const monthStart = startOfMonth(viewMonth);
  const days = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(endOfMonth(monthStart)) });
  const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const disabledDay = (d: Date) => minDate ? isBefore(startOfDay(d), startOfDay(minDate)) : false;

  const label = selected
    ? (isMidnight ? format(selected, 'dd/MM/yyyy', { locale: ptBR }) : format(selected, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }))
    : placeholder;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2 bg-[#18181b] border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors ${selected ? 'text-white' : 'text-zinc-500'} ${open ? 'border-indigo-500' : 'border-white/10'}`}
      >
        <CalendarClock size={15} className="text-zinc-500 shrink-0" />
        <span className="flex-1 text-left truncate">{label}</span>
        {selected && (
          <span onClick={(e) => { e.stopPropagation(); onChange(''); }} className="text-zinc-500 hover:text-rose-400 transition-colors" title="Limpar">
            <X size={14} />
          </span>
        )}
      </button>

      {open && createPortal(
        <div ref={popRef} style={{ position: 'fixed', top: coords.top, left: coords.left, width: POP_W }} className="z-[80] rounded-xl bg-[#0e0e10] border border-white/10 shadow-2xl p-3">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setViewMonth(addMonths(viewMonth, -1))} className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"><ChevronLeft size={16} /></button>
            <span className="text-sm font-semibold text-white capitalize">{format(viewMonth, 'MMMM yyyy', { locale: ptBR })}</span>
            <button type="button" onClick={() => setViewMonth(addMonths(viewMonth, 1))} className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {weekDays.map((w, i) => <span key={i} className="text-center text-[10px] text-zinc-600 font-bold py-1">{w}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {days.map(d => {
              const sel = selected && isSameDay(d, selected);
              const dim = !isSameMonth(d, monthStart);
              const dis = disabledDay(d);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  disabled={dis}
                  onClick={() => pickDay(d)}
                  className={`aspect-square flex items-center justify-center text-xs rounded-md transition-colors
                    ${dis ? 'text-zinc-700 cursor-not-allowed' : sel ? 'bg-indigo-600 text-white font-bold' : isToday(d) ? 'text-indigo-400 font-bold hover:bg-white/5' : `${dim ? 'text-zinc-600' : 'text-zinc-300'} hover:bg-white/5`}`}
                >
                  {format(d, 'd')}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
            <input
              type="time"
              value={time}
              onChange={(e) => pickTime(e.target.value)}
              className="flex-1 bg-[#18181b] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
            />
            <button type="button" onClick={() => pickTime('00:00')} className="text-[11px] text-zinc-400 hover:text-white px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors whitespace-nowrap">Sem horário</button>
          </div>
          <div className="flex justify-between mt-2">
            <button type="button" onClick={() => { const d = new Date(); emit(d, format(d, 'HH:mm')); setOpen(false); }} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Agora</button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1 rounded-md transition-colors">Ok</button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
