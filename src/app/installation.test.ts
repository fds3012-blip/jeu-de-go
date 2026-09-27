// Issue #178 : quand proposer d'installer l'app, et quand jamais.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  _inviteDeTest, detecterPlateforme, doitProposer, estPremiereVictoire, lireEtat, ouvrirInvite,
  type Appareil, type InviteInstallation, type Plateforme
} from './installation';

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1',
  iphoneInstagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0',
  ipadSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
  firefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
};
const app = (a: Partial<Appareil>): Appareil => ({ userAgent: UA.firefox, affichageApp: false, invite: false, ...a });

describe('detecterPlateforme', () => {
  it('iPhone Safari, pas installé : consigne iOS', () => {
    expect(detecterPlateforme(app({ userAgent: UA.iphoneSafari, standalone: false }))).toBe('ios');
  });
  it('iPad récent (se déclare Mac, mais tactile) : consigne iOS', () => {
    expect(detecterPlateforme(app({ userAgent: UA.ipadSafari, platform: 'MacIntel', maxTouchPoints: 5 }))).toBe('ios');
    expect(detecterPlateforme(app({ userAgent: UA.ipadSafari, platform: 'MacIntel', maxTouchPoints: 0 }))).toBe('aucune');
  });
  it('déjà installée (lancée depuis l\'écran d\'accueil) : rien', () => {
    expect(detecterPlateforme(app({ userAgent: UA.iphoneSafari, standalone: true }))).toBe('installee');
    expect(detecterPlateforme(app({ userAgent: UA.android, affichageApp: true, invite: true }))).toBe('installee');
  });
  it('Chrome avec invite capturée : invite native', () => {
    expect(detecterPlateforme(app({ userAgent: UA.android, invite: true }))).toBe('chrome');
  });
  it('Chrome sans invite (non éligible ou déjà installée) : rien', () => {
    expect(detecterPlateforme(app({ userAgent: UA.android }))).toBe('aucune');
  });
  it('autres navigateurs iOS et navigateurs intégrés : rien (la consigne Safari ne s\'y applique pas)', () => {
    expect(detecterPlateforme(app({ userAgent: UA.iphoneChrome }))).toBe('aucune');
    expect(detecterPlateforme(app({ userAgent: UA.iphoneInstagram }))).toBe('aucune');
  });
  it('Firefox ordinateur : rien', () => {
    expect(detecterPlateforme(app({}))).toBe('aucune');
  });
});

describe('doitProposer', () => {
  const ok = { plateforme: 'ios' as Plateforme, etat: null, moment: 'go_du_jour' as const, enPartie: false };

  it('montre après un Go du jour réussi ou une première victoire, sur iOS comme sur Chrome', () => {
    expect(doitProposer(ok)).toBe(true);
    expect(doitProposer({ ...ok, moment: 'premiere_victoire' })).toBe(true);
    expect(doitProposer({ ...ok, plateforme: 'chrome' })).toBe(true);
  });
  it('jamais pendant une partie', () => {
    expect(doitProposer({ ...ok, enPartie: true })).toBe(false);
  });
  it('jamais sans bon moment', () => {
    expect(doitProposer({ ...ok, moment: null })).toBe(false);
  });
  it('une seule fois : déjà proposée, refusée ou acceptée, elle ne revient pas', () => {
    for (const etat of ['proposee', 'refusee', 'acceptee'] as const) expect(doitProposer({ ...ok, etat }), etat).toBe(false);
  });
  it('jamais si l\'app est déjà installée ou impossible à installer', () => {
    expect(doitProposer({ ...ok, plateforme: 'installee' })).toBe(false);
    expect(doitProposer({ ...ok, plateforme: 'aucune' })).toBe(false);
  });
});

describe('état mémorisé', () => {
  it('lit seulement les valeurs connues', () => {
    expect(lireEtat(null)).toBeNull();
    expect(lireEtat('refusee')).toBe('refusee');
    expect(lireEtat('n\'importe quoi')).toBeNull();
  });
  it('première victoire : vraie tant que le repère est absent', () => {
    expect(estPremiereVictoire(null)).toBe(true);
    expect(estPremiereVictoire('1')).toBe(false);
  });
});

describe('ouvrirInvite', () => {
  afterEach(() => _inviteDeTest(null));

  it('ouvre l\'invite une seule fois et rend le choix', async () => {
    const prompt = vi.fn(async () => {});
    _inviteDeTest({ prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) } as unknown as InviteInstallation);
    expect(await ouvrirInvite()).toBe('accepted');
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(await ouvrirInvite()).toBeNull();
  });
  it('rend null si l\'invite échoue', async () => {
    _inviteDeTest({ prompt: async () => { throw new Error('déjà utilisée'); }, userChoice: new Promise(() => {}) } as unknown as InviteInstallation);
    expect(await ouvrirInvite()).toBeNull();
  });
});
