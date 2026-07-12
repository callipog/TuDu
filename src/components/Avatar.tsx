import React from 'react';
import { Persona } from '../types';
import { initials } from '../services/personas';

// Mapa estático (classes completas para o Tailwind JIT detectar) da cor sólida
// bg-*-500 para a variante "soft" usada no avatar.
const SOFT: Record<string, string> = {
  'bg-blue-500': 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  'bg-emerald-500': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  'bg-purple-500': 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  'bg-rose-500': 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  'bg-amber-500': 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  'bg-cyan-500': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  'bg-pink-500': 'bg-pink-500/20 text-pink-300 border-pink-500/40',
  'bg-indigo-500': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
};

export function Avatar({ persona, size = 24, soft = true, title }: { key?: React.Key; persona: Persona; size?: number; soft?: boolean; title?: string }) {
  const softClass = SOFT[persona.color] ?? 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40';
  const fontSize = Math.round(size * 0.42);
  return (
    <span
      title={title ?? `${persona.name}${persona.role ? ` · ${persona.role}` : ''}`}
      className={`inline-flex items-center justify-center rounded-full font-semibold shrink-0 border ${soft ? softClass : `${persona.color} text-white border-transparent`}`}
      style={{ width: size, height: size, fontSize }}
    >
      {initials(persona.name)}
    </span>
  );
}
