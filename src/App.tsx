import React, { useState, useEffect } from 'react';
import { Calendar, Check, Clock, Inbox, Layout, Plus, Search, Settings, Sidebar as SidebarIcon, Database } from 'lucide-react';
import { motion } from 'motion/react';
import { Task, Urgency } from './types';
import { taskService } from './services/tasks';
import { Modal } from './components/Modal';
import { MonthlyCalendar } from './components/MonthlyCalendar';
import { KanbanBoard } from './components/KanbanBoard';
import { TaskItem } from './components/TaskItem';
import { format, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { TagInput } from './components/TagInput';
import { tagService, PREDEFINED_COLORS } from './services/tags';
import { ManageTagsModal } from './components/ManageTagsModal';
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
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskUrgency, setNewTaskUrgency] = useState<Urgency>('medium');
  const [newTaskTags, setNewTaskTags] = useState<string[]>([]);
  const [newTaskDate, setNewTaskDate] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState<Date | null>(null);
  const [quickCalendarOffset, setQuickCalendarOffset] = useState(0);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [activeUrgencyFilter, setActiveUrgencyFilter] = useState<Urgency | null>(null);
  const [activeTagColorId, setActiveTagColorId] = useState<string | null>(null);

  useEffect(() => {
    loadTasks();
    loadTags();
  }, []);

  function loadTags() {
    setAvailableTags(tagService.getTags().map(t => t.name));
  }

  async function loadTasks() {
    setLoadingTasks(true);
    setError(null);
    try {
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
      await taskService.updateTask(task.id, { completed: newCompleted, status: newStatus });
      setTasks(tasks.map(t => t.id === task.id ? { ...t, completed: newCompleted, status: newStatus } : t));
    } catch (err) {
      console.error('Failed to toggle task', err);
    }
  }

  function handleEditTask(task: Task) {
    setEditingTask(task);
    setNewTaskTitle(task.title);
    setNewTaskDesc(task.description || '');
    setNewTaskUrgency(task.urgency);
    setNewTaskTags(task.tags || []);
    setNewTaskDate(task.dueDate ? format(parseISO(task.dueDate), "yyyy-MM-dd'T'HH:mm") : '');
    setIsModalOpen(true);
  }

  function resetModal() {
    setEditingTask(null);
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskUrgency('medium');
    setNewTaskTags([]);
    setNewTaskDate('');
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
      await taskService.deleteTask(editingTask.id);
      setTasks(tasks.filter(t => t.id !== editingTask.id));
      setIsModalOpen(false);
      resetModal();
    } catch (err) {
      console.error('Failed to delete task', err);
    }
  }

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDrop = async (e: React.DragEvent, status: any) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;
    const task = tasks[taskIndex];
    if (task.status === status) return;

    const completed = status === 'done';
    
    // Optimistic update
    const newTasks = [...tasks];
    newTasks[taskIndex] = { ...task, status, completed };
    setTasks(newTasks);

    try {
      await taskService.updateTask(taskId, { status, completed });
    } catch (err) {
      console.error('Failed to update task status', err);
      loadTasks(); // revert
    }
  };

  // Filter tasks based on active tab
  const filteredTasks = tasks.filter(task => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!task.title.toLowerCase().includes(q) && !(task.description || '').toLowerCase().includes(q)) {
        return false;
      }
    }

    if (activeTagFilter) {
      if (!task.tags.includes(activeTagFilter)) {
        return false;
      }
    }

    if (activeUrgencyFilter) {
      if (task.urgency !== activeUrgencyFilter) {
        return false;
      }
    }

    if (activeTab === 'calendar') {
      return true;
    }

    if (activeTab === 'today') {
      return task.dueDate && isToday(parseISO(task.dueDate));
    }

    if (activeTab === 'inbox') {
      if (selectedDateFilter) {
         return task.dueDate && format(parseISO(task.dueDate), 'yyyy-MM-dd') === format(selectedDateFilter, 'yyyy-MM-dd');
      }
      return true; // Show all in Kanban
    }

    return true; 
  });

  const criticalTasks = filteredTasks.filter(t => t.urgency === 'critical');
  const otherTasks = filteredTasks.filter(t => t.urgency !== 'critical');

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
            <NavItem icon={<Layout size={16} />} label="Todas as Tarefas" active={activeTab === 'all'} onClick={() => { setActiveTab('all'); setSelectedDateFilter(null); }} />
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

        <div className="p-4 w-64 mt-auto">
          <div className="space-y-1">
             {/* <NavItem icon={<Settings size={16} />} label="Configurações" /> */}
          </div>
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
                'Todas as Tarefas'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Pesquisar tarefas..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:bg-white/10 transition-all w-64"
              />
            </div>
            <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2">
              <Plus size={14} /> Nova Tarefa
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
          <div className="p-8 flex-1 flex flex-col">
            
            {/* Dashboard Cards & Quick Calendar */}
            {activeTab !== 'calendar' && (
              <div className="flex flex-col xl:flex-row gap-8 mb-8 shrink-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 h-fit">
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-20">
                      <Check size={48} className="text-emerald-500" />
                    </div>
                    <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-1">Concluídas</h3>
                    <div className="text-3xl font-bold text-white">
                      {tasks.filter(t => t.completed).length}
                    </div>
                    <p className="text-xs text-emerald-500/80 mt-2">Total de tarefas finalizadas</p>
                  </div>

                  <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-20">
                      <Layout size={48} className="text-amber-500" />
                    </div>
                    <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1">Pendências</h3>
                    <div className="text-3xl font-bold text-white">
                      {tasks.filter(t => !t.completed).length}
                    </div>
                    <p className="text-xs text-amber-500/80 mt-2">{tasks.filter(t => !t.completed && t.urgency === 'critical').length} com prioridade crítica</p>
                  </div>

                  <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border border-indigo-500/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-20">
                      <Clock size={48} className="text-indigo-500" />
                    </div>
                    <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1">Progresso</h3>
                    <div className="text-3xl font-bold text-white">
                      {tasks.length > 0 ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) : 0}%
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
                    <div className="flex gap-2">
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
                              : selectedDateFilter && d.getDate() === selectedDateFilter.getDate()
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
                  onDragStart={handleDragStart} 
                  onDrop={handleDrop} 
                />
              </div>
            ) : null}

            {activeTab === 'calendar' ? (
              <div className="space-y-8">
                <MonthlyCalendar 
                  currentDate={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  selectedDate={selectedDate}
                  onSelectDate={(d) => {
                    setSelectedDateFilter(d);
                    setActiveTab('inbox');
                  }}
                  tasks={tasks}
                />
                
                {/* Tasks for selected date */}
                <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 shadow-xl">
                  <h3 className="text-sm font-bold text-white mb-4">
                    Tarefas para {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                  </h3>
                  {filteredTasks.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic">Nenhuma tarefa agendada para esta data.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredTasks.map(task => (
                        <TaskItem
                          key={task.id}
                          title={task.title}
                          description={task.description}
                          urgency={task.urgency}
                          tags={task.tags}
                          time={task.dueDate}
                          completed={task.completed}
                          onToggle={() => handleToggleTask(task)}
                        />
                      ))}
                    </div>
                  )}
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
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/10">
            <div>
              {editingTask && (
                <button
                  type="button"
                  onClick={handleDeleteTask}
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
