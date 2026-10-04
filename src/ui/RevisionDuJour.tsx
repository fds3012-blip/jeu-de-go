// « Révision du jour » (issue #199) : 3 problèmes déjà réussis, repris à J+1, J+3 et J+7 (logique : src/app/revision.ts).
// Section de l'onglet Problèmes, sous le Go du jour. Une seule carte : le prochain exercice, sans total ni fin visible.
// Chaque exercice s'ouvre dans le lecteur de problème existant (passé par Puzzles.tsx), en plein écran, comme « Tes erreurs ».
// Révision du jour finie : c'est un défi du jour (série de l'appareil, SERIE_UN_DEFI), l'événement `revision_faite`
// et, depuis #233, +20 XP une fois par jour (comme le Go du jour : un défi qui fait vivre la série rapporte toujours).
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import type { Puzzle } from '../data/puzzles';
import { EVENTS, track } from '../data/analytics';
import { readLocal, writeLocal } from '../app/hooks';
import { numeroDuJour, type Serie } from '../app/goDuJour';
import { REVISION_KEY, aFaire, apresRevision, lireRevision, revisionDuJour, revisionFaite, synchroniser, type EtatRevision } from '../app/revision';
import { SERIE_UN_DEFI, compteDansSerie } from '../app/defi';
import { validerDefi } from '../app/defiAppareil';
import { gagnerXp } from '../app/xp';
import { MiniGoban } from './MiniGoban';
import { fr } from './typo';
import { t } from '../content/i18n/secondaires';

/** Ce que la révision passe au lecteur de problème (PuzzlePlayer de Puzzles.tsx). `aide` : 0 sans aide (#197). */
export interface LecteurRevisionProps {
  puzzle: Puzzle; rang: number; confirmTouch: boolean; rated: boolean;
  onAttempt: (ok: boolean) => Promise<null>;
  onSolved: (essais: number, aide: number) => void; onNext?: () => void; onExit: () => void;
}

interface Props {
  /** Problèmes connus (base ou copie locale). */
  liste: Puzzle[];
  /** Problèmes réussis (appareil et compte) : ils entrent dans la révision le jour où on les voit. */
  reussis: ReadonlySet<string>;
  /** Parmi eux, ceux vus avec la réponse sans être réussis (#251) : même calendrier, autre libellé. */
  vus?: ReadonlySet<string>;
  confirmTouch: boolean;
  Lecteur: ComponentType<LecteurRevisionProps>;
  /** Série de l'appareil après la révision du jour (pour rafraîchir la flamme). */
  onSerie?: (serie: Serie | null) => void;
}

function lire(): EtatRevision { return lireRevision(readLocal<unknown>(REVISION_KEY, null)); }

export function RevisionDuJour({ liste, reussis, vus, confirmTouch, Lecteur, onSerie }: Props) {
  const [numero] = useState(() => numeroDuJour(new Date()));
  const parId = useMemo(() => new Map(liste.map(p => [p.id, p])), [liste]);
  const [etat, setEtat] = useState<EtatRevision>(() => {
    const e = revisionDuJour(synchroniser(lire(), reussis, numero), numero, new Set(parId.keys()));
    writeLocal(REVISION_KEY, e);
    return e;
  });
  // Nouveaux problèmes réussis (sur l'appareil ou relus du compte) : suivis dès aujourd'hui, proposés demain.
  useEffect(() => {
    setEtat(prev => {
      const e = synchroniser(prev, reussis, numero);
      if (e !== prev) writeLocal(REVISION_KEY, e);
      return e;
    });
  }, [reussis, numero]);

  const [ouvert, setOuvert] = useState<string | null>(null);
  // Résultat du premier essai de l'exercice ouvert (null : pas encore joué).
  const premier = useRef<boolean | null>(null);
  const bilan = useRef({ exercices: 0, premierCoup: 0 });

  useEffect(() => {
    if (!ouvert) return;
    window.scrollTo?.({ top: 0 });
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(null); };
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [ouvert]);

  function resolu(id: string, essais: number, aide: number) {
    // Réussi pour le calendrier : du premier coup et sans aide. Sinon il revient demain, sans rien perdre.
    const reussi = essais === 1 && aide === 0 && premier.current !== false;
    const e = apresRevision(etat, id, reussi, numero);
    writeLocal(REVISION_KEY, e);
    setEtat(e);
    bilan.current = { exercices: bilan.current.exercices + 1, premierCoup: bilan.current.premierCoup + (reussi ? 1 : 0) };
    if (!revisionFaite(etat, numero) && revisionFaite(e, numero)) {
      const { serie } = validerDefi('revision');
      onSerie?.(serie);
      gagnerXp('revision');
      track(EVENTS.revisionFaite, {
        exercices: e.jour?.ids.length ?? 0, du_premier_coup: bilan.current.premierCoup,
        serie: serie?.jours ?? 0, compte_serie: compteDansSerie('revision'),
      });
    }
  }

  const suivant = aFaire(etat, numero);
  const pzSuivant = suivant ? parId.get(suivant) : undefined;

  if (ouvert) {
    const pz = parId.get(ouvert);
    if (!pz) return null;
    return (
      <div className="mes-erreurs-ecran" role="dialog" aria-modal="true" aria-label={`${t('revision.titre')} : ${pz.title}`}>
        <div className="mes-erreurs-contenu">
          <Lecteur key={ouvert} puzzle={pz} rang={Math.max(1, liste.indexOf(pz) + 1)} confirmTouch={confirmTouch}
            // Pas de cote ici : `rated` fait seulement remonter le premier essai.
            rated onAttempt={async ok => { premier.current = ok; return null; }}
            onSolved={(essais, aide) => resolu(ouvert, essais, aide)}
            onNext={pzSuivant && suivant !== ouvert ? () => { premier.current = null; setOuvert(suivant!); } : undefined}
            onExit={() => setOuvert(null)} />
        </div>
      </div>
    );
  }

  const faite = revisionFaite(etat, numero);
  if (!pzSuivant && !faite) return null;
  return (
    <section aria-labelledby="revision-titre" className="revision">
      <h2 id="revision-titre" className="titre-pierres">{t('revision.titre')}</h2>
      {pzSuivant ? (
        <>
          <p className="muted small bases-aide">{fr(t('revision.aide'))}</p>
          <button className="revision-carte" onClick={() => { premier.current = null; setOuvert(pzSuivant.id); }}
            aria-label={t('revision.ouvrirAria', { titre: pzSuivant.title })} data-revision={pzSuivant.id}>
            <span className="revision-goban" aria-hidden="true"><MiniGoban rows={pzSuivant.rows} /></span>
            <span className="revision-texte" aria-hidden="true">
              <b>{pzSuivant.title}</b>
              <small>{t(vus?.has(pzSuivant.id) ? 'revision.dejaVu' : 'revision.dejaReussi')}</small>
            </span>
            <svg className="revision-fleche" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="m9 5 7 7-7 7" /></svg>
          </button>
        </>
      ) : (
        <p className="revision-faite" role="status">
          <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" focusable="false"><circle cx="16" cy="16" r="15" className="rv-fond" /><path d="M10.5 16.6 14.3 20.2 21.5 12.4" className="rv-coche" /></svg>
          {fr(t('revision.faite'))}
        </p>
      )}
      {SERIE_UN_DEFI && <p className="muted small revision-serie">{fr(t('revision.serie'))}</p>}
    </section>
  );
}
