import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle, MousePointerClick, CalendarRange, Filter } from 'lucide-react';

interface QuickCalendarHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function Ui({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[11px] text-zinc-200 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">{children}</span>;
}

function Acao({ icon, gesto, children }: { icon: React.ReactNode; gesto: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="shrink-0 w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 flex items-center justify-center">
        {icon}
      </span>
      <div className="min-w-0">
        <h4 className="text-sm font-semibold text-white">{gesto}</h4>
        <p className="text-xs text-zinc-400 mt-0.5">{children}</p>
      </div>
    </div>
  );
}

/**
 * Manual da faixa de semana da Caixa de Entrada. Abre pelo "?" no próprio
 * cartão. É um componente diferente do Calendário (a view de mês), e o texto
 * insiste nessa distinção porque os dois se parecem e fazem coisas opostas.
 */
export function QuickCalendarHelpModal({ isOpen, onClose }: QuickCalendarHelpModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="A faixa de semana" size="2xl">
      <div className="space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1">
        <p className="text-sm text-zinc-300">
          Esta faixa é um <strong className="text-white">filtro rápido</strong>, não um calendário de
          consulta. Ela mostra sete dias — de domingo a sábado — e serve para recortar o board da
          Caixa de Entrada em um dia específico, sem sair da tela.
        </p>

        <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-4 py-3">
          <p className="text-xs text-indigo-100/90">
            <strong>Não confunda com a view Calendário.</strong> Lá você <em>consulta</em> o mês
            inteiro e agenda tarefas. Aqui você <em>filtra</em> o que já está no board. São telas
            diferentes com desenhos parecidos.
          </p>
        </div>

        <div>
          <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-3">O que cada clique faz</p>
          <div className="space-y-3">
            <Acao icon={<MousePointerClick size={14} />} gesto="Clicar num dia">
              Filtra o board para aquele dia: ficam visíveis as tarefas que vencem nele
              <strong className="text-zinc-200"> mais todas as que não têm prazo</strong> — estas
              últimas aparecem sempre, para não sumirem do seu campo de visão.
            </Acao>
            <Acao icon={<CalendarRange size={14} />} gesto="‹ e ›">
              Andam uma <strong className="text-zinc-200">semana</strong> por vez, não um dia. A faixa
              desliza no sentido do movimento e o nome do mês rola junto.
            </Acao>
            <Acao icon={<CalendarRange size={14} />} gesto="Ir até hoje">
              Só aparece quando você saiu da semana atual. Traz a faixa de volta, e o dia de hoje
              pisca para confirmar. Ele <strong className="text-zinc-200">não</strong> mexe no filtro
              — se você estava filtrando um dia, continua filtrando.
            </Acao>
            <Acao icon={<Filter size={14} />} gesto="Limpar filtro de data">
              Aparece embaixo quando há um dia selecionado. Devolve o board completo.
            </Acao>
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-3">Lendo os dias</p>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="shrink-0 w-8 h-8 flex items-center justify-center text-xs rounded-lg bg-indigo-600 text-white font-bold">17</span>
              <span className="text-xs text-zinc-400">Hoje. Sempre índigo cheio, mesmo em outra semana.</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="shrink-0 w-8 h-8 flex items-center justify-center text-xs rounded-lg bg-white/10 text-white font-bold border border-white/20">19</span>
              <span className="text-xs text-zinc-400">Dia que está filtrando o board agora.</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="shrink-0 w-8 h-8 flex items-center justify-center text-xs rounded-lg text-zinc-400">21</span>
              <span className="text-xs text-zinc-400">Dia comum. O mês exibido no topo é o do meio da semana.</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-100/90">
            A faixa <strong>não mostra quantas tarefas</strong> existem em cada dia — ela é um seletor,
            não um resumo. Para ver a carga distribuída ao longo das semanas, o lugar é a view
            <Ui>Calendário</Ui>.
          </p>
        </div>

        <p className="text-[11px] text-zinc-500 border-t border-white/5 pt-4">
          O filtro vale para a Caixa de Entrada. Trocar de view pela barra lateral limpa o recorte,
          para você não continuar filtrando sem perceber.
        </p>
      </div>
    </Modal>
  );
}
