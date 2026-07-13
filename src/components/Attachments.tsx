import React, { useRef, useState } from 'react';
import { Attachment } from '../types';
import { Link2, Code2, Image as ImageIcon, FileText, Paperclip, Plus, X, ExternalLink, Download } from 'lucide-react';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB
const MAX_FILE_BYTES = 8 * 1024 * 1024;  // 8MB

/** Linguagens oferecidas no seletor ao anexar um trecho de código. */
const CODE_LANGUAGES = [
  'Texto', 'SQL', 'JavaScript', 'TypeScript', 'HTML', 'CSS', 'Python',
  'JSON', 'Bash', 'Java', 'C#', 'C/C++', 'PHP', 'Go', 'Rust', 'YAML', 'XML', 'Markdown',
];

/** Abre link externo de forma confiável: no Electron via shell, no web via aba. */
const openLink = (url: string) => (e: React.MouseEvent) => {
  const bridge = (window as any).tudu;
  if (bridge?.settings?.openExternal) {
    e.preventDefault();
    bridge.settings.openExternal(url);
  }
  // No web, deixa o comportamento padrão do <a target="_blank">.
};

function AttachmentRow({ a, onRemove }: { key?: React.Key; a: Attachment; onRemove?: () => void }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        {a.type === 'link' && <Link2 size={14} className="text-indigo-400 shrink-0" />}
        {a.type === 'code' && <Code2 size={14} className="text-amber-400 shrink-0" />}
        {a.type === 'code' && a.language && a.language !== 'Texto' && (
          <span className="shrink-0 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">{a.language}</span>
        )}
        {a.type === 'image' && <ImageIcon size={14} className="text-emerald-400 shrink-0" />}
        {a.type === 'file' && <FileText size={14} className="text-sky-400 shrink-0" />}
        <span className="flex-1 min-w-0 text-xs text-zinc-300 truncate">
          {a.type === 'link'
            ? <a href={a.content} target="_blank" rel="noopener noreferrer" onClick={openLink(a.content)} className="flex items-center gap-1 hover:text-indigo-300 transition-colors truncate">{a.title || a.content} <ExternalLink size={11} className="shrink-0" /></a>
            : a.type === 'file'
            ? <a href={a.content} download={a.title || 'arquivo'} className="flex items-center gap-1 hover:text-sky-300 transition-colors truncate">{a.title || 'Arquivo'} <Download size={11} className="shrink-0" /></a>
            : (a.title || (a.type === 'code' ? 'Trecho de código' : 'Imagem'))}
        </span>
        {onRemove && (
          <button type="button" onClick={onRemove} className="shrink-0 p-0.5 text-zinc-500 hover:text-rose-400 transition-colors"><X size={13} /></button>
        )}
      </div>
      {a.type === 'code' && (
        <pre className="custom-scrollbar text-[11px] text-zinc-300 bg-black/40 px-3 py-2 overflow-auto max-h-40 border-t border-white/5"><code>{a.content}</code></pre>
      )}
      {a.type === 'image' && (
        <img src={a.content} alt={a.title || 'anexo'} className="max-h-48 w-full object-contain bg-black/40 border-t border-white/5" />
      )}
    </div>
  );
}

export function AttachmentsView({ attachments }: { attachments: Attachment[] }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="space-y-2">
      {attachments.map(a => <AttachmentRow key={a.id} a={a} />)}
    </div>
  );
}

export function AttachmentsEditor({ value, onChange }: { value: Attachment[]; onChange: (a: Attachment[]) => void }) {
  const [code, setCode] = useState('');
  const [codeLang, setCodeLang] = useState<string>('Texto');
  const [showCode, setShowCode] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const imgRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const add = (a: Attachment) => onChange([...value, a]);
  const remove = (id: string) => onChange(value.filter(x => x.id !== id));

  const addLink = () => {
    const raw = linkUrl.trim();
    if (!raw) return;
    let url = raw;
    if (!/^(https?:|mailto:)/i.test(url)) url = 'https://' + url;
    add({ id: crypto.randomUUID(), type: 'link', content: url, title: linkTitle.trim() || url });
    setLinkUrl('');
    setLinkTitle('');
    setShowLink(false);
  };

  const onImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > MAX_IMAGE_BYTES) { window.alert('Imagem muito grande (máximo 3MB).'); return; }
    const r = new FileReader();
    r.onload = () => add({ id: crypto.randomUUID(), type: 'image', content: String(r.result), title: f.name });
    r.readAsDataURL(f);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) { window.alert('Arquivo muito grande (máximo 8MB).'); return; }
    const r = new FileReader();
    r.onload = () => add({ id: crypto.randomUUID(), type: 'file', content: String(r.result), title: f.name, mime: f.type });
    r.readAsDataURL(f);
  };

  const addCode = () => {
    if (code.trim()) {
      add({ id: crypto.randomUUID(), type: 'code', content: code, language: codeLang !== 'Texto' ? codeLang : undefined });
      setCode('');
      setCodeLang('Texto');
      setShowCode(false);
    }
  };

  const btn = 'flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-2.5 py-1.5 transition-colors';

  return (
    <div>
      {value.length > 0 && (
        <div className="space-y-2 mb-2">
          {value.map(a => <AttachmentRow key={a.id} a={a} onRemove={() => remove(a.id)} />)}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setShowLink(s => !s)} className={btn}><Link2 size={13} /> Link</button>
        <button type="button" onClick={() => setShowCode(s => !s)} className={btn}><Code2 size={13} /> Código</button>
        <button type="button" onClick={() => imgRef.current?.click()} className={btn}><ImageIcon size={13} /> Imagem</button>
        <button type="button" onClick={() => fileRef.current?.click()} className={btn}><Paperclip size={13} /> Arquivo</button>
        <input ref={imgRef} type="file" accept="image/*" onChange={onImage} className="hidden" />
        <input ref={fileRef} type="file" onChange={onFile} className="hidden" />
      </div>
      {showLink && (
        <div className="mt-2 space-y-2">
          <input
            autoFocus
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
            placeholder="URL (ex.: exemplo.com)"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <input
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
            placeholder="Título (opcional)"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button type="button" onClick={addLink} disabled={!linkUrl.trim()} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg px-3 py-1.5 transition-colors">
            <Plus size={13} /> Adicionar link
          </button>
        </div>
      )}
      {showCode && (
        <div className="mt-2">
          <div className="flex items-center gap-2 mb-1.5">
            <label className="text-[11px] font-medium text-zinc-400">Linguagem</label>
            <select
              value={codeLang}
              onChange={(e) => setCodeLang(e.target.value)}
              className="bg-[#18181b] border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
            >
              {CODE_LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Cole o trecho de código..."
            className="w-full h-28 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none"
          />
          <button type="button" onClick={addCode} disabled={!code.trim()} className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg px-3 py-1.5 transition-colors">
            <Plus size={13} /> Adicionar código
          </button>
        </div>
      )}
    </div>
  );
}
