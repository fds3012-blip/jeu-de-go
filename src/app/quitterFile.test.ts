// #498 : quitter la file lente hors ligne ne produit plus d'erreur non gérée, et réessaie au retour en ligne.
import { describe, expect, it, vi } from 'vitest';
import { auRetourEnLigne, tenterQuitter } from './quitterFile';

describe('quitter la file des parties lentes (#498)', () => {
  it('hors ligne : le module chargé à la demande est introuvable, pas de rejet, on réessaiera', async () => {
    const quitter = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module'));
    await expect(tenterQuitter(quitter, () => false)).resolves.toEqual({ etat: 'hors-ligne' });
  });
  it('hors ligne : le serveur ne répond pas (supabase-js rend une erreur)', async () => {
    await expect(tenterQuitter(async () => ({ ok: false, error: 'serveur' }), () => false)).resolves.toEqual({ etat: 'hors-ligne' });
  });
  it('en ligne, refus du serveur : erreur (message « Réessaie »)', async () => {
    await expect(tenterQuitter(async () => ({ ok: false, error: 'serveur' }), () => true)).resolves.toEqual({ etat: 'erreur' });
  });
  it('succès : la partie trouvée pendant l’attente, ou rien', async () => {
    await expect(tenterQuitter(async () => ({ ok: true, value: 'p1' }), () => true)).resolves.toEqual({ etat: 'fait', partieId: 'p1' });
    await expect(tenterQuitter(async () => ({ ok: true, value: null }), () => true)).resolves.toEqual({ etat: 'fait', partieId: null });
  });
  it('nouvel essai au retour en ligne, une seule fois ; annulable', () => {
    const cible = new EventTarget() as unknown as Window;
    const f = vi.fn();
    auRetourEnLigne(f, cible);
    cible.dispatchEvent(new Event('online'));
    cible.dispatchEvent(new Event('online'));
    expect(f).toHaveBeenCalledTimes(1);
    const g = vi.fn();
    const annuler = auRetourEnLigne(g, cible);
    annuler();
    cible.dispatchEvent(new Event('online'));
    expect(g).not.toHaveBeenCalled();
  });
  it('hors ligne puis retour : la file est quittée au second essai', async () => {
    let enLigne = false;
    const quitter = vi.fn(async () => (enLigne ? { ok: true as const, value: null } : { ok: false as const, error: 'serveur' as const }));
    expect(await tenterQuitter(quitter, () => enLigne)).toEqual({ etat: 'hors-ligne' });
    const cible = new EventTarget() as unknown as Window;
    const issue = new Promise(resolve => auRetourEnLigne(() => { void tenterQuitter(quitter, () => enLigne).then(resolve); }, cible));
    enLigne = true;
    cible.dispatchEvent(new Event('online'));
    expect(await issue).toEqual({ etat: 'fait', partieId: null });
    expect(quitter).toHaveBeenCalledTimes(2);
  });
});
