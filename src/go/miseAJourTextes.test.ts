// Issue #282 : la migration de mise à jour des textes donne exactement les textes des fichiers de contenu.
// Preuve : chaque update part du texte inséré par la migration du lot (octet par octet) et arrive au texte du fichier ;
// positions, réponses, difficulté inchangées ; mêmes coordonnées avant et après ; empreintes md5 de vérification justes.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_PUZZLES } from '../content/puzzles';
import type { PuzzleRow } from '../data/puzzles';
import { avantMiseAJour, empreinteTextes, FICHIER_MISE_A_JOUR, lireMiseAJourTextes, type ModifTexte } from './miseAJourTextes';

const DOSSIER = resolve(__dirname, '../../supabase/migrations');
const sql = readFileSync(FICHIER_MISE_A_JOUR, 'utf8');
const modifs = lireMiseAJourTextes(sql);
const IDS = ['n03', 'n13', 'n14', 'c4', 'd05', 'd10', 'd12', 'k01', 'q03', 'r04'];
const fichier = (id: string) => {
  const r = ALL_PUZZLES.find(p => p.id === id);
  if (!r) throw new Error(`${id} absent des fichiers de contenu`);
  return r;
};
const q = (s: string) => s.replace(/'/g, "''");
const tuple = (row: PuzzleRow) =>
  `('${row.id}', null, ${row.size}, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`;
const insertions = readdirSync(DOSSIER).filter(f => f.endsWith('.sql') && f < '20260928233100')
  .map(f => readFileSync(resolve(DOSSIER, f), 'utf8'));
const texte = (row: PuzzleRow, m: ModifTexte) =>
  m.champ === 'refutation' ? (row.setup as Record<string, unknown>).refutation : row[m.champ];
/** Ce que fait la migration sur une ligne : chaque update ne s'applique que si le texte en base est l'ancien. */
const appliquer = (row: PuzzleRow): PuzzleRow => modifs.filter(m => m.id === row.id).reduce<PuzzleRow>((r, m) => {
  if (texte(r, m) !== m.avant) return r;
  return m.champ === 'refutation'
    ? { ...r, setup: { ...(r.setup as Record<string, unknown>), refutation: m.apres } }
    : { ...r, [m.champ]: m.apres };
}, avantMiseAJour(row, modifs));
const coords = (s: string) => (s.match(/\b[A-HJ-T](?:1[0-9]|[1-9])\b/g) ?? []).sort();

describe('migration 20260928233100_textes_problemes (issue #282)', () => {
  it('ne contient que des mises à jour de textes, ligne par ligne, jamais de suppression', () => {
    const code = sql.split('\n').filter(l => !l.trimStart().startsWith('--')).join('\n');
    expect(code).not.toMatch(/\b(delete|insert|drop|truncate|alter|create|grant|revoke)\b/i);
    expect(code).not.toMatch(/\b(rows|toPlay|answers|difficulty|size|owner_id)\b/);
    expect(code.match(/\bupdate\b/gi)).toHaveLength(modifs.length);
    expect(code.match(/where id = '/g)).toHaveLength(modifs.length);
    expect(new Set(modifs.map(m => `${m.id} ${m.champ}`)).size).toBe(modifs.length);
  });

  it('corrige exactement les problèmes relevés, sans rien changer d’autre', () => {
    expect([...new Set(modifs.map(m => m.id))].sort()).toEqual([...IDS].sort());
    for (const m of modifs) {
      expect(m.apres, `${m.id} ${m.champ}`).not.toBe(m.avant);
      expect(coords(m.apres), `${m.id} ${m.champ} : mêmes coordonnées`).toEqual(coords(m.avant));
    }
  });

  it('part du texte inséré par la migration du lot, octet par octet', () => {
    for (const id of IDS) {
      const avant = tuple(avantMiseAJour(fichier(id), modifs));
      expect(insertions.filter(s => s.includes(avant)), `${id} : insertion d'origine`).toHaveLength(1);
    }
  });

  it('arrive exactement au texte des fichiers de contenu (positions et réponses comprises)', () => {
    for (const id of IDS) {
      const r = fichier(id);
      for (const m of modifs.filter(x => x.id === id)) expect(texte(r, m), `${id} ${m.champ}`).toBe(m.apres);
      expect(appliquer(r), id).toEqual(r);
      expect(JSON.stringify(appliquer(r).setup), `${id} : ordre des clés de setup`).toBe(JSON.stringify(r.setup));
    }
  });

  it('donne les bonnes empreintes md5 pour la vérification après application', () => {
    const lignes = [...sql.matchAll(/^-- {3}([a-z0-9]+) +([0-9a-f]{32})$/gm)].map(m => [m[1], m[2]]);
    expect(lignes.map(l => l[0])).toEqual([...IDS].sort());
    for (const [id, md5] of lignes) expect(md5, id).toBe(empreinteTextes(fichier(id)));
  });

  it('la tournure ambiguë « prend ta pierre en X » a disparu de tous les problèmes', () => {
    for (const p of ALL_PUZZLES) {
      const textes = [p.title, p.prompt, p.explanation, (p.setup as Record<string, unknown>).refutation].join(' ');
      expect(textes, p.id).not.toMatch(/(prend|pris) ta pierre en [A-T]\d|la capture en [A-T]\d/);
    }
  });
});
