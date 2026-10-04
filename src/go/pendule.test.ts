import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ABSENCE_MS, CADENCE_DEFAUT, CADENCES, cadran, ecartHorloge, lireEtatDirect, penduleApres, penduleApresCoup, texteTemps, traitDe, type EtatDirect
} from './pendule';

const migration = readFileSync(new URL('../../supabase/migrations/20261004180100_partie_en_direct.sql', import.meta.url), 'utf8');

describe('pendule : byo-yomi japonais (mêmes cas que supabase/tests/partie_en_direct.test.sql)', () => {
  it('temps principal, période perdue, joué dans la période, chute', () => {
    expect(penduleApres(600_000, 3, 30_000, 5_000)).toEqual({ mainMs: 595_000, periodes: 3, tombe: false });
    expect(penduleApres(1_000, 3, 30_000, 40_000)).toEqual({ mainMs: 0, periodes: 2, tombe: false });
    expect(penduleApres(0, 3, 30_000, 29_999)).toEqual({ mainMs: 0, periodes: 3, tombe: false });
    expect(penduleApres(0, 1, 30_000, 30_000)).toEqual({ mainMs: 0, periodes: 0, tombe: true });
    expect(penduleApres(600_000, 3, 30_000, 689_999)).toEqual({ mainMs: 0, periodes: 1, tombe: false });
    expect(penduleApres(600_000, 3, 30_000, 690_000)).toEqual({ mainMs: 0, periodes: 0, tombe: true });
  });
  it('un écoulé négatif (horloges décalées) ne rend pas de temps', () => {
    expect(penduleApres(600_000, 3, 30_000, -5_000)).toEqual({ mainMs: 600_000, periodes: 3, tombe: false });
  });
  it('mêmes cadences que public.cadence_direct, 10 min + 3 × 30 s par défaut', () => {
    expect(CADENCE_DEFAUT).toBe('normale');
    expect(CADENCES.normale).toEqual({ mainMs: 600_000, periodes: 3, periodeMs: 30_000 });
    for (const [nom, c] of Object.entries(CADENCES)) {
      expect(migration).toContain(`('${nom}', ${c.mainMs}, ${c.periodes}::smallint, ${c.periodeMs})`);
    }
    expect(migration).toContain(`interval '${ABSENCE_MS / 1000} seconds'`);
  });
});

const base: EtatDirect = {
  statut: 'active', resultat: null, coups: '', comptage: false, mortes: null, mortesPar: null, cadence: 'normale', periodeMs: 30_000,
  noir: { ms: 600_000, periodes: 3, vuLe: 0 }, blanc: { ms: 600_000, periodes: 3, vuLe: 0 }, traitDepuis: 1_000_000, maintenant: 1_000_000,
};

describe('cadran affiché', () => {
  it('seule la pendule du joueur au trait tourne', () => {
    expect(cadran(base, 1, 1_005_000)).toEqual({ ms: 595_000, periodes: 3, byoyomi: false, tourne: true, tombe: false });
    expect(cadran(base, 2, 1_005_000)).toEqual({ ms: 600_000, periodes: 3, byoyomi: false, tourne: false, tombe: false });
    expect(traitDe('ee')).toBe(2);
    expect(cadran({ ...base, coups: 'ee' }, 2, 1_001_000).tourne).toBe(true);
  });
  it('byo-yomi : ce qui reste de la période en cours, et les périodes', () => {
    const e = { ...base, noir: { ms: 1_000, periodes: 3, vuLe: 0 } };
    expect(cadran(e, 1, 1_000_000 + 1_000 + 12_000)).toEqual({ ms: 18_000, periodes: 3, byoyomi: true, tourne: true, tombe: false });
    expect(cadran(e, 1, 1_000_000 + 1_000 + 42_000)).toEqual({ ms: 18_000, periodes: 2, byoyomi: true, tourne: true, tombe: false });
    expect(cadran(e, 1, 1_000_000 + 1_000 + 90_000).tombe).toBe(true);
  });
  it('arrêtée pendant le comptage et à la fin', () => {
    expect(cadran({ ...base, comptage: true, traitDepuis: null }, 1, 2_000_000).tourne).toBe(false);
    expect(cadran({ ...base, statut: 'finished' }, 1, 2_000_000).tourne).toBe(false);
    expect(cadran({ ...base, noir: { ms: 0, periodes: 2, vuLe: 0 }, coups: 'ee' }, 1, 0)).toEqual({ ms: 30_000, periodes: 2, byoyomi: true, tourne: false, tombe: false });
  });
});

describe('texte et lecture', () => {
  it('texteTemps', () => {
    expect(texteTemps(600_000)).toBe('10:00');
    expect(texteTemps(595_001)).toBe('9:56');
    expect(texteTemps(7_000)).toBe('0:07');
    expect(texteTemps(0)).toBe('0:00');
    expect(texteTemps(1_200)).toBe('0:02');
    expect(texteTemps(3_600_000)).toBe('1:00:00');
  });
  it('lit la réponse de pendule_direct ; refuse une réponse mal formée', () => {
    const e = lireEtatDirect({
      statut: 'active', resultat: null, coups: 'ee', comptage: false, mortes: null, mortes_par: null, cadence: 'normale', main_ms: 600000,
      periodes: 3, periode_ms: 30000, noir_ms: 595000, blanc_ms: 600000, noir_periodes: 3, blanc_periodes: 3,
      trait_depuis: '2026-10-04T10:00:00Z', comptage_depuis: null, noir_vu_le: '2026-10-04T10:00:00Z', blanc_vu_le: null, maintenant: '2026-10-04T10:00:05Z',
    });
    expect(e?.noir).toEqual({ ms: 595_000, periodes: 3, vuLe: Date.parse('2026-10-04T10:00:00Z') });
    expect((e?.maintenant ?? 0) - (e?.traitDepuis ?? 0)).toBe(5_000);
    expect(lireEtatDirect(null)).toBeNull();
    expect(lireEtatDirect({ statut: 'active' })).toBeNull();
    expect(lireEtatDirect({ statut: 'perdu' })).toBeNull();
  });
  it('écart d’horloge : latence comptée pour moitié', () => {
    expect(ecartHorloge(10_000, 1_000, 1_200)).toBe(8_900);
  });
});

describe('pendule estimée juste après un coup (#425)', () => {
  it('décompte la réflexion de qui a joué, et fait partir la pendule de l’autre', () => {
    const e = penduleApresCoup(base, 1_007_000);
    expect(e.noir).toEqual({ ms: 593_000, periodes: 3, vuLe: 0 });
    expect(e.blanc).toEqual(base.blanc);
    expect(e.traitDepuis).toBe(1_007_000);
    // Le coup ajouté, c'est Blanc qui réfléchit.
    expect(cadran({ ...e, coups: 'ee' }, 2, 1_009_000)).toMatchObject({ ms: 598_000, tourne: true });
    expect(cadran({ ...e, coups: 'ee' }, 1, 1_009_000)).toMatchObject({ ms: 593_000, tourne: false });
  });
  it('byo-yomi : une période dépassée est perdue ; pendule arrêtée : rien ne change', () => {
    const e = { ...base, coups: 'ee', blanc: { ms: 0, periodes: 3, vuLe: 0 } };
    expect(penduleApresCoup(e, 1_045_000).blanc).toEqual({ ms: 0, periodes: 2, vuLe: 0 });
    const arretee = { ...base, comptage: true, traitDepuis: null };
    expect(penduleApresCoup(arretee, 2_000_000)).toBe(arretee);
  });
});
