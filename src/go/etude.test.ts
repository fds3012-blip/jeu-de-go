import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fromLabel, toLabel } from './coords';
import { readSgf } from './sgf';
import { score } from './score';
import {
  allerA, choisirVariante, compterEtude, coupsJoues, creeraitVariante, debutVariante, etudeAGarder, etudeDepuisSgf, etudeVersSgf, etudeVide,
  jouerVariante, komiValide, lireEtude, lignePrincipale, noteIci, pierresPosees, poser, positionsEtude, precedent, promouvoirVariante,
  regler, reglagesAnalyse, suivant, supprimerVariante, tailleArbre, variantesIci, type Etude,
} from './etude';

// #372 : goban libre, coups joués, export SGF relu par l'import. #562 : arbre de variantes, komi et règle.
const at = (l: string, n = 9) => fromLabel(l, n);
function ok<T>(r: T | string): T { if (typeof r === 'string') throw new Error(r); return r; }
const jouer = (e: Etude, ...ls: string[]) => ls.reduce((x, l) => ok(jouerVariante(x, l === 'passe' ? -1 : at(l, x.size))), e);
const montres = (e: Etude) => coupsJoues(e).map(p => toLabel(p, e.size));
const fixture = (f: string) => readFileSync(new URL(`./__fixtures__/${f}`, import.meta.url), 'utf8');

describe('poser une position', () => {
  it('pose, remplace et enlève des pierres', () => {
    let e = etudeVide(9);
    e = ok(poser(e, at('D4'), 'noir'));
    e = ok(poser(e, at('E5'), 'blanc'));
    expect(pierresPosees(e)).toBe(2);
    e = ok(poser(e, at('E5'), 'noir')); // remplace la blanche
    expect(e.depart[at('E5')]).toBe(1);
    e = ok(poser(e, at('E5'), 'noir')); // même couleur : enlève
    expect(e.depart[at('E5')]).toBe(0);
    e = ok(poser(e, at('D4'), 'effacer'));
    expect(pierresPosees(e)).toBe(0);
  });
  it('refuse une pierre qui laisserait un groupe sans liberté (rien n’est capturé en posant)', () => {
    let e = etudeVide(9);
    for (const l of ['A2', 'B1']) e = ok(poser(e, at(l), 'noir'));
    expect(poser(e, at('A1'), 'blanc')).toBe('sansLiberte');
    // La noire en B1 qui fermerait la dernière liberté d'une blanche posée en A1 est refusée aussi.
    let f = ok(poser(etudeVide(9), at('A1'), 'blanc'));
    f = ok(poser(f, at('A2'), 'noir'));
    expect(poser(f, at('B1'), 'noir')).toBe('sansLiberte');
  });
  it('poser une pierre abandonne les coups joués (ils partaient d’une autre position)', () => {
    const e = jouer(etudeVide(9), 'E5', 'C3');
    const f = ok(poser(e, at('G7'), 'noir'));
    expect(f.suites).toEqual([]);
    expect(f.curseur).toBe(0);
  });
});

describe('coups joués', () => {
  const depart = (): Etude => {
    let e = etudeVide(9);
    for (const l of ['C3', 'D4', 'E3']) e = ok(poser(e, at(l), 'noir'));
    for (const l of ['D3', 'G7']) e = ok(poser(e, at(l), 'blanc'));
    return e;
  };
  it('se jouent avec les règles (prise) et laissent la position de départ intacte', () => {
    const e = depart();
    const avant = e.depart.slice();
    let v = ok(jouerVariante(e, at('D2'))); // Noir prend D3
    expect(positionsEtude(v).at(-1)!.board[at('D3')]).toBe(0);
    v = ok(jouerVariante(v, at('F5')));
    expect(montres(v)).toEqual(['D2', 'F5']);
    expect([...v.depart]).toEqual([...avant]);
    const debut = allerA(v, 0);
    expect(positionsEtude(debut)).toHaveLength(1);
    expect(positionsEtude(debut)[0].board[at('D3')]).toBe(2);
    // Revenir au début ne perd rien : la suite est toujours là.
    expect(montres(allerA(debut, 2))).toEqual(['D2', 'F5']);
  });
  it('refuse le ko et le suicide', () => {
    let e = etudeVide(9);
    for (const l of ['B1', 'A2']) e = ok(poser(e, at(l), 'noir'));
    e = { ...e, trait: 2 };
    expect(jouerVariante(e, at('A1'))).toBe('suicide');
    expect(jouerVariante(e, at('B1'))).toBe('occupe');
    let k = etudeVide(9);
    for (const l of ['B1', 'A2', 'B3']) k = ok(poser(k, at(l), 'noir'));
    for (const l of ['C1', 'D2', 'C3', 'B2']) k = ok(poser(k, at(l), 'blanc'));
    k = ok(jouerVariante(k, at('C2'))); // Noir prend B2
    expect(jouerVariante(k, at('B2'))).toBe('ko');
  });
});

describe('arbre de variantes (#562)', () => {
  /** Ligne principale E5 C3 G3 C7 ; variante au coup 3 : D3 G5. */
  const arbre = () => {
    const e = jouer(etudeVide(9), 'E5', 'C3', 'G3', 'C7');
    const ici = allerA(e, 2);
    expect(creeraitVariante(ici, at('D3'))).toBe(true);
    expect(creeraitVariante(ici, at('G3'))).toBe(false);
    return jouer(ici, 'D3', 'G5');
  };

  it('jouer un autre coup depuis une position passée crée une variante, la suite d’avant reste', () => {
    const e = arbre();
    expect(montres(e)).toEqual(['E5', 'C3', 'D3', 'G5']);
    expect(debutVariante(e)).toBe(2);
    expect(tailleArbre(e)).toEqual({ coups: 6, variantes: 1, notes: 0 });
    const principale = lignePrincipale(e);
    expect(principale.curseur).toBe(3); // le coup de la ligne principale à la place de la variante
    expect(montres(allerA(principale, 4))).toEqual(['E5', 'C3', 'G3', 'C7']);
  });

  it('rejouer un coup qui existe déjà le suit, sans doublon', () => {
    const e = jouer(allerA(arbre(), 2), 'G3');
    expect(tailleArbre(e).coups).toBe(6);
    expect(montres(e)).toEqual(['E5', 'C3', 'G3']);
    expect(e.ligne).toEqual([0, 0, 0, 0]);
  });

  it('navigation : précédent, suivant (le long de la ligne choisie), bornes', () => {
    let e = arbre();
    e = precedent(precedent(e));
    expect(e.curseur).toBe(2);
    e = suivant(e);
    expect(montres(e)).toEqual(['E5', 'C3', 'D3']); // suit la variante, pas la ligne principale
    expect(suivant(suivant(suivant(e))).curseur).toBe(4);
    expect(precedent(allerA(e, 0)).curseur).toBe(0);
  });

  it('variantes au coup montré : la ligne principale d’abord, la branche suivie marquée ; on passe de l’une à l’autre', () => {
    const e = allerA(arbre(), 3);
    expect(variantesIci(e).map(v => [toLabel(v.p, 9), v.i, v.choisie])).toEqual([['G3', 0, false], ['D3', 1, true]]);
    expect(variantesIci(allerA(e, 2))).toEqual([]); // un seul coup possible au coup 2
    const g = choisirVariante(e, 0);
    expect(montres(g)).toEqual(['E5', 'C3', 'G3']);
    expect(montres(allerA(g, 9))).toEqual(['E5', 'C3', 'G3', 'C7']);
  });

  it('supprimer une variante : elle part avec ses suites, on revient au coup d’où elle partait', () => {
    const e = supprimerVariante(arbre());
    expect(tailleArbre(e)).toEqual({ coups: 4, variantes: 0, notes: 0 });
    expect(e.curseur).toBe(2);
    expect(montres(allerA(e, 4))).toEqual(['E5', 'C3', 'G3', 'C7']);
    // Sur la ligne principale : rien à supprimer.
    expect(supprimerVariante(e)).toBe(e);
  });

  it('promouvoir une variante en ligne principale : l’ancienne ligne devient une variante', () => {
    const e = promouvoirVariante(arbre());
    expect(debutVariante(e)).toBe(-1);
    expect(montres(e)).toEqual(['E5', 'C3', 'D3', 'G5']);
    expect(e.ligne).toEqual([0, 0, 0, 0]);
    const ancienne = choisirVariante(allerA(e, 3), 1);
    expect(montres(allerA(ancienne, 4))).toEqual(['E5', 'C3', 'G3', 'C7']);
    // Readsgf (partage, import) lit la nouvelle ligne principale.
    expect(readSgf(etudeVersSgf(e)).moves.map(m => toLabel(m.p, 9))).toEqual(['E5', 'C3', 'D3', 'G5']);
  });

  it('variante dans une variante : promue jusqu’au coup montré, supprimée depuis son propre départ', () => {
    let e = arbre(); // variante D3 G5 au coup 3
    e = jouer(allerA(e, 3), 'J9'); // variante dans la variante, au coup 4
    expect(montres(e)).toEqual(['E5', 'C3', 'D3', 'J9']);
    expect(debutVariante(e)).toBe(2);
    const p = promouvoirVariante(e);
    expect(p.ligne).toEqual([0, 0, 0, 0]);
    expect(montres(p)).toEqual(['E5', 'C3', 'D3', 'J9']);
    // Supprimer la variante montrée retire la branche entière depuis le coup 3 (D3 et ses deux suites).
    expect(tailleArbre(supprimerVariante(e))).toEqual({ coups: 4, variantes: 0, notes: 0 });
  });
});

describe('komi et règle (#562)', () => {
  it('komi par demi-point, borné ; la règle change sans toucher aux coups', () => {
    expect(komiValide(6.5)).toBe(6.5);
    expect(komiValide(6.3)).toBe(6.5);
    expect(komiValide(-0.5)).toBe(-0.5);
    expect(komiValide(51)).toBeNull();
    expect(komiValide(Number.NaN)).toBeNull();
    const e = jouer(etudeVide(9), 'E5', 'C3');
    const r = regler(e, { komi: 7.5, regles: 'chinese' });
    expect([r.komi, r.regles]).toEqual([7.5, 'chinese']);
    expect(montres(r)).toEqual(['E5', 'C3']);
    expect(regler(r, { komi: 999 }).komi).toBe(7.5);
    expect(regler(r, { komi: 7.5 })).toBe(r);
  });

  it('le compte suit le komi et la règle : territoire et prisonniers en japonais, pierres et territoire en chinois', () => {
    // Noir : pierres en D, territoire de A à C (27 points) ; Blanc : pierres en E, territoire de F à J (36 points).
    let e = etudeVide(9);
    for (let y = 1; y <= 9; y++) {
      e = ok(poser(e, at(`D${y}`), 'noir'));
      e = ok(poser(e, at(`E${y}`), 'blanc'));
    }
    const jap = compterEtude(regler(e, { komi: 6.5, regles: 'japanese' }));
    expect([jap.black, jap.white]).toEqual([27, 36 + 6.5]);
    const chi = compterEtude(regler(e, { komi: 7.5, regles: 'chinese' }));
    expect([chi.black, chi.white]).toEqual([27 + 9, 36 + 9 + 7.5]);
    expect(chi.winner).toBe(2);
    expect(compterEtude(regler(e, { komi: 0.5, regles: 'chinese' })).white).toBe(36 + 9 + 0.5);
  });

  it('handicap : en chinois, Blanc reçoit 1 point par pierre ; KataGo reçoit ce komi compté et la règle', () => {
    let e = etudeVide(9);
    for (const l of ['C3', 'G7', 'C7']) e = ok(poser(e, at(l), 'noir'));
    e = { ...e, trait: 2 };
    expect(reglagesAnalyse(regler(e, { komi: 0.5, regles: 'chinese' }))).toEqual({ komi: 3.5, regles: 'chinese', handicap: 3 });
    expect(reglagesAnalyse(regler(e, { komi: 0.5, regles: 'japanese' }))).toEqual({ komi: 0.5, regles: 'japanese', handicap: 3 });
    const pos = positionsEtude(e)[0];
    expect(compterEtude(regler(e, { komi: 0.5, regles: 'chinese' })).white).toBe(score(pos, 0.5, 'chinese', new Set(), 3).white);
    expect(compterEtude(regler(e, { komi: 0.5, regles: 'chinese' })).compensation).toBe(3);
    // Sans handicap (Noir au trait) : le komi tel quel.
    expect(reglagesAnalyse({ ...e, trait: 1 })).toEqual({ komi: 6.5, regles: 'japanese', handicap: 0 });
  });
});

describe('SGF', () => {
  it('export relu à l’identique (position, trait, coups) et par la lecture SGF de l’import', () => {
    let e = etudeVide(13);
    for (const l of ['D4', 'K10']) e = ok(poser(e, at(l, 13), 'noir'));
    e = ok(poser(e, at('C3', 13), 'blanc'));
    e = { ...e, trait: 2 };
    e = ok(jouerVariante(e, at('D10', 13)));
    e = ok(jouerVariante(e, -1));
    const sgf = etudeVersSgf(e);
    expect(sgf).toContain('AB[');
    expect(sgf).toContain('PL[W]');
    expect(sgf).toContain('B[tt]');
    const g = readSgf(sgf);
    expect(g.size).toBe(13);
    expect(g.moves).toEqual([{ color: 2, p: at('D10', 13) }, { color: 1, p: -1 }]);
    const relue = etudeDepuisSgf(sgf)!;
    expect(relue.size).toBe(13);
    expect(relue.trait).toBe(2);
    expect([...relue.depart]).toEqual([...e.depart]);
    expect(coupsJoues(relue)).toEqual(coupsJoues(e));
    expect(coupsJoues(lireEtude({ sgf })!)).toEqual(coupsJoues(e));
  });

  it('KM et RU écrits et lus ; HA écrit pour une position de handicap', () => {
    let e = etudeVide(9);
    for (const l of ['C3', 'G7']) e = ok(poser(e, at(l), 'noir'));
    e = regler({ ...e, trait: 2 }, { komi: 0.5, regles: 'chinese' });
    const sgf = etudeVersSgf(e);
    expect(sgf).toMatch(/KM\[0\.5\]RU\[Chinese\]HA\[2\]/);
    const g = readSgf(sgf);
    expect([g.komi, g.rules, g.handicap]).toEqual([0.5, 'chinese', 2]);
    const r = etudeDepuisSgf(sgf)!;
    expect([r.komi, r.regles]).toEqual([0.5, 'chinese']);
    expect(etudeDepuisSgf(etudeVersSgf(regler(e, { komi: -3, regles: 'japanese' })))!.komi).toBe(-3);
  });

  it('variantes : parenthèses imbriquées, ligne principale d’abord ; aller-retour exact', () => {
    let e = jouer(etudeVide(9), 'E5', 'C3', 'G3', 'C7');
    e = jouer(allerA(e, 2), 'D3', 'G5');
    e = jouer(allerA(e, 1), 'G5');
    const sgf = etudeVersSgf(e);
    expect(sgf).toBe('(;GM[1]FF[4]CA[UTF-8]SZ[9]KM[6.5]RU[Japanese]PL[B];B[ee](;W[cg](;B[gg];W[cc])(;B[dg];W[ge]))(;W[ge]))');
    const r = etudeDepuisSgf(sgf)!;
    expect(r.suites).toEqual(e.suites);
    expect(etudeVersSgf(r)).toBe(sgf);
    expect(montres(r)).toEqual(['E5', 'C3', 'G3', 'C7']); // ouverte au bout de la ligne principale
  });

  it('fichier réel (Sabaki 9 × 9) : variantes imbriquées, commentaires, passes ; aller-retour sans perte', () => {
    const e = etudeDepuisSgf(fixture('club-9x9-variantes.sgf'))!;
    expect([e.size, e.komi, e.regles, e.trait]).toEqual([9, 7, 'japanese', 1]);
    expect(e.note).toContain('a[1] et l\'antislash : \\ fin.');
    expect(tailleArbre(e)).toEqual({ coups: 16, variantes: 2, notes: 7 });
    expect(montres(e)).toEqual(['E5', 'G7', 'G6', 'F7', 'H7', 'H8', 'E7', 'E8', 'D8']);
    expect(noteIci(allerA(e, 1))).toBe('Le centre : classique en 9 × 9.');
    // Variante au coup 3 (le coin) et ses passes.
    const coin = choisirVariante(allerA(e, 3), 1);
    expect(montres(allerA(coin, 9))).toEqual(['E5', 'G7', 'C3', 'G3', 'passe', 'passe']);
    // Variante dans la variante, au coup 5.
    const solide = choisirVariante(allerA(e, 5), 1);
    expect(noteIci(allerA(solide, 7))).toBe('Variante dans la variante.');
    // Aller-retour : même arbre, mêmes commentaires ; le texte réécrit se relit à l'identique.
    const sgf = etudeVersSgf(e);
    const r = etudeDepuisSgf(sgf)!;
    expect(r.suites).toEqual(e.suites);
    expect([r.note, r.komi, r.regles]).toEqual([e.note, e.komi, e.regles]);
    expect(etudeVersSgf(r)).toBe(sgf);
    // Ni noms ni date dans l'export de l'étude (le fichier d'origine en avait).
    expect(sgf).not.toMatch(/PB\[|PW\[|DT\[|GN\[/);
  });

  it('fichier réel (CGoban 19 × 19, handicap 2, règle chinoise) : position, komi, deux branches', () => {
    const e = etudeDepuisSgf(fixture('kgs-19x19-handicap.sgf'))!;
    expect([e.size, e.komi, e.regles, e.trait, pierresPosees(e)]).toEqual([19, 0.5, 'chinese', 2, 2]);
    expect(reglagesAnalyse(e)).toEqual({ komi: 2.5, regles: 'chinese', handicap: 2 });
    expect(montres(e)).toEqual(['D16', 'Q4', 'F17', 'C14', 'C17', 'K16']);
    const calme = choisirVariante(allerA(e, 4), 1);
    expect(noteIci(calme)).toBe('Plus calme : Noir prend le côté.');
    const r = etudeDepuisSgf(etudeVersSgf(e))!;
    expect(r.suites).toEqual(e.suites);
    expect(etudeVersSgf(r)).toMatch(/HA\[2\]AB\[pd\]\[dp\]PL\[W\]/);
  });

  it('coups refusés : la branche s’arrête là, le reste de l’arbre est gardé', () => {
    // B[ee] deux fois de suite : le second est refusé (point pris), avec sa suite ; la variante W[cc] reste.
    const e = etudeDepuisSgf('(;SZ[9];B[ee](;W[ee];B[aa])(;W[cc]C[ok]))')!;
    expect(tailleArbre(e)).toEqual({ coups: 2, variantes: 0, notes: 1 });
    expect(montres(e)).toEqual(['E5', 'C7']);
    // Pierres posées en cours de partie : branche arrêtée ; nœud sans coup : son commentaire rejoint le coup d'avant.
    const f = etudeDepuisSgf('(;SZ[9];B[ee];C[remarque];W[cc](;AB[aa];W[gg]))')!;
    expect(montres(f)).toEqual(['E5', 'C7']);
    expect(noteIci(allerA(f, 1))).toBe('remarque');
    // Premier coup écrit dans la racine.
    expect(montres(etudeDepuisSgf('(;SZ[9]B[ee];W[cc])')!)).toEqual(['E5', 'C7']);
  });

  it('refuse ce qui n’est pas une étude lisible', () => {
    expect(etudeDepuisSgf('pas un sgf')).toBeNull();
    expect(etudeDepuisSgf('(;SZ[7];B[aa])')).toBeNull();
    expect(lireEtude(null)).toBeNull();
    expect(lireEtude({ sgf: 3 })).toBeNull();
  });

  it('stockage : l’étude revient où on en était (branche et coup montré), une ligne abîmée est corrigée', () => {
    const e = allerA(jouer(allerA(jouer(etudeVide(9), 'E5', 'C3', 'G3'), 1), 'G5', 'C7'), 2);
    const garde = etudeAGarder(e);
    const r = lireEtude(JSON.parse(JSON.stringify(garde)))!;
    expect(r.ligne).toEqual(e.ligne);
    expect(r.curseur).toBe(2);
    expect(montres(r)).toEqual(['E5', 'G5']);
    const abime = lireEtude({ ...garde, ligne: [7, 'x', -2], curseur: 99 })!;
    expect(abime.ligne).toEqual([0, 0, 0]);
    expect(abime.curseur).toBe(3);
  });
});
