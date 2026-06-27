import React, { useState } from 'react';
import { Task, TaskStatus } from '../types';
import { TaskItem } from './TaskItem';
import { motion, AnimatePresence } from 'motion/react';

interface KanbanBoardProps {
  tasks: Task[];
  onToggleTask: (task: Task) => void;
  onClickTask?: (task: Task) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDrop: (e: React.DragEvent, status: TaskStatus) => void;
}

const columns: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'backlog', label: 'Backlog', color: 'border-zinc-500/20' },
  { id: 'todo', label: 'A Fazer', color: 'border-blue-500/20' },
  { id: 'in_progress', label: 'Em Andamento', color: 'border-amber-500/20' },
  { id: 'review', label: 'Revisando/Teste', color: 'border-purple-500/20' },
  { id: 'done', label: 'Finalizado', color: 'border-emerald-500/20' }
];

export function KanbanBoard({ tasks, onToggleTask, onClickTask, onDragStart, onDrop }: KanbanBoardProps) {
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOverCol(status);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    setDragOverCol(null);
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    onDrop(e, status);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 h-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {columns.map(col => {
        const colTasks = tasks.filter(t => (t.status || (t.completed ? 'done' : 'todo')) === col.id);
        
        return (
          <div 
            key={col.id} 
            className={`flex-shrink-0 w-72 lg:flex-1 lg:min-w-[200px] flex flex-col bg-[#121214] border ${col.color} rounded-2xl overflow-hidden transition-colors ${dragOverCol === col.id ? 'bg-white/[0.05] border-white/40' : ''}`}
            onDrop={(e) => handleDrop(e, col.id)}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={handleDragLeave}
          >
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">{col.label}</h3>
              <span className="text-xs font-medium bg-white/10 text-zinc-300 px-2 py-0.5 rounded-full">
                {colTasks.length}
              </span>
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
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <TaskItem
                      title={task.title}
                      description={task.description}
                      urgency={task.urgency}
                      tags={task.tags}
                      time={task.dueDate}
                      completed={task.completed}
                      onToggle={() => onToggleTask(task)}
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
