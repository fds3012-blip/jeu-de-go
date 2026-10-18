// A13 (DESIGN.md) : un sommaire, puis le détail. Une liste courte d'entrées, chacune avec son visuel (mini-goban, icône,
// portrait), son nom sur une ligne et, au plus, un état court (« À faire », un nombre). Toucher une entrée ouvre son
// détail par-dessus, avec « ‹ » (EnteteEcran) ; le retour du système suit (src/app/retourSysteme.ts touche « ‹ »).
// Modèle : les onglets Problèmes et « Plus » de chess.com. Entrées à plat, groupées en un bloc comme « Par thème »
// (themes.css) : le seul relief de l'écran reste son action principale.
import { useId, type ReactNode } from 'react';
import { fr } from './typo';
import './sommaire.css';

export interface EntreeSommaire {
  cle: string;
  nom: string;
  /** Visuel décoratif de 40 px (mini-goban, icône, portrait). */
  visuel: ReactNode;
  /** État court, à droite (« À faire », « 3 »). `ton` : or pour ce qui attend le joueur, sinon neutre. */
  etat?: { texte: string; ton?: 'or' | 'neutre'; aria?: string };
  /** Nom accessible complet, s'il dit plus que « nom, état » ; il commence toujours par le nom visible (WCAG 2.5.3). */
  aria?: string;
  onOuvrir: () => void;
  testId?: string;
}

/**
 * `titre` : un petit titre visible au-dessus du groupe (Profil : « Ta progression », « Compte »…) ; sinon `nom`, lu
 * seulement par le lecteur d'écran (E9).
 */
export function Sommaire({ entrees, titre, nom, className, testId }: {
  entrees: readonly EntreeSommaire[]; titre?: string; nom?: string; className?: string; testId?: string;
}) {
  const id = useId();
  if (!entrees.length) return null;
  return (
    <section className={['sommaire', className].filter(Boolean).join(' ')} data-testid={testId}
      {...(titre ? { 'aria-labelledby': `${id}-t` } : { 'aria-label': nom })}>
      {titre && <h3 id={`${id}-t`} className="sommaire-titre">{titre}</h3>}
      <ul className="sommaire-liste">
        {entrees.map(e => (
          <li key={e.cle}>
            <button type="button" className="sommaire-entree" data-entree={e.cle} data-testid={e.testId} onClick={e.onOuvrir}
              aria-label={fr(e.aria ?? [e.nom, e.etat?.aria ?? e.etat?.texte].filter(Boolean).join(', '))}>
              <span className="sommaire-visuel" aria-hidden="true">{e.visuel}</span>
              <b className="sommaire-nom" aria-hidden="true">{fr(e.nom)}</b>
              {e.etat && <span className="sommaire-etat" data-ton={e.etat.ton ?? 'neutre'} aria-hidden="true">{fr(e.etat.texte)}</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
