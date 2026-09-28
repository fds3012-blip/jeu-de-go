import { describe, expect, it } from 'vitest';
import { CRAN_DEPART, CRAN_MAX, CRAN_MIN, cranDuNiveau, cranSuivant, forceInitiale, momentDeReglage, niveauGuide, reglerForce, SEUIL_GUIDEE, type ForceGuidee } from './guidee';
import { rng } from './sim';

/** Force au cran donné, dont le réglage précédent a vu l'écart `ecart` (pas de dérive si l'écart ne bouge pas). */
const stable = (cran: number, ecart = 0): ForceGuidee => ({ ...forceInitiale(cran), ecart });

describe('reglerForce : règles de base', () => {
  const f0 = forceInitiale(4);
  it('ne change rien tant que l’écart reste sous 15 points', () => {
    for (const e of [0, 15, -15, 7.5, -3]) {
      const r = reglerForce(e, f0);
      expect(r.force.cran).toBe(4);
      expect(r.annonce).toBeNull();
    }
  });
  it('joue plus doux quand Mochi mène de plus de 15 points', () => {
    const r = reglerForce(16, stable(4, 16));
    expect(r.force.cran).toBe(3);
    expect(r.annonce).toBe('plus-doux');
  });
  it('se renforce quand Mochi est mené de plus de 15 points', () => {
    const r = reglerForce(-16, stable(4, -16));
    expect(r.force.cran).toBe(5);
    expect(r.annonce).toBe('plus-fort');
  });
  it('change plus vite quand l’écart est grand', () => {
    expect(reglerForce(26, stable(6, 26)).force.cran).toBe(4); // 2 crans au-delà de 25 points
    expect(reglerForce(-36, stable(4, -36)).force.cran).toBe(7); // 3 crans au-delà de 35
    expect(reglerForce(-200, stable(4, -200)).force.cran).toBe(8); // PAS_MAX crans au plus
  });
  it('change plus vite quand l’écart se creuse vite', () => {
    // Même écart de 16 points : un cran s'il était déjà là, deux s'il vient de se creuser de 10 points ou plus.
    expect(reglerForce(-16, stable(4, -16)).force.cran).toBe(5);
    expect(reglerForce(-16, stable(4, -6)).force.cran).toBe(6);
    // Un écart qui se résorbe n'accélère rien.
    expect(reglerForce(-16, stable(4, -30)).force.cran).toBe(5);
  });
  it('reste dans ses bornes, sans rien annoncer à la borne', () => {
    const bas = reglerForce(60, forceInitiale(CRAN_MIN));
    expect(bas.force.cran).toBe(CRAN_MIN);
    expect(bas.annonce).toBeNull();
    const haut = reglerForce(-60, forceInitiale(CRAN_MAX));
    expect(haut.force.cran).toBe(CRAN_MAX);
    expect(haut.annonce).toBeNull();
    expect(reglerForce(40, forceInitiale(1)).force.cran).toBe(CRAN_MIN);
    expect(forceInitiale(99).cran).toBe(CRAN_MAX);
    expect(forceInitiale(-3).cran).toBe(CRAN_MIN);
  });
  it('ignore une estimation indisponible', () => {
    expect(reglerForce(Number.NaN, f0)).toEqual({ force: f0, annonce: null });
  });
  it('hystérésis : pas d’aller-retour immédiat', () => {
    const doux = reglerForce(20, stable(4, 20)).force; // cran 3, sens -1
    expect(doux.cran).toBe(3);
    // L'écart bascule aussitôt à -20 (estimation bruitée) : Mochi ne remonte pas tout de suite.
    const r1 = reglerForce(-20, doux);
    expect(r1.force.cran).toBe(3);
    expect(r1.annonce).toBeNull();
    // Au réglage suivant, l'écart reste net : il se renforce.
    const r2 = reglerForce(-20, r1.force);
    expect(r2.force.cran).toBe(4);
    expect(r2.annonce).toBe('plus-fort');
  });
  it('hystérésis : après un retour au calme, il peut changer de sens', () => {
    const doux = reglerForce(20, stable(4, 20)).force;
    const calme = reglerForce(2, doux).force;
    expect(reglerForce(-16, calme).force.cran).toBeGreaterThan(3);
  });
  it('continue dans le même sens sans attendre', () => {
    const a = reglerForce(20, stable(4, 20)).force;
    expect(reglerForce(20, a).force.cran).toBe(2);
  });
  it('règle la force tous les 10 coups', () => {
    expect([0, 5, 10, 19, 20, 30].map(momentDeReglage)).toEqual([false, false, true, false, true, true]);
  });
  it('repart du cran où la partie précédente s’est arrêtée', () => {
    expect(cranSuivant(stable(6))).toBe(6);
    expect(cranDuNiveau(0)).toBe(2); // Pomme
    expect(cranDuNiveau(8)).toBe(CRAN_MAX); // Sensei
  });
  it('emprunte les réglages des niveaux de l’échelle, sous le nom de Mochi', () => {
    expect(niveauGuide(0).id).toBe('pomme');
    expect(niveauGuide(0).hasard).toBeGreaterThan(niveauGuide(2).hasard); // plus doux que Pomme
    expect(niveauGuide(2)).toMatchObject({ id: 'pomme', hasard: 0.3 });
    expect(niveauGuide(CRAN_MAX).katago?.visits).toBe(200);
    expect(niveauGuide(3).nom).toBe('Mochi');
  });
});

/**
 * Simulation sans KataGo (#79). Une partie est une suite de coups ; chaque coup coûte à son auteur des points par
 * rapport au meilleur coup, tirés au hasard (loi gamma de forme 4 : écart type égal à la moitié de la moyenne)
 * autour de la perte moyenne de son niveau. Pertes moyennes par coup en 9 × 9 : ordre de grandeur tiré des écarts
 * mesurés entre voisins de l'échelle (docs/game-design/equilibrage.md, environ 30 coups par joueur), extrapolé pour
 * les deux crans plus doux que Pomme. Ce n'est pas une mesure : c'est un modèle pour vérifier que la régulation
 * converge. La force réelle de chaque cran reste à mesurer avec KataGo (banc echelle.bench.test.ts).
 * L'estimation de l'écart que reçoit `reglerForce` est bruitée (écart type de 5 points).
 */
const PERTE = [8.0, 6.5, 5.1, 4.0, 2.5, 1.7, 1.15, 0.95, 0.4, 0.3, 0.2];
const BOTS = [
  ['faible', 5.0], // un débutant qui joue presque au hasard (Pomme, 20 kyu)
  ['fort', 1.15], // un joueur solide pour l'app (Rivière, 7 kyu)
  ['très fort', 0.4], // Montagne, 3 kyu
] as const;
const BRUIT_ESTIMATION = 5;
const FORME = 4;

function tirerPerte(rand: () => number, moyenne: number): number {
  let s = 0;
  for (let i = 0; i < FORME; i++) s -= Math.log(1 - rand());
  return (s / FORME) * moyenne;
}

function normale(rand: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
}

/**
 * Une partie guidée (Mochi réglé) ou témoin (`regle: false`, Mochi figé à son départ). Renvoie l'écart final
 * (avance de Mochi), le nombre de changements annoncés, d'allers-retours, et le cran de la partie suivante.
 */
function partie(perteJoueur: number, graine: number, depart = CRAN_DEPART, regle = true) {
  const rand = rng(Math.imul(graine ^ 0x9e3779b9, 0x85ebca6b));
  const coups = 50 + Math.floor(rand() * 21); // 9 × 9 : de 50 à 70 coups
  let f: ForceGuidee = forceInitiale(depart), ecart = 0, changements = 0, inversions = 0, dernier = 0;
  const mochiNoir = graine % 2 === 0;
  for (let n = 1; n <= coups; n++) {
    const mochiJoue = (n % 2 === 1) === mochiNoir;
    const perte = tirerPerte(rand, mochiJoue ? PERTE[f.cran] : perteJoueur);
    ecart = Math.max(-81, Math.min(81, ecart + (mochiJoue ? -perte : perte)));
    if (momentDeReglage(n)) {
      const r = reglerForce(ecart + BRUIT_ESTIMATION * normale(rand), f);
      if (!regle) continue;
      if (r.annonce) {
        const s = r.annonce === 'plus-doux' ? -1 : 1;
        if (dernier && s !== dernier) inversions++;
        dernier = s; changements++;
      }
      f = r.force;
    }
  }
  return { ecart, changements, inversions, fin: cranSuivant(f) };
}

function mediane(v: number[]): number {
  const s = [...v].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

describe('simulation de 50 parties guidées (bots factices)', () => {
  // 50 parties par bot, en quelques millisecondes : pas besoin de réduire leur nombre.
  const N = 50;
  for (const [nom, perte] of BOTS) {
    it(`contre un bot ${nom} : écart final médian sous ${SEUIL_GUIDEE} points`, () => {
      // Série : chaque partie repart du cran où la précédente s'est arrêtée (cranSuivant), comme pour un joueur réel.
      let depart = CRAN_DEPART;
      const res = Array.from({ length: N }, (_, i) => { const r = partie(perte, 1000 + i, depart); depart = r.fin; return r; });
      const med = mediane(res.map(r => Math.abs(r.ecart)));
      // Parties isolées : chaque partie repart du cran par défaut (premier contact avec Mochi).
      const seules = mediane(Array.from({ length: N }, (_, i) => Math.abs(partie(perte, 1000 + i).ecart)));
      // Témoin : même bot, mêmes tirages, Mochi figé à son cran de départ.
      const fige = mediane(Array.from({ length: N }, (_, i) => Math.abs(partie(perte, 1000 + i, CRAN_DEPART, false).ecart)));
      console.info(`[guidee] bot ${nom} : médiane |écart| en série ${med.toFixed(1)}, parties isolées ${seules.toFixed(1)}, `
        + `Mochi figé ${fige.toFixed(1)} ; changements par partie ${mediane(res.map(r => r.changements))}, `
        + `allers-retours ${res.reduce((s, r) => s + r.inversions, 0)} sur ${N} parties, cran final ${depart}`);
      expect(med).toBeLessThan(SEUIL_GUIDEE);
      // Même au premier contact, la régulation fait bien mieux qu'un Mochi figé.
      expect(seules).toBeLessThan(fige);
      // Pas d'oscillation : en médiane, au plus un changement de sens par partie.
      expect(mediane(res.map(r => r.inversions))).toBeLessThanOrEqual(1);
    });
  }
});
