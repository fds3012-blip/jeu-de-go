// Issue #549 : comprendre son erreur et solution complète. Chaque réponse montrée est revérifiée ici avec le lecteur
// indépendant du lot A (src/go/lecteurs-lot-a.ts, celui des preuves), et chaque phrase ne dit que des faits.
import { describe, expect, it } from 'vitest';
import LOT_A from '../content/lots/a-capture';
import LOT_N from '../content/lots/n-debutants';
import LOT_X from '../content/lots/x-ko-ouverture';
import { refutation } from './aide';
import { ALL_PUZZLES, BASE_PUZZLES, PUZZLES_16 } from '../content/puzzles';
import { parsePuzzles, startOf, type Puzzle } from '../data/puzzles';
import { fromLabel, toLabel } from '../go/coords';
import { blackCaptures, whiteFails } from '../go/lecteurs-lot-a';
import { attaquantPrend, compteur as compteurBorne, coupsPourPrendre, defenseurEchoue, K_ECHELLE, K_MAX } from '../go/lecture-capture';
import { groupAt, play, type Position } from '../go/rules';
import { traduire } from '../content/i18n/secondaires';
import { butDe, comprendreErreur, repliqueFigee, repliquesDuTexte, solutionComplete, SOLUTION_MAX } from './comprendreErreur';
import { REFUTATIONS_LOCALES } from '../go/refutations-locales.gen';

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

describe('texte relu : la réplique nommée, et celle réservée à une erreur (#554)', () => {
  const lab = (ps: number[]) => ps.map(p => toLabel(p, 9));
  it('« Blanc joue G1, ou D1 si tu as joué E1 » : D1 d’abord après E1, G1 seul sinon', () => {
    const texte = 'Pas tout à fait. Blanc joue G1, ou D1 si tu as joué E1. Il garde assez de place.';
    expect(lab(repliquesDuTexte(texte, 'Blanc', at('E1'), 9))).toEqual(['D1', 'G1']);
    expect(lab(repliquesDuTexte(texte, 'Blanc', at('C1'), 9))).toEqual(['G1']);
  });
  it('plusieurs erreurs, plusieurs réserves, et l’anglais', () => {
    const fr = 'Blanc joue D2 (ou D1 si tu as joué C2, ou C2 si tu as joué D1) : ton espace rétrécit.';
    expect(lab(repliquesDuTexte(fr, 'Blanc', at('D1'), 9))).toEqual(['C2', 'D2']);
    expect(lab(repliquesDuTexte(fr, 'Blanc', at('C2'), 9))).toEqual(['D1', 'D2']);
    expect(lab(repliquesDuTexte('White plays B2 (or B1 if you played A2 or C2).', 'White', at('C2'), 9))).toEqual(['B1', 'B2']);
    expect(repliquesDuTexte(null, 'Blanc', -1, 9)).toEqual([]);
    expect(repliquesDuTexte('Rien à dire.', 'Blanc', -1, 9)).toEqual([]);
  });
});

describe('vie et mort, seki, course : réplique figée hors ligne (#554)', () => {
  const lot = parsePuzzles(ALL_PUZZLES);
  const p = (id: string) => lot.find(x => x.id === id)!;
  const fr = (cle: Parameters<typeof traduire>[1], params?: Record<string, string | number>) =>
    (traduire as (l: 'fr', c: typeof cle, p?: Record<string, string | number>) => string)('fr', cle, params);

  it('m01 (vivre) : Blanc prend ton point, E1 ; « ton groupe ne peut plus vivre »', () => {
    const e = comprendreErreur(p('m01'), at('A9'))!;
    expect(toLabel(e.reponse, 9)).toBe('E1');
    expect(e.phrase).toBe(`${fr('erreur.vm.pointCle', { couleur: 'Blanc', point: 'E1' })} ${fr('erreur.vm.mort')}`);
    expect(e.but).toBe('sauver');
  });

  it('q01 (vivre) : Blanc D2 rend C1 faux ; la prise passerait par un ko : on dit seulement « pas deux yeux »', () => {
    const e = comprendreErreur(p('q01'), at('A9'))!;
    expect(toLabel(e.reponse, 9)).toBe('D2');
    expect(e.phrase).toBe(`${fr('erreur.vm.fauxOeil', { couleur: 'Blanc', point: 'D2', oeil: 'C1' })} ${fr('erreur.vm.sansYeux')}`);
  });

  it('q02 (tuer) : Blanc F2, et son groupe a deux yeux', () => {
    const e = comprendreErreur(p('q02'), at('A9'))!;
    expect(e.phrase).toBe(`${fr('erreur.vm.pointCle', { couleur: 'Blanc', point: 'F2' })} ${fr('erreur.vm.deuxYeux')}`);
    expect(e.but).toBe('prendre');
  });

  it('q03 : le texte réserve D1 à l’erreur E1 : c’est D1 qui est joué', () => {
    expect(toLabel(comprendreErreur(p('q03'), at('E1'))!.reponse, 9)).toBe('D1');
    expect(toLabel(comprendreErreur(p('q03'), at('A9'))!.reponse, 9)).toBe('G1');
  });

  it('course (z02, deux groupes marqués) : « tu perds la course aux libertés »', () => {
    const e = comprendreErreur(p('z02'), at('E5'))!;
    expect(toLabel(e.reponse, 9)).toBe('A2');
    expect(e.phrase).toBe(`${fr('erreur.vm.joue', { couleur: 'Blanc', point: 'A2' })} ${fr('erreur.vm.course')}`);
  });

  it('lecture de capture figée (d05, course ouverte) : la phrase de faits de #549', () => {
    const e = comprendreErreur(p('d05'), at('J9'))!;
    expect(e.phrase.startsWith(fr('erreur.prendre.repond', { couleur: 'Blanc', point: toLabel(e.reponse, 9) }))).toBe(true);
  });

  it('le fichier fait foi : aucune lecture en direct pour ses problèmes (même avec un budget nul)', () => {
    const vide = compteurBorne(0, 0);
    for (const id of ['m01', 'q01', 'z02', 'd05', 'w01']) {
      const pb = p(id), f = coupsFaux(pb)[0], figee = repliqueFigee(pb, f);
      expect(figee, id).toBeTruthy();
      expect(comprendreErreur(pb, f, vide)?.reponse, id).toBe(figee!.reponse);
    }
    // Rien de prouvé pour ce coup : rien n'est dit (pas de lecture de secours).
    expect(repliqueFigee(p('a14'), at('A1'))).toBeUndefined();
  });

  it('chaque réplique figée donne une phrase qui nomme le point joué, et la position suit la réplique', () => {
    for (const pb of lot.filter(x => REFUTATIONS_LOCALES[x.id])) {
      for (const f of coupsFaux(pb)) {
        const figee = repliqueFigee(pb, f), e = comprendreErreur(pb, f, compteurBorne(0, 0));
        if (!figee) { expect(e, `${pb.id} ${toLabel(f, 9)}`).toBeNull(); continue; }
        expect(e, `${pb.id} ${toLabel(f, 9)}`).not.toBeNull();
        expect(e!.phrase).toContain(toLabel(figee.reponse, 9));
        expect(e!.pos.lastMove).toBe(figee.reponse);
        expect(e!.pos.toPlay).toBe(pb.toPlay);
      }
    }
  });
});
