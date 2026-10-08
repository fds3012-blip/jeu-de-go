// #492 : pourquoi le bon coup est le bon. Positions construites à la main ; chaque phrase attendue est vérifiable
// en comptant les libertés sur le diagramme.
import { describe, expect, it } from 'vitest';
import { fromRows } from '../go/position';
import { fromLabel } from '../go/coords';
import { play } from '../go/rules';
import { cadresPourquoi, confirmationPourquoi, coupsQuiPrennent, expliquer, textePourquoi, type Contexte } from './pourquoi';

const N = 9;
const L = (s: string) => fromLabel(s, N);
/** Plateau 9 × 9 vide, puis les pierres données (« X » noir, « O » blanc), Noir au trait par défaut. */
function position(noires: string[], blanches: string[], toPlay: 1 | 2 = 1) {
  const rows = Array.from({ length: N }, () => '.'.repeat(N).split(''));
  for (const [liste, ch] of [[noires, 'X'], [blanches, 'O']] as const) {
    for (const s of liste) { const p = L(s); rows[Math.floor(p / N)][p % N] = ch; }
  }
  return fromRows(rows.map(r => r.join('')), toPlay).pos;
}
const ctx = (avant: ReturnType<typeof position>, bon: string, joue: string | null, perte?: number): Contexte =>
  ({ avant, bon: L(bon), joue: joue ? L(joue) : -1, perte });

describe('la position de Florian (Caillou, coup 5, 9 × 9)', () => {
  // Noir C3 et G7, Blanc D5 et C2. KataGo préfère D3. Ni prise, ni atari : aucune explication tactique n'est sûre.
  const avant = position(['C3', 'G7'], ['D5', 'C2']);

  it('aucun motif tactique : la phrase générale, avec l’écart arrondi et le fait vérifié « aucune pierre en atari »', () => {
    expect(expliquer(avant, L('D3'), L('C4'))).toEqual({ motif: null, calme: true });
    expect(textePourquoi(ctx(avant, 'D3', 'C4', 5.6))).toEqual({
      texte: 'Selon KataGo, D3 gardait environ 6 points de plus que ton coup en C4. Aucune pierre n’est en atari ici : l’écart ne vient pas d’une prise immédiate.',
      ecart: null,
    });
  });

  it('jamais « retiens-la » ; une erreur gardée avant #492 (sans écart) reste honnête', () => {
    const { texte } = textePourquoi(ctx(avant, 'D3', 'C4'));
    expect(texte).toBe('C’est le coup que KataGo préférait à ton coup en C4. Aucune pierre n’est en atari ici : l’écart ne vient pas d’une prise immédiate.');
    expect(texte).not.toMatch(/retiens|retenir/i);
  });

  it('la suite montre le bon coup, avec la croix sur le coup joué', () => {
    const c = cadresPourquoi(ctx(avant, 'D3', 'C4', 5.6));
    expect(c.map(x => x.legende)).toEqual(['La position de ta partie.', 'Le bon coup : D3.']);
    expect(c[1].croix).toBe(L('C4'));
    expect(c[1].pos.board[L('D3')]).toBe(1);
  });
});

describe('prise', () => {
  // Blanc E5 entouré par D5, F5, E6 : Noir prend en E4.
  const avant = position(['D5', 'F5', 'E6'], ['E5']);

  it('le bon coup prend, le coup joué laissait la pierre', () => {
    expect(expliquer(avant, L('E4'), L('G3')).motif).toEqual({ type: 'prise', pierres: [L('E5')] });
    expect(textePourquoi(ctx(avant, 'E4', 'G3', 7.2))).toEqual({
      texte: 'E4 prend une pierre blanche. Après ton coup en G3, elle restait sur le plateau.',
      ecart: 'Écart : environ 7 points selon KataGo.',
    });
  });

  it('« Revoir la suite » le dit : le bon coup prend', () => {
    const c = cadresPourquoi(ctx(avant, 'E4', 'G3', 7.2));
    expect(c.map(x => x.legende)).toEqual(['La position de ta partie.', 'Le bon coup : E4. Il prend une pierre.']);
    expect(c[1].pos.board[L('E5')]).toBe(0);
  });

  it('le coup joué identique au bon coup : rien à expliquer', () => {
    expect(expliquer(avant, L('E4'), L('E4')).motif).toBeNull();
  });

  it('réussite : courte confirmation du pourquoi', () => {
    expect(confirmationPourquoi(ctx(avant, 'E4', 'G3', 7.2), L('E4'))).toBe('E4 prend une pierre blanche.');
  });
});

describe('sauvetage d’un groupe en atari', () => {
  // Noir E5 en atari (Blanc D5, F5, E6) : Noir allonge en E4.
  const avant = position(['E5'], ['D5', 'F5', 'E6']);

  it('le bon coup sort la pierre de l’atari ; après le coup joué, Blanc la prenait', () => {
    expect(coupsQuiPrennent(play(avant, L('G3')) as typeof avant).get(L('E4'))).toEqual([L('E5')]);
    expect(expliquer(avant, L('E4'), L('G3')).motif).toEqual({ type: 'sauve', pierres: [L('E5')], libertes: 3, point: L('E4'), menacees: 1 });
    expect(textePourquoi(ctx(avant, 'E4', 'G3', 4)).texte).toBe(
      'E4 sort ta pierre de l’atari (il ne lui restait qu’une liberté) : elle a maintenant 3 libertés. Après ton coup en G3, Blanc pouvait prendre une de tes pierres en E4.',
    );
  });

  it('la suite montre la prise après le coup joué, puis le bon coup', () => {
    const c = cadresPourquoi(ctx(avant, 'E4', 'G3', 4));
    expect(c.map(x => x.legende)).toEqual(['La position de ta partie.', 'Ton coup dans la partie : G3.', 'Blanc prend une pierre en E4.', 'Retour à la position de ta partie.', 'Le bon coup : E4.']);
    expect(c[2].pos.board[L('E5')]).toBe(0);
    expect(c[4].croix).toBe(L('G3'));
  });

  it('après une passe aussi', () => {
    expect(textePourquoi(ctx(avant, 'E4', null, 4)).texte).toMatch(/Après ta passe, Blanc pouvait prendre une de tes pierres en E4\.$/);
    expect(cadresPourquoi(ctx(avant, 'E4', null, 4))[1].legende).toBe('Dans la partie, tu as passé.');
  });
});

describe('coup joué qui se met en prise', () => {
  // Noir E5 (2 libertés : E6, E4). Blanc D5, F5, D6, F6, E7 : allonger en E6 se met en atari.
  const avant = position(['E5'], ['D5', 'F5', 'D6', 'F6', 'E7']);

  it('on dit ce que le coup joué permettait, et que le bon coup ne laisse rien prendre', () => {
    expect(expliquer(avant, L('E4'), L('E6')).motif).toMatchObject({ type: 'risque', point: L('E4'), menacees: 2 });
    expect(textePourquoi(ctx(avant, 'E4', 'E6', 9)).texte).toBe(
      'Après ton coup en E6, Blanc pouvait prendre 2 de tes pierres en E4. Avec E4, Blanc ne peut rien prendre au coup suivant.',
    );
  });
});

describe('connexion', () => {
  // Noir D5 et E4 en diagonale : E5 les relie.
  const avant = position(['D5', 'E4'], ['F5']);

  it('le bon coup relie ; après le coup joué, Blanc pouvait couper', () => {
    expect(expliquer(avant, L('E5'), L('G3')).motif).toEqual({ type: 'relie', point: L('E5') });
    expect(textePourquoi(ctx(avant, 'E5', 'G3', 3)).texte).toBe(
      'E5 relie tes pierres : elles forment un seul groupe. Après ton coup en G3, Blanc pouvait couper (séparer tes pierres) en E5.',
    );
    expect(cadresPourquoi(ctx(avant, 'E5', 'G3', 3)).map(x => x.legende)).toEqual(['La position de ta partie.', 'Ton coup dans la partie : G3.', 'Blanc coupe en E5.', 'Retour à la position de ta partie.', 'Le bon coup : E5.']);
  });

  it('pas de « relie » si le coup joué reliait déjà les pierres', () => {
    expect(expliquer(avant, L('E5'), L('D4')).motif).toBeNull();
  });
});

describe('coupe', () => {
  // Blanc D5 et E4 en diagonale : Noir coupe en E5.
  const avant = position(['G3'], ['D5', 'E4']);

  it('le bon coup coupe ; après le coup joué, Blanc pouvait relier', () => {
    expect(expliquer(avant, L('E5'), L('B8')).motif).toEqual({ type: 'coupe', point: L('E5') });
    expect(textePourquoi(ctx(avant, 'E5', 'B8', 5)).texte).toBe(
      'E5 coupe (sépare) les pierres blanches : elles ne peuvent plus se relier en E5. Après ton coup en B8, Blanc pouvait les relier là.',
    );
    expect(cadresPourquoi(ctx(avant, 'E5', 'B8', 5))[2].legende).toBe('Blanc relie ses pierres en E5.');
  });
});

describe('atari', () => {
  // Blanc E5, Noir D5 et F5 : E6 laisse une seule liberté (E4).
  const avant = position(['D5', 'F5'], ['E5']);

  it('le bon coup met en atari ; après le coup joué, la pierre gardait 2 libertés', () => {
    expect(expliquer(avant, L('E6'), L('G3')).motif).toEqual({ type: 'atari', pierres: [L('E5')], libertesApresJoue: 2 });
    expect(textePourquoi(ctx(avant, 'E6', 'G3', 2.4)).texte).toBe(
      'E6 met une pierre blanche en atari : il ne lui reste qu’une liberté. Après ton coup en G3, elle avait encore 2 libertés.',
    );
  });
});

describe('sans motif sûr', () => {
  it('une pierre en atari ailleurs : pas de « calme », on invite à comparer', () => {
    // Blanc A1 en atari (Noir B1), ni le bon coup ni le coup joué ne le touchent.
    const avant = position(['B1'], ['A1']);
    expect(expliquer(avant, L('E5'), L('G7'))).toEqual({ motif: null, calme: false });
    expect(textePourquoi(ctx(avant, 'E5', 'G7', 6)).texte).toBe('Selon KataGo, E5 gardait environ 6 points de plus que ton coup en G7. Compare les deux coups sur le plateau.');
  });

  it('réussite : l’écart pour le coup de KataGo, rien de plus pour un coup équivalent', () => {
    const avant = position(['C3', 'G7'], ['D5', 'C2']);
    expect(confirmationPourquoi(ctx(avant, 'D3', 'C4', 5.6), L('D3'))).toBe('Il garde environ 6 points de plus que ton coup en C4.');
    expect(confirmationPourquoi(ctx(avant, 'D3', 'C4', 5.6), L('D4'))).toBeNull();
  });

  it('bon coup injouable : aucune affirmation tactique', () => {
    const avant = position(['E5'], []);
    expect(expliquer(avant, L('E5'), L('C3'))).toEqual({ motif: null, calme: false });
  });
});
