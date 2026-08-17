import React, { useRef, useState } from 'react';
import { format, isToday, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

interface QuickCalendarProps {
  /** Semanas de distância da atual: 0 = esta semana, -1 = anterior. */
  offset: number;
  onOffsetChange: (offset: number) => void;
  /** Dia que está filtrando a Caixa de Entrada (null = sem filtro). */
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onClear: () => void;
  onHelp?: () => void;
}

/** Domingo da semana em `offset`, e os sete dias a partir dele. */
function semanaDe(offset: number): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + i + offset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  });
}

/**
 * Tira da semana do meio (quarta) o mês exibido: usar o domingo faria o rótulo
 * dizer "julho" numa semana em que seis dos sete dias são de agosto.
 */
function mesDaSemana(dias: Date[]): string {
  return format(dias[3], 'MMMM', { locale: ptBR });
}

export function QuickCalendar({ offset, onOffsetChange, selectedDate, onSelectDate, onClear, onHelp }: QuickCalendarProps) {
  const semMovimento = useReducedMotion();
  const dias = semanaDe(offset);
  const mes = mesDaSemana(dias);

  /**
   * Sentido do movimento, escrito no clique. Derivar do offset anterior durante
   * o render daria a direção errada no primeiro quadro — que é justamente o
   * quadro em que a animação começa.
   */
  const dirRef = useRef(0);
  const [pulso, setPulso] = useState(0);

  const irPara = (novo: number) => {
    dirRef.current = Math.sign(novo - offset);
    onOffsetChange(novo);
    if (novo === 0) setPulso(p => p + 1);
  };

  const dir = dirRef.current;
  const desloc = semMovimento ? 0 : 28;
  const semanaKey = format(dias[0], 'yyyy-MM-dd');
  const diasDaSemana = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  return (
    <div className="xl:w-80 shrink-0 bg-[#121214] border border-white/5 rounded-2xl p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        {/* Rolagem vertical do mês: os dois rótulos se movem juntos, por isso
            são absolutos, e o texto invisível dá largura à caixa. */}
        <div className="relative h-4 flex items-center overflow-hidden">
          <span aria-hidden className="invisible text-xs font-bold uppercase tracking-widest whitespace-nowrap">{mes}</span>
          <AnimatePresence initial={false}>
            <motion.h3
              key={mes}
              initial={semMovimento ? { opacity: 0 } : { y: dir === 0 ? 0 : dir * 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={semMovimento ? { opacity: 0 } : { y: dir === 0 ? 0 : dir * -16, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute left-0 text-xs font-bold text-zinc-500 uppercase tracking-widest whitespace-nowrap"
            >
              {mes}
            </motion.h3>
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-1">
          {offset !== 0 && (
            <button
              onClick={() => irPara(0)}
              className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded hover:bg-white/5 transition-colors"
              title="Voltar para a semana atual"
            >
              Ir até hoje
            </button>
          )}
          {onHelp && (
            <button
              onClick={onHelp}
              title="Como usar este calendário"
              className="p-1 rounded text-zinc-600 hover:text-white hover:bg-white/5 transition-colors"
            >
              <HelpCircle size={13} />
            </button>
          )}
          <button
            onClick={() => irPara(offset - 1)}
            title="Semana anterior"
            className="p-1 hover:bg-white/5 rounded text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={12} />
          </button>
          <button
            onClick={() => irPara(offset + 1)}
            title="Próxima semana"
            className="p-1 hover:bg-white/5 rounded text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-[10px] mb-2">
        {diasDaSemana.map((d, i) => (
          <span key={i} className={`text-zinc-600 ${i >= 5 ? 'font-bold' : ''}`}>{d}</span>
        ))}
      </div>

      {/* A faixa desliza no sentido da navegação. `overflow-hidden` recorta a
          entrada para ela não invadir as bordas do cartão. */}
      <div className="overflow-hidden -mx-1 px-1">
        <motion.div
          key={semanaKey}
          initial={{ x: dir * desloc, opacity: semMovimento ? 1 : 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="grid grid-cols-7 gap-1"
        >
          {dias.map((d, i) => {
            const hoje = isToday(d);
            const escolhido = selectedDate && isSameDay(d, selectedDate);
            return (
              <motion.button
                // Remontar no pulso refaz a animação do dia de hoje: é o retorno
                // visual de "Ir até hoje", que fora isso só troca a semana.
                key={hoje ? `hoje-${pulso}-${i}` : `dia-${i}`}
                onClick={() => onSelectDate(d)}
                title={format(d, "EEEE, d 'de' MMMM", { locale: ptBR })}
                initial={hoje && pulso > 0 && !semMovimento ? { scale: 0.7 } : false}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 520, damping: 16 }}
                className={`aspect-square flex items-center justify-center text-xs rounded-lg cursor-pointer transition-colors ${
                  hoje
                    ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/20'
                    : escolhido
                      ? 'bg-white/10 text-white font-bold border border-white/20'
                      : 'text-zinc-400 hover:bg-white/5'
                }`}
              >
                {format(d, 'd')}
              </motion.button>
            );
          })}
        </motion.div>
      </div>

      {selectedDate && (
        <button
          onClick={onClear}
          className="mt-4 text-xs text-indigo-400 hover:text-indigo-300 w-full text-center transition-colors"
        >
          Limpar filtro de data
        </button>
      )}
    </div>
  );
}
