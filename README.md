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
- **Subtarefas / checklist** com barra de progresso.
- **Tarefas recorrentes**: diária, semanal, mensal, **a cada N dias** ou **dias específicos da semana**, com término opcional (nunca / após N ocorrências / em uma data).
- **Arquivamento** e **Lixeira** (recuperável; expurgo automático após 30 dias).

### 📁 Projetos & Equipe (visão gerencial, offline)
- **Projetos** com épicos, descrição, responsáveis, datas e **colunas de board customizáveis** por projeto.
- **Reordenação por arrasto**: épicos e etapas do board se reorganizam pelo punho (⋮⋮), com os itens deslizando para a nova posição. As etapas também podem ser arrastadas direto no cabeçalho das colunas do Kanban.
- **Board com muitas etapas**: rolagem horizontal com barra visível, setas nas bordas, roda do mouse na horizontal e rolagem automática ao arrastar um card até a borda.
- **Tela de gerenciamento** de projetos (lista + detalhe) com **README em Markdown** (importe um `.md`) e arquivos anexos.
- **Visão Gantt** por projeto: tabela (ID, atividade, início, término, situação, criticidade) + timeline com mês, **número da semana**, dia e dia-da-semana.
- **Personas** (nome, cargo, cor) atribuíveis às tarefas, com **avatar** nos cards.
- **Visão Equipe**: carga de trabalho e desempenho por pessoa.

### 🔔 Notificações
- Sininho por tarefa e checkbox para ativar/desativar.
- **Popups nativos do Windows**: um lembrete antecipado (antecedência configurável por tarefa — de 10 min a 1 dia) e outro na hora exata do prazo.

### Visualizações
- **Caixa de Entrada**: quadro principal de tarefas.
- **Hoje**: tarefas com prazo para o dia atual.
- **Calendário**: grade mensal com painel do dia selecionado (estilo Google/Notion).
- **Agenda**: grade semanal ou diária com horários na lateral (estilo Teams/Meet) — clique num bloco para editar ou num espaço vazio para criar.
- **Lista**: todas as tarefas com seus dados, **ordenação por coluna** (título, status, criticidade, prazo) e **filtros salvos**.
- **Relatórios**: KPIs e gráficos (concluídas por semana, pendentes por criticidade, tarefas por tag).
- **Arquivados**: histórico das tarefas arquivadas, com seleção em massa.
- **Filtros** por texto, tag e criticidade; contador de tarefas **atrasadas** na barra lateral.

### Produtividade
- **Command Palette** (`Ctrl/Cmd + K`): busque ações e tarefas, e **crie tarefas em linguagem natural** ("pagar boleto amanhã 14h #casa !alta").
- **Timer de foco (Pomodoro)** com ciclos de foco/pausa e notificação ao terminar.
- **Atalhos de teclado** com guia acessível pelo header ou tecla `?`; menu do app no logo.
- **Gerenciador de tags**: crie tags e edite suas cores.
- **Mini calendário** semanal com atalho "Ir até hoje".

### Sistema (Configurações)
- **Tema** claro, escuro ou **sistema** (segue o Windows).
- **Iniciar com o Windows** e **Iniciar minimizado**.
- **Fechar para a bandeja** (opcional): o X esconde na bandeja ou fecha o app.
- **Bandeja do sistema** com menu (Abrir, Verificar atualizações, Sair).
- **Backup**: exporte e importe todos os dados em JSON; acesso rápido à pasta do banco de dados.
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
