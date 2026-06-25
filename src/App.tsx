import React, { useState, useEffect } from 'react';
import { Calendar, Check, Clock, Inbox, Layout, Plus, Search, Settings, Sidebar as SidebarIcon, Bell, Database } from 'lucide-react';
import { motion } from 'motion/react';
import { Task, Urgency } from './types';
import { taskService } from './services/tasks';
import { Modal } from './components/Modal';
import { MonthlyCalendar } from './components/MonthlyCalendar';
import { format, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('inbox');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskUrgency, setNewTaskUrgency] = useState<Urgency>('medium');
  const [newTaskTags, setNewTaskTags] = useState<string>('');
  const [newTaskDate, setNewTaskDate] = useState<string>('');

  const [toastDismissed, setToastDismissed] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    setLoading(true);
    setError(null);
    try {
      const data = await taskService.getTasks();
      setTasks(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar tarefas');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleTask(task: Task) {
    try {
      await taskService.updateTask(task.id, { completed: !task.completed });
      setTasks(tasks.map(t => t.id === task.id ? { ...t, completed: !task.completed } : t));
    } catch (err) {
      console.error('Failed to toggle task', err);
    }
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const tagsArray = newTaskTags.split(',').map(t => t.trim()).filter(Boolean);
      const newTask = await taskService.createTask({
        title: newTaskTitle,
        description: newTaskDesc,
        urgency: newTaskUrgency,
        tags: tagsArray,
        dueDate: newTaskDate ? new Date(newTaskDate).toISOString() : undefined,
        completed: false
      });
      setTasks([newTask, ...tasks]);
      setIsModalOpen(false);
      
      // Reset form
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskUrgency('medium');
      setNewTaskTags('');
      setNewTaskDate('');
    } catch (err) {
      console.error('Failed to create task', err);
    }
  }

  // Filter tasks based on active tab
  const filteredTasks = tasks.filter(task => {
    if (activeTab === 'inbox') return !task.completed;
    if (activeTab === 'today') return task.dueDate && isToday(parseISO(task.dueDate));
    if (activeTab === 'calendar') {
      if (!task.dueDate) return false;
      const taskDate = parseISO(task.dueDate);
      return taskDate.getDate() === selectedDate.getDate() &&
             taskDate.getMonth() === selectedDate.getMonth() &&
             taskDate.getFullYear() === selectedDate.getFullYear();
    }
    if (activeTab === 'all') return true;
    return true; 
  });

  const criticalTasks = filteredTasks.filter(t => t.urgency === 'critical');
  const otherTasks = filteredTasks.filter(t => t.urgency !== 'critical');

  const allTags: string[] = Array.from(new Set(tasks.flatMap(t => t.tags || [])));
  const sidebarTags = allTags.slice(0, 5); // Limit to 5 tags in sidebar

  return (
    <div className="flex h-screen w-full bg-[#09090b] text-[#e4e4e7] font-sans antialiased overflow-hidden">
      {/* Sidebar (Glassy) */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 256 : 0, opacity: sidebarOpen ? 1 : 0 }}
        className="flex-shrink-0 h-full border-r border-white/5 bg-white/[0.02] backdrop-blur-2xl overflow-hidden flex flex-col"
      >
        <div className="p-6 flex items-center gap-3 w-64">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
            <span className="text-white font-bold">N</span>
          </div>
          <h1 className="text-lg font-semibold tracking-tight whitespace-nowrap">NextTask</h1>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto w-64">
          <div className="mb-6">
            <p className="px-2 text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-2">Views</p>
            <NavItem icon={<Inbox size={16} />} label="Caixa de Entrada" active={activeTab === 'inbox'} onClick={() => setActiveTab('inbox')} />
            <NavItem icon={<Clock size={16} />} label="Hoje" active={activeTab === 'today'} onClick={() => setActiveTab('today')} />
            <NavItem icon={<Calendar size={16} />} label="Calendário" active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} />
            <NavItem icon={<Layout size={16} />} label="Todas as Tarefas" active={activeTab === 'all'} onClick={() => setActiveTab('all')} />
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center px-2 mb-2">
              <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Tags</p>
              <button className="text-zinc-500 hover:text-white transition-colors">
                <Plus size={14} />
              </button>
            </div>
            <div className="space-y-1">
              {sidebarTags.length > 0 ? sidebarTags.map((tag, idx) => {
                const colors = ['bg-rose-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500'];
                return <TagItem key={tag} color={colors[idx % colors.length]} label={tag} />;
              }) : (
                <p className="text-xs text-zinc-500 italic px-2">Nenhuma tag ainda.</p>
              )}
            </div>
          </div>
        </nav>

        <div className="p-4 w-64">
          <div className="p-3 rounded-xl bg-gradient-to-tr from-white/5 to-white/[0.08] border border-white/10">
            <div className="flex items-center gap-2 mb-2">
               <Database size={12} className="text-zinc-400" />
               <p className="text-xs text-zinc-400 leading-tight">Syncing to Supabase</p>
            </div>
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <div className={`h-full w-full bg-indigo-500 ${loading ? 'animate-pulse' : ''}`}></div>
            </div>
          </div>
          
          <div className="mt-4 space-y-1">
             <NavItem icon={<Settings size={16} />} label="Configurações" />
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
            <div className="flex items-center bg-white/5 rounded-md p-0.5 ml-4">
              <button className="px-3 py-1 text-xs font-medium bg-white/10 text-white rounded shadow-sm">Dia</button>
              <button className="px-3 py-1 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors">Semana</button>
              <button className="px-3 py-1 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors">Mês</button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-full hover:bg-white/5 text-zinc-400 transition-colors">
              <Search size={18} />
            </button>
            <button className="p-2 rounded-full hover:bg-white/5 text-zinc-400 transition-colors relative">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 border-2 border-[#09090b]"></span>
            </button>
            <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2">
              <Plus size={14} /> Nova Tarefa
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8 h-full">
            
            {/* Dashboard Cards */}
            {activeTab !== 'calendar' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-20">
                    <Check size={48} className="text-emerald-500" />
                  </div>
                  <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-1">Concluídas Hoje</h3>
                  <div className="text-3xl font-bold text-white">
                    {tasks.filter(t => t.completed).length}
                  </div>
                  <p className="text-xs text-emerald-500/80 mt-2">+2 desde ontem</p>
                </div>

                <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-20">
                    <Layout size={48} className="text-amber-500" />
                  </div>
                  <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1">Pendências</h3>
                  <div className="text-3xl font-bold text-white">
                    {tasks.filter(t => !t.completed).length}
                  </div>
                  <p className="text-xs text-amber-500/80 mt-2">Foco nas críticas</p>
                </div>

                <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border border-indigo-500/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-20">
                    <Clock size={48} className="text-indigo-500" />
                  </div>
                  <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1">Horas Focadas</h3>
                  <div className="text-3xl font-bold text-white">
                    {(tasks.filter(t => t.completed).length * 1.5).toFixed(1)}h
                  </div>
                  <p className="text-xs text-indigo-500/80 mt-2">Média de 1.5h por tarefa</p>
                </div>
              </div>
            )}

            {activeTab === 'calendar' ? (
              <div className="space-y-8">
                <MonthlyCalendar 
                  currentDate={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  selectedDate={selectedDate}
                  onSelectDate={(d) => setSelectedDate(d)}
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
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
                {/* Task Columns */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">CRITICAL</span>
                    <span className="text-xs text-zinc-500">{criticalTasks.length} Tarefa(s)</span>
                  </div>
                  <div className="space-y-3">
                    {loading && <p className="text-xs text-zinc-500">Carregando...</p>}
                    {!loading && error && <p className="text-xs text-rose-500">{error}</p>}
                    {!loading && !error && criticalTasks.length === 0 && (
                      <p className="text-xs text-zinc-500 italic">Nenhuma tarefa crítica.</p>
                    )}
                    {criticalTasks.map(task => (
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
                </section>

                <section className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">OUTRAS TAREFAS</span>
                    <span className="text-xs text-zinc-500">{otherTasks.length} Tarefa(s)</span>
                  </div>
                  <div className="space-y-3">
                    {loading && <p className="text-xs text-zinc-500">Carregando...</p>}
                    {!loading && !error && otherTasks.length === 0 && (
                      <p className="text-xs text-zinc-500 italic">Nenhuma tarefa.</p>
                    )}
                    {otherTasks.map(task => (
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
                </section>

                {/* Right Sidebar Widget */}
                <section className="space-y-6 lg:border-l lg:border-white/5 lg:pl-8">
                  <div>
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Calendário Rápido</h3>
                  <div className="grid grid-cols-7 gap-2 text-center text-[10px] mb-2">
                    <span className="text-zinc-600">D</span><span className="text-zinc-600">S</span><span className="text-zinc-600">T</span><span className="text-zinc-600">Q</span><span className="text-zinc-600">Q</span><span className="text-zinc-600 font-bold">S</span><span className="text-zinc-600 font-bold">S</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 7 }).map((_, i) => {
                      const d = new Date();
                      d.setDate(d.getDate() - d.getDay() + i); // start from Sunday
                      const isTodayDate = isToday(d);
                      return (
                        <div 
                          key={i} 
                          onClick={() => {
                            setSelectedDate(d);
                            setActiveTab('calendar');
                          }}
                          className={`aspect-square flex items-center justify-center text-xs rounded-lg cursor-pointer transition-colors ${
                            isTodayDate 
                              ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/20' 
                              : d.getDate() === selectedDate.getDate() && activeTab === 'calendar'
                              ? 'bg-white/10 text-white font-bold border border-white/20'
                              : 'text-zinc-400 hover:bg-white/5'
                          }`}
                        >
                          {format(d, 'd')}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-indigo-500 text-white shadow-lg shadow-indigo-500/30">
                      <Bell size={16} />
                    </div>
                    <h4 className="text-sm font-semibold text-white">Próximo Lembrete</h4>
                  </div>
                  {criticalTasks.length > 0 ? (
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Lembrete para: <span className="text-white font-medium">{criticalTasks[0].title}</span>.
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-400 leading-relaxed">Nenhuma tarefa crítica agendada no momento.</p>
                  )}
                </div>
              </section>
            </div>
            )}
          </div>
        </div>

        {/* Notification Toast */}
        {criticalTasks.length > 0 && !toastDismissed && (
          <div className="absolute bottom-8 right-8 w-80 p-4 rounded-2xl bg-white/10 backdrop-blur-3xl border border-white/20 shadow-2xl flex items-center gap-4 z-50">
            <div className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center shrink-0">
              <Bell size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-white">Atenção</p>
              <p className="text-[11px] text-zinc-300">Você tem {criticalTasks.length} tarefa{criticalTasks.length > 1 ? 's' : ''} crítica{criticalTasks.length > 1 ? 's' : ''} pendente{criticalTasks.length > 1 ? 's' : ''}!</p>
            </div>
            <button onClick={() => setToastDismissed(true)} className="text-zinc-500 hover:text-white transition-colors">
              <Plus size={16} className="rotate-45" />
            </button>
          </div>
        )}
      </main>

      {/* New Task Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nova Tarefa">
        <form onSubmit={handleAddTask} className="space-y-4">
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
            <label className="block text-xs font-medium text-zinc-400 mb-1">Tags (separadas por vírgula)</label>
            <input
              type="text"
              value={newTaskTags}
              onChange={(e) => setNewTaskTags(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="Ex: Trabalho, Urgente"
            />
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
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
              Criar Tarefa
            </button>
          </div>
        </form>
      </Modal>
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

function TagItem({ color, label }: { key?: React.Key; color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer transition-colors">
      <span className={`w-2 h-2 rounded-full ${color}`}></span> {label}
    </div>
  );
}

function TaskItem({ title, description, urgency, tags, completed, time, onToggle }: { key?: React.Key; title: string; description?: string; urgency: Task['urgency']; tags: string[]; completed?: boolean; time?: string; onToggle?: () => void }) {
  const urgencyStyles = {
    low: 'hover:border-emerald-500/50',
    medium: 'hover:border-amber-500/50',
    high: 'hover:border-orange-500/50',
    critical: 'hover:border-rose-500/50',
  };

  const tagColors = {
    'Trabalho': 'bg-blue-500/20 text-blue-400',
    'Pessoal': 'bg-emerald-500/20 text-emerald-400',
    'Estudos': 'bg-purple-500/20 text-purple-400',
    'Urgente': 'bg-rose-500/20 text-rose-400'
  };

  const formattedTime = time ? format(parseISO(time), 'HH:mm') : undefined;

  return (
    <div className={`group p-4 rounded-2xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.06] transition-all cursor-pointer ${urgencyStyles[urgency]} ${completed ? 'opacity-50' : ''}`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-start gap-3">
          <button onClick={(e) => { e.stopPropagation(); onToggle?.(); }} className={`mt-0.5 shrink-0 w-4 h-4 rounded border ${completed ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-zinc-500 hover:border-indigo-500'} flex items-center justify-center transition-colors`}>
            {completed && <Check size={10} strokeWidth={4} />}
          </button>
          <div>
             <h3 className={`text-sm font-medium ${completed ? 'line-through text-zinc-400' : 'text-white'}`}>{title}</h3>
             {description && <p className="text-xs text-zinc-400 leading-relaxed mt-1">{description}</p>}
          </div>
        </div>
        {formattedTime && <span className="text-[10px] text-zinc-500 font-mono ml-4 shrink-0">{formattedTime}</span>}
        {!formattedTime && urgency === 'critical' && !completed && <span className="text-[10px] text-rose-500 font-bold uppercase tracking-tighter shrink-0 ml-4">Atrasado</span>}
      </div>
      
      <div className="mt-4 flex items-center gap-2 pl-7">
        {tags.map((tag, idx) => (
          <span key={`${tag}-${idx}`} className={`text-[9px] px-1.5 py-0.5 rounded ${tagColors[tag as keyof typeof tagColors] || 'bg-zinc-800 text-zinc-300'}`}>
            #{tag}
          </span>
        ))}
        {urgency === 'critical' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300">P1</span>}
      </div>
    </div>
  );
}

