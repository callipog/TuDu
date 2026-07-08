import React, { useState, useEffect } from 'react';
import { AlertTriangle, Archive, BarChart3, Bell, BellOff, Calendar, CalendarClock, Check, Clock, Inbox, Keyboard, Layout, List, Plus, Search, Settings, Sidebar as SidebarIcon, Timer, Trash2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Task, Urgency, Recurrence, RecurrenceEnd, SubTask, TaskStatus } from './types';
import { taskService } from './services/tasks';
import { notificationService, DEFAULT_REMINDER_MINUTES } from './services/notifications';
import { Modal } from './components/Modal';
import { MonthlyCalendar } from './components/MonthlyCalendar';
import { KanbanBoard } from './components/KanbanBoard';
import { TaskItem } from './components/TaskItem';
import { ArchivedView } from './components/ArchivedView';
import { TaskDetailModal } from './components/TaskDetailModal';
import { AgendaView } from './components/AgendaView';
import { TaskListView } from './components/TaskListView';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ShortcutsModal } from './components/ShortcutsModal';
import { TrashView } from './components/TrashView';
import { StatsView } from './components/StatsView';
import { PomodoroModal } from './components/PomodoroModal';
import { format, isToday, isSameDay, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { TagInput } from './components/TagInput';
import { tagService, PREDEFINED_COLORS } from './services/tags';
import { ManageTagsModal } from './components/ManageTagsModal';
import { SettingsModal } from './components/SettingsModal';
import { TitleBar } from './components/TitleBar';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('inbox');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isManageTagsModalOpen, setIsManageTagsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void } | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskUrgency, setNewTaskUrgency] = useState<Urgency>('medium');
  const [newTaskTags, setNewTaskTags] = useState<string[]>([]);
  const [newTaskDate, setNewTaskDate] = useState<string>('');
  const [newTaskNotifications, setNewTaskNotifications] = useState(false);
  const [newTaskReminderMinutes, setNewTaskReminderMinutes] = useState<number>(DEFAULT_REMINDER_MINUTES);
  const [newTaskRecurrence, setNewTaskRecurrence] = useState<Recurrence>('none');
  const [newTaskRecurrenceInterval, setNewTaskRecurrenceInterval] = useState<number>(2);
  const [newTaskRecurrenceWeekdays, setNewTaskRecurrenceWeekdays] = useState<number[]>([]);
  const [newTaskRecurrenceEndType, setNewTaskRecurrenceEndType] = useState<RecurrenceEnd>('never');
  const [newTaskRecurrenceCount, setNewTaskRecurrenceCount] = useState<number>(10);
  const [newTaskRecurrenceEndDate, setNewTaskRecurrenceEndDate] = useState<string>('');
  const [newTaskSubtasks, setNewTaskSubtasks] = useState<SubTask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isPomodoroOpen, setIsPomodoroOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState<Date | null>(null);
  const [quickCalendarOffset, setQuickCalendarOffset] = useState(0);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [activeUrgencyFilter, setActiveUrgencyFilter] = useState<Urgency | null>(null);
  const [activeTagColorId, setActiveTagColorId] = useState<string | null>(null);

  useEffect(() => {
    loadTasks();
    loadTags();
    notificationService.start();
    return () => notificationService.stop();
  }, []);

  // Mantém o agendador de notificações sincronizado com as tarefas atuais.
  useEffect(() => {
    notificationService.setTasks(tasks);
  }, [tasks]);

  // Atalhos de teclado (inativos ao digitar ou com modal aberto).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (isModalOpen || isManageTagsModalOpen || isSettingsOpen || isShortcutsOpen || detailTask || confirm) return;

      switch (e.key) {
        case 'n': case 'N':
          e.preventDefault(); resetModal(); setIsModalOpen(true); break;
        case '/':
          e.preventDefault(); searchInputRef.current?.focus(); break;
        case '?':
          e.preventDefault(); setIsShortcutsOpen(true); break;
        case 'i': case 'I':
          setActiveTab('inbox'); setSelectedDateFilter(null); break;
        case 'h': case 'H':
          setActiveTab('today'); setSelectedDateFilter(null); break;
        case 'c': case 'C':
          setActiveTab('calendar'); break;
        case 'a': case 'A':
          setActiveTab('agenda'); setSelectedDateFilter(null); break;
        case 'l': case 'L':
          setActiveTab('list'); setSelectedDateFilter(null); break;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen, isManageTagsModalOpen, isSettingsOpen, isShortcutsOpen, detailTask, confirm]);

  function loadTags() {
    setAvailableTags(tagService.getTags().map(t => t.name));
  }

  async function loadTasks() {
    setLoadingTasks(true);
    setError(null);
    try {
      await taskService.purgeExpired(30); // limpa a lixeira de itens com +30 dias
      const data = await taskService.getTasks();
      setTasks(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar tarefas');
    } finally {
      setLoadingTasks(false);
    }
  }

  async function handleToggleTask(task: Task) {
    try {
      const newCompleted = !task.completed;
      const newStatus = newCompleted ? 'done' : (task.status === 'done' ? 'todo' : task.status);
      const completedAt = newCompleted ? new Date().toISOString() : undefined;
      await taskService.updateTask(task.id, { completed: newCompleted, status: newStatus, completedAt });
      let updated = tasks.map(t => t.id === task.id ? { ...t, completed: newCompleted, status: newStatus, completedAt } : t);

      // Recorrência: ao concluir, gera a próxima ocorrência automaticamente.
      if (newCompleted && task.recurrence && task.recurrence !== 'none' && task.dueDate) {
        const next = await taskService.createRecurringNext({ ...task, completed: newCompleted, status: newStatus });
        if (next) updated = [next, ...updated];
      }

      setTasks(updated);
    } catch (err) {
      console.error('Failed to toggle task', err);
    }
  }

  function handleViewTask(task: Task) {
    setDetailTask(task);
  }

  function handleNewTaskAtDate(date: Date, hour = 9, minute = 0) {
    resetModal();
    const d = new Date(date);
    d.setHours(hour, minute, 0, 0);
    setNewTaskDate(format(d, "yyyy-MM-dd'T'HH:mm"));
    setIsModalOpen(true);
  }

  function handleEditFromDetail(task: Task) {
    setDetailTask(null);
    handleEditTask(task);
  }

  function handleEditTask(task: Task) {
    setEditingTask(task);
    setNewTaskTitle(task.title);
    setNewTaskDesc(task.description || '');
    setNewTaskUrgency(task.urgency);
    setNewTaskTags(task.tags || []);
    setNewTaskDate(task.dueDate ? format(parseISO(task.dueDate), "yyyy-MM-dd'T'HH:mm") : '');
    setNewTaskNotifications(task.notificationsEnabled ?? false);
    setNewTaskReminderMinutes(task.reminderMinutes ?? DEFAULT_REMINDER_MINUTES);
    setNewTaskRecurrence(task.recurrence ?? 'none');
    setNewTaskRecurrenceInterval(task.recurrenceInterval ?? 2);
    setNewTaskRecurrenceWeekdays(task.recurrenceWeekdays ?? []);
    setNewTaskRecurrenceEndType(task.recurrenceEndType ?? 'never');
    setNewTaskRecurrenceCount(task.recurrenceCount ?? 10);
    setNewTaskRecurrenceEndDate(task.recurrenceEndDate ? format(parseISO(task.recurrenceEndDate), 'yyyy-MM-dd') : '');
    setNewTaskSubtasks(task.subtasks ?? []);
    setNewSubtaskTitle('');
    setIsModalOpen(true);
  }

  function resetModal() {
    setEditingTask(null);
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskUrgency('medium');
    setNewTaskTags([]);
    setNewTaskDate('');
    setNewTaskNotifications(false);
    setNewTaskReminderMinutes(DEFAULT_REMINDER_MINUTES);
    setNewTaskRecurrence('none');
    setNewTaskRecurrenceInterval(2);
    setNewTaskRecurrenceWeekdays([]);
    setNewTaskRecurrenceEndType('never');
    setNewTaskRecurrenceCount(10);
    setNewTaskRecurrenceEndDate('');
    setNewTaskSubtasks([]);
    setNewSubtaskTitle('');
  }

  async function handleToggleNotifications(task: Task) {
    try {
      const next = !task.notificationsEnabled;
      await taskService.updateTask(task.id, { notificationsEnabled: next });
      setTasks(tasks.map(t => t.id === task.id ? { ...t, notificationsEnabled: next } : t));
    } catch (err) {
      console.error('Failed to toggle notifications', err);
    }
  }

  function requestArchiveCompleted() {
    const count = activeTasks.filter(t => t.completed).length;
    if (count === 0) return;
    setConfirm({
      title: 'Arquivar finalizadas',
      message: `Arquivar ${count} tarefa(s) finalizada(s)? Elas sairão do quadro e ficarão disponíveis na aba Arquivados.`,
      confirmLabel: 'Arquivar tudo',
      onConfirm: handleArchiveCompleted,
    });
  }

  async function handleArchiveCompleted() {
    try {
      const ids = await taskService.archiveCompleted();
      if (ids.length === 0) return;
      const now = new Date().toISOString();
      const idSet = new Set(ids);
      setTasks(tasks.map(t => idSet.has(t.id) ? { ...t, archived: true, archivedAt: now } : t));
    } catch (err) {
      console.error('Failed to archive completed tasks', err);
    }
  }

  function handleDeleteArchived(ids: string[]) {
    if (ids.length === 0) return;
    setConfirm({
      title: 'Mover para a lixeira',
      message: `Mover ${ids.length} tarefa(s) selecionada(s) para a lixeira?`,
      confirmLabel: 'Mover para lixeira',
      danger: true,
      onConfirm: async () => {
        const now = new Date().toISOString();
        await Promise.all(ids.map(id => taskService.deleteTask(id)));
        const idSet = new Set(ids);
        setTasks(prev => prev.map(t => idSet.has(t.id) ? { ...t, deleted: true, deletedAt: now } : t));
      },
    });
  }

  async function handleUnarchiveTask(task: Task) {
    try {
      await taskService.unarchiveTask(task.id);
      setTasks(tasks.map(t => t.id === task.id ? { ...t, archived: false, archivedAt: undefined } : t));
    } catch (err) {
      console.error('Failed to unarchive task', err);
    }
  }

  function addSubtask() {
    const title = newSubtaskTitle.trim();
    if (!title) return;
    setNewTaskSubtasks([...newTaskSubtasks, { id: crypto.randomUUID(), title, done: false }]);
    setNewSubtaskTitle('');
  }

  function toggleSubtask(id: string) {
    setNewTaskSubtasks(newTaskSubtasks.map(s => s.id === id ? { ...s, done: !s.done } : s));
  }

  function removeSubtask(id: string) {
    setNewTaskSubtasks(newTaskSubtasks.filter(s => s.id !== id));
  }

  async function handleSaveTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const taskData = {
        title: newTaskTitle,
        description: newTaskDesc,
        urgency: newTaskUrgency,
        tags: newTaskTags,
        dueDate: newTaskDate ? new Date(newTaskDate).toISOString() : undefined,
        notificationsEnabled: newTaskNotifications,
        reminderMinutes: newTaskReminderMinutes,
        recurrence: newTaskRecurrence,
        recurrenceInterval: newTaskRecurrence === 'everyN' ? Math.max(1, newTaskRecurrenceInterval) : undefined,
        recurrenceWeekdays: newTaskRecurrence === 'weekdays' ? newTaskRecurrenceWeekdays : undefined,
        recurrenceEndType: newTaskRecurrence !== 'none' ? newTaskRecurrenceEndType : undefined,
        recurrenceCount: newTaskRecurrence !== 'none' && newTaskRecurrenceEndType === 'count' ? Math.max(1, newTaskRecurrenceCount) : undefined,
        recurrenceEndDate: newTaskRecurrence !== 'none' && newTaskRecurrenceEndType === 'date' && newTaskRecurrenceEndDate ? new Date(newTaskRecurrenceEndDate).toISOString() : undefined,
        subtasks: newTaskSubtasks,
      };

      if (editingTask) {
        await taskService.updateTask(editingTask.id, taskData);
        setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, ...taskData } : t));
      } else {
        const newTask = await taskService.createTask({
          ...taskData,
          completed: false
        });
        setTasks([newTask, ...tasks]);
      }
      loadTags();
      setIsModalOpen(false);
      resetModal();
    } catch (err) {
      console.error('Failed to save task', err);
    }
  }

  async function handleDeleteTask() {
    if (!editingTask) return;
    try {
      const id = editingTask.id;
      await taskService.deleteTask(id); // soft delete -> lixeira
      const now = new Date().toISOString();
      setTasks(tasks.map(t => t.id === id ? { ...t, deleted: true, deletedAt: now } : t));
      setIsModalOpen(false);
      resetModal();
    } catch (err) {
      console.error('Failed to delete task', err);
    }
  }

  async function handleRestoreTask(task: Task) {
    try {
      await taskService.restoreTask(task.id);
      setTasks(tasks.map(t => t.id === task.id ? { ...t, deleted: false, deletedAt: undefined } : t));
    } catch (err) {
      console.error('Failed to restore task', err);
    }
  }

  function handleDeletePermanent(ids: string[]) {
    if (ids.length === 0) return;
    setConfirm({
      title: 'Apagar definitivamente',
      message: `Apagar ${ids.length} tarefa(s) para sempre? Não é possível recuperar.`,
      confirmLabel: 'Apagar para sempre',
      danger: true,
      onConfirm: async () => {
        await Promise.all(ids.map(id => taskService.permanentlyDelete(id)));
        const idSet = new Set(ids);
        setTasks(prev => prev.filter(t => !idSet.has(t.id)));
      },
    });
  }

  function handleEmptyTrash() {
    const count = tasks.filter(t => t.deleted).length;
    if (count === 0) return;
    setConfirm({
      title: 'Esvaziar lixeira',
      message: `Apagar para sempre as ${count} tarefa(s) da lixeira? Não é possível recuperar.`,
      confirmLabel: 'Esvaziar',
      danger: true,
      onConfirm: async () => {
        await taskService.emptyTrash();
        setTasks(prev => prev.filter(t => !t.deleted));
      },
    });
  }

  async function handleReorder(taskId: string, status: TaskStatus, targetTaskId: string | null) {
    const moving = tasks.find(t => t.id === taskId);
    if (!moving) return;
    const completed = status === 'done';
    const completedAt = completed ? (moving.completedAt || new Date().toISOString()) : undefined;

    // Coluna de destino (ativa, sem a tarefa que está sendo movida), ordenada.
    const col = tasks
      .filter(t => !t.archived && !t.deleted && (t.status || (t.completed ? 'done' : 'todo')) === status && t.id !== taskId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const idx = targetTaskId ? col.findIndex(t => t.id === targetTaskId) : col.length;
    col.splice(idx < 0 ? col.length : idx, 0, { ...moving, status, completed });

    const updates = col.map((t, i) => ({ id: t.id, order: i }));
    const orderMap = new Map(updates.map(u => [u.id, u.order]));

    setTasks(prev => prev.map(t => {
      if (t.id === taskId) return { ...t, status, completed, completedAt, order: orderMap.get(t.id) ?? t.order };
      if (orderMap.has(t.id)) return { ...t, order: orderMap.get(t.id) };
      return t;
    }));

    try {
      await taskService.updateTask(taskId, { status, completed, completedAt });
      await taskService.saveOrder(updates);
    } catch (err) {
      console.error('Failed to reorder', err);
      loadTasks();
    }
  }

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  // Filter tasks based on active tab
  // Filtros comuns (busca / tag / criticidade), aplicados em todas as views.
  const matchesCommonFilters = (task: Task) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!task.title.toLowerCase().includes(q) && !(task.description || '').toLowerCase().includes(q)) {
        return false;
      }
    }
    if (activeTagFilter && !task.tags.includes(activeTagFilter)) return false;
    if (activeUrgencyFilter && task.urgency !== activeUrgencyFilter) return false;
    return true;
  };

  // Tarefas ativas (não arquivadas, não deletadas) para as views normais.
  const activeTasks = tasks.filter(t => !t.archived && !t.deleted);
  const archivedTasks = tasks.filter(t => t.archived && !t.deleted);
  const deletedTasks = tasks.filter(t => t.deleted);
  const reportTasks = tasks.filter(t => !t.deleted); // ativas + arquivadas, para relatórios

  const filteredTasks = activeTasks.filter(task => {
    if (!matchesCommonFilters(task)) return false;

    if (activeTab === 'today') {
      // Deadline hoje OU sem deadline (sempre visível).
      return !task.dueDate || isToday(parseISO(task.dueDate));
    }

    if (activeTab === 'inbox') {
      if (selectedDateFilter) {
        // Tarefas do dia filtrado + tarefas sem deadline (sempre visíveis).
        return !task.dueDate || isSameDay(parseISO(task.dueDate), selectedDateFilter);
      }
      return true;
    }

    // 'all' e demais views: mostra tudo.
    return true;
  });

  // Lista do dia selecionado no Calendário (somente tarefas com deadline naquele dia).
  const calendarDayTasks = activeTasks.filter(task =>
    matchesCommonFilters(task) && task.dueDate && isSameDay(parseISO(task.dueDate), selectedDate)
  );

  // Contador de tarefas atrasadas (prazo já passou e não concluídas).
  const overdueCount = activeTasks.filter(t => !t.completed && t.dueDate && isPast(parseISO(t.dueDate))).length;

  const sidebarTags = availableTags;

  return (
    <div className="flex flex-col h-screen w-full bg-[#09090b] text-[#e4e4e7] font-sans antialiased overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (Glassy) */}
        <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 256 : 0, opacity: sidebarOpen ? 1 : 0 }}
        className="flex-shrink-0 h-full border-r border-white/5 bg-white/[0.02] backdrop-blur-2xl overflow-hidden flex flex-col z-50 relative"
      >
        <div className="p-6 flex items-center gap-3 w-64">
          <div className="w-8 h-8 flex items-center justify-center shrink-0">
            <img src="icon.png" alt="TuDu Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight whitespace-nowrap">TuDu</h1>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar w-64 pb-8 flex flex-col">
          <div className="mb-6 shrink-0">
            <div className="flex justify-between items-center px-2 mb-2">
              <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Views</p>
              {(activeTagFilter || activeUrgencyFilter) && (
                <button 
                  onClick={() => { setActiveTagFilter(null); setActiveUrgencyFilter(null); }}
                  className="text-[9px] text-zinc-400 hover:text-white uppercase font-bold tracking-wider"
                >
                  Limpar
                </button>
              )}
            </div>
            <NavItem icon={<Inbox size={16} />} label="Caixa de Entrada" active={activeTab === 'inbox'} onClick={() => { setActiveTab('inbox'); setSelectedDateFilter(null); }} />
            <NavItem icon={<Clock size={16} />} label="Hoje" active={activeTab === 'today'} onClick={() => { setActiveTab('today'); setSelectedDateFilter(null); }} />
            <NavItem icon={<Calendar size={16} />} label="Calendário" active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} />
            <NavItem icon={<CalendarClock size={16} />} label="Agenda" active={activeTab === 'agenda'} onClick={() => { setActiveTab('agenda'); setSelectedDateFilter(null); }} />
            <NavItem icon={<List size={16} />} label="Lista" active={activeTab === 'list'} onClick={() => { setActiveTab('list'); setSelectedDateFilter(null); }} />
            <NavItem icon={<BarChart3 size={16} />} label="Relatórios" active={activeTab === 'stats'} onClick={() => { setActiveTab('stats'); setSelectedDateFilter(null); }} />
            <NavItem icon={<Archive size={16} />} label="Arquivados" active={activeTab === 'archived'} onClick={() => { setActiveTab('archived'); setSelectedDateFilter(null); }} />
            <NavItem icon={<Trash2 size={16} />} label="Lixeira" active={activeTab === 'trash'} onClick={() => { setActiveTab('trash'); setSelectedDateFilter(null); }} />
            {overdueCount > 0 && (
              <button
                onClick={() => { setActiveTab('list'); setSelectedDateFilter(null); }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 mt-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-colors"
                title="Ver tarefas atrasadas"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle size={15} /> Atrasadas
                </span>
                <span className="text-xs font-bold bg-rose-500/20 px-2 py-0.5 rounded-full">{overdueCount}</span>
              </button>
            )}
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center px-2 mb-2">
              <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Tags</p>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-hide pr-2">
              {sidebarTags.length > 0 ? sidebarTags.map((tag) => {
                const color = tagService.getTagColor(tag);
                return (
                  <TagItem 
                    key={tag} 
                    color={color} 
                    label={tag} 
                    onColorChange={() => setTasks([...tasks])} 
                    isOpen={activeTagColorId === tag}
                    onToggleOpen={() => setActiveTagColorId(activeTagColorId === tag ? null : tag)}
                    isActive={activeTagFilter === tag}
                    onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                  />
                );
              }) : (
                <p className="text-xs text-zinc-500 italic px-2">Nenhuma tag ainda.</p>
              )}
            </div>
            <button 
              onClick={() => setIsManageTagsModalOpen(true)}
              className="mt-3 px-2 flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <Settings size={14} />
              <span>Gerenciar Tags</span>
            </button>
          </div>

          <div className="mb-6 shrink-0">
            <div className="px-2 mb-2">
              <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Criticidade</p>
            </div>
            <div className="space-y-1 px-2">
               {([{id: 'low', label: 'Baixa', color: 'bg-emerald-500'}, {id: 'medium', label: 'Média', color: 'bg-amber-500'}, {id: 'high', label: 'Alta', color: 'bg-orange-500'}, {id: 'critical', label: 'Crítica', color: 'bg-rose-500'}] as const).map(u => (
                  <div 
                    key={u.id}
                    onClick={() => setActiveUrgencyFilter(activeUrgencyFilter === u.id ? null : u.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer transition-colors rounded-md ${activeUrgencyFilter === u.id ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${u.color}`}></span>
                    {u.label}
                  </div>
               ))}
            </div>
          </div>
        </nav>

        <div className="p-4 w-64 mt-auto border-t border-white/5">
          <NavItem icon={<Settings size={16} />} label="Configurações" active={isSettingsOpen} onClick={() => setIsSettingsOpen(true)} />
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-zinc-950/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-md text-zinc-400 hover:bg-white/5 transition-colors"
            >
              <SidebarIcon size={18} />
            </button>
            <h2 className="text-sm font-medium text-zinc-400 capitalize">
               {activeTab === 'inbox' ? 'Caixa de Entrada' :
                activeTab === 'today' ? 'Hoje' :
                activeTab === 'calendar' ? format(selectedDate, "d 'de' MMMM", { locale: ptBR }) :
                activeTab === 'agenda' ? 'Agenda' :
                activeTab === 'list' ? 'Lista' :
                activeTab === 'stats' ? 'Relatórios' :
                activeTab === 'archived' ? 'Arquivados' :
                activeTab === 'trash' ? 'Lixeira' :
                'Caixa de Entrada'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Pesquisar tarefas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:bg-white/10 transition-all w-64"
              />
            </div>
            <button
              onClick={() => setIsPomodoroOpen(true)}
              title="Timer de foco (Pomodoro)"
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Timer size={18} />
            </button>
            <button
              onClick={() => setIsShortcutsOpen(true)}
              title="Atalhos de teclado (?)"
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Keyboard size={18} />
            </button>
            <button onClick={() => { resetModal(); setIsModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2">
              <Plus size={14} /> Nova Tarefa
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className={`flex-1 min-h-0 flex flex-col ${activeTab === 'calendar' || activeTab === 'agenda' || activeTab === 'list' || activeTab === 'archived' || activeTab === 'trash' ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'}`}>
          <div className="p-8 flex-1 flex flex-col min-h-0">
            
            {/* Dashboard Cards & Quick Calendar */}
            {(activeTab === 'inbox' || activeTab === 'today') && (
              <div className="flex flex-col xl:flex-row gap-8 mb-8 shrink-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 h-fit">
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-20">
                      <Check size={48} className="text-emerald-500" />
                    </div>
                    <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-1">Concluídas</h3>
                    <div className="text-3xl font-bold text-white">
                      {activeTasks.filter(t => t.completed).length}
                    </div>
                    <p className="text-xs text-emerald-500/80 mt-2">Total de tarefas finalizadas</p>
                  </div>

                  <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-20">
                      <Layout size={48} className="text-amber-500" />
                    </div>
                    <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1">Pendências</h3>
                    <div className="text-3xl font-bold text-white">
                      {activeTasks.filter(t => !t.completed).length}
                    </div>
                    <p className="text-xs text-amber-500/80 mt-2">{activeTasks.filter(t => !t.completed && t.urgency === 'critical').length} com prioridade crítica</p>
                  </div>

                  <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border border-indigo-500/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-20">
                      <Clock size={48} className="text-indigo-500" />
                    </div>
                    <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1">Progresso</h3>
                    <div className="text-3xl font-bold text-white">
                      {activeTasks.length > 0 ? Math.round((activeTasks.filter(t => t.completed).length / activeTasks.length) * 100) : 0}%
                    </div>
                    <p className="text-xs text-indigo-500/80 mt-2">Taxa de conclusão geral</p>
                  </div>
                </div>

                <div className="xl:w-80 shrink-0 bg-[#121214] border border-white/5 rounded-2xl p-5 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                      {format(
                        new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + (quickCalendarOffset * 7))),
                        'MMMM',
                        { locale: ptBR }
                      )}
                    </h3>
                    <div className="flex items-center gap-2">
                      {quickCalendarOffset !== 0 && (
                        <button
                          onClick={() => setQuickCalendarOffset(0)}
                          className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded hover:bg-white/5 transition-colors"
                          title="Voltar para a semana atual"
                        >
                          Ir até hoje
                        </button>
                      )}
                      <button onClick={() => setQuickCalendarOffset(prev => prev - 1)} className="p-1 hover:bg-white/5 rounded text-zinc-400 hover:text-white transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                      </button>
                      <button onClick={() => setQuickCalendarOffset(prev => prev + 1)} className="p-1 hover:bg-white/5 rounded text-zinc-400 hover:text-white transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-2 text-center text-[10px] mb-2">
                    <span className="text-zinc-600">D</span><span className="text-zinc-600">S</span><span className="text-zinc-600">T</span><span className="text-zinc-600">Q</span><span className="text-zinc-600">Q</span><span className="text-zinc-600 font-bold">S</span><span className="text-zinc-600 font-bold">S</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 7 }).map((_, i) => {
                      const d = new Date();
                      d.setDate(d.getDate() - d.getDay() + i + (quickCalendarOffset * 7)); // start from Sunday
                      const isTodayDate = isToday(d);
                      return (
                        <div 
                          key={i} 
                          onClick={() => {
                            setSelectedDateFilter(d);
                            setActiveTab('inbox');
                          }}
                          className={`aspect-square flex items-center justify-center text-xs rounded-lg cursor-pointer transition-colors ${
                            isTodayDate
                              ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/20'
                              : selectedDateFilter && isSameDay(d, selectedDateFilter)
                              ? 'bg-white/10 text-white font-bold border border-white/20'
                              : 'text-zinc-400 hover:bg-white/5'
                          }`}
                        >
                          {format(d, 'd')}
                        </div>
                      );
                    })}
                  </div>
                  {selectedDateFilter && (
                    <button 
                      onClick={() => setSelectedDateFilter(null)}
                      className="mt-4 text-xs text-indigo-400 hover:text-indigo-300 w-full text-center transition-colors"
                    >
                      Limpar filtro de data
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'inbox' || activeTab === 'today' || activeTab === 'all' ? (
              <div className="flex-1 min-h-[400px]">
                <KanbanBoard
                  tasks={filteredTasks}
                  onToggleTask={handleToggleTask}
                  onClickTask={handleEditTask}
                  onToggleNotifications={handleToggleNotifications}
                  onArchiveCompleted={requestArchiveCompleted}
                  onDragStart={handleDragStart}
                  onReorder={handleReorder}
                />
              </div>
            ) : null}

            {activeTab === 'archived' ? (
              <ArchivedView
                tasks={archivedTasks}
                onUnarchive={handleUnarchiveTask}
                onClickTask={handleEditTask}
                onDeleteMany={handleDeleteArchived}
              />
            ) : null}

            {activeTab === 'agenda' ? (
              <AgendaView
                tasks={activeTasks.filter(matchesCommonFilters)}
                onEditTask={handleEditTask}
                onCreateAt={(date, hour) => handleNewTaskAtDate(date, hour)}
              />
            ) : null}

            {activeTab === 'list' ? (
              <TaskListView
                tasks={activeTasks.filter(matchesCommonFilters)}
                onView={handleViewTask}
                onEdit={handleEditTask}
                onToggle={handleToggleTask}
              />
            ) : null}

            {activeTab === 'stats' ? (
              <StatsView tasks={reportTasks} />
            ) : null}

            {activeTab === 'trash' ? (
              <TrashView
                tasks={deletedTasks}
                onRestore={handleRestoreTask}
                onDeletePermanent={handleDeletePermanent}
                onEmptyTrash={handleEmptyTrash}
              />
            ) : null}

            {activeTab === 'calendar' ? (
              <div className="flex gap-6 flex-1 min-h-0">
                {/* Grade do mês */}
                <div className="flex-1 min-h-0 bg-[#121214] border border-white/5 rounded-2xl p-5">
                  <MonthlyCalendar
                    currentDate={calendarMonth}
                    onMonthChange={setCalendarMonth}
                    selectedDate={selectedDate}
                    onSelectDate={(d) => setSelectedDate(d)}
                    onSelectTask={handleViewTask}
                    tasks={activeTasks}
                  />
                </div>

                {/* Painel do dia selecionado */}
                <div className="w-80 shrink-0 flex flex-col min-h-0 bg-[#121214] border border-white/5 rounded-2xl">
                  <div className="p-4 border-b border-white/5 shrink-0 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white capitalize">{format(selectedDate, 'EEEE', { locale: ptBR })}</p>
                      <p className="text-xs text-zinc-500 capitalize">{format(selectedDate, "d 'de' MMMM", { locale: ptBR })}</p>
                    </div>
                    <button
                      onClick={() => handleNewTaskAtDate(selectedDate)}
                      title="Nova tarefa neste dia"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-3">
                    {calendarDayTasks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center text-center h-full text-zinc-600 py-10">
                        <Calendar size={28} className="mb-2 opacity-40" />
                        <p className="text-xs">Nenhuma tarefa com prazo neste dia.</p>
                      </div>
                    ) : (
                      calendarDayTasks.map(task => (
                        <TaskItem
                          key={task.id}
                          title={task.title}
                          description={task.description}
                          urgency={task.urgency}
                          tags={task.tags}
                          time={task.dueDate}
                          completed={task.completed}
                          notificationsEnabled={task.notificationsEnabled}
                          recurrence={task.recurrence}
                          subtasks={task.subtasks}
                          onToggle={() => handleToggleTask(task)}
                          onToggleNotifications={() => handleToggleNotifications(task)}
                          onEdit={() => handleEditTask(task)}
                          onClick={() => handleViewTask(task)}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </main>

      {/* New Task Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          resetModal();
        }} 
        title={editingTask ? "Editar Tarefa" : "Nova Tarefa"}
      >
        <form onSubmit={handleSaveTask} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Título</label>
            <input
              type="text"
              required
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="Ex: Comprar mantimentos"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Descrição (opcional)</label>
            <textarea
              value={newTaskDesc}
              onChange={(e) => setNewTaskDesc(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors h-20 resize-none"
              placeholder="Detalhes da tarefa..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Urgência</label>
              <select
                value={newTaskUrgency}
                onChange={(e) => setNewTaskUrgency(e.target.value as Urgency)}
                className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Data de Entrega</label>
              <input
                type="datetime-local"
                value={newTaskDate}
                onChange={(e) => setNewTaskDate(e.target.value)}
                className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors [color-scheme:dark]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Tags</label>
            <TagInput selectedTags={newTaskTags} onChange={setNewTaskTags} />
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                type="button"
                onClick={() => setNewTaskNotifications(v => !v)}
                className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${newTaskNotifications ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-zinc-500 hover:border-indigo-500'}`}
              >
                {newTaskNotifications && <Check size={10} strokeWidth={4} />}
              </button>
              <span className="flex items-center gap-2 text-sm text-white">
                {newTaskNotifications ? <Bell size={14} className="text-indigo-400" /> : <BellOff size={14} className="text-zinc-500" />}
                Ativar notificações
              </span>
            </label>
            {newTaskNotifications && (
              <div className="mt-3 pl-7">
                <label className="block text-xs font-medium text-zinc-400 mb-1">Lembrar antes do prazo</label>
                <select
                  value={newTaskReminderMinutes}
                  onChange={(e) => setNewTaskReminderMinutes(Number(e.target.value))}
                  className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
                >
                  <option value={10}>10 minutos antes</option>
                  <option value={30}>30 minutos antes</option>
                  <option value={45}>45 minutos antes</option>
                  <option value={60}>1 hora antes</option>
                  <option value={120}>2 horas antes</option>
                  <option value={180}>3 horas antes</option>
                  <option value={360}>6 horas antes</option>
                  <option value={720}>12 horas antes</option>
                  <option value={1440}>1 dia antes</option>
                </select>
                <p className="text-[10px] text-zinc-500 mt-1.5">Você recebe um lembrete com essa antecedência e outro na hora exata do prazo. Requer uma data de entrega definida.</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Repetir</label>
            <select
              value={newTaskRecurrence}
              onChange={(e) => setNewTaskRecurrence(e.target.value as Recurrence)}
              className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
            >
              <option value="none">Não repetir</option>
              <option value="daily">Diariamente</option>
              <option value="weekly">Semanalmente</option>
              <option value="monthly">Mensalmente</option>
              <option value="everyN">A cada N dias</option>
              <option value="weekdays">Dias específicos da semana</option>
            </select>

            {newTaskRecurrence === 'everyN' && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-zinc-400">A cada</span>
                <input
                  type="number"
                  min={1}
                  value={newTaskRecurrenceInterval}
                  onChange={(e) => setNewTaskRecurrenceInterval(Number(e.target.value))}
                  className="w-20 bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                />
                <span className="text-xs text-zinc-400">dia(s)</span>
              </div>
            )}

            {newTaskRecurrence === 'weekdays' && (
              <div className="mt-3 flex gap-1.5">
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((lbl, i) => {
                  const on = newTaskRecurrenceWeekdays.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setNewTaskRecurrenceWeekdays(on ? newTaskRecurrenceWeekdays.filter(d => d !== i) : [...newTaskRecurrenceWeekdays, i])}
                      className={`w-8 h-8 rounded-full text-xs font-semibold transition-colors ${on ? 'bg-indigo-600 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
            )}

            {newTaskRecurrence !== 'none' && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-zinc-400 mb-1">Termina</label>
                <select
                  value={newTaskRecurrenceEndType}
                  onChange={(e) => setNewTaskRecurrenceEndType(e.target.value as RecurrenceEnd)}
                  className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
                >
                  <option value="never">Nunca</option>
                  <option value="count">Após um número de ocorrências</option>
                  <option value="date">Em uma data</option>
                </select>
                {newTaskRecurrenceEndType === 'count' && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-zinc-400">Após</span>
                    <input
                      type="number"
                      min={1}
                      value={newTaskRecurrenceCount}
                      onChange={(e) => setNewTaskRecurrenceCount(Number(e.target.value))}
                      className="w-20 bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                    />
                    <span className="text-xs text-zinc-400">ocorrência(s)</span>
                  </div>
                )}
                {newTaskRecurrenceEndType === 'date' && (
                  <input
                    type="date"
                    value={newTaskRecurrenceEndDate}
                    onChange={(e) => setNewTaskRecurrenceEndDate(e.target.value)}
                    className="mt-2 w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                  />
                )}
                <p className="text-[10px] text-zinc-500 mt-1.5">Ao concluir, uma nova ocorrência é criada com o prazo avançado. Requer data de entrega.</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Subtarefas</label>
            {newTaskSubtasks.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {newTaskSubtasks.map(sub => (
                  <div key={sub.id} className="flex items-center gap-2 group">
                    <button
                      type="button"
                      onClick={() => toggleSubtask(sub.id)}
                      className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${sub.done ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-zinc-500 hover:border-indigo-500'}`}
                    >
                      {sub.done && <Check size={10} strokeWidth={4} />}
                    </button>
                    <span className={`flex-1 text-sm ${sub.done ? 'line-through text-zinc-500' : 'text-white'}`}>{sub.title}</span>
                    <button type="button" onClick={() => removeSubtask(sub.id)} className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 transition-all">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="Adicionar item do checklist..."
              />
              <button type="button" onClick={addSubtask} className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-zinc-300 hover:text-white transition-colors">
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/10">
            <div>
              {editingTask && (
                <button
                  type="button"
                  onClick={() => setConfirm({
                    title: 'Excluir tarefa',
                    message: `Excluir "${editingTask.title}"? Essa ação não pode ser desfeita.`,
                    confirmLabel: 'Excluir',
                    danger: true,
                    onConfirm: handleDeleteTask,
                  })}
                  className="px-4 py-2 text-sm font-medium text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                >
                  Excluir
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-6 py-2 rounded-lg transition-all shadow-lg shadow-indigo-600/20"
              >
                {editingTask ? "Salvar Alterações" : "Criar Tarefa"}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <ManageTagsModal
        isOpen={isManageTagsModalOpen}
        onClose={() => setIsManageTagsModalOpen(false)}
        onTagsUpdated={loadTags}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onDataImported={() => { loadTasks(); loadTags(); }}
      />

      <TaskDetailModal
        isOpen={!!detailTask}
        task={detailTask}
        onClose={() => setDetailTask(null)}
        onEdit={handleEditFromDetail}
      />

      <ConfirmDialog
        isOpen={!!confirm}
        title={confirm?.title || ''}
        message={confirm?.message || ''}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        onConfirm={() => confirm?.onConfirm()}
        onClose={() => setConfirm(null)}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <PomodoroModal
        isOpen={isPomodoroOpen}
        onClose={() => setIsPomodoroOpen(false)}
        tasks={activeTasks.filter(t => !t.completed)}
      />
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors mt-1 ${
        active
          ? 'bg-white/10 text-white'
          : 'text-zinc-400 hover:bg-white/5'
      }`}
    >
      <div className={active ? "text-indigo-400" : ""}>{icon}</div>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function TagItem({ color, label, onColorChange, isOpen, onToggleOpen, isActive, onClick }: { key?: React.Key; color: string; label: string; onColorChange?: () => void; isOpen: boolean; onToggleOpen: () => void; isActive: boolean; onClick: () => void }) {
  const [currentColor, setCurrentColor] = useState(color);

  const handleColorSelect = (newColor: string) => {
    setCurrentColor(newColor);
    tagService.addTag(label, newColor);
    onToggleOpen(); // close it
    if (onColorChange) onColorChange();
  };

  return (
    <div className="relative group">
      <div 
        className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer transition-colors justify-between rounded-md ${isActive ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
      >
        <div className="flex items-center gap-2 flex-1" onClick={onClick}>
          <span className={`w-2 h-2 rounded-full ${currentColor}`}></span> {label}
        </div>
        <div 
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
          onClick={(e) => { e.stopPropagation(); onToggleOpen(); }}
        >
          <Settings size={12} className="text-zinc-500 hover:text-zinc-300" />
        </div>
      </div>
      
      {isOpen && (
        <div className="mt-2 bg-[#18181b] border border-white/10 rounded-lg p-2 shadow-inner flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
          {PREDEFINED_COLORS.map(c => (
             <button 
               key={c}
               onClick={() => handleColorSelect(c)}
               className={`w-5 h-5 rounded-full ${c} ${c === currentColor ? 'ring-2 ring-white scale-110' : 'hover:scale-110'} transition-transform`}
             />
          ))}
        </div>
      )}
    </div>
  );
}
