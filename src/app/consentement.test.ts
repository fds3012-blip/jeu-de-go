import { describe, expect, it } from 'vitest';
import { fenetreVisible, type EtatFenetre } from './consentement';
import { identite, texteSerie } from './identite';

const base: EtatFenetre = { consent: null, ignoree: false, enPartie: false, surConditions: false };

describe('fenêtre de consentement', () => {
  it('apparaît au premier lancement, tant que le joueur n’a pas choisi', () => {
    expect(fenetreVisible(base)).toBe(true);
  });
  it('ne réapparaît jamais une fois le choix fait', () => {
    expect(fenetreVisible({ ...base, consent: 'accepte' })).toBe(false);
    expect(fenetreVisible({ ...base, consent: 'refuse' })).toBe(false);
  });
  it('attend la fin de la partie', () => {
    expect(fenetreVisible({ ...base, enPartie: true })).toBe(false);
  });
  it('se retire pendant la lecture des conditions', () => {
    expect(fenetreVisible({ ...base, surConditions: true })).toBe(false);
  });
  it('Échap : plus rien pendant la session, sans choix enregistré', () => {
    expect(fenetreVisible({ ...base, ignoree: true })).toBe(false);
  });
});

describe('carte d’identité du Profil', () => {
  it('sans compte : invité, sans cote, avec la série de l’appareil (#161)', () => {
    expect(identite(null, 4)).toEqual({ initiale: null, nom: 'Invité', detail: 'Sans compte, tout reste sur ce téléphone.', serie: 4 });
  });
  it('avec un compte : initiale, pseudo, ce que le compte garde, et série ; jamais la cote (#214)', () => {
    expect(identite({ pseudo: 'élodie_go', cote: 1520 }, 3)).toEqual({ initiale: 'É', nom: 'élodie_go', detail: 'Progression gardée sur ton compte.', serie: 3 });
  });
  it('compte sans pseudo : pierre à la place de l’initiale', () => {
    expect(identite({ pseudo: null, cote: 1500 }, 0)).toMatchObject({ initiale: null, nom: 'Sans pseudo' });
  });
  it('série au singulier et au pluriel', () => {
    expect(texteSerie(1)).toBe('1 jour');
    expect(texteSerie(12)).toBe('12 jours');
  });
});
