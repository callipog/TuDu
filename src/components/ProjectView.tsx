import React, { useState } from 'react';
import { Project, Epic, Task, Persona } from '../types';
import { KanbanBoard } from './KanbanBoard';
import { GanttView } from './GanttView';
import { columnsFor, PROJECT_STATUS_BADGE, StatusColor } from '../services/boards';
import { projectService } from '../services/projects';
import { Avatar } from './Avatar';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Settings2, CalendarRange, LayoutGrid, GanttChartSquare, FileStack } from 'lucide-react';

interface ProjectViewProps {
  project: Project;
  epics: Epic[];
  tasks: Task[]; // tarefas ativas do projeto
  onEditProject: () => void;
  /** Guarda o projeto (épicos + tarefas) como modelo. */
  onSaveTemplate: () => void;
  onToggleTask: (task: Task) => void;
  onToggleSubtask?: (task: Task, subtaskId: string) => void;
  onClickTask: (task: Task) => void;
  onToggleNotifications: (task: Task) => void;
  onContextTask?: (e: React.MouseEvent, task: Task) => void;
  onArchiveCompleted: () => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onReorder: (taskId: string, status: string, targetTaskId: string | null, markCompleted: boolean) => void;
  personaById: (id?: string) => Persona | undefined;
  epicById: (id?: string) => Epic | undefined;
  statusLabel: (task: Task) => string;
  statusColor: (task: Task) => StatusColor;
}

export function ProjectView({ project, epics, tasks, onEditProject, onSaveTemplate, statusLabel, statusColor, ...board }: ProjectViewProps) {
  const [epicFilter, setEpicFilter] = useState<string>('all'); // 'all' | epicId | 'none'
  const [mode, setMode] = useState<'kanban' | 'gantt'>('kanban');

  const total = tasks.length;
  const done = tasks.filter(t => t.completed).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const boardTasks = tasks.filter(t => {
    if (epicFilter === 'all') return true;
    if (epicFilter === 'none') return !t.epicId;
    return t.epicId === epicFilter;
  });

  const chip = (id: string, label: string, colorDot?: string) => (
    <button
      key={id}
      onClick={() => setEpicFilter(id)}
      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        epicFilter === id ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
      }`}
    >
      {colorDot && <span className={`w-1.5 h-1.5 rounded-full ${colorDot}`}></span>}
      {label}
    </button>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Cabeçalho do projeto */}
      <div className="shrink-0 mb-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className={`w-3.5 h-3.5 rounded-full ${project.color}`}></span>
              <h2 className="text-xl font-bold text-white truncate">{project.name}</h2>
              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${PROJECT_STATUS_BADGE[project.status]?.cls || ''}`}>{PROJECT_STATUS_BADGE[project.status]?.label || project.status}</span>
            </div>
            {project.description && <p className="text-sm text-zinc-500 mt-1">{project.description}</p>}
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {(project.startDate || project.endDate) && (
                <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <CalendarRange size={13} />
                  {project.startDate ? format(parseISO(project.startDate), 'dd/MM/yy', { locale: ptBR }) : '…'}
                  {' – '}
                  {project.endDate ? format(parseISO(project.endDate), 'dd/MM/yy', { locale: ptBR }) : '…'}
                </span>
              )}
              {(project.assigneeIds && project.assigneeIds.length > 0) && (
                <div className="flex items-center -space-x-1.5">
                  {project.assigneeIds.map(id => {
                    const p = board.personaById(id);
                    return p ? <Avatar key={id} persona={p} size={22} /> : null;
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <div className="flex bg-white/5 border border-white/10 rounded-lg p-0.5">
              <button onClick={() => setMode('kanban')} title="Kanban"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${mode === 'kanban' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'}`}>
                <LayoutGrid size={14} /> Kanban
              </button>
              <button onClick={() => setMode('gantt')} title="Gantt"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${mode === 'gantt' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'}`}>
                <GanttChartSquare size={14} /> Gantt
              </button>
            </div>
            <button onClick={onSaveTemplate} title="Salvar este projeto como modelo"
              className="flex items-center gap-2 text-sm font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 transition-colors">
              <FileStack size={15} /> Modelo
            </button>
            <button onClick={onEditProject} title="Editar este projeto"
              className="flex items-center gap-2 text-sm font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 transition-colors">
              <Settings2 size={15} /> Editar projeto
            </button>
          </div>
        </div>

        {/* Progresso */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-zinc-400 shrink-0">{done}/{total} · {pct}%</span>
        </div>

        {/* Filtro de épicos */}
        <div className="flex items-center gap-2 flex-wrap">
          {chip('all', 'Todos')}
          {epics.map(e => chip(e.id, e.name, e.color || 'bg-zinc-500'))}
          {chip('none', 'Sem épico')}
        </div>
      </div>

      {/* Board / Gantt do projeto */}
      <div className="flex-1 min-h-0">
        {mode === 'kanban' ? (
          <KanbanBoard
            tasks={boardTasks}
            onToggleTask={board.onToggleTask}
            onToggleSubtask={board.onToggleSubtask}
            onClickTask={board.onClickTask}
            onToggleNotifications={board.onToggleNotifications}
            onContextTask={board.onContextTask}
            onArchiveCompleted={board.onArchiveCompleted}
            onDragStart={board.onDragStart}
            onReorder={board.onReorder}
            personaById={board.personaById}
            epicById={board.epicById}
            columns={columnsFor(project)}
            onReorderColumns={(cols) => projectService.update(project.id, { columns: cols })}
          />
        ) : (
          <GanttView tasks={boardTasks} epics={epics} statusLabel={statusLabel} statusColor={statusColor} onSelect={board.onClickTask} />
        )}
      </div>
    </div>
  );
}
