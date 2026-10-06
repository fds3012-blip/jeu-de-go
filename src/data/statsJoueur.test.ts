import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { lireDonneesCote } from './statsJoueur';
import { CATALOGUE_CLUB } from '../content/i18n/club';

// #368 : lectures de « Mes statistiques ». Décision #137 maintenue : aucune cote de problème, aucun compteur de problèmes.
const depuis = Date.parse('2026-07-07T00:00:00Z');

describe('cote et parties classées', () => {
  it('courbe des 90 jours (parties et départ), parties classées de toutes dates, jamais les problèmes', () => {
    const d = lireDonneesCote({ rating: 1520, cote_provisoire: false }, [
      { kind: 'game', rating: 1520, ecart: 14, created_at: '2026-10-04T10:00:00Z', game_id: 'g2' },
      { kind: 'puzzle', rating: 1900, ecart: null, created_at: '2026-10-03T10:00:00Z', game_id: null },
      { kind: 'game', rating: 1506, ecart: -8, created_at: '2026-10-01T10:00:00Z', game_id: 'g1' },
      { kind: 'depart', rating: 1514, ecart: null, created_at: '2026-09-30T10:00:00Z', game_id: null },
      { kind: 'game', rating: 1400, ecart: 20, created_at: '2026-05-01T10:00:00Z', game_id: 'g0' },
    ], new Map([['g1', 9], ['g2', 13]]), depuis);
    expect(d.cote).toEqual({ cote: 1520, provisoire: false });
    expect(d.courbe.map(p => p.cote)).toEqual([1514, 1506, 1520]);
    expect(d.classees).toEqual([{ taille: 13, gagnee: true }, { taille: 9, gagnee: false }, { taille: null, gagnee: true }]);
  });
  it('profil sans cote lisible', () => {
    expect(lireDonneesCote(null, [], new Map(), depuis).cote).toBeNull();
  });
});

describe('décision #137', () => {
  it('« Mes statistiques » ne lit ni n’affiche rien des problèmes', () => {
    for (const f of ['../app/Statistiques.tsx', './statsJoueur.ts', '../app/statsJoueur.ts']) {
      const src = readFileSync(new URL(f, import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
      expect(src, f).not.toMatch(/puzzle_rating|cotes_a_mesure|SOLVED_KEY|go\.problemes|'puzzle'/);
    }
    for (const l of ['fr', 'en'] as const) {
      const textes = Object.entries(CATALOGUE_CLUB[l]).filter(([k]) => k.startsWith('stats.')).map(([, v]) => v).join(' ');
      expect(textes).not.toMatch(/probl[eè]me|puzzle/i);
    }
  });
});
