import React from 'react';

export type SortAxis = 'y' | 'x';
export type DropSide = 'before' | 'after' | null;

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Reordenação por drag-and-drop nativo em listas simples (épicos, etapas do board).
 *
 * O arrasto começa só pelo "punho" (ícone GripVertical), assim inputs dentro da
 * linha continuam editáveis/selecionáveis normalmente.
 *
 * Feedback visual em três tempos:
 *  1. enquanto arrasta  — item some pela metade + linha índigo mostrando onde cai;
 *  2. ao soltar         — os itens DESLIZAM para a nova posição (técnica FLIP);
 *  3. logo depois       — um pulso no item movido confirma que a ação foi gravada.
 *
 * Para o FLIP funcionar, prenda `containerRef` no elemento que envolve a lista.
 */
export function useSortableList(ids: string[], onReorder: (next: string[]) => void, axis: SortAxis = 'y') {
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);
  const [after, setAfter] = React.useState(false);
  const [settledId, setSettledId] = React.useState<string | null>(null);

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const settleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

  /* ---- FLIP: anima a mudança de posição depois que a lista já re-renderizou ----
     Roda em todo commit para manter as medidas frescas, mas só anima quando a
     ORDEM mudou (evita "pulos" após um resize da janela, por exemplo). */
  const orderKey = ids.join('|');
  const prevRects = React.useRef(new Map<string, DOMRect>());
  const prevOrder = React.useRef(orderKey);

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const moved = prevOrder.current !== orderKey && !reducedMotion();
    const rects = new Map<string, DOMRect>();

    for (const item of el.querySelectorAll<HTMLElement>('[data-sortable-id]')) {
      const id = item.dataset.sortableId;
      if (!id) continue;
      const rect = item.getBoundingClientRect();
      rects.set(id, rect);
      if (!moved) continue;
      const old = prevRects.current.get(id);
      if (!old) continue;
      const dx = old.left - rect.left;
      const dy = old.top - rect.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      item.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
        { duration: 260, easing: 'cubic-bezier(0.2, 0.9, 0.25, 1)' }
      );
    }

    prevRects.current = rects;
    prevOrder.current = orderKey;
  });

  const reset = () => { setDragId(null); setOverId(null); setAfter(false); };

  const commit = (targetId: string) => {
    if (!dragId || dragId === targetId) { reset(); return; }
    const next = ids.filter(id => id !== dragId);
    let at = next.indexOf(targetId);
    if (at < 0) { reset(); return; }
    if (after) at += 1;
    next.splice(at, 0, dragId);

    // Pulso de confirmação no item que acabou de ser movido.
    setSettledId(dragId);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setSettledId(null), 600);

    reset();
    onReorder(next);
  };

  return {
    /** Prenda no elemento que envolve a lista (necessário para o FLIP). */
    containerRef,

    /** Item sendo arrastado no momento (null quando parado). */
    dragId,

    /** Props do punho — o único elemento com `draggable`. */
    handleProps: (id: string) => ({
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
        // Arrasta a "sombra" da linha inteira, não só o ícone.
        const row = (e.currentTarget as HTMLElement).closest('[data-sortable-id]') as HTMLElement | null;
        if (row) e.dataTransfer.setDragImage(row, 16, row.offsetHeight / 2);
        setDragId(id);
      },
      onDragEnd: reset,
    }),

    /** Props da linha/coluna que recebe o item arrastado. */
    itemProps: (id: string) => ({
      'data-sortable-id': id,
      onDragOver: (e: React.DragEvent) => {
        if (!dragId) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        const r = e.currentTarget.getBoundingClientRect();
        const isAfter = axis === 'y' ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2;
        setOverId(id);
        setAfter(isAfter);
      },
      onDrop: (e: React.DragEvent) => {
        if (!dragId) return;
        e.preventDefault();
        e.stopPropagation();
        commit(id);
      },
    }),

    /** Classes de estado do item: fantasma ao arrastar, linha de soltura e pulso final. */
    itemClass: (id: string) => {
      const side: DropSide = dragId && overId === id && dragId !== id ? (after ? 'after' : 'before') : null;
      return [
        dragId === id ? 'sortable-dragging' : '',
        side ? dropIndicatorClass(side, axis) : '',
        settledId === id ? 'sortable-settle' : '',
      ].filter(Boolean).join(' ');
    },
  };
}

/* Classes literais (o scanner do Tailwind não detecta strings montadas em runtime). */
const DROP_Y = { before: 'drop-line-top', after: 'drop-line-bottom' };
const DROP_X = { before: 'drop-line-left', after: 'drop-line-right' };

/** Classe da linha indicadora de posição de soltura. */
export function dropIndicatorClass(side: DropSide, axis: SortAxis = 'y'): string {
  if (!side) return '';
  return axis === 'y' ? DROP_Y[side] : DROP_X[side];
}
