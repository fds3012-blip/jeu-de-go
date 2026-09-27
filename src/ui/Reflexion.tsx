// Indicateur d'attente de l'app (issue #51) : le logo qui tourne. Une pierre noire et une pierre blanche,
// qui se touchent, tournent l'une autour de l'autre ; chaque pierre garde son reflet en haut à gauche
// (la lumière de la lampe ne tourne pas). Charte : docs/design/v2/identite.md. Styles : nav.css.
// Mouvements réduits : les pierres ne tournent plus, elles s'allument l'une après l'autre (opacité seule).
import { useId } from 'react';

interface Props {
  /** Côté en pixels. */
  taille?: number;
  /** Texte lu par les lecteurs d'écran. Sans texte, l'indicateur est décoratif (le texte voisin dit ce qui se passe). */
  libelle?: string;
  className?: string;
}

export function Reflexion({ taille = 22, libelle, className }: Props) {
  const id = `rf-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const classes = ['reflexion', className].filter(Boolean).join(' ');
  return (
    <span className={classes} style={{ width: taille, height: taille }} role={libelle ? 'status' : undefined} aria-hidden={libelle ? undefined : true}>
      <svg viewBox="0 0 24 24" width="100%" height="100%" focusable="false" aria-hidden="true">
        <defs>
          <radialGradient id={`${id}n`} cx="36%" cy="30%" r="72%">
            <stop offset="0" stopColor="#6a6e6c" /><stop offset=".22" stopColor="#2e3130" /><stop offset=".6" stopColor="#151716" /><stop offset="1" stopColor="#050606" />
          </radialGradient>
          <radialGradient id={`${id}b`} cx="38%" cy="32%" r="78%">
            <stop offset="0" stopColor="#fff" /><stop offset=".55" stopColor="#F3EEE3" /><stop offset=".85" stopColor="#DDD5C4" /><stop offset="1" stopColor="#BDB3A0" />
          </radialGradient>
        </defs>
        <g className="reflexion-orbite">
          <g className="reflexion-b"><circle className="pierre-b" cx="16.5" cy="12" r="5.2" fill={`url(#${id}b)`} /></g>
          <g className="reflexion-n"><circle className="pierre-n" cx="7.5" cy="12" r="5.6" fill={`url(#${id}n)`} /></g>
        </g>
      </svg>
      {libelle && <span className="sr-only">{libelle}</span>}
    </span>
  );
}
