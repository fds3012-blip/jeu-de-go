// Types du socle i18n (issue #167).
import type { fr } from './fr';

export type Langue = 'fr' | 'en';
export type Cle = keyof typeof fr;
/** Formes plurielles (catégories CLDR) ; `other` est obligatoire, c'est le repli. */
export type Pluriel = { other: string } & Partial<Record<'zero' | 'one' | 'two' | 'few' | 'many', string>>;
export type Texte = string | Pluriel;
/** Un catalogue couvre exactement les clés du français (clé manquante ou en trop : erreur de typage). */
export type Catalogue = { readonly [K in Cle]: Texte };

type Chaine<T> = T extends string ? T : T extends Record<string, string> ? T[keyof T] : never;
type Vars<S> = S extends `${string}{${infer V}}${infer R}` ? V | Vars<R> : never;
/** Variables attendues par une clé, lues dans le texte français. */
export type VarsDe<K extends Cle> = Vars<Chaine<(typeof fr)[K]>>;
export type Params<K extends Cle> = [VarsDe<K>] extends [never] ? [] : [Record<VarsDe<K>, string | number>];
