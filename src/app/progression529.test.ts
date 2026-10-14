// #529 : chaque effort compte. XP de la course, partie qui fait vivre la série, badges du moment, récompenses après le
// niveau 8. Règles pures et branchement sur un stockage en mémoire.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const track = vi.fn();
const memoire = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => { memoire.set(k, v); },
  removeItem: (k: string) => { memoire.delete(k); }, clear: () => memoire.clear(),
});
vi.mock('../data/analytics', async orig => ({ ...(await orig<typeof import('../data/analytics')>()), track: (...a: unknown[]) => track(...a) }));

const xp = await import('./xp');
const { GAINS, XP_COURSE, COURSE_XP_KEY, SANS_PREMIERE, RECOMPENSES, crediterCourse, finirPartieEnLigne, gagnerXp, lireXp, niveauDe, recompenseDuNiveau, seuil, sourceXpCourse, appliquer } = xp;
const { compteDansSerie, SERIE_UN_DEFI } = await import('./defi');
const { SERIE_KEY, numeroDuJour } = await import('./goDuJour');
const { BADGES_KEY, gagnerBadge } = await import('./badgesGagnes');
const { ORDRE_THEMES, THEMES_GOBAN } = await import('../ui/boardArt');
const { traduire } = await import('../content/i18n/secondaires');

const lire = (k: string) => JSON.parse(memoire.get(k) ?? 'null');
const MIDI = new Date('2026-10-13T12:00:00+02:00');

beforeEach(() => { memoire.clear(); track.mockClear(); });

describe('course aux problèmes : de l’XP une fois par jour (#529, P10)', () => {
  it('rapporte autant qu’une partie terminée, sans bonus « première fois »', () => {
    expect(XP_COURSE).toBe(15);
    expect(GAINS.course).toBe(GAINS.partie);
    expect(SANS_PREMIERE.has('course')).toBe(true);
    expect(appliquer(0, 'course').points).toBe(15);
  });

  it('il faut au moins un problème juste, et une seule course payée par jour', () => {
    expect(sourceXpCourse({ score: 0, dernierJour: null, numero: 10 })).toBeNull();
    expect(sourceXpCourse({ score: 1, dernierJour: null, numero: 10 })).toBe('course');
    expect(sourceXpCourse({ score: 7, dernierJour: 10, numero: 10 })).toBeNull();
    expect(sourceXpCourse({ score: 7, dernierJour: 9, numero: 10 })).toBe('course');
    // Bras témoin du test A/B : la course ne rapporte rien.
    expect(sourceXpCourse({ score: 7, dernierJour: null, numero: 10, gain: 0 })).toBeNull();
  });

  it('sur l’appareil : +15 à la première course du jour, rien à la deuxième, de nouveau le lendemain', () => {
    expect(crediterCourse(3, MIDI)?.points).toBe(15);
    expect(lireXp()).toBe(15);
    expect(lire(COURSE_XP_KEY)).toBe(numeroDuJour(MIDI));
    expect(crediterCourse(9, MIDI)).toBeNull();
    expect(lireXp()).toBe(15);
    // Le bonus « première fois » des problèmes reste à prendre au premier vrai problème.
    expect(gagnerXp('probleme').bonus).toBe(20);
    const demain = new Date(MIDI.getTime() + 86_400_000);
    expect(crediterCourse(1, demain)?.points).toBe(15);
  });

  it('une course sans problème juste ne consomme pas la course payante du jour', () => {
    expect(crediterCourse(0, MIDI)).toBeNull();
    expect(memoire.has(COURSE_XP_KEY)).toBe(false);
    expect(crediterCourse(2, MIDI)?.points).toBe(15);
  });

  it('ne fait pas vivre la série : une course n’est pas le défi commun', () => {
    crediterCourse(5, MIDI);
    expect(memoire.has(SERIE_KEY)).toBe(false);
  });
});

describe('une partie terminée fait vivre la série du jour (#529, P2)', () => {
  it('derrière l’interrupteur A/B existant `SERIE_UN_DEFI`', () => {
    expect(SERIE_UN_DEFI).toBe(true);
    expect(compteDansSerie('partie')).toBe(true);
    expect(compteDansSerie('partie', false)).toBe(false);
    expect(compteDansSerie('go_du_jour', false)).toBe(true);
  });

  it('une partie ou une victoire qui rapporte de l’XP avance la série, une fois par jour', () => {
    vi.useFakeTimers(); vi.setSystemTime(MIDI);
    try {
      gagnerXp('partie');
      expect(lire(SERIE_KEY)).toEqual({ dernier: numeroDuJour(MIDI), jours: 1 });
      gagnerXp('victoire');
      expect(lire(SERIE_KEY).jours).toBe(1);
      vi.setSystemTime(new Date(MIDI.getTime() + 86_400_000));
      gagnerXp('victoire');
      expect(lire(SERIE_KEY).jours).toBe(2);
    } finally { vi.useRealTimers(); }
  });

  it('un problème neuf, lui, ne touche pas la série (seul le Go du jour la fait vivre)', () => {
    gagnerXp('probleme');
    expect(memoire.has(SERIE_KEY)).toBe(false);
  });

  it('partie en ligne : série au-delà de 10 coups, badges du moment, rien pour une partie annulée', () => {
    vi.useFakeTimers(); vi.setSystemTime(MIDI);
    try {
      finirPartieEnLigne({ issue: 'annulee', classee: true, coups: 40 });
      expect(lire(BADGES_KEY)).toBeNull();
      expect(memoire.has(SERIE_KEY)).toBe(false);
      finirPartieEnLigne({ issue: 'defaite', classee: true, coups: 6 });
      expect(lire(BADGES_KEY)).toEqual(['premiere-en-ligne']);
      expect(memoire.has(SERIE_KEY)).toBe(false);
      finirPartieEnLigne({ issue: 'victoire', classee: false, coups: 30 });
      expect(lire(BADGES_KEY)).toEqual(['premiere-en-ligne']);
      expect(lire(SERIE_KEY).jours).toBe(1);
      finirPartieEnLigne({ issue: 'victoire', classee: true, coups: 30 });
      expect(lire(BADGES_KEY)).toEqual(['premiere-en-ligne', 'victoire-classee']);
      expect(lireXp()).toBe(0); // pas d'XP en ligne : la cote est la récompense
    } finally { vi.useRealTimers(); }
  });
});

describe('badges du moment (#529)', () => {
  it('gagnerBadge est idempotent et ne retire jamais rien', () => {
    memoire.set(BADGES_KEY, JSON.stringify(['serie-7']));
    expect(gagnerBadge('objectif-semaine')).toBe(true);
    expect(gagnerBadge('objectif-semaine')).toBe(false);
    expect(lire(BADGES_KEY)).toEqual(['serie-7', 'objectif-semaine']);
  });

  it('un stockage abîmé repart d’une liste propre', () => {
    memoire.set(BADGES_KEY, '{"x":1}');
    expect(gagnerBadge('premiere-en-ligne')).toBe(true);
    expect(lire(BADGES_KEY)).toEqual(['premiere-en-ligne']);
  });
});

describe('récompenses après le niveau 8 (#529, P7)', () => {
  it('trois récompenses de plus, aux niveaux 10, 12 et 15, toutes des décors du goban', () => {
    expect(RECOMPENSES.map(r => r.niveau)).toEqual([3, 5, 8, 10, 12, 15]);
    expect(recompenseDuNiveau(10)?.id).toBe('cerisier');
    expect(recompenseDuNiveau(12)?.id).toBe('jade');
    expect(recompenseDuNiveau(15)?.id).toBe('kaya-ancien');
    for (const r of RECOMPENSES) {
      expect(ORDRE_THEMES).toContain(r.id);
      expect(THEMES_GOBAN[r.id].nom).toBe(r.nom);
      expect(traduire('fr', `theme.${r.id}`)).toBe(r.nom);
      expect(traduire('en', `theme.${r.id}`).length).toBeGreaterThan(2);
    }
  });

  it('franchir le niveau 10 envoie `niveau_atteint` avec sa récompense', () => {
    memoire.set('go.xp.v1', JSON.stringify(seuil(10) - 5));
    memoire.set('go.xp.premieres.v1', JSON.stringify(['partie', 'lecon', 'probleme']));
    const g = gagnerXp('partie');
    expect(g.niveauApres).toBe(10);
    expect(niveauDe(g.apres).niveau).toBe(10);
    expect(track).toHaveBeenCalledWith('niveau_atteint', expect.objectContaining({ niveau: 10, recompense: 'cerisier' }));
  });

  it('le serveur accepte les nouveaux décors : la dernière migration des réglages les met en liste blanche', () => {
    const dossier = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url));
    const derniere = readdirSync(dossier).filter(f => readFileSync(join(dossier, f), 'utf8').includes('function public.enregistrer_reglages')).sort().pop()!;
    const sql = readFileSync(join(dossier, derniere), 'utf8');
    for (const id of ORDRE_THEMES) expect(sql, derniere).toContain(`'"${id}"'`);
    expect(sql).toContain("security definer set search_path = ''");
  });
});
