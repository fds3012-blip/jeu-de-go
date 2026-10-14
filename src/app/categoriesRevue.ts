// Revue en 3 catégories pour les débutants (#527, décision de Florian ; constat n° 14 de la passe design #509).
//
// Jusqu'à 15 kyu inclus (estimation interne, jamais affichée : décision #137), le bilan de la revue montre 3 catégories
// au lieu des notes détaillées : « Bon coup », « Coup imprécis », « Erreur ». Au-delà (14 kyu et plus fort), les notes
// détaillées restent (Brillant à Gaffe). Le niveau vient de la cote des problèmes (coteJoueur.ts), convertie en kyu
// par la table du placement (placement.ts, kyuDeCote) : sans cote gardée, c'est un débutant (25 kyu).
//
// Regroupement des notes (revue.ts, notation.ts) ; chaque note reste juste dans sa catégorie :
// - Bon coup : Brillant, Meilleur, Excellent, Bon, Classique, Solide, Forcé. Ces notes ne se donnent qu'à un coup qui
//   perd peu de points, ou aucun (au plus le seuil « Bon » de KataGo, ou « Solide » du moteur simple ; Classique et
//   Forcé sous le même seuil, notation.ts).
// - Coup imprécis : Imprécision (quelques points perdus).
// - Erreur : Erreur et Gaffe (beaucoup de points perdus).
// - Coup manqué (l'adversaire venait de se tromper et tu ne l'as pas puni) : il vient d'une Imprécision ou d'une Erreur
//   (notation.ts, classerCoups). On le range d'après sa perte : au-delà du seuil d'Imprécision de KataGo, Erreur ;
//   sinon, Coup imprécis. Le Coup manqué n'existe qu'avec KataGo.
import type { Color } from '../go/rules';
import { t } from '../content/i18n/secondaires';
import { COTE_KEY, nettoyerCote } from './coteJoueur';
import { kyuDeCote } from './placement';
import { NOTE_INFO, seuilsKataGo, type Note, type NoteCoup } from './revue';

export type Categorie = 'bon' | 'imprecis' | 'erreur';
export const CATEGORIES: readonly Categorie[] = ['bon', 'imprecis', 'erreur'];

/** Plus faible niveau qui voit les notes détaillées : 14 kyu. Jusqu'à 15 kyu inclus, 3 catégories. */
export const KYU_CATEGORIES = 15;

/** Vrai si le joueur voit la revue en 3 catégories (jusqu'à 15 kyu inclus). `cote` : cote interne des problèmes. */
export function revueSimple(cote: number): boolean {
  return kyuDeCote(cote) >= KYU_CATEGORIES;
}

/** Même question, pour le joueur de cet appareil (cote gardée sous COTE_KEY ; absente ou abîmée : débutant). */
export function revueSimpleAppareil(): boolean {
  let brut: unknown;
  try { brut = JSON.parse(localStorage.getItem(COTE_KEY) ?? 'null'); } catch { brut = null; }
  return revueSimple(nettoyerCote(brut).cote);
}

/** Notes rangées d'office dans chaque catégorie (le Coup manqué se range d'après sa perte, voir `categorieDe`). */
export const NOTES_DE: Record<Categorie, readonly Note[]> = {
  bon: ['brillant', 'meilleur', 'excellent', 'bon', 'classique', 'solide', 'force'],
  imprecis: ['imprecision'],
  erreur: ['erreur', 'grosse'],
};

/** Catégorie d'un coup noté. `size` : côté du plateau (les seuils de perte en dépendent). */
export function categorieDe(n: Pick<NoteCoup, 'note' | 'perte'>, size: number): Categorie {
  if (n.note === 'manque') return n.perte > seuilsKataGo(size).imprecision ? 'erreur' : 'imprecis';
  return CATEGORIES.find(c => NOTES_DE[c].includes(n.note)) ?? 'bon';
}

/** Note dont le sceau (couleur et symbole) représente la catégorie : ✓ vert, ?! or, ? orange. */
export const SCEAU_CATEGORIE: Record<Categorie, Note> = { bon: 'bon', imprecis: 'imprecision', erreur: 'erreur' };

/** Nombre de coups de `couleur` par catégorie. */
export function compteCategories(notes: readonly (NoteCoup | null)[], couleur: Color, size: number): Record<Categorie, number> {
  const c: Record<Categorie, number> = { bon: 0, imprecis: 0, erreur: 0 };
  for (const n of notes) if (n && n.couleur === couleur) c[categorieDe(n, size)]++;
  return c;
}

/**
 * Ce que montre un coup noté : le sceau (une note, pour sa couleur et son symbole) et son libellé. En revue simple, la
 * catégorie ; sinon, la note détaillée.
 */
export function affichageNote(n: Pick<NoteCoup, 'note' | 'perte'>, size: number, simple: boolean): { sceau: Note; libelle: string } {
  if (!simple) return { sceau: n.note, libelle: NOTE_INFO[n.note].libelle };
  const c = categorieDe(n, size);
  return { sceau: SCEAU_CATEGORIE[c], libelle: t(`categorie.${c}`) };
}
