import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, Project } from '../types';
import { Theme } from '../services/theme';
import { parseQuickAdd } from '../services/quickAdd';
import { taskMatches } from '../services/search';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search, Inbox, Clock, Calendar, CalendarClock, List, BarChart3, Archive, Trash2,
  Plus, Timer, Settings, Moon, Sun, Monitor, Coffee, CornerDownLeft, FileText, Sparkles, Users,
  FolderKanban, Tag as TagIcon, Download, Keyboard
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  projects: Project[];
  onNavigate: (tab: string) => void;
  onNewTask: () => void;
  onOpenTask: (task: Task) => void;
  onOpenProject: (id: string) => void;
  onOpenPomodoro: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onManageTags: () => void;
  onManagePersonas: () => void;
  onExportBackup: () => void;
  onSetTheme: (t: Theme) => void;
  onQuickAdd: (input: string) => void;
}

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
  keywords?: string;
}

export function CommandPalette({ isOpen, onClose, tasks, projects, onNavigate, onNewTask, onOpenTask, onOpenProject, onOpenPomodoro, onOpenSettings, onOpenShortcuts, onManageTags, onManagePersonas, onExportBackup, onSetTheme, onQuickAdd }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  const commands: Command[] = useMemo(() => {
    const nav = (tab: string) => () => { onNavigate(tab); onClose(); };
    const act = (fn: () => void) => () => { fn(); onClose(); };
    return [
      { id: 'new', label: 'Nova tarefa', hint: 'Ação', icon: <Plus size={16} />, run: act(onNewTask), keywords: 'criar adicionar' },
      { id: 'inbox', label: 'Ir para Caixa de Entrada', hint: 'Navegar', icon: <Inbox size={16} />, run: nav('inbox') },
      { id: 'today', label: 'Ir para Hoje', hint: 'Navegar', icon: <Clock size={16} />, run: nav('today') },
      { id: 'calendar', label: 'Ir para Calendário', hint: 'Navegar', icon: <Calendar size={16} />, run: nav('calendar') },
      { id: 'agenda', label: 'Ir para Agenda', hint: 'Navegar', icon: <CalendarClock size={16} />, run: nav('agenda') },
      { id: 'list', label: 'Ir para Lista', hint: 'Navegar', icon: <List size={16} />, run: nav('list') },
      { id: 'projects', label: 'Ir para Projetos', hint: 'Navegar', icon: <FolderKanban size={16} />, run: nav('projects'), keywords: 'gerenciador projeto board épico' },
      { id: 'stats', label: 'Ir para Relatórios', hint: 'Navegar', icon: <BarChart3 size={16} />, run: nav('stats') },
      { id: 'team', label: 'Ir para Equipe', hint: 'Navegar', icon: <Users size={16} />, run: nav('team') },
      { id: 'archived', label: 'Ir para Arquivados', hint: 'Navegar', icon: <Archive size={16} />, run: nav('archived') },
      { id: 'trash', label: 'Ir para Lixeira', hint: 'Navegar', icon: <Trash2 size={16} />, run: nav('trash') },
      { id: 'pomodoro', label: 'Abrir timer de foco (Pomodoro)', hint: 'Ação', icon: <Timer size={16} />, run: act(onOpenPomodoro) },
      { id: 'tags', label: 'Gerenciar tags', hint: 'Ação', icon: <TagIcon size={16} />, run: act(onManageTags), keywords: 'etiqueta cor global projeto' },
      { id: 'personas', label: 'Gerenciar equipe (personas)', hint: 'Ação', icon: <Users size={16} />, run: act(onManagePersonas), keywords: 'pessoa responsável' },
      { id: 'backup', label: 'Exportar backup', hint: 'Ação', icon: <Download size={16} />, run: act(onExportBackup), keywords: 'salvar json exportar dados' },
      { id: 'shortcuts', label: 'Ver atalhos de teclado', hint: 'Ação', icon: <Keyboard size={16} />, run: act(onOpenShortcuts) },
      { id: 'settings', label: 'Abrir Configurações', hint: 'Ação', icon: <Settings size={16} />, run: act(onOpenSettings) },
      { id: 'theme-dark', label: 'Tema: Escuro', hint: 'Aparência', icon: <Moon size={16} />, run: act(() => onSetTheme('dark')) },
      { id: 'theme-light', label: 'Tema: Claro', hint: 'Aparência', icon: <Sun size={16} />, run: act(() => onSetTheme('light')) },
      { id: 'theme-sepia', label: 'Tema: Sépia', hint: 'Aparência', icon: <Coffee size={16} />, run: act(() => onSetTheme('sepia')) },
      { id: 'theme-system', label: 'Tema: Sistema', hint: 'Aparência', icon: <Monitor size={16} />, run: act(() => onSetTheme('system')) },
      // Salto direto para cada board — com muitos projetos, é o caminho mais
      // curto entre "lembrei do projeto" e "estou nele".
      ...projects.filter(p => !p.archived).map(p => ({
        id: `project-${p.id}`,
        label: `Abrir projeto: ${p.name}`,
        hint: 'Projeto',
        icon: <FolderKanban size={16} />,
        run: act(() => onOpenProject(p.id)),
        keywords: 'board kanban projeto',
      })),
    ];
  }, [projects, onNavigate, onNewTask, onOpenProject, onOpenPomodoro, onOpenSettings, onOpenShortcuts, onManageTags, onManagePersonas, onExportBackup, onSetTheme, onClose]);

  const q = query.trim().toLowerCase();

  const filteredCommands = useMemo(() => {
    if (!q) return commands;
    return commands.filter(c => (`${c.label} ${c.hint || ''} ${c.keywords || ''}`).toLowerCase().includes(q));
  }, [commands, q]);

  const taskResults = useMemo(() => {
    if (!q) return [];
    return tasks
      .filter(t => taskMatches(t, q))
      .slice(0, 6);
  }, [tasks, q]);

  const parsed = q ? parseQuickAdd(query) : null;
  const showQuickAdd = !!(parsed && parsed.title);

  // Lista achatada para navegação por teclado.
  const items = useMemo(() => {
    const qa = showQuickAdd ? [{ type: 'quickadd' as const }] : [];
    const cmd = filteredCommands.map(c => ({ type: 'command' as const, cmd: c }));
    const tsk = taskResults.map(t => ({ type: 'task' as const, task: t }));
    return [...qa, ...cmd, ...tsk];
  }, [showQuickAdd, filteredCommands, taskResults]);

  useEffect(() => { setActive(0); }, [query]);

  const runItem = (idx: number) => {
    const it = items[idx];
    if (!it) return;
    if (it.type === 'quickadd') { onQuickAdd(query); onClose(); }
    else if (it.type === 'command') it.cmd.run();
    else { onOpenTask(it.task); onClose(); }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); runItem(active); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
    (el as HTMLElement | null)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const qaOffset = showQuickAdd ? 1 : 0;
  const cmdCount = filteredCommands.length;

  const quickAddPreview = parsed && showQuickAdd
    ? [
        parsed.dueDate ? format(parsed.dueDate, "d MMM · HH:mm", { locale: ptBR }) : null,
        parsed.urgency ? ({ low: 'baixa', medium: 'média', high: 'alta', critical: 'crítica' } as const)[parsed.urgency] : null,
        ...parsed.tags.map(t => `#${t}`),
      ].filter(Boolean).join('  ·  ')
    : '';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh] px-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            className="relative w-full max-w-xl rounded-2xl bg-[#0e0e10] border border-white/10 shadow-2xl z-10 overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 border-b border-white/10">
              <Search size={18} className="text-zinc-500 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Buscar ações ou tarefas..."
                className="flex-1 bg-transparent py-4 text-sm text-white placeholder-zinc-500 focus:outline-none"
              />
              <kbd className="text-[10px] font-mono text-zinc-500 border border-white/10 rounded px-1.5 py-0.5">ESC</kbd>
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto custom-scrollbar py-2">
              {items.length === 0 && (
                <p className="text-sm text-zinc-500 text-center py-8">Nada encontrado.</p>
              )}

              {showQuickAdd && parsed && (
                <button
                  data-idx={0}
                  onMouseMove={() => setActive(0)}
                  onClick={() => runItem(0)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${active === 0 ? 'bg-indigo-600/20' : 'hover:bg-white/5'}`}
                >
                  <span className={active === 0 ? 'text-indigo-300' : 'text-zinc-500'}><Sparkles size={16} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-white truncate">Criar tarefa: “{parsed.title}”</span>
                    {quickAddPreview && <span className="block text-[11px] text-indigo-400 truncate">{quickAddPreview}</span>}
                  </span>
                  <span className="text-[10px] text-zinc-600 shrink-0">Entrada rápida</span>
                </button>
              )}

              {filteredCommands.length > 0 && (
                <p className="text-[10px] uppercase font-bold text-zinc-600 px-4 py-1.5 tracking-wider">Ações</p>
              )}
              {filteredCommands.map((c, i) => (
                <Row key={c.id} idx={qaOffset + i} active={active === qaOffset + i} onHover={() => setActive(qaOffset + i)} onClick={() => runItem(qaOffset + i)}
                  icon={c.icon} label={c.label} hint={c.hint} />
              ))}

              {taskResults.length > 0 && (
                <p className="text-[10px] uppercase font-bold text-zinc-600 px-4 py-1.5 tracking-wider mt-1">Tarefas</p>
              )}
              {taskResults.map((t, i) => (
                <Row key={t.id} idx={qaOffset + cmdCount + i} active={active === qaOffset + cmdCount + i} onHover={() => setActive(qaOffset + cmdCount + i)} onClick={() => runItem(qaOffset + cmdCount + i)}
                  icon={<FileText size={16} />} label={t.title} hint={t.completed ? 'Concluída' : undefined} />
              ))}
            </div>

            <div className="flex items-center gap-3 px-4 py-2 border-t border-white/10 text-[10px] text-zinc-500">
              <span className="flex items-center gap-1"><CornerDownLeft size={11} /> selecionar</span>
              <span>↑↓ navegar</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Row({ idx, active, onHover, onClick, icon, label, hint }: { key?: React.Key; idx: number; active: boolean; onHover: () => void; onClick: () => void; icon: React.ReactNode; label: string; hint?: string }) {
  return (
    <button
      data-idx={idx}
      onMouseMove={onHover}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${active ? 'bg-indigo-600/20' : 'hover:bg-white/5'}`}
    >
      <span className={active ? 'text-indigo-300' : 'text-zinc-500'}>{icon}</span>
      <span className="flex-1 text-sm text-zinc-200 truncate">{label}</span>
      {hint && <span className="text-[10px] text-zinc-600 shrink-0">{hint}</span>}
    </button>
  );
}
