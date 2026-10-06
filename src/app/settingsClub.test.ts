import { describe, expect, it } from 'vitest';
import { lireSettings } from './settings';

// #365 : réglages du joueur de club, gardés sur l'appareil ; valeurs abîmées remplacées par celles par défaut.
describe('réglages du plateau et du rythme', () => {
  it('valeurs par défaut : rien ne change pour qui n’y touche pas', () => {
    expect(lireSettings({})).toMatchObject({ coordonnees: true, dernierCoup: true, numerosRevue: false, cadence: 'normale', serieVisible: true });
  });
  it('garde les choix et répare les valeurs abîmées', () => {
    expect(lireSettings({ coordonnees: false, cadence: 'lente', serieVisible: false, numerosRevue: true }))
      .toMatchObject({ coordonnees: false, cadence: 'lente', serieVisible: false, numerosRevue: true, dernierCoup: true });
    expect(lireSettings({ coordonnees: 'non', cadence: 'eclair', dernierCoup: 0 }))
      .toMatchObject({ coordonnees: true, cadence: 'normale', dernierCoup: true });
    expect(lireSettings(null).theme).toBe('auto');
    // Les réglages d'avant #365 restent lus tels quels.
    expect(lireSettings({ theme: 'dark', sound: false })).toMatchObject({ theme: 'dark', sound: false, coordonnees: true });
  });
});
