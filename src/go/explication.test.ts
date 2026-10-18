// #673 : le générateur d'explications sur des positions construites, dont la bonne raison est connue (on la vérifie en
// comptant les libertés sur le diagramme). La propriété de KataGo est simulée : on teste que le générateur lit les
// bons faits, et surtout qu'il se tait quand les sources ne s'accordent pas. Les analyses du vrai réseau sont dans
// explication-katago.test.ts.
import { describe, expect, it } from 'vitest';
import { fromRows } from './position';
import { fromLabel, toLabel } from './coords';
import { bande, dansLieu, distance, expliquerErreur, regrouper, SEUILS, suiteJouee, zoneDe, type Entree } from './explication';

const N = 9;
const L = (s: string) => fromLabel(s, N);
const Ls = (xs: number[]) => xs.map(p => toLabel(p, N));

/** Plateau 9 × 9, pierres données par étiquettes, Noir au trait par défaut. */
function position(noires: string[], blanches: string[], toPlay: 1 | 2 = 1) {
  const rows = Array.from({ length: N }, () => '.'.repeat(N).split(''));
  for (const [liste, ch] of [[noires, 'X'], [blanches, 'O']] as const) for (const s of liste) { const p = L(s); rows[Math.floor(p / N)][p % N] = ch; }
  return fromRows(rows.map(r => r.join('')), toPlay).pos;
}
/** Propriété : 0 partout, sauf les valeurs données (de -1 Blanc à +1 Noir). */
function propriete(valeurs: Record<string, number> = {}, fond = 0) {
  const o = new Float32Array(N * N).fill(fond);
  for (const [k, v] of Object.entries(valeurs)) o[L(k)] = v;
  return o;
}
const entree = (e: Omit<Partial<Entree>, 'joue' | 'bon'> & Pick<Entree, 'avant'> & { joue: string | number; bon: string }): Entree => ({
  perte: 5, visitesBon: 40, visitesRiposte: 40, ...e,
  joue: typeof e.joue === 'number' ? e.joue : L(e.joue), bon: L(e.bon),
});

describe('atari ignoré : Blanc prend tes pierres', () => {
  // Noir E5-E4, entouré par D5, F5, E6, D4, F4 : une seule liberté, E3. Noir joue ailleurs (C7), Blanc prend en E3.
  const avant = position(['E5', 'E4'], ['D5', 'F5', 'E6', 'D4', 'F4']);
  const base = { avant, joue: 'C7', bon: 'E3', pvBon: [L('E3'), L('C7')], pvRiposte: [L('E3'), L('C6')] };

  it('la bonne raison : atari ignoré, prise au coup 2 de ta suite, chiffrée en pierres', () => {
    const x = expliquerErreur(entree({ ...base, ownBon: propriete({ E5: 0.9, E4: 0.9 }), ownJoue: propriete({ E5: -0.9, E4: -0.9 }) }))!;
    expect(x.faits).toHaveLength(1);
    expect(x.faits[0]).toMatchObject({ type: 'pierresPerdues', cause: 'atari', point: L('E3'), etape: 1, poids: 4 });
    expect(Ls(x.faits[0].visuel.pierres)).toEqual(['E5', 'E4']);
    expect(x.riposte).toBe(L('E3'));
    expect(x.positionnel).toBe(false);
    expect(x.calme).toBe(false);
  });

  it('sans propriété : la prise immédiate de la suite et les règles suffisent', () => {
    const x = expliquerErreur(entree(base))!;
    expect(x.faits[0]).toMatchObject({ type: 'pierresPerdues', cause: 'atari' });
  });

  it('position ambiguë : la suite prend, mais la propriété les garde à toi : rien n’est dit', () => {
    const x = expliquerErreur(entree({ ...base, ownBon: propriete({ E5: 0.9, E4: 0.9 }), ownJoue: propriete({ E5: 0.5, E4: 0.5 }) }))!;
    expect(x.faits).toEqual([]);
    expect(x.positionnel).toBe(true);
    // Il y a une prise dans la suite : jamais « rien n'est pris ».
    expect(x.calme).toBe(false);
  });

  it('suite trop peu explorée : la réponse de KataGo n’est pas lue ; seul le sort du groupe, selon la propriété, est dit', () => {
    const x = expliquerErreur(entree({ ...base, visitesRiposte: 4, ownBon: propriete({ E5: 0.9, E4: 0.9 }), ownJoue: propriete({ E5: -0.9, E4: -0.9 }) }))!;
    expect(x.riposte).toBeNull();
    expect(x.suiteJoue.coups).toEqual([L('C7')]);
    expect(x.faits.map(f => f.type)).toEqual(['groupe']);
    expect(x.faits[0]).toMatchObject({ etat: 'mort' });
  });

  it('suite trop peu explorée et pas de propriété : aucune raison', () => {
    expect(expliquerErreur(entree({ ...base, visitesRiposte: 4 }))!.faits).toEqual([]);
  });

  it('les pierres auraient été prises aussi avec le bon coup : pas une raison', () => {
    // Le « bon coup » ne les sauve pas (propriété après lui : à Blanc).
    const x = expliquerErreur(entree({ ...base, bon: 'G7', pvBon: [L('G7')], ownBon: propriete({ E5: -0.9, E4: -0.9 }), ownJoue: propriete({ E5: -0.9, E4: -0.9 }) }))!;
    expect(x.faits.find(f => f.type === 'pierresPerdues')).toBeUndefined();
  });
});

describe('coup qui se met en atari', () => {
  // Blanc D2, F2, E3 : Noir joue E2, qui n'a plus qu'une liberté (E1). Blanc prend en E1.
  const avant = position([], ['D2', 'F2', 'E3']);
  it('cause « autoAtari », et rien sur le bon coup (seule ta pierre jouée est prise)', () => {
    const x = expliquerErreur(entree({ avant, joue: 'E2', bon: 'C7', pvRiposte: [L('E1')], ownJoue: propriete({ E2: -0.9 }), ownBon: propriete() }))!;
    expect(x.faits[0]).toMatchObject({ type: 'pierresPerdues', cause: 'autoAtari', point: L('E1'), etape: 1 });
    expect(Ls(x.faits[0].visuel.pierres)).toEqual(['E2']);
  });
});

describe('prise manquée', () => {
  // Blanc E5 entouré par D5, F5, E6 : en atari, liberté E4. Noir joue C7 ; E4 prenait.
  const avant = position(['D5', 'F5', 'E6'], ['E5']);
  it('la bonne raison : la pierre était en atari, le bon coup la prend tout de suite', () => {
    const x = expliquerErreur(entree({ avant, joue: 'C7', bon: 'E4', pvBon: [L('E4')], pvRiposte: [L('E4')], ownBon: propriete({ E5: 0.9 }), ownJoue: propriete({ E5: -0.6 }) }))!;
    expect(x.faits[0]).toMatchObject({ type: 'priseManquee', cause: 'atari', etape: 0, point: L('E4'), pierres: [L('E5')] });
  });
  it('sans propriété : seule une prise par le bon coup lui-même est dite', () => {
    const x = expliquerErreur(entree({ avant, joue: 'C7', bon: 'E4', pvBon: [L('E4')] }))!;
    expect(x.faits[0]).toMatchObject({ type: 'priseManquee', cause: 'atari' });
  });
  it('si ta suite prend aussi ces pierres (Blanc s’échappe dans un cul-de-sac), ce n’est pas une prise manquée', () => {
    // Noir D4 et F4 en plus : après C7, Blanc E4 n'a qu'une liberté (E3) et Noir prend les deux pierres en E3.
    const pos = position(['D5', 'F5', 'E6', 'D4', 'F4'], ['E5']);
    const x = expliquerErreur(entree({ avant: pos, joue: 'C7', bon: 'E4', pvBon: [L('E4')], pvRiposte: [L('E4'), L('E3')] }))!;
    expect(x.suiteJoue.positions[2].board[L('E5')]).toBe(0);
    expect(x.faits.find(f => f.type === 'priseManquee')).toBeUndefined();
  });
});

describe('groupe qui meurt, groupe qui vit', () => {
  // Groupe noir de 3 pierres en bas à droite ; aucune prise dans les suites. Le sort vient de la propriété.
  const avant = position(['G2', 'H2', 'H3'], ['F2', 'F3', 'G4']);
  const base = { avant, joue: 'B8', bon: 'G3', pvBon: [L('G3')], pvRiposte: [L('G3')] };
  it('vivant après le bon coup, mort après ton coup : « meurt »', () => {
    const x = expliquerErreur(entree({ ...base, ownBon: propriete({ G2: 0.9, H2: 0.9, H3: 0.9 }), ownJoue: propriete({ G2: -0.8, H2: -0.8, H3: -0.8 }) }))!;
    expect(x.faits[0]).toMatchObject({ type: 'groupe', etat: 'mort' });
    expect(Ls(x.faits[0].visuel.pierres).sort()).toEqual(['G2', 'H2', 'H3']);
  });
  it('vivant, puis incertain : « n’est plus sûr de vivre », jamais « meurt »', () => {
    const x = expliquerErreur(entree({ ...base, ownBon: propriete({ G2: 0.9, H2: 0.9, H3: 0.9 }), ownJoue: propriete({ G2: -0.1, H2: 0, H3: -0.2 }) }))!;
    expect(x.faits[0]).toMatchObject({ type: 'groupe', etat: 'faible' });
  });
  it('écart trop faible (0,9 → 0,3) : rien', () => {
    const x = expliquerErreur(entree({ ...base, ownBon: propriete({ G2: 0.9, H2: 0.9, H3: 0.9 }), ownJoue: propriete({ G2: 0.3, H2: 0.3, H3: 0.3 }) }))!;
    expect(x.faits.find(f => f.type === 'groupe')).toBeUndefined();
  });
  it('un groupe blanc tué par le bon coup, qui vit après ton coup', () => {
    const x = expliquerErreur(entree({ ...base, ownBon: propriete({ F2: 0.8, F3: 0.8, G4: 0.8 }), ownJoue: propriete({ F2: -0.9, F3: -0.9, G4: -0.9 }) }))!;
    expect(x.faits[0]).toMatchObject({ type: 'groupeTue', apresJoue: 'vit' });
  });
  it('une pierre seule ne fait pas un groupe', () => {
    const x = expliquerErreur(entree({ ...base, ownBon: propriete({ H3: 0.9 }), ownJoue: propriete({ H3: -0.9 }) }))!;
    expect(x.faits.find(f => f.type === 'groupe')).toBeUndefined();
  });
});

describe('coupe permise', () => {
  // Noir D4 et E5, Blanc D5 : E4 coupe (aucun coup noir ne relie ensuite D4 et E5). Noir joue H8 ; Blanc coupe en E4.
  const avant = position(['D4', 'E5'], ['D5']);
  const base = { avant, joue: 'H8', bon: 'E4', pvBon: [L('E4')], pvRiposte: [L('E4')] };
  it('la bonne raison : la coupe, et le bon coup occupe le point de coupe', () => {
    const x = expliquerErreur(entree({ ...base, ownBon: propriete({ D4: 0.7, E5: 0.7 }), ownJoue: propriete({ D4: 0.1, E5: 0.1 }) }))!;
    expect(x.faits[0]).toMatchObject({ type: 'coupe', point: L('E4'), parade: 'occupe' });
    expect(Ls(x.faits[0].visuel.pierres)).toEqual(['E5', 'D4']);
  });
  it('une coupe qui ne coûte rien (propriété inchangée) n’est pas une raison', () => {
    const x = expliquerErreur(entree({ ...base, ownBon: propriete({ D4: 0.7, E5: 0.7 }), ownJoue: propriete({ D4: 0.6, E5: 0.6 }) }))!;
    expect(x.faits.find(f => f.type === 'coupe')).toBeUndefined();
  });
  it('une diagonale n’est pas une coupe : l’autre point relie', () => {
    const x = expliquerErreur(entree({ ...base, avant: position(['D4', 'E5'], []), ownBon: propriete({ D4: 0.7, E5: 0.7 }), ownJoue: propriete({ D4: 0.1, E5: 0.1 }) }))!;
    expect(x.faits.find(f => f.type === 'coupe')).toBeUndefined();
  });
  it('un « bon coup » qui ne pare pas la coupe (B8) : on ne dit pas que la coupe est la raison', () => {
    const x = expliquerErreur(entree({ ...base, bon: 'B8', pvBon: [L('B8')], ownBon: propriete({ D4: 0.7, E5: 0.7 }), ownJoue: propriete({ D4: 0.1, E5: 0.1 }) }))!;
    expect(x.faits.find(f => f.type === 'coupe')).toBeUndefined();
  });
});

describe('territoire', () => {
  const avant = position(['C3', 'G7'], ['G3']);
  /** Écart de 0,6 sur chaque point vide du coin en bas à gauche (3 × 3 : A1 à C3), propriété ailleurs inchangée. */
  const coin = () => {
    const bon = propriete(), joue = propriete();
    for (const x of 'ABC') for (const y of [1, 2, 3]) { const k = `${x}${y}`; if (k !== 'C3') { bon[L(k)] = 0.7; joue[L(k)] = 0.1; } }
    return { bon, joue };
  };
  it('l’écart est dans le coin en bas à gauche : 4,8 points', () => {
    const { bon, joue } = coin();
    const x = expliquerErreur(entree({ avant, joue: 'E5', bon: 'D2', perte: 6, ownBon: bon, ownJoue: joue }))!;
    const f = x.faits[0];
    expect(f).toMatchObject({ type: 'territoire', lieu: 'coinBasGauche' });
    expect(f.type === 'territoire' && f.gain).toBeCloseTo(4.8, 1);
    // D2 (bon coup) est hors du coin de 3 × 3 : les 8 points vides du coin portent l'écart (8 × 0,6).
    expect(f.type === 'territoire' && f.points.length).toBe(8);
  });
  it('jamais plus que les points perdus + 2 : 4,8 points dans le coin pour une erreur de 1,5 point, rien', () => {
    const { bon, joue } = coin();
    const x = expliquerErreur(entree({ avant, joue: 'E5', bon: 'D2', perte: 1.5, ownBon: bon, ownJoue: joue }))!;
    expect(x.faits.find(f => f.type === 'territoire')).toBeUndefined();
  });
  it('une zone qui n’explique qu’une petite part de la perte (4,8 points sur 12) n’est pas dite', () => {
    const { bon, joue } = coin();
    const x = expliquerErreur(entree({ avant, joue: 'E5', bon: 'D2', perte: 12, ownBon: bon, ownJoue: joue }))!;
    expect(x.faits.find(f => f.type === 'territoire')).toBeUndefined();
  });
  it('écart réparti sur tout le plateau : pas de zone, et la raison positionnelle est dite « calme »', () => {
    const x = expliquerErreur(entree({ avant, joue: 'E5', bon: 'D2', perte: 6, ownBon: propriete({}, 0.15), ownJoue: propriete({}, 0.05) }))!;
    expect(x.faits).toEqual([]);
    expect(x.positionnel).toBe(true);
    expect(x.calme).toBe(true);
  });
  it('zone à cheval sur un coin et un bord : le quart du plateau', () => {
    const bon = propriete(), joue = propriete();
    for (const x of 'ABCDE') for (const y of [1, 2]) { bon[L(`${x}${y}`)] = 0.5; joue[L(`${x}${y}`)] = 0; }
    const x = expliquerErreur(entree({ avant, joue: 'H8', bon: 'J9', perte: 6, ownBon: bon, ownJoue: joue }))!;
    // A1-C2 : 6 points × 0,5 = 3 (coin), D1-E2 : 2 points sur le bord… 3/5 = 60 % < 70 % ; le quart bas-gauche (A-D, 1-4) : 4/5.
    expect(x.faits[0]).toMatchObject({ type: 'territoire', lieu: 'basGauche' });
  });
});

describe('initiative (sente et gote), démontrée par les deux suites de KataGo', () => {
  const avant = position(['C5', 'G5'], ['E5']);
  it('après le bon coup, Blanc répond sur place puis tu joues ailleurs ; après ton coup, Blanc joue ailleurs', () => {
    const x = expliquerErreur(entree({ avant, joue: 'G3', bon: 'C3', pvBon: [L('C3'), L('D3'), L('G7')], pvRiposte: [L('C7')] }))!;
    expect(x.faits).toEqual([expect.objectContaining({ type: 'initiative', reponse: L('D3'), ailleurs: L('G7'), ailleursLui: L('C7') })]);
  });
  it('si Blanc répond sur place à ton coup aussi, pas d’initiative perdue', () => {
    const x = expliquerErreur(entree({ avant, joue: 'G3', bon: 'C3', pvBon: [L('C3'), L('D3'), L('G7')], pvRiposte: [L('G2')] }))!;
    expect(x.faits.find(f => f.type === 'initiative')).toBeUndefined();
  });
  it('suite du bon coup trop peu explorée : pas d’initiative', () => {
    const x = expliquerErreur(entree({ avant, joue: 'G3', bon: 'C3', visitesBon: 10, pvBon: [L('C3'), L('D3'), L('G7')], pvRiposte: [L('C7')] }))!;
    expect(x.faits).toEqual([]);
  });
});

describe('une ou deux raisons, les plus fortes', () => {
  it('la prise de 2 pierres (4) et la zone (2,4) : les deux, la prise d’abord', () => {
    const avant = position(['E5', 'E4', 'B2'], ['D5', 'F5', 'E6', 'D4', 'F4']);
    const bon = propriete({ E5: 0.9, E4: 0.9 }), joue = propriete({ E5: -0.9, E4: -0.9 });
    for (const k of ['A1', 'A2', 'A3', 'B1', 'B3', 'C1', 'C2', 'C3']) { bon[L(k)] = 0.5; joue[L(k)] = 0.2; }
    const x = expliquerErreur(entree({ avant, joue: 'H8', bon: 'E3', perte: 7, pvBon: [L('E3')], pvRiposte: [L('E3')], ownBon: bon, ownJoue: joue }))!;
    expect(x.faits.map(f => f.type)).toEqual(['pierresPerdues', 'territoire']);
  });
  it('trois raisons possibles : on garde les deux plus concrètes (les prises avant la zone)', () => {
    // Noir E5-E4 en atari ; Blanc C7 en atari aussi (B7, C8, D7 noirs) : le bon coup E3 sauve, la suite du bon coup prend C7.
    const avant = position(['E5', 'E4', 'B7', 'C8', 'D7'], ['D5', 'F5', 'E6', 'D4', 'F4', 'C7']);
    const bon = propriete({ E5: 0.9, E4: 0.9, C7: 0.9 }), joue = propriete({ E5: -0.9, E4: -0.9, C7: -0.5 });
    for (const k of ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3']) { bon[L(k)] = 0.5; joue[L(k)] = 0.1; }
    const x = expliquerErreur(entree({ avant, joue: 'H8', bon: 'E3', perte: 12, pvBon: [L('E3'), L('H2'), L('C6')], pvRiposte: [L('E3')], ownBon: bon, ownJoue: joue }))!;
    expect(x.faits.map(f => f.type)).toEqual(['pierresPerdues', 'priseManquee']);
  });
});

describe('garde-fous', () => {
  const avant = position(['C3'], ['G7']);
  it('moins de 1 point perdu, bon coup égal au coup joué, bon coup illégal : rien à expliquer', () => {
    expect(expliquerErreur(entree({ avant, joue: 'E5', bon: 'D4', perte: 0.5 }))).toBeNull();
    expect(expliquerErreur(entree({ avant, joue: 'D4', bon: 'D4' }))).toBeNull();
    expect(expliquerErreur(entree({ avant, joue: 'E5', bon: 'C3' }))).toBeNull();
  });
  it('une passe comme erreur : la suite commence par la passe', () => {
    const x = expliquerErreur(entree({ avant, joue: -1, bon: 'D4', pvRiposte: [L('E5')] }))!;
    expect(x.suiteJoue.coups).toEqual([-1, L('E5')]);
  });
  it('une propriété mal formée (taille, NaN) est ignorée', () => {
    const x = expliquerErreur(entree({ avant, joue: 'E5', bon: 'D4', ownBon: new Float32Array(10), ownJoue: propriete({ A1: Number.NaN }) }))!;
    expect(x.faits).toEqual([]);
    expect(x.calme).toBe(false);
  });
  it('une variante qui ne commence pas par le bon coup est ignorée', () => {
    const x = expliquerErreur(entree({ avant, joue: 'E5', bon: 'D4', pvBon: [L('E4'), L('F4')] }))!;
    expect(x.suiteBon.coups).toEqual([L('D4')]);
  });
});

describe('outils', () => {
  it('suiteJouee : s’arrête à une passe après le premier coup, à un coup illégal, et à la longueur maximale', () => {
    const p = position(['C3'], []);
    expect(suiteJouee(p, [L('D4'), -1, L('E5')]).coups).toEqual([L('D4')]);
    expect(suiteJouee(p, [L('D4'), L('C3'), L('E5')]).coups).toEqual([L('D4')]);
    expect(suiteJouee(p, ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1'].map(L)).coups).toHaveLength(SEUILS.longueurSuite);
  });
  it('regrouper : diagonales et sauts d’un point vide font un groupe', () => {
    const p = position(['C3', 'D4', 'F4', 'H8'], []);
    expect(regrouper(p, ['C3', 'D4', 'F4', 'H8'].map(L)).map(Ls)).toEqual([['D4', 'F4', 'C3'], ['H8']]);
  });
  it('coins, bords et centre : 9 cases d’un tiers du plateau', () => {
    expect([bande(9), bande(13), bande(19)]).toEqual([3, 4, 6]);
    expect(dansLieu(L('C3'), 9, 'coinBasGauche')).toBe(true);
    expect(dansLieu(L('D3'), 9, 'bordBas')).toBe(true);
    expect(dansLieu(L('E5'), 9, 'centre')).toBe(true);
    expect(dansLieu(L('E5'), 9, 'bas')).toBe(false);
    let n = 0;
    for (let p = 0; p < 81; p++) n += ['coinHautGauche', 'coinHautDroite', 'coinBasGauche', 'coinBasDroite', 'bordHaut', 'bordBas', 'bordGauche', 'bordDroite', 'centre'].filter(l => dansLieu(p, 9, l as never)).length;
    expect(n).toBe(81);
  });
  it('distance de Tchebychev', () => {
    expect(distance(L('C3'), L('G7'), 9)).toBe(4);
    expect(distance(L('C3'), L('D4'), 9)).toBe(1);
  });
  it('zoneDe : total négatif ou nul, pas de zone', () => {
    expect(zoneDe(position([], []), new Float64Array(81).fill(-0.1), { min: 0, max: 5 }, new Set())).toBeNull();
  });
});
