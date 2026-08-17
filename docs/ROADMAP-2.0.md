# TuDu 2.0 — Notas de estratégia (mobile, monetização, nuvem)

> Discussão de 2026-08-17. Nada aqui foi decidido nem implementado — é material
> de apoio pra retomar depois. Estado do código na época: v1.9.1, ~10.6k linhas.

## 1. Diagnóstico do código atual

O app já é uma web app; Electron é só uma casca. Mobile é adaptação, não reescrita.

O modelo de dados está mais perto de sync do que o normal para um app local:

- ids são `string` (não autoincrement) → sem colisão entre dispositivos
- datas em ISO string
- **soft delete já existe** (`deleted` / `deletedAt`, `src/types.ts`) — tombstones
  são a parte mais chata de sync e já estão prontos
- `Persona` está documentada como "não é um usuário logado, é uma etiqueta rica"
  (`src/types.ts`) — é o ponto de enxerto natural do login

### Bloqueios técnicos identificados

| Bloqueio | Onde | Por quê |
|---|---|---|
| Nenhum registro tem `updatedAt` | `src/db.ts` | Sem isso não existe sync incremental. Mudança barata agora, cara depois. |
| `order: number` inteiro | `src/db.ts` (índice `order`) | Dois dispositivos reordenando = renumeração em massa e conflito. Precisa virar *fractional index* (string, ex. `"a0"`, `"a0V"`). |
| Anexo como dataURL / arquivo em disco | `src/types.ts` (`Attachment`) | Não sincroniza. Precisa de object storage + URL. |
| 8 arquivos acoplados a `window.tudu` | `App.tsx`, `services/{notifications,attachments,backup,settings,bridge}.ts`, `components/{SettingsModal,TitleBar}.tsx` | No mobile não existe. Precisa de camada `platform.ts` com implementação Electron / Web. |

Débito extra: `App.tsx` com 2059 linhas e `SettingsModal.tsx` com 693. Mexer em
sync com esse acoplamento vai doer.

Diferencial já existente e subaproveitado: **o servidor MCP do TuDu**
(`tudu_create_roadmap`, `tudu_add_tasks`, `tudu_list_projects`, `tudu_get_project`).

## 2. Mobile

Não portar o desktop. O TuDu desktop é denso (Gantt, Kanban, roadmap); no celular
o uso real é **captura e check-off**.

**Recomendado: Capacitor.** Embrulha o mesmo código React, dá push notification
nativo (notificação é o coração do TuDu) e acesso às lojas como canal de
distribuição e cobrança.

- PWA: valida rápido, mas no iOS só notifica se instalado na home screen (16.4+),
  o que quase ninguém faz.
- React Native: jogaria fora ~10 mil linhas de UI.

Escopo do mobile v1 (resistir a mais): captura rápida, "hoje/atrasadas", concluir
tarefa, subtarefas, comentário, notificação. Gantt e Kanban só leitura, ou nem isso.

## 3. Monetização

Vender "mais um gerenciador de tarefas" é inviável (Todoist, TickTick, Things,
Notion, Linear, ClickUp). Mas o TuDu não é isso — projetos, épicos, personas,
Gantt, roadmap, templates, apontamento de tempo e Pomodoro fazem dele uma
**camada de gestão de projeto para quem não banca Jira**. Público e disposição a
pagar diferentes.

Apostas em ordem de risco:

1. **Licença desktop paga** — R$ 80–150 uma vez, ou R$ 15/mês. Zero infra, zero
   LGPD. Serve pra descobrir se alguém paga *antes* de construir nuvem.
2. **Freemium com sync como produto pago** — local grátis pra sempre (é o
   diferencial de privacidade, não abrir mão); nuvem + mobile + backup a
   R$ 20–30/mês. Modelo do Obsidian, funciona bem pra dev solo.
3. **Times por assento** — R$ 25–40/assento. Só depois de 1 e 2 validados.

**Ângulo a perseguir:** *gestão de projeto que o seu agente de IA opera*. O MCP já
funciona. Ninguém no mercado de PM fez isso bem ainda, e o comprador (dev,
consultor, freelancer técnico) paga sem comparar com Todoist. É posicionamento,
não feature.

Pagamento: **Stripe** (suporta Pix) se o público for BR; **Paddle** se for global
— é *merchant of record* e resolve imposto, o que sozinho vale o percentual extra.

## 4. Nuvem, login e colaboração

| Caminho | Prós | Contras |
|---|---|---|
| **A. Dexie Cloud** | Sync + auth + controle de acesso (realms/membros) nativos em cima do Dexie já usado. Realms mapeiam direto em "compartilhar projeto com time". Semanas, não meses. | Dependência de fornecedor, preço por usuário. |
| **B. Supabase + sync à mão** | Postgres, auth, storage, RLS (resolve permissão de time direito). Mais controle, mais barato escalando. | Você escreve o motor de sync: pull por `updatedAt`, push de sujos, conflito. |
| **C. PowerSync/Electric + Supabase** | Postgres próprio, motor de sync pronto. | Mais peça móvel na stack. |

**Recomendação:** validar com **A**, fazendo as mudanças de schema de modo que **B**
continue possível. O maior risco não é escolher o banco errado — é gastar seis
meses em sync e descobrir que ninguém paga. Otimizar por tempo até a validação.

**Sobre times:** desenhar `Persona` desde já com um campo `userId?` opcional — a
persona é "reivindicada" por um usuário convidado. Assim colaboração vira aditivo,
não migração.

**Alerta:** nuvem multiusuário cria obrigações permanentes — LGPD, backup, uptime,
suporte, resposta a incidente. É isso que mata projeto de dev solo, não o código.

## 5. Ordem sugerida

1. **Preparar o schema pra sync** — `updatedAt` em tudo, `order` fracionário,
   abstrair anexo. Barato agora, caro depois. Vale mesmo se a nuvem for abandonada.
2. **Camada `platform.ts`** desacoplando os 8 arquivos de `window.tudu`. Destrava
   mobile *e* deixa o app rodar no browser.
3. **Quebrar o `App.tsx`.** Sem isso os passos 4–6 ficam insuportáveis.
4. **Cobrar pelo desktop.** Descobre se existe mercado antes de gastar em infra.
5. **Sync single-user + mobile Capacitor.** É o produto pago.
6. **Times.** Só se 4 e 5 derem sinal.

Passos 1–3 são refactors que valem por si e não dependem de nenhuma decisão de
negócio. O passo 1 é o único irreversível.
