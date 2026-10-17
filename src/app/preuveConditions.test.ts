import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../data/supabase';
import { VERSION_CONDITIONS } from '../data/conditions';
import { accordDonne } from './connexionBascule';
import { definirRetour, garderRetour, prendreRetour } from './connexionGoogle';
import { CLE_ACCORD, annulerAccordProvisoire, envoyer, noterAccord, verifierPreuve } from './preuveConditions';

// #583 : chaque création de compte où la case est cochée fait garder l'accord par le serveur (accepter_conditions),
// une seule fois ; un échec réseau est réessayé à l'ouverture suivante ; un compte sans preuve revoit la case.

function memoire() {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } };
}

/** Faux Supabase : `mon_profil` rend la version acceptée ; `accepter_conditions` l'écrit (ou échoue si `panne`). */
function serveur(version: string | null = null, opts: { profilIllisible?: boolean } = {}) {
  const etat = { version, panne: false };
  const accepter = vi.fn(async (_nom: string, args: { p_version: string }) => {
    if (etat.panne) return { data: null, error: { message: 'Failed to fetch' } };
    etat.version = args.p_version;
    return { data: '2026-10-17T10:00:00Z', error: null };
  });
  const rpc = vi.fn((nom: string, args?: { p_version: string }) => {
    if (nom === 'accepter_conditions') return accepter(nom, args!);
    if (nom === 'mon_profil') {
      return { select: () => ({ maybeSingle: async () => opts.profilIllisible
        ? { data: null, error: { message: 'Failed to fetch' } }
        : { data: { conditions_version: etat.version }, error: null } }) };
    }
    throw new Error(`appel inattendu : ${nom}`);
  });
  return { db: { rpc } as unknown as Db, accepter, etat };
}

describe('case cochée → accord à garder (Connexion.tsx)', () => {
  it('création (code ou fournisseur), liaison d’une session sans compte, adresse déjà prise après la case', () => {
    expect(accordDonne(true, 'creer')).toBe(true); // création, et liaison (même écran « Crée ton compte »)
    expect(accordDonne(true, 'connecter', true)).toBe(true); // case cochée puis bascule en connexion (#353)
    expect(accordDonne(false, 'creer')).toBe(false);
    expect(accordDonne(true, 'connecter')).toBe(false); // « J’ai déjà un compte » : la case n’est pas montrée
  });
});

describe('verifierPreuve : un appel par création de compte', () => {
  it('code par e-mail (création ou liaison) : noté avant la session, envoyé une fois, plus jamais ensuite', async () => {
    const s = memoire();
    const { db, accepter, etat } = serveur();
    noterAccord(undefined, s); // Connexion.tsx, juste avant verifyOtp
    expect(await verifierPreuve(db, 'u1', false, s)).toBe('ok');
    expect(accepter).toHaveBeenCalledTimes(1);
    expect(accepter).toHaveBeenCalledWith('accepter_conditions', { p_version: VERSION_CONDITIONS });
    expect(etat.version).toBe(VERSION_CONDITIONS);
    expect(s.m.has(CLE_ACCORD)).toBe(false);
    // Ouvertures suivantes : la preuve est là, rien n’est renvoyé.
    expect(await verifierPreuve(db, 'u1', false, s)).toBe('ok');
    expect(accepter).toHaveBeenCalledTimes(1);
  });

  it('Google, Apple, Facebook : la note d’aller-retour garde la case, le retour l’envoie une fois', async () => {
    for (const action of ['connexion', 'liaison'] as const) {
      const onglet = memoire();
      definirRetour({ raison: 'parties', reprise: null, defi: null, profil: false });
      garderRetour(onglet, 1000, { fournisseur: 'apple', action, conditions: accordDonne(true, 'creer') });
      const retour = prendreRetour(onglet, 2000);
      expect(retour?.conditions).toBe(true);
      const s = memoire();
      const { db, accepter } = serveur();
      expect(await verifierPreuve(db, 'u1', retour?.conditions === true, s)).toBe('ok');
      expect(accepter).toHaveBeenCalledTimes(1);
      expect(s.m.has(CLE_ACCORD)).toBe(false);
    }
  });

  it('fournisseur sans la case (« J’ai déjà un compte ») : rien dans la note, rien d’envoyé', async () => {
    const onglet = memoire();
    garderRetour(onglet, 1000, { fournisseur: 'google', action: 'connexion', conditions: accordDonne(false, 'connecter') });
    expect(prendreRetour(onglet, 2000)?.conditions).toBeUndefined();
  });

  it('réseau coupé : la note reste, liée au compte, et l’accord repart à l’ouverture suivante', async () => {
    const s = memoire();
    const { db, accepter, etat } = serveur();
    noterAccord(undefined, s);
    etat.panne = true;
    expect(await verifierPreuve(db, 'u1', false, s)).toBe('ok'); // le joueur n'est pas bloqué
    expect(accepter).toHaveBeenCalledTimes(1);
    expect(s.m.get(CLE_ACCORD)).toBe('u1');
    etat.panne = false;
    expect(await verifierPreuve(db, 'u1', false, s)).toBe('ok');
    expect(accepter).toHaveBeenCalledTimes(2);
    expect(etat.version).toBe(VERSION_CONDITIONS);
    expect(s.m.has(CLE_ACCORD)).toBe(false);
  });

  it('la note d’un autre compte n’est jamais envoyée pour celui-ci', async () => {
    const s = memoire();
    noterAccord('u1', s);
    const { db, accepter } = serveur();
    expect(await verifierPreuve(db, 'u2', false, s)).toBe('demander');
    expect(accepter).not.toHaveBeenCalled();
  });

  it('code refusé : la note posée avant la vérification est retirée', () => {
    const s = memoire();
    noterAccord(undefined, s);
    annulerAccordProvisoire(s);
    expect(s.m.has(CLE_ACCORD)).toBe(false);
    noterAccord('u1', s); // réessai en attente d'un compte : gardé
    annulerAccordProvisoire(s);
    expect(s.m.get(CLE_ACCORD)).toBe('u1');
  });
});

describe('comptes existants sans preuve', () => {
  it('pas de preuve, ou une ancienne version : la case est redemandée, rien n’est envoyé sans elle', async () => {
    for (const version of [null, '2026-01-01']) {
      const { db, accepter } = serveur(version);
      expect(await verifierPreuve(db, 'u1', false, memoire())).toBe('demander');
      expect(accepter).not.toHaveBeenCalled();
    }
  });

  it('case cochée sur l’écran AccordConditions : un appel ; échec : réessai à l’ouverture suivante', async () => {
    const s = memoire();
    const { db, accepter, etat } = serveur(null);
    etat.panne = true;
    await envoyer(db, 'u1', s);
    expect(accepter).toHaveBeenCalledTimes(1);
    etat.panne = false;
    expect(await verifierPreuve(db, 'u1', false, s)).toBe('ok');
    expect(accepter).toHaveBeenCalledTimes(2);
    expect(await verifierPreuve(db, 'u1', false, s)).toBe('ok');
    expect(accepter).toHaveBeenCalledTimes(2);
  });

  it('profil illisible (hors ligne) : rien de bloqué, rien de demandé', async () => {
    const { db, accepter } = serveur(null, { profilIllisible: true });
    expect(await verifierPreuve(db, 'u1', false, memoire())).toBe('inconnu');
    expect(accepter).not.toHaveBeenCalled();
  });
});
