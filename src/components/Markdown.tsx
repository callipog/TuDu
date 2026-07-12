import React from 'react';

// Renderizador de Markdown minimalista e SEGURO: constrói elementos React
// (nunca usa dangerouslySetInnerHTML), cobrindo o subconjunto comum de README.

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Ordem: código inline, negrito, itálico, link.
  const regex = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${i++}`;
    if (tok.startsWith('`')) {
      nodes.push(<code key={key} className="px-1 py-0.5 rounded bg-white/10 text-[0.85em] font-mono text-amber-300">{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith('**')) {
      nodes.push(<strong key={key} className="font-semibold text-white">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('*')) {
      nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    } else {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok)!;
      nodes.push(<a key={key} href={mm[2]} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">{mm[1]}</a>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Bloco de código
    if (line.trim().startsWith('```')) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) { buf.push(lines[i]); i++; }
      i++; // fecha ```
      blocks.push(<pre key={key++} className="bg-black/40 border border-white/10 rounded-lg p-3 overflow-x-auto my-3"><code className="text-xs font-mono text-zinc-200">{buf.join('\n')}</code></pre>);
      continue;
    }
    // Heading
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const cls = level === 1 ? 'text-xl font-bold text-white mt-4 mb-2 pb-1 border-b border-white/10'
        : level === 2 ? 'text-lg font-bold text-white mt-4 mb-2'
        : 'text-base font-semibold text-white mt-3 mb-1';
      const Tag = (`h${level}`) as 'h1' | 'h2' | 'h3';
      blocks.push(<Tag key={key++} className={cls}>{renderInline(h[2], `h${key}`)}</Tag>);
      i++;
      continue;
    }
    // Regra horizontal
    if (/^---+$/.test(line.trim())) { blocks.push(<hr key={key++} className="my-4 border-white/10" />); i++; continue; }
    // Lista (- ou * ou 1.)
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items: string[] = [];
      const ordered = /^\s*\d+\.\s+/.test(line);
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''));
        i++;
      }
      const inner = items.map((it, idx) => <li key={idx} className="ml-1">{renderInline(it, `li${key}-${idx}`)}</li>);
      blocks.push(ordered
        ? <ol key={key++} className="list-decimal list-inside space-y-1 my-2 text-sm text-zinc-300">{inner}</ol>
        : <ul key={key++} className="list-disc list-inside space-y-1 my-2 text-sm text-zinc-300">{inner}</ul>);
      continue;
    }
    // Citação
    if (line.trim().startsWith('>')) {
      blocks.push(<blockquote key={key++} className="border-l-2 border-indigo-500/50 pl-3 my-2 text-sm text-zinc-400 italic">{renderInline(line.replace(/^\s*>\s?/, ''), `bq${key}`)}</blockquote>);
      i++;
      continue;
    }
    // Linha em branco
    if (line.trim() === '') { i++; continue; }
    // Parágrafo (agrupa linhas consecutivas)
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,3}\s|```|>|\s*([-*]|\d+\.)\s|---+$)/.test(lines[i])) {
      para.push(lines[i]); i++;
    }
    blocks.push(<p key={key++} className="text-sm text-zinc-300 leading-relaxed my-2">{renderInline(para.join(' '), `p${key}`)}</p>);
  }

  return <div>{blocks}</div>;
}
