import React, { useState } from 'react';
import { Archive } from 'lucide-react';
import { Task, Persona, Epic } from '../types';
import { TaskItem } from './TaskItem';
import { BoardColumn, DEFAULT_COLUMNS, doneColumnId } from '../services/boards';
import { motion, AnimatePresence } from 'motion/react';

interface KanbanBoardProps {
  tasks: Task[];
  onToggleTask: (task: Task) => void;
  onClickTask?: (task: Task) => void;
  onToggleNotifications?: (task: Task) => void;
  onArchiveCompleted?: () => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  /** Move/reordena: coloca taskId na coluna `status`, antes de `targetTaskId` (ou no fim). markCompleted indica coluna final. */
  onReorder: (taskId: string, status: string, targetTaskId: string | null, markCompleted: boolean) => void;
  personaById?: (id?: string) => Persona | undefined;
  epicById?: (id?: string) => Epic | undefined;
  columns?: BoardColumn[];
}

const BORDER: Record<string, string> = {
  backlog: 'border-zinc-500/20', todo: 'border-blue-500/20', in_progress: 'border-amber-500/20',
  review: 'border-purple-500/20', done: 'border-emerald-500/20',
};

export function KanbanBoard({ tasks, onToggleTask, onClickTask, onToggleNotifications, onArchiveCompleted, onDragStart, onReorder, personaById, epicById, columns = DEFAULT_COLUMNS }: KanbanBoardProps) {
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [dragOverTask, setDragOverTask] = useState<string | null>(null);
  const doneId = doneColumnId(columns);
  const firstId = columns[0]?.id;

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
    <div className="flex gap-4 overflow-x-auto pb-4 h-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {columns.map(col => {
        const colTasks = tasks
          .filter(t => (t.status || (t.completed ? doneId : firstId)) === col.id)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const colColor = BORDER[col.id] || 'border-white/10';

        return (
          <div
            key={col.id}
            className={`flex-shrink-0 w-72 lg:flex-1 lg:min-w-[200px] flex flex-col bg-[#121214] border ${colColor} rounded-2xl overflow-hidden transition-colors ${dragOverCol === col.id ? 'bg-white/[0.05] border-white/40' : ''}`}
            onDrop={(e) => handleColumnDrop(e, col.id)}
            onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.id); }}
            onDragLeave={() => setDragOverCol(null)}
          >
            <div className="p-4 border-b border-white/5 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">{col.label}</h3>
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
            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-3 min-h-[150px]">
              <AnimatePresence mode="popLayout">
                {colTasks.map(task => (
                  <motion.div
                    layout
                    layoutId={`task-${task.id}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 600, damping: 35 }}
                    key={task.id}
                    draggable
                    onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, task.id)}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverTask(task.id); setDragOverCol(col.id); }}
                    onDrop={(e) => handleCardDrop(e, col.id, task.id)}
                    className={`cursor-grab active:cursor-grabbing rounded-2xl ${dragOverTask === task.id ? 'ring-2 ring-indigo-500/60' : ''}`}
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
                    />
                  </motion.div>
                ))}
                {colTasks.length === 0 && (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 600, damping: 35 }}
                    className="h-20 border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center text-xs text-zinc-500 pointer-events-none"
                  >
                    Arraste tarefas para cá
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        );
      })}
    </div>
  );
}
