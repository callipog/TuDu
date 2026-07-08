import React from 'react';
import { Task } from '../types';
import {
  format,
  isToday,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthlyCalendarProps {
  currentDate: Date;
  onMonthChange: (date: Date) => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onSelectTask?: (task: Task) => void;
  tasks: Task[];
}

const chipColor = (task: Task) =>
  task.completed ? 'bg-emerald-500/15 text-emerald-400/80 line-through'
    : task.urgency === 'critical' ? 'bg-rose-500/20 text-rose-300'
    : task.urgency === 'high' ? 'bg-orange-500/20 text-orange-300'
    : task.urgency === 'medium' ? 'bg-amber-500/20 text-amber-300'
    : 'bg-white/10 text-zinc-300';

export function MonthlyCalendar({ currentDate, onMonthChange, selectedDate, onSelectDate, onSelectTask, tasks }: MonthlyCalendarProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weeks = days.length / 7;
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const goToday = () => {
    const now = new Date();
    onMonthChange(now);
    onSelectDate(now);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Cabeçalho do mês */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h2 className="text-xl font-bold text-white capitalize">
          {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={goToday} className="text-xs font-semibold text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg transition-colors">
            Hoje
          </button>
          <button onClick={() => onMonthChange(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => onMonthChange(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Dias da semana */}
      <div className="grid grid-cols-7 shrink-0 mb-1">
        {weekDays.map(day => (
          <div key={day} className="text-center text-[11px] font-semibold text-zinc-500 uppercase tracking-wider py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Grade de dias (preenche a altura) */}
      <div
        className="grid grid-cols-7 flex-1 min-h-0 gap-1"
        style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}
      >
        {days.map(day => {
          const isSelected = isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const dayTasks = tasks.filter(t => t.dueDate && isSameDay(parseISO(t.dueDate), day));

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={`flex flex-col text-left rounded-lg p-1.5 border transition-colors overflow-hidden min-h-0
                ${isSelected ? 'border-indigo-500/60 bg-indigo-500/10' : 'border-white/5 hover:bg-white/[0.03]'}
                ${isCurrentMonth ? '' : 'opacity-35'}`}
            >
              <span className={`shrink-0 text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1
                ${isTodayDate ? 'bg-indigo-600 text-white' : isSelected ? 'text-indigo-300' : 'text-zinc-400'}`}>
                {format(day, 'd')}
              </span>
              <div className="flex-1 min-h-0 space-y-0.5 overflow-hidden w-full">
                {dayTasks.slice(0, 3).map(task => (
                  <div
                    key={task.id}
                    onClick={(e) => { if (onSelectTask) { e.stopPropagation(); onSelectTask(task); } }}
                    className={`text-[10px] leading-tight truncate px-1.5 py-0.5 rounded ${chipColor(task)}`}
                  >
                    {task.title}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-[10px] text-zinc-500 font-medium px-1">+{dayTasks.length - 3}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
