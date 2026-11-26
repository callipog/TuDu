import React, { useEffect, useState } from 'react';
import { Minus, Plus, Volume2, Armchair, Droplets, Undo2 } from 'lucide-react';
import { CheckRow } from './CheckRow';
import type { Pomodoro } from '../hooks/usePomodoro';
import { END_SOUNDS, END_SOUND_LABEL, playEndSound } from '../services/sounds';
import type { WellnessInfo, WellnessPatch } from '../tudu-api';

const sectionTitle = 'text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-2';
const card = 'rounded-xl border border-white/10 bg-white/[0.02] px-4';

/** Campo numérico com passos — o spinner nativo do Chromium destoa do app. */
function NumberStepper({ value, onChange, min, max, step, unit, label }: {
  value: number; onChange: (v: number) => void; min: number; max: number; step: number; unit: string; label: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => { setDraft(null); }, [value]);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const commit = () => {
    const n = Number(draft);
    setDraft(null);
    if (Number.isFinite(n) && draft !== '') onChange(clamp(Math.round(n)));
  };
  return (
    <div className="inline-flex items-stretch rounded-lg border border-white/10 bg-white/5 overflow-hidden">
      <button type="button" onClick={() => onChange(clamp(value - step))} title={`Diminuir ${label}`}
        className="w-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
        <Minus size={12} />
      </button>
      <div className="flex items-baseline gap-1 px-2 border-x border-white/5">
        <input
          type="number" min={min} max={max} value={draft ?? String(value)}
          onChange={(e) => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          aria-label={label}
          className="bg-transparent text-center text-[13px] font-mono tabular-nums text-white focus:outline-none"
          style={{ width: `${Math.max(2, String(max).length)}ch` }}
        />
        <span className="text-[11px] text-zinc-500">{unit}</span>
      </div>
      <button type="button" onClick={() => onChange(clamp(value + step))} title={`Aumentar ${label}`}
        className="w-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
        <Plus size={12} />
      </button>
    </div>
  );
}

/** Uma linha "rótulo à esquerda, controle à direita". */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white">{label}</p>
        {hint && <p className="text-[11px] text-zinc-500">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Pills<T extends string | number>({ options, value, onChange, label }: {
  options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label?: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button
          key={String(o.id)} type="button" onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          title={label?.(o.id)}
          className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-md border transition-colors ${
            value === o.id
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border-white/10'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Lê e grava os lembretes de bem-estar (processo principal). */
function useWellness(isOpen: boolean) {
  const [info, setInfo] = useState<WellnessInfo | null>(null);
  const api = typeof window !== 'undefined' ? window.tudu?.wellness : undefined;
  useEffect(() => {
    if (isOpen && api) api.get().then(setInfo).catch(() => setInfo(null));
  }, [isOpen, api]);
  async function update(patch: WellnessPatch) {
    if (!api) return;
    // Otimista: a tela responde na hora; o que voltar do main é a palavra final.
    setInfo(prev => prev ? {
      ...prev,
      config: {
        water: { ...prev.config.water, ...(patch.water ?? {}) },
        stand: { ...prev.config.stand, ...(patch.stand ?? {}) },
      },
    } : prev);
    const saved = await api.setConfig(patch).catch(() => null);
    if (saved) setInfo(saved);
  }
  async function action(type: Parameters<NonNullable<typeof api>['action']>[0]['type']) {
    if (!api) return;
    const saved = await api.action({ type }).catch(() => null);
    if (saved) setInfo(saved);
  }
  return { info, update, action, available: !!api };
}

function litros(ml: number) {
  return ml >= 1000 ? `${String(+(ml / 1000).toFixed(2)).replace('.', ',')} L` : `${ml} ml`;
}


/* ------------------------------------------------------------------ Foco */

export function FocoSettings({ pomo, isOpen }: { pomo: Pomodoro; isOpen: boolean }) {
  const { info, update, available } = useWellness(isOpen);
  const stand = info?.config.stand;

  return (
    <div className="space-y-5">
      <div>
        <p className={sectionTitle}>Pomodoro</p>
        <div className={`${card} divide-y divide-white/5`}>
          <Field label="Foco" hint="Duração de cada bloco de trabalho.">
            <NumberStepper value={pomo.workMinutes} onChange={(v) => pomo.setMinutes('work', v)} min={1} max={180} step={5} unit="min" label="minutos de foco" />
          </Field>
          <Field label="Pausa curta">
            <NumberStepper value={pomo.breakMinutes} onChange={(v) => pomo.setMinutes('break', v)} min={1} max={60} step={1} unit="min" label="minutos de pausa curta" />
          </Field>
          <Field label="Pausa longa" hint="Entra no lugar da curta de tempos em tempos.">
            <NumberStepper value={pomo.longBreakMinutes} onChange={(v) => pomo.setMinutes('long', v)} min={1} max={90} step={5} unit="min" label="minutos de pausa longa" />
          </Field>
          <Field label="Pausa longa a cada" hint={pomo.longEvery ? `No ${pomo.longEvery}º, ${pomo.longEvery * 2}º… foco fechado.` : 'Desligada: só pausas curtas.'}>
            <NumberStepper value={pomo.longEvery} onChange={pomo.setLongEvery} min={0} max={12} step={1} unit={pomo.longEvery === 1 ? 'foco' : 'focos'} label="focos até a pausa longa" />
          </Field>
        </div>
      </div>

      <div>
        <p className={sectionTitle}>Som do fim do foco</p>
        <div className={`${card} py-3 space-y-2.5`}>
          <Pills
            options={END_SOUNDS.map(id => ({ id, label: END_SOUND_LABEL[id] }))}
            value={pomo.endSound}
            onChange={(v) => { pomo.setEndSound(v); playEndSound(v); }}
          />
          <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <Volume2 size={12} /> Clique para ouvir. {pomo.soundOn ? 'Toca quando um bloco de foco fecha.' : 'Os sons do foco estão desligados no Modo foco.'}
          </p>
          {!pomo.soundOn && (
            <button type="button" onClick={() => pomo.setSoundOn(true)} className="text-[11px] font-semibold text-indigo-300 hover:text-indigo-200">
              Ligar os sons do foco
            </button>
          )}
        </div>
      </div>

      <div>
        <p className={sectionTitle}>Lembrete para levantar</p>
        <div className={`${card} divide-y divide-white/5 ${available ? '' : 'opacity-40 pointer-events-none'}`}>
          <CheckRow
            checked={!!stand?.enabled}
            onChange={(v) => update({ stand: { enabled: v } })}
            icon={<Armchair size={15} />}
            label="Avisar quando eu ficar muito tempo sentado"
            hint="Conta o tempo em uso contínuo. Ficar 5 min longe do computador, travar a tela ou suspender zera a conta."
          />
          <div className={stand?.enabled ? '' : 'opacity-40 pointer-events-none'}>
            <Field label="Avisar depois de" hint={info?.summary.stand ? `Agora: sentado há ${info.summary.stand.sittingMin} min.` : undefined}>
              <NumberStepper value={stand?.afterMin ?? 50} onChange={(v) => update({ stand: { afterMin: v } })} min={10} max={180} step={5} unit="min" label="minutos sentado" />
            </Field>
            <CheckRow checked={!!stand?.sound} onChange={(v) => update({ stand: { sound: v } })} icon={<Volume2 size={15} />} label="Tocar um som no aviso" />
          </div>
        </div>
        <p className="text-[11px] text-zinc-500 mt-2">Durante um bloco de foco o aviso espera a pausa. Ele aparece na ilha, por cima das janelas; com a ilha desligada, vira notificação do Windows.</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Água */

const CUPS = [150, 200, 250, 300, 350, 500];

export function AguaSettings({ isOpen }: { isOpen: boolean }) {
  const { info, update, action, available } = useWellness(isOpen);
  const water = info?.config.water;
  const today = info?.summary.water;
  const frac = today && today.goalMl ? Math.min(1, today.ml / today.goalMl) : 0;

  return (
    <div className="space-y-5">
      <div className={`${card} ${available ? '' : 'opacity-40 pointer-events-none'}`}>
        <CheckRow
          checked={!!water?.enabled}
          onChange={(v) => update({ water: { enabled: v } })}
          icon={<Droplets size={15} />}
          label="Lembrar de beber água"
          hint="A ilha ganha a seção Água, com o copo do dia e o botão “Bebi”."
        />
      </div>

      <div className={`space-y-5 transition-opacity ${water?.enabled ? '' : 'opacity-40 pointer-events-none'}`}>
        {today && (
          <div>
            <p className={sectionTitle}>Hoje</p>
            <div className={`${card} py-3 space-y-2.5`}>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-white tabular-nums">{litros(today.ml)}</span>
                <span className="text-xs text-zinc-500">de {litros(today.goalMl)}</span>
                <span className="ml-auto text-[11px] text-zinc-500">{Math.round(frac * 100)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-400 transition-[width] duration-500" style={{ width: `${frac * 100}%` }} />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => action('water-drink')}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors">
                  <Droplets size={13} /> Bebi +{today.cupMl} ml
                </button>
                {today.ml > 0 && (
                  <button type="button" onClick={() => action('water-undo')}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 transition-colors">
                    <Undo2 size={13} /> Desfazer
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div>
          <p className={sectionTitle}>Lembrete</p>
          <div className={`${card} divide-y divide-white/5`}>
            <Field label="Meta por dia">
              <NumberStepper value={water?.goalMl ?? 2000} onChange={(v) => update({ water: { goalMl: v } })} min={250} max={6000} step={250} unit="ml" label="meta de água por dia" />
            </Field>
            <Field label="Lembrar a cada" hint="Contando do último copo. Bateu a meta, para até amanhã.">
              <NumberStepper value={water?.everyMin ?? 60} onChange={(v) => update({ water: { everyMin: v } })} min={10} max={240} step={15} unit="min" label="minutos entre lembretes" />
            </Field>
            <div className="py-2.5 space-y-2">
              <p className="text-sm text-white">Tamanho do copo</p>
              <Pills
                options={CUPS.map(ml => ({ id: ml, label: `${ml} ml` }))}
                value={water?.cupMl ?? 250}
                onChange={(v) => update({ water: { cupMl: v } })}
              />
            </div>
            <div className="flex items-center">
              <div className="flex-1">
                <CheckRow checked={!!water?.sound} onChange={(v) => update({ water: { sound: v } })} icon={<Volume2 size={15} />} label="Tocar um som no aviso" />
              </div>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">
            Com o computador parado ninguém é avisado; durante um bloco de foco o aviso espera a pausa.
          </p>
        </div>
      </div>
    </div>
  );
}
