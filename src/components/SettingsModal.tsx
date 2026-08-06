import React, { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { settingsService, AppSettings, GITHUB_URL, AUTHOR_NAME, REPORT_EMAIL } from '../services/settings';
import { notificationService } from '../services/notifications';
import { backupService } from '../services/backup';
import { taskService } from '../services/tasks';
import { tagService } from '../services/tags';
import { themeService, Theme } from '../services/theme';
import { Check, FolderOpen, Bug, Bell, Github, Power, EyeOff, Eye, Copy, Download, Upload, RefreshCw, MinusSquare, ListChecks, Tag as TagIcon, Moon, Sun, Monitor, Coffee, Plug, Zap } from 'lucide-react';

type BridgeStatus = Awaited<ReturnType<NonNullable<Window['tudu']>['bridge']['status']>>;

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataImported: () => void;
}

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
  const [copied, setCopied] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const [updateReady, setUpdateReady] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(themeService.get());
  const [bridge, setBridge] = useState<BridgeStatus | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
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
      setCopied(false);
      setShowToken(false);
      setTheme(themeService.get());
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

  const sectionTitle = 'text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-2';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configurações">
      <div className="space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1">
        {!isElectron && (
          <p className="text-[11px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            Algumas opções só funcionam no app desktop (fora do navegador).
          </p>
        )}

        {/* Aparência */}
        <div>
          <p className={sectionTitle}>Aparência</p>
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

        {/* Inicialização */}
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

        {/* Dados / Backup */}
        <div>
          <p className={sectionTitle}>Dados & Backup</p>
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

        {/* Suporte */}
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

        {/* Ponte para agentes de IA */}
        <div>
          <p className={sectionTitle}>Agentes de IA (MCP)</p>
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
        </div>

        {/* Sobre */}
        <div>
          <p className={sectionTitle}>Sobre</p>
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

        {/* Zona de perigo */}
        <div>
          <p className="text-[10px] uppercase font-bold text-rose-500/80 tracking-wider mb-2">Zona de perigo</p>
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
        </div>
      </div>
    </Modal>
  );
}
