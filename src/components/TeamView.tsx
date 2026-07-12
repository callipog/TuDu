import React from 'react';
import { Task, Persona } from '../types';
import { Avatar } from './Avatar';
import { parseISO, isPast, isSameWeek } from 'date-fns';
import { Users, UserPlus } from 'lucide-react';

interface TeamViewProps {
  personas: Persona[];
  tasks: Task[]; // ativas (não arquivadas/deletadas)
  onManagePersonas: () => void;
}

function metricsFor(tasks: Task[]) {
  const now = new Date();
  const pending = tasks.filter(t => !t.completed);
  const overdue = pending.filter(t => t.dueDate && isPast(parseISO(t.dueDate)));
  const inProgress = pending.filter(t => t.status === 'in_progress');
  const doneWeek = tasks.filter(t => t.completed && t.completedAt && isSameWeek(parseISO(t.completedAt), now, { weekStartsOn: 0 }));
  return { pending: pending.length, overdue: overdue.length, inProgress: inProgress.length, doneWeek: doneWeek.length };
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex flex-col">
      <span className={`text-lg font-bold ${tone}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
    </div>
  );
}

export function TeamView({ personas, tasks, onManagePersonas }: TeamViewProps) {
  const unassigned = tasks.filter(t => !t.assigneeId);

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-zinc-400">Carga de trabalho e desempenho por pessoa.</p>
        <button onClick={onManagePersonas}
          className="shrink-0 flex items-center gap-2 text-sm font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 transition-colors">
          <UserPlus size={15} /> Gerenciar personas
        </button>
      </div>

      {personas.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20 text-zinc-500">
          <Users size={40} className="mb-4 opacity-40" />
          <p className="text-sm">Nenhuma persona cadastrada.</p>
          <p className="text-xs mt-1 text-zinc-600">Crie personas para atribuir tarefas e acompanhar a equipe.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {personas.map(p => {
            const mine = tasks.filter(t => t.assigneeId === p.id);
            const m = metricsFor(mine);
            return (
              <div key={p.id} className="p-5 rounded-2xl bg-[#121214] border border-white/5">
                <div className="flex items-center gap-3 mb-5">
                  <Avatar persona={p} size={44} />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">{p.name}</h3>
                    {p.role && <p className="text-xs text-zinc-500 truncate">{p.role}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <Stat label="Abertas" value={m.pending} tone="text-white" />
                  <Stat label="Andamento" value={m.inProgress} tone="text-amber-400" />
                  <Stat label="Atrasadas" value={m.overdue} tone="text-rose-400" />
                  <Stat label="Semana" value={m.doneWeek} tone="text-emerald-400" />
                </div>
              </div>
            );
          })}

          {/* Não atribuídas */}
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-dashed border-white/10">
            <div className="flex items-center gap-3 mb-5">
              <span className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500 text-xs">—</span>
              <div>
                <h3 className="text-sm font-semibold text-zinc-400">Sem responsável</h3>
                <p className="text-xs text-zinc-600">Tarefas não atribuídas</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <Stat label="Abertas" value={unassigned.filter(t => !t.completed).length} tone="text-zinc-300" />
              <Stat label="Andamento" value={unassigned.filter(t => !t.completed && t.status === 'in_progress').length} tone="text-amber-400/70" />
              <Stat label="Atrasadas" value={unassigned.filter(t => !t.completed && t.dueDate && isPast(parseISO(t.dueDate))).length} tone="text-rose-400/70" />
              <Stat label="Total" value={unassigned.length} tone="text-zinc-300" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
