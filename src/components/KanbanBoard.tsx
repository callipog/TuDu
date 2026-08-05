import React, { useState, useEffect, useCallback } from 'react';
import { Archive, GripVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { Task, Persona, Epic } from '../types';
import { TaskItem } from './TaskItem';
import { BoardColumn, DEFAULT_COLUMNS, doneColumnId } from '../services/boards';
import { useSortableList } from '../hooks/useSortableList';

interface KanbanBoardProps {
  tasks: Task[];
  onToggleTask: (task: Task) => void;
  onClickTask?: (task: Task) => void;
  onToggleNotifications?: (task: Task) => void;
  onContextTask?: (e: React.MouseEvent, task: Task) => void;
  onArchiveCompleted?: () => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  /** Move/reordena: coloca taskId na coluna `status`, antes de `targetTaskId` (ou no fim). markCompleted indica coluna final. */
  onReorder: (taskId: string, status: string, targetTaskId: string | null, markCompleted: boolean) => void;
  personaById?: (id?: string) => Persona | undefined;
  epicById?: (id?: string) => Epic | undefined;
  columns?: BoardColumn[];
  /** Quando informado, as colunas podem ser reordenadas arrastando pelo punho. */
  onReorderColumns?: (columns: BoardColumn[]) => void;
}

const BORDER: Record<string, string> = {
  backlog: 'border-zinc-500/20', todo: 'border-blue-500/20', in_progress: 'border-amber-500/20',
  review: 'border-purple-500/20', done: 'border-emerald-500/20',
};

export function KanbanBoard({ tasks, onToggleTask, onClickTask, onToggleNotifications, onContextTask, onArchiveCompleted, onDragStart, onReorder, personaById, epicById, columns = DEFAULT_COLUMNS, onReorderColumns }: KanbanBoardProps) {
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [dragOverTask, setDragOverTask] = useState<string | null>(null);
  const doneId = doneColumnId(columns);
  const firstId = columns[0]?.id;

  // Reordenação das colunas (só quando o board sabe persistir a ordem).
  const colSort = useSortableList(
    columns.map(c => c.id),
    (ids) => onReorderColumns?.(ids.map(id => columns.find(c => c.id === id)!)),
    'x'
  );
  const movingColumn = colSort.dragId !== null;

  /* ---- Rolagem horizontal descobrível -------------------------------------
     Com muitas etapas o board estoura a tela. Em vez de depender do shift+scroll
     (que pouca gente conhece), o board mostra barra de rolagem, setas nas bordas,
     aceita a roda do mouse na horizontal e se arrasta sozinho ao chegar na borda. */
  const scrollRef = colSort.containerRef;
  const [edges, setEdges] = useState({ left: false, right: false });

  const syncEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    syncEdges();
    const ro = new ResizeObserver(syncEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncEdges, columns.length]);

  // Roda do mouse rola o board na horizontal — mas só depois que a lista de
  // cards sob o cursor chegou ao fim, para não sequestrar a rolagem vertical.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0 || e.deltaX !== 0 || e.ctrlKey) return;
      if (el.scrollWidth <= el.clientWidth) return;
      const list = (e.target as HTMLElement)?.closest?.('[data-column-list]') as HTMLElement | null;
      if (list && list.scrollHeight > list.clientHeight) {
        const atEnd = e.deltaY > 0
          ? list.scrollTop + list.clientHeight >= list.scrollHeight - 1
          : list.scrollTop <= 0;
        if (!atEnd) return;
      }
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [scrollRef]);

  // Arrastando um card/etapa até a borda, o board rola sozinho.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let dir = 0;
    let raf = 0;
    const step = () => {
      if (!dir) { raf = 0; return; }
      el.scrollLeft += dir * 14;
      raf = requestAnimationFrame(step);
    };
    const onDragOver = (e: DragEvent) => {
      const r = el.getBoundingClientRect();
      const zone = 90;
      dir = e.clientX < r.left + zone ? -1 : e.clientX > r.right - zone ? 1 : 0;
      if (dir && !raf) raf = requestAnimationFrame(step);
    };
    const stop = () => { dir = 0; if (raf) { cancelAnimationFrame(raf); raf = 0; } };
    el.addEventListener('dragover', onDragOver, true);
    window.addEventListener('drop', stop, true);
    window.addEventListener('dragend', stop, true);
    return () => {
      stop();
      el.removeEventListener('dragover', onDragOver, true);
      window.removeEventListener('drop', stop, true);
      window.removeEventListener('dragend', stop, true);
    };
  }, [scrollRef]);

  const nudge = (dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    const step = first ? first.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  const handleColumnDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setDragOverCol(null);
    setDragOverTask(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) onReorder(taskId, status, null, status === doneId);
  };

  const handleCardDrop = (e: React.DragEvent, status: string, targetTaskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCol(null);
    setDragOverTask(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId && taskId !== targetTaskId) onReorder(taskId, status, targetTaskId, status === doneId);
  };

  return (
    <div className="relative h-full board-fade">
      <div
        ref={scrollRef}
        onScroll={syncEdges}
        className="flex gap-4 overflow-x-auto pb-3 h-full board-scrollbar"
      >
      {columns.map(col => {
        const colTasks = tasks
          .filter(t => (t.status || (t.completed ? doneId : firstId)) === col.id)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const colColor = BORDER[col.id] || 'border-white/10';
        const colDrop = colSort.itemProps(col.id);

        return (
          <div
            key={col.id}
            data-sortable-id={col.id}
            className={`shrink-0 grow basis-72 flex flex-col bg-[#121214] border ${colColor} rounded-2xl overflow-hidden transition-colors ${dragOverCol === col.id ? 'bg-white/[0.05] border-white/40' : ''} ${colSort.itemClass(col.id)}`}
            onDrop={(e) => { if (movingColumn) { colDrop.onDrop(e); return; } handleColumnDrop(e, col.id); }}
            onDragOver={(e) => { if (movingColumn) { colDrop.onDragOver(e); return; } e.preventDefault(); setDragOverCol(col.id); }}
            onDragLeave={() => { if (!movingColumn) setDragOverCol(null); }}
          >
            <div className="p-4 border-b border-white/5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {onReorderColumns && (
                  <span {...colSort.handleProps(col.id)} title="Arraste para reordenar as etapas"
                    className="drag-handle shrink-0 -ml-1.5 text-zinc-600 hover:text-zinc-300 cursor-grab active:cursor-grabbing">
                    <GripVertical size={15} />
                  </span>
                )}
                <h3 className="text-sm font-semibold text-white truncate">{col.label}</h3>
              </div>
              <div className="flex items-center gap-2">
                {col.id === doneId && colTasks.length > 0 && onArchiveCompleted && (
                  <button
                    onClick={onArchiveCompleted}
                    title="Arquivar todas as tarefas finalizadas"
                    className="flex items-center gap-1 text-[10px] font-semibold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1 rounded-md transition-colors"
                  >
                    <Archive size={12} /> Arquivar tudo
                  </button>
                )}
                <span className="text-xs font-medium bg-white/10 text-zinc-300 px-2 py-0.5 rounded-full">
                  {colTasks.length}
                </span>
              </div>
            </div>
            <div data-column-list className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-3 min-h-[150px]">
              {/* Cards com div + animação CSS de entrada (em vez de framer-motion):
                  o ciclo de vida do motion/AnimatePresence não desmontava o card ao
                  excluir (ficava invisível ocupando espaço) e travava a entrada sob
                  StrictMode. Div puro garante montar/desmontar confiável. */}
              {colTasks.map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, task.id)}
                  onDragOver={(e) => { if (movingColumn) return; e.preventDefault(); e.stopPropagation(); setDragOverTask(task.id); setDragOverCol(col.id); }}
                  onDrop={(e) => { if (movingColumn) return; handleCardDrop(e, col.id, task.id); }}
                  className={`kanban-card-enter cursor-grab active:cursor-grabbing rounded-2xl ${dragOverTask === task.id ? 'ring-2 ring-indigo-500/60' : ''}`}
                >
                  <TaskItem
                    title={task.title}
                    description={task.description}
                    urgency={task.urgency}
                    tags={task.tags}
                    time={task.dueDate}
                    completed={task.completed}
                    notificationsEnabled={task.notificationsEnabled}
                    recurrence={task.recurrence}
                    subtasks={task.subtasks}
                    assignee={personaById?.(task.assigneeId)}
                    epic={epicById?.(task.epicId)}
                    onToggle={() => onToggleTask(task)}
                    onToggleNotifications={() => onToggleNotifications?.(task)}
                    onClick={() => onClickTask?.(task)}
                    onContextMenu={onContextTask ? (e) => onContextTask(e, task) : undefined}
                  />
                </div>
              ))}
              {colTasks.length === 0 && (
                <div className="h-20 border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center text-xs text-zinc-500 pointer-events-none">
                  Arraste tarefas para cá
                </div>
              )}
            </div>
          </div>
        );
      })}
      </div>

      {/* Bordas esmaecidas + setas: aparecem só quando há board fora da tela. */}
      {edges.left && (
        <>
          <div className="board-fade-left pointer-events-none absolute left-0 top-0 bottom-3 w-14 z-10" />
          <button
            onClick={() => nudge(-1)}
            title="Rolar etapas para a esquerda"
            className="absolute left-1 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-[#18181b] border border-white/15 text-zinc-300 hover:text-white hover:border-white/30 shadow-lg shadow-black/40 transition-all hover:scale-110 active:scale-95"
          >
            <ChevronLeft size={18} />
          </button>
        </>
      )}
      {edges.right && (
        <>
          <div className="board-fade-right pointer-events-none absolute right-0 top-0 bottom-3 w-14 z-10" />
          <button
            onClick={() => nudge(1)}
            title="Rolar etapas para a direita"
            className="absolute right-1 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-[#18181b] border border-white/15 text-zinc-300 hover:text-white hover:border-white/30 shadow-lg shadow-black/40 transition-all hover:scale-110 active:scale-95"
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}
    </div>
  );
}
