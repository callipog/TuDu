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
  tasks: Task[];
}

export function MonthlyCalendar({ currentDate, onMonthChange, selectedDate, onSelectDate, tasks }: MonthlyCalendarProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({
    start: startDate,
    end: endDate
  });

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const handlePrevMonth = () => {
    const prev = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    onMonthChange(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    onMonthChange(next);
  };

  return (
    <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white capitalize">
          {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={handlePrevMonth}
            className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button 
            onClick={handleNextMonth}
            className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-white/10 rounded-lg overflow-hidden border border-white/10">
        {weekDays.map(day => (
          <div key={day} className="bg-[#18181b] p-3 text-center text-xs font-semibold text-zinc-500">
            {day}
          </div>
        ))}

        {days.map((day, idx) => {
          const isSelected = isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);
          const isCurrentMonth = isSameMonth(day, monthStart);
          
          const dayTasks = tasks.filter(t => t.dueDate && isSameDay(parseISO(t.dueDate), day));
          const criticalTasks = dayTasks.filter(t => t.urgency === 'critical');
          const hasCompletedTasks = dayTasks.some(t => t.completed);
          
          return (
            <div 
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={`bg-[#09090b] min-h-[100px] p-2 border-t border-white/5 cursor-pointer transition-colors relative group
                ${isCurrentMonth ? 'hover:bg-white/[0.02]' : 'opacity-40'}
                ${isSelected ? 'bg-indigo-500/10' : ''}
              `}
            >
              <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1
                ${isTodayDate ? 'bg-indigo-600 text-white' : isSelected ? 'text-indigo-400' : 'text-zinc-400'}
              `}>
                {format(day, 'd')}
              </div>
              
              <div className="space-y-1 mt-2">
                {dayTasks.slice(0, 3).map(task => (
                  <div 
                    key={task.id}
                    className={`text-[10px] truncate px-1.5 py-0.5 rounded
                      ${task.completed ? 'bg-emerald-500/10 text-emerald-500/70 line-through' :
                        task.urgency === 'critical' ? 'bg-rose-500/20 text-rose-400' : 
                        task.urgency === 'high' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-white/10 text-zinc-300'}
                    `}
                  >
                    {task.title}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-[10px] text-zinc-500 font-medium px-1">
                    +{dayTasks.length - 3} tarefas
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
