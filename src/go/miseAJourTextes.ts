// Issue #282 : lecture de la migration de mise à jour des textes de problèmes (20260928233100_textes_problemes.sql).
// Sert aux tests « migration identique au fichier » : l'insertion d'un lot porte le texte d'avant la correction,
// le fichier de contenu porte celui d'après. `avantMiseAJour` refait le texte d'avant à partir du fichier
// et de la migration, pour comparer l'insertion octet par octet comme avant.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PuzzleRow } from '../data/puzzles';

export const FICHIER_MISE_A_JOUR = resolve(__dirname, '../../supabase/migrations/20260928233100_textes_problemes.sql');

export type ChampTexte = 'title' | 'prompt' | 'explanation' | 'refutation';
export interface ModifTexte { id: string; champ: ChampTexte; avant: string; apres: string }

const LIT = String.raw`'((?:[^']|'')*)'`;
const COLONNE = new RegExp(String.raw`update public\.puzzles set (title|prompt|explanation) = ${LIT}\s+where id = '([a-z0-9]+)' and (title|prompt|explanation) = ${LIT};`, 'g');
const REFUTATION = new RegExp(String.raw`update public\.puzzles set setup = jsonb_set\(setup, '\{refutation\}', to_jsonb\(${LIT}::text\)\)\s+where id = '([a-z0-9]+)' and setup->>'refutation' = ${LIT};`, 'g');
const deq = (s: string) => s.replace(/''/g, "'");

/** Les modifications de la migration, dans l'ordre. Lève une erreur si la migration contient autre chose. */
export function lireMiseAJourTextes(sql = readFileSync(FICHIER_MISE_A_JOUR, 'utf8')): ModifTexte[] {
  const code = sql.split('\n').filter(l => !l.trimStart().startsWith('--')).join('\n');
  const trouvees: { pos: number; modif: ModifTexte }[] = [];
  for (const m of code.matchAll(COLONNE)) {
    if (m[1] !== m[4]) throw new Error(`${m[3]} : la condition porte sur ${m[4]}, la mise à jour sur ${m[1]}`);
    trouvees.push({ pos: m.index, modif: { id: m[3], champ: m[1] as ChampTexte, apres: deq(m[2]), avant: deq(m[5]) } });
  }
  for (const m of code.matchAll(REFUTATION))
    trouvees.push({ pos: m.index, modif: { id: m[2], champ: 'refutation', apres: deq(m[1]), avant: deq(m[3]) } });
  const reste = code.replace(COLONNE, '').replace(REFUTATION, '').trim();
  if (reste) throw new Error(`instruction non reconnue dans la migration : ${reste.slice(0, 80)}`);
  return trouvees.sort((a, b) => a.pos - b.pos).map(t => t.modif);
}

const texte = (row: PuzzleRow, champ: ChampTexte): string | null | undefined =>
  champ === 'refutation' ? (row.setup as Record<string, unknown>).refutation as string | undefined : row[champ];

/**
 * Le problème tel que l'insertion du lot l'a écrit : chaque texte corrigé par la migration reprend sa valeur d'avant.
 * Vérifie au passage que le fichier porte exactement le texte d'après.
 */
export function avantMiseAJour<T extends PuzzleRow>(row: T, modifs: ModifTexte[] = lireMiseAJourTextes()): T {
  let r: T = { ...row, setup: { ...(row.setup as Record<string, unknown>) } };
  for (const m of modifs.filter(x => x.id === row.id).reverse()) {
    const actuel = texte(r, m.champ);
    if (actuel !== m.apres) throw new Error(`${row.id} ${m.champ} : le fichier ne porte pas le texte de la migration`);
    r = m.champ === 'refutation'
      ? { ...r, setup: { ...(r.setup as Record<string, unknown>), refutation: m.avant } }
      : { ...r, [m.champ]: m.avant };
  }
  return r;
}

/**
 * Empreinte des textes d'un problème, identique à la requête de vérification de la migration :
 * md5(concat_ws('|', title, prompt, explanation, setup->>'refutation')).
 */
export function empreinteTextes(row: PuzzleRow): string {
  const parts = [row.title, row.prompt, row.explanation, texte(row, 'refutation')].filter((p): p is string => p != null);
  return createHash('md5').update(parts.join('|'), 'utf8').digest('hex');
}
