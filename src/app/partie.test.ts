import { describe, expect, it } from 'vitest';
import { aideActive, ALERTE_ATARI, arrondiDemi, conseilPasser, passerEnEvidence, EXPLICATION_PASSER, PASSER_KEY, presquePlein, coupsJoues, descriptionIndices, EXPLICATION_ATARI, groupesEnAtari, indicesRestants, INDICES_PAR_PARTIE, libelleAvantage, libelleCoup, messageAtari, messageIndice, metEnAtari, nouveauxAtari, partNoir, PLUS_D_INDICE } from './partie';
import { choisirReplique, GENERIQUES, LONGUEUR_MAX, PERSONNELLES, repliques, type Situation } from './repliques';

describe('conseil « passer » (#120)', () => {
  const memoire = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
  const vide = new Int8Array(81);
  const plein = new Int8Array(81).map((_, i) => (i < 60 ? 1 + (i % 2) : 0));
  it('dès que Pomme passe : une seule fois, avec le mot expliqué', () => {
    const s = memoire();
    expect(conseilPasser('Pomme', true, true, vide, s)).toBe(`Pomme passe. Plus rien à gagner ? Passe aussi, et on compte. ${EXPLICATION_PASSER}`);
    expect(s.getItem(PASSER_KEY)).toBe('true');
    expect(conseilPasser('Pomme', true, true, vide, s)).toBeNull();
  });
  it('plateau presque plein : le conseil de fin', () => {
    expect(presquePlein(vide)).toBe(false);
    expect(presquePlein(plein)).toBe(true);
    expect(conseilPasser('Pomme', true, false, vide, memoire())).toBeNull();
    expect(conseilPasser('Pomme', true, false, plein, memoire())).toBe(`Plus rien à gagner ? Passe. Si Pomme passe aussi, on compte. ${EXPLICATION_PASSER}`);
  });
  it("aide coupée : rien, et rien n'est mémorisé", () => {
    const s = memoire();
    expect(conseilPasser('Pomme', false, true, plein, s)).toBeNull();
    expect(s.getItem(PASSER_KEY)).toBeNull();
  });
});
import { newPosition, play, type Position } from '../go/rules';
import { fromLabel } from '../go/coords';
import { fromRows } from '../go/position';

describe("indices limités contre l'ordi (#35)", () => {
  it('donne 3 indices par partie, puis plus aucun', () => {
    expect(INDICES_PAR_PARTIE).toBe(3);
    expect([0, 1, 2, 3].map(indicesRestants)).toEqual([3, 2, 1, 0]);
    expect(indicesRestants(7)).toBe(0);
    expect(indicesRestants(-1)).toBe(3);
  });
  it('annonce la fin des indices seulement avec le dernier', () => {
    expect(messageIndice(2)).not.toContain(PLUS_D_INDICE);
    expect(messageIndice(1)).not.toContain(PLUS_D_INDICE);
    expect(messageIndice(0)).toMatch(/^Regarde dans le cercle vert/);
    expect(messageIndice(0)).toContain("Plus d'indice pour cette partie. À toi de jouer !");
  });
  it("décrit le nombre restant pour les lecteurs d'écran", () => {
    expect(descriptionIndices(3)).toBe('3 indices restants');
    expect(descriptionIndices(1)).toBe('1 indice restant');
    expect(descriptionIndices(0)).toBe("Plus d'indice pour cette partie");
  });
});

describe("aide de Mochi : alerte d'atari (#35)", () => {
  // Plateaux 5 × 5, y depuis le haut : l'index d'un point est y * 5 + x.
  it("coin : la pierre noire du coin n'a plus qu'une liberté", () => {
    const { pos } = fromRows(['X....', 'O....', '.....', '.....', '.....']);
    expect(groupesEnAtari(pos.board, 5, 1)).toEqual([{ pierres: [0], liberte: 1 }]);
    expect(groupesEnAtari(pos.board, 5, 2)).toEqual([]);
  });

  it('bord : une pierre du bord bloquée de deux côtés', () => {
    const { pos } = fromRows(['.OXO.', '.....', '.....', '.....', '.....']);
    expect(groupesEnAtari(pos.board, 5, 1)).toEqual([{ pierres: [2], liberte: 7 }]);
  });

  it('groupe de deux pierres : une seule liberté commune', () => {
    const { pos } = fromRows(['OXX..', '.OO..', '.....', '.....', '.....']);
    const [g, autre] = groupesEnAtari(pos.board, 5, 1);
    expect(autre).toBeUndefined();
    expect([...g.pierres].sort()).toEqual([1, 2]);
    expect(g.liberte).toBe(3);
  });

  it("pas d'alerte avec deux libertés", () => {
    const { pos } = fromRows(['.XX..', '.OO..', '.....', '.....', '.....']);
    expect(groupesEnAtari(pos.board, 5, 1)).toEqual([]);
  });

  it('partie scriptée : une alerte à chaque nouvel atari, pas deux fois pour le même groupe', () => {
    const h = suite(9, ['E5', 'D5', 'A1', 'F5', 'A2', 'E6']);
    const alertes = h.slice(1).map((q, i) => nouveauxAtari(h[i].board, q.board, 9, 1).length);
    expect(alertes).toEqual([0, 0, 0, 0, 0, 1]);
    const noir = play(h[h.length - 1], fromLabel('J9', 9)) as Position;
    const blanc = play(noir, fromLabel('J1', 9)) as Position;
    expect(nouveauxAtari(noir.board, blanc.board, 9, 1)).toEqual([]);
  });

  it('message : avec explication la première fois, sans ensuite', () => {
    expect(messageAtari(true)).toBe(`${ALERTE_ATARI} ${EXPLICATION_ATARI}`);
    expect(messageAtari(false)).toBe("Atari ! Ton groupe n'a plus qu'une liberté. Sauve-le ou contre-attaque.");
    expect(messageAtari(true)).toContain("Atari : il ne reste qu'une liberté, la pierre peut être prise au prochain coup.");
  });

  it('active par défaut contre Pomme et Caillou seulement, et réglable', () => {
    expect(aideActive(undefined, 'pomme')).toBe(true);
    expect(aideActive('auto', 'caillou')).toBe(true);
    expect(aideActive('auto', 'bambou')).toBe(false);
    expect(aideActive('oui', 'sensei')).toBe(true);
    expect(aideActive('non', 'pomme')).toBe(false);
  });
});

/** Joue une suite de coups affichés (« D5 », « passe ») depuis un plateau vide ; les couleurs alternent. */
function suite(size: number, coups: string[]): Position[] {
  const h = [newPosition(size)];
  for (const c of coups) {
    const r = play(h[h.length - 1], fromLabel(c, size));
    if (typeof r === 'string') throw new Error(`${c} : ${r}`);
    h.push(r);
  }
  return h;
}

describe("barre d'avantage", () => {
  it('libellé : couleur en tête, arrondi au demi-point, virgule décimale', () => {
    expect(libelleAvantage(3.4)).toBe('Noir +3,5');
    expect(libelleAvantage(-6.5)).toBe('Blanc +6,5');
    expect(libelleAvantage(12.1)).toBe('Noir +12');
    expect(libelleAvantage(0.2)).toBe('À égalité');
    expect(libelleAvantage(-0.24)).toBe('À égalité');
    expect(arrondiDemi(2.76)).toBe(3);
  });

  it('part de Noir : 50 % à égalité, monotone, jamais pleine ni vide', () => {
    expect(partNoir(0, 9)).toBe(0.5);
    expect(partNoir(5, 9)).toBeGreaterThan(0.5);
    expect(partNoir(-5, 9)).toBeLessThan(0.5);
    expect(partNoir(10, 9)).toBeGreaterThan(partNoir(5, 9));
    expect(partNoir(500, 9)).toBe(0.96);
    expect(partNoir(-500, 19)).toBe(0.04);
    // Le même écart pèse moins sur un grand plateau.
    expect(partNoir(10, 19)).toBeLessThan(partNoir(10, 9));
  });
});

describe('liste des coups', () => {
  it('numérote les coups et écrit « passe »', () => {
    const h = suite(9, ['D6', 'G6', 'passe']);
    expect(coupsJoues(h)).toEqual([fromLabel('D6', 9), fromLabel('G6', 9), -1]);
    expect(coupsJoues(h).map((m, i) => libelleCoup(i + 1, m, 9))).toEqual(['1. D6', '2. G6', '3. passe']);
    expect(libelleCoup(11, fromLabel('F7', 9), 9)).toBe('11. F7');
  });
});

describe("détection d'atari", () => {
  // Blanc E5 entouré par Noir D5, F5, E6 : il ne lui reste que E4.
  const h = suite(9, ['D5', 'E5', 'F5', 'A1', 'E6']);
  const avant = h[h.length - 2], apres = h[h.length - 1];

  it('trouve les groupes à une seule liberté, avec cette liberté', () => {
    expect(groupesEnAtari(apres.board, 9, 2)).toEqual([{ pierres: [fromLabel('E5', 9)], liberte: fromLabel('E4', 9) }]);
    expect(groupesEnAtari(apres.board, 9, 1)).toEqual([]);
  });

  it('ne signale que les nouveaux atari', () => {
    expect(nouveauxAtari(avant.board, apres.board, 9, 2)).toHaveLength(1);
    // Un coup ailleurs : E5 était déjà en atari, pas de nouvelle alerte.
    const ailleurs = play(apres, fromLabel('J9', 9)) as Position;
    expect(nouveauxAtari(apres.board, ailleurs.board, 9, 2)).toEqual([]);
  });

  it('A1 dans le coin : deux libertés, pas d’atari ; le coup E6 met en atari', () => {
    expect(groupesEnAtari(apres.board, 9, 2).some(g => g.pierres.includes(fromLabel('A1', 9)))).toBe(false);
    expect(metEnAtari(apres, fromLabel('E6', 9))).toBe(true);
    expect(metEnAtari(h[1], fromLabel('D5', 9))).toBe(false);
    expect(metEnAtari(apres, -1)).toBe(false);
  });
});

describe('répliques des adversaires', () => {
  const situations = Object.keys(GENERIQUES) as Situation[];

  it('2 à 3 répliques par situation, assez courtes pour tenir à côté du nom', () => {
    for (const s of situations) {
      expect(GENERIQUES[s].length).toBeGreaterThanOrEqual(2);
      expect(GENERIQUES[s].length).toBeLessThanOrEqual(3);
      for (const r of GENERIQUES[s]) expect(r.length).toBeLessThanOrEqual(LONGUEUR_MAX);
    }
  });

  it('choisit au hasard parmi les répliques, sans répéter la précédente', () => {
    const liste = GENERIQUES.captureSubie;
    expect(choisirReplique('pomme', 'captureSubie', null, () => 0)).toBe(liste[0]);
    expect(choisirReplique('pomme', 'captureSubie', null, () => 0.999)).toBe(liste[liste.length - 1]);
    for (let i = 0; i < 20; i++) {
      const a = i / 20;
      expect(choisirReplique('pomme', 'captureSubie', liste[0], () => a)).not.toBe(liste[0]);
    }
  });

  it('une réplique personnelle remplace la générique pour cet adversaire seulement', () => {
    PERSONNELLES.renard = { capture: ['Trop facile.'] };
    try {
      expect(repliques('renard', 'capture')).toEqual(['Trop facile.']);
      expect(choisirReplique('renard', 'capture', 'Trop facile.')).toBe('Trop facile.'); // une seule : on la répète
      expect(repliques('renard', 'passe')).toEqual(GENERIQUES.passe);
      expect(repliques('pomme', 'capture')).toEqual(GENERIQUES.capture);
    } finally {
      delete PERSONNELLES.renard;
    }
  });
});

describe('passerEnEvidence (#120)', () => {
  it("met « Passer » en évidence juste après le conseil de Mochi, puis plus dès qu'un coup est joué", () => {
    expect(passerEnEvidence(true, true, false, 12, 12)).toBe(true);
    expect(passerEnEvidence(true, true, false, 12, 13)).toBe(false);
    expect(passerEnEvidence(true, true, false, null, 12)).toBe(false);
  });
  it("quand l'adversaire vient de passer", () => {
    expect(passerEnEvidence(true, true, true, null, 5)).toBe(true);
  });
  it("jamais si l'aide est coupée ou si ce n'est pas ton tour", () => {
    expect(passerEnEvidence(false, true, true, 12, 12)).toBe(false);
    expect(passerEnEvidence(true, false, true, 12, 12)).toBe(false);
  });
});
