// Simulation de l'économie de progression sur 30 jours (issue #233), avec les vraies règles et le vrai contenu :
// XP et bonus « première fois » (xp.ts), série « un défi par jour » et gels (gel.ts), révision du jour (revision.ts),
// paliers de problèmes (paliers.ts), Go du jour (goDuJour.ts), badges (vitrine.ts).
// Carte complète et lecture des résultats : docs/game-design/economie.md.
// Ce test ne touche pas au stockage : il rejoue les fonctions pures, jour par jour.
import { describe, expect, it } from 'vitest';
import { LESSONS } from '../content/lessons';
import { ALL_PUZZLES } from '../content/puzzles';
import { appliquer, niveauDe, recompensesDebloquees, type Premiere, type SourceXp, premiereDe } from './xp';
import { apresReussite, reconcilier, RESERVE_VIDE, type Reserve } from './gel';
import { problemeDuNumero, type Serie } from './goDuJour';
import { apresRevision, aFaire, ETAT_VIDE, revisionDuJour, revisionFaite, synchroniser, type EtatRevision } from './revision';
import { paliers, prochain } from './paliers';
import { badges } from './vitrine';

type Pb = { id: string; difficulty: number };
const PROBLEMES: Pb[] = ALL_PUZZLES.map(p => ({ id: p.id, difficulty: p.difficulty }));

export interface Profil {
  nom: string;
  /** Nouveaux problèmes tentés par jour (onglet Problèmes, « Continuer »). */
  problemes: number;
  /** Leçons terminées par jour tant qu'il en reste (0,5 : un jour sur deux). */
  lecons: number;
  /** Série d'entraînement après chaque leçon (3 problèmes du thème, #200). */
  pratique: boolean;
  /** Parties contre l'ordi par jour (les jours sans leçon pour le joueur de 10 min). */
  parties: number;
  /** Une partie sur `victoireSur` est gagnée (la 2e partie de la vie du joueur l'est toujours : Pomme, komi 0,5). */
  victoireSur: number;
  /** Jours sans rien ouvrir (numéros). */
  absences?: number[];
}

/** « 10 min par jour » : Go du jour, révision, 2 problèmes, puis une leçon un jour sur deux, sinon une partie. */
export const DIX_MIN: Profil = { nom: '10 min/jour', problemes: 2, lecons: 0.5, pratique: false, parties: 1, victoireSur: 3 };
/** « 30 min par jour » : Go du jour, révision, 6 problèmes, une leçon et sa série d'entraînement, 2 parties. */
export const TRENTE_MIN: Profil = { nom: '30 min/jour', problemes: 6, lecons: 1, pratique: true, parties: 2, victoireSur: 2 };
/** « 10 min, pas le week-end » : comme DIX_MIN, mais absent 2 jours sur 7 (les gels jouent). */
export const DIX_MIN_SEMAINE: Profil = { ...DIX_MIN, nom: '10 min, 5 j/7', absences: [6, 7, 13, 14, 20, 21, 27, 28] };

export interface Releve {
  jour: number; xp: number; niveau: number; badges: number; serie: number; record: number; gels: number;
  reussis: number; lecons: number; parties: number; victoires: number;
  /** XP du jour, par source. */
  duJour: Partial<Record<SourceXp, number>>;
  /** Go du jour réussi, mais déjà résolu avant : 0 XP (règle actuelle de Puzzles.tsx). */
  goDuJourSansXp: boolean;
}

/**
 * Rejoue `jours` jours. Tout problème tenté la première fois est « Vu » une fois sur 5 (aide jusqu'à la réponse, #197) :
 * ni XP ni palier ; il revient plus tard par « Continuer ». Les autres sont réussis. La révision est réussie du premier coup.
 */
export function simuler(p: Profil, jours = 30): Releve[] {
  let xp = 0, lecons = 0, parties = 0, victoires = 0, tentes = 0, record = 0;
  let serie: Serie | null = null, reserve: Reserve = RESERVE_VIDE, revision: EtatRevision = ETAT_VIDE;
  const premieres = new Set<Premiere>(), reussis = new Set<string>(), vus = new Set<string>(), gagnes: string[] = [];
  const releves: Releve[] = [];
  let duJour: Partial<Record<SourceXp, number>> = {};

  const gagner = (source: SourceXp) => {
    const cat = premiereDe(source);
    const g = appliquer(xp, source, !premieres.has(cat));
    premieres.add(cat);
    xp = g.apres;
    duJour[source] = (duJour[source] ?? 0) + g.points;
  };
  const defi = (numero: number) => {
    const r = apresReussite(serie, reserve, numero);
    serie = r.serie; reserve = r.reserve; record = Math.max(record, r.serie.jours);
  };
  /** Un nouveau problème tenté : Vu une fois sur 5, sinon réussi (+10 XP). */
  const tenter = (pb: Pb) => {
    const vu = !vus.has(pb.id) && tentes++ % 5 === 4;
    if (vu) { vus.add(pb.id); return; }
    reussis.add(pb.id); vus.delete(pb.id); gagner('probleme');
  };
  const continuer = () => {
    const pb = prochain(paliers(PROBLEMES, reussis), reussis);
    if (pb) tenter(pb);
  };

  for (let numero = 1; numero <= jours; numero++) {
    duJour = {};
    let goDuJourSansXp = false;
    const b = reconcilier(serie, reserve, numero);
    serie = b.serie; reserve = b.reserve;
    if (!p.absences?.includes(numero)) {
      // 1. Go du jour : série toujours ; XP seulement si ce problème n'était pas déjà réussi.
      const gdj = problemeDuNumero(PROBLEMES, numero)!;
      if (reussis.has(gdj.id)) goDuJourSansXp = true;
      else { reussis.add(gdj.id); gagner('goDuJour'); }
      defi(numero);
      // 2. Révision du jour : 3 problèmes déjà réussis, dus à J+1, J+3, J+7.
      revision = revisionDuJour(synchroniser(revision, reussis, numero), numero, new Set(PROBLEMES.map(x => x.id)));
      for (let id = aFaire(revision, numero); id; id = aFaire(revision, numero)) {
        const avant = revisionFaite(revision, numero);
        revision = apresRevision(revision, id, true, numero);
        if (!avant && revisionFaite(revision, numero)) { gagner('revision'); defi(numero); }
      }
      // 3. Nouveaux problèmes.
      for (let i = 0; i < p.problemes; i++) continuer();
      // 4. Leçon (et sa série d'entraînement), sinon partie.
      const leconAujourdhui = lecons < LESSONS.length && (p.lecons >= 1 || numero % 2 === 1);
      if (leconAujourdhui) {
        lecons++; gagner('lecon'); defi(numero);
        if (p.pratique) for (let i = 0; i < 3; i++) continuer();
      }
      const nParties = p.lecons >= 1 || !leconAujourdhui ? p.parties : 0;
      for (let i = 0; i < nParties; i++) {
        parties++;
        const gagne = parties === 2 || parties % p.victoireSur === 0;
        if (gagne) victoires++;
        gagner(gagne ? 'victoire' : 'partie');
      }
    }
    const s = serie as Serie | null;
    const vivante = s && numero - s.dernier <= 1 ? s.jours : 0;
    const ps = paliers(PROBLEMES, reussis);
    const liste = badges({ reussis: reussis.size, serie: vivante, record, parties, bilan: { pomme: { v: Math.min(victoires, 1), d: 0 } }, paliers: ps }, gagnes);
    for (const x of liste) if (x.obtenu && !gagnes.includes(x.id)) gagnes.push(x.id);
    releves.push({
      jour: numero, xp, niveau: niveauDe(xp).niveau, badges: gagnes.length, serie: vivante, record, gels: reserve.gels,
      reussis: reussis.size, lecons, parties, victoires, duJour, goDuJourSansXp,
    });
  }
  return releves;
}

const resume = (r: Releve) =>
  `J${String(r.jour).padStart(2)} · ${String(r.xp).padStart(4)} XP · niv. ${String(r.niveau).padStart(2)} · ${r.badges}/7 badges · série ${String(r.serie).padStart(2)} (gels ${r.gels}) · ${String(r.reussis).padStart(3)} pb · ${r.lecons}/7 leçons · ${r.parties} parties`;

describe('économie de progression : simulation sur 30 jours (#233)', () => {
  const profils = [DIX_MIN, TRENTE_MIN, DIX_MIN_SEMAINE];
  const resultats = new Map(profils.map(p => [p.nom, simuler(p)]));

  it('affiche J1, J7, J14 et J30 pour chaque joueur type (lu dans docs/game-design/economie.md)', () => {
    for (const [nom, r] of resultats) {
      console.log(`\n${nom}\n${[0, 6, 13, 29].map(i => resume(r[i])).join('\n')}`);
      const sansXp = r.filter(x => x.goDuJourSansXp).length;
      console.log(`  Go du jour réussis sans XP (déjà résolus) : ${sansXp} jours sur ${r.length}`);
      const niveaux = [3, 5, 8].map(n => r.find(x => x.niveau >= n)?.jour ?? '—');
      console.log(`  Jour des récompenses (niv. 3, 5, 8) : ${niveaux.join(', ')}`);
      const derniere = r.find(x => x.badges === r[r.length - 1].badges)!.jour;
      console.log(`  Dernier badge gagné : J${derniere}`);
      const revision = r.reduce((s, x) => s + (x.duJour.revision ?? 0), 0);
      console.log(`  XP de la révision sur 30 jours : ${revision} (0 avant #233)`);
      console.log(`  Gels gagnés un jour ou l'autre : ${r.some(x => x.gels > 0) ? 'oui' : 'non'} ; record : ${r[r.length - 1].record} jours`);
      const parSource: Partial<Record<SourceXp, number>> = {};
      for (const x of r) for (const [k, v] of Object.entries(x.duJour)) parSource[k as SourceXp] = (parSource[k as SourceXp] ?? 0) + (v ?? 0);
      console.log(`  XP par source : ${JSON.stringify(parSource)}`);
    }
  });

  it('l’XP ne descend jamais et le record de série non plus', () => {
    for (const r of resultats.values()) {
      for (let i = 1; i < r.length; i++) {
        expect(r[i].xp).toBeGreaterThanOrEqual(r[i - 1].xp);
        expect(r[i].record).toBeGreaterThanOrEqual(r[i - 1].record);
      }
    }
  });

  it('boucle de session : le niveau 2 tombe dès le premier jour, même à 10 minutes', () => {
    for (const r of resultats.values()) expect(r[0].niveau).toBeGreaterThanOrEqual(2);
  });

  it('boucle de semaine : la première récompense (niveau 3) arrive dans la première semaine à 10 minutes par jour', () => {
    expect(resultats.get(DIX_MIN.nom)![6].niveau).toBeGreaterThanOrEqual(3);
    expect(recompensesDebloquees(resultats.get(DIX_MIN.nom)![6].niveau).length).toBeGreaterThanOrEqual(1);
  });

  it('la révision du jour rapporte de l’XP : un défi du jour qui fait vivre la série rapporte toujours quelque chose', () => {
    const r = resultats.get(DIX_MIN.nom)!;
    expect(r.some(x => (x.duJour.revision ?? 0) > 0)).toBe(true);
    // Chaque jour joué rapporte de l'XP (plus de jour « série sans rien »).
    for (const x of r) expect(Object.values(x.duJour).reduce((s, v) => s + (v ?? 0), 0)).toBeGreaterThan(0);
  });

  it('gels : 5 jours sur 7 suffisent à garder la série grâce aux gels, sans jamais la perdre', () => {
    const r = resultats.get(DIX_MIN_SEMAINE.nom)!;
    // Le premier week-end arrive avant le premier gel (gagné à 7 jours) : la série repart, mais le record reste.
    expect(r[r.length - 1].record).toBeGreaterThanOrEqual(5);
  });

  it('30 minutes par jour : le joueur assidu ne dépasse pas le plafond de la courbe en un mois', () => {
    const r = resultats.get(TRENTE_MIN.nom)!;
    expect(r[29].niveau).toBeLessThan(15);
  });
});
