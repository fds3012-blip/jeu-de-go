// Séance « Révisions du jour » (#469), ouverte depuis la carte de l'accueil. 5 éléments au plus, les plus en retard
// d'abord : erreurs de partie (« Tes erreurs à rejouer », « Rejouer mes erreurs ») et problèmes ratés au premier essai.
// Chaque élément se joue dans le lecteur de problème existant (PuzzlePlayer) ; seul le premier essai compte :
// réussi, il monte d'une marche (J+3, J+7, J+14, J+30) ; raté, il revient demain (src/app/revisionEspacee.ts).
// Fin : « 3 sur 5 du premier coup », l'échelle des intervalles, +20 XP une fois par jour, une petite fête si au moins un
// élément est trouvé (célébrations activées, mouvements non réduits). Tout se passe sur l'appareil : la séance marche
// hors ligne ; avec un compte, la file part au serveur en arrière-plan (src/data/revisions.ts).
import { useEffect, useMemo, useRef, useState } from 'react';
import { PuzzlePlayer, SOLVED_KEY } from './Puzzles';
import { ALL_PUZZLES } from '../content/puzzles';
import { parsePuzzles, type Puzzle } from '../data/puzzles';
import { EVENTS, track } from '../data/analytics';
import { versProbleme } from './erreurs';
import { readLocal, writeLocal } from './hooks';
import { INTERVALLES, prendreXp, retard, seance, type ElementFile } from './revisionEspacee';
import { ecrireEtatAppareil, fileAppareil, lireErreursAppareil, lireEtatAppareil, noterErreur, noterProblemeRevu } from './revisionsAppareil';
import { gagnerXp, noterActivite } from './xp';
import { Mochi } from '../ui/Mochi';
import { Confettis } from '../ui/Confettis';
import { Etapes } from '../ui/Lecteur';
import { lireFile, marquerXpVue, useExercice } from '../ui/celebrations';
import { mouvementsReduits } from '../ui/defilement';
import { texteXp } from '../ui/gainXp';
import { fr } from '../ui/typo';
import { t as tg } from '../content/i18n';
import { t } from '../content/i18n/secondaires';
import '../ui/rejouer-erreurs.css';
import '../ui/seance-revisions.css';

interface Props {
  confirmTouch: boolean;
  celebrer: boolean;
  /** Compte connecté : la file est synchronisée (mesure seulement). */
  compte: boolean;
  onFin: () => void;
}

interface Exercice { element: ElementFile; puzzle: Puzzle }
interface Resultat { cle: string; reussi: boolean }

const LOCAUX = parsePuzzles(ALL_PUZZLES);

/** Les exercices de la séance, dans l'ordre : erreurs gardées sur l'appareil et problèmes connus. */
function exercicesDuJour(maintenant = new Date(), problemes: readonly Puzzle[] = LOCAUX): Exercice[] {
  const parId = new Map(problemes.map(p => [p.id, p]));
  const erreurs = new Map(lireErreursAppareil().map(e => [e.id, e]));
  return seance(fileAppareil(id => parId.has(id)), maintenant).flatMap(element => {
    const e = element.genre === 'erreur' ? erreurs.get(element.ref) : undefined;
    const puzzle = e ? versProbleme(e) : parId.get(element.ref);
    return puzzle ? [{ element, puzzle }] : [];
  });
}

export function SeanceRevisions({ confirmTouch, celebrer, compte, onFin }: Props) {
  // La séance est fixée à l'ouverture : un élément raté (revient demain) ou réussi ne la change plus.
  const [exercices] = useState(() => exercicesDuJour());
  const [k, setK] = useState(0);
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const [fin, setFin] = useState(false);
  // XP de la séance, lue dans la carte de fin (#509, L1 n° 2 : un seul montant, pas de pastille globale par-dessus).
  const [xp, setXp] = useState<{ points: number; bonus: number } | null>(null);
  const [gerbe, setGerbe] = useState(false);
  const fini = useRef(false);
  // La séance reste un exercice jusqu'à ce que la carte de fin ait pris l'XP (voir RejouerErreurs.tsx).
  useExercice(exercices.length > 0 && xp === null);

  useEffect(() => {
    window.scrollTo?.({ top: 0 });
    if (!exercices.length) return;
    const maintenant = new Date();
    const erreurs = exercices.filter(x => x.element.genre === 'erreur').length;
    track(EVENTS.revisionSeanceCommencee, {
      elements: exercices.length, erreurs, problemes: exercices.length - erreurs, compte,
      retard_max: Math.max(...exercices.map(x => retard(x.element.suivi, maintenant))),
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function noter(x: Exercice, reussi: boolean) {
    const { element } = x, maintenant = new Date();
    track(EVENTS.revisionElement, { genre: element.genre, reussi, etape: element.suivi.etape, retard: retard(element.suivi, maintenant) });
    if (element.genre === 'erreur') {
      const { avant, maitrisee } = noterErreur(element.ref, reussi, maintenant);
      noterActivite('erreurs'); // #369 : objectif « erreurs rejouées » de la semaine
      if (maitrisee && avant) track(EVENTS.erreurMaitrisee, { taille: avant.size, coup: avant.coup, rates: avant.rates });
    } else noterProblemeRevu(element.ref, reussi, maintenant);
    setResultats(r => (r.some(y => y.cle === element.cle) ? r : [...r, { cle: element.cle, reussi }]));
  }

  function terminer() {
    if (fini.current) return;
    fini.current = true;
    const etat = prendreXp(lireEtatAppareil(), new Date());
    let points = 0;
    if (etat) { ecrireEtatAppareil(etat); points = gagnerXp('revision').points; }
    // Pendant l'exercice, les gains s'additionnent dans la file (`enLigne`) : c'est ce montant que la carte affiche.
    const enLigne = lireFile().enLigne;
    marquerXpVue();
    setXp({ points: enLigne?.points ?? points, bonus: enLigne?.bonus ?? 0 });
    setFin(true);
    const reussis = resultats.filter(r => r.reussi).length;
    track(EVENTS.revisionSeanceTerminee, { elements: exercices.length, reussis, xp: points });
    if (reussis > 0 && celebrer && !mouvementsReduits()) setGerbe(true);
    window.scrollTo?.({ top: 0 });
  }

  function quitter() {
    if (!fini.current && exercices.length) track(EVENTS.revisionSeanceQuittee, { faits: resultats.length, elements: exercices.length });
    onFin();
  }

  const reussis = useMemo(() => resultats.filter(r => r.reussi).length, [resultats]);

  if (!exercices.length) {
    return (
      <div className="revue seance-revisions seance-vide">
        <Tete onRetour={onFin} />
        <section className="rejeu-fin-carte">
          <div className="rejeu-fin-mochi"><Mochi size={84} /></div>
          <p className="rejeu-fin-phrase">{fr(t('seance.vide'))}</p>
        </section>
        <div className="dock revue-dock">
          <button type="button" className="cta" onClick={onFin}>{t('seance.retour')}</button>
        </div>
      </div>
    );
  }

  if (fin) {
    const total = exercices.length;
    const phrase = reussis === total ? 'seance.finToutes' : reussis > 0 ? 'seance.finCertaines' : 'seance.finAucune';
    return (
      <div className="revue seance-revisions rejeu-fin">
        <Tete onRetour={onFin} />
        <section className="rejeu-fin-carte" aria-labelledby="seance-fin-titre">
          <div className="rejeu-fin-mochi"><Mochi size={84} /></div>
          <h3 id="seance-fin-titre" className="rejeu-fin-titre">{fr(t('seance.finTitre', { n: reussis, total }))}</h3>
          <ol className="rejeu-fin-pastilles" aria-label={t('seance.titre')}>
            {exercices.map((x, i) => {
              const r = resultats.find(y => y.cle === x.element.cle);
              const ok = !!r?.reussi;
              return (
                <li key={x.element.cle} className={ok ? 'trouvee' : 'ratee'} style={{ animationDelay: `${120 + i * 70}ms` }}
                  aria-label={`${x.puzzle.title} : ${t(ok ? 'seance.trouve' : 'seance.rate')}`}>
                  {ok && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9" pathLength={1} /></svg>}
                </li>
              );
            })}
          </ol>
          <p className="rejeu-fin-phrase">{fr(t(phrase))}</p>
          {xp != null && (xp.points > 0
            ? <p className="rejeu-fin-xp"><b>{texteXp(xp.points)}</b>{xp.bonus > 0 && <small>{tg('xp.bonus', { bonus: xp.bonus })}</small>}</p>
            : <p className="revue-note">{fr(t('seance.xpDejaPris'))}</p>)}
          <Echelle />
        </section>
        {gerbe && <Confettis duree={1200} onFin={() => setGerbe(false)} />}
        <div className="dock revue-dock">
          <button type="button" className="cta" onClick={onFin}>{t('seance.retour')}</button>
        </div>
      </div>
    );
  }

  const x = exercices[k], derniere = k + 1 >= exercices.length;
  return (
    <div className="seance-revisions seance-en-cours" data-genre={x.element.genre}>
      <Etapes total={exercices.length} faites={resultats.length} label={t('seance.progresAria', { n: k + 1, total: exercices.length })} />
      <PuzzlePlayer key={x.element.cle} puzzle={x.puzzle} rang={k + 1} confirmTouch={confirmTouch}
        surtitre={t('seance.surtitre', { n: k + 1, total: exercices.length })}
        retour={t('seance.retour')} suivant={t(derniere ? 'seance.terminer' : 'seance.suivant')}
        // Seul le premier essai compte : `rated` le fait remonter par onAttempt (aucune cote ici).
        rated onAttempt={async ok => { noter(x, ok); return null; }}
        onSolved={(_essais, aide) => {
          // Problème jamais réussi, trouvé sans aide pendant la révision : il compte comme réussi dans l'onglet Problèmes.
          if (x.element.genre === 'probleme' && aide === 0) {
            const resolus = readLocal<Record<string, true>>(SOLVED_KEY, {});
            if (!resolus[x.puzzle.id]) writeLocal(SOLVED_KEY, { ...resolus, [x.puzzle.id]: true });
          }
        }}
        onNext={() => { if (derniere) terminer(); else { setK(k + 1); window.scrollTo?.({ top: 0 }); } }}
        onExit={quitter} />
    </div>
  );
}

function Tete({ onRetour }: { onRetour: () => void }) {
  return (
    <header className="revue-tete">
      <button type="button" className="retour" onClick={onRetour} aria-label={t('seance.retour')}>‹</button>
      <h2>{t('seance.titre')}</h2>
    </header>
  );
}

/** L'échelle des intervalles (J+1 → J+30) : ce qui se passe ensuite, en une ligne qu'on lit d'un coup d'œil. */
function Echelle() {
  return (
    <div className="seance-echelle">
      <ol aria-hidden="true">
        {INTERVALLES.map(j => <li key={j}><span>J+{j}</span></li>)}
      </ol>
      <p className="muted small">{fr(t('seance.explication'))}</p>
    </div>
  );
}
