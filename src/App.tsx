import React, { useState, useEffect } from 'react';
import { AlertTriangle, Archive, BarChart3, Bell, BellOff, Calendar, CalendarClock, Check, ChevronDown, Clock, Diamond, FolderKanban, GripVertical, HelpCircle, Inbox, Keyboard, Layout, List, Plus, Search, Settings, Sidebar as SidebarIcon, Timer, Trash2, Users, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Task, Urgency, Recurrence, RecurrenceEnd, SubTask, TaskStatus, Attachment, Template } from './types';
import { taskService } from './services/tasks';
import { notificationService, DEFAULT_REMINDER_MINUTES } from './services/notifications';
import { parseQuickAdd } from './services/quickAdd';
import { themeService } from './services/theme';
import { Modal } from './components/Modal';
import { MonthlyCalendar } from './components/MonthlyCalendar';
import { KanbanBoard } from './components/KanbanBoard';
import { TaskItem } from './components/TaskItem';
import { TaskContextMenu, TaskMenuState } from './components/TaskContextMenu';
import { ArchivedView } from './components/ArchivedView';
import { TaskDetailModal } from './components/TaskDetailModal';
import { AgendaView } from './components/AgendaView';
import { TaskListView } from './components/TaskListView';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ShortcutsModal } from './components/ShortcutsModal';
import { TrashView } from './components/TrashView';
import { StatsView } from './components/StatsView';
import { PomodoroModal } from './components/PomodoroModal';
import { PomodoroBar } from './components/PomodoroBar';
import { CalendarHelpModal } from './components/CalendarHelpModal';
import { QuickCalendar } from './components/QuickCalendar';
import { QuickCalendarHelpModal } from './components/QuickCalendarHelpModal';
import { usePomodoro } from './hooks/usePomodoro';
import { ToastHost, Toast } from './components/ToastHost';
import { CommandPalette } from './components/CommandPalette';
import { ProjectView } from './components/ProjectView';
import { TeamView } from './components/TeamView';
import { AppMenu } from './components/AppMenu';
import { AttachmentsEditor } from './components/Attachments';
import { DateTimePicker } from './components/DateTimePicker';
import { GITHUB_URL, settingsService } from './services/settings';
import { ManagePersonasModal } from './components/ManagePersonasModal';
import { ProjectSettingsModal } from './components/ProjectSettingsModal';
import { ProjectsManagerView } from './components/ProjectsManagerView';
import { RoadmapReviewModal } from './components/RoadmapReviewModal';
import { TemplatesModal } from './components/TemplatesModal';
import { MilestoneHelpModal } from './components/MilestoneHelpModal';
import { PromptDialog, PromptState } from './components/PromptDialog';
import { templateService } from './services/templates';
import { startBridgeListener, respondOk, respondError, PendingReview } from './services/bridge';
import { applyPlan } from './services/roadmap';
import { backupService } from './services/backup';
import { taskMatches } from './services/search';
import { attachmentService } from './services/attachments';
import { useSortableList } from './hooks/useSortableList';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { projectService, sortEpics } from './services/projects';
import { personaService } from './services/personas';
import { columnsFor, statusLabel as resolveStatusLabel, statusColor as resolveStatusColor } from './services/boards';
import { format, isToday, isSameDay, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { TagInput } from './components/TagInput';
import { tagService, PREDEFINED_COLORS } from './services/tags';
import { ManageTagsModal } from './components/ManageTagsModal';
import { SettingsModal } from './components/SettingsModal';
import { TitleBar } from './components/TitleBar';

const BOARD_PROJECT_TASKS_KEY = 'tudu_board_project_tasks';

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
  const [detailFocusComments, setDetailFocusComments] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void } | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskUrgency, setNewTaskUrgency] = useState<Urgency>('medium');
  const [newTaskTags, setNewTaskTags] = useState<string[]>([]);
  const [newTaskDate, setNewTaskDate] = useState<string>('');
  const [newTaskStartDate, setNewTaskStartDate] = useState<string>('');
  const [newTaskAttachments, setNewTaskAttachments] = useState<Attachment[]>([]);
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
  const [modalStep, setModalStep] = useState(0);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isPomodoroOpen, setIsPomodoroOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
  const [settingsProjectId, setSettingsProjectId] = useState<string | null>(null);
  const [isPersonasModalOpen, setIsPersonasModalOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isMilestoneHelpOpen, setIsMilestoneHelpOpen] = useState(false);
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const [taskMenu, setTaskMenu] = useState<TaskMenuState | null>(null);
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>('');
  const [newTaskEpicId, setNewTaskEpicId] = useState<string>('');
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState<string>('');
  const [newTaskMilestone, setNewTaskMilestone] = useState(false);
  const [newTaskDependsOn, setNewTaskDependsOn] = useState<string[]>([]);
  const [newTaskEstimate, setNewTaskEstimate] = useState<string>('');

  // Camada gerencial (reativa via Dexie).
  const projects = useLiveQuery(() => db.projects.orderBy('createdAt').toArray(), []) ?? [];
  const epics = sortEpics(useLiveQuery(() => db.epics.toArray(), []) ?? []);
  const personas = useLiveQuery(() => db.personas.orderBy('name').toArray(), []) ?? [];
  const personaById = (id?: string) => id ? personas.find(p => p.id === id) : undefined;
  const epicById = (id?: string) => id ? epics.find(e => e.id === id) : undefined;
  const projectById = (id?: string) => id ? projects.find(p => p.id === id) : undefined;
  const activeProjects = projects.filter(p => !p.archived);

  // Board principal: mostrar (ou não) as tarefas que pertencem a projetos.
  const [showProjectTasks, setShowProjectTasks] = useState<boolean>(() => {
    try { return localStorage.getItem(BOARD_PROJECT_TASKS_KEY) !== '0'; } catch { return true; }
  });

  useEffect(() => {
    try { localStorage.setItem(BOARD_PROJECT_TASKS_KEY, showProjectTasks ? '1' : '0'); } catch { /* ignore */ }
  }, [showProjectTasks]);

  // Modo foco: o estado vive aqui, fora do modal, para a barrinha do topo e o
  // painel olharem para o mesmo timer.
  const pomo = usePomodoro({
    onLogTime: (taskId, minutes) => handleLogTime(taskId, minutes, 'pomodoro'),
  });

  const [isCalendarHelpOpen, setIsCalendarHelpOpen] = useState(false);
  const [isQuickCalendarHelpOpen, setIsQuickCalendarHelpOpen] = useState(false);
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
    const stopBackup = backupService.startAutoBackup();
    return () => { notificationService.stop(); stopBackup(); };
  }, []);

  // Captura rápida: o texto vem da janelinha do atalho global e vira tarefa aqui
  // (só este renderer enxerga o banco). A confirmação volta para ela.
  useEffect(() => {
    const b = typeof window !== 'undefined' ? window.tudu : null;
    if (!b?.capture) return;
    return b.capture.onText(async (text) => {
      const task = await handleQuickAdd(text, { silent: true });
      if (task) b.capture!.saved(task.title);
    });
  }, []);

  // Ponte local: agentes de IA propõem, o usuário confirma na tela de revisão.
  useEffect(() => {
    return startBridgeListener({
      onReview: (review) => setPendingReview(review),
      onCancel: (id) => setPendingReview(prev => (prev?.id === id ? null : prev)),
      onApplied: (resumo) => {
        loadTasks();
        loadTags();
        showToast(`Agente criou ${resumo.tarefas} tarefa(s) e ${resumo.epicos} épico(s).`);
      },
    });
  }, []);

  async function confirmPendingReview() {
    if (!pendingReview) return;
    const { id, plan } = pendingReview;
    setPendingReview(null);
    try {
      const resumo = await applyPlan(plan);
      await loadTasks();
      loadTags();
      respondOk(id, {
        status: 'aplicado',
        projectId: resumo.projectId,
        criados: plan.summary,
        avisos: plan.warnings,
      });
      showToast(`${resumo.tarefas} tarefa(s) criada(s) em "${plan.project.record.name}".`, {
        actionLabel: 'Abrir projeto',
        onAction: () => { setActiveProjectId(resumo.projectId); setActiveTab('project'); },
      });
    } catch (err) {
      respondError(id, err instanceof Error ? err.message : 'Falha ao gravar.', 500);
      showToast('Não foi possível aplicar a proposta do agente.');
    }
  }

  function rejectPendingReview() {
    if (!pendingReview) return;
    respondError(pendingReview.id, 'Proposta recusada no TuDu.', 409);
    setPendingReview(null);
  }

  // Mantém o agendador de notificações sincronizado com as tarefas atuais.
  useEffect(() => {
    notificationService.setTasks(tasks);
  }, [tasks]);

  // Atalhos de teclado (inativos ao digitar ou com modal aberto).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Command Palette: Ctrl/Cmd+K funciona globalmente.
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsPaletteOpen(v => !v);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (isModalOpen || isManageTagsModalOpen || isSettingsOpen || isShortcutsOpen || isPaletteOpen || detailTask || confirm) return;

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
        case 'p': case 'P':
          setActiveTab('projects'); setSelectedDateFilter(null); break;
        case 'e': case 'E':
          setActiveTab('team'); setSelectedDateFilter(null); break;
        case 'r': case 'R':
          setActiveTab('stats'); setSelectedDateFilter(null); break;
        case 't': case 'T':
          e.preventDefault(); setIsPomodoroOpen(true); break;
        case ',':
          e.preventDefault(); setIsSettingsOpen(true); break;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen, isManageTagsModalOpen, isSettingsOpen, isShortcutsOpen, isPaletteOpen, detailTask, confirm]);

  function loadTags() {
    setAvailableTags(tagService.getTags().map(t => t.name));
  }

  function dismissToast(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  function handleDeleteProject(id: string, name: string) {
    setConfirm({
      title: 'Excluir projeto',
      message: `Excluir "${name}"? Os épicos serão removidos e as tarefas desvinculadas (elas não são apagadas).`,
      confirmLabel: 'Excluir',
      danger: true,
      onConfirm: async () => {
        await projectService.remove(id);
        if (activeProjectId === id) { setActiveProjectId(null); setActiveTab('inbox'); }
        loadTasks();
      },
    });
  }

  function handleDeletePersona(id: string, name: string) {
    setConfirm({
      title: 'Excluir persona',
      message: `Excluir "${name}"? As tarefas atribuídas a ela ficarão sem responsável.`,
      confirmLabel: 'Excluir',
      danger: true,
      onConfirm: async () => {
        await personaService.remove(id);
        loadTasks();
      },
    });
  }

  function showToast(message: string, opts?: { actionLabel?: string; onAction?: () => void }) {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, ...opts }]);
    setTimeout(() => dismissToast(id), 6000);
  }

  async function loadTasks() {
    setLoadingTasks(true);
    setError(null);
    try {
      await taskService.purgeExpired(30); // limpa a lixeira de itens com +30 dias
      const data = await taskService.getTasks();
      setTasks(data);

      // Anexos: leva os antigos (base64 no banco) para disco e recolhe os
      // arquivos que sobraram de tarefas apagadas de vez.
      const movidos = await attachmentService.migrateLegacy();
      if (movidos > 0) {
        const atualizadas = await taskService.getTasks();
        setTasks(atualizadas);
        showToast(`${movidos} anexo(s) movido(s) do banco para arquivos — o app fica mais leve.`);
        attachmentService.pruneOrphans(atualizadas);
      } else {
        attachmentService.pruneOrphans(data);
      }
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
    setDetailFocusComments(false);
    setDetailTask(task);
  }

  function openTaskMenu(e: React.MouseEvent, task: Task) {
    e.preventDefault();
    e.stopPropagation();
    setTaskMenu({ x: e.clientX, y: e.clientY, task });
  }

  function handleNewTaskAtDate(date: Date, hour = 9, minute = 0) {
    resetModal();
    const d = new Date(date);
    d.setHours(hour, minute, 0, 0);
    setNewTaskDate(format(d, "yyyy-MM-dd'T'HH:mm"));
    setIsModalOpen(true);
  }

  async function handleQuickAdd(input: string, opts?: { silent?: boolean }): Promise<Task | null> {
    const parsed = parseQuickAdd(input);
    if (!parsed.title) return null;
    try {
      // Registra tags novas com uma cor padrão (não sobrescreve as existentes).
      parsed.tags.forEach(tag => {
        if (!tagService.getTags().some(t => t.name.toLowerCase() === tag.toLowerCase())) {
          tagService.addTag(tag, PREDEFINED_COLORS[Math.floor(Math.random() * PREDEFINED_COLORS.length)]);
        }
      });
      const newTask = await taskService.createTask({
        title: parsed.title,
        description: '',
        urgency: parsed.urgency ?? 'medium',
        tags: parsed.tags,
        dueDate: parsed.dueDate ? parsed.dueDate.toISOString() : undefined,
        notificationsEnabled: false,
        completed: false,
      });
      setTasks(prev => [newTask, ...prev]);
      loadTags();
      // Na captura global a janela pode estar escondida: quem confirma é a
      // própria janelinha, então o toast aqui só apareceria depois, sem contexto.
      if (!opts?.silent) {
        showToast(`Tarefa criada: "${parsed.title}"`, {
          actionLabel: 'Editar',
          onAction: () => handleEditTask(newTask),
        });
      }
      return newTask;
    } catch (err) {
      console.error('Failed to quick-add task', err);
      return null;
    }
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
    setNewTaskStartDate(task.startDate ? format(parseISO(task.startDate), "yyyy-MM-dd'T'HH:mm") : '');
    setNewTaskAttachments(task.attachments ?? []);
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
    setNewTaskProjectId(task.projectId ?? '');
    setNewTaskEpicId(task.epicId ?? '');
    setNewTaskAssigneeId(task.assigneeId ?? '');
    setNewTaskMilestone(!!task.milestone);
    setNewTaskDependsOn(task.dependsOn ?? []);
    setNewTaskEstimate(task.estimateMinutes ? String(task.estimateMinutes / 60) : '');
    setModalStep(0);
    setModalError(null);
    setIsModalOpen(true);
  }

  function resetModal() {
    setEditingTask(null);
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskUrgency('medium');
    setNewTaskTags([]);
    setNewTaskDate('');
    setNewTaskStartDate('');
    setNewTaskAttachments([]);
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
    // Ao criar dentro de um projeto, já vincula a ele.
    setNewTaskProjectId(activeTab === 'project' && activeProjectId ? activeProjectId : '');
    setNewTaskEpicId('');
    setNewTaskAssigneeId('');
    setNewTaskMilestone(false);
    setNewTaskDependsOn([]);
    setNewTaskEstimate('');
    setModalStep(0);
    setModalError(null);
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

  async function requestArchiveCompleted() {
    try {
      const ids = await taskService.archiveCompleted();
      if (ids.length === 0) return;
      const now = new Date().toISOString();
      const idSet = new Set(ids);
      setTasks(prev => prev.map(t => idSet.has(t.id) ? { ...t, archived: true, archivedAt: now } : t));
      showToast(`${ids.length} tarefa(s) arquivada(s).`, {
        actionLabel: 'Desfazer',
        onAction: async () => {
          await Promise.all(ids.map(id => taskService.unarchiveTask(id)));
          setTasks(prev => prev.map(t => idSet.has(t.id) ? { ...t, archived: false, archivedAt: undefined } : t));
        },
      });
    } catch (err) {
      console.error('Failed to archive completed tasks', err);
    }
  }

  async function handleDeleteArchived(ids: string[]) {
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    const idSet = new Set(ids);
    await Promise.all(ids.map(id => taskService.deleteTask(id)));
    setTasks(prev => prev.map(t => idSet.has(t.id) ? { ...t, deleted: true, deletedAt: now } : t));
    showToast(`${ids.length} tarefa(s) movida(s) para a lixeira.`, {
      actionLabel: 'Desfazer',
      onAction: async () => {
        await Promise.all(ids.map(id => taskService.restoreTask(id)));
        setTasks(prev => prev.map(t => idSet.has(t.id) ? { ...t, deleted: false, deletedAt: undefined } : t));
      },
    });
  }

  /** Arquiva uma tarefa só (pelo menu de contexto, com a tarefa finalizada). */
  async function handleArchiveTask(task: Task) {
    try {
      const archivedAt = await taskService.archiveTask(task.id);
      applyTaskPatch(task.id, { archived: true, archivedAt });
      showToast(`"${task.title}" arquivada.`, {
        actionLabel: 'Desfazer',
        onAction: async () => {
          await taskService.unarchiveTask(task.id);
          applyTaskPatch(task.id, { archived: false, archivedAt: undefined });
        },
      });
    } catch (err) {
      console.error('Failed to archive task', err);
      showToast('Não foi possível arquivar a tarefa.');
    }
  }

  async function handleUnarchiveTask(task: Task) {
    try {
      await taskService.unarchiveTask(task.id);
      setTasks(tasks.map(t => t.id === task.id ? { ...t, archived: false, archivedAt: undefined } : t));
    } catch (err) {
      console.error('Failed to unarchive task', err);
    }
  }

  // Reordenação das subtarefas no formulário (arrastar pelo punho).
  const subtaskSort = useSortableList(
    newTaskSubtasks.map(s => s.id),
    (ids) => setNewTaskSubtasks(ids.map(id => newTaskSubtasks.find(s => s.id === id)!)),
    'y'
  );

  function addSubtask() {
    const title = newSubtaskTitle.trim();
    if (!title) return;
    setNewTaskSubtasks([...newTaskSubtasks, { id: crypto.randomUUID(), title, done: false }]);
    setNewSubtaskTitle('');
  }

  function toggleSubtask(id: string) {
    setNewTaskSubtasks(newTaskSubtasks.map(s => s.id === id ? { ...s, done: !s.done } : s));
  }

  /** Marca/desmarca uma subtarefa direto no card, sem abrir a tarefa. */
  async function handleToggleSubtask(task: Task, subtaskId: string) {
    const subtasks = (task.subtasks ?? []).map(s => s.id === subtaskId ? { ...s, done: !s.done } : s);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, subtasks } : t));
    try {
      await taskService.updateTask(task.id, { subtasks });
    } catch {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, subtasks: task.subtasks } : t));
      showToast('Não foi possível salvar a subtarefa.');
    }
  }

  /**
   * Espelha nas cópias que a interface segura (lista, detalhe aberto e menu de
   * contexto) uma alteração que já foi gravada no banco.
   */
  function applyTaskPatch(id: string, patch: Partial<Task>) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    setDetailTask(prev => prev && prev.id === id ? { ...prev, ...patch } : prev);
    setTaskMenu(prev => prev && prev.task.id === id ? { ...prev, task: { ...prev.task, ...patch } } : prev);
  }

  /** Comentário de conclusão: só entra em tarefa finalizada. */
  async function handleAddComment(task: Task, text: string) {
    const conteudo = text.trim();
    if (!conteudo || !task.completed) return;
    try {
      const comments = await taskService.addComment(task.id, conteudo);
      applyTaskPatch(task.id, { comments });
    } catch (err) {
      console.error('Failed to add comment', err);
      showToast('Não foi possível salvar o comentário.');
    }
  }

  async function handleDeleteComment(task: Task, commentId: string) {
    try {
      const comments = await taskService.removeComment(task.id, commentId);
      applyTaskPatch(task.id, { comments });
    } catch (err) {
      console.error('Failed to remove comment', err);
      showToast('Não foi possível apagar o comentário.');
    }
  }

  /* ---- Modelos (templates) ---- */

  function handleSaveTaskTemplate(task: Task) {
    setPrompt({
      title: 'Salvar tarefa como modelo',
      message: 'Guarda título, descrição, tags, checklist e estimativa. O prazo vira uma distância em dias, recalculada a cada uso.',
      label: 'Nome do modelo',
      defaultValue: task.title,
      onConfirm: async (nome) => {
        await templateService.saveTask(nome, task);
        showToast(`Modelo "${nome}" salvo.`, {
          actionLabel: 'Ver modelos',
          onAction: () => setIsTemplatesOpen(true),
        });
      },
    });
  }

  function handleSaveProjectTemplate(projectId: string) {
    const projeto = projectById(projectId);
    if (!projeto) return;
    const ativas = tasks.filter(t => t.projectId === projectId && !t.archived && !t.deleted).length;
    setPrompt({
      title: 'Salvar projeto como modelo',
      message: `Guarda os épicos, as colunas do board e as ${ativas} tarefa(s) ativas deste projeto.`,
      label: 'Nome do modelo',
      defaultValue: projeto.name,
      onConfirm: async (nome) => {
        await templateService.saveProject(nome, projeto, epics, tasks);
        showToast(`Modelo "${nome}" salvo.`, {
          actionLabel: 'Ver modelos',
          onAction: () => setIsTemplatesOpen(true),
        });
      },
    });
  }

  async function handleUseTaskTemplate(template: Template) {
    const criada = await templateService.createTaskFrom(template, {
      projectId: activeTab === 'project' && activeProjectId ? activeProjectId : undefined,
    });
    if (!criada) return;
    setTasks(prev => [criada, ...prev]);
    loadTags();
    setIsTemplatesOpen(false);
    showToast(`Tarefa criada de "${template.name}".`, {
      actionLabel: 'Editar',
      onAction: () => handleEditTask(criada),
    });
  }

  async function handleUseProjectTemplate(template: Template, nome: string) {
    const novoId = await templateService.createProjectFrom(template, nome);
    if (!novoId) return;
    await loadTasks();
    loadTags();
    setIsTemplatesOpen(false);
    setActiveProjectId(novoId);
    setActiveTab('project');
    showToast(`Projeto criado de "${template.name}".`);
  }

  /** Apontamento de tempo (bloco do Pomodoro ou lançamento manual). */
  async function handleLogTime(taskId: string, minutes: number, source: 'pomodoro' | 'manual' = 'pomodoro') {
    try {
      const { spentMinutes, timeEntries } = await taskService.addTimeEntry(taskId, minutes, source);
      applyTaskPatch(taskId, { spentMinutes, timeEntries });
      if (source === 'pomodoro') {
        const nome = tasks.find(t => t.id === taskId)?.title ?? 'tarefa';
        showToast(`${minutes} min lançados em "${nome}".`);
      }
    } catch (err) {
      console.error('Failed to log time', err);
      showToast('Não foi possível lançar o tempo.');
    }
  }

  async function handleRemoveTimeEntry(taskId: string, entryId: string) {
    try {
      const { spentMinutes, timeEntries } = await taskService.removeTimeEntry(taskId, entryId);
      applyTaskPatch(taskId, { spentMinutes, timeEntries });
    } catch (err) {
      console.error('Failed to remove time entry', err);
    }
  }

  /** Subtarefa criada direto pelo menu de contexto, sem abrir a tarefa. */
  async function handleQuickAddSubtask(task: Task, title: string) {
    const titulo = title.trim();
    if (!titulo) return;
    try {
      const subtasks = await taskService.addSubtask(task.id, titulo);
      applyTaskPatch(task.id, { subtasks });
    } catch (err) {
      console.error('Failed to add subtask', err);
      showToast('Não foi possível criar a subtarefa.');
    }
  }

  function removeSubtask(id: string) {
    setNewTaskSubtasks(newTaskSubtasks.filter(s => s.id !== id));
  }

  function validateStep(step: number): string | null {
    if (step === 0 && !newTaskTitle.trim()) return 'Dê um título para a tarefa.';
    if (step === 1 && newTaskStartDate && newTaskDate && newTaskDate < newTaskStartDate) {
      return 'A data de entrega não pode ser anterior ao início.';
    }
    return null;
  }

  function goToStep(step: number) {
    // Ao avançar, valida as etapas intermediárias.
    if (step > modalStep) {
      for (let s = modalStep; s < step; s++) {
        const err = validateStep(s);
        if (err) { setModalError(err); setModalStep(s); return; }
      }
    }
    setModalError(null);
    setModalStep(step);
  }

  async function handleSaveTask(e: React.FormEvent) {
    e.preventDefault();
    // No wizard, "Enter"/próximo apenas avança até a última etapa.
    if (modalStep < 3) { goToStep(modalStep + 1); return; }
    for (let s = 0; s <= 3; s++) {
      const err = validateStep(s);
      if (err) { setModalError(err); setModalStep(s); return; }
    }

    try {
      const taskData = {
        title: newTaskTitle,
        description: newTaskDesc,
        urgency: newTaskUrgency,
        tags: newTaskTags,
        dueDate: newTaskDate ? new Date(newTaskDate).toISOString() : undefined,
        startDate: newTaskStartDate ? new Date(newTaskStartDate).toISOString() : undefined,
        attachments: newTaskAttachments,
        notificationsEnabled: newTaskNotifications,
        reminderMinutes: newTaskReminderMinutes,
        recurrence: newTaskRecurrence,
        recurrenceInterval: newTaskRecurrence === 'everyN' ? Math.max(1, newTaskRecurrenceInterval) : undefined,
        recurrenceWeekdays: newTaskRecurrence === 'weekdays' ? newTaskRecurrenceWeekdays : undefined,
        recurrenceEndType: newTaskRecurrence !== 'none' ? newTaskRecurrenceEndType : undefined,
        recurrenceCount: newTaskRecurrence !== 'none' && newTaskRecurrenceEndType === 'count' ? Math.max(1, newTaskRecurrenceCount) : undefined,
        recurrenceEndDate: newTaskRecurrence !== 'none' && newTaskRecurrenceEndType === 'date' && newTaskRecurrenceEndDate ? new Date(newTaskRecurrenceEndDate).toISOString() : undefined,
        subtasks: newTaskSubtasks,
        projectId: newTaskProjectId || undefined,
        epicId: newTaskProjectId && newTaskEpicId ? newTaskEpicId : undefined,
        assigneeId: newTaskAssigneeId || undefined,
        milestone: newTaskMilestone || undefined,
        // Dependência só faz sentido dentro do projeto onde a tarefa está.
        dependsOn: newTaskProjectId && newTaskDependsOn.length > 0 ? newTaskDependsOn : undefined,
        estimateMinutes: newTaskEstimate.trim() ? Math.max(0, Math.round(Number(newTaskEstimate.replace(',', '.')) * 60)) : undefined,
      };

      if (editingTask) {
        await taskService.updateTask(editingTask.id, taskData);
        setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, ...taskData } : t));
      } else {
        // Em projeto com colunas customizadas, a tarefa entra na 1ª coluna.
        const firstCol = taskData.projectId ? columnsFor(projectById(taskData.projectId))[0]?.id : undefined;
        const newTask = await taskService.createTask({
          ...taskData,
          status: firstCol,
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

  async function moveTaskToTrash(task: Task) {
    try {
      const id = task.id;
      const title = task.title;
      await taskService.deleteTask(id); // soft delete -> lixeira
      const now = new Date().toISOString();
      setTasks(prev => prev.map(t => t.id === id ? { ...t, deleted: true, deletedAt: now } : t));
      showToast(`"${title}" movida para a lixeira.`, {
        actionLabel: 'Desfazer',
        onAction: async () => {
          await taskService.restoreTask(id);
          setTasks(prev => prev.map(t => t.id === id ? { ...t, deleted: false, deletedAt: undefined } : t));
        },
      });
    } catch (err) {
      console.error('Failed to delete task', err);
    }
  }

  async function handleDeleteTask() {
    if (!editingTask) return;
    const task = editingTask;
    setIsModalOpen(false);
    resetModal();
    await moveTaskToTrash(task);
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

  async function handleReorder(taskId: string, status: string, targetTaskId: string | null, markCompleted: boolean) {
    const moving = tasks.find(t => t.id === taskId);
    if (!moving) return;
    const completed = markCompleted;
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
    if (searchQuery.trim() && !matchesSearch(task, searchQuery)) return false;
    if (activeTagFilter && !task.tags.includes(activeTagFilter)) return false;
    if (activeUrgencyFilter && task.urgency !== activeUrgencyFilter) return false;
    return true;
  };

  // Contexto da busca: os nomes que só o App sabe resolver.
  const searchContext = {
    projectName: (id?: string) => projectById(id)?.name,
    epicName: (id?: string) => epicById(id)?.name,
    assigneeName: (id?: string) => personaById(id)?.name,
  };

  const matchesSearch = (task: Task, query: string) => taskMatches(task, query, searchContext);

  // Busca com a caixa do topo preenchida: alcança também arquivadas e lixeira,
  // que ficam fora das views normais e some, sem isso, do alcance do usuário.
  const globalMatches = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    return tasks
      .filter(t => (t.archived || t.deleted) && matchesSearch(t, searchQuery))
      .slice(0, 8);
  }, [tasks, searchQuery, projects, epics, personas]);

  // Tarefas ativas (não arquivadas, não deletadas) para as views normais.
  const activeTasks = tasks.filter(t => !t.archived && !t.deleted);
  const archivedTasks = tasks.filter(t => t.archived && !t.deleted);
  const deletedTasks = tasks.filter(t => t.deleted);
  const reportTasks = tasks.filter(t => !t.deleted); // ativas + arquivadas, para relatórios

  /**
   * Aplica o botão "Tarefas de projetos" do topo. Vale para todas as views que
   * mostram lista de tarefas: um projeto grande sozinho enche a tela e esconde
   * as tarefas soltas, então dá para tirá-lo do caminho sem sair da view.
   * A view de Projeto e a de Equipe ficam de fora — lá o recorte é o assunto.
   */
  const hideProjectTasks = <T extends Task>(list: T[]) =>
    showProjectTasks ? list : list.filter(t => !t.projectId);

  const filteredTasks = hideProjectTasks(activeTasks).filter(task => {
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
  const calendarDayTasks = hideProjectTasks(activeTasks).filter(task =>
    matchesCommonFilters(task) && task.dueDate && isSameDay(parseISO(task.dueDate), selectedDate)
  );

  // Views onde o botão "Tarefas de projetos" aparece.
  const projectToggleTabs = ['inbox', 'today', 'all', 'calendar', 'agenda', 'list', 'stats', 'archived', 'trash'];

  /**
   * Quantas tarefas de projeto existem NA VIEW ATUAL. Contar sempre as ativas
   * faria o distintivo mentir nas Arquivadas, na Lixeira e nos Relatórios, que
   * olham para outro conjunto.
   */
  const projectTaskCount = React.useMemo(() => {
    const universo =
      activeTab === 'archived' ? archivedTasks :
      activeTab === 'trash' ? deletedTasks :
      activeTab === 'stats' ? reportTasks :
      activeTasks;
    return universo.filter(t => !!t.projectId).length;
  }, [activeTab, activeTasks, archivedTasks, deletedTasks, reportTasks]);

  // Contador de tarefas atrasadas (prazo já passou e não concluídas).
  const overdueCount = activeTasks.filter(t => !t.completed && t.dueDate && isPast(parseISO(t.dueDate))).length;

  // Ao criar tarefa dentro de um projeto, ela já fica vinculada (select oculto).
  const projectLocked = !editingTask && activeTab === 'project' && !!activeProjectId;

  // Candidatas a predecessora: tarefas ativas do mesmo projeto, menos ela mesma.
  // Sem projeto não há cronograma, então a lista fica vazia.
  const dependencyCandidates = React.useMemo(() => {
    if (!newTaskProjectId) return [];
    return activeTasks
      .filter(t => t.projectId === newTaskProjectId && t.id !== editingTask?.id)
      .sort((a, b) => (a.startDate || a.dueDate || '').localeCompare(b.startDate || b.dueDate || ''));
  }, [activeTasks, newTaskProjectId, editingTask]);

  // Rótulo de status resolvendo as colunas do projeto da tarefa.
  const statusLabelOf = (task: Task) => resolveStatusLabel(task.status, task.completed, columnsFor(projectById(task.projectId)));
  // Cor do status (ponto/barra), também resolvendo pelas colunas do projeto.
  const statusColorOf = (task: Task) => resolveStatusColor(task.status, task.completed, columnsFor(projectById(task.projectId)));

  // A barra lateral mostra as tags globais mais as do projeto aberto — tag de
  // projeto não polui o contexto dos outros.
  const sidebarTags = React.useMemo(
    () => tagService.getVisibleTags(activeTab === 'project' ? activeProjectId ?? undefined : undefined).map(t => t.name),
    [availableTags, activeTab, activeProjectId]
  );

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
        <div className="p-4 w-64">
          <AppMenu
            onNewTask={() => { resetModal(); setIsModalOpen(true); }}
            onCommandPalette={() => setIsPaletteOpen(true)}
            onManageProjects={() => { setActiveTab('projects'); setSelectedDateFilter(null); }}
            onManagePersonas={() => setIsPersonasModalOpen(true)}
            onManageTags={() => setIsManageTagsModalOpen(true)}
            onTemplates={() => setIsTemplatesOpen(true)}
            onPomodoro={() => setIsPomodoroOpen(true)}
            onSettings={() => setIsSettingsOpen(true)}
            onShortcuts={() => setIsShortcutsOpen(true)}
            onCheckUpdates={() => setIsSettingsOpen(true)}
            onGithub={() => settingsService.openExternal(GITHUB_URL)}
          />
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto scrollbar-hide w-64 pb-4 flex flex-col">
          <SidebarSection title="Views" storageKey="sb_views" action={(activeTagFilter || activeUrgencyFilter) ? (
            <button
              onClick={() => { setActiveTagFilter(null); setActiveUrgencyFilter(null); }}
              className="text-[9px] text-zinc-400 hover:text-white uppercase font-bold tracking-wider"
            >
              Limpar
            </button>
          ) : undefined}>
            <NavItem icon={<Inbox size={16} />} label="Caixa de Entrada" active={activeTab === 'inbox'} onClick={() => { setActiveTab('inbox'); setSelectedDateFilter(null); }} />
            <NavItem icon={<Clock size={16} />} label="Hoje" active={activeTab === 'today'} onClick={() => { setActiveTab('today'); setSelectedDateFilter(null); }} />
            <NavItem icon={<Calendar size={16} />} label="Calendário" active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} />
            <NavItem icon={<CalendarClock size={16} />} label="Agenda" active={activeTab === 'agenda'} onClick={() => { setActiveTab('agenda'); setSelectedDateFilter(null); }} />
            <NavItem icon={<List size={16} />} label="Lista" active={activeTab === 'list'} onClick={() => { setActiveTab('list'); setSelectedDateFilter(null); }} />
            <NavItem icon={<BarChart3 size={16} />} label="Relatórios" active={activeTab === 'stats'} onClick={() => { setActiveTab('stats'); setSelectedDateFilter(null); }} />
            <NavItem icon={<Users size={16} />} label="Equipe" active={activeTab === 'team'} onClick={() => { setActiveTab('team'); setSelectedDateFilter(null); }} />
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
          </SidebarSection>

          <SidebarSection title="Projetos" storageKey="sb_projects">
            <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-hide pr-1">
              {activeProjects.length > 0 ? activeProjects.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setActiveProjectId(p.id); setActiveTab('project'); setSelectedDateFilter(null); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs transition-colors ${activeTab === 'project' && activeProjectId === p.id ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${p.color}`}></span>
                  <span className="truncate">{p.name}</span>
                </button>
              )) : (
                <p className="text-xs text-zinc-500 italic px-2">Nenhum projeto ainda.</p>
              )}
            </div>
            <button
              onClick={() => { setActiveTab('projects'); setSelectedDateFilter(null); }}
              className="mt-2 px-2 flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <FolderKanban size={14} />
              <span>Gerenciar Projetos</span>
            </button>
          </SidebarSection>

          <SidebarSection title="Tags" storageKey="sb_tags">
            <div className="space-y-1 max-h-36 overflow-y-auto scrollbar-hide pr-2">
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
          </SidebarSection>

          <SidebarSection title="Criticidade" storageKey="sb_urgency">
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
          </SidebarSection>
        </nav>

        <div className="px-4 py-3 w-64 mt-auto border-t border-white/5 shrink-0">
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
                activeTab === 'team' ? 'Equipe' :
                activeTab === 'projects' ? 'Projetos' :
                activeTab === 'project' ? (projectById(activeProjectId || '')?.name || 'Projeto') :
                activeTab === 'archived' ? 'Arquivados' :
                activeTab === 'trash' ? 'Lixeira' :
                'Caixa de Entrada'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {/* Sessão de foco em andamento com o painel fechado: fica à mão sem
                ocupar a tela, e um clique traz o painel de volta. */}
            {pomo.active && !isPomodoroOpen && (
              <PomodoroBar pomo={pomo} onOpen={() => setIsPomodoroOpen(true)} />
            )}
            {projectToggleTabs.includes(activeTab) && (
              <button
                onClick={() => setShowProjectTasks(v => !v)}
                title={showProjectTasks ? 'Ocultar as tarefas vinculadas a projetos' : 'Mostrar as tarefas vinculadas a projetos'}
                className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${
                  showProjectTasks
                    ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/25'
                    : 'bg-white/5 border-white/10 text-zinc-500 hover:text-zinc-300 hover:bg-white/10'
                }`}
              >
                <FolderKanban size={14} />
                <span className="hidden lg:inline">Tarefas de projetos</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${showProjectTasks ? 'bg-indigo-500/25' : 'bg-white/10'}`}>
                  {projectTaskCount}
                </span>
              </button>
            )}
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
              {/* Achados fora das views normais: sem isto, arquivadas e lixeira
                  ficariam invisíveis para quem está buscando. */}
              {globalMatches.length > 0 && (
                <div className="absolute top-full right-0 mt-2 w-80 z-50 rounded-xl border border-white/10 bg-[#18181b] shadow-2xl shadow-black/50 overflow-hidden">
                  <p className="px-3 py-2 text-[10px] uppercase font-bold tracking-wider text-zinc-500 border-b border-white/5">
                    Também encontrado fora daqui
                  </p>
                  <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    {globalMatches.map(task => (
                      <button
                        key={task.id}
                        onClick={() => {
                          setActiveTab(task.deleted ? 'trash' : 'archived');
                          setSelectedDateFilter(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                      >
                        <span className={`shrink-0 ${task.deleted ? 'text-rose-400' : 'text-zinc-500'}`}>
                          {task.deleted ? <Trash2 size={13} /> : <Archive size={13} />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs text-white truncate">{task.title}</span>
                          <span className="block text-[10px] text-zinc-500">{task.deleted ? 'Na lixeira' : 'Arquivada'}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
        <div className={`flex-1 min-h-0 flex flex-col ${['calendar', 'agenda', 'list', 'archived', 'trash', 'project', 'projects'].includes(activeTab) ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'}`}>
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

                <QuickCalendar
                  offset={quickCalendarOffset}
                  onOffsetChange={setQuickCalendarOffset}
                  selectedDate={selectedDateFilter}
                  onSelectDate={(d) => { setSelectedDateFilter(d); setActiveTab('inbox'); }}
                  onClear={() => setSelectedDateFilter(null)}
                  onHelp={() => setIsQuickCalendarHelpOpen(true)}
                />
              </div>
            )}

            {activeTab === 'inbox' || activeTab === 'today' || activeTab === 'all' ? (
              <div className="flex-1 min-h-[400px]">
                <KanbanBoard
                  tasks={filteredTasks}
                  onToggleTask={handleToggleTask}
                  onToggleSubtask={handleToggleSubtask}
                  onClickTask={handleEditTask}
                  onToggleNotifications={handleToggleNotifications}
                  onContextTask={openTaskMenu}
                  onArchiveCompleted={requestArchiveCompleted}
                  onDragStart={handleDragStart}
                  onReorder={handleReorder}
                  personaById={personaById}
                  epicById={epicById}
                />
              </div>
            ) : null}

            {activeTab === 'archived' ? (
              <ArchivedView
                tasks={hideProjectTasks(archivedTasks)}
                onUnarchive={handleUnarchiveTask}
                onClickTask={handleEditTask}
                onDeleteMany={handleDeleteArchived}
              />
            ) : null}

            {activeTab === 'agenda' ? (
              <AgendaView
                tasks={hideProjectTasks(activeTasks).filter(matchesCommonFilters)}
                onEditTask={handleEditTask}
                onCreateAt={(date, hour) => handleNewTaskAtDate(date, hour)}
              />
            ) : null}

            {activeTab === 'list' ? (
              <TaskListView
                tasks={hideProjectTasks(activeTasks).filter(matchesCommonFilters)}
                onView={handleViewTask}
                onEdit={handleEditTask}
                onToggle={handleToggleTask}
                onContext={openTaskMenu}
                statusLabel={statusLabelOf}
                statusColor={statusColorOf}
                onAskName={setPrompt}
              />
            ) : null}

            {activeTab === 'stats' ? (
              <StatsView tasks={hideProjectTasks(reportTasks)} />
            ) : null}

            {activeTab === 'team' ? (
              <TeamView
                personas={personas}
                tasks={activeTasks}
                onManagePersonas={() => setIsPersonasModalOpen(true)}
              />
            ) : null}

            {activeTab === 'project' && activeProjectId && projectById(activeProjectId) ? (
              <ProjectView
                project={projectById(activeProjectId)!}
                epics={epics.filter(e => e.projectId === activeProjectId)}
                onToggleSubtask={handleToggleSubtask}
                tasks={activeTasks.filter(t => t.projectId === activeProjectId).filter(matchesCommonFilters)}
                onEditProject={() => { setSettingsProjectId(activeProjectId); setIsProjectSettingsOpen(true); }}
                onSaveTemplate={() => handleSaveProjectTemplate(activeProjectId)}
                onToggleTask={handleToggleTask}
                onClickTask={handleEditTask}
                onToggleNotifications={handleToggleNotifications}
                onContextTask={openTaskMenu}
                onArchiveCompleted={requestArchiveCompleted}
                onDragStart={handleDragStart}
                onReorder={handleReorder}
                personaById={personaById}
                epicById={epicById}
                statusLabel={statusLabelOf}
                statusColor={statusColorOf}
              />
            ) : null}

            {activeTab === 'projects' ? (
              <ProjectsManagerView
                tasks={activeTasks}
                onOpenProject={(id) => { setActiveProjectId(id); setActiveTab('project'); }}
                onEditProject={(id) => { setSettingsProjectId(id); setIsProjectSettingsOpen(true); }}
                onDeleteProject={handleDeleteProject}
              />
            ) : null}

            {activeTab === 'trash' ? (
              <TrashView
                tasks={hideProjectTasks(deletedTasks)}
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
                    tasks={hideProjectTasks(activeTasks)}
                    onHelp={() => setIsCalendarHelpOpen(true)}
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
                          completedAt={task.completedAt}
                          commentCount={task.comments?.length}
                          notificationsEnabled={task.notificationsEnabled}
                          recurrence={task.recurrence}
                          subtasks={task.subtasks}
                          projectId={task.projectId}
                          onToggle={() => handleToggleTask(task)}
                          onToggleSubtask={(subId) => handleToggleSubtask(task, subId)}
                          onToggleNotifications={() => handleToggleNotifications(task)}
                          onEdit={() => handleEditTask(task)}
                          onClick={() => handleViewTask(task)}
                          onContextMenu={(e) => openTaskMenu(e, task)}
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
        size="3xl"
      >
        <form onSubmit={handleSaveTask}>
          {/* Stepper */}
          <div className="flex items-center gap-1 mb-5">
            {['Detalhes', 'Prazo', 'Organização', 'Extras'].map((label, i) => (
              <React.Fragment key={label}>
                <button
                  type="button"
                  onClick={() => goToStep(i)}
                  className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-colors ${i === modalStep ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === modalStep ? 'bg-indigo-600 text-white' : i < modalStep ? 'bg-indigo-600/30 text-indigo-300' : 'bg-white/10 text-zinc-400'}`}>
                    {i < modalStep ? <Check size={13} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="text-sm font-medium hidden sm:block">{label}</span>
                </button>
                {i < 3 && <div className="flex-1 h-px bg-white/10" />}
              </React.Fragment>
            ))}
          </div>

          {modalError && (
            <div className="mb-4 flex items-center gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="shrink-0" /> {modalError}
            </div>
          )}

          <div className="min-h-[300px]">
            {/* Etapa 1 — Detalhes */}
            {modalStep === 0 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Título <span className="text-rose-400">*</span></label>
                  <input
                    type="text"
                    autoFocus
                    value={newTaskTitle}
                    onChange={(e) => { setNewTaskTitle(e.target.value); if (modalError) setModalError(null); }}
                    className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors ${modalError && !newTaskTitle.trim() ? 'border-rose-500/60' : 'border-white/10 focus:border-indigo-500'}`}
                    placeholder="Ex: Comprar mantimentos"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Descrição</label>
                  <textarea
                    value={newTaskDesc}
                    onChange={(e) => setNewTaskDesc(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors h-28 resize-none"
                    placeholder="Detalhes da tarefa..."
                  />
                </div>
                <div className="sm:w-1/2">
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
              </div>
            )}

            {/* Etapa 2 — Prazo */}
            {modalStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Início</label>
                    <DateTimePicker value={newTaskStartDate} onChange={(v) => { setNewTaskStartDate(v); if (modalError) setModalError(null); }} placeholder="Sem data de início" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Entrega</label>
                    <DateTimePicker value={newTaskDate} min={newTaskStartDate} onChange={(v) => { setNewTaskDate(v); if (modalError) setModalError(null); }} placeholder="Sem prazo" />
                  </div>
                </div>
                <p className="text-[11px] text-zinc-500">Deixar o horário em 00:00 significa "sem hora definida".</p>

                <div className="sm:w-1/2">
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Estimativa (horas)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={newTaskEstimate}
                    onChange={(e) => setNewTaskEstimate(e.target.value)}
                    placeholder="Ex: 3.5"
                    className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors [color-scheme:dark]"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">Comparada com o tempo apontado no Pomodoro, nos Relatórios.</p>
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
                      <input type="number" min={1} value={newTaskRecurrenceInterval} onChange={(e) => setNewTaskRecurrenceInterval(Number(e.target.value))} className="w-20 bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 [color-scheme:dark]" />
                      <span className="text-xs text-zinc-400">dia(s)</span>
                    </div>
                  )}
                  {newTaskRecurrence === 'weekdays' && (
                    <div className="mt-3 flex gap-1.5">
                      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((lbl, i) => {
                        const on = newTaskRecurrenceWeekdays.includes(i);
                        return (
                          <button key={i} type="button" onClick={() => setNewTaskRecurrenceWeekdays(on ? newTaskRecurrenceWeekdays.filter(d => d !== i) : [...newTaskRecurrenceWeekdays, i])} className={`w-8 h-8 rounded-full text-xs font-semibold transition-colors ${on ? 'bg-indigo-600 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}>{lbl}</button>
                        );
                      })}
                    </div>
                  )}
                  {newTaskRecurrence !== 'none' && (
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-zinc-400 mb-1">Termina</label>
                      <select value={newTaskRecurrenceEndType} onChange={(e) => setNewTaskRecurrenceEndType(e.target.value as RecurrenceEnd)} className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none">
                        <option value="never">Nunca</option>
                        <option value="count">Após um número de ocorrências</option>
                        <option value="date">Em uma data</option>
                      </select>
                      {newTaskRecurrenceEndType === 'count' && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-zinc-400">Após</span>
                          <input type="number" min={1} value={newTaskRecurrenceCount} onChange={(e) => setNewTaskRecurrenceCount(Number(e.target.value))} className="w-20 bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 [color-scheme:dark]" />
                          <span className="text-xs text-zinc-400">ocorrência(s)</span>
                        </div>
                      )}
                      {newTaskRecurrenceEndType === 'date' && (
                        <input type="date" value={newTaskRecurrenceEndDate} onChange={(e) => setNewTaskRecurrenceEndDate(e.target.value)} className="mt-2 w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 [color-scheme:dark]" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Etapa 3 — Organização */}
            {modalStep === 2 && (
              <div className="space-y-4">
                {(activeProjects.length > 0 || personas.length > 0) && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {activeProjects.length > 0 && !projectLocked && (
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Projeto</label>
                        <select value={newTaskProjectId} onChange={(e) => { setNewTaskProjectId(e.target.value); setNewTaskEpicId(''); }} className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none">
                          <option value="">Nenhum</option>
                          {activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                    )}
                    {newTaskProjectId && (
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Épico{projectLocked ? ` · ${projectById(newTaskProjectId)?.name || ''}` : ''}</label>
                        <select value={newTaskEpicId} onChange={(e) => setNewTaskEpicId(e.target.value)} className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none">
                          <option value="">Nenhum</option>
                          {epics.filter(ep => ep.projectId === newTaskProjectId).map(ep => <option key={ep.id} value={ep.id}>{ep.name}</option>)}
                        </select>
                      </div>
                    )}
                    {personas.length > 0 && (
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Responsável</label>
                        <select value={newTaskAssigneeId} onChange={(e) => setNewTaskAssigneeId(e.target.value)} className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none">
                          <option value="">Ninguém</option>
                          {personas.map(p => <option key={p.id} value={p.id}>{p.name}{p.role ? ` · ${p.role}` : ''}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Tags</label>
                  <TagInput
                    selectedTags={newTaskTags}
                    onChange={setNewTaskTags}
                    projectId={newTaskProjectId || undefined}
                    projectName={projectById(newTaskProjectId)?.name}
                  />
                </div>

                {/* Cronograma: marco e dependências (aparecem no Gantt) */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-medium text-white">
                      <Diamond size={14} className={newTaskMilestone ? 'text-amber-400 fill-amber-400' : 'text-zinc-500'} />
                      Marco do cronograma
                      {/* Ajuda no lugar da dúvida: ao lado do próprio controle. */}
                      <button
                        type="button"
                        onClick={() => setIsMilestoneHelpOpen(true)}
                        title="Como funcionam os marcos e as dependências"
                        className="flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-indigo-300 transition-colors"
                      >
                        <HelpCircle size={13} /> Como funciona
                      </button>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={newTaskMilestone}
                      onClick={() => setNewTaskMilestone(v => !v)}
                      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${newTaskMilestone ? 'bg-amber-500' : 'bg-white/10'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${newTaskMilestone ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-500 -mt-1">Data única, sem duração: vira um losango no Gantt.</p>

                  {dependencyCandidates.length > 0 && (
                    <div className="pt-1 border-t border-white/5">
                      <label className="block text-xs font-medium text-zinc-400 mb-1.5 mt-3">
                        Depende de
                        {newTaskDependsOn.length > 0 && <span className="text-zinc-500"> · {newTaskDependsOn.length} selecionada(s)</span>}
                      </label>
                      <p className="text-[11px] text-zinc-500 mb-2">Estas precisam terminar antes desta começar. O Gantt liga as duas com uma seta.</p>
                      <div className="max-h-36 overflow-y-auto custom-scrollbar rounded-lg border border-white/10 divide-y divide-white/5">
                        {dependencyCandidates.map(dep => {
                          const on = newTaskDependsOn.includes(dep.id);
                          return (
                            <button
                              key={dep.id}
                              type="button"
                              onClick={() => setNewTaskDependsOn(on ? newTaskDependsOn.filter(id => id !== dep.id) : [...newTaskDependsOn, dep.id])}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                            >
                              <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${on ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-zinc-500'}`}>
                                {on && <Check size={10} strokeWidth={4} />}
                              </span>
                              <span className={`flex-1 min-w-0 text-xs truncate ${dep.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>{dep.title}</span>
                              {dep.dueDate && (
                                <span className="shrink-0 text-[10px] font-mono text-zinc-500">{format(parseISO(dep.dueDate), 'dd/MM')}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Etapa 4 — Extras */}
            {modalStep === 3 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium text-white">
                      {newTaskNotifications ? <Bell size={15} className="text-indigo-400" /> : <BellOff size={15} className="text-zinc-500" />}
                      Notificações
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={newTaskNotifications}
                      onClick={() => setNewTaskNotifications(v => !v)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${newTaskNotifications ? 'bg-indigo-600' : 'bg-white/10'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${newTaskNotifications ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                  {newTaskNotifications && (
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-zinc-400 mb-1">Lembrar antes do prazo</label>
                      <select value={newTaskReminderMinutes} onChange={(e) => setNewTaskReminderMinutes(Number(e.target.value))} className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none">
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
                      <p className="text-[11px] text-zinc-500 mt-1.5">Um lembrete com essa antecedência e outro na hora exata do prazo. Requer data de entrega.</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Subtarefas
                    {newTaskSubtasks.length > 1 && (
                      <span className="ml-2 font-normal text-zinc-500">· arraste pelo punho para reordenar</span>
                    )}
                  </label>
                  {newTaskSubtasks.length > 0 && (
                    <div ref={subtaskSort.containerRef} className="space-y-1.5 mb-2">
                      {newTaskSubtasks.map(sub => {
                        const drop = subtaskSort.itemProps(sub.id);
                        return (
                          <div
                            key={sub.id}
                            {...drop}
                            className={`flex items-center gap-2 group rounded-lg ${subtaskSort.itemClass(sub.id)}`}
                          >
                            <span
                              {...subtaskSort.handleProps(sub.id)}
                              title="Arraste para reordenar"
                              className="drag-handle shrink-0 text-zinc-600 hover:text-zinc-300 cursor-grab active:cursor-grabbing"
                            >
                              <GripVertical size={14} />
                            </span>
                            <button type="button" onClick={() => toggleSubtask(sub.id)} className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${sub.done ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-zinc-500 hover:border-indigo-500'}`}>
                              {sub.done && <Check size={10} strokeWidth={4} />}
                            </button>
                            <span className={`flex-1 text-sm ${sub.done ? 'line-through text-zinc-500' : 'text-white'}`}>{sub.title}</span>
                            <button type="button" onClick={() => removeSubtask(sub.id)} className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 transition-all"><X size={14} /></button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input type="text" value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }} className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" placeholder="Adicionar item do checklist..." />
                    <button type="button" onClick={addSubtask} className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-zinc-300 hover:text-white transition-colors"><Plus size={16} /></button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Anexos</label>
                  <AttachmentsEditor value={newTaskAttachments} onChange={setNewTaskAttachments} />
                </div>
              </div>
            )}
          </div>

          {/* Rodapé */}
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/10">
            <div>
              {editingTask && (
                <button type="button" onClick={handleDeleteTask} className="px-4 py-2 text-sm font-medium text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">Excluir</button>
              )}
            </div>
            <div className="flex gap-2">
              {modalStep > 0 && (
                <button type="button" onClick={() => goToStep(modalStep - 1)} className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors">Voltar</button>
              )}
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-6 py-2 rounded-lg transition-all shadow-lg shadow-indigo-600/20">
                {modalStep < 3 ? 'Próximo' : (editingTask ? 'Salvar' : 'Criar Tarefa')}
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
        assignee={personaById(detailTask?.assigneeId)}
        project={projectById(detailTask?.projectId)}
        epic={epicById(detailTask?.epicId)}
        statusText={detailTask ? statusLabelOf(detailTask) : undefined}
        onAddComment={handleAddComment}
        onDeleteComment={handleDeleteComment}
        onAddTime={(task, minutes) => handleLogTime(task.id, minutes, 'manual')}
        onDeleteTime={(task, entryId) => handleRemoveTimeEntry(task.id, entryId)}
        focusComments={detailFocusComments}
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

      <CalendarHelpModal
        isOpen={isCalendarHelpOpen}
        onClose={() => setIsCalendarHelpOpen(false)}
      />

      <QuickCalendarHelpModal
        isOpen={isQuickCalendarHelpOpen}
        onClose={() => setIsQuickCalendarHelpOpen(false)}
      />

      <PomodoroModal
        isOpen={isPomodoroOpen}
        onClose={() => setIsPomodoroOpen(false)}
        pomo={pomo}
        tasks={activeTasks.filter(t => !t.completed)}
        projectName={(id) => projectById(id)?.name}
      />

      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        tasks={activeTasks}
        projects={projects}
        onNavigate={(tab) => { setActiveTab(tab); setSelectedDateFilter(null); }}
        onNewTask={() => { resetModal(); setIsModalOpen(true); }}
        onOpenTask={(task) => handleViewTask(task)}
        onOpenProject={(id) => { setActiveProjectId(id); setActiveTab('project'); setSelectedDateFilter(null); }}
        onOpenPomodoro={() => setIsPomodoroOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onManageTags={() => setIsManageTagsModalOpen(true)}
        onManagePersonas={() => setIsPersonasModalOpen(true)}
        onExportBackup={() => backupService.exportData()}
        onSetTheme={(t) => themeService.set(t)}
        onQuickAdd={handleQuickAdd}
      />

      <ManagePersonasModal
        isOpen={isPersonasModalOpen}
        onClose={() => setIsPersonasModalOpen(false)}
        onDeletePersona={handleDeletePersona}
      />

      <ProjectSettingsModal
        isOpen={isProjectSettingsOpen}
        projectId={settingsProjectId}
        onClose={() => setIsProjectSettingsOpen(false)}
        onDelete={(id, name) => { setIsProjectSettingsOpen(false); handleDeleteProject(id, name); }}
      />

      <TaskContextMenu
        state={taskMenu}
        onClose={() => setTaskMenu(null)}
        onView={handleViewTask}
        onEdit={handleEditTask}
        onToggleComplete={handleToggleTask}
        onToggleNotifications={handleToggleNotifications}
        onDelete={moveTaskToTrash}
        onAddSubtask={handleQuickAddSubtask}
        onComment={(task) => { setDetailFocusComments(true); setDetailTask(task); }}
        onSaveTemplate={handleSaveTaskTemplate}
        onArchive={handleArchiveTask}
      />

      {/* Depois do modal da tarefa na ordem do DOM: os dois usam z-50, então
          quem vem por último é quem fica por cima. */}
      <MilestoneHelpModal
        isOpen={isMilestoneHelpOpen}
        onClose={() => setIsMilestoneHelpOpen(false)}
      />

      <PromptDialog state={prompt} onClose={() => setPrompt(null)} />

      <TemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        onUseTask={handleUseTaskTemplate}
        onUseProject={handleUseProjectTemplate}
      />

      <RoadmapReviewModal
        plan={pendingReview?.plan ?? null}
        onConfirm={confirmPendingReview}
        onCancel={rejectPendingReview}
      />

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
      </div>
    </div>
  );
}

function SidebarSection({ title, storageKey, action, children }: { title: string; storageKey: string; action?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(storageKey) !== '0'; } catch { return true; }
  });
  const toggle = () => setOpen(o => {
    const next = !o;
    try { localStorage.setItem(storageKey, next ? '1' : '0'); } catch { /* ignore */ }
    return next;
  });
  return (
    <div className="mb-4 shrink-0">
      <div className="flex justify-between items-center px-2 mb-2">
        <button onClick={toggle} className="flex items-center gap-1 text-[10px] uppercase font-bold text-zinc-500 tracking-wider hover:text-zinc-300 transition-colors">
          <ChevronDown size={11} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
          {title}
        </button>
        {action}
      </div>
      {open && children}
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
