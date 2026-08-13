import React, { useMemo } from 'react';
import { Task, Urgency } from '../types';
import { tagService } from '../services/tags';
import { startOfWeek, addWeeks, isSameWeek, parseISO, isPast, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, ListTodo, AlertTriangle, TrendingUp } from 'lucide-react';
import { formatDuracao } from './TaskDetailModal';

interface StatsViewProps {
  tasks: Task[]; // não deletadas (ativas + arquivadas)
}

const urgencyMeta: { id: Urgency; label: string; bar: string }[] = [
  { id: 'low', label: 'Baixa', bar: 'bg-emerald-500' },
  { id: 'medium', label: 'Média', bar: 'bg-amber-500' },
  { id: 'high', label: 'Alta', bar: 'bg-orange-500' },
  { id: 'critical', label: 'Crítica', bar: 'bg-rose-500' },
];

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone: string }) {
  return (
    <div className={`p-5 rounded-2xl border relative overflow-hidden ${tone}`}>
      <div className="absolute top-0 right-0 p-3 opacity-20">{icon}</div>
      <h3 className="text-xs font-bold uppercase tracking-wider mb-1 opacity-90">{label}</h3>
      <div className="text-3xl font-bold text-white">{value}</div>
    </div>
  );
}

export function StatsView({ tasks }: StatsViewProps) {
  const total = tasks.length;
  const done = tasks.filter(t => t.completed).length;
  const pending = tasks.filter(t => !t.completed).length;
  const overdue = tasks.filter(t => !t.completed && t.dueDate && isPast(parseISO(t.dueDate))).length;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;

  // Concluídas por semana (últimas 8 semanas) via completedAt.
  const weeks = useMemo(() => {
    const now = new Date();
    const arr: { label: string; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const ws = startOfWeek(addWeeks(now, -i), { weekStartsOn: 0 });
      const count = tasks.filter(t => t.completedAt && isSameWeek(parseISO(t.completedAt), ws, { weekStartsOn: 0 })).length;
      arr.push({ label: format(ws, 'dd/MM', { locale: ptBR }), count });
    }
    return arr;
  }, [tasks]);
  const maxWeek = Math.max(1, ...weeks.map(w => w.count));

  // Distribuição por criticidade (pendentes).
  const byUrgency = urgencyMeta.map(u => ({ ...u, count: tasks.filter(t => !t.completed && t.urgency === u.id).length }));
  const maxUrg = Math.max(1, ...byUrgency.map(u => u.count));

  // Previsto x realizado: entram as tarefas que têm estimativa ou apontamento.
  const tempo = useMemo(() => {
    const itens = tasks
      .filter(t => (t.estimateMinutes ?? 0) > 0 || (t.spentMinutes ?? 0) > 0)
      .map(t => ({
        id: t.id,
        title: t.title,
        estimado: t.estimateMinutes ?? 0,
        apontado: t.spentMinutes ?? 0,
        estourou: (t.estimateMinutes ?? 0) > 0 && (t.spentMinutes ?? 0) > (t.estimateMinutes ?? 0),
      }))
      .sort((a, b) => b.apontado - a.apontado)
      .slice(0, 8);
    return {
      itens,
      totalEstimado: tasks.reduce((s, t) => s + (t.estimateMinutes ?? 0), 0),
      totalApontado: tasks.reduce((s, t) => s + (t.spentMinutes ?? 0), 0),
    };
  }, [tasks]);

  // Top tags.
  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach(t => t.tags.forEach(tag => map.set(tag, (map.get(tag) || 0) + 1)));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [tasks]);
  const maxTag = Math.max(1, ...tagCounts.map(t => t[1]));

  return (
    <div className="flex-1 space-y-8">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <Kpi icon={<ListTodo size={44} className="text-indigo-500" />} label="Total" value={total} tone="bg-indigo-500/10 border-indigo-500/20 text-indigo-400" />
        <Kpi icon={<CheckCircle2 size={44} className="text-emerald-500" />} label="Concluídas" value={done} tone="bg-emerald-500/10 border-emerald-500/20 text-emerald-400" />
        <Kpi icon={<AlertTriangle size={44} className="text-rose-500" />} label="Atrasadas" value={overdue} tone="bg-rose-500/10 border-rose-500/20 text-rose-400" />
        <Kpi icon={<TrendingUp size={44} className="text-amber-500" />} label="Conclusão" value={`${rate}%`} tone="bg-amber-500/10 border-amber-500/20 text-amber-400" />
      </div>

      {/* Concluídas por semana */}
      <div className="bg-[#121214] border border-white/5 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white mb-1">Concluídas por semana</h3>
        <p className="text-xs text-zinc-500 mb-6">Últimas 8 semanas</p>
        <div className="flex items-end justify-between gap-3 h-40">
          {weeks.map((w, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <span className="text-xs font-semibold text-zinc-300">{w.count > 0 ? w.count : ''}</span>
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-indigo-600/40 to-indigo-500 transition-all"
                style={{ height: `${(w.count / maxWeek) * 100}%`, minHeight: w.count > 0 ? 4 : 0 }}
              />
              <span className="text-[10px] text-zinc-600">{w.label}</span>
            </div>
          ))}
        </div>
        {tasks.every(t => !t.completedAt) && (
          <p className="text-[11px] text-zinc-600 mt-4">As conclusões passam a ser registradas a partir de agora.</p>
        )}
      </div>

      {/* Previsto x realizado — só aparece quando há o que comparar. */}
      {tempo.itens.length > 0 && (
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-1">Previsto × realizado</h3>
          <p className="text-xs text-zinc-500 mb-5">
            {formatDuracao(tempo.totalApontado)} apontados de {formatDuracao(tempo.totalEstimado)} estimados
            {tempo.totalEstimado > 0 && (
              <span className={tempo.totalApontado > tempo.totalEstimado ? ' text-rose-400' : ' text-emerald-400'}>
                {' · '}{Math.round((tempo.totalApontado / tempo.totalEstimado) * 100)}%
              </span>
            )}
          </p>
          <div className="space-y-3">
            {tempo.itens.map(item => {
              const escala = Math.max(item.estimado, item.apontado, 1);
              return (
                <div key={item.id}>
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="text-xs text-zinc-300 truncate">{item.title}</span>
                    <span className="text-[11px] font-mono text-zinc-500 shrink-0">
                      {formatDuracao(item.apontado)} / {item.estimado > 0 ? formatDuracao(item.estimado) : '—'}
                    </span>
                  </div>
                  <div className="relative h-2.5 rounded-full bg-white/5 overflow-hidden">
                    {/* Fundo = estimativa; preenchimento = tempo realmente gasto. */}
                    <div className="absolute inset-y-0 left-0 bg-white/10" style={{ width: `${(item.estimado / escala) * 100}%` }} />
                    <div
                      className={`absolute inset-y-0 left-0 ${item.estourou ? 'bg-rose-500' : 'bg-emerald-500'}`}
                      style={{ width: `${(item.apontado / escala) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Por criticidade */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-1">Pendentes por criticidade</h3>
          <p className="text-xs text-zinc-500 mb-5">Distribuição das tarefas em aberto</p>
          <div className="space-y-3">
            {byUrgency.map(u => (
              <div key={u.id} className="flex items-center gap-3">
                <span className="w-14 text-xs text-zinc-400 shrink-0">{u.label}</span>
                <div className="flex-1 h-6 bg-white/5 rounded-md overflow-hidden">
                  <div className={`h-full ${u.bar} rounded-md transition-all`} style={{ width: `${(u.count / maxUrg) * 100}%` }} />
                </div>
                <span className="w-6 text-right text-xs font-semibold text-zinc-300">{u.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top tags */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-1">Tarefas por tag</h3>
          <p className="text-xs text-zinc-500 mb-5">Tags mais usadas</p>
          {tagCounts.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">Nenhuma tag usada ainda.</p>
          ) : (
            <div className="space-y-3">
              {tagCounts.map(([tag, count]) => (
                <div key={tag} className="flex items-center gap-3">
                  <span className="w-20 text-xs text-zinc-400 truncate shrink-0 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${tagService.getTagColor(tag)}`}></span>{tag}
                  </span>
                  <div className="flex-1 h-6 bg-white/5 rounded-md overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-md transition-all" style={{ width: `${(count / maxTag) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right text-xs font-semibold text-zinc-300">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
