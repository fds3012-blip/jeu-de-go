// Partie de découverte (#524) : la partie est rejouée coup par coup avec le moteur de règles (src/go), et chaque
// affirmation de Mochi est vérifiée sur la position où il la dit. Règle d'or de Florian : aucune explication fausse.
// Recherches bornées (lecteurs tactiques à profondeur fixe, positions 9 × 9) : rien de lourd.
import { describe, expect, it } from 'vitest';
import { MORTES, NOTIONS, SCENARIO, TAILLE, coupsDu, estDebutDeNotion, jouer, positionAvant, rangNotion, type Moment } from './decouverte';
import { DECOUVERTE_FR, type CleDecouverte } from './decouverte.fr';
import { DECOUVERTE_EN } from './decouverte.en';
import { fromLabel, toLabel } from '../go/coords';
import { groupAt, neighbors, play, type Position } from '../go/rules';
import { score } from '../go/score';
import { frontieresOuvertes } from '../go/frontieres';
import { canEscape, captureWorks, defenceFails, hasTwoEyes } from '../go/tactics';
import { KOMI_NORMAL } from '../app/equilibrage';

const P = (s: string) => fromLabel(s, TAILLE);
const indexDe = (id: string) => { const i = SCENARIO.findIndex(m => m.id === id); if (i < 0) throw new Error(id); return i; };
const avant = (id: string) => positionAvant(indexDe(id)).pos;
const libertes = (pos: Position, s: string) => [...groupAt(pos.board, TAILLE, P(s)).liberties].map(p => toLabel(p, TAILLE)).sort();
const memeChaine = (pos: Position, a: string, b: string) => groupAt(pos.board, TAILLE, P(a)).stones.includes(P(b));
const texte = (k: string) => DECOUVERTE_FR[k as CleDecouverte];
const anglais = (k: string) => DECOUVERTE_EN[k as CleDecouverte];
/** Coups légaux du camp au trait (sans la passe). */
const legaux = (pos: Position) => Array.from({ length: TAILLE * TAILLE }, (_, p) => p).filter(p => typeof play(pos, p) !== 'string');
/** Voisins vides communs à deux pierres. */
const pointsCommuns = (pos: Position, a: string, b: string) => {
  const nb = neighbors(TAILLE);
  return nb[P(a)].filter(p => nb[P(b)].includes(p) && pos.board[p] === 0).map(p => toLabel(p, TAILLE));
};
const coin = (a: string, b: string) => {
  const [xa, ya, xb, yb] = [P(a) % TAILLE, Math.floor(P(a) / TAILLE), P(b) % TAILLE, Math.floor(P(b) / TAILLE)];
  return Math.abs(xa - xb) === 1 && Math.abs(ya - yb) === 1;
};
const finale = positionAvant(SCENARIO.length).pos;
const mortes = new Set(MORTES.map(P));
const compte = score(finale, KOMI_NORMAL, 'japanese', mortes);

describe('partie de découverte : le scénario', () => {
  it('se rejoue en entier, Noir et Blanc à tour de rôle, et finit par deux passes (Noir, puis Blanc)', () => {
    const coups = SCENARIO.flatMap(coupsDu);
    expect(coups.length % 2).toBe(0); // Noir commence, Blanc finit (sa passe)
    expect(coups.slice(-2)).toEqual(['passe', 'passe']);
    expect(coups.slice(0, -2)).not.toContain('passe'); // aucune autre passe avant la fin
    expect(finale.lastMove).toBe(-1);
    expect(finale.toPlay).toBe(1);
    // Une seule partie : chaque moment repart exactement de la fin du précédent.
    // Pendant la partie (avant le comptage), c'est toujours à Noir, le joueur, d'agir.
    for (let i = 0; i < SCENARIO.length; i++) {
      if (SCENARIO[i].type === 'compte') continue;
      const { pos } = positionAvant(i);
      expect(pos.toPlay, SCENARIO[i].id).toBe(1);
    }
  });

  it('fait vivre les 15 notions, chacune d’un seul tenant et dans l’ordre', () => {
    expect(NOTIONS).toHaveLength(15);
    const ordre = SCENARIO.map(rangNotion);
    for (let i = 1; i < ordre.length; i++) expect(ordre[i] - ordre[i - 1], SCENARIO[i].id).toBeGreaterThanOrEqual(0);
    expect(new Set(SCENARIO.map(m => m.notion))).toEqual(new Set(NOTIONS));
    expect(SCENARIO.filter((_, i) => estDebutDeNotion(i))).toHaveLength(15);
  });

  it('chaque coup attendu est légal et n’est pas déjà refusé ; chaque erreur expliquée est un coup légal différent', () => {
    for (let i = 0; i < SCENARIO.length; i++) {
      const m = SCENARIO[i], { pos } = positionAvant(i);
      if (m.type === 'coup') {
        expect(typeof play(pos, P(m.attendu)), m.id).not.toBe('string');
        for (const e of m.erreurs ?? []) {
          expect(e, m.id).not.toBe(m.attendu);
          expect(typeof play(pos, P(e)), `${m.id} ${e}`).not.toBe('string');
        }
      }
    }
  });

  it('les identifiants sont uniques, et chaque moment a ses textes (consigne, bravo, erreurs) en français et en anglais', () => {
    expect(new Set(SCENARIO.map(m => m.id)).size).toBe(SCENARIO.length);
    const attendues = SCENARIO.flatMap(m => [
      m.id,
      ...(m.type === 'coup' || m.type === 'essai' || m.type === 'passe' ? [`${m.id}.non`] : []),
      ...(m.type === 'coup' && m.bravo ? [`${m.id}.bravo`] : []),
      ...(m.type === 'passe' ? [`${m.id}.territoire`] : []),
      ...(m.type === 'coup' ? (m.erreurs ?? []).map(e => `${m.id}.non.${e}`) : []),
    ]);
    for (const k of attendues) { expect(texte(k), k).toBeTruthy(); expect(anglais(k), k).toBeTruthy(); }
    for (const n of NOTIONS) expect(texte(`notion.${n}`), n).toBeTruthy();
    // Aucun texte de moment orphelin.
    const ids = new Set(SCENARIO.map(m => m.id));
    for (const k of Object.keys(DECOUVERTE_FR)) {
      const racine = k.split('.')[0];
      if (!['ecran', 'fin', 'refus', 'notion'].includes(racine)) expect(ids.has(racine), k).toBe(true);
    }
  });
});

describe('partie de découverte : chaque affirmation de Mochi', () => {
  it('1. poser : la pierre se pose au centre', () => {
    expect(SCENARIO[0]).toMatchObject({ attendu: 'E5' });
    expect(libertes(jouer(avant('poser'), 'E5'), 'E5')).toHaveLength(4);
  });

  it('2. libertés : la pierre de Mochi touche celle du joueur et a 3 libertés ; après le coup, 2', () => {
    const p = avant('libertes');
    expect(neighbors(TAILLE)[P('D5')]).toContain(P('E5'));
    expect(libertes(p, 'D5')).toEqual(['C5', 'D4', 'D6']);
    expect(texte('libertes')).toContain('3');
    expect(libertes(jouer(p, 'D6'), 'D5')).toHaveLength(2);
    expect(texte('libertes.bravo')).toContain('2');
    // « Bien vu, c'est aussi une de ses libertés » ; « Ce point ne touche pas ma pierre » pour tous les autres.
    for (const e of ['C5', 'D4']) expect(libertes(p, 'D5')).toContain(e);
    for (const q of legaux(p)) if (!['C5', 'D4', 'D6'].includes(toLabel(q, TAILLE))) expect(neighbors(TAILLE)[q]).not.toContain(P('D5'));
  });

  it('3. atari : Mochi a joué à droite ; après le coup, une seule liberté', () => {
    const p = avant('atari');
    expect(p.lastMove! % TAILLE).toBeGreaterThan(P('E5') % TAILLE); // G4 : à droite
    expect(libertes(jouer(p, 'D4'), 'D5')).toEqual(['C5']);
    expect(libertes(jouer(p, 'C5'), 'D5')).toEqual(['D4']); // « Ça la met aussi en atari »
    for (const q of legaux(p)) if (!['C5', 'D4'].includes(toLabel(q, TAILLE))) expect(neighbors(TAILLE)[q]).not.toContain(P('D5'));
  });

  it('4. capture : Mochi pouvait sauver sa pierre ; il joue ailleurs ; le coup sur la dernière liberté la capture (1 prisonnier)', () => {
    const p = avant('capture');
    expect(libertes(p, 'D5')).toEqual(['C5']);
    expect(neighbors(TAILLE)[P('D5')]).not.toContain(p.lastMove); // H7 : ailleurs
    // « Je pourrais sauver ma pierre en jouant sur sa dernière liberté » : Blanc au trait, l'allonge en C5 s'échappe.
    const blanc = { ...positionAvant(indexDe('atari')).pos };
    const apresAtari = jouer(blanc, 'D4');
    expect(canEscape(apresAtari, P('D5'))).toBe(true);
    expect(libertes(jouer(apresAtari, 'C5'), 'D5')).toHaveLength(3);
    const r = jouer(p, 'C5');
    expect(r.board[P('D5')]).toBe(0);
    expect(r.captures[1]).toBe(1);
    // « Ma pierre a encore sa liberté » : aucun autre coup ne la capture.
    for (const q of legaux(p)) if (q !== P('C5')) expect((play(p, q) as Position).board[P('D5')]).toBe(2);
  });

  it('5. se sauver : la pierre glissée entre deux pierres est mise en atari ; allongée, elle a 3 libertés ; sinon, prise', () => {
    const p = avant('sauver');
    expect(p.board[P('F5')]).toBe(2);
    expect(p.board[P('G4')]).toBe(2);
    expect(p.board[P('G5')]).toBe(0);
    expect(neighbors(TAILLE)[P('G5')]).toEqual(expect.arrayContaining([P('F5'), P('G4')]));
    expect(neighbors(TAILLE)[P('F5')]).toContain(P('E5')); // « Je m'approche de ta pierre »
    const q = avant('sauver2');
    expect(libertes(q, 'G5')).toEqual(['G6']);
    const r = jouer(q, 'G6');
    expect(memeChaine(r, 'G5', 'G6')).toBe(true);
    expect(libertes(r, 'G5')).toHaveLength(3);
    expect(texte('sauver2.bravo')).toContain('3');
    // « Je la capturerais au coup suivant » : après n'importe quel autre coup, Blanc prend G5 en G6.
    for (const m of legaux(q)) {
      if (m === P('G6')) continue;
      const apres = play(q, m) as Position;
      const prise = play(apres, P('G6'));
      expect(typeof prise, toLabel(m, TAILLE)).not.toBe('string');
      expect((prise as Position).board[P('G5')], toLabel(m, TAILLE)).toBe(0);
    }
  });

  it('6. couper : un seul point libre touche les deux pierres ; le prendre les coupe et met celle du haut en atari', () => {
    const p = avant('couper');
    expect(coin('F5', 'G4')).toBe(true);
    expect(pointsCommuns(p, 'F5', 'G4')).toEqual(['F4']);
    const r = jouer(p, 'F4');
    expect(memeChaine(r, 'F5', 'G4')).toBe(false);
    expect(libertes(r, 'F5')).toHaveLength(1);
    expect(Math.floor(P('F5') / TAILLE)).toBeLessThan(Math.floor(P('G4') / TAILLE)); // F5 est au-dessus de G4
    // Erreur F6 : atari aussi, mais Blanc se relie en F4, 5 libertés.
    const f6 = jouer(p, 'F6');
    expect(libertes(f6, 'F5')).toEqual(['F4']);
    const relie = jouer(f6, 'F4');
    expect(memeChaine(relie, 'F5', 'G4')).toBe(true);
    expect(libertes(relie, 'F5')).toHaveLength(5);
    expect(texte('couper.non.F6')).toContain('5');
  });

  it('7. échelle : 2 libertés, atari du bon côté, toujours une seule liberté, prise de 3 pierres (4 prisonniers)', () => {
    const p = avant('echelle');
    expect(memeChaine(p, 'F5', 'F6')).toBe(true); // « Je m'allonge »
    expect(libertes(p, 'F5')).toHaveLength(2);
    const r = jouer(p, 'F7');
    expect(libertes(r, 'F5')).toHaveLength(1);
    expect(canEscape(r, P('F5'))).toBe(false);
    // Erreur E6 : atari aussi, mais Blanc s'allonge vers le haut (F7), 3 libertés, et Noir ne le prend plus.
    const e6 = jouer(p, 'E6');
    expect(libertes(e6, 'F5')).toEqual(['F7']);
    const sortie = jouer(e6, 'F7');
    expect(libertes(sortie, 'F5')).toHaveLength(3);
    expect(Math.floor(P('F7') / TAILLE)).toBeLessThan(Math.floor(P('F6') / TAILLE)); // vers le haut
    expect(captureWorks(sortie, P('F5'), 12)).toBe(false);
    // « Je m'allonge encore… et je n'ai toujours qu'une liberté. » Zigzag : F4 puis F7 puis E7, jamais en ligne droite.
    const q = avant('echelle2');
    expect(memeChaine(q, 'F5', 'E6')).toBe(true);
    expect(libertes(q, 'F5')).toEqual(['E7']);
    const prise = jouer(q, 'E7');
    for (const s of ['F5', 'F6', 'E6']) expect(prise.board[P(s)]).toBe(0);
    expect(prise.captures[1]).toBe(4);
    expect(texte('echelle2.bravo')).toMatch(/3 .*4 /);
  });

  it('8. relier : deux points relient les pierres en coin ; Mochi a pris l’un ; l’autre les relie ; sinon il coupe', () => {
    const p = avant('relier');
    expect(coin('G6', 'F7')).toBe(true);
    const nb = neighbors(TAILLE), communs = nb[P('G6')].filter(x => nb[P('F7')].includes(x)).map(x => toLabel(x, TAILLE)).sort();
    expect(communs).toEqual(['F6', 'G7']);
    expect(p.board[P('G7')]).toBe(2);
    expect(p.lastMove).toBe(P('G7'));
    const r = jouer(p, 'F6');
    expect(memeChaine(r, 'G6', 'F7')).toBe(true);
    // « Si je joue sur le point marqué, tes deux pierres marquées sont coupées » : après tout autre coup noir.
    for (const m of legaux(p)) {
      if (m === P('F6')) continue;
      const apres = play(p, m) as Position, coupe = play(apres, P('F6'));
      if (typeof coupe === 'string') continue; // F6 refusé : rien à couper (n'arrive pas ici, vérifié juste après)
      expect(memeChaine(coupe, 'G6', 'F7'), toLabel(m, TAILLE)).toBe(false);
    }
    expect(legaux(p).filter(m => m !== P('F6')).every(m => typeof play(play(p, m) as Position, P('F6')) !== 'string')).toBe(true);
  });

  it('9. territoire : à la fin, le territoire de Mochi est à droite, celui du joueur à gauche', () => {
    for (let q = 0; q < TAILLE * TAILLE; q++) {
      if (compte.owner[q] === 2) expect(q % TAILLE, toLabel(q, TAILLE)).toBeGreaterThanOrEqual(6);
      if (compte.owner[q] === 1) expect(q % TAILLE, toLabel(q, TAILLE)).toBeLessThanOrEqual(5);
    }
  });

  it('10. ko : atari qui laisse une liberté, prise, reprise interdite, coup ailleurs, reprise permise, puis interdite à Mochi', () => {
    const p = avant('ko');
    const a = jouer(p, 'G2');
    expect(libertes(a, 'G1')).toHaveLength(1); // atari sur la pierre du coin
    expect(libertes(a, 'G2')).toHaveLength(1); // « la tienne n'aura qu'une liberté »
    expect(P('G1') % TAILLE).toBe(6);
    const prise = jouer(a, 'F2');
    expect(prise.board[P('G2')]).toBe(0);
    expect(prise.captures[2]).toBe(1);
    expect(prise.ko).toBe(P('G2'));
    // ko2 : la reprise immédiate est refusée par le moteur, pour la raison « ko ».
    const q = avant('ko2');
    expect(play(q, P('G2'))).toBe('ko');
    // ko3 : « ta pierre marquée est en atari » ; après E1, elle est sauvée.
    const k3 = avant('ko3');
    expect(libertes(k3, 'F1')).toEqual(['E1']);
    expect(play(k3, P('G2'))).toBe('ko');
    expect(libertes(jouer(k3, 'E1'), 'F1').length).toBeGreaterThanOrEqual(2);
    // ko4 : après un coup ailleurs de chaque camp, la reprise est permise ; Mochi, lui, ne peut pas reprendre.
    const k4 = avant('ko4');
    const repris = play(k4, P('G2'));
    expect(typeof repris).not.toBe('string');
    expect((repris as Position).captures[1] - k4.captures[1]).toBe(1);
    expect(libertes(repris as Position, 'G1')).toHaveLength(1);
    expect(play(repris as Position, P('F2'))).toBe('ko');
    // ko5 : Mochi sauve sa pierre ; après F2, plus de ko.
    const k5 = avant('ko5');
    expect(libertes(k5, 'G1').length).toBeGreaterThanOrEqual(2);
    expect(jouer(k5, 'F2').ko).toBe(-1);
  });

  it('11. deux yeux : chaque œil est entouré des seules pierres de Mochi ; y jouer est un suicide ; le groupe est vivant (Benson)', () => {
    const p = avant('yeux');
    const m = SCENARIO[indexDe('yeux')] as Extract<Moment, { type: 'essai' }>;
    expect(m.points).toHaveLength(2);
    for (const oeil of m.points) {
      expect(p.board[P(oeil)]).toBe(0);
      expect(neighbors(TAILLE)[P(oeil)].every(r => p.board[r] === 2)).toBe(true);
      expect(play(p, P(oeil))).toBe('suicide');
      expect(P(oeil) % TAILLE).toBeGreaterThanOrEqual(6); // à droite
    }
    for (const s of ['G8', 'H9', 'J8']) expect(hasTwoEyes(p, P(s)), s).toBe(true);
    // Le groupe reste vivant jusqu'à la fin.
    expect(hasTwoEyes(finale, P('G8'))).toBe(true);
  });

  it('12. frontière : ouverte en haut à côté de G9, elle laisse tous les points rouges à personne ; fermée, ils sont au joueur', () => {
    const p = avant('frontiere');
    const ouverts = frontieresOuvertes(p.board, TAILLE);
    expect(ouverts).toContain(P('F9'));
    expect(ouverts.length).toBeGreaterThan(30);
    expect(neighbors(TAILLE)[P('F9')]).toContain(P('G9'));
    expect(p.board[P('G9')]).toBe(2);
    expect(Math.floor(P('F9') / TAILLE)).toBe(0); // en haut
    const siPasse = score(p, KOMI_NORMAL, 'japanese');
    for (const q of ouverts) expect(siPasse.owner[q], toLabel(q, TAILLE)).toBe(0);
    const ferme = jouer(p, 'F9');
    expect(frontieresOuvertes(ferme.board, TAILLE)).toEqual([]);
    const apres = score(ferme, KOMI_NORMAL, 'japanese');
    for (const q of ouverts) if (q !== P('F9')) expect(apres.owner[q], toLabel(q, TAILLE)).toBe(1);
  });

  it('13. groupe mort : Mochi joue chez le joueur ; sans réponse, la pierre ne sort pas et ne fait pas deux yeux ; y répondre coûte 1 point', () => {
    const i = indexDe('mort'), p = avant('mort');
    expect(p.lastMove).toBe(P('E3'));
    expect(SCENARIO[i]).toMatchObject({ type: 'passe', reponse: 'passe' });
    // « Elle ne peut ni sortir… » : la zone vide autour d'elle n'est bordée que de pierres noires (et d'elle-même).
    const nb = neighbors(TAILLE), vu = new Set<number>([P('E3')]), pile = [P('E3')], bords = new Set<number>();
    while (pile.length) for (const r of nb[pile.pop()!]) {
      if (vu.has(r)) continue;
      if (p.board[r] === 0) { vu.add(r); pile.push(r); } else if (r !== P('E3')) bords.add(p.board[r]);
    }
    expect([...bords]).toEqual([1]);
    // « … ni faire deux yeux : elle est morte. » Blanc joue en premier : toutes ses défenses échouent (lecteur de capture).
    const blanc = { ...p, toPlay: 2 as const };
    expect(defenceFails(blanc, P('E3'), 14)).toBe(true);
    expect(hasTwoEyes(p, P('E3'))).toBe(false);
    // « Rien d'autre à fermer : passe. » : aucune frontière ouverte, la pierre morte retirée.
    expect(frontieresOuvertes(p.board, TAILLE, mortes)).toEqual([]);
    // « Pas besoin de répondre » : un coup noir dans son territoire coûte exactement 1 point (puis deux passes).
    const fin = jouer(jouer(p, 'passe'), 'passe');
    const base = score(fin, KOMI_NORMAL, 'japanese', mortes);
    let essais = 0;
    for (let q = 0; q < TAILLE * TAILLE; q++) {
      if (base.owner[q] !== 1 || p.board[q] !== 0) continue; // le point de la pierre morte est occupé
      const r = play(p, q);
      expect(typeof r, toLabel(q, TAILLE)).not.toBe('string');
      const f = jouer(jouer(r as Position, 'passe'), 'passe');
      const s = score(f, KOMI_NORMAL, 'japanese', new Set([...mortes].filter(x => f.board[x] === 2)));
      expect((s.black - s.white) - (base.black - base.white), toLabel(q, TAILLE)).toBe(-1);
      essais++;
    }
    expect(essais).toBe(38);
    expect(texte('mort.territoire')).toContain('1 point');
    expect(texte('mort')).not.toMatch(/bloque/i);
  });

  it('14. passer : Noir passe, Mochi passe aussi ; deux passes de suite finissent la partie, la pierre morte reste sur le plateau', () => {
    expect(SCENARIO[indexDe('passer')].type).toBe('info');
    expect(finale.lastMove).toBe(-1);
    expect(finale.board[P('E3')]).toBe(2);
    expect(compte.owner[P('E3')]).toBe(1);
    expect(frontieresOuvertes(finale.board, TAILLE, mortes)).toEqual([]);
  });

  it('15. comptage (règle japonaise, komi de l’app) : 39 + 6 = 45 contre 11 + 1 + 6,5 = 18,5 ; victoire de 26,5', () => {
    expect(KOMI_NORMAL).toBe(6.5);
    expect(compte.territory[1]).toBe(39);
    expect(finale.captures[1]).toBe(5);
    expect(mortes.size).toBe(1);
    expect(compte.black).toBe(45);
    expect(compte.territory[2]).toBe(11);
    expect(finale.captures[2]).toBe(1);
    expect(compte.white).toBe(18.5);
    expect(compte.winner).toBe(1);
    expect(compte.margin).toBe(26.5);
    expect(compte.seki).toEqual([]);
    // Les nombres des textes sont ceux du moteur, en français et en anglais.
    expect(texte('compte2')).toContain('39');
    expect(texte('compte3')).toMatch(/5 .*1 .*6\. 39 \+ 6 = 45/);
    expect(texte('compte4')).toMatch(/11 .*12/);
    expect(texte('compte5')).toMatch(/6,5 .*12 \+ 6,5 = 18,5/);
    expect(texte('compte6')).toMatch(/45 contre 18,5 .*26,5/);
    expect(anglais('compte3')).toMatch(/5 .*1 .*6\. 39 \+ 6 = 45/);
    expect(anglais('compte5')).toMatch(/6\.5 .*12 \+ 6\.5 = 18\.5/);
    expect(anglais('compte6')).toMatch(/45 to 18\.5.*26\.5/);
    // Toutes les frontières sont fermées et aucun seki : le comptage ne laisse aucun point en suspens.
    expect(frontieresOuvertes(finale.board, TAILLE, mortes)).toEqual([]);
  });

  it('les nombres de libertés des textes suivent le moteur, en anglais aussi', () => {
    expect(anglais('libertes')).toContain('3');
    expect(anglais('libertes.bravo')).toContain('2');
    expect(anglais('sauver2.bravo')).toContain('3');
    expect(anglais('couper.non.F6')).toContain('5');
    expect(anglais('echelle')).toContain('2');
    expect(anglais('echelle2.bravo')).toMatch(/3 .*4 /);
  });
});
