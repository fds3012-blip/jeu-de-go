// « Tu connais le go ? » (#523) : la question du tout premier lancement, et où mène chaque réponse.
//
// Posée sur l'accueil épuré (#487 : tout premier lancement, aucune pierre posée, voir src/app/premierePierre.ts), tant
// qu'elle n'a pas de réponse. Trois réponses de même poids :
// - « Jamais joué » → l'introduction interactive des règles (8 écrans, src/app/IntroRegles.tsx), puis la partie de
//   découverte avec Mochi ;
// - « Un peu » → le rappel express (les mêmes écrans, chacun passable d'un toucher « Je sais »), puis le choix entre la
//   partie de découverte et une partie contre Pomme ;
// - « Je sais jouer » → le parcours d'avant : l'accueil épuré, son bouton et « Je sais déjà jouer » (placement).
// « Plus tard » (et rien d'autre) referme la question pour cette session : elle revient à la prochaine ouverture, tant
// qu'aucune pierre n'est posée. Rien n'est écrit sur l'appareil pour « Plus tard ».
//
// La réponse est gardée sur l'appareil (`go.connait-go.v1`, politique de confidentialité, section 3.1). Elle n'est pas
// dans les réglages synchronisés (#448) : leur liste blanche est dans une fonction du serveur, qu'il faudrait changer par
// une migration, pour une question posée avant tout compte.

/** Réponse gardée sur l'appareil : `jamais`, `un_peu` ou `sait`. Aucune autre donnée. */
export const CONNAIT_GO_KEY = 'go.connait-go.v1';

export type ReponseGo = 'jamais' | 'un_peu' | 'sait';
/** Ce que le joueur a touché, « Plus tard » compris (mesuré par `connait_go`). */
export type ChoixGo = ReponseGo | 'plus_tard';

export const REPONSES: readonly ReponseGo[] = ['jamais', 'un_peu', 'sait'];

/** Version de l'introduction : complète (« Jamais joué », « Revoir les règles ») ou express (« Un peu »). */
export type VersionIntro = 'complete' | 'express';
/** D'où l'introduction est ouverte. */
export type DepuisIntro = 'accueil' | 'apprendre' | 'aide';

/** Réponse lue sur l'appareil ; toute autre valeur (absente, abîmée) vaut « pas de réponse ». */
export function lireReponse(brut: unknown): ReponseGo | null {
  return typeof brut === 'string' && (REPONSES as readonly string[]).includes(brut) ? (brut as ReponseGo) : null;
}

/** La question se pose sur l'accueil épuré seulement, sans réponse gardée, et pas après « Plus tard » dans la session. */
export function doitDemander(o: { epure: boolean; reponse: ReponseGo | null; plusTard: boolean }): boolean {
  return o.epure && o.reponse === null && !o.plusTard;
}

/** Où mène une réponse : l'introduction (complète ou express), ou l'accueil épuré tel qu'avant. */
export function suiteDe(r: ReponseGo): { ecran: 'intro'; version: VersionIntro } | { ecran: 'accueil' } {
  if (r === 'jamais') return { ecran: 'intro', version: 'complete' };
  if (r === 'un_peu') return { ecran: 'intro', version: 'express' };
  return { ecran: 'accueil' };
}

/** D'où la partie de découverte (#524) est ouverte : le chemin (Apprendre, modes de l'accueil) ou la fin de l'introduction. */
export type OrigineDecouverte = 'chemin' | 'intro';
