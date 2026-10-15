// Issue #549 : comprendre son erreur et solution complète. Chaque réponse montrée est revérifiée ici avec le lecteur
// indépendant du lot A (src/go/lecteurs-lot-a.ts, celui des preuves), et chaque phrase ne dit que des faits.
import { describe, expect, it } from 'vitest';
import LOT_A from '../content/lots/a-capture';
import LOT_N from '../content/lots/n-debutants';
import LOT_X from '../content/lots/x-ko-ouverture';
import { refutation } from './aide';
import { BASE_PUZZLES, PUZZLES_16 } from '../content/puzzles';
import { parsePuzzles, startOf, type Puzzle } from '../data/puzzles';
import { fromLabel, toLabel } from '../go/coords';
import { blackCaptures, whiteFails } from '../go/lecteurs-lot-a';
import { attaquantPrend, compteur as compteurBorne, coupsPourPrendre, defenseurEchoue, K_ECHELLE, K_MAX } from '../go/lecture-capture';
import { groupAt, play, type Position } from '../go/rules';
import { traduire } from '../content/i18n/secondaires';
import { butDe, comprendreErreur, solutionComplete, SOLUTION_MAX } from './comprendreErreur';

/** Tests déterministes : budget en coups seulement, sans délai (l'app lit au plus DELAI_LECTURE ms). */
const compteur = (budget = 1e5) => compteurBorne(budget, Infinity);

const tous = parsePuzzles([...BASE_PUZZLES, ...PUZZLES_16, ...LOT_A]);
const pz = (id: string) => tous.find(p => p.id === id)!;
const at = (l: string) => fromLabel(l, 9);
const libs = (pos: Position, p: number) => groupAt(pos.board, pos.size, p).liberties.size;
const coupsFaux = (p: Puzzle) => {
  const { pos } = startOf(p);
  return [...Array(pos.board.length).keys()].filter(m => !p.answers.includes(m) && typeof play(pos, m) !== 'string');
};
/** Coups de Noir qu'il lui reste après le bon coup (lecteur du lot A, indépendant). */
const resteApresBon = (p: Puzzle) => {
  const { pos, marked } = startOf(p);
  const r = play(pos, p.answers[0]) as Position;
  for (let k = 0; k <= 5; k++) if (whiteFails(r, marked, k)) return k;
  throw new Error(p.id);
};

describe('lecteur exact borné (src/go/lecture-capture.ts)', () => {
  it('lit une capture immédiate et une échelle', () => {
    expect(coupsPourPrendre(startOf(pz('a01')).pos, startOf(pz('a01')).marked, compteur())).toBe(1);
    // L'échelle de b6 dépasse la lecture complète (K_MAX) : la lecture d'échelle la trouve.
    const b6 = startOf(pz('b6'));
    expect(coupsPourPrendre(b6.pos, b6.marked, compteur(), K_ECHELLE, true)).toBeGreaterThan(K_MAX);
  });
  it('un budget épuisé ne répond ni vrai ni faux', () => {
    const b6 = startOf(pz('b6'));
    expect(attaquantPrend(b6.pos, b6.marked, 4, compteur(5))).toBeNull();
  });
  it('dit comme le lecteur du lot A sur les problèmes du lot A', () => {
    for (const p of tous.filter(x => x.id.startsWith('a'))) {
      const { pos, marked } = startOf(p);
      for (let k = 1; k <= 3; k++) {
        const v = attaquantPrend(pos, marked, k, compteur(1e7));
        expect(v, `${p.id} k=${k}`).toBe(blackCaptures(pos, marked, k));
      }
    }
  });
});

describe('but d’un problème', () => {
  it('prendre (pierres blanches marquées), sauver (ta pierre marquée), ou rien', () => {
    expect(butDe(pz('a01'))?.type).toBe('prendre');
    expect(butDe(pz('b4'))?.type).toBe('sauver');
    expect(butDe({ ...pz('a01'), rows: pz('a01').rows.map(r => r.replace('T', 'O')) })).toBeNull();
  });
});

describe('comprendre un coup faux (prendre)', () => {
  it('a01 : coup loin de tout, Blanc s’échappe au point clé, et la phrase dit le point et les libertés', () => {
    const e = comprendreErreur(pz('a01'), at('A9'), compteur())!;
    expect(e).not.toBeNull();
    expect(toLabel(e.reponse, 9)).toBe('E4');
    expect(e.phrase).toBe(`${traduire('fr', 'erreur.prendre.repond', { couleur: 'Blanc', point: 'E4' })} ${traduire('fr', 'erreur.libertes.groupe', { n: libs(e.pos, at('E5')) })}`);
  });

  for (const id of ['a01', 'a09', 'a11', 'c1', 'b3']) {
    it(`${id} : chaque réponse montrée est une vraie réfutation (revérifiée par le lecteur du lot A)`, () => {
      const p = pz(id), { marked } = startOf(p), k = resteApresBon(p);
      let vus = 0;
      for (const f of coupsFaux(p)) {
        const e = comprendreErreur(p, f, compteur());
        if (!e) continue;
        vus++;
        expect(e.pos.board[e.reponse]).toBe(2);
        expect(e.pos.toPlay).toBe(1);
        // Après la réponse, Noir ne peut plus prendre dans les coups qui lui restaient avec la bonne réponse.
        expect(blackCaptures(e.pos, marked, k), `${id} ${toLabel(f, 9)} → ${toLabel(e.reponse, 9)}`).toBe(false);
        expect(e.phrase).toContain(toLabel(e.reponse, 9));
      }
      expect(vus).toBeGreaterThan(0);
    });
  }

  it('un coup qui gagne aussi (plus lentement ou autrement) n’est jamais « réfuté » à tort', () => {
    // a09 : la consigne exige l'atari d'abord ; un coup qui prend quand même dans la borne n'a pas de réfutation.
    const p = pz('a09'), { pos, marked } = startOf(p), k = resteApresBon(p);
    for (const f of coupsFaux(p)) {
      const r = play(pos, f) as Position;
      if (whiteFails(r, marked, k)) expect(comprendreErreur(p, f, compteur()), toLabel(f, 9)).toBeNull();
    }
  });

  it('n06 : la réponse jouée est celle dont parle le texte du problème (« Blanc s’allonge en B1 »), prouvée', () => {
    const p = parsePuzzles(LOT_N).find(x => x.id === 'n06')!;
    expect(p.refutation).toContain('Blanc s');
    const e = comprendreErreur(p, at('D3'), compteur())!;
    expect(toLabel(e.reponse, 9)).toBe('B1');
    expect(e.phrase.startsWith('Blanc se relie en B1.') || e.phrase.startsWith('Blanc répond en B1.')).toBe(true);
  });

  it('budget épuisé : rien n’est affirmé', () => {
    expect(comprendreErreur(pz('b6'), at('A9'), compteur(3))).toBeNull();
  });
  it('une bonne réponse n’a pas de réfutation', () => {
    expect(comprendreErreur(pz('a01'), at('E4'))).toBeNull();
  });
});

describe('problèmes de ko : comportement d’avant (CI de #551)', () => {
  it('x01, x02, x03 : pas de but lu, pas de réponse calculée ; la réponse au point clé de #237 reste', () => {
    const lot = parsePuzzles(LOT_X);
    for (const id of ['x01', 'x02', 'x03']) {
      const p = lot.find(x => x.id === id)!;
      expect(butDe(p), id).toBeNull();
      expect(comprendreErreur(p, coupsFaux(p)[0], compteur()), id).toBeNull();
      expect(solutionComplete(p, compteur()), id).toBeNull();
    }
    const x03 = lot.find(x => x.id === 'x03')!;
    expect(toLabel(refutation(x03, at('C5'))!.reponse!, 9)).toBe('F5');
  });
});

describe('comprendre un coup faux (sauver)', () => {
  it('b4 : ta pierre en atari, coup ailleurs : Blanc la prend, et la phrase le dit', () => {
    const e = comprendreErreur(pz('b4'), at('A9'), compteur())!;
    expect(e.phrase).toBe(traduire('fr', 'erreur.sauver.prise', { couleur: 'Blanc', point: toLabel(e.reponse, 9) }));
    expect(e.pos.board[at('D5')]).toBe(0);
  });
  it('« ne peut plus être sauvée » n’est dit que si la prise est prouvée quoi que tu joues', () => {
    for (const id of ['b4', 'b5']) {
      const p = pz(id), { marked } = startOf(p);
      for (const f of coupsFaux(p)) {
        const e = comprendreErreur(p, f, compteur());
        if (!e) continue;
        const pris = marked.some(m => e.pos.board[m] !== 1);
        if (!pris) expect(defenseurEchoue(e.pos, marked, 5, compteur(1e7)), `${id} ${toLabel(f, 9)}`).toBe(true);
      }
    }
  });
});

describe('solution complète', () => {
  for (const id of ['b6', 'a09', 'c1', 'c2']) {
    it(`${id} : bon coup, défense, … jusqu’à la prise ; chaque coup est légal et légendé`, () => {
      const p = pz(id), { marked } = startOf(p);
      const s = solutionComplete(p, compteur())!;
      expect(s, id).not.toBeNull();
      expect(s.length - 1).toBeGreaterThanOrEqual(2);
      expect(s.length - 1).toBeLessThanOrEqual(SOLUTION_MAX);
      expect(s[1].pos.lastMove).toBe(p.answers[0]);
      // Les couleurs alternent (une passe est permise pour l'adversaire qui ne peut plus rien).
      s.slice(1).forEach((c, i) => {
        expect(c.pos.toPlay).toBe(i % 2 === 0 ? 2 : 1);
        expect(c.legende.length).toBeGreaterThan(5);
        if (c.pos.lastMove !== null && c.pos.lastMove >= 0) expect(c.legende).toContain(toLabel(c.pos.lastMove, 9));
      });
      // La dernière position : une pierre marquée est prise.
      expect(marked.some(m => s.at(-1)!.pos.board[m] !== 2)).toBe(true);
      // Après chaque coup de Noir, Blanc ne pouvait plus sauver ses pierres dans la suite restante : revérifié par le
      // lecteur indépendant du lot A jusqu'à 3 coups (au-delà, sa recherche complète est trop longue pour la CI).
      for (let i = 1; i < s.length; i += 2) {
        const reste = Math.ceil((s.length - 1 - i) / 2);
        if (reste <= 3) expect(whiteFails(s[i].pos, marked, reste), `${id} coup ${i}`).toBe(true);
      }
    }, 60_000);
  }
  it('problème sans pierres marquées, ou de sauvetage : pas de solution complète', () => {
    expect(solutionComplete(pz('b4'))).toBeNull();
    expect(solutionComplete({ ...pz('a01'), rows: pz('a01').rows.map(r => r.replace('T', 'O')) })).toBeNull();
  });
  it('capture en un coup : la réponse suffit, pas de solution complète', () => {
    expect(solutionComplete(pz('a01'))).toBeNull();
  });
});
