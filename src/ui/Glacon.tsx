// Série protégée (issue #76) : la pierre givrée, dans la grammaire aux deux pierres (docs/design/v2).
// Une pierre claire, bleutée, avec un éclat de givre ; à côté, le nombre de gels en réserve.
import { t } from '../content/i18n';
import './gel.css';

/** Nom accessible de la pastille : même texte que libelleGels (src/app/gel.ts), dans la langue de l'interface (#167). */
const libelleGels = (n: number) => (n === 0 ? t('gel.aucun') : t('gel.reserve', { n }));

export function PierreGivree({ taille = 16 }: { taille?: number }) {
  return (
    <svg className="pierre-givree" viewBox="0 0 16 16" width={taille} height={taille} aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6.6" fill="var(--givre)" stroke="var(--givre-bord)" strokeWidth="1" />
      <path d="M8 4.2v7.6M4.7 6.1l6.6 3.8M4.7 9.9l6.6-3.8" stroke="var(--givre-trait)" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

/** Pastille « pierre givrée + nombre », posée à côté de la flamme. Rien quand la réserve est vide. */
export function Glacon({ gels, fete = false }: { gels: number; fete?: boolean }) {
  if (gels <= 0) return null;
  return (
    <span className={`glacon${fete ? ' glacon-fete' : ''}`} role="img" aria-label={libelleGels(gels)} data-testid="glacon">
      <PierreGivree />{gels}
    </span>
  );
}
