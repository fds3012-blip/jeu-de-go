// Icônes des lignes du Profil et des Réglages (issue #103) : une famille, grille 24, trait 1,8 à bouts ronds.
// Décoratives : chaque ligne porte son libellé en texte.
import type { ReactNode } from 'react';

export type IconeReglageId =
  | 'parties' | 'placement' | 'reglages' | 'importer' | 'rappel' | 'installer' | 'compte' | 'conditions'
  | 'langue' | 'theme' | 'goban' | 'confirmer' | 'sons' | 'celebrations' | 'aide';

const TRACES: Record<IconeReglageId, ReactNode> = {
  // Flèche qui revient en arrière autour d'une pierre : tes parties passées (#358).
  parties: <><path d="M4.6 12.5a7.5 7.5 0 1 0 2.1-6.2" /><path d="M4.5 3.8v3.4h3.4" /><circle cx="12.2" cy="12.2" r="3" className="ir-plein" /></>,
  // Boussole : le placement trouve ton niveau de départ.
  placement: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5Z" className="ir-plein" /></>,
  reglages: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2.2" /><circle cx="10" cy="17" r="2.2" /></>,
  // Loupe sur un coin de goban : analyser une partie.
  importer: <><path d="M4 4v10M4 4h10M4 9h8M9 4v8" /><circle cx="15" cy="15" r="4.2" /><path d="m18.2 18.2 2.8 2.8" /></>,
  rappel: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  installer: <><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M12 7v7M9.5 11.5 12 14l2.5-2.5M10 18h4" /></>,
  compte: <><circle cx="12" cy="8.5" r="4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></>,
  conditions: <><path d="M12 3 5 6v5c0 4.5 3 8 7 9.5 4-1.5 7-5 7-9.5V6Z" /><path d="m9 12 2.2 2.2L15 10" /></>,
  langue: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
  // Sombre et clair : un disque à moitié plein.
  theme: <><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5v17A8.5 8.5 0 0 0 12 3.5Z" className="ir-plein" /></>,
  goban: <><rect x="3.5" y="3.5" width="17" height="17" rx="2" /><path d="M9 3.5v17M15 3.5v17M3.5 9h17M3.5 15h17" /><circle cx="15" cy="9" r="2.4" className="ir-plein" /></>,
  // Le doigt qui pose, et le point d'appui.
  confirmer: <><path d="M9 11V5.5a2 2 0 0 1 4 0V11M13 10.5a2 2 0 0 1 4 0V12M17 12a2 2 0 0 1 4 0v3.5a6 6 0 0 1-6 6h-2.5a6 6 0 0 1-5-2.7L5 14.6a1.9 1.9 0 0 1 3.1-2.2L9 13.5" /></>,
  sons: <><path d="M4 9.5v5h3.5L13 19V5L7.5 9.5Z" /><path d="M16.5 9a4.5 4.5 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11" /></>,
  celebrations: <><path d="M12 3.5 14.4 9l5.6.6-4.2 3.9 1.2 5.7L12 16.3 7 19.2l1.2-5.7L4 9.6 9.6 9Z" /></>,
  // Mochi : la bulle du coach.
  aide: <><path d="M5 5.5h14v10H11l-4.5 3.5V15.5H5Z" /><circle cx="9.5" cy="10.5" r="1" className="ir-plein" /><circle cx="14.5" cy="10.5" r="1" className="ir-plein" /></>,
};

export function IconeReglage({ id, taille = 20 }: { id: IconeReglageId; taille?: number }) {
  return (
    <svg className="icone-reglage" viewBox="0 0 24 24" width={taille} height={taille} aria-hidden="true" focusable="false">{TRACES[id]}</svg>
  );
}
