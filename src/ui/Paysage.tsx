// Paysage d'un palier de problèmes (issue #103) : la montagne, du pied au sommet, en géométrie Encre & Jade.
// Débutant : les collines au pied. Novice : la pente. Apprenti : la crête dans les nuages. Joueur de club : les
// hauts pics. Confirmé : le sommet enneigé sous le soleil. Aucun chiffre, aucune barre, aucune fin annoncée :
// c'est un décor, le palier suivant reste une surprise. Couleurs par classes CSS (apprendre.css), lisibles
// en sombre comme en clair. Décoratif : le nom du palier est toujours écrit à côté.
import type { PalierId } from '../app/paliers';

const L = 360, H = 96;

/** Un pin : tronc et trois étages de branches, pointe en `x`, base en `y`, hauteur `h`. */
function Pin({ x, y, h }: { x: number; y: number; h: number }) {
  const w = h * 0.55;
  return (
    <g className="py-pin" transform={`translate(${x} ${y})`}>
      <rect x={-h * 0.05} y={-h * 0.22} width={h * 0.1} height={h * 0.24} />
      <path d={`M0 ${-h} L${w * 0.42} ${-h * 0.62} H${-w * 0.42} Z`} />
      <path d={`M0 ${-h * 0.8} L${w * 0.5} ${-h * 0.4} H${-w * 0.5} Z`} />
      <path d={`M0 ${-h * 0.58} L${w * 0.58} ${-h * 0.18} H${-w * 0.58} Z`} />
    </g>
  );
}

/** Nuage plat : trois ellipses, en papier. */
function Nuage({ x, y, l }: { x: number; y: number; l: number }) {
  return (
    <g className="py-nuage">
      <ellipse cx={x} cy={y} rx={l * 0.5} ry={6} />
      <ellipse cx={x - l * 0.22} cy={y + 2} rx={l * 0.28} ry={5} />
      <ellipse cx={x + l * 0.26} cy={y + 2} rx={l * 0.3} ry={5} />
    </g>
  );
}

function scene(id: PalierId) {
  switch (id) {
    case 'debutant': return (<>
      <circle className="py-soleil" cx="300" cy="46" r="20" />
      <path className="py-loin" d={`M0 70 C60 52 110 50 170 62 S280 78 ${L} 60 V${H} H0Z`} />
      <path className="py-pres" d={`M0 86 C50 66 120 68 180 80 S300 92 ${L} 82 V${H} H0Z`} />
      <path className="py-chemin" d="M20 96 C60 86 90 84 128 78" />
      <Pin x={224} y={84} h={30} /><Pin x={248} y={88} h={22} /><Pin x={62} y={78} h={18} />
    </>);
    case 'novice': return (<>
      <circle className="py-soleil" cx="286" cy="38" r="18" />
      <path className="py-loin" d={`M0 78 L90 44 L140 58 L230 24 L300 50 L${L} 40 V${H} H0Z`} />
      <path className="py-pres" d={`M0 ${H} L0 84 L110 60 L170 72 L260 46 L${L} 70 V${H}Z`} />
      <path className="py-chemin" d="M30 96 L70 84 L58 78 L120 64 L112 60 L164 50" />
      <Pin x={210} y={62} h={22} /><Pin x={232} y={58} h={16} /><Pin x={330} y={72} h={18} />
    </>);
    case 'apprenti': return (<>
      <circle className="py-soleil" cx="262" cy="30" r="16" />
      <path className="py-loin" d={`M0 70 L60 48 L120 60 L200 22 L250 44 L310 30 L${L} 52 V${H} H0Z`} />
      <path className="py-pres" d={`M0 ${H} L0 86 L80 62 L140 74 L212 40 L280 66 L${L} 58 V${H}Z`} />
      <Nuage x={70} y={78} l={90} /><Nuage x={300} y={82} l={110} />
      <path className="py-chemin" d="M150 96 L176 76 L166 70 L200 50" />
      <Pin x={118} y={76} h={14} />
    </>);
    case 'club': return (<>
      <circle className="py-soleil" cx="90" cy="26" r="15" />
      <path className="py-loin" d={`M0 62 L50 40 L96 54 L160 10 L214 44 L262 22 L312 46 L${L} 36 V${H} H0Z`} />
      <path className="py-pres" d={`M0 ${H} L0 80 L62 56 L124 72 L190 26 L246 64 L300 50 L${L} 68 V${H}Z`} />
      <path className="py-neige" d="M190 26 L204 38 L196 36 L190 42 L182 36 L176 38 Z" />
      <Nuage x={60} y={90} l={120} /><Nuage x={250} y={92} l={150} />
      <path className="py-chemin" d="M110 96 L146 70 L138 62 L178 42" />
    </>);
    case 'confirme': return (<>
      <circle className="py-soleil" cx="180" cy="26" r="22" />
      <path className="py-loin" d={`M0 70 L70 46 L110 58 L180 6 L250 56 L300 40 L${L} 60 V${H} H0Z`} />
      <path className="py-neige" d="M180 6 L198 24 L190 20 L184 28 L176 22 L168 26 L162 22 Z" />
      <path className="py-pres" d={`M0 ${H} L0 84 L60 68 L120 78 L180 44 L240 76 L300 62 L${L} 76 V${H}Z`} />
      <Nuage x={70} y={88} l={120} /><Nuage x={290} y={90} l={130} />
      <path className="py-chemin" d="M120 96 L150 76 L142 70 L180 44" />
    </>);
  }
}

/** Décor de palier, 360 × 96, recadré par le haut quand la carte est plus étroite. */
export function Paysage({ id, className }: { id: PalierId; className?: string }) {
  return (
    <svg className={['paysage', className].filter(Boolean).join(' ')} viewBox={`0 0 ${L} ${H}`} preserveAspectRatio="xMidYMax slice"
      aria-hidden="true" focusable="false" data-paysage={id}>
      {scene(id)}
    </svg>
  );
}
