// #614 : grille « Par thème », partagée par Problèmes (séries, src/ui/SeriesThemes.tsx) et Apprendre (thèmes des leçons,
// src/app/Learn.tsx). Chaque carte : une miniature, le nom, une ligne qui dit ce qu'on y apprend, puis l'état :
// « Maîtrisé », ou une barre fine. Actions secondaires, à plat : l'action en relief de l'écran reste ailleurs.
// Une colonne sur téléphone (la ligne de description ne tient pas dans une demi-largeur), deux dès que la place le permet.
import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { fr } from './typo';
import './themes.css';

export interface CarteTheme {
  /** Identifiant du thème (data-theme). */
  cle: string;
  nom: string;
  /** Ce qu'on apprend dans le thème, en une ligne courte. */
  description: string;
  /** Miniature décorative (mini-goban ou vignette de leçon). */
  motif: ReactNode;
  /** Thème maîtrisé : « Maîtrisé » remplace la barre. */
  maitrise: boolean;
  /** Avancée vers la maîtrise, de 0 à 1, et sa lecture pour le lecteur d'écran. */
  part: number;
  partAria: string;
  /** Problèmes : le record de la série, en or, à côté de la barre. */
  record?: string;
}

export function GrilleThemes({ titre, cartes, motMaitrise, onOuvrir, pli, className, testId }: {
  titre: string; cartes: readonly CarteTheme[]; motMaitrise: string; onOuvrir: (cle: string) => void;
  /** Ne montrer que les `visibles` premières cartes, et les autres derrière « libelle ». */
  pli?: { visibles: number; libelle: string };
  className?: string; testId?: string;
}) {
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  if (!cartes.length) return null;
  const replie = !!pli && cartes.length > pli.visibles;
  const montrees = replie && !ouvert ? cartes.slice(0, pli.visibles) : cartes;
  return (
    <section className={['themes', className].filter(Boolean).join(' ')} aria-labelledby={`${id}-t`} data-testid={testId}>
      <h3 id={`${id}-t`}>{titre}</h3>
      <ul className="themes-grille" id={`${id}-l`}>
        {montrees.map((c, i) => (
          <li key={c.cle} className={replie && i >= pli.visibles ? 'theme-revele' : undefined}>
            {/* Nom accessible : le nom visible d'abord (WCAG 2.5.3), puis l'état ; la ligne de description le décrit. */}
            <button type="button" className="theme-carte" data-theme={c.cle} onClick={() => onOuvrir(c.cle)}
              aria-label={(c.maitrise ? [c.nom, motMaitrise] : [c.nom, c.record, c.partAria]).filter((x): x is string => !!x).map(x => fr(x)).join(', ')} aria-describedby={`${id}-${c.cle}`}>
              <span className="theme-motif" aria-hidden="true">{c.motif}</span>
              <span className="theme-nom">
                <b>{fr(c.nom)}</b>
                <span className="theme-desc" id={`${id}-${c.cle}`}>{fr(c.description)}</span>
                {c.maitrise
                  ? <span className="theme-maitrise-mot" data-maitrise="">{motMaitrise}</span>
                  : (
                    <span className="theme-etat">
                      <span className="theme-maitrise" role="img" aria-label={fr(c.partAria)}
                        style={{ '--part': `${Math.round(Math.min(1, Math.max(0, c.part)) * 100)}%` } as CSSProperties}><i /></span>
                      {c.record && <span className="theme-record">{fr(c.record)}</span>}
                    </span>
                  )}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {replie && (
        <button type="button" className="lien themes-plus" aria-expanded={ouvert} aria-controls={`${id}-l`} onClick={() => setOuvert(o => !o)}>
          {pli.libelle}
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      )}
    </section>
  );
}
