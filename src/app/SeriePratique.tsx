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
import { lireFile, retirerFete } from '../ui/celebrations';
import { niveauEnAttente } from '../ui/fileFetes';
import { NiveauAtteint } from '../ui/Niveau';

function noter(cle: string, id: string) {
  writeLocal(cle, { ...readLocal<Record<string, true>>(cle, {}), [id]: true });
}

export function SeriePratique({ problemes, confirmTouch, celebrer = true, onFin }: { problemes: Puzzle[]; confirmTouch: boolean; celebrer?: boolean; onFin: () => void }) {
  const [i, setI] = useState(0);
  // #236 (N2), suite de #250 (M9) : une fête à la fois. Tant que la feuille « Bravo » est là, le problème reste un
  // exercice (l'XP se lit dans la feuille, rien d'autre ne se pose sur la consigne). Un niveau franchi pendant la
  // série a ensuite son écran à lui, entre la feuille et le chemin ; il ne passe plus par la carte du haut.
  const [niveau, setNiveau] = useState<number | null>(null);
  const pz = problemes[i];
  if (!pz) return null;
  if (niveau !== null) {
    return <NiveauAtteint niveau={niveau} celebrer={celebrer} action={t('lecon.retourChemin')} onAction={onFin} />;
  }
  const quitter = () => {
    const n = niveauEnAttente(lireFile());
    if (n === null) { onFin(); return; }
    retirerFete('niveau');
    setNiveau(n);
  };
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
        }}
        onNext={suivant}
        onExit={quitter} />
    </div>
  );
}
