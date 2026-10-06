import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const track = vi.fn();
// Environnement Node : un localStorage en mémoire suffit.
const memoire = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => { memoire.set(k, v); }, clear: () => memoire.clear() });
vi.mock('../data/analytics', async orig => ({ ...(await orig<typeof import('../data/analytics')>()), track: (...a: unknown[]) => track(...a) }));

const xp = await import('./xp');
const { GAINS, premiereDe, BONUS_PREMIERE, PREMIERES_KEY, lirePremieres, appliquer, cout, seuil, niveauDe, prochaineRecompense, recompenseDuNiveau, gagnerXp, lireXp, envoyerAgregat, abonnerXp, XP_KEY, PLAFOND } = xp;

describe('courbe des niveaux', () => {
  it('le niveau 2 arrive à 100 XP, puis environ +25 % par niveau', () => {
    expect(cout(1)).toBe(100);
    expect(cout(2)).toBe(125);
    expect(cout(3)).toBe(155);
    for (let n = 2; n < 11; n++) {
      expect(cout(n) / cout(n - 1)).toBeGreaterThan(1.2);
      expect(cout(n) / cout(n - 1)).toBeLessThan(1.3);
    }
    expect(seuil(1)).toBe(0);
    expect(seuil(2)).toBe(100);
    expect(seuil(3)).toBe(225);
    expect(seuil(5)).toBe(575);
  });

  it('le coût d’un niveau est plafonné : pas de progression sans fin', () => {
    expect(cout(40)).toBe(PLAFOND);
    expect(Math.max(...Array.from({ length: 100 }, (_, i) => cout(i + 1)))).toBe(PLAFOND);
  });

  it('niveauDe découpe l’XP en niveau et progression dans le niveau', () => {
    expect(niveauDe(0)).toEqual({ niveau: 1, dans: 0, besoin: 100 });
    expect(niveauDe(99)).toEqual({ niveau: 1, dans: 99, besoin: 100 });
    expect(niveauDe(100)).toEqual({ niveau: 2, dans: 0, besoin: 125 });
    expect(niveauDe(365)).toEqual({ niveau: 3, dans: 140, besoin: 155 });
    for (let n = 1; n < 30; n++) expect(niveauDe(seuil(n)).niveau).toBe(n);
  });

  it('une valeur invalide ou négative compte comme 0', () => {
    expect(niveauDe(-50).niveau).toBe(1);
    expect(appliquer(Number.NaN, 'probleme').avant).toBe(0);
  });
});

describe('gains', () => {
  it('barème : problème 10, Go du jour 20, révision du jour 20, leçon 30, partie 15, victoire 15 + 25, erreurs rejouées 10, objectif de la semaine 30', () => {
    expect(GAINS).toEqual({ probleme: 10, goDuJour: 20, revision: 20, lecon: 30, partie: 15, victoire: 40, erreursRejouees: 10, objectif: 30 });
  });

  it('#233 : chaque défi du jour qui fait vivre la série rapporte au moins autant que le Go du jour', () => {
    expect(GAINS.revision).toBe(GAINS.goDuJour);
    expect(GAINS.lecon).toBeGreaterThan(GAINS.goDuJour);
  });

  it('#233 (P1) : le Go du jour rapporte une fois par jour, même s’il était déjà réussi dans la grille', () => {
    const { sourceXpProbleme } = xp;
    expect(sourceXpProbleme({ dejaReussi: true, estDuJour: true, goDuJourDejaFait: false })).toBe('goDuJour');
    expect(sourceXpProbleme({ dejaReussi: false, estDuJour: true, goDuJourDejaFait: false })).toBe('goDuJour');
    // « Vu » plus tôt dans la journée, puis réussi sans aide : c'est la première vraie réussite, elle rapporte.
    expect(sourceXpProbleme({ dejaReussi: false, estDuJour: true, goDuJourDejaFait: true })).toBe('goDuJour');
    // Refait le même jour : rien de plus.
    expect(sourceXpProbleme({ dejaReussi: true, estDuJour: true, goDuJourDejaFait: true })).toBeNull();
    // Un problème ordinaire ne rapporte qu'à sa première réussite.
    expect(sourceXpProbleme({ dejaReussi: false, estDuJour: false, goDuJourDejaFait: true })).toBe('probleme');
    expect(sourceXpProbleme({ dejaReussi: true, estDuJour: false, goDuJourDejaFait: false })).toBeNull();
  });

  it('#233 (C8) : chaque première fois rapporte le même bonus, +20', () => {
    expect(new Set(Object.values(BONUS_PREMIERE))).toEqual(new Set([20]));
  });
  it('#233 : la révision est un problème pour le bonus « première fois » (pas de second bonus)', () => {
    expect(premiereDe('revision')).toBe('probleme');
    expect(appliquer(0, 'revision', true)).toMatchObject({ points: 40, bonus: 20 });
    expect(appliquer(0, 'revision')).toMatchObject({ points: 20, bonus: 0 });
  });

  it('un gain ne fait jamais baisser l’XP et signale le niveau franchi', () => {
    const g = appliquer(90, 'probleme');
    expect(g).toMatchObject({ points: 10, avant: 90, apres: 100, niveauAvant: 1, niveauApres: 2 });
    for (const s of Object.keys(GAINS) as (keyof typeof GAINS)[]) expect(appliquer(500, s).apres).toBeGreaterThan(500);
  });

  it('récompenses cosmétiques aux niveaux 3, 5 et 8', () => {
    expect(recompenseDuNiveau(3)?.nom).toBe('Kaya clair');
    expect(recompenseDuNiveau(5)?.nom).toBe('Ardoise');
    expect(recompenseDuNiveau(8)?.nom).toBe('Coquillage doré');
    expect(prochaineRecompense(1)?.niveau).toBe(3);
    expect(prochaineRecompense(8)).toBeUndefined();
  });
});

describe('gagnerXp (appareil)', () => {
  beforeEach(() => { localStorage.clear(); track.mockClear(); vi.useFakeTimers(); });
  afterEach(() => { envoyerAgregat(); vi.useRealTimers(); });

  it('crédite l’appareil, prévient les écouteurs et envoie niveau_atteint au passage', () => {
    localStorage.setItem(XP_KEY, '95');
    localStorage.setItem(PREMIERES_KEY, JSON.stringify(['lecon'])); // bonus déjà touché : gain nu
    const vus: number[] = [];
    const fin = abonnerXp(g => vus.push(g.apres));
    gagnerXp('lecon');
    fin();
    expect(lireXp()).toBe(125);
    expect(vus).toEqual([125]);
    expect(track).toHaveBeenCalledWith('niveau_atteint', expect.objectContaining({ niveau: 2, xp_total: 125, source: 'lecon' }));
  });

  it('xp_gagne est agrégé : plusieurs gains rapprochés, un seul événement', () => {
    localStorage.setItem(PREMIERES_KEY, JSON.stringify(['probleme']));
    gagnerXp('probleme');
    gagnerXp('goDuJour');
    expect(track).not.toHaveBeenCalledWith('xp_gagne', expect.anything());
    vi.advanceTimersByTime(5000);
    const envois = track.mock.calls.filter(c => c[0] === 'xp_gagne');
    expect(envois).toHaveLength(1);
    expect(envois[0][1]).toMatchObject({ points: 30, gains: 2, sources: 'goDuJour,probleme', xp_total: 30, niveau: 1 });
  });
});

// Issue #162 : bonus « première fois » et niveau 2 dans la première session.
describe('bonus première fois', () => {
  beforeEach(() => { localStorage.clear(); track.mockClear(); vi.useFakeTimers(); });
  afterEach(() => { envoyerAgregat(); vi.useRealTimers(); });

  it('appliquer ajoute le bonus de la catégorie seulement pour une première fois', () => {
    expect(appliquer(0, 'lecon', true)).toMatchObject({ points: 30 + BONUS_PREMIERE.lecon, bonus: BONUS_PREMIERE.lecon });
    expect(appliquer(0, 'lecon')).toMatchObject({ points: 30, bonus: 0 });
    // Le Go du jour est un problème, une victoire est une partie.
    expect(appliquer(0, 'goDuJour', true).bonus).toBe(BONUS_PREMIERE.probleme);
    expect(appliquer(0, 'victoire', true).bonus).toBe(BONUS_PREMIERE.partie);
  });

  it('chaque bonus ne se gagne qu’une fois par appareil', () => {
    expect(gagnerXp('probleme').bonus).toBe(BONUS_PREMIERE.probleme);
    expect(gagnerXp('goDuJour').bonus).toBe(0);
    expect(gagnerXp('victoire').bonus).toBe(BONUS_PREMIERE.partie);
    expect(gagnerXp('partie').bonus).toBe(0);
    expect([...lirePremieres()].sort()).toEqual(['partie', 'probleme']);
  });

  it('un stockage illisible ne casse rien : le bonus reste offert', () => {
    localStorage.setItem(PREMIERES_KEY, '{pas du json');
    expect(lirePremieres().size).toBe(0);
    localStorage.setItem(PREMIERES_KEY, JSON.stringify(['partie', 'triche', 3]));
    expect([...lirePremieres()]).toEqual(['partie']);
  });

  // Parcours type de l'analyse UX (#154), avec des durées prudentes pour un débutant.
  const PARCOURS: { source: 'partie' | 'lecon' | 'probleme'; minutes: number }[] = [
    { source: 'partie', minutes: 5 }, // une partie 9 × 9 contre Pomme, perdue : pas de bonus de victoire
    { source: 'lecon', minutes: 2.5 },
    { source: 'probleme', minutes: 1 },
    { source: 'probleme', minutes: 1 },
  ];

  it('parcours type (partie perdue, leçon, 2 problèmes) : le niveau 2 arrive avant 10 minutes', () => {
    let minutes = 0, niveau2: number | null = null;
    for (const etape of PARCOURS) {
      minutes += etape.minutes;
      const g = gagnerXp(etape.source);
      if (niveau2 === null && g.niveauApres >= 2) niveau2 = minutes;
    }
    expect(minutes).toBeLessThanOrEqual(10);
    expect(niveau2).not.toBeNull();
    expect(niveau2!).toBeLessThanOrEqual(10);
    expect(niveauDe(lireXp()).niveau).toBe(2);
    expect(track).toHaveBeenCalledWith('niveau_atteint', expect.objectContaining({ niveau: 2 }));
    // Sans les bonus, le même parcours restait sous le niveau 2 (65 XP sur 100) : c'est bien le bonus qui compte.
    expect(PARCOURS.reduce((s, e) => s + GAINS[e.source], 0)).toBeLessThan(100);
  });

  it('dans n’importe quel ordre, le parcours type atteint le niveau 2, pas le niveau 3', () => {
    for (const ordre of [[0, 1, 2, 3], [1, 2, 3, 0], [2, 3, 1, 0], [3, 0, 2, 1]]) {
      localStorage.clear();
      for (const i of ordre) gagnerXp(PARCOURS[i].source);
      expect(niveauDe(lireXp()).niveau).toBe(2);
    }
  });
});

describe('sourceXpPartie (#233, P4 et P5)', () => {
  const { sourceXpPartie } = xp;
  it('10 coups au moins : partie, ou victoire contre l’ordi', () => {
    expect(sourceXpPartie({ coups: 10, contreOrdi: true, gagne: true, reprise: false })).toBe('victoire');
    expect(sourceXpPartie({ coups: 40, contreOrdi: true, gagne: false, reprise: false })).toBe('partie');
    expect(sourceXpPartie({ coups: 40, contreOrdi: false, gagne: true, reprise: false })).toBe('partie');
  });
  it('9 coups ou moins : rien', () => {
    expect(sourceXpPartie({ coups: 9, contreOrdi: true, gagne: true, reprise: false })).toBeNull();
  });
  it('une partie reprise depuis la revue ne redonne pas d’XP, même gagnée (P5)', () => {
    expect(sourceXpPartie({ coups: 60, contreOrdi: true, gagne: true, reprise: true })).toBeNull();
    expect(sourceXpPartie({ coups: 60, contreOrdi: true, gagne: false, reprise: true })).toBeNull();
  });
  it('reprendre en boucle ne fait plus monter l’XP', () => {
    memoire.clear();
    const s = sourceXpPartie({ coups: 30, contreOrdi: true, gagne: true, reprise: false });
    if (s) gagnerXp(s);
    const apres = lireXp();
    for (let i = 0; i < 5; i++) { const r = sourceXpPartie({ coups: 30, contreOrdi: true, gagne: true, reprise: true }); if (r) gagnerXp(r); }
    expect(lireXp()).toBe(apres);
  });
});

describe('objectifs de la semaine (#369)', () => {
  beforeEach(() => { localStorage.clear(); track.mockClear(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-05T12:00:00+02:00')); });
  afterEach(() => { vi.useRealTimers(); });

  it('un objectif atteint rapporte 30 XP une seule fois, sans bonus « première fois »', () => {
    const { noterActivite } = xp;
    expect(appliquer(0, 'objectif', true).points).toBe(GAINS.objectif + BONUS_PREMIERE.probleme); // le calcul pur l'accepterait…
    for (let i = 0; i < 2; i++) noterActivite('erreurs'); // …mais gagnerXp ne le donne jamais : 2 erreurs = objectif atteint
    expect(lireXp()).toBe(30);
    expect(track).toHaveBeenCalledWith('objectif_semaine_atteint', { objectif: 'erreurs' });
    for (let i = 0; i < 5; i++) noterActivite('erreurs');
    expect(lireXp()).toBe(30);
    expect(lirePremieres().size).toBe(0);
  });

  it('les gains d’XP comptent pour la semaine : 3 parties atteignent l’objectif des parties', () => {
    for (let i = 0; i < 3; i++) gagnerXp('partie');
    // 3 × 15, +20 la première partie, +30 l'objectif atteint.
    expect(lireXp()).toBe(45 + 20 + 30);
    const etat = JSON.parse(localStorage.getItem('go.semaine.v1') ?? '{}');
    expect(etat.courante.compte.parties).toBe(3);
    expect(etat.courante.atteints).toEqual(['parties']);
  });

  it('le Go du jour compte comme un problème et comme un Go du jour ; une leçon comme une leçon', () => {
    gagnerXp('goDuJour'); gagnerXp('lecon'); gagnerXp('objectif');
    const etat = JSON.parse(localStorage.getItem('go.semaine.v1') ?? '{}');
    expect(etat.courante.compte).toEqual({ parties: 0, problemes: 1, erreurs: 0, goDuJour: 1, lecons: 1 });
  });
});
