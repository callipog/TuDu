// Logo do TuDu (kit de marca): um ponto e um traço, a tarefa pendente e a feita.
// O traço e o nome usam currentColor, então herdam a cor do tema (claro, escuro, sépia).
// O ponto é sempre violeta, exceto na versão mono.
import React from 'react';

const VIOLET = '#7C5CFF';

type MarkProps = { size?: number; mono?: boolean; title?: string } & React.SVGProps<SVGSVGElement>;

/** Símbolo. `size` é a altura; a largura segue a proporção 67 × 50. */
export function TuduMark({ size = 32, mono = false, title = 'TuDu', ...rest }: MarkProps) {
  return (
    <svg viewBox="17 25 67 50" width={(size * 67) / 50} height={size} role="img" aria-label={title} {...rest}>
      <path d="M42 67L76 33" fill="none" stroke="currentColor" strokeWidth={16} strokeLinecap="round" />
      <circle cx={25} cy={50} r={8} fill={mono ? 'currentColor' : VIOLET} />
    </svg>
  );
}

const WORDMARK_PATH =
  'M234 0V-625H376V0ZM23 -605V-730H587V-605Z M829 17Q734.5 17 683.2 -44.8Q632 -106.5 632 -228.5V-543.5H771V-216.5Q771 -166.5 799 -137.2Q827 -108 874.5 -108Q923 -108 953.5 -138.8Q984 -169.5 984 -222.5V-543.5H1123V0H1013V-230.5H1024Q1024 -148.5 1002.8 -93.5Q981.5 -38.5 939.8 -10.8Q898 17 835 17Z M1371 4V-128H1522Q1578.5 -128 1623 -145.5Q1667.5 -163 1698.8 -194.8Q1730 -226.5 1746.5 -270.2Q1763 -314 1763 -366.5Q1763 -421.5 1746.5 -465Q1730 -508.5 1698.8 -539.5Q1667.5 -570.5 1623 -586.8Q1578.5 -603 1522 -603H1371V-735H1513Q1612 -735 1685.8 -705.8Q1759.5 -676.5 1808.8 -626Q1858 -575.5 1882.5 -511.2Q1907 -447 1907 -377.5V-355.5Q1907 -290 1882.5 -225.8Q1858 -161.5 1808.8 -109.8Q1759.5 -58 1685.8 -27Q1612 4 1513 4ZM1249 4V-735H1391V4Z M2163 17Q2068.5 17 2017.2 -44.8Q1966 -106.5 1966 -228.5V-543.5H2105V-216.5Q2105 -166.5 2133 -137.2Q2161 -108 2208.5 -108Q2257 -108 2287.5 -138.8Q2318 -169.5 2318 -222.5V-543.5H2457V0H2347V-230.5H2358Q2358 -148.5 2336.8 -93.5Q2315.5 -38.5 2273.8 -10.8Q2232 17 2169 17Z';

/** Símbolo + nome "TuDu" (Sora já convertida em contorno). `height` é a altura total. */
export function TuduLockup({ height = 24, title = 'TuDu', ...rest }: { height?: number; title?: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 -735 3718.8 752" width={(height * 3718.8) / 752} height={height} role="img" aria-label={title} {...rest}>
      <g transform="translate(-248.2 -1095.0) scale(14.6)">
        <path d="M42 67L76 33" fill="none" stroke="currentColor" strokeWidth={16} strokeLinecap="round" />
        <circle cx={25} cy={50} r={8} fill={VIOLET} />
      </g>
      <path transform="translate(1261.8 0)" fill="currentColor" d={WORDMARK_PATH} />
    </svg>
  );
}
