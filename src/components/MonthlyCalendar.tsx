import React, { useRef, useState } from 'react';
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
import { ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

interface MonthlyCalendarProps {
  currentDate: Date;
  onMonthChange: (date: Date) => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onSelectTask?: (task: Task) => void;
  tasks: Task[];
  /** Abre o manual da view. */
  onHelp?: () => void;
}

const chipColor = (task: Task) =>
  task.completed ? 'bg-emerald-500/15 text-emerald-400/80 line-through'
    : task.urgency === 'critical' ? 'bg-rose-500/20 text-rose-300'
    : task.urgency === 'high' ? 'bg-orange-500/20 text-orange-300'
    : task.urgency === 'medium' ? 'bg-amber-500/20 text-amber-300'
    : 'bg-white/10 text-zinc-300';

export function MonthlyCalendar({ currentDate, onMonthChange, selectedDate, onSelectDate, onSelectTask, tasks, onHelp }: MonthlyCalendarProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weeks = days.length / 7;
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const semMovimento = useReducedMotion();
  const monthKey = format(monthStart, 'yyyy-MM');

  /**
   * Sentido do movimento: -1 volta, 1 avança, 0 salto (o "Hoje").
   * Vem de um ref porque é escrito no clique, antes do re-render — derivar do
   * mês anterior dentro do render daria a direção errada no primeiro quadro.
   * Só este componente muda o mês, então o ref nunca fica dessincronizado.
   */
  const dirRef = useRef(0);

  // Incrementa a cada "Hoje" para reanimar o dia atual mesmo já estando no mês.
  const [pulso, setPulso] = useState(0);

  const irPara = (date: Date, dir: number) => {
    dirRef.current = dir;
    onMonthChange(date);
  };

  const goToday = () => {
    const now = new Date();
    const mesmoMes = isSameMonth(now, monthStart);
    dirRef.current = 0;
    if (!mesmoMes) onMonthChange(now);
    onSelectDate(now);
    // Sem troca de mês não há entrada de grade para assistir; o pulso no dia de
    // hoje é o que confirma que o clique fez algo.
    setPulso(p => p + 1);
  };

  const dir = dirRef.current;
  const desloc = semMovimento ? 0 : 26;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Cabeçalho do mês */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        {/* Rolagem vertical do nome do mês, no espírito de um seletor giratório.
            Os dois títulos se movem juntos (sem `mode="wait"`, que só montaria o
            novo depois da saída do antigo e deixaria o rótulo atrás da grade).
            Para isso eles são absolutos; o texto invisível abaixo é só o molde
            que dá largura à caixa, já que o nome do mês varia de tamanho. */}
        <div className="relative h-8 flex items-center overflow-hidden">
          <span aria-hidden className="invisible text-xl font-bold capitalize whitespace-nowrap">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <AnimatePresence initial={false}>
            <motion.h2
              key={monthKey}
              initial={semMovimento ? { opacity: 0 } : { y: dir === 0 ? 0 : dir * 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={semMovimento ? { opacity: 0 } : { y: dir === 0 ? 0 : dir * -30, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute left-0 right-0 text-xl font-bold text-white capitalize whitespace-nowrap"
            >
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </motion.h2>
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2">
          {onHelp && (
            <button
              onClick={onHelp}
              title="Como usar o calendário"
              className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
            >
              <HelpCircle size={16} />
            </button>
          )}
          <button onClick={goToday} className="text-xs font-semibold text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg transition-colors">
            Hoje
          </button>
          <button
            onClick={() => irPara(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1), -1)}
            title="Mês anterior"
            className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => irPara(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1), 1)}
            title="Próximo mês"
            className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
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

      {/* Grade de dias. A chave no mês remonta o bloco, e é isso que dispara a
          entrada deslizando — sem `exit`, para as grades não se sobreporem. */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <motion.div
          key={monthKey}
          initial={{ x: dir * desloc, opacity: semMovimento ? 1 : 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="grid grid-cols-7 h-full gap-1"
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
                <motion.span
                  // Remontar no pulso refaz a animação: é o retorno visual do "Hoje".
                  key={isTodayDate ? `hoje-${pulso}` : 'dia'}
                  initial={isTodayDate && pulso > 0 && !semMovimento ? { scale: 0.7 } : false}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 16 }}
                  className={`shrink-0 text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1
                    ${isTodayDate ? 'bg-indigo-600 text-white' : isSelected ? 'text-indigo-300' : 'text-zinc-400'}`}
                >
                  {format(day, 'd')}
                </motion.span>
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
        </motion.div>
      </div>
    </div>
  );
}
