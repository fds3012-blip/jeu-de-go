// Avant un passe trop tôt, Mochi prévient (#235).
import { describe, expect, it } from 'vitest';
import { avertirAvantPasse } from './partie';
import { t } from '../content/i18n';
import { partieAvancee } from '../go/frontieres';

function plateau(rows: string[]): Int8Array {
  const b = new Int8Array(rows.length * rows.length);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') b[y * rows.length + x] = ch === 'X' ? 1 : 2; }));
  return b;
}

// Partie finie : frontière fermée en colonne E/F, aucun point ouvert.
const FINIE = plateau(Array(9).fill('...XXO...'));
// 27 pierres, mais le côté droit est grand ouvert (murs troués) : beaucoup de frontières.
const OUVERTE = plateau(['...XX....', '..XX..O..', '..XX..O..', '..XX..O..', '..XX....O', '..XX..O..', '..XX..O..', '..XX..O..', '...XX.O..']);
const PEU = plateau(['.........', '..X...O..', '.........', '.........', '....X....', '.........', '..X...O..', '.........', '.........']);

const base = { contreOrdi: true, aide: true, premieresParties: true, adversairePasse: false, size: 9 };

describe('avertir avant un passe (#235)', () => {
  it('partie peu avancée : Mochi prévient', () => {
    expect(avertirAvantPasse({ ...base, board: PEU })).toBe(true);
    expect(avertirAvantPasse({ ...base, board: new Int8Array(81) })).toBe(true);
  });

  it('frontières ouvertes nombreuses : Mochi prévient ; partie finie : non', () => {
    expect(partieAvancee(OUVERTE) && partieAvancee(FINIE)).toBe(true);
    expect(avertirAvantPasse({ ...base, board: OUVERTE })).toBe(true);
    expect(avertirAvantPasse({ ...base, board: FINIE })).toBe(false);
  });

  it('l’adversaire vient de passer : pas d’avertissement (Mochi conseille de passer aussi)', () => {
    expect(avertirAvantPasse({ ...base, adversairePasse: true, board: PEU })).toBe(false);
  });

  it('seulement contre l’ordi, avec l’aide ou pendant les premières parties', () => {
    expect(avertirAvantPasse({ ...base, contreOrdi: false, board: PEU })).toBe(false);
    expect(avertirAvantPasse({ ...base, aide: false, premieresParties: false, board: PEU })).toBe(false);
    expect(avertirAvantPasse({ ...base, aide: false, board: PEU })).toBe(true);
    expect(avertirAvantPasse({ ...base, premieresParties: false, board: PEU })).toBe(true);
  });

  it('une phrase courte, deux choix clairs', () => {
    expect(t('partie.passe.avertir')).toBe('Il reste de la place à prendre. Tu passes quand même ?');
    expect(t('partie.passe.confirmer')).toBe('Passer');
    expect(t('partie.passe.continuer')).toBe('Jouer encore');
  });
});
