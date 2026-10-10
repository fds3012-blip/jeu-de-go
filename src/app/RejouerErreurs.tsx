// « Rejouer mes erreurs » (#428), sur le modèle du « Retry » de chess.com. Ouvert depuis le bilan de la revue
// (Revue.tsx), seulement avec KataGo. Pour chaque erreur (rejouerErreurs.ts), de la plus grave à la moins grave :
// la position d'avant, « Ici, tu as joué B8. Trouve mieux. », trois essais, puis le coup de KataGo en pierre fantôme.
// Fin : « 2 sur 3 trouvées », XP (10 pour la séance, une fois par partie) et une petite fête si au moins une erreur
// est trouvée. L'XP se lit dans la carte de fin, et nulle part ailleurs (#509, lot L1).
// Moments forts (skill peak-end-rule) : le coup trouvé (bulle jade, la pierre se pose, vibration de réussite) et la fin,
// qui parle toujours de ce que le joueur emporte, jamais de ce qu'il a raté.
import { useEffect, useRef, useState } from 'react';
import { Board } from '../ui/Board';
import { Mochi } from '../ui/Mochi';
import { SceauNote } from '../ui/SceauNote';
import { Confettis } from '../ui/Confettis';
import { marquerXpVue, useExercice } from '../ui/celebrations';
import { DetailXp } from '../ui/DetailXp';
import { type XpSeance, useXpSeance } from '../ui/xpSeance';
import { hapticFail, hapticSuccess } from '../ui/haptics';
import { mouvementsReduits } from '../ui/defilement';
import { texteXp } from '../ui/gainXp';
import { fr } from '../ui/typo';
import { t as tr } from '../content/i18n/secondaires';
import { play, type Color, type Position } from '../go/rules';
import { analyseRevue } from '../engine';
import { EVENTS, track } from '../data/analytics';
import { NOTE_INFO, type AnalyseRevue } from './revue';
import {
  consigne, ESSAIS, idPartie, jugerEssai, jugerParRecherche, lireParties, marquerPartie, phraseFin, phraseMontrePourquoi, phrasePasEncore,
  phraseTrouvePourquoi, score, titreFin, VISITES_JUGE, XP_REJEU_KEY, type ErreurARejouer, type Jugement, type ResultatRejeu,
} from './rejouerErreurs';
import { creerErreur } from './erreurs';
import { garderErreurRatee } from './revisionsAppareil';
import { readLocal, writeLocal } from './hooks';
import { gagnerXp, noterActivite } from './xp';
import { useSettings } from './settings';
import '../ui/rejouer-erreurs.css';

interface Props {
  sgf: string;
  positions: Position[];
  komi: number;
  analyses: (AnalyseRevue | null)[];
  erreurs: ErreurARejouer[];
  /** Joueur dont ce sont les erreurs (`null` : partie à deux, les deux camps). */
  joueur: Color | null;
  adversaire?: string;
  confirmTouch?: boolean;
  onRetour: () => void;
}

type Etat = 'cherche' | 'juge' | 'trouve' | 'montre';

export function RejouerErreurs({ sgf, positions, komi, analyses, erreurs, joueur, adversaire, confirmTouch = false, onRetour }: Props) {
  const size = positions[0].size;
  const [k, setK] = useState(0);
  const [etat, setEtat] = useState<Etat>('cherche');
  const [essais, setEssais] = useState(0);
  const [faux, setFaux] = useState<number | null>(null);
  const [secousse, setSecousse] = useState(0);
  const [inconnu, setInconnu] = useState(false);
  const [jugement, setJugement] = useState<Extract<Jugement, { verdict: 'bon' }> | null>(null);
  const [pose, setPose] = useState<Position | null>(null);
  const [resultats, setResultats] = useState<ResultatRejeu[]>([]);
  const [fin, setFin] = useState(false);
  // XP de la séance, lue dans la carte de fin ; `deja` : cette partie a déjà rapporté son XP.
  const [xp, setXp] = useState<(XpSeance & { deja: boolean }) | null>(null);
  const [gerbe, setGerbe] = useState(false);
  const [{ celebrations }] = useSettings();
  // Jeton de l'essai en cours : une recherche lente arrivée après un changement d'erreur est ignorée.
  const jeton = useRef(0);
  // Analyse de la position après le coup de KataGo, par erreur : une seule recherche, même si on juge plusieurs essais.
  const apresMeilleur = useRef(new Map<number, Promise<AnalyseRevue | null>>());
  const xpDonne = useRef(false);
  // #509 (L1, n° 2) : la séance reste un exercice jusqu'à ce que la carte de fin ait pris l'XP. Tout ce qu'elle a rapporté
  // (erreurs rejouées, bonus « première fois », objectif de la semaine atteint en route) s'y lit en un seul montant ;
  // la pastille globale ne le répète pas par-dessus le logo. Le niveau franchi, lui, se fête ensuite (file des fêtes).
  useExercice(xp === null);
  const gains = useXpSeance();

  const e = erreurs[k], avant = positions[e.coup - 1];
  const toi = !!joueur && e.couleur === joueur && !!adversaire;

  function conclure(trouvee: boolean, n: number) {
    track(EVENTS.revueErreurRejouee, { trouvee, essais: n, note: e.note });
    noterActivite('erreurs'); // #369 : objectif « erreurs rejouées » de la semaine
    setResultats(r => [...r, { coup: e.coup, note: e.note, trouvee, essais: n }]);
    // Pas trouvée : elle rejoint « Tes erreurs à rejouer » (révision espacée, #77) et revient demain.
    if (!trouvee) {
      const pb = creerErreur({ avant, joue: e.joue, coup: e.coup, note: e.note, meilleur: e.meilleur, perte: e.perte, analyse: analyses[e.coup - 1], analyseApres: analyses[e.coup], adversaire }, new Date());
      if (pb) garderErreurRatee(pb); // #469 : révision espacée, comptée sur l'accueil
    }
  }

  function appliquer(j: Jugement, p: number) {
    if (j.verdict === 'inconnu') { setInconnu(true); setEtat('cherche'); return; }
    const n = essais + 1;
    setEssais(n);
    setInconnu(false);
    if (j.verdict === 'bon') {
      const suite = play(avant, p);
      setPose(typeof suite === 'object' ? suite : null);
      setJugement(j);
      setFaux(null);
      setEtat('trouve');
      hapticSuccess();
      conclure(true, n);
      return;
    }
    hapticFail();
    setFaux(p);
    setSecousse(s => s + 1);
    if (n >= ESSAIS) { setEtat('montre'); conclure(false, n); return; }
    setEtat('cherche');
  }

  async function essayer(p: number) {
    if (etat !== 'cherche') return;
    const j = jugerEssai(e, analyses[e.coup - 1], p, size);
    if (j) { appliquer(j, p); return; }
    // Coup que la recherche de la revue n'a pas assez exploré : recherche courte, même budget des deux côtés.
    const essai = play(avant, p);
    if (typeof essai === 'string') return;
    const id = ++jeton.current;
    setEtat('juge');
    let ref = apresMeilleur.current.get(e.coup);
    if (!ref) {
      const m = play(avant, e.meilleur);
      ref = typeof m === 'string' ? Promise.resolve(null) : analyseRevue(m, komi, { visits: VISITES_JUGE }).catch(() => null);
      apresMeilleur.current.set(e.coup, ref);
    }
    const [a, b] = await Promise.all([ref, analyseRevue(essai, komi, { visits: VISITES_JUGE }).catch(() => null)]);
    if (id !== jeton.current) return;
    appliquer(jugerParRecherche(e, a, b, size), p);
  }

  function montrer() {
    if (etat !== 'cherche') return;
    jeton.current++;
    setEtat('montre');
    setFaux(null);
    conclure(false, essais);
  }

  function suivante() {
    jeton.current++;
    if (k + 1 >= erreurs.length) { setFin(true); window.scrollTo?.({ top: 0 }); return; }
    setK(k + 1);
    setEtat('cherche'); setEssais(0); setFaux(null); setInconnu(false); setJugement(null); setPose(null);
    window.scrollTo?.({ top: 0 });
  }

  // Fin de séance : XP une fois par partie, puis la fête (si au moins une erreur trouvée, célébrations activées,
  // mouvements non réduits).
  const s = score(resultats);
  useEffect(() => {
    if (!fin || xpDonne.current) return;
    xpDonne.current = true;
    const liste = marquerPartie(lireParties(readLocal<unknown>(XP_REJEU_KEY, [])), idPartie(sgf));
    if (liste) { writeLocal(XP_REJEU_KEY, liste); gagnerXp('erreursRejouees'); }
    // Tout ce que la séance a rapporté (gain, bonus, objectif de la semaine) : la carte l'affiche, la pastille ne le répète pas.
    marquerXpVue();
    setXp({ ...gains.current, deja: !liste });
    if (s.trouvees > 0 && celebrations && !mouvementsReduits()) setGerbe(true);
  }, [fin]); // eslint-disable-line react-hooks/exhaustive-deps

  const tete = (compteur?: string) => (
    <header className="revue-tete">
      <button type="button" className="retour" onClick={onRetour} aria-label={tr('rejeu.retour')}>‹</button>
      <h2>{tr('rejeu.titre')}</h2>
      {compteur && <span className="revue-compteur">{compteur}</span>}
    </header>
  );

  // ---------- Fin : « 2 sur 3 trouvées » ----------
  if (fin) {
    return (
      <div className="revue rejeu-fin">
        {tete()}
        <section className="rejeu-fin-carte" aria-labelledby="rejeu-fin-titre">
          <div className="rejeu-fin-mochi"><Mochi size={84} /></div>
          <h3 id="rejeu-fin-titre" className="rejeu-fin-titre">{fr(titreFin(s))}</h3>
          <ol className="rejeu-fin-pastilles" aria-label={tr('rejeu.resultats')}>
            {resultats.map((r, i) => (
              <li key={r.coup} className={r.trouvee ? 'trouvee' : 'ratee'} style={{ animationDelay: `${120 + i * 70}ms` }}
                aria-label={tr(r.trouvee ? 'rejeu.trouvee' : 'rejeu.ratee', { coup: r.coup })}>
                {/* Trouvée : une coche ; pas trouvée : un simple point creux (rejouer-erreurs.css), pas un bouton. */}
                {r.trouvee && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9" pathLength={1} /></svg>}
              </li>
            ))}
          </ol>
          <p className="rejeu-fin-phrase">{fr(phraseFin(s))}</p>
          {xp && xp.points > 0 && (
            <><p className="rejeu-fin-xp"><b>{texteXp(xp.points)}</b></p><DetailXp xp={xp} /></>
          )}
          {xp?.deja && <p className="revue-note">{fr(tr('rejeu.xpDeja'))}</p>}
        </section>
        {gerbe && <Confettis duree={1200} onFin={() => setGerbe(false)} />}
        <div className="dock revue-dock">
          <button type="button" className="cta" onClick={onRetour}>{tr('rejeu.retour')}</button>
        </div>
      </div>
    );
  }

  // ---------- Une erreur à rejouer ----------
  // #492 : le pourquoi, vérifié par le calcul, avec la réponse montrée et après un coup trouvé.
  const phrase = etat === 'trouve' && jugement ? phraseTrouvePourquoi(jugement, e, avant, pose?.lastMove ?? e.meilleur)
    : etat === 'montre' ? phraseMontrePourquoi(e, avant)
    : etat === 'juge' ? tr('rejeu.juge')
    : inconnu ? tr('rejeu.inconnu')
    : essais > 0 ? phrasePasEncore(essais)
    : consigne(e, size, toi);
  const board = etat === 'trouve' && pose ? pose : avant;
  const marks = etat === 'trouve' && pose
    ? { last: pose.lastMove, ok: pose.lastMove ?? undefined }
    : etat === 'montre'
      ? { meilleur: e.meilleur, mistake: e.joue >= 0 ? e.joue : undefined, last: avant.lastMove }
      : { last: avant.lastMove, mistake: faux ?? undefined };
  const derniere = k + 1 >= erreurs.length;

  return (
    <div className="revue revue-rejeu rejeu-erreurs" data-etat={etat}>
      {tete(tr('rejeu.compteur', { i: k + 1, n: erreurs.length }))}
      <div className={`revue-mochi rejeu-bulle${etat === 'trouve' ? ' revue-rejeu-ok' : ''}`}>
        <Mochi size={40} />
        <div className="rejeu-texte">
          <p className="rejeu-note">
            <SceauNote note={e.note} taille={20} />
            <span>{tr('rejeu.noteCoup', { note: NOTE_INFO[e.note].libelle, coup: e.coup })}</span>
          </p>
          <p key={`${k}-${etat}-${essais}-${inconnu}`} className="rejeu-phrase" aria-live="polite">{fr(phrase)}</p>
        </div>
      </div>
      <div className="revue-plateau">
        <Board size={size} board={board.board} toPlay={avant.toPlay} interactive={etat === 'cherche'} confirmTouch={confirmTouch}
          onPlay={p => { void essayer(p); }} marks={marks} shake={faux != null && etat === 'cherche' ? { p: faux, n: secousse } : null} />
      </div>
      {etat === 'cherche' && (
        <button type="button" className="lien rejeu-montre" onClick={montrer}>{tr('rejeu.montre')}</button>
      )}
      {(etat === 'trouve' || etat === 'montre') && (
        <div className="dock revue-dock">
          <button type="button" className="cta" onClick={suivante}>{tr(derniere ? 'rejeu.resultat' : 'rejeu.suivante')}</button>
        </div>
      )}
    </div>
  );
}
