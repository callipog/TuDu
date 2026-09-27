import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Plus, Command, FolderKanban, Users, Tag as TagIcon, Timer, Settings, Keyboard, RefreshCw, Github, FileStack } from 'lucide-react';
import { TuduLockup } from './TuduLogo';

interface AppMenuProps {
  onNewTask: () => void;
  onCommandPalette: () => void;
  onManageProjects: () => void;
  onManagePersonas: () => void;
  onManageTags: () => void;
  onTemplates: () => void;
  onPomodoro: () => void;
  onSettings: () => void;
  onShortcuts: () => void;
  onCheckUpdates: () => void;
  onGithub: () => void;
}

function Item({ icon, label, shortcut, onClick }: { icon: React.ReactNode; label: string; shortcut?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors text-left">
      <span className="text-zinc-500">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <kbd className="text-[10px] font-mono text-zinc-600 border border-white/10 rounded px-1.5 py-0.5">{shortcut}</kbd>}
    </button>
  );
}

export function AppMenu(props: AppMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const run = (fn: () => void) => () => { setOpen(false); fn(); };

  return (
    <div className="relative" ref={ref} style={{ WebkitAppRegion: 'no-drag' } as any}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors w-full"
      >
        <h1 className="flex-1 flex items-center h-8 min-w-0">
          <TuduLockup height={22} className="shrink-0" />
        </h1>
        <ChevronDown size={16} className={`text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute left-2 top-full mt-1 w-60 rounded-xl bg-[#0e0e10] border border-white/10 shadow-2xl z-[60] py-1.5 overflow-hidden"
          >
            <Item icon={<Plus size={15} />} label="Nova tarefa" shortcut="N" onClick={run(props.onNewTask)} />
            <Item icon={<Command size={15} />} label="Paleta de comandos" shortcut="Ctrl K" onClick={run(props.onCommandPalette)} />
            <div className="h-px bg-white/5 my-1.5" />
            <Item icon={<FolderKanban size={15} />} label="Gerenciar projetos" onClick={run(props.onManageProjects)} />
            <Item icon={<Users size={15} />} label="Personas da equipe" onClick={run(props.onManagePersonas)} />
            <Item icon={<TagIcon size={15} />} label="Gerenciar tags" onClick={run(props.onManageTags)} />
            <Item icon={<FileStack size={15} />} label="Modelos" onClick={run(props.onTemplates)} />
            <Item icon={<Timer size={15} />} label="Timer de foco" onClick={run(props.onPomodoro)} />
            <div className="h-px bg-white/5 my-1.5" />
            <Item icon={<Settings size={15} />} label="Configurações" onClick={run(props.onSettings)} />
            <Item icon={<Keyboard size={15} />} label="Atalhos de teclado" shortcut="?" onClick={run(props.onShortcuts)} />
            <Item icon={<RefreshCw size={15} />} label="Verificar atualizações" onClick={run(props.onCheckUpdates)} />
            <Item icon={<Github size={15} />} label="Repositório no GitHub" onClick={run(props.onGithub)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
