// Issue #424 : la partie réelle de Florian (partie entre amis, 9 × 9, B+17,5), revue sans KataGo sur iPhone.
// Constats : J6 « solide » avec −3,5, J8 « solide » avec −87,5, une courbe qui saute, et des comptes identiques
// pour les deux joueurs. On rejoue ici la revue avec les trois mesures possibles :
// - l'ancien moteur simple (règles de territoire du comptage final appliquées en pleine partie) : ses chiffres sont
//   ceux du téléphone de Florian (−3,4 après J6, −87,5 après J8) ;
// - le moteur simple corrigé (mode estimation) ;
// - le vrai KataGo (réseau g170-b6c96, 32 visites), analyses figées dans partie424.fixture.ts.
import { describe, expect, it } from 'vitest';
import { fromLabel, toLabel } from '../go/coords';
import { avanceEstimee } from '../go/estimation';
import { ownership } from '../engine/dead';
import {
  avanceFinale, avancesAffichees, compteNotes, momentCle, NOTES, noterCoups, notesAvecCle, notesCoherentes, positionsDepuisSgf,
  phraseBilan, precisionHonnete, seuilsKataGo, seuilsSimple, type AnalyseRevue, type NoteCoup,
} from './revue';
import { classerCoups, type CoupNote } from './notation';
import { commentaire } from './parcours';
import { KATAGO_424, SGF_424 } from './partie424.fixture';

const { positions, komi, resultat } = positionsDepuisSgf(SGF_424);
const FLORIAN = 1; // Noir

/** Estimation du moteur simple, comme dans le Worker de la revue, mais à nombre de simulations fixe (reproductible). */
function moteurSimple(estimation: boolean): AnalyseRevue[] {
  return positions.map(p => ({
    lead: avanceEstimee(p, ownership(p, { playouts: 600, timeMs: 1e9, estimation }), komi, { rules: 'japanese', fin: p.lastMove === -1 }),
    engine: 'simple',
  }));
}

/** La revue telle que l'écran la calcule (Revue.tsx). */
function revue(analyses: AnalyseRevue[]): { notes: (CoupNote | null)[]; avances: (number | null)[] } {
  const cle = momentCle(positions, analyses, FLORIAN);
  const base = notesAvecCle(noterCoups(positions, analyses), cle, analyses, 9);
  return { notes: notesCoherentes(classerCoups(positions, analyses, base), analyses, 9), avances: avancesAffichees(positions, analyses) };
}

const SANS_PERTE = new Set(['brillant', 'meilleur', 'excellent', 'bon', 'classique', 'solide', 'force']);

/** Contradictions entre la note, la phrase de Mochi et la pastille d'avance du parcours. */
function contradictions(notes: (NoteCoup | null)[], avances: (number | null)[], analyses: AnalyseRevue[]): string[] {
  const out: string[] = [];
  for (const n of notes) {
    if (!n) continue;
    const avant = avances[n.coup - 1], apres = avances[n.coup], s = n.couleur === 1 ? 1 : -1;
    const seuil = (analyses[n.coup].engine === 'katago' ? seuilsKataGo(9) : seuilsSimple(9)).imprecision;
    const lieu = toLabel(positions[n.coup].lastMove ?? -1, 9);
    if (SANS_PERTE.has(n.note) && avant != null && apres != null && s * (avant - apres) > seuil) {
      out.push(`coup ${n.coup} (${lieu}) : « ${n.note} » mais l'avance chute de ${(s * (avant - apres)).toFixed(1)}`);
    }
    const detail = commentaire(n as CoupNote, positions, { toi: n.couleur === FLORIAN, nom: 'Ami' }).detail;
    if (SANS_PERTE.has(n.note) && /perds|perd /.test(detail)) out.push(`coup ${n.coup} : « ${n.note} » et « ${detail} »`);
    if (!SANS_PERTE.has(n.note) && /Pas de perte|ne voit pas de perte/.test(detail)) out.push(`coup ${n.coup} : « ${n.note} » et « ${detail} »`);
  }
  return out;
}

describe('partie réelle de l’issue #424', () => {
  it('la partie se rejoue en entier : 48 coups, dont les deux passes', () => {
    expect(positions).toHaveLength(49);
    expect(toLabel(positions[24].lastMove!, 9)).toBe('J6');
    expect(toLabel(positions[27].lastMove!, 9)).toBe('B8');
    expect(toLabel(positions[28].lastMove!, 9)).toBe('J8');
    // E8 : Noir prend les 8 pierres blanches laissées en atari par J8.
    expect(positions[29].captures[1] - positions[28].captures[1]).toBe(8);
  });

  describe('ancien moteur simple : les chiffres du téléphone de Florian', () => {
    const ancien = moteurSimple(false);
    it('reproduit le défaut : +73,5 après le premier coup, −87,5 après J8, puis +74,5', () => {
      expect(ancien[1].lead).toBeGreaterThan(60);
      expect(ancien[24].lead).toBeCloseTo(-3.4, 0);
      expect(ancien[28].lead).toBeCloseTo(-87.5, 0);
      expect(ancien[36].lead).toBeGreaterThan(60);
    });
    it('même avec ces chiffres, plus de note fausse : J8 n’est plus « Solide » à côté de −87,5', () => {
      const { notes, avances } = revue(ancien);
      expect(contradictions(notes, avances, ancien)).toEqual([]);
      // L'estimation aberrante n'est ni montrée ni notée.
      expect(avances[27]).toBeNull();
      expect(avances[28]).toBeNull();
      expect(notes[27]).toBeNull();
      expect(notes[26]).toBeNull();
    });
  });

  describe('moteur simple corrigé (mode estimation)', () => {
    const simple = moteurSimple(true);
    const { notes, avances } = revue(simple);
    it('une courbe plausible : jamais plus de 40 points d’avance (KataGo en voit 58 au plus dans cette partie), et pas de saut que rien n’explique', () => {
      for (const v of avances) if (v != null) expect(Math.abs(v)).toBeLessThan(40);
      for (let i = 1; i < positions.length; i++) {
        const prises = positions[i].captures[1] - positions[i - 1].captures[1] + positions[i].captures[2] - positions[i - 1].captures[2];
        expect(Math.abs(simple[i].lead - simple[i - 1].lead), `position ${i}`).toBeLessThanOrEqual(81 / 3 + 2 * prises);
      }
      // Après le premier coup, la partie est encore égale (komi compris), pas +73,5.
      expect(Math.abs(simple[1].lead)).toBeLessThan(10);
    });
    it('aucune contradiction entre note, phrase et pastille', () => {
      expect(contradictions(notes, avances, simple)).toEqual([]);
    });
    it('J8 est une Gaffe de Blanc : il laisse prendre 8 pierres', () => {
      expect(notes[27]).toMatchObject({ coup: 28, couleur: 2, note: 'grosse', raison: 'groupePris', prisesApres: 8 });
      expect(notes[27]!.perte).toBeGreaterThan(seuilsSimple(9).erreur);
    });
    it('sans KataGo, pas de « Très belle partie » : le moteur simple ne voit pas tout', () => {
      const cle = momentCle(positions, simple, FLORIAN);
      const ctx = { avanceNoir: avanceFinale(resultat, simple[48].lead), size: 9, cle };
      expect(phraseBilan(notes, FLORIAN, 'Ami', ctx)).toMatch(/^Très belle partie/);
      expect(phraseBilan(notes, FLORIAN, 'Ami', { ...ctx, sansKataGo: true })).not.toMatch(/Très belle partie/);
    });
    it('B8 n’est plus une Gaffe : rien ne la mesure sans KataGo (la perte de 85 points venait de l’estimation)', () => {
      expect(notes[26]?.note).not.toBe('grosse');
    });
  });

  describe('avec KataGo (réseau réel, 32 visites)', () => {
    const { notes, avances } = revue(KATAGO_424);
    it('aucune contradiction entre note, phrase et pastille', () => {
      expect(contradictions(notes, avances, KATAGO_424)).toEqual([]);
    });
    it('le coup 27 (B8) reste une Gaffe : KataGo préférait F5, B8 perd environ 11 points', () => {
      expect(notes[26]).toMatchObject({ coup: 27, couleur: 1, note: 'grosse', meilleur: fromLabel('F5', 9) });
      expect(notes[26]!.perte).toBeGreaterThan(seuilsKataGo(9).erreur);
    });
    it('J8 est la plus grosse faute de Blanc', () => {
      const blanc = notes.filter((n): n is CoupNote => !!n && n.couleur === 2);
      expect(blanc.sort((a, b) => b.perte - a.perte)[0]).toMatchObject({ coup: 28, note: 'grosse' });
    });
    it('« beaucoup trop de bons coups » : KataGo voit que la plupart des coups des deux camps perdaient des points', () => {
      const c = compteNotes(notes, FLORIAN);
      expect(c.solide).toBe(0);
      expect(c.grosse + c.erreur + c.manque + c.imprecision).toBeGreaterThan(12);
      const av = avanceFinale(resultat, KATAGO_424[48].lead);
      expect(precisionHonnete(notes, FLORIAN, av, 9)).toBeLessThan(50);
    });
  });

  describe('le bilan compte chaque couleur à part', () => {
    for (const [nom, analyses] of [['moteur simple', moteurSimple(true)], ['KataGo', KATAGO_424]] as const) {
      it(nom, () => {
        const { notes } = revue(analyses);
        for (const couleur of [1, 2] as const) {
          const c = compteNotes(notes, couleur);
          const attendu = Object.fromEntries(NOTES.map(n => [n, 0]));
          for (const x of notes) if (x && positions[x.coup - 1].toPlay === couleur) attendu[x.note]++;
          expect(c).toEqual(attendu);
        }
        // Chaque coup noté compte une seule fois, chez son auteur.
        const total = NOTES.reduce((s, n) => s + compteNotes(notes, 1)[n] + compteNotes(notes, 2)[n], 0);
        expect(total).toBe(notes.filter(Boolean).length);
        if (analyses === KATAGO_424) expect(compteNotes(notes, 1)).not.toEqual(compteNotes(notes, 2));
      });
    }
  });
});
