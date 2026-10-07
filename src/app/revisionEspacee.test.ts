import { describe, expect, it } from 'vitest';
import {
  ACQUIS, ETAT_VIDE, INTERVALLES, SEANCE_MAX, apresEchec, apresEssai, apresReussite, compterDus, dansJours, dus, ecartJours,
  elementsErreursBruts, elementsProblemes, erreurAcquise, estDu, jour, lireRevisions, prendreXp, problemeRate, problemeRevu,
  problemesSuivis, retard, seance, suiviValide, type ElementFile, type Suivi,
} from './revisionEspacee';

// Jours locaux, à midi : pas de surprise de fuseau.
const le = (iso: string) => { const [y, m, j] = iso.split('-').map(Number); return new Date(y, m - 1, j, 12, 0); };
const J0 = le('2026-10-07');

describe('calendrier (#469) : J+1, J+3, J+7, J+14, J+30 ; un échec renvoie à J+1', () => {
  it('les intervalles validés', () => {
    expect(INTERVALLES).toEqual([1, 3, 7, 14, 30]);
    expect(ACQUIS).toBe(5);
    expect(SEANCE_MAX).toBe(5);
  });

  it('un élément raté entre dans la file et revient demain', () => {
    const s = apresEchec(undefined, J0);
    expect(s).toEqual({ etape: 0, prochain: '2026-10-08', echecs: 1, maj: J0.getTime() });
    expect(estDu(s, J0)).toBe(false);
    expect(estDu(s, le('2026-10-08'))).toBe(true);
  });

  it('réussi à chaque passage : J+1, J+3, J+7, J+14, J+30, puis acquis', () => {
    let s: Suivi = apresEchec(undefined, J0);
    let d = J0;
    const ecarts: number[] = [];
    while (s.prochain) {
      const prochain = s.prochain;
      ecarts.push(ecartJours(jour(d), prochain));
      d = le(prochain);
      s = apresReussite(s, d);
    }
    expect(ecarts).toEqual([1, 3, 7, 14, 30]);
    expect(s.etape).toBe(ACQUIS);
    expect(estDu(s, le('2027-12-31'))).toBe(false);
  });

  it('un échec, à n’importe quelle marche, renvoie à J+1 au pied de l’échelle', () => {
    const haut: Suivi = { etape: 3, prochain: '2026-10-07', echecs: 1, maj: 1 };
    const r = apresEssai(haut, false, J0);
    expect(r).toMatchObject({ etape: 0, prochain: '2026-10-08', echecs: 2 });
    // Puis l'échelle reprend : J+3 après la réussite suivante.
    expect(apresEssai(r, true, le('2026-10-08')).prochain).toBe('2026-10-11');
  });

  it('en retard, l’intervalle suivant compte depuis le jour de la réussite', () => {
    const s: Suivi = { etape: 1, prochain: '2026-09-30', echecs: 1, maj: 1 };
    expect(retard(s, J0)).toBe(7);
    expect(apresReussite(s, J0).prochain).toBe(dansJours(J0, 7));
  });

  it('jours locaux, fin de mois et changement d’heure compris', () => {
    expect(dansJours(new Date(2026, 9, 24, 23, 30), 1)).toBe('2026-10-25');
    expect(dansJours(new Date(2026, 9, 25, 1, 0), 30)).toBe('2026-11-24');
    expect(ecartJours('2026-10-31', '2026-11-01')).toBe(1);
  });
});

describe('séance du jour', () => {
  const el = (cle: string, prochain: string, genre: ElementFile['genre'] = 'probleme'): ElementFile =>
    ({ cle, genre, ref: cle, suivi: { etape: 0, prochain, echecs: 1, maj: 1 } });

  it('les plus en retard d’abord, puis les erreurs de partie, 5 au plus', () => {
    const l = [
      el('pb:a', '2026-10-07'), el('erreur-b', '2026-10-07', 'erreur'), el('pb:c', '2026-10-01'),
      el('pb:d', '2026-10-08'), el('pb:e', '2026-10-05'), el('pb:f', '2026-10-06'), el('pb:g', '2026-10-06'),
    ];
    expect(dus(l, J0).map(e => e.cle)).toEqual(['pb:c', 'pb:e', 'pb:f', 'pb:g', 'erreur-b', 'pb:a']);
    expect(seance(l, J0).map(e => e.cle)).toEqual(['pb:c', 'pb:e', 'pb:f', 'pb:g', 'erreur-b']);
    expect(seance(l, le('2026-09-01'))).toEqual([]);
  });
});

describe('état de l’appareil', () => {
  it('problème raté : il entre, puis la séance le fait monter ou redescendre', () => {
    let e = problemeRate(ETAT_VIDE, 'b1', J0);
    expect(e.problemes.b1).toMatchObject({ etape: 0, prochain: '2026-10-08' });
    expect(problemesSuivis(e)).toEqual(new Set(['b1']));
    e = problemeRevu(e, 'b1', true, le('2026-10-08'));
    expect(e.problemes.b1).toMatchObject({ etape: 1, prochain: '2026-10-11' });
    // Raté de nouveau hors séance : retour à J+1.
    e = problemeRate(e, 'b1', le('2026-10-09'));
    expect(e.problemes.b1).toMatchObject({ etape: 0, prochain: '2026-10-10', echecs: 2 });
    // Un problème que la file ne suit pas : rien ne change.
    expect(problemeRevu(e, 'zz', true, J0)).toBe(e);
  });

  it('les problèmes acquis ou inconnus ne sont pas proposés', () => {
    const e = { ...ETAT_VIDE, problemes: {
      a: { etape: 0, prochain: '2026-10-07', echecs: 1, maj: 1 },
      b: { etape: ACQUIS, prochain: null, echecs: 1, maj: 1 },
      c: { etape: 2, prochain: '2026-10-01', echecs: 1, maj: 1 },
    } };
    expect(elementsProblemes(e).map(x => x.ref)).toEqual(['a', 'c']);
    expect(elementsProblemes(e, id => id !== 'c').map(x => x.ref)).toEqual(['a']);
  });

  it('XP de la séance : une fois par jour', () => {
    const e = prendreXp(ETAT_VIDE, J0)!;
    expect(e.xpLe).toBe('2026-10-07');
    expect(prendreXp(e, J0)).toBeNull();
    expect(prendreXp(e, le('2026-10-08'))).not.toBeNull();
  });

  it('erreurs acquises : marques gardées, 100 au plus (les plus récentes)', () => {
    let e = ETAT_VIDE;
    for (let i = 0; i < 105; i++) e = erreurAcquise(e, `erreur-${i}`, i);
    expect(Object.keys(e.acquises)).toHaveLength(100);
    expect(e.acquises['erreur-0']).toBeUndefined();
    expect(e.acquises['erreur-104']).toBe(104);
  });

  it('relit le stockage en écartant ce qui est mal formé', () => {
    expect(lireRevisions(null)).toEqual({ problemes: {}, acquises: {} });
    expect(lireRevisions([])).toEqual({ problemes: {}, acquises: {} });
    const e = lireRevisions({
      problemes: {
        ok: { etape: 1, prochain: '2026-10-08', echecs: 2, maj: 5 },
        acquis: { etape: 5, prochain: null, echecs: 0, maj: 5 },
        etapeFausse: { etape: 9, prochain: '2026-10-08', echecs: 0, maj: 5 },
        dateFausse: { etape: 1, prochain: 'demain', echecs: 0, maj: 5 },
        acquisAvecDate: { etape: 5, prochain: '2026-10-08', echecs: 0, maj: 5 },
      },
      acquises: { 'erreur-a': 3, 'erreur-b': 'x' },
      xpLe: '2026-10-07',
    });
    expect(Object.keys(e.problemes)).toEqual(['ok', 'acquis']);
    expect(e.acquises).toEqual({ 'erreur-a': 3 });
    expect(e.xpLe).toBe('2026-10-07');
    expect(suiviValide({ etape: 0, prochain: '2026-10-08', echecs: -1, maj: 0 })).toBeNull();
  });
});

describe('compte de l’accueil', () => {
  it('erreurs et problèmes dus, plafonnés à la taille d’une séance', () => {
    const erreurs = [
      { id: 'erreur-a', prochain: '2026-10-07', reussites: 1, rates: 1 },
      { id: 'erreur-b', prochain: '2026-10-09' },
      { id: 'mal', prochain: 3 }, null,
    ];
    expect(elementsErreursBruts(erreurs).map(e => e.cle)).toEqual(['erreur-a', 'erreur-b']);
    const revisions = { problemes: { b1: { etape: 0, prochain: '2026-10-06', echecs: 1, maj: 1 } }, acquises: {} };
    expect(compterDus(erreurs, revisions, J0)).toBe(2);
    expect(compterDus('illisible', null, J0)).toBe(0);
    const beaucoup = Array.from({ length: 9 }, (_, i) => ({ id: `erreur-${i}`, prochain: '2026-10-01' }));
    expect(compterDus(beaucoup, null, J0)).toBe(SEANCE_MAX);
  });
});
