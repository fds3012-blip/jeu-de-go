// Issue #178 : quand proposer d'installer l'app, et quand jamais.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  _inviteDeTest, compterRetour, detecterPlateforme, doitProposer, estMomentRetour, estPremiereVictoire, installable, lireEtat, lireRetours,
  noterOuverture, ouvrirInvite, RETOURS_KEY,
  type Appareil, type InviteInstallation, type Moment, type Plateforme
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
  const ok = { plateforme: 'ios' as Plateforme, etat: null, moment: 'retour' as Moment, enPartie: false };

  it('montre à l\'accueil d\'un retour ou après une première victoire, sur iOS comme sur Chrome', () => {
    expect(doitProposer(ok)).toBe(true);
    expect(doitProposer({ ...ok, moment: 'premiere_victoire' })).toBe(true);
    expect(doitProposer({ ...ok, plateforme: 'chrome' })).toBe(true);
  });
  it('#214 : plus jamais par-dessus le plateau résolu du Go du jour', () => {
    expect(doitProposer({ ...ok, moment: 'go_du_jour' })).toBe(false);
    expect(doitProposer({ ...ok, moment: 'go_du_jour', plateforme: 'chrome' })).toBe(false);
  });
  it('#214 : demandée depuis le Profil, elle se montre même après « Plus tard », jamais une fois installée', () => {
    for (const etat of [null, 'proposee', 'refusee'] as const) expect(doitProposer({ ...ok, moment: 'profil', etat }), String(etat)).toBe(true);
    expect(doitProposer({ ...ok, moment: 'profil', etat: 'acceptee' })).toBe(false);
    expect(doitProposer({ ...ok, moment: 'profil', plateforme: 'installee' })).toBe(false);
    expect(doitProposer({ ...ok, moment: 'profil', plateforme: 'aucune' })).toBe(false);
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

describe('ligne « Installer l\'app » du Profil (#214)', () => {
  it('seulement si l\'installation est possible et pas encore faite', () => {
    expect(installable('ios', null)).toBe(true);
    expect(installable('chrome', 'refusee')).toBe(true);
    expect(installable('ios', 'acceptee')).toBe(false);
    expect(installable('installee', null)).toBe(false);
    expect(installable('aucune', null)).toBe(false);
  });
});

describe('retours (#214)', () => {
  it('premier jour : 0 retour ; chaque nouveau jour en ajoute un ; le même jour, rien', () => {
    const j1 = compterRetour(null, 10);
    expect(j1).toEqual({ jour: 10, retours: 0 });
    expect(compterRetour(j1, 10)).toBe(j1);
    const j2 = compterRetour(j1, 11);
    expect(j2).toEqual({ jour: 11, retours: 1 });
    expect(compterRetour(j2, 15)).toEqual({ jour: 15, retours: 2 });
    expect(compterRetour(j2, 9)).toBe(j2); // horloge reculée : rien
  });
  it('la carte vient à partir du 2e retour (et au suivant si elle n\'a pas pu se montrer)', () => {
    expect(estMomentRetour({ jour: 1, retours: 0 })).toBe(false);
    expect(estMomentRetour({ jour: 2, retours: 1 })).toBe(false);
    expect(estMomentRetour({ jour: 3, retours: 2 })).toBe(true);
    expect(estMomentRetour({ jour: 4, retours: 3 })).toBe(true);
  });
  it('lit le compteur en tolérant les valeurs abîmées', () => {
    expect(lireRetours({ jour: 3, retours: 1 })).toEqual({ jour: 3, retours: 1 });
    for (const x of [null, 'x', { jour: 1.5, retours: 0 }, { jour: 1, retours: -1 }, { jour: 1 }]) expect(lireRetours(x)).toBeNull();
  });
  it('noterOuverture écrit le compteur une fois par jour', () => {
    const memoire = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => { memoire.set(k, v); } });
    try {
      expect(noterOuverture(5)).toEqual({ jour: 5, retours: 0 });
      expect(noterOuverture(5)).toEqual({ jour: 5, retours: 0 });
      expect(noterOuverture(6)).toEqual({ jour: 6, retours: 1 });
      expect(noterOuverture(8)).toEqual({ jour: 8, retours: 2 });
      expect(JSON.parse(memoire.get(RETOURS_KEY)!)).toEqual({ jour: 8, retours: 2 });
      memoire.set(RETOURS_KEY, '{abîmé');
      expect(noterOuverture(9)).toEqual({ jour: 9, retours: 0 });
    } finally {
      vi.unstubAllGlobals();
    }
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
