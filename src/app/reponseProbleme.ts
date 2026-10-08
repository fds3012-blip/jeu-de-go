// #497 : un problème classique dont on a vu la réponse dit pourquoi c'est la réponse, au lieu de « Rejoue-la pour la
// retenir ». Logique pure, testée dans reponseProbleme.test.ts.
// 1. Le texte de solution du problème, quand il existe (presque tous les lots en ont un, relu et vérifié avec la
//    position) : son exclamation d'ouverture (« Bravo ! », « Well done! ») est retirée, puisque le joueur ne l'a pas trouvé.
// 2. Sinon, un fait tactique calculé par les règles sur la position (src/app/pourquoi.ts, motifSeul).
// 3. Sinon, la réponse seule. Aucune explication n'est inventée.
import type { Puzzle } from '../data/puzzles';
import { startOf } from '../data/puzzles';
import { toLabel } from '../go/coords';
import { t } from '../content/i18n/secondaires';
import { motifSeul, phraseMotifSeul } from './pourquoi';

/** Exclamations d'ouverture des textes de solution (français et anglais), qui félicitent le joueur. */
const OUVERTURE = /^\s*(bravo|superbe|exact|bien joué|bien vu|parfait|excellent|magnifique|très bien|oui|c['’]est ça|well done|superb|correct|nice move|well spotted|perfect|magnificent|yes|very good|that['’]s it)\s*!\s*/i;

/** Le texte de solution sans son exclamation d'ouverture ; `null` s'il ne reste rien. */
export function sansFelicitations(texte: string | null | undefined): string | null {
  if (!texte) return null;
  const reste = texte.replace(OUVERTURE, '').trim();
  return reste ? reste.charAt(0).toUpperCase() + reste.slice(1) : null;
}

/** Ce que dit la feuille quand la réponse d'un problème classique a été montrée. */
export function texteReponseVue(pz: Puzzle): string {
  const bon = pz.line[0] ?? pz.answers[0], debut = t(pz.answers.length > 1 ? 'pb.reponseVueParmi' : 'pb.reponseVue', { point: toLabel(bon, pz.size) });
  const texte = sansFelicitations(pz.explanation);
  if (texte) return `${debut} ${texte}`;
  const avant = startOf(pz).pos, m = motifSeul(avant, bon);
  return m ? `${debut} ${phraseMotifSeul(m, avant, bon)}` : debut;
}
