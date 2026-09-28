import { expect, test } from '@playwright/test';
import { attendrePierre, jouer, jouerSuite, lancerADeux, message, partieADeux, pierres } from './plateau';

// Issue #40 (goban v2) : sons synthétisés en Web Audio. Poser, capturer et tenter un coup interdit
// avec le son activé ne doit provoquer aucune erreur JS.

// Compte les AudioContext créés par la page (le module son les crée au premier geste).
async function espionAudio(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { AudioContext: typeof AudioContext; __audio: AudioContext[] };
    const Orig = w.AudioContext;
    w.__audio = [];
    w.AudioContext = class extends Orig {
      constructor(o?: AudioContextOptions) { super(o); w.__audio.push(this); }
    };
  });
}

test('poser, capturer et un coup interdit avec le son activé : aucune erreur', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  // Erreurs de console aussi (Web Audio signale ses problèmes ainsi), hors ressources réseau (polices, etc.).
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) erreurs.push(m.text()); });
  await espionAudio(page);
  await partieADeux(page);

  await jouer(page, 'E5');
  await attendrePierre(page, 'E5', 'noir');
  // Le contexte audio a été créé au premier geste et tourne.
  await expect.poll(() => page.evaluate(() => (window as unknown as { __audio: AudioContext[] }).__audio.map(a => a.state))).toEqual(['running']);

  // Capture : Noir entoure la pierre blanche E6.
  await jouerSuite(page, ['E6', 'D6', 'A1', 'F6', 'B1', 'E7']);
  await attendrePierre(page, 'E6', null);
  await expect(message(page)).toHaveText('Noir capture 1 pierre.');

  // Coup interdit (suicide) : Blanc en E6, entouré par Noir.
  await jouer(page, 'E6');
  await expect(message(page)).toHaveText('Coup interdit : cette pierre serait capturée par elle-même.');
  await expect(pierres(page, 'blanc')).toHaveCount(2);

  expect(erreurs).toEqual([]);
});

test('sons coupés dans le Profil : aucun contexte audio créé', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await espionAudio(page);
  // Réglage déjà enregistré (sinon le premier toucher, sur l'onglet Profil, créerait le contexte).
  await page.addInitScript(() => localStorage.setItem('go.settings.v1', JSON.stringify({ sound: false })));
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await page.getByRole('button', { name: /^Réglages/ }).click();
  await expect(page.getByRole('group', { name: 'Sons' }).getByRole('button', { name: 'Son', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('navigation').getByRole('button', { name: 'Jouer' }).click();
  await lancerADeux(page);
  await jouer(page, 'E5');
  await attendrePierre(page, 'E5', 'noir');
  expect(await page.evaluate(() => (window as unknown as { __audio: AudioContext[] }).__audio.length)).toBe(0);
  expect(erreurs).toEqual([]);
});
