import React, { useRef, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Task, Attachment } from '../types';
import { projectService, sortEpics } from '../services/projects';
import { PREDEFINED_COLORS } from '../services/tags';
import { PROJECT_STATUS_BADGE, columnsFor } from '../services/boards';
import { exportProjectPdf } from '../services/projectExport';
import { Avatar } from './Avatar';
import { Markdown } from './Markdown';
import { AttachmentsEditor } from './Attachments';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Search, FolderKanban, Settings2, Trash2, ExternalLink, FileText, Upload, Pencil, Check, X, CalendarRange, FileDown } from 'lucide-react';

interface ProjectsManagerViewProps {
  tasks: Task[];
  onOpenProject: (id: string) => void;
  onEditProject: (id: string) => void;
  onDeleteProject: (id: string, name: string) => void;
}

export function ProjectsManagerView({ tasks, onOpenProject, onEditProject, onDeleteProject }: ProjectsManagerViewProps) {
  const projects = useLiveQuery(() => db.projects.orderBy('createdAt').toArray(), []) ?? [];
  const epics = useLiveQuery(() => db.epics.toArray(), []) ?? [];
  const personas = useLiveQuery(() => db.personas.toArray(), []) ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editingReadme, setEditingReadme] = useState(false);
  const [readmeDraft, setReadmeDraft] = useState('');
  const mdRef = useRef<HTMLInputElement>(null);

  // Largura do frame da lista, ajustável arrastando o divisor. Persiste entre sessões.
  const outerRef = useRef<HTMLDivElement>(null);
  const [listWidth, setListWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('tudu_projects_list_width'));
    return saved >= 200 && saved <= 620 ? saved : 288;
  });
  const resizing = useRef(false);
  const startResize = (e: React.PointerEvent) => { resizing.current = true; e.preventDefault(); document.body.style.userSelect = 'none'; };
  useEffect(() => { localStorage.setItem('tudu_projects_list_width', String(listWidth)); }, [listWidth]);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!resizing.current || !outerRef.current) return;
      const left = outerRef.current.getBoundingClientRect().left;
      setListWidth(Math.min(620, Math.max(200, e.clientX - left)));
    };
    const up = () => { if (resizing.current) { resizing.current = false; document.body.style.userSelect = ''; } };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, []);

  // Arraste horizontal na lista: os nomes longos são cortados na coluna estreita;
  // "grab and pan" lateral deixa lê-los sem alargar a coluna.
  const listRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, scroll: 0, moved: false });
  const onListPointerDown = (e: React.PointerEvent) => {
    const el = listRef.current;
    if (!el) return;
    drag.current = { active: true, startX: e.clientX, scroll: el.scrollLeft, moved: false };
  };
  const onListPointerMove = (e: React.PointerEvent) => {
    const el = listRef.current;
    if (!el || !drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) {
      drag.current.moved = true;
      el.setPointerCapture?.(e.pointerId); // segue o ponteiro mesmo saindo da lista
    }
    el.scrollLeft = drag.current.scroll - dx;
  };
  const endListDrag = () => { drag.current.active = false; };

  const personaById = (id?: string) => id ? personas.find(p => p.id === id) : undefined;

  const filtered = projects.filter(p => !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()));
  const sel = projects.find(p => p.id === selectedId) || null;
  const selEpics = sel ? sortEpics(epics.filter(e => e.projectId === sel.id)) : [];
  const selTasks = sel ? tasks.filter(t => t.projectId === sel.id) : [];
  const done = selTasks.filter(t => t.completed).length;
  const pct = selTasks.length > 0 ? Math.round((done / selTasks.length) * 100) : 0;

  const handleExportPdf = () => {
    if (!sel) return;
    exportProjectPdf({
      project: sel,
      epics: selEpics,
      tasks: selTasks,
      columns: columnsFor(sel),
      personaById,
      statusBadge: PROJECT_STATUS_BADGE,
    });
  };

  const createProject = async () => {
    const p = await projectService.create({ name: 'Novo projeto', color: PREDEFINED_COLORS[Math.floor(Math.random() * PREDEFINED_COLORS.length)] });
    setSelectedId(p.id);
    onEditProject(p.id);
  };

  const importMd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !sel) return;
    const r = new FileReader();
    r.onload = () => projectService.update(sel.id, { readme: String(r.result) });
    r.readAsText(f);
  };

  const startEditReadme = () => { setReadmeDraft(sel?.readme || ''); setEditingReadme(true); };
  const saveReadme = () => { if (sel) projectService.update(sel.id, { readme: readmeDraft }); setEditingReadme(false); };

  return (
    <div ref={outerRef} className="flex-1 min-h-0 flex">
      {/* Lista de projetos */}
      <div style={{ width: listWidth }} className="shrink-0 flex flex-col min-h-0 bg-[#121214] border border-white/5 rounded-2xl">
        <div className="p-3 border-b border-white/5 shrink-0 space-y-2">
          <button onClick={createProject} className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg py-2 transition-colors">
            <Plus size={15} /> Novo projeto
          </button>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500" />
          </div>
        </div>
        <div
          ref={listRef}
          onPointerDown={onListPointerDown}
          onPointerMove={onListPointerMove}
          onPointerUp={endListDrag}
          onPointerLeave={endListDrag}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-auto custom-scrollbar p-2 space-y-1 cursor-grab active:cursor-grabbing select-none"
        >
          {filtered.length === 0 ? (
            <p className="text-xs text-zinc-500 italic text-center py-6">Nenhum projeto.</p>
          ) : filtered.map(p => (
            <button key={p.id}
              onClick={() => { if (drag.current.moved) return; setSelectedId(p.id); setEditingReadme(false); }}
              className={`w-max min-w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${selectedId === p.id ? 'bg-white/10' : 'hover:bg-white/5'} ${p.archived ? 'opacity-50' : ''}`}>
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.color}`}></span>
              <span className="text-sm text-white whitespace-nowrap">{p.name}</span>
              <span className={`shrink-0 ml-2 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full border ${PROJECT_STATUS_BADGE[p.status]?.cls || ''}`}>{PROJECT_STATUS_BADGE[p.status]?.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Divisor arrastável: ajusta a largura do frame da lista */}
      <div
        onPointerDown={startResize}
        title="Arraste para ajustar a largura"
        className="group shrink-0 w-3 mx-0.5 flex items-center justify-center cursor-col-resize"
      >
        <div className="w-0.5 h-10 rounded-full bg-white/10 group-hover:bg-indigo-500/60 transition-colors"></div>
      </div>

      {/* Detalhe do projeto */}
      <div className="flex-1 min-w-0 min-h-0 bg-[#121214] border border-white/5 rounded-2xl overflow-hidden flex flex-col">
        {!sel ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-500">
            <FolderKanban size={40} className="mb-4 opacity-40" />
            <p className="text-sm">Selecione um projeto para ver os detalhes.</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6">
            {/* Cabeçalho */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className={`w-3.5 h-3.5 rounded-full ${sel.color}`}></span>
                  <h2 className="text-xl font-bold text-white truncate">{sel.name}</h2>
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${PROJECT_STATUS_BADGE[sel.status]?.cls || ''}`}>{PROJECT_STATUS_BADGE[sel.status]?.label}</span>
                </div>
                {sel.description && <p className="text-sm text-zinc-500 mt-1">{sel.description}</p>}
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  {(sel.startDate || sel.endDate) && (
                    <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <CalendarRange size={13} />
                      {sel.startDate ? format(parseISO(sel.startDate), 'dd/MM/yy', { locale: ptBR }) : '…'} – {sel.endDate ? format(parseISO(sel.endDate), 'dd/MM/yy', { locale: ptBR }) : '…'}
                    </span>
                  )}
                  {sel.assigneeIds && sel.assigneeIds.length > 0 && (
                    <div className="flex items-center -space-x-1.5">
                      {sel.assigneeIds.map(id => { const per = personas.find(x => x.id === id); return per ? <Avatar key={id} persona={per} size={22} /> : null; })}
                    </div>
                  )}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <button onClick={() => onOpenProject(sel.id)} title="Abrir board" className="flex items-center gap-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg px-3 py-2 transition-colors"><ExternalLink size={15} /> Abrir</button>
                <button onClick={handleExportPdf} title="Exportar documentação em PDF" className="flex items-center gap-1.5 text-sm font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 transition-colors"><FileDown size={15} /> PDF</button>
                <button onClick={() => onEditProject(sel.id)} title="Editar" className="p-2 rounded-lg text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"><Settings2 size={15} /></button>
                <button onClick={() => onDeleteProject(sel.id, sel.name)} title="Excluir" className="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"><Trash2 size={15} /></button>
              </div>
            </div>

            {/* Progresso */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-zinc-400 shrink-0">{done}/{selTasks.length} · {pct}%</span>
            </div>

            {/* Épicos */}
            {selEpics.length > 0 && (
              <div className="mb-5">
                <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-2">Épicos</p>
                <div className="flex flex-wrap gap-1.5">
                  {selEpics.map(e => (
                    <span key={e.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-zinc-300"><FolderKanban size={11} className="text-zinc-500" />{e.name}</span>
                  ))}
                </div>
              </div>
            )}

            {/* README */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider flex items-center gap-1.5"><FileText size={13} /> README</p>
                {!editingReadme && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => mdRef.current?.click()} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"><Upload size={13} /> Importar .md</button>
                    <button onClick={startEditReadme} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"><Pencil size={13} /> Editar</button>
                    <input ref={mdRef} type="file" accept=".md,text/markdown,text/plain" onChange={importMd} className="hidden" />
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                {editingReadme ? (
                  <div>
                    <textarea value={readmeDraft} onChange={(e) => setReadmeDraft(e.target.value)} placeholder="# Meu projeto&#10;&#10;Escreva em **Markdown**..." className="w-full h-64 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-indigo-500 resize-none" />
                    <div className="flex justify-end gap-2 mt-2">
                      <button onClick={() => setEditingReadme(false)} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white px-3 py-1.5 transition-colors"><X size={13} /> Cancelar</button>
                      <button onClick={saveReadme} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg px-3 py-1.5 transition-colors"><Check size={13} /> Salvar</button>
                    </div>
                  </div>
                ) : sel.readme && sel.readme.trim() ? (
                  <Markdown content={sel.readme} />
                ) : (
                  <p className="text-sm text-zinc-500 italic">Sem README. Importe um arquivo <code className="text-zinc-400">.md</code> ou clique em Editar para escrever.</p>
                )}
              </div>
            </div>

            {/* Arquivos do projeto */}
            <div>
              <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-2">Arquivos do projeto</p>
              <AttachmentsEditor value={sel.attachments || []} onChange={(a: Attachment[]) => projectService.update(sel.id, { attachments: a })} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
