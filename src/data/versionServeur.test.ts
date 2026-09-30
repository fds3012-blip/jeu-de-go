import { describe, expect, it, vi } from 'vitest';
import { t } from '../content/i18n';
import {
  CONTRAT_GAME_ACTION, etatServeur, lireContratServeur, messageSiServeurAncien, refusPeutVenirDUnServeurAncien, verifierServeur
} from './versionServeur';
import type { Db } from './supabase';

/** Erreur HTTP de functions.invoke : la réponse est dans `context`. */
const erreurHttp = (status: number) => ({ name: 'FunctionsHttpError', message: 'non-2xx', context: new Response('{}', { status }) });

function db(reponse: { data?: unknown; error?: unknown } | Error) {
  const invoke = vi.fn(async () => {
    if (reponse instanceof Error) throw reponse;
    return { data: reponse.data ?? null, error: reponse.error ?? null };
  });
  return { db: { functions: { invoke } } as unknown as Db, invoke };
}

describe('lireContratServeur', () => {
  it('demande la version à game-action', async () => {
    const { db: d, invoke } = db({ data: { ok: true, contrat: CONTRAT_GAME_ACTION } });
    expect(await lireContratServeur(d)).toBe(CONTRAT_GAME_ACTION);
    expect(invoke).toHaveBeenCalledWith('game-action', { body: { action: 'version' } });
  });
  it('serveur qui ne connaît pas l’action (400) ou fonction absente (404) : 0', async () => {
    expect(await lireContratServeur(db({ error: erreurHttp(400) }).db)).toBe(0);
    expect(await lireContratServeur(db({ error: erreurHttp(404) }).db)).toBe(0);
    expect(await lireContratServeur(db({ data: { ok: true } }).db)).toBe(0);
    expect(await lireContratServeur(db({ data: { contrat: 'trois' } }).db)).toBe(0);
  });
  it('réseau coupé ou erreur serveur : null', async () => {
    expect(await lireContratServeur(db({ error: { name: 'FunctionsFetchError', message: 'Failed to fetch' } }).db)).toBeNull();
    expect(await lireContratServeur(db({ error: erreurHttp(503) }).db)).toBeNull();
    expect(await lireContratServeur(db(new Error('boom')).db)).toBeNull();
  });
});

describe('etatServeur', () => {
  it('compare au contrat du client', () => {
    expect(etatServeur(CONTRAT_GAME_ACTION)).toBe('a-jour');
    expect(etatServeur(CONTRAT_GAME_ACTION + 1)).toBe('a-jour');
    expect(etatServeur(CONTRAT_GAME_ACTION - 1)).toBe('ancien');
    expect(etatServeur(0)).toBe('ancien');
    expect(etatServeur(null)).toBe('injoignable');
    expect(etatServeur(2, 2)).toBe('a-jour');
  });
  it('verifierServeur enchaîne lecture et comparaison', async () => {
    expect(await verifierServeur(db({ error: erreurHttp(400) }).db)).toBe('ancien');
    expect(await verifierServeur(db({ data: { ok: true, contrat: CONTRAT_GAME_ACTION } }).db)).toBe('a-jour');
  });
});

describe('messageSiServeurAncien (incident #344)', () => {
  it('coup refusé « format » par un serveur ancien : Mise à jour du serveur en cours', async () => {
    const msg = await messageSiServeurAncien(db({ error: erreurHttp(400) }).db, { error: 'format' });
    expect(msg).toBe(t('serveur.miseAJour'));
    expect(msg).toMatch(/Mise à jour du serveur en cours|Server update in progress/);
  });
  it('serveur à jour : le refus habituel reste le bon message', async () => {
    expect(await messageSiServeurAncien(db({ data: { ok: true, contrat: CONTRAT_GAME_ACTION } }).db, { error: 'format' })).toBeNull();
  });
  it('réseau coupé : pas de fausse alerte', async () => {
    expect(await messageSiServeurAncien(db(new Error('hors ligne')).db, { error: 'format' })).toBeNull();
  });
  it('un refus de règle (ko, tour…) ne déclenche aucun appel', async () => {
    const { db: d, invoke } = db({ error: erreurHttp(400) });
    for (const code of ['ko', 'tour', 'occupe', 'temps', 'spectateur']) expect(await messageSiServeurAncien(d, { error: code })).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
    expect(refusPeutVenirDUnServeurAncien(null)).toBe(true);
    expect(refusPeutVenirDUnServeurAncien({})).toBe(true);
  });
});
