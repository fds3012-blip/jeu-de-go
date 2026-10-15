// Issue #554 : réfutation prouvée d'un coup faux en vie et mort, seki et course aux libertés.
//
// Le lecteur de capture (src/go/lecture-capture.ts) prouve « tu ne prends plus en k coups ». En vie et mort, il faut
// autre chose : « ton groupe ne peut plus vivre », « son groupe vivra ». Ce module le prouve par une recherche complète
// dans une zone fermée, avec les outils des preuves des lots (preuve-vie-mort.ts, preuve-ko.ts, preuve-course.ts).
//
// Zone (vie et mort, seki) : l'espace du groupe cible, déduit du plateau (`zoneDuGroupe`) ou déclaré
// (src/go/zones-problemes.ts). La recherche ne joue que dedans ; c'est juste si la zone est fermée (`defautsZone`) :
// - `defautsDeZone` (preuve-vie-mort.ts) : chaque chaîne du défenseur au contact de la zone a toutes ses libertés dedans,
//   chaque mur de l'attaquant a au moins deux libertés dehors (aucun coup de la zone ne peut le prendre) ;
// - aucun point vide de la zone ne touche un point vide du dehors (une pierre jouée dedans n'y gagne jamais une
//   liberté que l'autre ne pourrait pas remplir) ;
// - chaque pierre qui peut être prise (chaînes du défenseur au contact, chaînes de l'attaquant enfermées) est dans la
//   zone : son point redevient jouable une fois vide, pour les deux camps.
//
// Preuves (après la réponse de l'adversaire, toi au trait). Chacune vaut « quoi que tu joues », et le ko ne compte
// jamais pour l'adversaire : soit toute ligne qui crée un ko est coupée (« non résolu »), soit c'est toi qui gagnes
// tous les ko (tu reprends aussitôt, sans menace à trouver). Une coupure (profondeur, répétition) n'est jamais une preuve.
// - `mort` (vivre, seki) : ton groupe est pris (evaluer = -1, ou evaluerMaitre = -1, toi maître du ko).
// - `sansYeux` (vivre) : ton groupe ne fait jamais deux yeux, même toi maître du ko (pasDeVie) ; seki au mieux.
// - `vit` (tuer) : son groupe vit, deux yeux au sens de Benson (evaluer = +1, ou evaluerMaitre = +1, toi maître du ko).
// - `imprenable` (tuer) : tu ne prends jamais son groupe, même maître du ko (survit) ; seki au mieux pour toi.
// - `course` (course aux libertés) : ta chaîne marquée est prise (evaluerCourse = -1 ; un ko coupe la ligne).
// Les faits lus sur le plateau pour la phrase (faux œil, deux yeux) sont dans src/go/faits-vie-mort.ts, léger.
import { groupAt, neighbors, play, type Color, type Position } from './rules';
import { defautsDeZone, evaluer } from './preuve-vie-mort';
import { evaluerMaitre, pasDeVie, survit } from './preuve-ko';
import { defautsCourse, evaluerCourse } from './preuve-course';

export type PreuveLocale = 'mort' | 'sansYeux' | 'vit' | 'imprenable' | 'course';

/** Ce que le joueur doit faire : sauver son groupe (vivre), prendre celui de l'adversaire (tuer), gagner une course. */
export type ButLocal =
  | { type: 'vivre'; cible: number; zone: number[]; seki: boolean }
  | { type: 'tuer'; cible: number; zone: number[] }
  | { type: 'course'; a: number; b: number; zone: number[] };

/** Nombre de points vides au plus d'une zone déduite : au-delà, la recherche complète n'est plus raisonnable. */
export const VIDES_MAX = 14;

/**
 * Espace du groupe `cible` : points vides et pierres du défenseur atteints depuis la cible sans traverser l'attaquant,
 * plus les chaînes de l'attaquant qui ont moins de deux libertés hors de cet espace (enfermées : elles peuvent être
 * prises, l'espace continue au-delà), jusqu'au point fixe. Les murs restants ont au moins deux libertés dehors.
 */
export function zoneDuGroupe(pos: Position, cible: number): number[] {
  const d = pos.board[cible], a = 3 - d, nb = neighbors(pos.size), enfermees = new Set<number>();
  if (!d) return [];
  for (;;) {
    const vu = new Set([cible]), pile = [cible];
    while (pile.length) {
      const q = pile.pop()!;
      for (const r of nb[q]) {
        if (vu.has(r) || (pos.board[r] === a && !enfermees.has(r))) continue;
        vu.add(r);
        pile.push(r);
      }
    }
    let change = false;
    for (const q of vu) for (const r of nb[q]) {
      if (pos.board[r] !== a || enfermees.has(r)) continue;
      const g = groupAt(pos.board, pos.size, r);
      if ([...g.liberties].filter(l => !vu.has(l)).length < 2) { g.stones.forEach(s => enfermees.add(s)); change = true; }
    }
    if (!change) return [...vu].sort((x, y) => x - y);
  }
}

/** Défauts d'une zone de vie et mort (liste vide si elle est fermée au sens de l'en-tête). */
export function defautsZone(pos: Position, cible: number, zone: readonly number[]): string[] {
  const out = defautsDeZone(pos, cible, zone), nb = neighbors(pos.size), dans = new Set(zone), d = pos.board[cible];
  for (const z of zone) {
    if (pos.board[z]) continue;
    for (const r of nb[z]) if (!pos.board[r] && !dans.has(r)) out.push(`point vide ${z} : touche le point vide ${r} hors de la zone`);
  }
  // Pierres qui peuvent être prises : les chaînes du défenseur au contact, et celles de l'attaquant dont une liberté au
  // plus est dehors (les autres ont été jugées par defautsDeZone : deux libertés dehors, jamais prises).
  const vues = new Set<number>();
  for (const z of zone) for (const r of [z, ...nb[z]]) {
    if (!pos.board[r] || vues.has(r)) continue;
    const g = groupAt(pos.board, pos.size, r);
    g.stones.forEach(s => vues.add(s));
    const dehors = [...g.liberties].filter(l => !dans.has(l)).length;
    if ((pos.board[r] === d || dehors < 2) && !g.stones.every(s => dans.has(s))) out.push(`chaîne en ${r} : pierres hors de la zone`);
  }
  return out;
}

/**
 * Défauts d'une zone de course : ceux de preuve-course.ts (sur les points vides de la zone), un point vide qui touche un
 * point vide du dehors, et une chaîne qui peut être prise dans la zone (toutes ses libertés dedans) sans y avoir ses
 * pierres. Les pierres de `a` et `b` n'ont pas à y être : leur prise termine la course.
 */
export function defautsZoneCourse(pos: Position, a: number, b: number, zone: readonly number[]): string[] {
  const vides = zone.filter(z => !pos.board[z]), dans = new Set(zone), nb = neighbors(pos.size);
  const out = defautsCourse(pos, a, b, vides);
  for (const z of vides) for (const r of nb[z]) if (!pos.board[r] && !dans.has(r)) out.push(`point vide ${z} : touche le point vide ${r} hors de la zone`);
  const ga = new Set(groupAt(pos.board, pos.size, a).stones), gb = new Set(groupAt(pos.board, pos.size, b).stones), vues = new Set<number>();
  for (const z of vides) for (const r of nb[z]) {
    if (!pos.board[r] || ga.has(r) || gb.has(r) || vues.has(r)) continue;
    const g = groupAt(pos.board, pos.size, r);
    g.stones.forEach(q => vues.add(q));
    if ([...g.liberties].every(l => dans.has(l)) && !g.stones.every(q => dans.has(q))) out.push(`chaîne en ${r} : pierres hors de la zone`);
  }
  return out;
}

/**
 * Zone d'une course : les libertés des deux chaînes, et les pierres des chaînes qui n'ont de libertés que là (elles
 * peuvent être prises, leur point redevient jouable).
 */
export function zoneDeCourse(pos: Position, a: number, b: number): number[] {
  const libs = new Set([...groupAt(pos.board, pos.size, a).liberties, ...groupAt(pos.board, pos.size, b).liberties]);
  const nb = neighbors(pos.size), zone = new Set(libs);
  for (const z of libs) for (const r of nb[z]) {
    if (!pos.board[r] || zone.has(r)) continue;
    const g = groupAt(pos.board, pos.size, r);
    if ([...g.liberties].every(l => libs.has(l)) && !g.stones.includes(a) && !g.stones.includes(b)) g.stones.forEach(q => zone.add(q));
  }
  return [...zone].sort((x, y) => x - y);
}

/** La zone du but est-elle fermée dans cette position ? */
export function zoneFermee(pos: Position, but: ButLocal): boolean {
  if (but.type === 'course') return !!pos.board[but.a] && !!pos.board[but.b] && defautsZoneCourse(pos, but.a, but.b, but.zone).length === 0;
  return !!pos.board[but.cible] && defautsZone(pos, but.cible, but.zone).length === 0;
}

export interface OptionsPreuve {
  /** Coups au plus de chaque recherche (passes comprises). 30 par défaut, comme les preuves des lots. */
  profondeur?: number;
  /** Ne cherche que cette preuve (revérification d'une réplique figée). */
  seulement?: PreuveLocale;
}

/**
 * Preuve que la position `r` (après la réponse de l'adversaire, `moi` au trait) est perdue pour toi, quoi que tu joues :
 * la plus forte trouvée, ou null. `null` aussi si la zone n'est plus fermée.
 */
export function prouverLocale(r: Position, but: ButLocal, moi: Color, opts: OptionsPreuve = {}): PreuveLocale | null {
  const essai = (p: PreuveLocale) => !opts.seulement || opts.seulement === p;
  if (r.toPlay !== moi) return null;
  // Ta chaîne déjà prise par la réponse : rien à lire.
  if (but.type === 'course' && r.board[but.a] !== moi) return essai('course') ? 'course' : null;
  if (but.type === 'vivre' && r.board[but.cible] !== moi) return essai('mort') ? 'mort' : null;
  if (!zoneFermee(r, but)) return null;
  const prof = { profondeur: opts.profondeur ?? 30 };
  if (but.type === 'course') return essai('course') && evaluerCourse(r, but.a, but.b, but.zone, prof) === -1 ? 'course' : null;
  const { cible, zone } = but;
  if (but.type === 'vivre') {
    if (essai('mort') && (evaluer(r, cible, zone, prof) === -1 || evaluerMaitre(r, cible, zone, moi, prof) === -1)) return 'mort';
    // Seki : vivre sans deux yeux était le but ; « pas deux yeux » ne réfute rien.
    if (essai('sansYeux') && !but.seki && pasDeVie(r, cible, zone, { ...prof, maitre: moi })) return 'sansYeux';
    return null;
  }
  if (essai('vit') && (evaluer(r, cible, zone, prof) === 1 || evaluerMaitre(r, cible, zone, moi, prof) === 1)) return 'vit';
  if (essai('imprenable') && survit(r, cible, zone, { ...prof, maitre: moi })) return 'imprenable';
  return null;
}

/** Joue `m` s'il est légal. */
export const jouer = (pos: Position, m: number): Position | null => {
  const r = play(pos, m);
  return typeof r === 'string' ? null : r;
};
