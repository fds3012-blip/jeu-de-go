// Rappel quotidien (issue #36) : logique pure côté app, et cohérence avec la migration et le service worker.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  doitProposerRappel, estArriveeRappel, ETAT_INITIAL, HEURES, lireEtatRappel, MOMENTS, octetsBase64Url, support, type Capacites, type EtatRappel,
} from './rappel';
import { ajouter, avancer, FILE_VIDE, type Fete } from '../ui/fileFetes';
import { URL_RAPPEL } from '../../supabase/functions/envoyer-rappels/logique';

const racine = fileURLToPath(new URL('../../', import.meta.url));
const lire = (f: string) => readFileSync(racine + f, 'utf8');

const capacites = (c: Partial<Capacites> = {}): Capacites => ({
  cleVapid: true, plateforme: 'aucune', notification: true, push: true, serviceWorker: true, permission: 'default', ...c,
});

describe('support du rappel sur cet appareil', () => {
  it('Chrome, Edge, Firefox, Android : possible', () => {
    expect(support(capacites())).toBe('ok');
    expect(support(capacites({ plateforme: 'chrome', permission: 'granted' }))).toBe('ok');
  });
  it('iPhone dans Safari : installer l’app d’abord ; app installée : possible', () => {
    expect(support(capacites({ plateforme: 'ios', notification: false, push: false }))).toBe('ios_installer');
    expect(support(capacites({ plateforme: 'installee' }))).toBe('ok');
  });
  it('app installée sur un vieil iOS (sans PushManager), ou navigateur sans notification : impossible', () => {
    expect(support(capacites({ plateforme: 'installee', push: false }))).toBe('non');
    expect(support(capacites({ notification: false, permission: null }))).toBe('non');
    expect(support(capacites({ serviceWorker: false }))).toBe('non');
  });
  it('notifications bloquées dans le navigateur', () => {
    expect(support(capacites({ permission: 'denied' }))).toBe('bloque');
  });
  it('rappel pas encore configuré (pas de clé publique VAPID) : rien', () => {
    expect(support(capacites({ cleVapid: false }))).toBe('non');
    expect(support(capacites({ cleVapid: false, plateforme: 'ios' }))).toBe('non');
  });
});

describe('proposition en fin de partie', () => {
  const base = { compte: true, support: 'ok' as const, etat: ETAT_INITIAL, partieFinie: true, autreCarte: false };
  it('une fois, après une partie terminée, avec un compte', () => {
    expect(doitProposerRappel(base)).toBe(true);
  });
  it('jamais sans compte (#343)', () => {
    expect(doitProposerRappel({ ...base, compte: false })).toBe(false);
  });
  it('jamais deux fois : montrée, refusée (définitif) ou acceptée', () => {
    for (const proposition of ['proposee', 'refusee', 'acceptee'] as const) {
      expect(doitProposerRappel({ ...base, etat: { ...ETAT_INITIAL, proposition } })).toBe(false);
    }
    expect(doitProposerRappel({ ...base, etat: { ...ETAT_INITIAL, actif: true } })).toBe(false);
  });
  it('pas hors fin de partie, pas avec la carte d’installation, pas si l’appareil ne peut pas', () => {
    expect(doitProposerRappel({ ...base, partieFinie: false })).toBe(false);
    expect(doitProposerRappel({ ...base, autreCarte: true })).toBe(false);
    for (const s of ['ios_installer', 'bloque', 'non'] as const) expect(doitProposerRappel({ ...base, support: s })).toBe(false);
  });
  it('attend son tour après l’XP, le niveau et l’installation', () => {
    const rappel: Fete = { genre: 'rappel' };
    let e = ajouter(FILE_VIDE, rappel);
    e = ajouter(e, { genre: 'niveau', niveau: 2 });
    e = ajouter(e, { genre: 'installation' });
    e = ajouter(e, { genre: 'xp', points: 20, bonus: 0 });
    e = ajouter(e, rappel);
    expect(e.attente.map(f => f.genre)).toEqual(['xp', 'niveau', 'installation', 'rappel']);
    expect(avancer(e).actif?.genre).toBe('xp');
  });
});

describe('état gardé sur l’appareil', () => {
  it('relit un état valide, et tolère les valeurs abîmées', () => {
    const e: EtatRappel = { proposition: 'acceptee', actif: true, moment: 'matin' };
    expect(lireEtatRappel(JSON.parse(JSON.stringify(e)))).toEqual(e);
    expect(lireEtatRappel(null)).toEqual(ETAT_INITIAL);
    expect(lireEtatRappel('x')).toEqual(ETAT_INITIAL);
    expect(lireEtatRappel({ proposition: 'peut-etre', actif: 'oui', moment: 'nuit' })).toEqual(ETAT_INITIAL);
  });
});

describe('moments et heures', () => {
  it('trois moments, jamais la nuit, les mêmes heures que la base', () => {
    expect(MOMENTS).toEqual(['matin', 'midi', 'soir']);
    for (const m of MOMENTS) { expect(HEURES[m]).toBeGreaterThanOrEqual(8); expect(HEURES[m]).toBeLessThanOrEqual(19); }
    const migration = lire('supabase/migrations/20260930120100_abonnements_rappel.sql');
    for (const m of MOMENTS) expect(migration).toContain(`when '${m}' then ${HEURES[m]}`);
    expect(migration).toMatch(/between 8 and 19/);
  });
});

describe('arrivée par le rappel', () => {
  it('reconnaît l’adresse ouverte par la notification', () => {
    expect(estArriveeRappel(new URL(URL_RAPPEL, 'https://x.test').search)).toBe(true);
    expect(estArriveeRappel('?rappel=0')).toBe(false);
    expect(estArriveeRappel('?go-du-jour=3')).toBe(false);
  });
  it('le service worker affiche le rappel et ouvre la même adresse, jamais une adresse extérieure', () => {
    const sw = lire('public/sw.js');
    expect(sw).toMatch(/addEventListener\('push'/);
    expect(sw).toMatch(/addEventListener\('notificationclick'/);
    expect(sw).toContain(`url: '${URL_RAPPEL}'`);
    expect(sw).toMatch(/startsWith\('\/'\) && !d\.url\.startsWith\('\/\/'\)/);
    expect(sw).not.toMatch(/requireInteraction\s*:/);
  });
});

describe('clé publique VAPID', () => {
  it('décode le base64url en octets', () => {
    expect([...octetsBase64Url('AQID_-8')]).toEqual([1, 2, 3, 255, 239]);
    // Une clé publique P-256 non compressée : 65 octets, commence par 0x04.
    const cle = 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';
    const o = octetsBase64Url(cle);
    expect(o).toHaveLength(65);
    expect(o[0]).toBe(4);
  });
  it('seule la clé publique est côté app ; la privée n’apparaît nulle part dans src', () => {
    const exemple = lire('.env.example');
    expect(exemple).toMatch(/^VITE_VAPID_PUBLIC_KEY=$/m);
    expect(exemple).not.toMatch(/VAPID_CLE_PRIVEE|PRIVATE_KEY=/);
  });
});
