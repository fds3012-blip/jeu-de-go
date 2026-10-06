// Partie partagée (#364) : l'ami ouvre `mochi-go.app/partie#JETON`, sans compte, souvent sans avoir jamais joué.
// Il voit la partie au moment clé choisi par le joueur (plateau, résultat, qui jouait), revoit les coups avec les
// flèches, puis une seule action principale :
// - jamais joué sur cet appareil : « Joue ta première partie » (comme l'accueil d'un premier lancement : contre l'ordi) ;
// - déjà joueur : « Revois-la avec Mochi » (la revue complète, src/app/Revue.tsx, en lecture seule : sans partage).
// Étude partagée (#449, même lien) : la position posée et sa variante (numérotée, rejouée avec les flèches), qui joue
// ensuite, puis une seule action principale « Étudie-la avec Mochi » : une copie s'ouvre dans l'écran d'étude.
// Lecture par le seul jeton, côté serveur (`lire_partage`). Mesure : `arrivee_par_partage` (source `partie` ou `etude`).
import { useEffect, useMemo, useState } from 'react';
import { Board } from '../ui/Board';
import { Mochi } from '../ui/Mochi';
import { Icone } from '../ui/Partie';
import { fr } from '../ui/typo';
import type { Db } from '../data/supabase';
import { lirePartiePartagee, type PartiePartagee as Partie } from '../data/partage';
import { EVENTS, track } from '../data/analytics';
import { langue } from '../content/i18n';
import { tp } from '../content/i18n/partage';
import { positionsDepuisSgf } from './revue';
import { etudeDepuisSgf, positionsEtude } from '../go/etude';
import { numerosDesCoups } from '../go/numeros';
import type { CopieEtude } from './copieEtude';
import { texteResultat } from './imagePartie';
import { useOnline } from './hooks';
import { Revue } from './Revue';
import '../ui/partage.css';

interface Props {
  db: Db | null;
  /** Jeton lu dans l'adresse ('' : mal formé). */
  jeton: string;
  /** Personne n'a jamais joué sur cet appareil (lu au chargement, avant tout geste). */
  nouveau: boolean;
  confirmTouch?: boolean;
  /** « Joue ta première partie ». */
  onJouer: () => void;
  /** Lien inconnu ou retiré : découvrir l'app. */
  onAccueil: () => void;
  /** Étude (#449) : « Étudie-la avec Mochi », la copie s'ouvre dans l'écran d'étude. */
  onEtudier?: (copie: CopieEtude) => void;
}

type Etat = { quoi: 'chargement' } | { quoi: 'erreur' } | { quoi: 'introuvable' } | { quoi: 'prete'; partie: Partie };

let arriveeNotee = false;

export function PartiePartagee({ db, jeton, nouveau, confirmTouch = false, onJouer, onAccueil, onEtudier }: Props) {
  const online = useOnline();
  const [etat, setEtat] = useState<Etat>({ quoi: 'chargement' });
  const [essai, setEssai] = useState(0);
  const [revue, setRevue] = useState(false);

  useEffect(() => {
    if (!db) { setEtat({ quoi: db === null ? 'introuvable' : 'chargement' }); return; }
    if (!online) { setEtat({ quoi: 'erreur' }); return; }
    let vivant = true;
    setEtat({ quoi: 'chargement' });
    lirePartiePartagee(db, jeton).then(r => {
      if (!vivant) return;
      const suite: Etat = !r.ok ? { quoi: 'erreur' } : r.value ? { quoi: 'prete', partie: r.value } : { quoi: 'introuvable' };
      setEtat(suite);
      if (suite.quoi !== 'erreur' && !arriveeNotee) {
        arriveeNotee = true;
        // Jamais le jeton, la partie ni le pseudo (constat E14).
        const source = suite.quoi === 'prete' && suite.partie.objet === 'etude' ? 'etude' : 'partie';
        track(EVENTS.arriveeParPartage, { source, lang: langue(), nouveau_joueur: nouveau, trouvee: suite.quoi === 'prete' });
      }
    });
    return () => { vivant = false; };
  }, [db, jeton, online, essai, nouveau]);

  if (etat.quoi === 'prete' && revue) {
    const p = etat.partie;
    return <Revue sgf={p.sgf} joueur={p.joueur} adversaire={nomAdversaire(p)} confirmTouch={confirmTouch} partage={false}
      retour={tp('vue.retour')} onRetour={() => { setRevue(false); window.scrollTo?.({ top: 0 }); }} />;
  }
  if (etat.quoi === 'prete' && etat.partie.objet === 'etude' && onEtudier) {
    const p = etat.partie;
    return <VueEtude partie={p} onEtudier={() => onEtudier({ sgf: p.sgf, pseudo: p.pseudo })} />;
  }
  if (etat.quoi === 'prete') return <Vue partie={etat.partie} nouveau={nouveau} onJouer={onJouer} onRevue={() => { setRevue(true); window.scrollTo?.({ top: 0 }); }} />;

  return (
    <div className="partagee partagee-etat">
      <div className="partagee-mochi">
        <Mochi size={56} />
        <p aria-live="polite">{fr(tp(etat.quoi === 'chargement' ? 'vue.chargement' : etat.quoi === 'introuvable' ? 'vue.introuvable' : online ? 'vue.erreur' : 'vue.horsLigne'))}</p>
      </div>
      {etat.quoi === 'erreur' && online && <button type="button" className="btn" onClick={() => setEssai(n => n + 1)}>{tp('vue.reessayer')}</button>}
      {etat.quoi === 'introuvable' && <div className="dock"><button type="button" className="cta" onClick={onAccueil}>{tp('vue.accueil')}</button></div>}
    </div>
  );
}

/** Adversaire du joueur qui a partagé, pour les phrases de la revue. */
const nomAdversaire = (p: Partie): string | undefined => (p.joueur ? p.adversaire ?? undefined : undefined);

function Vue({ partie, nouveau, onJouer, onRevue }: { partie: Partie; nouveau: boolean; onJouer: () => void; onRevue: () => void }) {
  const { positions, resultat } = useMemo(() => positionsDepuisSgf(partie.sgf), [partie.sgf]);
  const n = positions.length - 1;
  const cle = Math.max(0, Math.min(partie.coup, n));
  const [i, setI] = useState(cle > 0 ? cle : n);
  const q = positions[i];
  const l = langue();
  const moi = partie.pseudo ?? null;
  const noir = (partie.joueur === 1 ? moi : partie.joueur === 2 ? partie.adversaire : null) ?? tp('image.noir');
  const blanc = (partie.joueur === 2 ? moi : partie.joueur === 1 ? partie.adversaire : null) ?? tp('image.blanc');
  const aller = (k: number) => setI(Math.max(0, Math.min(n, k)));

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') aller(i - 1);
      else if (e.key === 'ArrowRight') aller(i + 1);
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  });

  return (
    <div className="partagee" data-testid="partie-partagee">
      <header className="partagee-tete">
        <h2>{moi ? tp('vue.titre', { pseudo: moi }) : tp('vue.titreSans')}</h2>
        <p className="partagee-camps">
          <span className="revue-coup-pierre bilan-pierre noire" aria-hidden="true" />{noir}
          <span className="partagee-contre" aria-hidden="true">·</span>
          <span className="revue-coup-pierre bilan-pierre blanche" aria-hidden="true" />{blanc}
        </p>
        <p className="partagee-resultat">{fr(texteResultat(resultat, l))}</p>
      </header>

      <div className="partagee-mochi">
        <Mochi size={40} />
        <p>{fr(tp(nouveau ? 'vue.mochiNouveau' : 'vue.mochiJoueur'))}</p>
      </div>

      <p className="partagee-compteur" aria-live="polite">
        {i === cle && cle > 0 && <b className="parcours-cle">{tp('vue.momentCle')}</b>}
        {i === 0 ? tp('vue.debut') : tp('vue.compteur', { i, n })}
      </p>
      <div className="revue-plateau">
        <Board size={q.size} board={q.board} marks={{ last: q.lastMove }} />
      </div>
      <div className="partagee-nav">
        <button type="button" className="btn revue-pas" onClick={() => aller(i - 1)} disabled={i <= 0} aria-label={tp('vue.precedent')}><Icone nom="precedent" /></button>
        <button type="button" className="btn revue-pas" onClick={() => aller(i + 1)} disabled={i >= n} aria-label={tp('vue.suivant')}><Icone nom="suivant" /></button>
      </div>

      {nouveau && <button type="button" className="lien partagee-secondaire" onClick={onRevue}>{tp('vue.analyser')}</button>}
      <div className="dock revue-dock">
        <button type="button" className="cta" onClick={nouveau ? onJouer : onRevue}>{tp(nouveau ? 'vue.jouer' : 'vue.analyser')}</button>
      </div>
    </div>
  );
}

/** Étude partagée (#449) : la position posée, sa variante numérotée (rejouée avec les flèches), qui joue ensuite. */
function VueEtude({ partie, onEtudier }: { partie: Partie; onEtudier: () => void }) {
  const etude = useMemo(() => etudeDepuisSgf(partie.sgf), [partie.sgf]);
  const positions = useMemo(() => (etude ? positionsEtude(etude) : []), [etude]);
  const n = Math.max(0, positions.length - 1);
  const [i, setI] = useState(n);
  const aller = (k: number) => setI(Math.max(0, Math.min(n, k)));
  const numeros = useMemo(() => (i > 0 ? numerosDesCoups(positions, i) : null), [positions, i]);

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') aller(i - 1);
      else if (e.key === 'ArrowRight') aller(i + 1);
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  });

  // SGF illisible (ne devrait pas arriver : le serveur l'a vérifié) : rien à étudier, message d'introuvable.
  if (!etude || !positions.length) {
    return (
      <div className="partagee partagee-etat">
        <div className="partagee-mochi"><Mochi size={56} /><p>{fr(tp('vue.introuvable'))}</p></div>
      </div>
    );
  }
  const q = positions[i];
  const camp = tp(q.toPlay === 1 ? 'image.noir' : 'image.blanc');

  return (
    <div className="partagee" data-testid="etude-partagee">
      <header className="partagee-tete">
        <h2>{partie.pseudo ? tp('vueEtude.titre', { pseudo: partie.pseudo }) : tp('vueEtude.titreSans')}</h2>
        <p className="partagee-camps">
          <span className={`revue-coup-pierre bilan-pierre ${q.toPlay === 1 ? 'noire' : 'blanche'}`} aria-hidden="true" />
          {tp('vueEtude.trait', { camp })}
        </p>
      </header>

      <div className="partagee-mochi">
        <Mochi size={40} />
        <p>{fr(tp(n > 0 ? 'vueEtude.mochi' : 'vueEtude.mochiSans'))}</p>
      </div>

      {n > 0 && (
        <p className="partagee-compteur" aria-live="polite">
          {i === 0 ? tp('vueEtude.depart') : tp('vueEtude.compteur', { i, n })}
        </p>
      )}
      <div className="revue-plateau">
        <Board size={q.size} board={q.board} marks={{ last: q.lastMove }} numeros={numeros} />
      </div>
      {n > 0 && (
        <div className="partagee-nav">
          <button type="button" className="btn revue-pas" onClick={() => aller(i - 1)} disabled={i <= 0} aria-label={tp('vue.precedent')}><Icone nom="precedent" /></button>
          <button type="button" className="btn revue-pas" onClick={() => aller(i + 1)} disabled={i >= n} aria-label={tp('vue.suivant')}><Icone nom="suivant" /></button>
        </div>
      )}

      <div className="dock revue-dock">
        <button type="button" className="cta" onClick={onEtudier}>{tp('vueEtude.etudier')}</button>
      </div>
    </div>
  );
}
