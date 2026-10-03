// Revue v3 (#405) : ce que dit Mochi pendant le bilan. Logique pure, testée dans parcours.test.ts.
import { toLabel } from '../go/coords';
import type { Color, Position } from '../go/rules';
import { nombre, t } from '../content/i18n';
import type { CoupNote } from './notation';

const pts = (n: number) => t('revue.points', { n: Math.max(1, Math.round(n)) });

/** Bulle de Mochi sur un coup : un titre (« E5 est une erreur ») et une ou deux phrases courtes. */
export interface Commentaire { titre: string; detail: string }

/**
 * Commentaire d'un coup noté. `toi` : le coup est celui du joueur (contre l'ordi) ; `nom` : l'autre camp
 * (l'ordi quand c'est son coup, sinon l'adversaire du joueur). `prisesApres` et la pierre verte viennent de la note.
 */
export function commentaire(n: CoupNote, positions: Position[], o: { toi: boolean; nom: string }): Commentaire {
  const avant = positions[n.coup - 1], apres = positions[n.coup], size = avant.size, m = apres.lastMove ?? -1;
  const lieu = m < 0 ? t('parcours.passer') : toLabel(m, size);
  const point = n.meilleur != null && n.meilleur >= 0 ? toLabel(n.meilleur, size) : null;
  const titre = n.passeTot ? t('parcours.titre.passeTot') : t(`parcours.titre.${n.note}`, { lieu });
  const perte = o.toi ? t('detail.perteToi', { pts: pts(n.perte) }) : t('detail.perteLui', { nom: o.nom, pts: pts(n.perte) });
  const mieux = point ? ` ${t('detail.mieux', { point })}` : '';
  const phrases: string[] = [];
  if (n.passeTot) phrases.push(`${t('detail.passeTot')} ${perte}${mieux}`);
  else switch (n.note) {
    case 'brillant': case 'classique': case 'force':
      phrases.push(n.raison ? t(`raison.${n.raison}` as 'raison.coin33') : t(`note.phrase.${n.note}` as 'note.phrase.classique'));
      break;
    case 'meilleur': phrases.push(t('detail.meilleur')); break;
    case 'excellent': phrases.push(t('detail.excellent')); break;
    case 'bon': phrases.push(t('detail.bon', { pts: n.perte < 1 ? t('revue.unPoint') : pts(n.perte) })); break;
    case 'solide': phrases.push(t('detail.solide')); break;
    case 'imprecision': case 'erreur':
      phrases.push(`${perte}${mieux}`);
      break;
    case 'manque':
      phrases.push(o.toi ? t('detail.manqueToi', { nom: o.nom }) : t('detail.manqueLui', { nom: o.nom }));
      phrases.push(o.toi && point && n.prisesManquees ? t('detail.prisesManquees', { n: n.prisesManquees, point }) : `${perte}${mieux}`);
      break;
    case 'grosse':
      if (!o.toi) { phrases.push(`${perte} ${t('detail.gaffeLui', { nom: o.nom })}`); break; }
      phrases.push(perte);
      if (n.prisesApres) phrases.push(t('detail.groupePris', { n: n.prisesApres, nom: o.nom }));
      if (point) phrases.push(t('detail.mieux', { point }));
      break;
  }
  return { titre, detail: phrases.join(' ') };
}

/**
 * Avance après un coup, vue du joueur `moi` (Noir si partie à deux) : « +4,5 » ou « −2 », arrondie au demi-point.
 * `avanceNoir` : avance de Noir, komi compris. `null` si inconnue.
 */
export function avanceVue(avanceNoir: number | null | undefined, moi: Color): { texte: string; valeur: number } | null {
  if (avanceNoir == null || !Number.isFinite(avanceNoir)) return null;
  const v = Math.round((moi === 1 ? avanceNoir : -avanceNoir) * 2) / 2;
  const abs = nombre(Math.abs(v));
  return { texte: v > 0 ? `+${abs}` : v < 0 ? `−${abs}` : '0', valeur: v };
}

/** Nombre de proverbes du catalogue (`proverbe.1` à `proverbe.8`). */
export const NB_PROVERBES = 8;

/** Proverbe montré pendant l'analyse : tiré de la partie (même partie, même proverbe), pour qu'il ne change pas en cours de route. */
export function proverbePour(sgf: string): { texte: string; source: string } {
  let h = 0;
  for (let i = 0; i < sgf.length; i++) h = (h * 31 + sgf.charCodeAt(i)) >>> 0;
  const k = (h % NB_PROVERBES) + 1;
  return { texte: t(`proverbe.${k}` as 'proverbe.1'), source: t(`proverbe.${k}.source` as 'proverbe.1.source') };
}

/** Prochain coup clé après le coup `i` (ou `null` s'il n'y en a plus). */
export function cleSuivante(cles: number[], i: number): number | null {
  for (const c of cles) if (c > i) return c;
  return null;
}
