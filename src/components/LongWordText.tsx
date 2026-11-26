import React from 'react';

/** A partir daqui uma "palavra" sem espaço já não cabe numa linha de subtarefa. */
const LONG = 24;

/**
 * Texto que quebra linha normalmente, mas corta com "…" qualquer palavra
 * gigante (um link, um hash, uma sequência sem espaço) no limite da margem.
 * Sem isto a palavra empurra a linha para a direita e esconde os controles.
 *
 * O pai precisa ser `min-w-0` (em flex) para o limite valer. A palavra inteira
 * fica no `title`, à mão ao passar o mouse.
 */
export function LongWordText({ text, className = '' }: { text: string; className?: string }) {
  const parts = text.split(/(\s+)/);
  return (
    <span className={`min-w-0 break-words ${className}`}>
      {parts.map((p, i) =>
        p.length > LONG && !/\s/.test(p)
          ? <span key={i} title={p} className="inline-block max-w-full truncate align-bottom">{p}</span>
          : <React.Fragment key={i}>{p}</React.Fragment>
      )}
    </span>
  );
}
