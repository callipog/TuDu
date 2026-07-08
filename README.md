<p align="center">
  <img src="https://github.com/callipog/TuDu/blob/main/public/icon.png" alt="Logo do TuDu" width="128px" height="128px">
</p>
<h1 align="center">TuDu</h1>

<p align="center"><a href="https://github.com/callipog/TuDu/releases" target="_blank"><img src="https://img.shields.io/github/v/release/callipog/TuDu" alt="Latest release" /></a> <a href="https://github.com/callipog/TuDu/releases" target="_blank"></a></p>

Um aplicativo **desktop** (Windows) de gerenciamento de tarefas moderno, com tema escuro, foco em produtividade e organização visual. Construído com Electron + React, roda de forma nativa, envia notificações do Windows e vive na bandeja do sistema.

## 🚀 Funcionalidades

### Tarefas
- **Quadro Kanban** com colunas Backlog → A Fazer → Em Andamento → Revisão → Finalizado (arraste e solte).
- **Criação, edição e detalhes**: crie e edite tarefas; clique para ver todos os atributos em modo somente-leitura, com um lápis para editar.
- **Níveis de criticidade** (Baixa, Média, Alta, Crítica) com indicadores de cor.
- **Data de entrega** exibida nos cards, com destaque de **Atrasado**.
- **Subtarefas / checklist** com barra de progresso.
- **Tarefas recorrentes** (diária, semanal, mensal): ao concluir, a próxima ocorrência é criada automaticamente.
- **Arquivamento**: arquive de uma vez as finalizadas e consulte-as numa tela dedicada em lista com filtros.

### 🔔 Notificações
- Sininho por tarefa e checkbox para ativar/desativar.
- **Popups nativos do Windows**: um lembrete antecipado (antecedência configurável por tarefa — de 10 min a 1 dia) e outro na hora exata do prazo.

### Visualizações
- **Caixa de Entrada**: quadro principal de tarefas.
- **Hoje**: tarefas com prazo para o dia atual.
- **Calendário**: grade mensal com painel do dia selecionado (estilo Google/Notion).
- **Agenda**: grade semanal ou diária com horários na lateral (estilo Teams/Meet) — clique num bloco para editar ou num espaço vazio para criar.
- **Lista**: todas as tarefas com seus dados e filtros.
- **Arquivados**: histórico das tarefas arquivadas.
- **Filtros** por texto, tag e criticidade; contador de tarefas **atrasadas** na barra lateral.

### Produtividade
- **Atalhos de teclado** (Nova tarefa, busca, navegação entre views) com guia acessível pelo header ou tecla `?`.
- **Gerenciador de tags**: crie tags e edite suas cores.
- **Mini calendário** semanal com atalho "Ir até hoje".

### Sistema (Configurações)
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
