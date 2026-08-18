<p align="center">
  <img src="https://github.com/callipog/TuDu/blob/main/public/icon.png" alt="Logo do TuDu" width="128px" height="128px">
</p>
<h1 align="center">TuDu</h1>

<p align="center"><a href="https://github.com/callipog/TuDu/releases" target="_blank"><img src="https://img.shields.io/github/v/release/callipog/TuDu" alt="Latest release" /></a> <a href="https://github.com/callipog/TuDu/releases" target="_blank"></a></p>

Um aplicativo **desktop** (Windows) de gerenciamento de tarefas moderno, com tema escuro, foco em produtividade e organização visual. Construído com Electron + React, roda de forma nativa, envia notificações do Windows e vive na bandeja do sistema.

## 🚀 Funcionalidades

### Tarefas
- **Quadro Kanban** com colunas Backlog → A Fazer → Em Andamento → Revisão → Finalizado; arraste entre colunas e **reordene dentro da própria coluna**.
- **Cadastro em etapas** (wizard): Detalhes → Prazo → Organização → Extras, com validações claras.
- **Datas de início e entrega** com **seletor de calendário moderno** (hora opcional; sem hora = 00:00) — a entrega nunca pode ser antes do início.
- **Níveis de criticidade** (Baixa, Média, Alta, Crítica) com indicadores de cor.
- **Anexos**: links, trechos de código, imagens e **arquivos** (pdf, etc.).
- **Subtarefas / checklist** com barra de progresso e **reordenação por arrasto**.
- **Estimativa e apontamento de tempo**: horas previstas na tarefa, blocos do Pomodoro lançados automaticamente, **lançamento manual ao finalizar** (h/min, como os comentários) e relatório de **previsto × realizado**.
- **Modelos**: salve uma tarefa (ou um projeto inteiro, com épicos e tarefas) como modelo e recrie em um clique, com os prazos recalculados a partir de hoje.
- **Carimbo de conclusão**: ao marcar como finalizada, a tarefa guarda a data e a hora — visíveis no card e nos detalhes.
- **Comentários de conclusão**: com a tarefa finalizada, os detalhes liberam um campo para registrar como foi a entrega (data/hora em cada comentário). Reabrir a tarefa preserva o histórico e volta a travar a escrita.
- **Tarefas recorrentes**: diária, semanal, mensal, **a cada N dias** ou **dias específicos da semana**, com término opcional (nunca / após N ocorrências / em uma data).
- **Arquivamento** e **Lixeira** (recuperável; expurgo automático após 30 dias).

### 📁 Projetos & Equipe (visão gerencial, offline)
- **Projetos** com épicos, descrição, responsáveis, datas e **colunas de board customizáveis** por projeto.
- **Reordenação por arrasto**: épicos e etapas do board se reorganizam pelo punho (⋮⋮), com os itens deslizando para a nova posição. As etapas também podem ser arrastadas direto no cabeçalho das colunas do Kanban.
- **Board com muitas etapas**: rolagem horizontal com barra visível, setas nas bordas, roda do mouse na horizontal e rolagem automática ao arrastar um card até a borda.
- **Tela de gerenciamento** de projetos (lista + detalhe) com **README em Markdown** (importe um `.md`) e arquivos anexos. A lista tem **frame redimensionável** (arraste o divisor) e **arraste horizontal** para ler nomes longos.
- **Exportar em PDF**: gera uma documentação completa do projeto (dados, progresso, épicos, **Gantt/cronograma**, README e tarefas) via "Salvar como PDF".
- **Visão Gantt** por projeto: tabela (ID, atividade, início, término, situação, criticidade) + timeline com mês, **número da semana**, dia e dia-da-semana. As tarefas ficam sob um **cabeçalho do épico** (progresso e os **temas/tags** daquele épico), com barra guarda-chuva do início ao término do épico na timeline.
- **Dependências e marcos** no Gantt: vínculo "termina para começar" desenhado com seta entre as barras (tracejada em vermelho quando a sucessora começa antes da anterior terminar) e marcos como losango. Um **"Como funciona"** ao lado do próprio interruptor abre a ajuda com o passo a passo e a leitura das cores.
- **Personas** (nome, cargo, cor) atribuíveis às tarefas, com **avatar** nos cards.
- **Visão Equipe**: carga de trabalho e desempenho por pessoa.

### 🤖 Agentes de IA (MCP)
- **Ponte local** (Configurações → Agentes de IA) para que assistentes criem projetos, épicos e tarefas por conversa — via [mcp-tudu](https://github.com/callipog/mcp-tudu), compatível com Claude Desktop, Claude Code e Gemini CLI.
- **Nada é gravado sem revisão**: o agente propõe, o app mostra o que será criado e você confirma.
- Porta apenas em `127.0.0.1`, protegida por token, e **desligada por padrão**.

### 🔔 Notificações
- Sininho por tarefa e checkbox para ativar/desativar.
- **Popups nativos do Windows**: um lembrete antecipado (antecedência configurável por tarefa — de 10 min a 1 dia) e outro na hora exata do prazo.

### Visualizações
- **Caixa de Entrada**: quadro principal de tarefas, com **faixa de semana** para filtrar por dia (manual pelo `?`).
- **Hoje**: tarefas com prazo para o dia atual.
- **Calendário**: grade mensal com painel do dia selecionado (estilo Google/Notion), navegação animada e manual pelo `?`.
- **Agenda**: grade semanal ou diária com horários na lateral (estilo Teams/Meet) — clique num bloco para editar ou num espaço vazio para criar.
- **Lista**: todas as tarefas com seus dados, **ordenação por coluna** (título, status, criticidade, prazo) e **filtros salvos**.
- **Relatórios**: KPIs e gráficos (concluídas por semana, pendentes por criticidade, tarefas por tag).
- **Arquivados**: histórico das tarefas arquivadas, com colunas de **finalização** e arquivamento, seleção em massa e filtros por criticidade, tag, **mês e ano** de arquivamento.
- **Tarefas de projetos**: botão no topo para **mostrar ou ocultar** o que pertence a projetos — vale em Caixa de Entrada, Hoje, Calendário, Agenda, Lista, Relatórios, Arquivados e Lixeira, e a escolha fica salva.
- **Filtros** por texto, tag e criticidade; contador de tarefas **atrasadas** na barra lateral.
- **Busca completa**: procura em título, descrição, tags, subtarefas, comentários, anexos, projeto, épico e responsável — cada palavra digitada precisa aparecer em algum desses campos. A caixa do topo ainda avisa quando o que você procura está nas **arquivadas** ou na **lixeira**.

### Produtividade
- **Command Palette** (`Ctrl/Cmd + K`): busque ações e tarefas, e **crie tarefas em linguagem natural** ("pagar boleto amanhã 14h #casa !alta").
- **Modo foco**: Pomodoro com durações ajustáveis ou **cronômetro livre**, apontando o tempo direto na tarefa. Tem **ciclos automáticos**, **avisos sonoros** e continua rodando numa **barrinha no topo** quando você fecha o painel — dá para usar o app sem perder a sessão.
- **Atalhos de teclado** com guia acessível pelo header ou tecla `?`; menu do app no logo.
- **Gerenciador de tags**: crie tags e edite suas cores, com **escopo global ou por projeto** — tag de projeto não polui o contexto dos outros.
- **Subtarefas no card**: clique no contador para abrir o checklist e marcar sem abrir a tarefa.
- **Menu do botão direito** sobre a tarefa: **quick add de subtarefa** (Enter cria e o menu segue aberto para encadear várias), além de ver, editar, concluir, comentar, **arquivar** (só nas finalizadas), salvar como modelo, lembretes e excluir.
- **Mini calendário** semanal com atalho "Ir até hoje", navegação animada e manual próprio.

### Sistema (Configurações)
- **Tema** claro, escuro, **sépia** ou **sistema** (segue o Windows).
- **Iniciar com o Windows** e **Iniciar minimizado**.
- **Fechar para a bandeja** (opcional): o X esconde na bandeja ou fecha o app.
- **Bandeja do sistema** com menu (Abrir, Verificar atualizações, Sair).
- **Captura rápida global**: `Ctrl+Shift+Espaço` (configurável) abre uma caixa por cima de qualquer programa para criar tarefa em linguagem natural, sem trazer a janela para frente.
- **Configurações em trilha lateral**: navegação por seções em vez de uma lista rolante única.
- **Backup automático**: uma cópia por dia na pasta que você escolher, com rotação das N últimas e restauração pela própria tela. Detecta **OneDrive** e **Google Drive** e oferece a pasta com um clique — o serviço de nuvem cuida de levar o arquivo para fora do PC.
- **Backup manual**: exporte e importe todos os dados em JSON (tarefas, tags, projetos, épicos, personas e modelos); acesso rápido à pasta do banco de dados.
- **Anexos em disco**: imagens e arquivos ficam em `userData/attachments` em vez de inchar o banco — anexos antigos são migrados sozinhos na primeira abertura.
- **Atualizações automáticas** via GitHub Releases (electron-updater).
- **Reportar bug** direto por e-mail e tela "Sobre" com versão e repositório.

## 🛠️ Tecnologias Utilizadas

- **Electron** — empacotamento desktop, notificações e bandeja
- **React** (Vite) + **TypeScript**
- **Tailwind CSS** para estilização responsiva
- **Dexie** (IndexedDB) para persistência local das tarefas
- **Lucide React** para ícones
- **Date-fns** para manipulação de datas
- **Motion (Framer Motion)** para animações
- **electron-updater** para atualizações automáticas

## 📦 Como rodar o projeto

1. Clone este repositório e instale as dependências:
   ```bash
   npm install
   ```
2. Rode o app desktop em desenvolvimento (Electron + Vite):
   ```bash
   npm run electron:dev
   ```
   > Para rodar apenas a interface web no navegador: `npm run dev` (`http://localhost:3000`).
3. Gere o instalador para Windows:
   ```bash
   npm run electron:build
   ```
   O instalador é gerado na pasta `dist-electron/`.

## 🎨 Design

O projeto adota uma filosofia "Dark Mode First", utilizando tons de zinco e contrastes coloridos (esmeralda, âmbar, rosa, índigo) para guiar a atenção do usuário aos elementos de prioridade e status das tarefas.
