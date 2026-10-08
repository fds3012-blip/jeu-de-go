// #497 : explications de forme, vérifiables. Positions construites à la main (on compte les libertés sur le diagramme)
// et la position de Florian analysée par le vrai réseau (florian497.fixture.ts).
import { afterEach, describe, expect, it } from 'vitest';
import { fromRows } from '../go/position';
import { fromLabel } from '../go/coords';
import { choisirLangue } from '../content/i18n';
import { cadresPourquoi, confirmationPourquoi, expliquer, textePourquoi, type Contexte, type FaitsKataGo } from './pourquoi';
import { faitsKataGo } from './faitsKataGo';
import { FLORIAN_APRES, FLORIAN_AVANT } from './florian497.fixture';

const N = 9;
const L = (s: string) => fromLabel(s, N);
function position(noires: string[], blanches: string[], toPlay: 1 | 2 = 1) {
  const rows = Array.from({ length: N }, () => '.'.repeat(N).split(''));
  for (const [liste, ch] of [[noires, 'X'], [blanches, 'O']] as const) for (const s of liste) { const p = L(s); rows[Math.floor(p / N)][p % N] = ch; }
  return fromRows(rows.map(r => r.join('')), toPlay).pos;
}
const ctx = (avant: ReturnType<typeof position>, bon: string, joue: string, perte?: number, kataGo?: FaitsKataGo): Contexte =>
  ({ avant, bon: L(bon), joue: L(joue), perte, kataGo });

afterEach(() => choisirLangue('fr'));

describe('point de coupe laissé par ton coup', () => {
  // Noir C3 et E3 (saut d'un point) : Blanc peut s'interposer en D3 (libertés D2 et D4) ; aucun coup noir ne relie alors
  // C3 et E3. Avec D4, une pierre blanche en D3 n'aurait plus que D2.
  const avant = position(['C3', 'E3'], []);

  it('le fait calculé, sans KataGo : la coupe, puis la parade du bon coup', () => {
    expect(expliquer(avant, L('D4'), L('G7')).formes).toEqual([{ type: 'coupeLaissee', point: L('D3'), parade: 'atari', kataGo: false }]);
    expect(textePourquoi(ctx(avant, 'D4', 'G7', 3))).toEqual({
      texte: 'Après ton coup en G7, Blanc pouvait couper en D3 : tes pierres restaient séparées. Après D4, une pierre blanche en D3 serait tout de suite en atari.',
      ecart: 'Écart : environ 3 points selon KataGo.',
    });
  });

  it('confirmé par KataGo quand sa riposte pour Blanc est justement la coupe', () => {
    expect(textePourquoi(ctx(avant, 'D4', 'G7', 3, { riposte: [L('D3'), L('D2')] })).texte)
      .toBe('Après ton coup en G7, Blanc pouvait couper en D3 : c’est le coup que KataGo choisissait pour Blanc. Après D4, une pierre blanche en D3 serait tout de suite en atari.');
  });

  it('« Revoir la suite » : ton coup, la coupe, puis le bon coup', () => {
    expect(cadresPourquoi(ctx(avant, 'D4', 'G7', 3)).map(c => c.legende)).toEqual([
      'La position de ta partie.', 'Ton coup dans la partie : G7.', 'Blanc coupe en D3.', 'Retour à la position de ta partie.', 'Le bon coup : D4.',
    ]);
  });

  it('une diagonale n’est pas une coupe : Blanc en D3, Noir relie en C4', () => {
    const diagonale = position(['C3', 'D4'], []);
    expect(expliquer(diagonale, L('E3'), L('G7')).formes).toBeUndefined();
  });

  it('coupe créée par ton coup (saut d’un point) : dite seulement si KataGo y coupait vraiment', () => {
    const seule = position(['C3'], []);
    expect(expliquer(seule, L('G5'), L('E3')).formes).toBeUndefined();
    expect(textePourquoi(ctx(seule, 'G5', 'E3', 2, { riposte: [L('D3')] })).texte)
      .toBe('Après ton coup en E3, Blanc pouvait couper en D3 : c’est le coup que KataGo choisissait pour Blanc. Avec G5, D3 n’est plus un point de coupe.');
  });

  it('un motif tactique passe avant la forme', () => {
    const prise = position(['D5', 'F5', 'E6'], ['E5']);
    const c = ctx(prise, 'E4', 'G3', 7, { riposte: [L('E4')], suite: [L('E4'), L('C3')] });
    expect(expliquer(prise, L('E4'), L('G3'), c.kataGo).motif?.type).toBe('prise');
    expect(textePourquoi(c).texte).toBe('E4 prend une pierre blanche. Après ton coup en G3, elle restait sur le plateau.');
    // La variante de KataGo suit le bon coup ; la riposte n'est montrée que sans motif tactique.
    expect(cadresPourquoi(c).map(x => x.legende)).toEqual(['La position de ta partie.', 'Le bon coup : E4. Il prend une pierre.', 'Suite de KataGo : Blanc en C3.']);
  });
});

describe('point important pour les deux camps', () => {
  const avant = position(['C3', 'G7'], ['D5', 'C2']);

  it('la riposte de KataGo pour Blanc, après ton coup, est le bon coup', () => {
    const c = ctx(avant, 'D3', 'C4', 4, { riposte: [L('D3')] });
    expect(expliquer(avant, L('D3'), L('C4'), c.kataGo).formes).toEqual([{ type: 'pointCommun' }]);
    expect(textePourquoi(c).texte).toBe('Après ton coup en C4, le meilleur coup de Blanc selon KataGo était justement D3 : c’est un point important pour les deux camps.');
  });
});

describe('la position de Florian : la zone, selon KataGo', () => {
  const avant = position(['C3', 'G7'], ['D5', 'C2']);
  const kataGo = faitsKataGo(avant, L('D3'), L('C4'), FLORIAN_AVANT, FLORIAN_APRES);
  const c = ctx(avant, 'D3', 'C4', 4, kataGo);

  it('l’écart se fait en bas ; la riposte de Blanc (E3) entrait dans cette zone', () => {
    expect(expliquer(avant, L('D3'), L('C4'), kataGo).formes?.map(f => f.type)).toEqual(['zone', 'entree']);
    expect(textePourquoi(c)).toEqual({
      texte: 'Selon KataGo, l’écart se fait en bas du plateau : avec D3, cette zone vaut environ 4 points de plus pour toi. Après ton coup en C4, le meilleur coup de Blanc selon KataGo, E3, entrait dans cette zone.',
      ecart: 'Écart : environ 4 points selon KataGo.',
    });
  });

  it('réussite : la phrase de la zone pour D3 ; rien d’inventé pour un autre coup', () => {
    expect(confirmationPourquoi(c, L('D3'))).toBe('Selon KataGo, l’écart se fait en bas du plateau : avec D3, cette zone vaut environ 4 points de plus pour toi.');
    expect(confirmationPourquoi(c, L('D4'))).toBeNull();
  });

  it('en anglais', () => {
    choisirLangue('en');
    expect(textePourquoi(c).texte).toBe('According to KataGo, the difference is at the bottom of the board: with D3, that area is worth about 4 points more for you. After your move at C4, KataGo’s best move for White, E3, went into that area.');
  });
});
