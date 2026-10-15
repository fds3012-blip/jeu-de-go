// Issue #554 : zones fermées et preuves de réfutation en vie et mort, seki et course (src/go/refutation-locale.ts),
// faits lus sur le plateau (src/go/faits-vie-mort.ts). Positions réelles de la banque.
import { ALL_PUZZLES } from '../content/puzzles';
import { parsePuzzles, startOf } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { aDeuxYeux, fauxOeilCree, groupeDuJoueur } from './faits-vie-mort';
import { evaluer } from './preuve-vie-mort';
import {
  defautsZone, defautsZoneCourse, jouer, prouverLocale, zoneDeCourse, zoneDuGroupe, zoneFermee, type ButLocal,
} from './refutation-locale';
import type { Position } from './rules';

const tous = parsePuzzles(ALL_PUZZLES);
const pz = (id: string) => tous.find(p => p.id === id)!;
const at = (l: string) => fromLabel(l, 9);
const labels = (ps: readonly number[]) => ps.map(p => toLabel(p, 9)).sort();
const seq = (pos: Position, ...coups: string[]) => coups.reduce((q, m) => jouer(q, m === 'passe' ? -1 : at(m))!, pos);
const depart = (id: string) => startOf(pz(id));

describe('zone du groupe (espace fermé par des pierres solides ou par le bord)', () => {
  it('q01 : les trois points vides de l’espace noir et les pierres noires ; zone fermée', () => {
    const { pos, marked } = depart('q01');
    const zone = zoneDuGroupe(pos, marked[0]);
    expect(labels(zone.filter(z => !pos.board[z]))).toEqual(['A1', 'C1', 'D2']);
    expect(labels(zone.filter(z => pos.board[z] === 1))).toEqual(['A2', 'B1', 'B2', 'C2', 'D1', 'E1']);
    expect(defautsZone(pos, marked[0], zone)).toEqual([]);
  });
  it('m06 : la pierre blanche entrée dans l’espace (une liberté dehors au plus) est dans la zone, elle peut être prise', () => {
    const { pos, marked } = depart('m06');
    const zone = zoneDuGroupe(pos, marked[0]);
    expect(zone).toContain(at('D1'));
    expect(pos.board[at('D1')]).toBe(2);
    expect(defautsZone(pos, marked[0], zone)).toEqual([]);
  });
  it('zone trop petite ou ouverte : défauts nommés', () => {
    const { pos, marked } = depart('q01');
    // Sans D2 : D1-E1 ont une liberté dehors.
    expect(defautsZone(pos, marked[0], [at('A1'), at('C1')]).length).toBeGreaterThan(0);
    // Un point vide de la zone qui touche un point vide du dehors.
    expect(defautsZone(pos, marked[0], [...zoneDuGroupe(pos, marked[0]), at('G1')]).some(d => d.includes('touche'))).toBe(true);
    // Pas de pierre sur la cible.
    expect(zoneDuGroupe(pos, at('J9'))).toEqual([]);
  });
  it('w01 : le seki ne se ferme pas tout seul (le mur noir du dehors rejoint l’espace) : rien n’est déduit de faux', () => {
    const { pos, marked } = depart('w01');
    const zone = zoneDuGroupe(pos, marked[0]);
    expect(zone.filter(z => !pos.board[z]).length).toBeGreaterThan(14);
  });
});

describe('zone d’une course aux libertés', () => {
  it('z02 : les libertés des deux chaînes ; fermée', () => {
    const { pos, marked } = depart('z02');
    const [a, b] = [marked.find(m => pos.board[m] === 1)!, marked.find(m => pos.board[m] === 2)!];
    const zone = zoneDeCourse(pos, a, b);
    expect(labels(zone)).toEqual(['A1', 'A2', 'F1', 'J1', 'J2']);
    expect(defautsZoneCourse(pos, a, b, zone)).toEqual([]);
  });
  it('d05 : les libertés touchent le reste du plateau (D2-E2) : course ouverte, pas lue ainsi', () => {
    const { pos, marked } = depart('d05');
    const zone = zoneDeCourse(pos, at('C1'), marked[0]);
    expect(defautsZoneCourse(pos, at('C1'), marked[0], zone).some(d => d.includes('touche'))).toBe(true);
  });
  it('une chaîne prise dans la zone sans y avoir ses pierres est un défaut', () => {
    const { pos, marked } = depart('z02');
    const [a, b] = [marked.find(m => pos.board[m] === 1)!, marked.find(m => pos.board[m] === 2)!];
    const zone = zoneDeCourse(pos, a, b);
    expect(defautsZoneCourse(pos, a, b, zone)).toEqual([]);
    expect(zoneFermee(pos, { type: 'course', a, b, zone })).toBe(true);
    expect(zoneFermee(pos, { type: 'course', a: at('E5'), b, zone })).toBe(false);
  });
});

describe('preuves (après la réponse de l’adversaire, toi au trait)', () => {
  const butVM = (id: string, seki = false): ButLocal => {
    const { pos, marked } = depart(id);
    const z = zoneDuGroupe(pos, marked[0]);
    return pos.board[marked[0]] === 1 ? { type: 'vivre', cible: marked[0], zone: z, seki } : { type: 'tuer', cible: marked[0], zone: z };
  };

  it('m01 : coup faux loin, Blanc E1 : ton groupe est pris (mort)', () => {
    const r = seq(depart('m01').pos, 'A9', 'E1');
    expect(prouverLocale(r, butVM('m01'), 1)).toBe('mort');
  });

  it('q01 : Blanc D2 : pas deux yeux même si tu gagnes tous les ko (sansYeux), mais la prise passe par un ko : pas « mort »', () => {
    const but = butVM('q01'), r = seq(depart('q01').pos, 'A9', 'D2');
    expect(prouverLocale(r, but, 1)).toBe('sansYeux');
    expect(prouverLocale(r, but, 1, { seulement: 'mort' })).toBeNull();
    // En seki, « pas deux yeux » ne réfute rien.
    expect(prouverLocale(r, { ...but, seki: true } as ButLocal, 1)).toBeNull();
  });

  it('q02 : Blanc F2 : son groupe vit (deux yeux)', () => {
    const but = butVM('q02'), r = seq(depart('q02').pos, 'A9', 'F2');
    expect(prouverLocale(r, but, 1)).toBe('vit');
    expect(aDeuxYeux(r, depart('q02').marked[0])).toBe(true);
  });

  it('course z02 : Blanc A2 : ta chaîne marquée est prise', () => {
    const { pos, marked } = depart('z02');
    const [a, b] = [marked.find(m => pos.board[m] === 1)!, marked.find(m => pos.board[m] === 2)!];
    const but: ButLocal = { type: 'course', a, b, zone: zoneDeCourse(pos, a, b) };
    expect(prouverLocale(seq(pos, 'E5', 'A2'), but, 1)).toBe('course');
    // Une passe de Blanc ne suffit pas : J2 gagne encore.
    expect(prouverLocale(seq(pos, 'E5', 'passe'), but, 1)).toBeNull();
  });

  it('un ko ne compte jamais : aa12 (vivre par un ko), départ, Noir au trait : rien n’est prouvé', () => {
    const { pos, marked } = depart('aa12');
    const zone = ['A2', 'B2', 'C2', 'A1', 'B1', 'C1', 'D1'].map(at);
    const but: ButLocal = { type: 'vivre', cible: marked[0], zone, seki: false };
    expect(prouverLocale(pos, but, 1)).toBeNull();
    // aa17 (tuer par un ko) : Blanc ne vit pas sans ko, mais rien n'est prouvé non plus pour Noir.
    const k = depart('aa17'), z17 = ['H9', 'H8', 'H7', 'J9', 'J8', 'J7', 'J6'].map(at);
    expect(prouverLocale(k.pos, { type: 'tuer', cible: k.marked[0], zone: z17 }, 1)).toBeNull();
  });

  it('pas au trait, ou zone ouverte par le coup : rien', () => {
    const but = butVM('m01'), r = seq(depart('m01').pos, 'A9', 'E1');
    expect(prouverLocale({ ...r, toPlay: 2 }, but, 1)).toBeNull();
    expect(prouverLocale(r, { ...but, zone: but.zone.filter(z => z !== at('D1')) } as ButLocal, 1)).toBeNull();
  });

  it('tuer : « imprenable » quand le groupe ne vit qu’en seki (survit), sans être « vit »', () => {
    // aa04 vu par Blanc : après J7, le groupe noir marqué tient en seki ; Blanc au trait ne peut plus le prendre.
    const { pos, marked } = depart('aa04');
    const zone = zoneDuGroupe(pos, marked[0]);
    const r = seq(pos, 'J7');
    expect(evaluer(r, marked[0], zone)).toBe(0);
    expect(prouverLocale(r, { type: 'tuer', cible: marked[0], zone }, 2)).toBe('imprenable');
    expect(prouverLocale(r, { type: 'tuer', cible: marked[0], zone }, 2, { seulement: 'vit' })).toBeNull();
  });
});

describe('faits lus sur le plateau', () => {
  it('q01 : D2 blanc fait de C1 un faux œil (D1-E1 n’ont plus que C1) ; rien avant', () => {
    const { pos, marked } = depart('q01');
    const apresFaux = seq(pos, 'A9'), r = seq(apresFaux, 'D2');
    expect(toLabel(fauxOeilCree(apresFaux, r, marked[0]), 9)).toBe('C1');
    expect(fauxOeilCree(pos, apresFaux, marked[0])).toBe(-1);
    expect(fauxOeilCree(pos, apresFaux, at('E5'))).toBe(-1);
  });
  it('groupe du joueur : pierres reliées directement ou par un point en forme d’œil', () => {
    const { pos, marked } = depart('q01');
    expect(labels([...groupeDuJoueur(pos, marked[0])])).toEqual(['A2', 'B1', 'B2', 'C2', 'D1', 'E1']);
  });
  it('deux yeux : faux sans pierre', () => {
    expect(aDeuxYeux(depart('q01').pos, at('E5'))).toBe(false);
  });
});
