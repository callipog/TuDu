import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle, Plus, MousePointerClick, CalendarDays, FolderKanban } from 'lucide-react';

interface CalendarHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Nome de um controle da tela, para o texto casar com o que a pessoa vê. */
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

function Chip({ classe, rotulo, children }: { classe: string; rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`shrink-0 text-[10px] leading-tight px-1.5 py-0.5 rounded w-20 truncate ${classe}`}>{rotulo}</span>
      <span className="text-xs text-zinc-400">{children}</span>
    </div>
  );
}

/**
 * Manual da view de Calendário. Abre pelo "?" no cabeçalho da grade — a dúvida
 * que motivou este texto ("cliquei num dia, e daí?") nasce olhando para ela.
 */
export function CalendarHelpModal({ isOpen, onClose }: CalendarHelpModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Como usar o Calendário" size="2xl">
      <div className="space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1">
        <p className="text-sm text-zinc-300">
          O calendário responde a uma pergunta só: <strong className="text-white">o que vence em cada dia</strong>.
          A grade da esquerda é o mês inteiro; o painel da direita é o dia que você escolheu.
          Um alimenta o outro.
        </p>

        <div>
          <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-3">O que cada clique faz</p>
          <div className="space-y-3">
            <Acao icon={<MousePointerClick size={14} />} gesto="Clicar num dia">
              Seleciona o dia: a borda fica índigo e o painel da direita passa a listar as tarefas
              que vencem nele. Não abre nem cria nada — é só trocar o recorte.
            </Acao>
            <Acao icon={<MousePointerClick size={14} />} gesto="Clicar numa etiqueta dentro do dia">
              Abre a tarefa. Como a etiqueta está dentro do quadrado do dia, o clique nela
              <strong className="text-zinc-200"> não</strong> seleciona o dia — vai direto para a tarefa.
            </Acao>
            <Acao icon={<Plus size={14} />} gesto="Botão + no painel da direita">
              Cria uma tarefa já com a entrega marcada para o dia selecionado. É o caminho curto
              para agendar: escolha o dia na grade, depois clique no <Ui>+</Ui>.
            </Acao>
            <Acao icon={<CalendarDays size={14} />} gesto="Hoje, ‹ e ›">
              <Ui>‹</Ui> e <Ui>›</Ui> andam um mês por vez, e a grade desliza no sentido do movimento.
              <Ui>Hoje</Ui> volta para o mês atual e seleciona o dia de hoje, que pisca para confirmar
              — inclusive quando você já estava nele.
            </Acao>
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-3">Lendo as etiquetas</p>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2.5">
            <Chip classe="bg-rose-500/20 text-rose-300" rotulo="Crítica">Criticidade crítica.</Chip>
            <Chip classe="bg-orange-500/20 text-orange-300" rotulo="Alta">Criticidade alta.</Chip>
            <Chip classe="bg-amber-500/20 text-amber-300" rotulo="Média">Criticidade média.</Chip>
            <Chip classe="bg-white/10 text-zinc-300" rotulo="Baixa">Criticidade baixa.</Chip>
            <Chip classe="bg-emerald-500/15 text-emerald-400/80 line-through" rotulo="Concluída">
              Já concluída — verde e riscada.
            </Chip>
            <div className="flex items-center gap-2.5 pt-1 border-t border-white/5">
              <span className="shrink-0 text-[10px] text-zinc-500 font-medium w-20 px-1">+3</span>
              <span className="text-xs text-zinc-400">
                Cabem três etiquetas por dia. O resto vira esse contador — clique no dia para ver
                todas no painel da direita.
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-100/90">
            <strong>Só aparece aqui o que tem prazo.</strong> Tarefa sem data de entrega nunca é
            desenhada no calendário — não some, mas mora na Caixa de Entrada e na Lista. Se você
            procura uma tarefa e ela não está em dia nenhum, quase sempre é isso.
          </p>
        </div>

        <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
          <FolderKanban size={16} className="text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-xs text-zinc-400">
            O botão <Ui>Tarefas de projetos</Ui>, no topo, também vale aqui: desligado, ele tira da
            grade tudo que pertence a um projeto e deixa só as tarefas soltas.
          </p>
        </div>

        <p className="text-[11px] text-zinc-500 border-t border-white/5 pt-4">
          O calendário é de leitura e agendamento: ele mostra e marca datas. Para trabalhar a tarefa —
          mudar etapa, apontar tempo, arrastar entre colunas — o lugar é o board ou a view do projeto.
        </p>
      </div>
    </Modal>
  );
}
