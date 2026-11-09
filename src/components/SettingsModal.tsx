import React, { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { settingsService, AppSettings, GITHUB_URL, AUTHOR_NAME, REPORT_EMAIL } from '../services/settings';
import { notificationService } from '../services/notifications';
import { backupService } from '../services/backup';
import { taskService } from '../services/tasks';
import { tagService } from '../services/tags';
import { themeService, Theme } from '../services/theme';
import { boardStyleService, BoardGlow, BoardRadius, BOARD_GLOWS, BOARD_RADII } from '../services/boardStyle';
import type { IslandConfig } from '../tudu-api';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, FolderOpen, Bug, Bell, Github, Power, EyeOff, Eye, Copy, Download, Upload, RefreshCw, MinusSquare, ListChecks, Tag as TagIcon, Moon, Sun, Monitor, Coffee, Plug, Zap, Keyboard, CloudUpload, HardDrive, Palette, Info, AlertTriangle, PanelTop, Pin, MousePointerClick, Music, Timer, BellRing, ListPlus, CalendarCheck } from 'lucide-react';

type BridgeStatus = Awaited<ReturnType<NonNullable<Window['tudu']>['bridge']['status']>>;
type CaptureConfig = Awaited<ReturnType<NonNullable<Window['tudu']>['capture']['get']>>;
type BackupState = Awaited<ReturnType<NonNullable<Window['tudu']>['backup']['state']>>;

/** Monta um acelerador do Electron ("Control+Shift+Space") a partir da tecla pressionada. */
function acceleratorFromEvent(e: KeyboardEvent): string | null {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Control');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Super');

  const key = e.key;
  if (['Control', 'Alt', 'Shift', 'Meta', 'OS'].includes(key)) return null;

  let final: string;
  if (key === ' ' || key === 'Spacebar') final = 'Space';
  else if (key.length === 1) final = key.toUpperCase();
  else if (/^F\d{1,2}$/.test(key)) final = key;
  else if (['Enter', 'Tab', 'Backspace', 'Delete', 'Insert', 'Home', 'End', 'PageUp', 'PageDown', 'Escape'].includes(key)) final = key;
  else if (key.startsWith('Arrow')) final = key.replace('Arrow', '');
  else return null;

  // Atalho global sem modificador sequestraria a tecla no sistema inteiro.
  if (parts.length === 0) return null;
  parts.push(final);
  return parts.join('+');
}

/** Versão legível do acelerador, com os nomes que aparecem no teclado. */
function formatAccelerator(accel: string): string {
  return accel
    .replace('Control', 'Ctrl')
    .replace('Super', 'Win')
    .replace('Space', 'Espaço')
    .split('+')
    .join(' + ');
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataImported: () => void;
}

/**
 * Seções da trilha lateral. As nove seções antigas foram agrupadas em seis:
 * o que era "Backup automático" + "Dados & Backup" virou um assunto só, e
 * "Sobre" + "Suporte" também. A zona de perigo fica ancorada no rodapé.
 */
type SectionId = 'aparencia' | 'ilha' | 'comportamento' | 'dados' | 'ia' | 'sobre' | 'perigo';

const SECTIONS: { id: SectionId; label: string; icon: React.ReactNode; title: string; hint: string }[] = [
  { id: 'aparencia', label: 'Aparência', icon: <Palette size={15} />, title: 'Aparência', hint: 'Tema, brilho e arredondamento das colunas do board.' },
  { id: 'ilha', label: 'Ilha', icon: <PanelTop size={15} />, title: 'Ilha', hint: 'A pílula do TuDu na área de trabalho: o que ela mostra e onde fica.' },
  { id: 'comportamento', label: 'Comportamento', icon: <Power size={15} />, title: 'Comportamento', hint: 'Como o TuDu abre e como você joga tarefa pra dentro.' },
  { id: 'dados', label: 'Backup & Dados', icon: <HardDrive size={15} />, title: 'Backup & Dados', hint: 'Cópias automáticas, pasta do banco e exportação.' },
  { id: 'ia', label: 'Agentes de IA', icon: <Plug size={15} />, title: 'Agentes de IA (MCP)', hint: 'Porta local para assistentes criarem projetos e tarefas.' },
  { id: 'sobre', label: 'Sobre & Suporte', icon: <Info size={15} />, title: 'Sobre & Suporte', hint: 'Versão, atualizações e como pedir ajuda.' },
];

const PERIGO: { id: SectionId; label: string; icon: React.ReactNode; title: string; hint: string } = {
  id: 'perigo', label: 'Zona de perigo', icon: <AlertTriangle size={15} />,
  title: 'Zona de perigo', hint: 'Ações irreversíveis. Exporte um backup antes, se precisar.',
};

/* As oito posições da ilha, na ordem da grade 3 × 3 (o centro fica vazio).
   Classes literais: o Tailwind não enxerga classe montada em runtime. */
const ISLAND_POSITIONS: { id: IslandConfig['position'] | null; label: string; mark: string }[] = [
  { id: 'tl', label: 'Superior esquerdo', mark: 'top-[16%] left-[10%]' },
  { id: 'tc', label: 'Superior central', mark: 'top-[16%] left-[29%]' },
  { id: 'tr', label: 'Superior direito', mark: 'top-[16%] right-[10%]' },
  { id: 'cl', label: 'Central esquerdo', mark: 'top-[42%] left-[10%]' },
  { id: null, label: '', mark: '' },
  { id: 'cr', label: 'Central direito', mark: 'top-[42%] right-[10%]' },
  { id: 'bl', label: 'Inferior esquerdo', mark: 'bottom-[16%] left-[10%]' },
  { id: 'bc', label: 'Inferior central', mark: 'bottom-[16%] left-[29%]' },
  { id: 'br', label: 'Inferior direito', mark: 'bottom-[16%] right-[10%]' },
];

/* Três etapas de exemplo para a amostra das bordas do board. */
const BOARD_PREVIEW = [
  { label: 'A Fazer', rgb: '59 130 246' },
  { label: 'Em Andamento', rgb: '245 158 11' },
  { label: 'Finalizado', rgb: '16 185 129' },
];

function CheckRow({ checked, onChange, disabled, icon, label, hint }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; icon: React.ReactNode; label: string; hint?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-3 py-2 text-left ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-zinc-500'}`}>
        {checked && <Check size={10} strokeWidth={4} />}
      </span>
      <span className="text-zinc-400">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-white">{label}</span>
        {hint && <span className="block text-[11px] text-zinc-500">{hint}</span>}
      </span>
    </button>
  );
}

export function SettingsModal({ isOpen, onClose, onDataImported }: SettingsModalProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [section, setSection] = useState<SectionId>('aparencia');
  const [copied, setCopied] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const [updateReady, setUpdateReady] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(themeService.get());
  const [glow, setGlow] = useState<BoardGlow>(boardStyleService.getGlow());
  const [radius, setRadius] = useState<BoardRadius>(boardStyleService.getRadius());
  const [island, setIsland] = useState<IslandConfig | null>(null);
  const [bridge, setBridge] = useState<BridgeStatus | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [capture, setCapture] = useState<CaptureConfig | null>(null);
  const [gravandoAtalho, setGravandoAtalho] = useState(false);
  const [backup, setBackup] = useState<BackupState | null>(null);
  const [salvandoBackup, setSalvandoBackup] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [restaurar, setRestaurar] = useState<{ name: string; size: number; at: string }[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isElectron = settingsService.isElectron();

  async function toggleBridge(v: boolean) {
    const result = await window.tudu?.bridge.setEnabled(v);
    if (result) setBridge(b => (b ? { ...b, ...result } : b));
    setShowToken(false);
  }

  async function toggleAutoApply(v: boolean) {
    const autoApply = await window.tudu?.bridge.setAutoApply(v);
    setBridge(b => (b ? { ...b, autoApply: !!autoApply } : b));
  }

  function copyToken() {
    if (!bridge?.token) return;
    navigator.clipboard?.writeText(bridge.token);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 1500);
  }

  useEffect(() => {
    const unsub = settingsService.onUpdate({
      progress: (pct) => setUpdateMsg(`Baixando atualização… ${pct}%`),
      downloaded: (v) => { setUpdateReady(v); setUpdateMsg(`Versão ${v} baixada.`); },
      error: () => setUpdateMsg('Falha ao baixar a atualização.'),
    });
    return unsub;
  }, []);

  async function handleCheckUpdates() {
    setUpdateMsg('Verificando…');
    const result = await settingsService.checkUpdates();
    // Se já houver download em andamento, os eventos cuidam da mensagem.
    if (result.status !== 'available') setUpdateMsg(result.message);
  }

  async function handleResetTasks() {
    if (!window.confirm('Apagar TODAS as tarefas (incluindo arquivadas)? Essa ação não pode ser desfeita. Considere exportar um backup antes.')) return;
    await taskService.clearAllTasks();
    notificationService.clearFired();
    onDataImported();
  }

  function handleResetTags() {
    if (!window.confirm('Apagar TODAS as tags? As tarefas mantêm os nomes das tags, mas elas somem da lista e voltam à cor padrão.')) return;
    tagService.clearTags();
    onDataImported();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!window.confirm('Importar este backup? As tarefas com o mesmo id serão sobrescritas; as demais serão mantidas.')) return;
    try {
      const result = await backupService.importData(file);
      setImportMsg(`Importado: ${result.tasks} tarefa(s) e ${result.tags} tag(s).`);
      onDataImported();
    } catch (err: any) {
      setImportMsg(err.message || 'Falha ao importar backup.');
    }
  }

  useEffect(() => {
    if (isOpen) {
      settingsService.get().then(setSettings);
      window.tudu?.bridge.status().then(setBridge).catch(() => setBridge(null));
      window.tudu?.capture.get().then(setCapture).catch(() => setCapture(null));
      window.tudu?.backup.state().then(setBackup).catch(() => setBackup(null));
      window.tudu?.island?.getConfig().then(setIsland).catch(() => setIsland(null));
      setSection('aparencia');
      setRestaurar(null);
      setBackupMsg(null);
      setCopied(false);
      setShowToken(false);
      setGravandoAtalho(false);
      setTheme(themeService.get());
      setGlow(boardStyleService.getGlow());
      setRadius(boardStyleService.getRadius());
    }
  }, [isOpen]);

  const version = settings?.version ?? '—';

  async function toggleLogin(v: boolean) {
    const result = await settingsService.setOpenAtLogin(v);
    setSettings(s => s ? { ...s, openAtLogin: result } : s);
  }

  async function toggleMinimized(v: boolean) {
    const result = await settingsService.setStartMinimized(v);
    setSettings(s => s ? { ...s, startMinimized: result } : s);
  }

  async function toggleCloseToTray(v: boolean) {
    const result = await settingsService.setCloseToTray(v);
    setSettings(s => s ? { ...s, closeToTray: result } : s);
  }

  function copyPath() {
    if (settings?.userDataPath) {
      navigator.clipboard?.writeText(settings.userDataPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  async function salvarBackup(patch: { enabled?: boolean; dir?: string; keep?: number }) {
    const result = await window.tudu?.backup.set(patch);
    if (result) setBackup(result);
  }

  const toggleAutoBackup = (v: boolean) => salvarBackup({ enabled: v });

  async function escolherPastaBackup() {
    const result = await window.tudu?.backup.chooseDir();
    if (result) setBackup(result);
  }

  /** Pasta vazia = volta para a padrão do app (userData/backups). */
  async function definirPastaBackup(dir: string) {
    if (!dir) {
      const s = await window.tudu?.settings.get();
      if (s) await salvarBackup({ dir: `${s.userDataPath}\\backups` });
      return;
    }
    await salvarBackup({ dir });
  }

  async function backupAgora() {
    setSalvandoBackup(true);
    setBackupMsg(null);
    const ok = await backupService.runAutoBackupIfDue(true);
    const state = await window.tudu?.backup.state();
    if (state) setBackup(state);
    setSalvandoBackup(false);
    setBackupMsg(ok ? 'Cópia criada.' : 'Não foi possível criar a cópia.');
    setTimeout(() => setBackupMsg(null), 4000);
  }

  async function abrirRestauracao() {
    if (restaurar) { setRestaurar(null); return; }
    const lista = await window.tudu?.backup.list();
    setRestaurar(lista ?? []);
  }

  async function restaurarCopia(name: string) {
    if (!window.confirm('Restaurar esta cópia? As tarefas com o mesmo id serão sobrescritas; as demais são mantidas.')) return;
    const texto = await window.tudu?.backup.read(name);
    if (!texto) { setBackupMsg('Não foi possível ler a cópia.'); return; }
    try {
      const result = await backupService.importJson(texto);
      setBackupMsg(`Restaurado: ${result.tasks} tarefa(s).`);
      setRestaurar(null);
      onDataImported();
    } catch (err: any) {
      setBackupMsg(err.message || 'Falha ao restaurar.');
    }
  }

  async function toggleCapture(v: boolean) {
    const result = await window.tudu?.capture.set({ enabled: v });
    if (result) setCapture(result);
    setGravandoAtalho(false);
  }

  // Grava a próxima combinação pressionada como atalho global.
  useEffect(() => {
    if (!gravandoAtalho) return;
    function onKey(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setGravandoAtalho(false); return; }
      const accel = acceleratorFromEvent(e);
      if (!accel) return; // só modificadores: segue esperando a tecla final
      setGravandoAtalho(false);
      window.tudu?.capture.set({ accelerator: accel }).then(r => { if (r) setCapture(r); });
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [gravandoAtalho]);

  const sectionTitle = 'text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-2';

  /* Ilha: aplica na tela na hora e confirma com o que o processo principal gravou. */
  async function updateIsland(patch: Parameters<NonNullable<Window['tudu']>['island']['setConfig']>[0]) {
    setIsland(prev => prev ? { ...prev, ...patch, sections: { ...prev.sections, ...(patch.sections ?? {}) } } as IslandConfig : prev);
    const saved = await window.tudu?.island?.setConfig(patch).catch(() => null);
    if (saved) setIsland(saved);
  }
  const atual = section === 'perigo' ? PERIGO : SECTIONS.find(s => s.id === section)!;

  const navItem = (item: typeof PERIGO, perigoso = false) => {
    const ativo = section === item.id;
    return (
      <button
        key={item.id}
        onClick={() => setSection(item.id)}
        aria-current={ativo ? 'page' : undefined}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
          ativo
            ? perigoso
              ? 'bg-rose-500/15 border border-rose-500/40 text-rose-300 font-semibold'
              : 'bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 font-semibold'
            : perigoso
              ? 'border border-transparent text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10'
              : 'border border-transparent text-zinc-400 hover:text-white hover:bg-white/5'
        }`}
      >
        <span className="shrink-0">{item.icon}</span>
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configurações" size="4xl" flush>
      {/* Altura fixa (limitada pela viewport): sem isso o modal encolhe e cresce
          a cada troca de seção, já que cada painel tem um tamanho. Quem rola é
          o painel da direita, não a caixa. */}
      <div className="flex-1 min-w-0 flex h-[min(520px,72vh)]">
        {/* Trilha lateral */}
        <nav className="w-[212px] shrink-0 border-r border-white/10 bg-white/[0.02] p-2.5 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
          {SECTIONS.map(item => navItem(item))}
          <span className="flex-1 min-h-4" />
          {navItem(PERIGO, true)}
        </nav>

        {/* Painel */}
        <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar px-6 py-5">
          <div className="mb-4">
            <h3 className="text-[15px] font-semibold text-white">{atual.title}</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">{atual.hint}</p>
          </div>

          {!isElectron && (
            <p className="text-[11px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-4">
              Algumas opções só funcionam no app desktop (fora do navegador).
            </p>
          )}

          {/* ---------------------------------------------------- Aparência */}
          {section === 'aparencia' && (
            <div className="space-y-5">
              <div>
                <p className={sectionTitle}>Tema</p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { id: 'dark' as Theme, label: 'Escuro', icon: <Moon size={15} /> },
                    { id: 'light' as Theme, label: 'Claro', icon: <Sun size={15} /> },
                    { id: 'sepia' as Theme, label: 'Sépia', icon: <Coffee size={15} /> },
                    { id: 'system' as Theme, label: 'Sistema', icon: <Monitor size={15} /> },
                  ]).map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => { themeService.set(opt.id); setTheme(opt.id); }}
                      className={`flex items-center justify-center gap-2 text-sm font-medium rounded-lg py-2.5 border transition-colors ${
                        theme === opt.id
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border-white/10'
                      }`}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className={sectionTitle}>Bordas do board</p>
                {/* As colunas abaixo usam a mesma classe `kanban-col` do board,
                    então a amostra muda junto com a escolha — não é um desenho
                    separado que pode ficar desatualizado. */}
                <div className="flex gap-2.5 mb-3 px-0.5 py-1">
                  {BOARD_PREVIEW.map(prev => (
                    <div
                      key={prev.label}
                      style={{ ['--col' as string]: prev.rgb } as React.CSSProperties}
                      className="kanban-col flex-1 min-w-0 bg-[#121214] overflow-hidden"
                    >
                      <div className="px-2.5 py-1.5 border-b border-white/5 text-[10px] font-semibold text-white truncate">{prev.label}</div>
                      <div className="p-2.5 space-y-1.5">
                        <div className="kanban-card h-6 bg-white/[0.04] border border-white/10" />
                        <div className="kanban-card h-6 w-3/4 bg-white/[0.04] border border-white/10" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {BOARD_GLOWS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => { boardStyleService.setGlow(opt.id); setGlow(opt.id); }}
                      className={`text-left rounded-lg px-3 py-2 border transition-colors ${
                        glow === opt.id
                          ? 'bg-indigo-500/15 border-indigo-500/50'
                          : 'bg-white/5 hover:bg-white/10 border-white/10'
                      }`}
                    >
                      <span className={`block text-sm font-medium ${glow === opt.id ? 'text-indigo-300' : 'text-white'}`}>{opt.label}</span>
                      <span className="block text-[11px] text-zinc-500 leading-snug">{opt.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className={sectionTitle}>Arredondamento</p>
                <div className="grid grid-cols-4 gap-2">
                  {BOARD_RADII.map(r => (
                    <button
                      key={r}
                      onClick={() => { boardStyleService.setRadius(r); setRadius(r); }}
                      className={`text-sm font-medium rounded-lg py-2 border transition-colors ${
                        radius === r
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border-white/10'
                      }`}
                    >
                      {r}px{r === 16 && <span className="block text-[10px] font-normal opacity-70">padrão</span>}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-zinc-500 mt-2">Vale para as colunas e para os cards dentro delas, que ficam 2px mais fechados.</p>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------- Ilha */}
          {section === 'ilha' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4">
                <CheckRow
                  checked={!!island?.enabled}
                  onChange={(v) => updateIsland({ enabled: v })}
                  disabled={!isElectron || !island}
                  icon={<PanelTop size={15} />}
                  label="Mostrar a ilha na área de trabalho"
                  hint="Fica atrás das outras janelas: aparece quando a área de trabalho está à vista."
                />
              </div>

              <div className={`space-y-5 transition-opacity ${island?.enabled ? '' : 'opacity-40 pointer-events-none'}`}>
                <div>
                  <p className={sectionTitle}>Posição</p>
                  <div className="flex items-start gap-4">
                    <div className="grid grid-cols-3 gap-1.5 w-[168px] shrink-0">
                      {ISLAND_POSITIONS.map((pos, i) => pos.id === null ? (
                        <span key={i} className="aspect-[16/10] rounded-md border border-dashed border-white/5" aria-hidden="true" />
                      ) : (
                        <button
                          key={pos.id}
                          type="button"
                          title={pos.label}
                          aria-label={pos.label}
                          aria-pressed={island?.position === pos.id}
                          onClick={() => updateIsland({ position: pos.id! })}
                          className={`relative aspect-[16/10] rounded-md border transition-colors ${
                            island?.position === pos.id
                              ? 'bg-indigo-500/15 border-indigo-500/50'
                              : 'bg-white/5 hover:bg-white/10 border-white/10'
                          }`}
                        >
                          <span className={`absolute w-[42%] h-[15%] rounded-full ${pos.mark} ${island?.position === pos.id ? 'bg-indigo-400' : 'bg-white/30'}`} />
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-zinc-500 pt-1">
                      Agora em <span className="text-zinc-300 font-medium">{ISLAND_POSITIONS.find(p => p.id === island?.position)?.label ?? '—'}</span>.
                      A ilha cresce sempre para longe da borda em que mora.
                    </p>
                  </div>
                </div>

                <div>
                  <p className={sectionTitle}>Seções</p>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 divide-y divide-white/5">
                    <CheckRow checked disabled onChange={() => {}} icon={<CalendarCheck size={15} />} label="Hoje" hint="A próxima tarefa e o progresso do dia. Sempre ligada: é a seção de base." />
                    <CheckRow checked={!!island?.sections.player} onChange={(v) => updateIsland({ sections: { player: v } })} icon={<Music size={15} />} label="Player" hint="O que estiver tocando no Spotify, YouTube ou outro player do Windows." />
                    <CheckRow checked={!!island?.sections.foco} onChange={(v) => updateIsland({ sections: { foco: v } })} icon={<Timer size={15} />} label="Timer de foco" hint="O ciclo do Pomodoro rodando fora do app." />
                    <CheckRow checked={!!island?.sections.lembretes} onChange={(v) => updateIsland({ sections: { lembretes: v } })} icon={<BellRing size={15} />} label="Lembretes" hint="Prazos vencidos com os botões de concluir e adiar." />
                    <CheckRow checked={!!island?.sections.captura} onChange={(v) => updateIsland({ sections: { captura: v } })} icon={<ListPlus size={15} />} label="Nova tarefa" hint="O campo de captura rápida dentro da ilha." />
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-2">Cada seção ligada vira um ponto embaixo da ilha. Desligar também a tira da fila: ela nunca toma a linha fechada.</p>
                </div>

                <div>
                  <p className={sectionTitle}>Comportamento</p>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 divide-y divide-white/5">
                    <CheckRow checked={!!island?.hoverOpen} onChange={(v) => updateIsland({ hoverOpen: v })} icon={<MousePointerClick size={15} />} label="Abrir ao passar o mouse" hint="Desligado, a ilha só abre com um clique." />
                    <CheckRow checked={!!island?.raiseCritical} onChange={(v) => updateIsland({ raiseCritical: v })} icon={<AlertTriangle size={15} />} label="Lembrete crítico sobe por cima das janelas" hint="Os outros esperam você voltar à área de trabalho." />
                    <CheckRow checked={!!island?.pinned} onChange={(v) => updateIsland({ pinned: v })} icon={<Pin size={15} />} label="Fixar por cima das janelas" hint="A ilha fica sempre à vista. O mesmo que o alfinete dela." />
                    <CheckRow checked={!!island?.pauseAtCycleEnd} onChange={(v) => updateIsland({ pauseAtCycleEnd: v })} disabled={!island?.sections.player} icon={<Music size={15} />} label="Pausar a música no fim do ciclo de foco" hint="Quando um bloco do Pomodoro fecha, a faixa para sozinha." />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------- Comportamento */}
          {section === 'comportamento' && (
            <div className="space-y-5">
              <div>
                <p className={sectionTitle}>Inicialização</p>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 divide-y divide-white/5">
                  <CheckRow
                    checked={!!settings?.openAtLogin}
                    onChange={toggleLogin}
                    disabled={!isElectron}
                    icon={<Power size={15} />}
                    label="Iniciar com o Windows"
                    hint="Abre o TuDu automaticamente ao ligar o computador."
                  />
                  <CheckRow
                    checked={!!settings?.startMinimized}
                    onChange={toggleMinimized}
                    disabled={!isElectron}
                    icon={<EyeOff size={15} />}
                    label="Iniciar minimizado"
                    hint="Começa recolhido na bandeja do sistema, sem abrir a janela."
                  />
                  <CheckRow
                    checked={!!settings?.closeToTray}
                    onChange={toggleCloseToTray}
                    disabled={!isElectron}
                    icon={<MinusSquare size={15} />}
                    label="Fechar para a bandeja"
                    hint="Ao clicar no X, esconde na bandeja. Se desativado, o X fecha o app por completo."
                  />
                </div>
              </div>

              <div>
                <p className={sectionTitle}>Captura rápida</p>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 divide-y divide-white/5">
                  <CheckRow
                    checked={!!capture?.enabled}
                    onChange={toggleCapture}
                    disabled={!isElectron}
                    icon={<Zap size={15} />}
                    label="Atalho global para criar tarefa"
                    hint="Abre uma caixa por cima de qualquer programa. Aceita data, #tag e !criticidade."
                  />
                  <div className="py-3 flex items-center gap-3">
                    <span className="text-zinc-400 shrink-0"><Keyboard size={15} /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">Combinação</p>
                      <p className="text-[11px] text-zinc-500">
                        {gravandoAtalho
                          ? 'Pressione a combinação desejada…'
                          : capture && !capture.registered && capture.enabled
                            ? 'Outro programa já usa este atalho. Escolha outra combinação.'
                            : 'Clique em Alterar e pressione as teclas.'}
                      </p>
                    </div>
                    <kbd className={`shrink-0 text-[11px] font-mono px-2 py-1 rounded-md border ${
                      gravandoAtalho
                        ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10'
                        : capture?.enabled && !capture?.registered
                          ? 'border-rose-500/40 text-rose-300 bg-rose-500/10'
                          : 'border-white/10 text-zinc-300 bg-black/40'
                    }`}>
                      {formatAccelerator(capture?.accelerator ?? '—')}
                    </kbd>
                    <button
                      onClick={() => setGravandoAtalho(v => !v)}
                      disabled={!isElectron || !capture?.enabled}
                      className="shrink-0 text-xs font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                    >
                      {gravandoAtalho ? 'Cancelar' : 'Alterar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* -------------------------------------------- Backup & Dados */}
          {section === 'dados' && (
            <div className="space-y-5">
              <div>
                <p className={sectionTitle}>Cópia automática</p>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4">
                  <CheckRow
                    checked={!!backup?.enabled}
                    onChange={toggleAutoBackup}
                    disabled={!isElectron}
                    icon={<CloudUpload size={15} />}
                    label="Fazer uma cópia por dia"
                    hint={backup?.lastAt
                      ? `Última cópia em ${format(parseISO(backup.lastAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · ${backup.count} guardada(s)`
                      : 'Nenhuma cópia feita ainda.'}
                  />
                  <div className="py-3 border-t border-white/5 space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="flex-1 min-w-0 text-[11px] text-zinc-300 bg-black/40 border border-white/10 rounded-lg px-3 py-2 truncate" title={backup?.dir}>
                        {backup?.dir ?? '—'}
                      </code>
                      <button
                        onClick={escolherPastaBackup}
                        disabled={!isElectron}
                        title="Escolher pasta"
                        className="shrink-0 p-2 rounded-lg text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-40"
                      >
                        <FolderOpen size={15} />
                      </button>
                    </div>

                    {/* Atalhos para as pastas de nuvem que existem nesta máquina:
                        o próprio OneDrive/Drive leva o arquivo para fora do PC. */}
                    {(backup?.clouds.length ?? 0) > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] text-zinc-500">Usar:</span>
                        {backup!.clouds.map(c => (
                          <button
                            key={c.id}
                            onClick={() => definirPastaBackup(c.dir)}
                            title={c.dir}
                            className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md border transition-colors ${
                              backup?.dir === c.dir
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'text-zinc-300 bg-white/5 hover:bg-white/10 border-white/10'
                            }`}
                          >
                            <CloudUpload size={12} /> {c.label}
                          </button>
                        ))}
                        <button
                          onClick={() => definirPastaBackup('')}
                          title="Voltar para a pasta padrão do app"
                          className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md border text-zinc-400 bg-white/5 hover:bg-white/10 border-white/10 transition-colors"
                        >
                          <HardDrive size={12} /> Local
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-zinc-500 flex-1">Cópias guardadas</label>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={backup?.keep ?? 7}
                        onChange={(e) => salvarBackup({ keep: Number(e.target.value) })}
                        disabled={!isElectron}
                        className="w-16 bg-[#18181b] border border-white/10 rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-indigo-500 disabled:opacity-40"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <button
                        onClick={backupAgora}
                        disabled={!isElectron || salvandoBackup}
                        className="flex items-center justify-center gap-1.5 text-xs font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-2 transition-colors disabled:opacity-40"
                      >
                        <CloudUpload size={14} /> {salvandoBackup ? 'Salvando…' : 'Copiar agora'}
                      </button>
                      <button
                        onClick={() => window.tudu?.backup.openDir()}
                        disabled={!isElectron}
                        className="flex items-center justify-center gap-1.5 text-xs font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-2 transition-colors disabled:opacity-40"
                      >
                        <FolderOpen size={14} /> Abrir
                      </button>
                      <button
                        onClick={abrirRestauracao}
                        disabled={!isElectron}
                        className="flex items-center justify-center gap-1.5 text-xs font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-2 transition-colors disabled:opacity-40"
                      >
                        <RefreshCw size={14} /> Restaurar
                      </button>
                    </div>

                    {/* Lista das cópias da pasta, para restaurar sem procurar arquivo. */}
                    {restaurar && (
                      <div className="rounded-lg border border-white/10 bg-black/30 divide-y divide-white/5 max-h-40 overflow-y-auto custom-scrollbar">
                        {restaurar.length === 0 ? (
                          <p className="text-[11px] text-zinc-500 px-3 py-2">Nenhuma cópia nesta pasta ainda.</p>
                        ) : restaurar.map(item => (
                          <button
                            key={item.name}
                            onClick={() => restaurarCopia(item.name)}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                          >
                            <span className="text-[11px] text-zinc-300 truncate">
                              {format(parseISO(item.at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                            <span className="text-[10px] text-zinc-500 shrink-0">{Math.round(item.size / 1024)} KB</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {backupMsg && <p className="text-[11px] text-emerald-400">{backupMsg}</p>}
                  </div>
                </div>
              </div>

              <div>
                <p className={sectionTitle}>Pasta de dados</p>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                  <p className="text-[11px] text-zinc-500">Pasta onde o TuDu guarda o banco de dados (tarefas e configurações). Copie esta pasta para fazer backup.</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 min-w-0 text-[11px] text-zinc-300 bg-black/40 border border-white/10 rounded-lg px-3 py-2 truncate" title={settings?.userDataPath}>
                      {settings?.userDataPath ?? '—'}
                    </code>
                    <button
                      onClick={copyPath}
                      disabled={!isElectron}
                      title="Copiar caminho"
                      className="shrink-0 p-2 rounded-lg text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-40"
                    >
                      {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                    </button>
                  </div>
                  <button
                    onClick={() => settingsService.openDataFolder()}
                    disabled={!isElectron}
                    className="w-full flex items-center justify-center gap-2 text-sm font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-2 transition-colors disabled:opacity-40"
                  >
                    <FolderOpen size={15} /> Abrir pasta de dados
                  </button>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => backupService.exportData()}
                      className="flex items-center justify-center gap-2 text-sm font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-2 transition-colors"
                    >
                      <Download size={15} /> Exportar
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center justify-center gap-2 text-sm font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-2 transition-colors"
                    >
                      <Upload size={15} /> Importar
                    </button>
                    <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImportFile} className="hidden" />
                  </div>
                  {importMsg && <p className="text-[11px] text-emerald-400/90">{importMsg}</p>}
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------ Agentes de IA */}
          {section === 'ia' && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
              <p className="text-[11px] text-zinc-500">
                Abre uma porta local (só 127.0.0.1, protegida por token) para que assistentes como o
                Claude e o Gemini CLI criem projetos e tarefas aqui. Fica desligada por padrão.
              </p>

              <CheckRow
                checked={!!bridge?.enabled}
                onChange={toggleBridge}
                disabled={!isElectron}
                icon={<Plug size={15} />}
                label="Aceitar conexões de agentes"
                hint={
                  bridge?.error
                    ? `Erro: ${bridge.error}`
                    : bridge?.running
                      ? `Ativa em 127.0.0.1:${bridge.port}`
                      : 'Desligada'
                }
              />

              {bridge?.running && (
                <>
                  <div>
                    <p className="text-[11px] text-zinc-500 mb-1">Token de acesso</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 min-w-0 text-[11px] text-zinc-300 bg-black/40 border border-white/10 rounded-lg px-3 py-2 truncate">
                        {showToken ? bridge.token : '•'.repeat(48)}
                      </code>
                      <button onClick={() => setShowToken(v => !v)} title={showToken ? 'Ocultar' : 'Mostrar'}
                        className="p-2 rounded-lg text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
                        {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                      <button onClick={copyToken} title="Copiar token"
                        className="p-2 rounded-lg text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
                        {tokenCopied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-600 mt-1.5">
                      Trate como senha. O servidor MCP lê isso sozinho de <code>bridge.json</code> na pasta de dados.
                    </p>
                  </div>

                  <CheckRow
                    checked={!!bridge?.autoApply}
                    onChange={toggleAutoApply}
                    icon={<Zap size={15} />}
                    label="Aplicar sem confirmar"
                    hint="Sem isso, cada proposta abre uma revisão antes de gravar. Recomendo manter desligado."
                  />
                </>
              )}
            </div>
          )}

          {/* --------------------------------------------- Sobre & Suporte */}
          {section === 'sobre' && (
            <div className="space-y-5">
              <div>
                <p className={sectionTitle}>Aplicativo</p>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Aplicativo</span>
                    <span className="text-white font-medium">TuDu</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Versão</span>
                    <span className="text-white font-mono">{version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Criador</span>
                    <span className="text-white">{AUTHOR_NAME}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Repositório</span>
                    <button
                      onClick={() => settingsService.openExternal(GITHUB_URL)}
                      className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      <Github size={14} /> callipog/Tudu
                    </button>
                  </div>
                  <div className="pt-2 mt-1 border-t border-white/5">
                    {updateReady ? (
                      <button
                        onClick={() => settingsService.installUpdate()}
                        className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg py-2 transition-colors"
                      >
                        <RefreshCw size={14} /> Reiniciar e instalar {updateReady}
                      </button>
                    ) : (
                      <button
                        onClick={handleCheckUpdates}
                        className="w-full flex items-center justify-center gap-2 text-sm font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-2 transition-colors"
                      >
                        <RefreshCw size={14} /> Verificar atualizações
                      </button>
                    )}
                    {updateMsg && <p className="text-[11px] text-zinc-400 mt-2 text-center">{updateMsg}</p>}
                  </div>
                </div>
              </div>

              <div>
                <p className={sectionTitle}>Suporte</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => settingsService.reportBug(version)}
                    className="flex items-center justify-center gap-2 text-sm font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-2.5 transition-colors"
                  >
                    <Bug size={15} /> Reportar bug
                  </button>
                  <button
                    onClick={() => notificationService.test()}
                    className="flex items-center justify-center gap-2 text-sm font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-2.5 transition-colors"
                  >
                    <Bell size={15} /> Testar notificação
                  </button>
                </div>
                <p className="text-[11px] text-zinc-600 mt-2">O reporte abre seu e-mail para enviar a {REPORT_EMAIL}.</p>
              </div>
            </div>
          )}

          {/* ------------------------------------------------ Zona de perigo */}
          {section === 'perigo' && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-4 space-y-2">
              <p className="text-[11px] text-zinc-500">Ações irreversíveis. Exporte um backup antes, se precisar.</p>
              <button
                onClick={handleResetTasks}
                className="w-full flex items-center justify-center gap-2 text-sm font-medium text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/80 border border-rose-500/30 rounded-lg py-2 transition-colors"
              >
                <ListChecks size={15} /> Apagar todas as tarefas
              </button>
              <button
                onClick={handleResetTags}
                className="w-full flex items-center justify-center gap-2 text-sm font-medium text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/80 border border-rose-500/30 rounded-lg py-2 transition-colors"
              >
                <TagIcon size={15} /> Apagar todas as tags
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
