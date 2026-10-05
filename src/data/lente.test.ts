import { describe, expect, it } from 'vitest';
import { chercherPartieLente, estLente, joursDuDelai, lireLigneRecherche, lireRecherche, mesPartiesLentes, quitterFileLente, refusLente } from './lente';
import type { Db } from './supabase';

// Issue #440 : données des parties lentes (appels au serveur, lectures tolérantes).

function faux(reponses: Record<string, { data: unknown; error: unknown }>) {
  const appels: unknown[] = [];
  const requete = (table: string) => {
    const q: Record<string, unknown> = {};
    const chaine = () => q;
    Object.assign(q, {
      select: chaine, eq: chaine, or: chaine, order: chaine, limit: chaine, in: chaine,
      maybeSingle: async () => reponses[table],
      then: (ok: (v: unknown) => unknown) => Promise.resolve(reponses[table]).then(ok),
    });
    appels.push(['from', table]);
    return q;
  };
  const db = { rpc: async (nom: string, args?: unknown) => { appels.push([nom, args]); return reponses[nom]; }, from: requete } as unknown as Db;
  return { db, appels };
}

describe('refus traduits', () => {
  it('compte, limite, mise à jour, serveur', () => {
    expect(refusLente({ code: 'JGC01' })).toBe('compte');
    expect(refusLente({ code: 'JGP01' })).toBe('compte');
    expect(refusLente({ code: 'JGL10' })).toBe('limite');
    expect(refusLente({ code: 'PGRST202' })).toBe('miseAJour');
    expect(refusLente({ code: 'PGRST205' })).toBe('miseAJour');
    expect(refusLente(null)).toBe('serveur');
  });
});

describe('appels au serveur', () => {
  it('chercher : taille et délai envoyés, partie rendue ou attente', async () => {
    const { db, appels } = faux({ chercher_partie_lente: { data: null, error: null } });
    expect(await chercherPartieLente(db, 13, 2)).toEqual({ ok: true, value: null });
    expect(appels).toEqual([['chercher_partie_lente', { p_size: 13, p_delai_jours: 2 }]]);
    const trouve = faux({ chercher_partie_lente: { data: 'p1', error: null } });
    expect(await chercherPartieLente(trouve.db, 9, 1)).toEqual({ ok: true, value: 'p1' });
    const limite = faux({ chercher_partie_lente: { data: null, error: { code: 'JGL10' } } });
    expect(await chercherPartieLente(limite.db, 9, 1)).toEqual({ ok: false, error: 'limite' });
  });
  it('quitter : la partie trouvée pendant l’attente est rendue', async () => {
    const { db } = faux({ quitter_file_lente: { data: 'p2', error: null } });
    expect(await quitterFileLente(db)).toEqual({ ok: true, value: 'p2' });
  });
  it('lire sa recherche', async () => {
    const { db } = faux({ file_lente: { data: { size: 9, delai_jours: 1, created_at: '2026-10-05T10:00:00Z', partie_id: null }, error: null } });
    expect(await lireRecherche(db, 'moi')).toEqual({ ok: true, value: { taille: 9, delai: 1, depuis: '2026-10-05T10:00:00Z', partieId: null } });
    const vide = faux({ file_lente: { data: null, error: null } });
    expect(await lireRecherche(vide.db, 'moi')).toEqual({ ok: true, value: null });
  });
  it('mes parties lentes : les seuls défis classés', async () => {
    const g = (id: string, rated: boolean) => ({ id, rated, black_id: 'moi', white_id: 'lui', result: null });
    const { db } = faux({
      defis: { data: [{ partie_id: 'a' }, { partie_id: 'b' }], error: null },
      games: { data: [g('a', true), g('b', false)], error: null },
    });
    const r = await mesPartiesLentes(db, 'moi');
    expect(r.ok && r.value.map(d => d.partie.id)).toEqual(['a']);
  });
});

describe('lectures tolérantes', () => {
  it('ligne de recherche mal formée : ignorée', () => {
    expect(lireLigneRecherche({ size: 10, delai_jours: 1, created_at: 'x' })).toBeNull();
    expect(lireLigneRecherche({ size: 9, delai_jours: 4, created_at: 'x' })).toBeNull();
    expect(lireLigneRecherche(null)).toBeNull();
    expect(lireLigneRecherche({ size: 19, delai_jours: 3, created_at: 'x', partie_id: 'p' })).toEqual({ taille: 19, delai: 3, depuis: 'x', partieId: 'p' });
  });
  it('délai par coup lu dans l’intervalle Postgres', () => {
    expect(joursDuDelai('1 day')).toBe(1);
    expect(joursDuDelai('3 days')).toBe(3);
    expect(joursDuDelai('48:00:00')).toBe(2);
    expect(joursDuDelai('01:00:00')).toBeNull();
    expect(joursDuDelai(null)).toBeNull();
    expect(joursDuDelai(42)).toBeNull();
  });
  it('une partie lente est un défi classé', () => {
    expect(estLente({ partie: { rated: true } as never })).toBe(true);
    expect(estLente({ partie: { rated: false } as never })).toBe(false);
  });
});
