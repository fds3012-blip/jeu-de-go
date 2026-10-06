// « Mes statistiques » (#368, recadrée après #417), sous-écran du Profil chargé à la demande.
// En 3 secondes : Mochi dit où tu perds des points ; dessous, ta cote sur 90 jours, ta précision moyenne, tes erreurs
// par phase et ton bilan par taille et par mode. Une seule action principale : « Revoir une partie » (la revue avec
// KataGo nourrit la précision et les erreurs).
// Les parties de l'appareil et les revues s'affichent tout de suite (hors ligne compris) ; la cote, les parties du
// compte et les défis arrivent ensuite de Supabase. Aucun chiffre sur les problèmes (décision #137).
// Logique pure : statsJoueur.ts ; lectures : src/data/statsJoueur.ts.
import { useEffect, useMemo, useState } from 'react';
import { Mochi } from '../ui/Mochi';
import { fr } from '../ui/typo';
import { tk, nombreClub } from '../content/i18n/club';
import { grade, texteCote } from '../content/i18n/cote';
import { EVENTS, track } from '../data/analytics';
import { chargerDonneesCote, type DonneesCote } from '../data/statsJoueur';
import { mesDefis } from '../data/defi';
import type { Db } from '../data/supabase';
import { useOnline } from './hooks';
import { depuisDefi, fusionner, historiqueAppareil, MAX_AFFICHEES, type PartieHistorique } from './historique';
import {
  bilanDe, erreursMoyennes, MODES_BILAN, partGagnee, phaseFaible, PHASES, precisionMoyenne, revuesAppareil, TAILLES_BILAN,
  traceCourbe, type Bilan, type Phase, type Score,
} from './statsJoueur';
import '../ui/club.css';

type Etat = 'sans' | 'chargement' | 'pret' | 'hors-ligne' | 'erreur';

interface Props {
  /** Client Supabase et session (compte complet) : cote, parties du compte et défis. Sans eux, l'appareil seulement. */
  db?: Db | null;
  userId?: string;
  /** Action principale : ouvrir « Mes parties » pour revoir une partie. */
  onRevoir: () => void;
}

export function MesStatistiques({ db = null, userId, onRevoir }: Props) {
  const [appareil] = useState(historiqueAppareil);
  const [revues] = useState(revuesAppareil);
  const [serveur, setServeur] = useState<PartieHistorique[]>([]);
  const [cote, setCote] = useState<DonneesCote | null>(null);
  const [etat, setEtat] = useState<Etat>(db && userId ? 'chargement' : 'sans');
  const [essai, setEssai] = useState(0);
  const online = useOnline();

  useEffect(() => { track(EVENTS.statistiquesOuvertes, { revues: revues.length, parties: appareil.length, compte: !!userId }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!db || !userId) { setEtat('sans'); return; }
    if (!online) { setEtat('hors-ligne'); return; }
    let vivant = true;
    setEtat('chargement');
    const perso = import('../data/partiesPerso').then(m => m.lirePartiesPerso(db, userId));
    Promise.all([chargerDonneesCote(db, userId), perso, mesDefis(db, userId)]).then(([c, p, d]) => {
      if (!vivant) return;
      if (c.ok) setCote(c.value);
      const defis = d.ok ? d.value.flatMap(x => { const g = depuisDefi(x.partie, userId, x.resultat); return g ? [g] : []; }) : [];
      setServeur([...(p.ok ? p.value : []), ...defis]);
      setEtat(c.ok && p.ok && d.ok ? 'pret' : 'erreur');
    }, () => { if (vivant) setEtat('erreur'); });
    return () => { vivant = false; };
  }, [db, userId, online, essai]);

  const parties = useMemo(() => fusionner(appareil, serveur, MAX_AFFICHEES), [appareil, serveur]);
  const bilan = useMemo(() => bilanDe(parties, cote?.classees ?? []), [parties, cote]);
  const precision = useMemo(() => precisionMoyenne(revues), [revues]);
  const erreurs = useMemo(() => erreursMoyennes(revues), [revues]);
  const faible = phaseFaible(erreurs);

  const phrase = faible ? tk('stats.mochi.phase', { phase: tk(`stats.phases.${faible}Mot`) })
    : precision ? tk('stats.mochi.precision', { p: precision.valeur })
    : bilan.total ? tk('stats.mochi.bilan') : tk('stats.vide');

  return (
    <div className="mstats" data-testid="stats">
      <div className="mstats-mochi">
        <Mochi size={40} />
        <p className="mstats-bulle">{fr(phrase)}</p>
      </div>
      {etat === 'chargement' && <p className="muted small" role="status" aria-busy="true">{tk('stats.chargement')}</p>}
      {etat === 'hors-ligne' && <p className="muted small" role="status">{fr(tk('stats.horsLigne'))}</p>}
      {etat === 'erreur' && (
        <div className="mstats-erreur" role="alert">
          <p className="small">{fr(tk('stats.erreur'))}</p>
          <button type="button" className="btn" onClick={() => setEssai(e => e + 1)}>{tk('stats.reessayer')}</button>
        </div>
      )}

      <CourbeCote donnees={cote} compte={!!userId} />

      <section className="mstats-carte" aria-labelledby="mstats-precision">
        <h3 id="mstats-precision">{tk('stats.precision.titre')}</h3>
        {precision ? (
          <>
            <p className="mstats-grand" data-testid="stats-precision">{fr(tk('stats.precision.valeur', { p: precision.valeur }))}</p>
            <p className="muted small">{tk(precision.parties > 1 ? 'stats.precision.detail' : 'stats.precision.detail1', { n: precision.parties })}</p>
            <p className="muted small">{fr(tk('stats.precision.aide'))}</p>
          </>
        ) : <p className="muted small">{fr(tk('stats.precision.vide'))}</p>}
      </section>

      <section className="mstats-carte" aria-labelledby="mstats-phases">
        <h3 id="mstats-phases">{tk('stats.phases.titre')}</h3>
        {erreurs ? (
          <>
            <p className="muted small">{tk('stats.phases.detail')}</p>
            <Phases valeurs={erreurs} faible={faible} />
            <p className="muted small">{fr(tk('stats.phases.aide'))}</p>
          </>
        ) : <p className="muted small">{fr(tk('stats.phases.vide'))}</p>}
      </section>

      <section className="mstats-carte" aria-labelledby="mstats-bilan">
        <h3 id="mstats-bilan">{tk('stats.bilan.titre')}</h3>
        {bilan.total ? <TablesBilan bilan={bilan} /> : <p className="muted small">{tk('stats.bilan.vide')}</p>}
      </section>

      <div className="dock mstats-dock">
        <button type="button" className="cta" onClick={onRevoir}>{tk('stats.cta')}</button>
      </div>
    </div>
  );
}

/** Courbe de la cote sur 90 jours, ses bornes écrites en clair et une phrase pour le lecteur d'écran. */
function CourbeCote({ donnees, compte }: { donnees: DonneesCote | null; compte: boolean }) {
  const L = 300, H = 88, M = 8;
  const contenu = (() => {
    if (!compte) return <p className="muted small">{fr(tk('stats.cote.sansCompte'))}</p>;
    if (!donnees?.cote) return null;
    const actuelle = donnees.cote.cote;
    const valeurs = [...donnees.courbe.map(p => p.cote)];
    if (!valeurs.length || valeurs[valeurs.length - 1] !== actuelle) valeurs.push(actuelle);
    const tete = (
      <p className="mstats-cote-chiffre" data-testid="stats-cote">
        <span className="mstats-grand">{texteCote(actuelle, donnees.cote.provisoire)}</span>
        <span className="mstats-cote-grade">{grade(actuelle)}</span>
      </p>
    );
    if (valeurs.length < 2) return <>{tete}<p className="muted small">{fr(tk('stats.cote.vide'))}</p></>;
    const { d, x, y } = traceCourbe(valeurs, L, H, M);
    const min = Math.min(...valeurs), max = Math.max(...valeurs);
    return (
      <>
        {tete}
        <figure className="mstats-courbe">
          <figcaption className="muted small">{tk('stats.cote.periode')}</figcaption>
          <div className="mstats-courbe-cadre">
            <svg viewBox={`0 0 ${L} ${H}`} preserveAspectRatio="none" role="img" data-testid="stats-courbe"
              aria-label={tk('stats.cote.aria', { debut: valeurs[0], fin: actuelle, min, max })}>
              <path d={d} className="mstats-courbe-ligne" vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="mstats-courbe-point" aria-hidden="true"
              style={{ left: `${(x(valeurs.length - 1) / L) * 100}%`, top: `${(y(actuelle) / H) * 100}%` }} />
            <span className="mstats-courbe-borne haut" aria-hidden="true">{max}</span>
            <span className="mstats-courbe-borne bas" aria-hidden="true">{min}</span>
          </div>
        </figure>
      </>
    );
  })();
  return (
    <section className="mstats-carte" aria-labelledby="mstats-cote-titre">
      <h3 id="mstats-cote-titre">{tk('stats.cote.titre')}</h3>
      {contenu}
      {compte && <p className="muted small">{fr(tk('stats.cote.regle'))}</p>}
    </section>
  );
}

/** Erreurs par phase : trois barres, la phase la plus faible en couleur ; les valeurs sont écrites en clair. */
function Phases({ valeurs, faible }: { valeurs: Record<Phase, number>; faible: Phase | null }) {
  const max = Math.max(1, ...PHASES.map(p => valeurs[p]));
  return (
    <ul className="mstats-phases">
      {PHASES.map(p => (
        <li key={p} className={p === faible ? 'faible' : undefined} data-phase={p}
          aria-label={tk('stats.phases.aria', { phase: tk(`stats.phases.${p}`), n: nombreClub(valeurs[p]) })}>
          <span className="mstats-phase-nom" aria-hidden="true">{tk(`stats.phases.${p}`)}</span>
          <span className="mstats-phase-barre" aria-hidden="true"><span style={{ transform: `scaleX(${valeurs[p] / max})` }} /></span>
          <span className="mstats-phase-valeur" aria-hidden="true">{nombreClub(valeurs[p])}</span>
        </li>
      ))}
    </ul>
  );
}

/** Victoires et défaites par taille et par mode : seulement les lignes jouées. */
function TablesBilan({ bilan }: { bilan: Bilan }) {
  const ligne = (cle: string, libelle: string, s: Score) => {
    const part = partGagnee(s);
    return (
      <tr key={cle} data-ligne={cle}>
        <th scope="row">{libelle}</th>
        <td>{s.v}</td>
        <td>{s.d}</td>
        <td>{part == null ? '–' : fr(tk('stats.bilan.pourcent', { p: part }))}</td>
      </tr>
    );
  };
  const tete = (titre: string) => (
    <thead>
      <tr>
        <th scope="col">{titre}</th>
        <th scope="col">{tk('stats.bilan.victoires')}</th>
        <th scope="col">{tk('stats.bilan.defaites')}</th>
        <th scope="col">{tk('stats.bilan.part')}</th>
      </tr>
    </thead>
  );
  const joue = (s: Score) => s.v + s.d > 0;
  const tailles = TAILLES_BILAN.filter(t => joue(bilan.taille[t]));
  const modes = MODES_BILAN.filter(m => joue(bilan.mode[m]));
  return (
    <>
      {tailles.length > 0 && (
        <table className="mstats-table" data-testid="stats-tailles">
          {tete(tk('stats.bilan.taille'))}
          <tbody>{tailles.map(t => ligne(String(t), `${t} × ${t}`, bilan.taille[t]))}</tbody>
        </table>
      )}
      <table className="mstats-table" data-testid="stats-modes">
        {tete(tk('stats.bilan.mode'))}
        <tbody>{modes.map(m => ligne(m, tk(`stats.bilan.mode.${m}`), bilan.mode[m]))}</tbody>
      </table>
    </>
  );
}

export default MesStatistiques;
