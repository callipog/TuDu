# TuDu 1.10.0

Modo foco reformulado, Configurações reorganizadas e feedback visual nos calendários.

## Modo foco

O timer agora vive fora do painel. Ao fechar a janela, ele **continua contando numa
barrinha no topo do app** — dá para consultar uma subtarefa, abrir o projeto ou
navegar pelo board sem perder a sessão de vista. Um clique na barrinha traz o
painel de volta.

- **Cronômetro livre**, além do Pomodoro: conta pra cima e aponta o tempo real na tarefa.
- **Durações ajustáveis** — atalhos de 15/25/45/50 min e um seletor próprio para
  qualquer valor até 180.
- **Ciclos automáticos**: ao fechar o bloco, a pausa e o próximo começam sozinhos.
- **Avisos sonoros** curtos ao iniciar, pausar e concluir. Podem ser desligados.
- **"Concluir e apontar"**: encerra a sessão e lança o tempo na tarefa a qualquer
  momento, sem precisar esperar o bloco fechar.
- **Escolha de tarefa mais rica**: busca por tarefa ou projeto, com criticidade,
  progresso de subtarefas, estimativa e tempo já gasto.

O tempo passou a ser calculado por horário absoluto, não por um contador de
segundos. Na prática: o timer não atrasa mais quando a janela fica em segundo
plano ou a máquina suspende.

## Configurações

A tela virou **trilha lateral**: navegação à esquerda, conteúdo à direita, sem a
rolagem única que fazia cada opção nova afundar as anteriores. As nove seções
foram reagrupadas em seis, e a Zona de perigo ficou ancorada no rodapé — visível,
mas fora do caminho.

## Tarefas de projetos em todas as views

O botão que esconde as tarefas vinculadas a projetos agora vale também em
**Calendário, Agenda, Lista, Relatórios, Arquivados e Lixeira**. O contador ao
lado dele passou a refletir a view aberta.

## Calendários com resposta visual

Navegar entre períodos agora tem retorno: o nome do mês rola na vertical e a
grade desliza no sentido do movimento. Vale na view de **Calendário**, na **faixa
de semana** da Caixa de Entrada e na **Agenda**. O botão "Hoje" faz o dia atual
piscar — inclusive quando você já estava nele.

Duas telas ganharam **manual próprio**, pelo botão `?`: o Calendário e a faixa de
semana. Eles explicam o que cada clique faz e a diferença entre as duas.

## Correções

- **Arquivados**: o cabeçalho de mês ficava transparente ao passar o mouse e
  deixava o texto das tarefas vazar por trás.
- **Anexo de código**: a caixa de digitação usava a barra de rolagem padrão do
  sistema, destoando do app. O corretor ortográfico também parou de sublinhar
  código.
- **Faixa de semana**: em semanas que cruzam a virada do mês, o nome exibido
  vinha do domingo e podia mostrar o mês errado.
- Os campos numéricos perderam a setinha cinza padrão do Chromium.

## Atualização

Quem já usa o TuDu recebe a atualização automaticamente. Instalação nova:
baixe o `TuDu-Setup-1.10.0.exe` abaixo.
