// « Continuer » à ta mesure (issue #284) : cote du joueur, cible de 85 %, simulations de joueurs de force fixe.
import { describe, expect, it } from 'vitest';
import { ALL_PUZZLES } from '../content/puzzles';
import { parsePuzzles } from '../data/puzzles';
import { niveau } from './problemes';
import {
  COTE_DEPART, ECART_CIBLE, ETAT_INITIAL, SAUT_MAX, chance, choisirProbleme, cible, kPour, nettoyerCote, noter, ouvrir,
  requalifierEnAide, type EtatCote
} from './coteJoueur';

type Pb = { id: string; difficulty: number };

/** Générateur pseudo-aléatoire à graine (mulberry32) : simulations reproductibles. */
function graine(n: number): () => number {
  let a = n >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Banque synthétique dense : `parCran` problèmes tous les 10 points (la banque réelle grandit de 5 par jour). */
function banque(min = 100, max = 2400, parCran = 20): Pb[] {
  const out: Pb[] = [];
  for (let d = min; d <= max; d += 10) for (let k = 0; k < parCran; k++) out.push({ id: `s${d}-${k}`, difficulty: d });
  return out;
}

interface Pas { id: string; difficulte: number; note: boolean; reussi: boolean; coteAvant: number; coteApres: number }

/**
 * Un joueur de force `force` touche `n` fois « Continuer ». Il réussit du premier coup avec la chance Elo ; après un
 * échec, il trouve seul (réussite avec aide) une fois sur deux. 15 problèmes par jour.
 */
function simuler(liste: readonly Pb[], force: number, n: number, seed: number) {
  const alea = graine(seed);
  const reussis = new Set<string>();
  let etat: EtatCote = ETAT_INITIAL;
  const pas: Pas[] = [];
  for (let i = 0; i < n; i++) {
    const jour = 1 + Math.floor(i / 15);
    const pb = choisirProbleme(liste, etat, reussis, { jour, alea });
    if (!pb) break;
    const coteAvant = etat.cote;
    etat = ouvrir(etat, pb);
    if (reussis.has(pb.id)) { pas.push({ id: pb.id, difficulte: pb.difficulty, note: false, reussi: true, coteAvant, coteApres: etat.cote }); continue; }
    const reussi = alea() < chance(force, pb.difficulty);
    etat = noter(etat, pb, reussi ? 'premier' : 'rate', jour);
    if (reussi) reussis.add(pb.id);
    else if (alea() < 0.5) { etat = requalifierEnAide(etat, pb.id); reussis.add(pb.id); }
    pas.push({ id: pb.id, difficulte: pb.difficulty, note: true, reussi, coteAvant, coteApres: etat.cote });
  }
  const notes = pas.filter(p => p.note);
  return { pas, etat, taux: notes.filter(p => p.reussi).length / Math.max(1, notes.length) };
}

const PROFILS = [
  { nom: 'faible', force: 700 },
  { nom: 'moyen', force: 1000 },
  { nom: 'fort', force: 1300 }
] as const;
const GRAINES = Array.from({ length: 20 }, (_, i) => i + 1);
const SYNTH = banque();
const moyenne = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('cote du joueur (Elo à K dégressif)', () => {
  it('part prudemment : 400, et le premier problème est parmi les plus faciles', () => {
    expect(ETAT_INITIAL.cote).toBe(COTE_DEPART);
    expect(COTE_DEPART).toBe(400);
    const reel = parsePuzzles(ALL_PUZZLES);
    const premier = choisirProbleme(reel, ETAT_INITIAL, new Set(), { jour: 1, alea: () => 0 })!;
    expect(premier.difficulty).toBe(Math.min(...reel.map(p => p.difficulty)));
  });

  it('vise 85 % de réussite prévue', () => {
    const etat = { ...ETAT_INITIAL, cote: 1000 };
    expect(chance(1000, cible(etat))).toBeCloseTo(0.85, 5);
    expect(ECART_CIBLE).toBeGreaterThan(300);
    expect(ECART_CIBLE).toBeLessThan(302);
  });

  it('K diminue avec les essais, sans descendre sous son plancher ni dépasser le saut maximal', () => {
    expect(kPour(0)).toBeGreaterThan(kPour(10));
    expect(kPour(10)).toBeGreaterThan(kPour(40));
    expect(kPour(1000)).toBe(kPour(2000));
    expect(kPour(0)).toBeLessThanOrEqual(SAUT_MAX);
  });

  it('une réussite avec aide compte moins qu’une réussite du premier coup, plus qu’un échec', () => {
    const pb = { id: 'x', difficulty: 400 };
    const premier = noter(ETAT_INITIAL, pb, 'premier', 1).cote;
    const rate = noter(ETAT_INITIAL, pb, 'rate', 1);
    const aide = requalifierEnAide(rate, 'x');
    expect(premier).toBeGreaterThan(aide.cote);
    expect(aide.cote).toBeGreaterThan(rate.cote);
    expect(aide.dernier?.resultat).toBe('aide');
    // Une seule fois, et seulement pour cet échec.
    expect(requalifierEnAide(aide, 'x')).toBe(aide);
    expect(requalifierEnAide(rate, 'y')).toBe(rate);
  });

  it('rejouer un problème déjà noté le même jour ne change pas la cote', () => {
    const pb = { id: 'x', difficulty: 400 };
    const a = noter(ETAT_INITIAL, pb, 'rate', 1);
    expect(noter(a, pb, 'premier', 1)).toBe(a);
    // Le lendemain, c'est un nouvel essai.
    expect(noter(a, pb, 'premier', 2).cote).toBeGreaterThan(a.cote);
  });

  it('relit un stockage abîmé sans planter', () => {
    expect(nettoyerCote(null)).toEqual(ETAT_INITIAL);
    expect(nettoyerCote('x')).toEqual(ETAT_INITIAL);
    expect(nettoyerCote({ cote: 'beaucoup', essais: -3, serie: NaN, vusDuJour: [1, 'a'] })).toEqual({ ...ETAT_INITIAL, vusDuJour: ['a'] });
    const e = noter(ETAT_INITIAL, { id: 'x', difficulty: 300 }, 'premier', 4);
    expect(nettoyerCote(JSON.parse(JSON.stringify(e)))).toEqual(e);
  });
});

describe('choix du prochain problème', () => {
  const liste: Pb[] = [100, 200, 300, 400, 500, 600, 700, 800, 900].flatMap(d => [{ id: `a${d}`, difficulty: d }, { id: `b${d}`, difficulty: d }]);

  it('ne propose que des problèmes pas encore réussis, sinon rien (la série infinie prend le relais)', () => {
    const reussis = new Set(liste.map(p => p.id));
    expect(choisirProbleme(liste, ETAT_INITIAL, reussis, { jour: 1 })).toBeUndefined();
    reussis.delete('a900');
    expect(choisirProbleme(liste, ETAT_INITIAL, reussis, { jour: 1 })?.id).toBe('a900');
  });

  it('après un échec, le suivant est plus facile ; jamais deux fois le même de suite', () => {
    for (const d of [300, 500, 800]) for (const x of [0, 0.5, 0.99]) {
      const pb = liste.find(p => p.difficulty === d)!;
      const etat = noter({ ...ETAT_INITIAL, cote: d + ECART_CIBLE }, pb, 'rate', 1);
      const suivant = choisirProbleme(liste, etat, new Set(), { jour: 1, alea: () => x })!;
      expect(suivant.difficulty).toBeLessThan(d);
      expect(suivant.id).not.toBe(pb.id);
      // Même après une réussite avec aide.
      const s2 = choisirProbleme(liste, requalifierEnAide(etat, pb.id), new Set([pb.id]), { jour: 1, alea: () => x })!;
      expect(s2.difficulty).toBeLessThan(d);
    }
  });

  it('après 3 réussites d’affilée, un peu plus dur', () => {
    const base = { ...ETAT_INITIAL, cote: 900, essais: 200 };
    expect(cible({ ...base, serie: 3 })).toBeGreaterThan(cible({ ...base, serie: 2 }));
    expect(cible({ ...base, serie: 3 }) - cible({ ...base, serie: 2 })).toBeLessThanOrEqual(60);
  });

  it('un problème déjà noté aujourd’hui ne revient pas le même jour', () => {
    const pb = { id: 'a300', difficulty: 300 };
    let etat = noter({ ...ETAT_INITIAL, cote: 300 + ECART_CIBLE }, pb, 'rate', 5);
    etat = ouvrir(etat, { id: 'a400', difficulty: 400 });
    const vus: string[] = [];
    for (let i = 0; i < 20; i++) vus.push(choisirProbleme(liste, etat, new Set(), { jour: 5, alea: () => i / 20 })!.id);
    expect(vus).not.toContain('a300');
  });

  it('un nouveau joueur qui réussit 5 problèmes d’affilée reçoit ensuite un problème « Moyen » (contenu réel)', () => {
    const reel = parsePuzzles(ALL_PUZZLES);
    for (const seed of [1, 2, 3, 4, 5]) {
      const alea = graine(seed);
      let etat: EtatCote = ETAT_INITIAL;
      const reussis = new Set<string>();
      for (let i = 0; i < 5; i++) {
        const pb = choisirProbleme(reel, etat, reussis, { jour: 1, alea })!;
        expect(niveau(pb.difficulty).mot).toBe('Facile');
        etat = noter(ouvrir(etat, pb), pb, 'premier', 1);
        reussis.add(pb.id);
      }
      const sixieme = choisirProbleme(reel, etat, reussis, { jour: 1, alea })!;
      expect(niveau(sixieme.difficulty).mot).toBe('Moyen');
    }
  });
});

describe('simulation : joueurs de force fixe, 200 réponses à « Continuer »', () => {
  const resultats = PROFILS.map(({ nom, force }) => {
    const sims = GRAINES.map(seed => simuler(SYNTH, force, 200, seed));
    return { nom, force, sims, taux: moyenne(sims.map(s => s.taux)), cote: moyenne(sims.map(s => s.etat.cote)) };
  });

  it.each(resultats)('la cote converge vers la force du joueur ($nom, $force)', ({ force, sims, cote }) => {
    // En moyenne sur 20 graines, à 60 points près ; chaque joueur à 150 points près.
    expect(Math.abs(cote - force)).toBeLessThan(60);
    for (const s of sims) expect(Math.abs(s.etat.cote - force)).toBeLessThan(150);
  });

  it.each(resultats)('le taux de réussite au premier essai est entre 80 et 90 % ($nom)', ({ taux }) => {
    expect(taux).toBeGreaterThanOrEqual(0.8);
    expect(taux).toBeLessThanOrEqual(0.9);
  });

  it.each(resultats)('aucun saut de plus de 200 points, ni de difficulté ni de cote ($nom)', ({ sims }) => {
    for (const s of sims) {
      for (let i = 1; i < s.pas.length; i++) expect(Math.abs(s.pas[i].difficulte - s.pas[i - 1].difficulte)).toBeLessThanOrEqual(SAUT_MAX);
      for (const p of s.pas) expect(Math.abs(p.coteApres - p.coteAvant)).toBeLessThanOrEqual(SAUT_MAX);
    }
  });

  it('jamais deux fois le même problème de suite', () => {
    for (const r of resultats) for (const s of r.sims) for (let i = 1; i < s.pas.length; i++) expect(s.pas[i].id).not.toBe(s.pas[i - 1].id);
  });

  it('contenu réel (171 problèmes) : jamais de saut de plus de 200 points, même quand les problèmes à portée sont épuisés', () => {
    const reel = parsePuzzles(ALL_PUZZLES);
    for (const { force } of PROFILS) for (const seed of [1, 2, 3]) {
      const s = simuler(reel, force, 200, seed);
      for (let i = 1; i < s.pas.length; i++) expect(Math.abs(s.pas[i].difficulte - s.pas[i - 1].difficulte)).toBeLessThanOrEqual(SAUT_MAX);
    }
  });

  it('chiffres de la simulation (pour docs et PR)', () => {
    const reel = parsePuzzles(ALL_PUZZLES);
    const lignes = resultats.map(r => `${r.nom} (${r.force}) : cote finale ${r.cote.toFixed(0)}, réussite ${(r.taux * 100).toFixed(1)} %`);
    for (const { nom, force } of PROFILS) {
      const sims = GRAINES.slice(0, 5).map(seed => simuler(reel, force, 60, seed));
      lignes.push(`contenu réel, ${nom} (${force}), 60 réponses : cote ${moyenne(sims.map(s => s.etat.cote)).toFixed(0)}, réussite ${(moyenne(sims.map(s => s.taux)) * 100).toFixed(1)} %`);
    }
    console.info(lignes.join('\n'));
    expect(lignes).toHaveLength(6);
  });
});
