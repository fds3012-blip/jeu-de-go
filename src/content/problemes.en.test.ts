// Problèmes en anglais (#167) : le catalogue colle aux problèmes français (ids, coordonnées, nombres),
// aucun texte vide ni resté en français, longueurs raisonnables, et la superposition ne touche que les textes.
import { describe, expect, it } from 'vitest';
import { ALL_PUZZLES } from './puzzles';
import { PROBLEMES_EN } from './problemes.en';
import { localiserProbleme } from './problemesLangue';
import { parsePuzzle, type PuzzleRow } from '../data/puzzles';

type Champ = 'title' | 'prompt' | 'explanation' | 'refutation';
const CHAMPS: Champ[] = ['title', 'prompt', 'explanation', 'refutation'];
const PAR_ID = new Map(ALL_PUZZLES.map(p => [p.id, p]));

function francais(row: PuzzleRow, c: Champ): string | null {
  if (c === 'refutation') {
    const s = row.setup as { refutation?: unknown };
    return typeof s.refutation === 'string' && s.refutation ? s.refutation : null;
  }
  return row[c] ?? null;
}

/** Coordonnées citées (A1 à T19, sans I), triées, avec leurs répétitions. */
const coords = (s: string) => (s.match(/\b[A-HJ-T](?:1[0-9]|[1-9])\b/g) ?? []).sort();
/** Nombres écrits en chiffres, hors coordonnées. */
const nombres = (s: string) => (s.replace(/\b[A-HJ-T](?:1[0-9]|[1-9])\b/g, '').match(/\d+/g) ?? []).sort();

// Mots français fréquents dans les problèmes : aucun ne doit rester dans l'anglais.
const FRANCAIS = /\b(pierres?|blanche?s?|noire?s?|libertés?|joue[sz]?|capturer|capture-la|groupe|coin|bord|avec|pour|dans|une?|les?|la|des|du|et|est|pas|tu|ta|tes|ton|il|elle|qu'|c'est|œil|yeux|vivant|échelle|filet)\b/i;
const ACCENTS = /[àâçéèêëîïôûùüÿœ]/i;

const ENTREES = Object.entries(PROBLEMES_EN);

describe('problèmes en anglais', () => {
  it('traduit les problèmes locaux, en commençant par les plus faciles', () => {
    expect(ENTREES.length).toBeGreaterThanOrEqual(198);
    const faciles = [...ALL_PUZZLES].sort((a, b) => a.difficulty - b.difficulty).slice(0, 40).map(p => p.id);
    expect(faciles.filter(id => !PROBLEMES_EN[id])).toEqual([]);
  });

  it.each(ENTREES)('%s : le problème existe', id => {
    expect(PAR_ID.has(id)).toBe(true);
  });

  it.each(ENTREES)('%s : mêmes champs, mêmes coordonnées et mêmes nombres que le français', (id, en) => {
    const row = PAR_ID.get(id)!;
    for (const c of CHAMPS) {
      const fr = francais(row, c);
      const tr = en[c];
      if (c === 'title' || c === 'prompt') expect(tr, `${id}.${c}`).toBeTruthy();
      // Un texte anglais seulement si le français en a un, et réciproquement.
      expect(!!tr, `${id}.${c} présent en français et en anglais`).toBe(!!fr);
      if (!fr || !tr) continue;
      expect(coords(tr), `${id}.${c} : coordonnées`).toEqual(coords(fr));
      expect(nombres(tr), `${id}.${c} : nombres`).toEqual(nombres(fr));
    }
  });

  it.each(ENTREES)('%s : aucun texte vide ni resté en français, longueurs raisonnables', (id, en) => {
    const row = PAR_ID.get(id)!;
    for (const c of CHAMPS) {
      const tr = en[c];
      if (!tr) continue;
      expect(tr.trim(), `${id}.${c}`).toBe(tr);
      expect(tr.length, `${id}.${c} vide`).toBeGreaterThan(0);
      expect(tr, `${id}.${c} : mot français`).not.toMatch(FRANCAIS);
      expect(tr, `${id}.${c} : accent français`).not.toMatch(ACCENTS);
      expect(tr, `${id}.${c} : espace avant la ponctuation`).not.toMatch(/\s[!?:;]/);
      const fr = francais(row, c)!;
      // L'anglais est d'ordinaire plus court : au plus 25 % de plus que le français, et le titre tient sur une ligne.
      expect(tr.length, `${id}.${c} : trop long`).toBeLessThanOrEqual(Math.ceil(fr.length * 1.25) + 5);
      if (c === 'title') expect(tr.length, `${id}.title`).toBeLessThanOrEqual(32);
    }
  });
});

describe('localiserProbleme', () => {
  const pz = parsePuzzle(PAR_ID.get('c1')!)!;

  it('en français, rien ne change', () => {
    expect(localiserProbleme(pz, 'fr')).toBe(pz);
    expect(pz.title).toBe('Double atari');
    expect(pz.prompt).toMatch(/^Noir joue/);
  });

  it('en anglais, seuls les textes changent', () => {
    const en = localiserProbleme(pz, 'en');
    expect(en.prompt).toBe(PROBLEMES_EN.c1.prompt);
    expect(en.explanation).toBe(PROBLEMES_EN.c1.explanation);
    expect(en.refutation).toBe(PROBLEMES_EN.c1.refutation);
    expect({ ...en, title: 0, prompt: 0, explanation: 0, refutation: 0 }).toEqual({ ...pz, title: 0, prompt: 0, explanation: 0, refutation: 0 });
  });

  it('un problème non traduit reste en français', () => {
    const inconnu = { ...pz, id: 'zz-inconnu' };
    expect(localiserProbleme(inconnu, 'en')).toBe(inconnu);
  });

  it('un problème de la base sans explication garde null', () => {
    const b1 = localiserProbleme(parsePuzzle(PAR_ID.get('b1')!)!, 'en');
    expect(b1.title).toBe('Capture the stone');
    expect(b1.explanation).toBeNull();
    expect(b1.refutation).toBeNull();
  });
});
