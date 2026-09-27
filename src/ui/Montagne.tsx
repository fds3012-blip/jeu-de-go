// En-tête illustré d'un palier de problèmes (issue #103) : l'ascension d'une montagne en cinq étapes,
// du village au sommet. Chaque palier cadre sa propre étape (repère dessiné, pente de plus en plus raide),
// et un petit drapeau hanko marque où tu en es.

/** Étapes, de gauche à droite : x, y dans un cadre de 320 × 72. */
const ETAPES = [[26, 60], [92, 50], [160, 39], [226, 26], [290, 12]] as const;

/** Repère propre à chaque étape : village, rizières, pins, rochers, sommet enneigé. */
function Repere({ i }: { i: number }) {
  const [x, y] = ETAPES[i];
  switch (i) {
    case 0: return <g className="m-repere">
      <path d={`M${x - 16} ${y + 2}h9v-6l-4.5-4-4.5 4Z`} /><path d={`M${x + 6} ${y + 2}h10v-7l-5-4.5-5 4.5Z`} />
    </g>;
    case 1: return <g className="m-repere fin"><path d={`M${x - 20} ${y + 6}q10-4 20 0t20 0M${x - 16} ${y + 10}q10-4 20 0t20 0`} /></g>;
    case 2: return <g className="m-repere">
      <path d={`M${x - 14} ${y + 4}l5-11 5 11Z`} /><path d={`M${x + 10} ${y + 5}l4-9 4 9Z`} />
    </g>;
    case 3: return <g className="m-repere"><path d={`M${x - 16} ${y + 4}l4-6 5 2 3 4Z`} /><path d={`M${x + 8} ${y + 5}l3-5 6 1 2 4Z`} /></g>;
    default: return <path className="m-neige" d={`M${x - 12} ${y + 8}l12-14 12 14-4-2-4 3-4-3-4 3-4-3Z`} />;
  }
}

export function Montagne({ rang, ici, complet }: { rang: number; ici: number; complet: boolean }) {
  const i = rang - 1;
  const chemin = ETAPES.map(([x, y], k) => `${k ? 'L' : 'M'}${x} ${y}`).join(' ');
  const fait = ETAPES.slice(0, Math.min(ici, 4) + 1).map(([x, y], k) => `${k ? 'L' : 'M'}${x} ${y}`).join(' ');
  const [fx, fy] = ETAPES[Math.max(0, Math.min(ici, 4))];
  return (
    <svg className={`montagne etape-${rang}${complet ? ' complet' : ''}`} viewBox="0 0 320 72" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {/* Arrière-plan : une chaîne lointaine, puis la montagne du parcours. */}
      <path className="m-loin" d="M0 72V46l38-16 30 12 44-26 34 14 40-22 36 18 46-22 52 20v48Z" />
      <path className="m-mont" d="M0 72V64l40-6 50-10 40-6 34-9 36-8 30-12 30-10 20-8 20-6 20 4v83Z" />
      <path className="m-chemin" d={chemin} />
      <path className="m-fait" d={fait} />
      <Repere i={i} />
      {ETAPES.map(([x, y], k) => (
        <circle key={k} cx={x} cy={y} r={k === i ? 5 : 3} className={`m-etape${k <= ici ? ' passee' : ''}${k === i ? ' la' : ''}`} />
      ))}
      <g className="m-drapeau" transform={`translate(${fx} ${fy})`}>
        <path d="M0 0V-17" className="m-mat" />
        <path d="M0-17h10l-3 3.5 3 3.5H0Z" className="m-flamme" />
      </g>
    </svg>
  );
}
