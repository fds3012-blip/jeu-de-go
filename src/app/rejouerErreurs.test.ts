// « Rejouer mes erreurs » (#428) : choix et ordre des erreurs, jugement d'un essai. Sur la vraie partie de l'issue #424
// (Florian a Noir), analysée par KataGo (réseau g170-b6c96, 32 visites, partie424.fixture.ts).
import { describe, expect, it } from 'vitest';
import { fromLabel, toLabel } from '../go/coords';
import { momentCle, noterCoups, notesAvecCle, notesCoherentes, positionsDepuisSgf, type AnalyseRevue } from './revue';
import { classerCoups } from './notation';
import { KATAGO_424, SGF_424 } from './partie424.fixture';
import {
  consigne, ESSAIS, erreursARejouer, idPartie, jugerEssai, jugerParRecherche, marquerPartie, MAX_ERREURS_REJOUEES, MAX_PARTIES_XP,
  phraseFin, phraseMontre, phrasePasEncore, phraseTrouve, score, titreFin, type ErreurARejouer,
} from './rejouerErreurs';

const { positions } = positionsDepuisSgf(SGF_424);
const a = KATAGO_424;
const cle = momentCle(positions, a, 1);
const notes = notesCoherentes(classerCoups(positions, a, notesAvecCle(noterCoups(positions, a), cle, a, 9)), a, 9);
const p = (l: string) => fromLabel(l, 9)!;
const lieu = (m: number) => toLabel(m, 9);
const erreur = (coup: number) => erreursARejouer(positions, a, notes, 1, 50).find(e => e.coup === coup)!;

describe('choix et ordre des erreurs (partie 424, KataGo)', () => {
  const choisies = erreursARejouer(positions, a, notes, 1);

  it('trois erreurs au plus, de la plus grave à la moins grave : D5 (coup 45), C9 (25), B6 (15)', () => {
    expect(MAX_ERREURS_REJOUEES).toBe(3);
    expect(choisies.map(e => [e.coup, e.note, lieu(e.joue), lieu(e.meilleur)])).toEqual([
      [45, 'grosse', 'D5', 'G5'], [25, 'grosse', 'C9', 'F5'], [15, 'grosse', 'B6', 'F6'],
    ]);
    for (let i = 1; i < choisies.length; i++) expect(choisies[i].perte).toBeLessThanOrEqual(choisies[i - 1].perte);
  });

  it('seulement les coups de Florian notés Gaffe, Erreur ou Coup manqué ; le meilleur coup est le premier choix de KataGo', () => {
    const toutes = erreursARejouer(positions, a, notes, 1, 50);
    expect(toutes.length).toBeGreaterThan(3);
    for (const e of toutes) {
      expect(e.couleur).toBe(1);
      expect(['grosse', 'erreur', 'manque']).toContain(notes[e.coup - 1]!.note);
      expect(e.meilleur).toBe(a[e.coup - 1].coups![0].move);
      expect(e.joue).toBe(positions[e.coup].lastMove);
    }
    // Les Gaffes d'abord, puis le Coup manqué F6 (coup 21) : dernier de la liste.
    expect(toutes.at(-1)).toMatchObject({ coup: 21, note: 'manque' });
    expect(toutes.findIndex(e => e.note !== 'grosse')).toBe(toutes.length - 1);
    // B8 (coup 27), la Gaffe de l'issue #424, est bien dans la liste.
    expect(lieu(erreur(27).joue)).toBe('B8');
  });

  it('écarte les erreurs qui ne changent pas l’issue : Noir mène encore de plus de 15 points après elles', () => {
    const coups = erreursARejouer(positions, a, notes, 1, 50).map(e => e.coup);
    // Coup 31 (E9) : KataGo donnait +54,8 avec G4, E9 laisse encore +32,5. Coup 39 (D2) : +50,4, puis +30.
    expect(notes[30]!.note).toBe('grosse');
    expect(coups).not.toContain(31);
    expect(coups).not.toContain(39);
    // Coup 45 (D5) : de +38,3 à +12,6, la partie redevient ouverte : on la rejoue.
    expect(coups).toContain(45);
  });

  it('les erreurs de l’autre camp, quand on le demande (partie à deux : les deux camps)', () => {
    expect(erreursARejouer(positions, a, notes, 2).every(e => e.couleur === 2)).toBe(true);
    const deux = erreursARejouer(positions, a, notes, null, 50);
    expect(new Set(deux.map(e => e.couleur))).toEqual(new Set([1, 2]));
  });

  it('sans KataGo : aucune erreur à rejouer, donc pas de bouton', () => {
    const simple: AnalyseRevue[] = a.map(x => ({ lead: x.lead, engine: 'simple' }));
    expect(erreursARejouer(positions, simple, notes, 1)).toEqual([]);
    // Une position sans analyse, ou un premier choix trop peu exploré : cette erreur-là n'est pas proposée.
    const trous = a.map((x, i) => (i === 44 ? null : i === 24 ? { ...x, coups: x.coups!.map(c => ({ ...c, visits: 3 })) } : x));
    expect(erreursARejouer(positions, trous, notes, 1).map(e => e.coup)).toEqual([15, 17, 23]);
  });
});

describe('jugement d’un essai', () => {
  it('le premier choix de KataGo est bon, et dit ce qu’il reprend sur le coup joué', () => {
    const e = erreur(45);
    const j = jugerEssai(e, a[44], p('G5'), 9);
    expect(j).toEqual({ verdict: 'bon', perte: 0, gain: e.perte, premierChoix: true });
    expect(phraseTrouve(j as Extract<typeof j, { verdict: 'bon' }>, e, 9)).toBe('Bravo, c’est le coup de KataGo ! Il vaut 26 points de plus que D5.');
  });

  it('le coup joué dans la partie n’est jamais bon', () => {
    const e = erreur(45);
    expect(jugerEssai(e, a[44], e.joue, 9)).toEqual({ verdict: 'faux', perte: e.perte });
  });

  it('un candidat bien exploré qui perd au plus le seuil « Bon » (1,5 point) est bon', () => {
    // Passe du coup 47 : F4 (12 visites, +26,2) fait même mieux que G5 (17 visites, +22,2), premier choix.
    const e = erreur(47);
    expect(e.joue).toBe(-1);
    const j = jugerEssai(e, a[46], p('F4'), 9);
    expect(j).toMatchObject({ verdict: 'bon', perte: 0, premierChoix: false });
    expect(phraseTrouve(j as Extract<typeof j, { verdict: 'bon' }>, e, 9)).toBe('Bravo ! KataGo le range parmi les bons coups. Il vaut 7 points de plus que la passe.');
  });

  it('un candidat bien exploré qui perd plus que le seuil « Bon » n’est pas bon (il serait une Imprécision)', () => {
    // Coup manqué du coup 21 : G7 (10 visites) perd 1,84 point face à F5.
    const j = jugerEssai(erreur(21), a[20], p('G7'), 9);
    expect(j?.verdict).toBe('faux');
    expect((j as { perte: number }).perte).toBeCloseTo(1.84, 2);
  });

  it('un coup que la recherche n’a pas assez exploré demande une recherche courte (`null`) ; sans KataGo, on ne juge pas', () => {
    const e = erreur(45);
    expect(jugerEssai(e, a[44], p('F4'), 9)).toBeNull(); // 4 visites
    expect(jugerEssai(e, a[44], p('A1'), 9)).toBeNull(); // absent des candidats
    expect(jugerEssai(e, { lead: 0, engine: 'simple' }, p('F4'), 9)).toEqual({ verdict: 'inconnu' });
  });

  it('recherche courte : même budget après le premier choix et après l’essai, avances ramenées au joueur', () => {
    const noir = erreur(45), blanc = erreursARejouer(positions, a, notes, 2, 1)[0];
    const k = (lead: number): AnalyseRevue => ({ lead, engine: 'katago', coups: [] });
    expect(jugerParRecherche(noir, k(38), k(37), 9)).toMatchObject({ verdict: 'bon', perte: 1 });
    expect(jugerParRecherche(noir, k(38), k(36), 9)).toEqual({ verdict: 'faux', perte: 2 });
    // Blanc : une avance de Noir plus haute après l'essai est une perte pour Blanc.
    expect(jugerParRecherche(blanc, k(-10), k(-7), 9)).toEqual({ verdict: 'faux', perte: 3 });
    expect(jugerParRecherche(blanc, k(-10), k(-12), 9)).toMatchObject({ verdict: 'bon', perte: 0 });
    // Une analyse manquante ou du moteur simple : pas de jugement.
    expect(jugerParRecherche(noir, k(38), null, 9)).toEqual({ verdict: 'inconnu' });
    expect(jugerParRecherche(noir, k(38), { lead: 38, engine: 'simple' }, 9)).toEqual({ verdict: 'inconnu' });
  });

  it('les seuils suivent la taille du plateau (19 × 19 : « Bon » jusqu’à 2,2 points)', () => {
    const e: ErreurARejouer = { coup: 30, note: 'erreur', perte: 8, couleur: 1, joue: 100, meilleur: 60 };
    const k = (lead: number): AnalyseRevue => ({ lead, engine: 'katago', coups: [] });
    expect(jugerParRecherche(e, k(10), k(8), 19).verdict).toBe('bon');
    expect(jugerParRecherche(e, k(10), k(8), 9).verdict).toBe('faux');
  });
});

describe('phrases de Mochi et fin de séance', () => {
  it('« Ici, tu as joué B8. Trouve mieux. »', () => {
    expect(consigne(erreur(27), 9, true)).toBe('Ici, tu as joué B8. Trouve mieux.');
    expect(consigne(erreur(27), 9, false)).toBe('Ici, Noir a joué B8. Trouve mieux.');
    expect(consigne(erreur(47), 9, true)).toBe('Ici, tu as passé. Trouve mieux.');
  });

  it('trois essais : deux « Pas encore », puis Mochi montre le coup de KataGo', () => {
    expect(ESSAIS).toBe(3);
    expect(phrasePasEncore(1)).toBe('Pas encore. Encore 2 essais.');
    expect(phrasePasEncore(2)).toBe('Pas encore. Dernier essai.');
    expect(phraseMontre(erreur(27), 9)).toBe('Voici le coup de KataGo : F5. Il valait 11 points de plus que B8.');
  });

  it('« 2 sur 3 trouvées », et une fin qui parle toujours de ce que le joueur emporte', () => {
    const s = score([{ coup: 45, note: 'grosse', trouvee: true, essais: 1 }, { coup: 25, note: 'grosse', trouvee: false, essais: 3 }, { coup: 15, note: 'grosse', trouvee: true, essais: 2 }]);
    expect(s).toEqual({ trouvees: 2, total: 3 });
    expect(titreFin(s)).toBe('2 sur 3 trouvées');
    expect(titreFin({ trouvees: 1, total: 1 })).toBe('1 sur 1 trouvée');
    expect(phraseFin({ trouvees: 3, total: 3 })).toMatch(/^Sans faute/);
    expect(phraseFin(s)).toMatch(/réflexe de plus/);
    expect(phraseFin({ trouvees: 0, total: 3 })).toBe('Tu as vu le bon coup pour ces 3 positions. Ils te serviront à ta prochaine partie.');
  });

  it('XP : une seule fois par partie', () => {
    const id = idPartie(SGF_424);
    expect(idPartie(SGF_424)).toBe(id);
    expect(idPartie(`${SGF_424} `)).not.toBe(id);
    const liste = marquerPartie([], id)!;
    expect(liste).toEqual([id]);
    expect(marquerPartie(liste, id)).toBeNull();
    const pleine = Array.from({ length: MAX_PARTIES_XP }, (_, i) => `p${i}`);
    expect(marquerPartie(pleine, id)).toHaveLength(MAX_PARTIES_XP);
  });
});
