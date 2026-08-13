import React from 'react';
import { Modal } from './Modal';
import { Diamond, Link2, AlertTriangle, Check, X as XIcon } from 'lucide-react';

interface MilestoneHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function Passo({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="shrink-0 w-6 h-6 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[11px] font-bold flex items-center justify-center">
        {n}
      </span>
      <div className="min-w-0">
        <h4 className="text-sm font-semibold text-white">{titulo}</h4>
        <p className="text-xs text-zinc-400 mt-0.5">{children}</p>
      </div>
    </div>
  );
}

/** Nome de um controle da tela, para o texto casar com o que a pessoa vê. */
function Ui({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[11px] text-zinc-200 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">{children}</span>;
}

/**
 * Ajuda contextual do marco: abre pelo botão ao lado do próprio interruptor,
 * no formulário da tarefa — o momento em que a dúvida aparece.
 */
export function MilestoneHelpModal({ isOpen, onClose }: MilestoneHelpModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Marcos no cronograma" size="2xl">
      <div className="space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1">
        <p className="text-sm text-zinc-300">
          Um marco é uma <strong className="text-white">data que representa um acontecimento</strong> — a entrega,
          a virada de chave, a reunião que decide. Como ele não tem duração, no Gantt aparece
          como um losango em vez de barra.
        </p>

        {/* Desenho: duas barras ligadas ao losango, uma delas em conflito. */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <svg viewBox="0 0 420 132" className="w-full h-auto" role="img" aria-label="Duas tarefas ligadas por setas a um marco; uma das setas está tracejada, indicando conflito de datas">
            <defs>
              <marker id="ajuda-seta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            </defs>

            <g className="text-zinc-500" fill="currentColor" fontSize="10">
              <text x="0" y="24">Homologar</text>
              <text x="0" y="70">Treinar</text>
              <text x="0" y="116">Go-live</text>
            </g>

            <rect x="70" y="12" width="90" height="14" rx="4" className="text-indigo-500" fill="currentColor" />
            <rect x="96" y="58" width="130" height="14" rx="4" className="text-indigo-500" fill="currentColor" />
            <rect x="252" y="100" width="13" height="13" transform="rotate(45 258.5 106.5)" className="text-amber-400" fill="currentColor" />

            <path d="M160 19 H176 V106 H248" fill="none" strokeWidth="1.5" className="text-indigo-400" stroke="currentColor" markerEnd="url(#ajuda-seta)" />
            <path d="M226 65 H240 V90 H256 V98" fill="none" strokeWidth="1.5" strokeDasharray="4 3" className="text-rose-400" stroke="currentColor" markerEnd="url(#ajuda-seta)" />

            <text x="330" y="128" className="text-zinc-600" fill="currentColor" fontSize="9">tempo →</text>
          </svg>
          <p className="text-[11px] text-zinc-500 mt-2">
            A homologação termina antes do Go-live: seta índigo, tudo certo. O treinamento invade a
            data do marco: seta tracejada em vermelho.
          </p>
        </div>

        <div>
          <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-3">Como ativar</p>
          <div className="space-y-3">
            <Passo n={1} titulo="A tarefa precisa estar num projeto">
              O Gantt existe dentro do projeto. Sem projeto, a marcação é aceita, mas não há cronograma onde desenhá-la.
            </Passo>
            <Passo n={2} titulo="Na etapa Prazo, preencha só a entrega">
              Deixe <Ui>Início</Ui> vazio e coloque a data do acontecimento em <Ui>Entrega</Ui>.
            </Passo>
            <Passo n={3} titulo="Aqui nesta etapa, ligue o interruptor">
              É o <Ui>Marco do cronograma</Ui>, logo acima deste botão de ajuda.
            </Passo>
            <Passo n={4} titulo="Salve e abra o Gantt">
              Dentro do projeto, o botão <Ui>Gantt</Ui> fica ao lado de <Ui>Kanban</Ui>.
            </Passo>
          </div>
        </div>

        <div className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-100/90">
            Se a tarefa tiver <strong>início e entrega</strong> preenchidos, o losango aparece na data de
            <strong> início</strong>, não na de entrega — e é fácil achar que ele foi parar no lugar errado.
            Para um marco, deixe só a entrega, ou repita a mesma data nos dois campos.
          </p>
        </div>

        <div>
          <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-3">Lendo o Gantt</p>
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5 text-xs text-zinc-400">
              <Diamond size={13} className="shrink-0 text-amber-400 fill-amber-400" />
              <span><strong className="text-white">Losango âmbar</strong> — marco pendente. Fica verde quando você conclui a tarefa.</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-zinc-400">
              <Link2 size={13} className="shrink-0 text-indigo-400" />
              <span><strong className="text-white">Números na tabela</strong> — as linhas das tarefas das quais aquele item depende.</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-zinc-400">
              <span className="shrink-0 w-[13px] border-t-2 border-dashed border-rose-400"></span>
              <span><strong className="text-white">Seta tracejada</strong> — a tarefa seguinte começa antes de a anterior terminar. O mouse em cima mostra o par em conflito.</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400 mb-1">
              <Check size={14} /> Vale a pena
            </h4>
            <p className="text-xs text-zinc-400">
              Entrada em produção, entrega ao cliente, fim de fase, prazo legal, reunião de aprovação.
              Coisas que acontecem num instante e das quais outras dependem.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-rose-400 mb-1">
              <XIcon size={14} /> Não compensa
            </h4>
            <p className="text-xs text-zinc-400">
              Trabalho que leva tempo. "Escrever a documentação" tem duração e deve continuar barra —
              virar marco esconderia justamente o esforço dela.
            </p>
          </div>
        </div>

        <p className="text-[11px] text-zinc-500 border-t border-white/5 pt-4">
          O TuDu mostra o conflito, mas não reagenda nada sozinho: empurrar as datas continua sendo
          decisão sua. Caminho crítico e reagendamento automático não existem nesta versão.
        </p>
      </div>
    </Modal>
  );
}
