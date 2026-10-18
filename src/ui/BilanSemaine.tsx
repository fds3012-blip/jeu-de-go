// Bilan de la semaine (issue #369) : ce que tu as fait (sur l'appareil) et, avec un compte, tes parties en ligne de la
// semaine (serveur : amis battus, cote gagnée). Deux usages :
// - `BilanSemaine` : la carte de l'accueil, au premier passage d'une nouvelle semaine, une seule fois (semaine.ts) ;
// - `StatsSemaine`, `PhrasesSemaine`, `useBilanServeur` : repris par « Ta semaine » (src/app/Semaine.tsx).
// Chargé à la demande : rien dans le JS initial.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { bilanSemaine, type BilanServeur } from '../data/emulation';
import type { Db } from '../data/supabase';
import { EVENTS, track } from '../data/analytics';
import { te } from '../content/i18n/emulation';
import { texteEcart } from '../content/i18n/cote';
import { tp } from '../content/i18n/profilPublic';
import { useOnline } from '../app/hooks';
import { noterBilanVu, type Compteur, type Semaine } from '../app/semaine';
import { Mochi } from './Mochi';
import { fr } from './typo';
import './emulation.css';

export type EtatServeur = { etat: 'sansCompte' } | { etat: 'horsLigne' } | { etat: 'chargement' } | { etat: 'erreur' } | { etat: 'pret'; bilan: BilanServeur };

/** Bilan du serveur pour la semaine en cours ou la précédente ; `db` nul : sans compte. */
export function useBilanServeur(db: Db | null, precedente: boolean): { serveur: EtatServeur; recharger: () => void } {
  const online = useOnline();
  const [etat, setEtat] = useState<EtatServeur>({ etat: 'chargement' });
  const [cle, setCle] = useState(0);
  useEffect(() => {
    if (!db || !online) return;
    let vivant = true;
    void bilanSemaine(db, precedente).then(r => { if (vivant) setEtat(r.ok ? { etat: 'pret', bilan: r.value } : { etat: 'erreur' }); });
    return () => { vivant = false; };
  }, [db, online, precedente, cle]);
  const serveur: EtatServeur = !db ? { etat: 'sansCompte' } : !online ? { etat: 'horsLigne' } : etat;
  return { serveur, recharger: () => { setEtat({ etat: 'chargement' }); setCle(c => c + 1); } };
}

const STATS: readonly Compteur[] = ['parties', 'problemes', 'goDuJour', 'lecons'];

/** Chiffres de la semaine (appareil), sans les compteurs à zéro ; au moins les parties et les problèmes. */
export function StatsSemaine({ compte }: { compte: Semaine['compte'] }) {
  const montrer = STATS.filter(k => compte[k] > 0 || k === 'parties' || k === 'problemes');
  return (
    <dl className="semaine-stats">
      {montrer.map(k => (
        <div key={k} className="semaine-stat" data-stat={k}>
          <dt>{te(`semaine.stat.${k}` as 'semaine.stat.parties', { n: compte[k] })}</dt>
          <dd>{compte[k]}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Phrases tirées du serveur : amis battus ou affrontés, cote de la semaine. Rien à dire : rien.
 * #560 : avec `onProfil`, le pseudo de l'ami se touche et ouvre « Profil de {pseudo} ».
 */
export function PhrasesSemaine({ bilan, onProfil }: { bilan: BilanServeur; onProfil?: (pseudo: string) => void }) {
  const phrases = [
    ...bilan.amis.map(a => ({ cle: `ami-${a.pseudo}`, pseudo: a.pseudo, texte: a.victoires > 0
      ? te('semaine.amis.battu', { pseudo: a.pseudo, n: a.victoires })
      : te('semaine.amis.joue', { pseudo: a.pseudo, n: a.victoires + a.defaites }), or: a.victoires > 0 })),
    ...(bilan.partiesClassees > 0 ? [{ cle: 'cote', pseudo: null, texte: te('semaine.cote', { ecart: texteEcart(bilan.coteEcart) }), or: bilan.coteEcart > 0 }] : []),
  ];
  if (!phrases.length) return null;
  const rendu = (p: { pseudo: string | null; texte: string }): ReactNode => {
    const t = fr(p.texte);
    if (!onProfil || !p.pseudo) return t;
    const i = t.indexOf(p.pseudo);
    if (i < 0) return t;
    const pseudo = p.pseudo;
    return <>{t.slice(0, i)}<button type="button" className="semaine-nom" aria-label={tp('joueur.ouvrir', { pseudo })} onClick={() => onProfil(pseudo)}>{pseudo}</button>{t.slice(i + pseudo.length)}</>;
  };
  return <ul className="semaine-phrases" data-testid="phrases-semaine">{phrases.map(p => <li key={p.cle} className={p.or ? 'or' : undefined}>{rendu(p)}</li>)}</ul>;
}

/**
 * Carte de l'accueil : la semaine qui vient de finir, une fois. Marquée vue quand elle entre vraiment à l'écran (sous
 * les tuiles, elle peut être sous le pli) : elle ne revient pas avant la semaine suivante ; « Fermer » la retire tout
 * de suite. Une action discrète : le bouton principal de l'accueil reste seul en relief.
 */
export function BilanSemaine({ semaine, db, onFermer, onProfil }: { semaine: Semaine; db: Db | null; onFermer: () => void; onProfil?: (pseudo: string) => void }) {
  const { serveur } = useBilanServeur(db, true);
  const note = useRef(false);
  const ref = useRef<HTMLElement>(null);
  const [vue, setVue] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVue(true); return; }
    // #592 : « vue » = lisible presque entière (90 %), au-dessus de la barre du bas fixe. Avec l'accueil épuré (tuiles
    // plus basses), la carte remontait à moitié au-dessus de la barre au premier affichage : marquée vue avec seulement
    // son titre lisible, elle ne revenait plus. Plus haute que la place visible (zoom 200 %), 90 % de cette place suffit.
    // #648 : la barre latérale (1024 px et plus) ne couvre pas le bas de l'écran.
    const nav = document.querySelector('nav.nav')?.getBoundingClientRect();
    const barre = nav && nav.width > nav.height ? Math.ceil(nav.height) : 0;
    const io = new IntersectionObserver(([e]) => {
      const lisible = Math.min(e?.boundingClientRect.height ?? 0, e?.rootBounds?.height ?? Infinity) * 0.9;
      if (e?.isIntersecting && e.intersectionRect.height >= lisible) { setVue(true); io.disconnect(); }
    }, { threshold: [0, 0.25, 0.5, 0.75, 0.9, 1], rootMargin: `0px 0px -${barre}px 0px` });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => { if (vue) noterBilanVu(semaine.lundi); }, [vue, semaine.lundi]);
  const amis = serveur.etat === 'pret' ? serveur.bilan.amis.length : 0;
  const pret = serveur.etat !== 'chargement';
  useEffect(() => {
    if (note.current || !pret || !vue) return;
    note.current = true;
    track(EVENTS.bilanSemaineVu, { depuis: 'accueil', parties: semaine.compte.parties, problemes: semaine.compte.problemes, go_du_jour: semaine.compte.goDuJour, amis });
  }, [pret, vue, amis, semaine]);
  return (
    <section ref={ref} className="bilan-semaine" aria-labelledby="bilan-semaine-titre" data-testid="bilan-semaine">
      <div className="bilan-semaine-tete">
        <Mochi size={30} />
        <h2 id="bilan-semaine-titre">{te('bilan.titre')}</h2>
        <button type="button" className="lien" aria-label={te('bilan.fermerAria')} onClick={() => { noterBilanVu(semaine.lundi); onFermer(); }}>{te('bilan.fermer')}</button>
      </div>
      <p>{fr(te('bilan.mochi'))}</p>
      <StatsSemaine compte={semaine.compte} />
      {serveur.etat === 'pret' && <PhrasesSemaine bilan={serveur.bilan} onProfil={onProfil} />}
      <p className="muted small">{te('bilan.objectifs', { n: semaine.atteints.length })}</p>
    </section>
  );
}
