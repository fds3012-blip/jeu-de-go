// #614 : grille « Par thème », partagée par Problèmes (séries, src/ui/SeriesThemes.tsx) et Apprendre (thèmes des leçons,
// src/app/Learn.tsx). Chaque carte : une miniature, le nom, une ligne qui dit ce qu'on y apprend, puis l'état :
// « Maîtrisé », ou une barre fine. Actions secondaires, à plat : l'action en relief de l'écran reste ailleurs.
// Une colonne sur téléphone (la ligne de description ne tient pas dans une demi-largeur), puis 2, 3 et plus quand la place
// le permet (#625, P8). Cartes à plat, sans bordure, comme les entrées des sommaires (.sommaire-entree, #653).
import { useId, type CSSProperties, type ReactNode } from 'react';
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

export function GrilleThemes({ titre, cartes, motMaitrise, onOuvrir, className, testId, titreVisible = true }: {
  titre: string; cartes: readonly CarteTheme[]; motMaitrise: string; onOuvrir: (cle: string) => void;
  className?: string; testId?: string;
  /** Faux quand l'écran porte déjà ce titre (#693, « Par thème » en double) : la section garde son nom pour les lecteurs d'écran. */
  titreVisible?: boolean;
}) {
  const id = useId();
  if (!cartes.length) return null;
  return (
    <section className={['themes', className].filter(Boolean).join(' ')} aria-labelledby={titreVisible ? `${id}-t` : undefined} aria-label={titreVisible ? undefined : titre} data-testid={testId}>
      {titreVisible && <h3 id={`${id}-t`}>{titre}</h3>}
      <ul className="themes-grille">
        {cartes.map(c => (
          <li key={c.cle}>
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
    </section>
  );
}
