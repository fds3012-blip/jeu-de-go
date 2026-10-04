// Types du socle i18n (issue #167).
import type { fr } from './fr';
import type { frEcrans } from './frEcrans';

export type Langue = 'fr' | 'en';
/** Tous les textes français : catalogue de l'accueil (fr.ts) et des écrans secondaires (frEcrans.ts, #433). */
type Francais = typeof fr & typeof frEcrans;
/** Clés du catalogue de l'accueil (fr.ts, JS initial) : les seules que connaît `t` de src/content/i18n. */
export type Cle = keyof typeof fr;
/** Toutes les clés, écrans secondaires compris (#433) : `t` de src/content/i18n/secondaires. */
export type CleTout = keyof Francais;
/** Formes plurielles (catégories CLDR) ; `other` est obligatoire, c'est le repli. */
export type Pluriel = { other: string } & Partial<Record<'zero' | 'one' | 'two' | 'few' | 'many', string>>;
export type Texte = string | Pluriel;
/** Un catalogue couvre exactement les clés du français (clé manquante ou en trop : erreur de typage). */
export type Catalogue = { readonly [K in CleTout]: Texte };

type Chaine<T> = T extends string ? T : T extends Record<string, string> ? T[keyof T] : never;
type Vars<S> = S extends `${string}{${infer V}}${infer R}` ? V | Vars<R> : never;
/** Variables attendues par une clé, lues dans le texte français ; un pluriel attend toujours `n`, même s'il ne l'affiche pas. */
export type VarsDe<K extends CleTout> = Vars<Chaine<Francais[K]>> | (Francais[K] extends string ? never : 'n');
export type Params<K extends CleTout> = [VarsDe<K>] extends [never] ? [] : [Record<VarsDe<K>, string | number>];
