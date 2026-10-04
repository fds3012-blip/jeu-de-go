// Textes des écrans secondaires (#433) : même `t` que src/content/i18n, avec en plus les clés de frEcrans.ts.
//
// L'accueil n'a besoin que du catalogue fr.ts ; le reste (partie, revue, leçons, problèmes, Profil, compte, aide…)
// sort du JS initial. Un module qui affiche un texte d'écran secondaire importe `t` d'ici : l'import ajoute les
// textes au catalogue avant que le module ne s'exécute, et Rollup les range avec le premier écran qui en a besoin.
// Le typage l'impose : `t` de src/content/i18n refuse une clé de frEcrans.ts.
//
// Si un module du JS initial importe ce fichier, frEcrans.ts rentre dans le JS initial : le budget
// (scripts/budget-bundle.mjs) le signale.
import { frEcrans } from './frEcrans';
import { ajouterTextes, langue, traduireTout } from './index';
import type { CleTout, Langue, Params } from './types';

ajouterTextes(frEcrans);

export * from './index';
/** Toutes les clés, accueil et écrans secondaires. */
export type Cle = CleTout;

/** Texte de `cle` dans une langue donnée (tests, comparaisons). */
export function traduire<K extends CleTout>(l: Langue, cle: K, ...params: Params<K>): string {
  return traduireTout(l, cle, ...params);
}

/** Texte de `cle` dans la langue de l'interface. */
export function t<K extends CleTout>(cle: K, ...params: Params<K>): string {
  return traduireTout(langue(), cle, ...params);
}
