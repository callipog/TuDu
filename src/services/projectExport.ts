import { Project, Epic, Task, Persona } from '../types';
import { BoardColumn, statusLabel } from './boards';

/**
 * Exporta um projeto como documento imprimível (→ "Salvar como PDF" no diálogo
 * de impressão). Monta um HTML autocontido e claro — pensado para papel, não
 * para a UI escura — e o imprime dentro de um iframe isolado, para sair só a
 * documentação do projeto, não a tela inteira do app.
 */

export interface ProjectExportData {
  project: Project;
  epics: Epic[];            // já ordenados
  tasks: Task[];            // tarefas ativas do projeto
  columns: BoardColumn[];   // etapas do board
  personaById: (id?: string) => Persona | undefined;
  statusBadge: Record<string, { label: string }>;
}

const URGENCY_LABEL: Record<string, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica',
};

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
}

/* --------------------------------------------------- markdown → html (mínimo) */
/* Porta o subconjunto do Markdown.tsx para string HTML, tudo escapado. */
function inlineMd(text: string): string {
  let out = '';
  const regex = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    out += esc(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('`')) out += `<code>${esc(tok.slice(1, -1))}</code>`;
    else if (tok.startsWith('**')) out += `<strong>${esc(tok.slice(2, -2))}</strong>`;
    else if (tok.startsWith('*')) out += `<em>${esc(tok.slice(1, -1))}</em>`;
    else {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok)!;
      out += `<a href="${esc(mm[2])}">${esc(mm[1])}</a>`;
    }
    last = m.index + tok.length;
  }
  out += esc(text.slice(last));
  return out;
}

function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      const buf: string[] = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) { buf.push(lines[i]); i++; }
      i++;
      blocks.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) { const lv = h[1].length; blocks.push(`<h${lv} class="md-h${lv}">${inlineMd(h[2])}</h${lv}>`); i++; continue; }
    if (/^---+$/.test(line.trim())) { blocks.push('<hr>'); i++; continue; }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '')); i++;
      }
      const li = items.map(it => `<li>${inlineMd(it)}</li>`).join('');
      blocks.push(ordered ? `<ol>${li}</ol>` : `<ul>${li}</ul>`);
      continue;
    }
    if (line.trim().startsWith('>')) { blocks.push(`<blockquote>${inlineMd(line.replace(/^\s*>\s?/, ''))}</blockquote>`); i++; continue; }
    if (line.trim() === '') { i++; continue; }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,3}\s|```|>|\s*([-*]|\d+\.)\s|---+$)/.test(lines[i])) {
      para.push(lines[i]); i++;
    }
    blocks.push(`<p>${inlineMd(para.join(' '))}</p>`);
  }
  return blocks.join('\n');
}

/* ------------------------------------------------------- gantt (cronograma) */
/* Versão impressa do Gantt: larguras em %, para caber na página independente do
   número de dias. Cabeçalho de meses = o "calendário"; barras coloridas por
   status, como no app. Só entram tarefas com data. */

const STATUS_HEX: Record<string, string> = {
  backlog: '#a1a1aa', todo: '#3b82f6', in_progress: '#f59e0b', review: '#a855f7', done: '#10b981',
};

function statusHex(t: Task, columns: BoardColumn[]): string {
  const doneId = columns.length ? columns[columns.length - 1].id : 'done';
  const firstId = columns.length ? columns[0].id : 'todo';
  const id = t.status || (t.completed ? doneId : firstId);
  if (STATUS_HEX[id]) return STATUS_HEX[id];
  if (id === doneId) return STATUS_HEX.done;
  return '#6366f1'; // coluna customizada: índigo
}

const DAY = 86400000;
const dayStart = (iso: string) => { const d = new Date(iso); d.setHours(0, 0, 0, 0); return d.getTime(); };

function buildGanttHtml(tasks: Task[], columns: BoardColumn[]): string {
  const dated = tasks.filter(t => t.startDate || t.dueDate);
  if (!dated.length) return '';

  const spans = dated.map(t => {
    let s = dayStart((t.startDate || t.dueDate)!);
    let e = dayStart((t.dueDate || t.startDate)!);
    if (e < s) [s, e] = [e, s];
    return { t, s, e };
  }).sort((a, b) => a.s - b.s);

  const min = Math.min(...spans.map(x => x.s)) - DAY;
  const max = Math.max(...spans.map(x => x.e)) + DAY;
  const total = Math.max(1, Math.round((max - min) / DAY) + 1);

  // Segmentos de mês (o "calendário" no topo).
  const months: { label: string; count: number }[] = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(min + i * DAY);
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    const last = months[months.length - 1];
    if (last && last.label === label) last.count++;
    else months.push({ label, count: 1 });
  }
  const monthsHtml = months.map(m => `<div class="g-month" style="width:${(m.count / total * 100).toFixed(3)}%">${esc(m.label)}</div>`).join('');

  const today = dayStart(new Date().toISOString());
  const todayLine = (today >= min && today <= max)
    ? `<div class="g-today" style="left:${(((today - min) / DAY) / total * 100).toFixed(3)}%"></div>`
    : '';

  const rows = spans.map(({ t, s, e }) => {
    const leftPct = ((s - min) / DAY) / total * 100;
    const widthPct = Math.max(1.2, ((e - s) / DAY + 1) / total * 100);
    return `
      <div class="g-row">
        <div class="g-label ${t.completed ? 'g-done' : ''}">${esc(t.title)}</div>
        <div class="g-track">${todayLine}
          <div class="g-bar" style="left:${leftPct.toFixed(3)}%;width:${widthPct.toFixed(3)}%;background:${statusHex(t, columns)}${t.completed ? ';opacity:.5' : ''}"></div>
        </div>
      </div>`;
  }).join('');

  return `<section><h2>Cronograma (Gantt)</h2>
    <div class="gantt">
      <div class="g-head"><div class="g-label-h">Atividade</div><div class="g-track-h">${monthsHtml}</div></div>
      ${rows}
    </div>
  </section>`;
}

/* --------------------------------------------------------- montagem do doc */

export function buildProjectHtml(data: ProjectExportData): string {
  const { project, epics, tasks, columns, personaById, statusBadge } = data;

  const done = tasks.filter(t => t.completed).length;
  const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
  const assignees = (project.assigneeIds ?? [])
    .map(id => personaById(id)?.name).filter(Boolean).map(esc).join(', ');
  const epicName = (id?: string) => epics.find(e => e.id === id)?.name;

  // Tarefas agrupadas por épico (a última "coluna" = sem épico).
  const grupos: { titulo: string; itens: Task[] }[] = [
    ...epics.map(e => ({ titulo: e.name, itens: tasks.filter(t => t.epicId === e.id) })),
    { titulo: 'Sem épico', itens: tasks.filter(t => !t.epicId) },
  ].filter(g => g.itens.length > 0);

  const taskRow = (t: Task) => {
    const meta = [
      statusLabel(t.status, t.completed, columns),
      URGENCY_LABEL[t.urgency] ?? t.urgency,
      t.dueDate ? `entrega ${fmtDate(t.dueDate)}` : '',
      personaById(t.assigneeId)?.name ? `resp. ${esc(personaById(t.assigneeId)!.name)}` : '',
    ].filter(Boolean).map(esc).join(' · ');
    const subs = (t.subtasks ?? []).length
      ? `<ul class="subs">${t.subtasks!.map(s => `<li class="${s.done ? 'done' : ''}">${s.done ? '☑' : '☐'} ${esc(s.title)}</li>`).join('')}</ul>`
      : '';
    const tags = (t.tags ?? []).length
      ? `<div class="tags">${t.tags.map(tag => `<span class="tag">${esc(tag)}</span>`).join('')}</div>`
      : '';
    return `
      <div class="task ${t.completed ? 'task-done' : ''}">
        <div class="task-head">
          <span class="check">${t.completed ? '☑' : '☐'}</span>
          <span class="task-title">${esc(t.title)}</span>
        </div>
        <div class="task-meta">${meta}</div>
        ${t.description ? `<div class="task-desc">${esc(t.description)}</div>` : ''}
        ${tags}${subs}
      </div>`;
  };

  const epicsBlock = epics.length
    ? `<section><h2>Épicos</h2>${epics.map(e => `
        <div class="epic">
          <div class="epic-name">${esc(e.name)}</div>
          ${e.description ? `<div class="epic-desc">${esc(e.description)}</div>` : ''}
        </div>`).join('')}</section>`
    : '';

  const ganttBlock = buildGanttHtml(tasks, columns);

  const readmeBlock = project.readme && project.readme.trim()
    ? `<section><h2>README</h2><div class="readme">${markdownToHtml(project.readme)}</div></section>`
    : '';

  const attachments = (project.attachments ?? []);
  const attachBlock = attachments.length
    ? `<section><h2>Arquivos</h2><ul class="files">${attachments.map(a =>
        `<li>${esc(a.title || a.type)} <span class="file-type">(${esc(a.type)})</span>${a.type === 'link' ? ` — ${esc(a.content)}` : ''}</li>`).join('')}</ul></section>`
    : '';

  const tasksBlock = grupos.length
    ? `<section><h2>Tarefas (${tasks.length})</h2>${grupos.map(g => `
        <div class="grupo">
          <h3>${esc(g.titulo)} <span class="grupo-count">${g.itens.length}</span></h3>
          ${g.itens.map(taskRow).join('')}
        </div>`).join('')}</section>`
    : '<section><h2>Tarefas</h2><p class="empty">Nenhuma tarefa neste projeto.</p></section>';

  const geradoEm = new Date().toLocaleString('pt-BR');
  const periodo = (project.startDate || project.endDate)
    ? `${fmtDate(project.startDate) || '…'} – ${fmtDate(project.endDate) || '…'}`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>${esc(project.name)} — Documentação</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1f2328; font-size: 12px; line-height: 1.55; }
  .page { max-width: 760px; margin: 0 auto; padding: 32px 28px; }
  h1 { font-size: 24px; margin: 0 0 4px; color: #111; }
  h2 { font-size: 15px; margin: 22px 0 10px; padding-bottom: 5px; border-bottom: 2px solid #e2e4e8; color: #111; }
  h3 { font-size: 13px; margin: 14px 0 8px; color: #333; }
  .sub { color: #57606a; font-size: 12px; margin: 0 0 14px; }
  .status { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 2px 8px; border-radius: 999px; border: 1px solid #d0d7de; color: #444; vertical-align: middle; margin-left: 8px; }
  .meta-line { display: flex; flex-wrap: wrap; gap: 14px; color: #57606a; font-size: 11px; margin-bottom: 4px; }
  .bar { height: 8px; background: #eaecef; border-radius: 999px; overflow: hidden; margin: 6px 0 2px; }
  .bar > span { display: block; height: 100%; background: linear-gradient(90deg,#4f46e5,#818cf8); }
  section { margin-top: 6px; page-break-inside: auto; }
  .epic { border: 1px solid #e2e4e8; border-radius: 8px; padding: 8px 10px; margin-bottom: 6px; }
  .epic-name { font-weight: 600; }
  .epic-desc { color: #57606a; font-size: 11px; margin-top: 2px; }
  .grupo { margin-bottom: 10px; }
  .grupo-count { font-size: 10px; color: #57606a; background: #eef0f3; border-radius: 999px; padding: 1px 7px; margin-left: 4px; }
  .task { border: 1px solid #e2e4e8; border-left: 3px solid #818cf8; border-radius: 6px; padding: 8px 10px; margin: 6px 0; page-break-inside: avoid; }
  .task-done { opacity: .62; border-left-color: #9aa4b2; }
  .task-head { display: flex; gap: 6px; align-items: baseline; }
  .task-title { font-weight: 600; }
  .task-meta { color: #57606a; font-size: 10.5px; margin-top: 2px; }
  .task-desc { font-size: 11px; margin-top: 4px; white-space: pre-wrap; }
  .check { color: #4f46e5; }
  .tags { margin-top: 5px; display: flex; flex-wrap: wrap; gap: 4px; }
  .tag { font-size: 9.5px; background: #eef0f3; border: 1px solid #e2e4e8; border-radius: 4px; padding: 1px 6px; color: #444; }
  .subs { margin: 5px 0 0; padding-left: 4px; list-style: none; }
  .subs li { font-size: 10.5px; color: #444; }
  .subs li.done { color: #8a929c; text-decoration: line-through; }
  .readme { border: 1px solid #e2e4e8; border-radius: 8px; padding: 12px 14px; }
  .readme code { background: #f2f3f5; padding: 1px 5px; border-radius: 4px; font-family: ui-monospace, monospace; font-size: .9em; }
  .readme pre { background: #f6f8fa; border: 1px solid #e2e4e8; border-radius: 6px; padding: 10px; overflow-x: auto; }
  .readme pre code { background: none; padding: 0; }
  .readme .md-h1 { font-size: 16px; } .readme .md-h2 { font-size: 14px; } .readme .md-h3 { font-size: 13px; }
  .readme blockquote { border-left: 3px solid #c7cbd1; margin: 8px 0; padding-left: 10px; color: #57606a; }
  .readme a { color: #4f46e5; }
  .gantt { border: 1px solid #e2e4e8; border-radius: 8px; overflow: hidden; }
  .g-head, .g-row { display: grid; grid-template-columns: 168px 1fr; }
  .g-head { background: #f6f8fa; border-bottom: 1px solid #e2e4e8; }
  .g-label-h { padding: 4px 8px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; color: #57606a; border-right: 1px solid #e2e4e8; }
  .g-track-h { display: flex; }
  .g-month { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #57606a; text-align: center; border-left: 1px solid #e2e4e8; padding: 4px 0; overflow: hidden; white-space: nowrap; }
  .g-month:first-child { border-left: none; }
  .g-row { border-bottom: 1px solid #eef0f3; page-break-inside: avoid; }
  .g-row:last-child { border-bottom: none; }
  .g-label { padding: 5px 8px; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-right: 1px solid #e2e4e8; }
  .g-label.g-done { color: #8a929c; text-decoration: line-through; }
  .g-track { position: relative; height: 22px; }
  .g-bar { position: absolute; top: 50%; transform: translateY(-50%); height: 12px; border-radius: 3px; min-width: 3px; }
  .g-today { position: absolute; top: 0; bottom: 0; width: 1px; background: #e5484d; opacity: .7; }
  .files { padding-left: 18px; margin: 4px 0; }
  .file-type { color: #8a929c; }
  .empty { color: #8a929c; font-style: italic; }
  footer { margin-top: 26px; padding-top: 10px; border-top: 1px solid #e2e4e8; color: #8a929c; font-size: 10px; }
  @media print { .page { padding: 0; max-width: none; } @page { margin: 16mm 14mm; } }
</style></head>
<body><div class="page">
  <h1>${esc(project.name)}<span class="status">${esc(statusBadge[project.status]?.label ?? project.status)}</span></h1>
  ${project.description ? `<p class="sub">${esc(project.description)}</p>` : ''}
  <div class="meta-line">
    ${periodo ? `<span>📅 ${periodo}</span>` : ''}
    ${assignees ? `<span>👥 ${assignees}</span>` : ''}
    <span>✓ ${done}/${tasks.length} concluídas</span>
  </div>
  <div class="bar"><span style="width:${pct}%"></span></div>
  <div class="sub">${pct}% concluído</div>
  ${epicsBlock}
  ${ganttBlock}
  ${readmeBlock}
  ${tasksBlock}
  ${attachBlock}
  <footer>Gerado pelo TuDu em ${esc(geradoEm)}</footer>
</div></body></html>`;
}

/** Monta o doc, injeta num iframe oculto e dispara a impressão do navegador. */
export function exportProjectPdf(data: ProjectExportData): void {
  const html = buildProjectHtml(data);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  const cleanup = () => { setTimeout(() => iframe.remove(), 1000); };

  const doc = iframe.contentWindow?.document;
  if (!doc) { iframe.remove(); return; }
  doc.open();
  doc.write(html);
  doc.close();

  // Espera o layout assentar antes de imprimir; imprime só o iframe.
  const go = () => {
    const win = iframe.contentWindow;
    if (!win) { cleanup(); return; }
    win.focus();
    win.print();
    cleanup();
  };
  if (doc.readyState === 'complete') setTimeout(go, 120);
  else iframe.onload = () => setTimeout(go, 120);
}
