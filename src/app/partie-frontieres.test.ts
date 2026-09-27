import { describe, expect, it } from 'vitest';
import { ALERTE_FRONTIERES, avanceBarre, frontieresAuPasse, frontieresVisibles } from './partie';
import { fromRows } from '../go/position';
import { score } from '../go/score';

// Issue #159, partie écran : Mochi montre les frontières ouvertes quand tu passes, la barre dit le score au comptage.

// Murs noir en D et blanc en F : la colonne E touche les deux couleurs (9 points ouverts). 21 pierres : partie avancée.
const ouverte = fromRows([
  '...X.O...',
  '...X.O...',
  '...X.O...',
  '...X.O...',
  '.XXX.OO..',
  '...X.O...',
  '...X.O...',
  '...X.O...',
  '...X.O...',
]).pos;
const colonneE = Array.from({ length: 9 }, (_, y) => y * 9 + 4);
// Même position, frontière fermée : colonne E noire.
const fermee = fromRows([
  '...XXO...',
  '...XXO...',
  '...XXO...',
  '...XXO...',
  '.XXXXOO..',
  '...XXO...',
  '...XXO...',
  '...XXO...',
  '...XXO...',
]).pos;

describe('frontières ouvertes au passe (#159)', () => {
  it('une seule phrase, courte, sans blocage', () => {
    expect(ALERTE_FRONTIERES).toBe('Il reste des frontières ouvertes : ferme-les avant de passer.');
  });
  it('partie avancée avec une frontière ouverte : les points de la frontière', () => {
    expect(frontieresAuPasse(true, ouverte.board, 9)).toEqual(colonneE);
  });
  it('aide coupée : rien', () => {
    expect(frontieresAuPasse(false, ouverte.board, 9)).toEqual([]);
  });
  it('partie pas encore avancée (plateau presque vide) : rien, passer tôt reste permis', () => {
    const debut = fromRows(['.........', '.........', '..X...O..', '.........', '.........', '.........', '.........', '.........', '.........']).pos;
    expect(frontieresAuPasse(true, debut.board, 9)).toEqual([]);
    expect(frontieresAuPasse(true, new Int8Array(81), 9)).toEqual([]);
  });
  it('frontières fermées : rien', () => {
    expect(frontieresAuPasse(true, fermee.board, 9)).toEqual([]);
  });
});

describe('frontières visibles sur le plateau (#159)', () => {
  const a = { len: 23, points: colonneE };
  it('juste après le passe, tous les points ouverts', () => {
    expect(frontieresVisibles(a, 23, ouverte.board, 9, false)).toEqual(colonneE);
  });
  it("à deux : disparaît au coup suivant ; contre l'ordi : reste après sa réponse, puis disparaît", () => {
    expect(frontieresVisibles(a, 24, ouverte.board, 9, false)).toBeUndefined();
    expect(frontieresVisibles(a, 24, ouverte.board, 9, true)).toEqual(colonneE);
    expect(frontieresVisibles(a, 25, ouverte.board, 9, true)).toBeUndefined();
  });
  it("un coup annulé avant le passe efface l'alerte", () => {
    expect(frontieresVisibles(a, 22, ouverte.board, 9, true)).toBeUndefined();
  });
  it("seuls les points encore ouverts restent (l'ordi a fermé la frontière)", () => {
    expect(frontieresVisibles(a, 24, fermee.board, 9, true)).toBeUndefined();
    const moitie = ouverte.board.slice();
    for (const p of colonneE.slice(0, 4)) moitie[p] = 1;
    // Les 4 premiers points sont pris ; les 5 autres touchent toujours les deux couleurs.
    expect(frontieresVisibles(a, 24, moitie, 9, true)).toEqual(colonneE.slice(4));
  });
  it('sans alerte : rien', () => {
    expect(frontieresVisibles(null, 23, ouverte.board, 9, true)).toBeUndefined();
  });
});

describe("barre d'avantage au comptage (#159)", () => {
  it("au comptage, le score réel (noir - blanc, komi compris), pas l'estimation", () => {
    const sc = score(fermee, 6.5, 'japanese');
    expect(avanceBarre('score', 12, sc)).toBe(sc.black - sc.white);
    expect(avanceBarre('score', null, { black: 10, white: 16.5 })).toBe(-6.5);
  });
  it("en jeu, l'estimation (ou rien tant qu'elle n'est pas prête)", () => {
    expect(avanceBarre('play', 3.5, { black: 10, white: 0 })).toBe(3.5);
    expect(avanceBarre('play', null, { black: 10, white: 0 })).toBeNull();
  });
});
