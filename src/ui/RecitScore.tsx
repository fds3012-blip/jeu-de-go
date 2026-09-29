// Récit du score (issue #78), juste avant l'écran de fin : sur le goban final, les territoires se posent un à un,
// puis les prisonniers rejoignent leur camp (un jeton monte dans le compteur), puis le komi, puis le résultat.
// Chaque temps écrit son propre total. 2,5 s ; un toucher saute au résultat (l'écran de fin).
// Même fond que FinPartie (plateau sous un voile) : quand le récit cède la place, seul le bas de l'écran change.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { campsRecit, DUREE_RECIT, etatRecit, jetonsEtape, ligneDeuxieme, ligneKomi, ligneResultat, ligneTerritoire, PAUSE_LECTURE, type Recit } from '../app/score';
import { fr } from './typo';
import { nombre as virgule, t as tr } from '../content/i18n';
import './fin.css';

interface Props {
  /** Plateau final ; ses carrés de territoire portent leur délai (marks.ownerDelai) quand le récit est animé. */
  fond: ReactNode;
  recit: Recit;
  /** Mouvements réduits ou Célébrations coupées : tout s'affiche d'emblée. */
  immediat: boolean;
  /** Première fois qu'on compte : on explique le territoire et le mot « komi ». */
  expliquerKomi: boolean;
  /** Contre l'ordi : son nom (« Pomme »). Les camps deviennent « Toi » et lui ; sans, Noir et Blanc (partie à deux). */
  adversaire?: string;
  /** Fin du récit (après la pause de lecture) ou toucher : place à l'écran de fin. */
  onFini: () => void;
}

export function RecitScore({ fond, recit, immediat, expliquerKomi, adversaire, onFini }: Props) {
  const camps = campsRecit(adversaire);
  const [t, setT] = useState(immediat ? DUREE_RECIT : 0);
  const fini = useRef(onFini);
  useEffect(() => { fini.current = onFini; });

  // Une horloge : l'étape et les compteurs se déduisent du temps écoulé (etatRecit), jamais d'un état à part.
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    if (!immediat) {
      const pas = (now: number) => {
        const e = now - t0;
        setT(Math.min(e, DUREE_RECIT));
        if (e < DUREE_RECIT) raf = requestAnimationFrame(pas);
      };
      raf = requestAnimationFrame(pas);
    }
    const fin = window.setTimeout(() => fini.current(), DUREE_RECIT + PAUSE_LECTURE);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(fin); };
  }, [immediat]);

  const e = etatRecit(recit, t);
  const vu = (n: number) => (e.etape >= n ? 'recit-etape vu' : 'recit-etape');
  const gagnant = e.etape >= 4 ? recit.gagnant : 0;
  // Jetons : ce que le temps en cours ajoute à chaque camp ; ils montent dans le chiffre (fin.css). Rien d'emblée.
  const jetons = immediat ? { noir: 0, blanc: 0 } : jetonsEtape(recit, e.etape);
  const pierreJeton = (camp: 1 | 2) => (recit.deuxieme.type === 'prisonniers' ? (camp === 1 ? 'w' : 'b') : (camp === 1 ? 'b' : 'w'));
  const camp = (c: 1 | 2, nom: string, valeur: number, jeton: number) => (
    <span className={gagnant === c ? 'camp gagnant' : 'camp'}>
      <span className="camp-nom"><span className={`recit-pierre ${c === 1 ? 'b' : 'w'}`} />{nom}</span>
      <b key={jeton ? `recoit-${e.etape}` : 'b'} className={jeton ? 'recoit' : undefined} data-testid={c === 1 ? 'recit-noir' : 'recit-blanc'}>{virgule(valeur)}</b>
      {jeton !== 0 && (
        <span key={`jeton-${e.etape}`} className="recit-jeton">
          {e.etape === 2 && <span className={`recit-pierre ${pierreJeton(c)}`} />}
          {jeton < 0 ? '−' : '+'}{'\u202f'}{virgule(Math.abs(jeton))}
        </span>
      )}
    </span>
  );

  return (
    <section className={`fin recit${immediat ? ' immediat' : ''}`} aria-label={tr('partie.comptageAria')} onPointerUp={() => fini.current()}>
      <div className="fin-fond">
        {fond}
        <div className="fin-voile" aria-hidden="true" />
      </div>
      <div className="recit-feuille">
        <div className="recit-bloc">
          <div className="recit-compteur" aria-hidden="true">
            {camp(1, camps.noir, e.noir, jetons.noir)}
            <span className="recit-point">·</span>
            {camp(2, camps.blanc, e.blanc, jetons.blanc)}
          </div>
          <p className="sr-only">{fr(tr('recit.score', { noir: camps.noir, pn: virgule(recit.noir), blanc: camps.blanc, pb: virgule(recit.blanc) }))}</p>
          <ol className="recit-etapes">
            <li className={vu(1)}>
              {fr(ligneTerritoire(recit, camps))}
              {expliquerKomi && recit.territoire.length > 0 && <span className="recit-explication">{fr(tr('recit.territoires'))}</span>}
            </li>
            <li className={vu(2)}>{fr(ligneDeuxieme(recit, camps))}</li>
            <li className={vu(3)}>
              {fr(ligneKomi(recit.komi, camps))}
              {expliquerKomi && recit.komi !== 0 && <span className="recit-explication">{fr(tr('recit.explicationKomi'))}</span>}
            </li>
            <li className={`${vu(4)} recit-resultat`}>{fr(ligneResultat(recit, camps))}</li>
          </ol>
        </div>
        <button type="button" className="cta recit-continuer" onClick={() => fini.current()}>{tr('recit.continuer')}</button>
      </div>
    </section>
  );
}
