import React from 'react';
import { GripVertical, CalendarCheck, Music, Timer, BellRing, ListPlus, Droplets } from 'lucide-react';
import { CheckRow } from './CheckRow';
import { useSortableList } from '../hooks/useSortableList';
import type { IslandConfig, IslandSectionId } from '../tudu-api';

type Toggleable = keyof IslandConfig['sections'];

const INFO: Record<IslandSectionId, { label: string; hint: string; icon: React.ReactNode }> = {
  hoje: { label: 'Hoje', hint: 'A próxima tarefa e o progresso do dia.', icon: <CalendarCheck size={15} /> },
  player: { label: 'Player', hint: 'O que estiver tocando no Spotify, YouTube ou outro player do Windows.', icon: <Music size={15} /> },
  foco: { label: 'Timer de foco', hint: 'O ciclo do Pomodoro rodando fora do app.', icon: <Timer size={15} /> },
  lembretes: { label: 'Lembretes', hint: 'Prazos vencidos com os botões de concluir e adiar.', icon: <BellRing size={15} /> },
  agua: { label: 'Água', hint: 'O copo do dia. Aparece quando o lembrete de água está ligado, na aba Água.', icon: <Droplets size={15} /> },
  captura: { label: 'Nova tarefa', hint: 'O campo de captura rápida dentro da ilha.', icon: <ListPlus size={15} /> },
};

/**
 * Seções da ilha: liga/desliga e a ordem das setas, arrastando pelo punho.
 * "Água" não tem caixinha aqui: ela segue o lembrete de água (aba Água).
 */
export function IslandSectionsList({ island, update, waterOn, onOpenAgua }: {
  island: IslandConfig | null;
  update: (patch: { sections?: Partial<IslandConfig['sections']>; order?: IslandSectionId[] }) => void;
  waterOn: boolean;
  onOpenAgua: () => void;
}) {
  const order = island?.order ?? (Object.keys(INFO) as IslandSectionId[]);
  const sort = useSortableList(order, (next) => update({ order: next as IslandSectionId[] }));
  const ligadas = order.filter(k => (k === 'agua' ? waterOn : island?.sections[k as Toggleable] !== false));

  return (
    <>
      <div ref={sort.containerRef} className="rounded-xl border border-white/10 bg-white/[0.02] pl-2 pr-4 divide-y divide-white/5">
        {order.map(id => {
          const info = INFO[id];
          return (
            <div key={id} {...sort.itemProps(id)} className={`flex items-center gap-1 ${sort.itemClass(id)}`}>
              <span
                {...sort.handleProps(id)}
                title="Arraste para mudar a ordem"
                className="drag-handle shrink-0 p-1 text-zinc-600 hover:text-zinc-300 cursor-grab active:cursor-grabbing"
              >
                <GripVertical size={14} />
              </span>
              <div className="flex-1 min-w-0">
                {id === 'agua' ? (
                  <div className="flex items-center gap-3 py-2">
                    <span className={`shrink-0 w-4 h-4 rounded border ${waterOn ? 'bg-indigo-500/50 border-indigo-500/50' : 'border-zinc-700'}`} />
                    <span className="text-zinc-400">{info.icon}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-white">{info.label}</span>
                      <span className="block text-[11px] text-zinc-500">{info.hint}</span>
                    </span>
                    <button type="button" onClick={onOpenAgua} className="shrink-0 text-[11px] font-semibold text-indigo-300 hover:text-indigo-200">
                      {waterOn ? 'Ajustar' : 'Ligar'}
                    </button>
                  </div>
                ) : (
                  <CheckRow
                    checked={island?.sections[id as Toggleable] !== false}
                    onChange={(v) => update({ sections: { [id]: v } as Partial<IslandConfig['sections']> })}
                    icon={info.icon}
                    label={info.label}
                    hint={info.hint}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-zinc-500 mt-2">
        Cada seção ligada vira um ponto embaixo da ilha, nesta ordem. Desligar também a tira da fila: ela nunca toma a linha fechada.
        {ligadas.length === 0 && ' Com tudo desligado, a Hoje volta sozinha — o painel nunca fica vazio.'}
      </p>
    </>
  );
}
