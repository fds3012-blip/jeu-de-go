// Série d'entraînement de fin de leçon (issue #200) : 3 problèmes du thème de la leçon, enchaînés dans le lecteur
// de problèmes existant (PuzzlePlayer de Puzzles.tsx). Réussites, « Vu » et XP comme dans l'onglet Problèmes ;
// la cote n'est pas en jeu (comme pour « Mes erreurs »). À la fin, retour au chemin des leçons.
import { useState } from 'react';
import type { Puzzle } from '../data/puzzles';
import { EVENTS, track } from '../data/analytics';
import { PuzzlePlayer, SOLVED_KEY, VUS_KEY } from './Puzzles';
import { readLocal, writeLocal } from './hooks';
import { recompense } from './aide';
import { gagnerXp } from './xp';
import { noterRediteAppareil } from './rediteAppareil';
import { t } from '../content/i18n';

function noter(cle: string, id: string) {
  writeLocal(cle, { ...readLocal<Record<string, true>>(cle, {}), [id]: true });
}

export function SeriePratique({ problemes, confirmTouch, onFin }: { problemes: Puzzle[]; confirmTouch: boolean; onFin: () => void }) {
  const [i, setI] = useState(0);
  // #250 (M9) : le dernier problème réussi, la série est finie. Une fête de niveau prise pendant la série se pose ici,
  // sur la feuille de réussite, et non sur le titre du chemin après « Retour au chemin ».
  const [finie, setFinie] = useState(false);
  const pz = problemes[i];
  if (!pz) return null;
  const suivant = i + 1 < problemes.length ? () => { setI(i + 1); window.scrollTo({ top: 0 }); } : undefined;
  return (
    <div className="serie-pratique" data-serie={problemes.map(p => p.id).join(' ')} data-rang={i + 1}>
      <PuzzlePlayer key={pz.id} puzzle={pz} rang={i + 1} confirmTouch={confirmTouch}
        surtitre={t('serie.pratique', { n: i + 1, total: problemes.length })} retour={t('lecon.retourChemin')}
        rated={false} onAttempt={async () => null}
        onSolved={(_essais, aide) => {
          const gain = recompense(aide, false);
          const deja = !!readLocal<Record<string, true>>(SOLVED_KEY, {})[pz.id];
          if (gain.xp && !deja) { track(EVENTS.problemeResolu, { probleme: pz.id, du_jour: false }); gagnerXp('probleme'); }
          noter(gain.palier ? SOLVED_KEY : VUS_KEY, pz.id);
          // #237 : déjà vu en leçon puis en pratique, il ne revient pas dès demain en révision.
          noterRediteAppareil(pz.id);
          if (i + 1 === problemes.length) setFinie(true);
        }}
        exercice={!finie}
        onNext={suivant}
        onExit={onFin} />
    </div>
  );
}
