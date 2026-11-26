# TuDu 1.12.0

A maior versão da ilha até agora, duas formas novas de olhar uma tarefa e um
TuDu bem mais leve.

## Mais leve

O TuDu usa bem menos memória. Os ajudantes que conversam com o Windows (player,
Win+D e indicadores) eram scripts do PowerShell, e cada um ocupava cerca de
100 MB. Agora são um programinha nativo de 1 a 3 MB por tarefa. No total, o app
com a ilha caiu de cerca de 450 MB para cerca de 330 MB.

Quer economizar ainda mais? Em **Configurações › Comportamento › Desempenho**,
ligue **Economizar memória**. Ele desliga a aceleração de GPU e o TuDu cai para
cerca de 150 MB. A única diferença na tela: o fundo atrás das janelas (como as
Configurações) escurece em vez de desfocar. Vale depois de reiniciar o app, e
um botão faz isso por você.

## Painel lateral da tarefa

Passe o mouse num card e clique no ícone de expandir (ou use **Ver tudo** no
menu do card). Um painel abre ao lado do board com tudo da tarefa: o trilho de
etapas (um clique muda o status), subtarefas com progresso, descrição, anexos e
a atividade. O board continua à vista. As setas ↑ ↓ passam para a tarefa
vizinha da mesma coluna e Esc fecha.

## Fixe uma tarefa na área de trabalho

No painel lateral (📌) ou no menu do card, **Fixar na área de trabalho** cria um
card no estilo das notas autoadesivas do Windows. Dá para marcar subtarefas,
adicionar uma nova e concluir a tarefa ali mesmo, e tudo sincroniza com o app
na hora. O card lembra onde e como você o deixou: por cima das janelas ou não,
aberto ou recolhido só no título. Ele sobe junto com a ilha no Win+D e some
sozinho quando a tarefa é concluída.

## Ilha

As configurações da ilha ganharam abas: **Geral**, **Ilha**, **Foco** e **Água**.
A janela de Configurações também ficou um pouco maior.

- **Formato gota.** Além da pílula flutuante, a ilha pode ficar grudada na
  borda de cima ou de baixo do monitor, como parte dele. Parada, vira um fio
  fininho, ou fica sempre visível se você preferir.
- **Monitor.** Escolha em qual monitor ela mora. Com um jogo, vídeo ou
  apresentação em tela cheia no monitor dela, a ilha passa para outro e volta
  quando você sair.
- **Seções do seu jeito.** Qualquer seção pode ser desligada, inclusive a Hoje,
  e a ordem muda arrastando.
- **Indicadores.** Ao mexer no volume, no brilho, no microfone ou no Caps/Num
  Lock, a ilha mostra por um instante, no lugar do aviso do Windows.
- **Notificações de outros apps.** WhatsApp, Discord, e-mail e outros aparecem
  na ilha por alguns segundos, inclusive com o Não incomodar do Windows ligado.
  Dá para silenciar app por app, e o texto não é guardado. Vem desligado.
- **Água e levantar.** Lembretes de beber água (meta do dia, tamanho do copo,
  intervalo) e de levantar depois de muito tempo sentado. Eles esperam o bloco
  de foco acabar e não contam o tempo em que você estava longe do PC.
- **Pomodoro.** Pausa longa a cada N focos e som de fim de bloco à escolha.
- **Esconder quando parada.** Sem nada para mostrar, a ilha some depois de 1 a
  30 minutos e volta ao passar o mouse. Bom para telas OLED.
- **Tema e modo leve.** Tema próprio da ilha (claro, escuro ou o do Windows) e
  um modo leve, sem transparência nem animações.

## Pequenos acertos

- Todas as barras de rolagem do app têm o mesmo visual, inclusive no cadastro
  de tarefas.
- Uma palavra gigante numa subtarefa não empurra mais o layout: ela termina em
  reticências antes dos botões.

## Nos bastidores

O Controle Inteligente de Aplicativos do Windows 11 pode barrar programas sem
assinatura digital. Se ele barrar o ajudante nativo, o TuDu volta sozinho aos
scripts do PowerShell: fica mais pesado, mas nada para de funcionar.
