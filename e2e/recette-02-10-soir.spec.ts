import { expect, test, type Page } from '@playwright/test';
import { brancher, fauxServeur } from './fauxSupabase';
import { attendrePierre, jouer, jouerSuite, message, partieADeux, passer } from './plateau';

// Correctifs de la recette du 02/10 au soir (docs/qa/recette-2026-10-02-soir.md), un test par défaut corrigé.

const largeurTexte = (page: Page, selecteur: string) => page.locator(selecteur).first().evaluate(el => {
  const r = document.createRange();
  r.selectNodeContents(el);
  return r.getClientRects()[0]?.left ?? -1;
});

test('R-S3 : comptage manuel, Mochi dit quoi faire au lieu de « Je cherche les pierres mortes… »', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await partieADeux(page);
  // Deux murs, puis deux passes : à deux, le comptage est toujours manuel.
  await jouerSuite(page, ['D1', 'F1', 'D2', 'F2', 'D3', 'F3', 'D4', 'F4', 'D5', 'F5', 'D6', 'F6', 'D7', 'F7', 'D8', 'F8', 'D9', 'F9']);
  await attendrePierre(page, 'F9', 'blanc');
  await passer(page);
  await passer(page);
  const valider = page.getByRole('button', { name: 'Valider le score' });
  await expect(valider).toBeEnabled();
  await expect(message(page)).not.toContainText('Je cherche les pierres mortes');
  await expect(message(page)).toHaveText(/^Deux passes\s:\sla partie est finie\. Aucune pierre morte\./);
});

for (const [langue, nom] of [['fr', /^Entraîne-toi\s:\s3 problèmes/], ['en', /^Practice: 3 puzzles/]] as const) {
  test(`R-S4 : fin de leçon, le bouton principal tient sur une ligne en 320 px (${langue})`, async ({ page }) => {
    await page.addInitScript(l => { localStorage.setItem('go.lecons.v1', JSON.stringify({ l1: 5 })); localStorage.setItem('go.langue.v1', JSON.stringify(l)); }, langue);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: /^(Apprendre|Learn)$/ }).click();
    await page.getByRole('button', { name: /^(Reprendre|Resume)/ }).first().click();
    await jouer(page, 'E4');
    await page.getByRole('button', { name: /^(Terminer la leçon|Finish the lesson)$/ }).click();
    const cta = page.locator('.fin-lecon .cta');
    await expect(cta).toHaveAccessibleName(nom);
    // Une ligne : toutes les boîtes du texte du bouton sont à la même hauteur.
    const lignes = await cta.evaluate(el => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return new Set([...r.getClientRects()].filter(b => b.width > 1).map(b => Math.round(b.bottom))).size;
    });
    expect(lignes).toBe(1);
    expect(await cta.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  });
}

test('R-S5 : « Tu as moins de 15 ans ? » s’aligne sur le texte de la case d’âge', async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] } });
  const page = await brancher(ctx, fauxServeur(), { 'go.essai.v1': JSON.stringify({ terminees: 3 }) });
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(page.getByTestId('creer-compte')).toBeVisible();
  const texteCase = await largeurTexte(page, '.case-age-ligne label');
  const texteLien = await largeurTexte(page, '.case-age-moins15');
  expect(Math.abs(texteLien - texteCase)).toBeLessThanOrEqual(2);
  await ctx.close();
});

for (const langue of ['fr', 'en'] as const) {
  test(`R-S6 : aide, aucun onglet coupé en 320 px (${langue})`, async ({ page }) => {
    await page.addInitScript(l => localStorage.setItem('go.langue.v1', JSON.stringify(l)), langue);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Depuis la leçon 1 (même feuille d'aide que depuis une partie).
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: /^(Apprendre|Learn)$/ }).click();
    await page.getByRole('button', { name: /^(Commencer|Start)$/ }).click();
    await page.getByRole('button', { name: /^(Aide : règles et mots du go|Help: rules and Go words)$/ }).click();
    const onglets = page.getByRole('dialog', { name: /^(Aide|Help)$/ }).getByRole('tab');
    await expect(onglets).toHaveCount(4);
    // Chaque onglet sélectionné à son tour (le gras élargit le mot) : aucun texte tronqué.
    for (let i = 0; i < 4; i++) {
      await onglets.nth(i).click();
      const coupes = await onglets.evaluateAll(els => els.filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent));
      expect(coupes, `onglet ${i + 1} sélectionné`).toEqual([]);
    }
  });
}

/** Numéro du Go du jour d'aujourd'hui (src/app/goDuJour.ts : 1 le 27/09/2026, +1 à chaque minuit de Paris). */
function numeroDuJour(): number {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date()).split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2026, 8, 27)) / 864e5) + 1;
}

test('R-S7 : la tuile « Go du jour · À faire » ouvre le problème lui-même ; « Fait », elle mène à l’onglet Problèmes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // #487 : les tuiles apparaissent dès la première pierre posée sur l'appareil.
  await page.addInitScript(() => localStorage.setItem('go.premiere-pierre.v1', 'true'));
  await page.goto('/');
  await page.locator('.tuile-probleme').click();
  await expect(page.getByRole('grid', { name: /^Plateau de go/ }).or(page.getByRole('img', { name: /^Plateau de go/ }))).toBeVisible();
  await expect(page.getByText(new RegExp(`^Go du jour n°\\s${numeroDuJour()}$`))).toBeVisible();
  // Le retour mène à la liste, et l'onglet Problèmes, touché ensuite, ne rouvre pas le problème.
  await page.getByRole('button', { name: 'Retour aux problèmes' }).click();
  await expect(page.getByRole('button', { name: 'Résoudre le Go du jour' })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Jouer' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  await expect(page.getByRole('button', { name: 'Résoudre le Go du jour' })).toBeVisible();

  // Go du jour déjà fait : la tuile mène à la liste (le problème suivant y attend).
  await page.evaluate(n => localStorage.setItem('go.go-du-jour.v1', JSON.stringify({ dernier: n, jours: 1 })), numeroDuJour());
  await page.goto('/');
  await expect(page.getByTestId('etat-du-jour')).toHaveText('Fait');
  await page.locator('.tuile-probleme').click();
  await expect(page.getByRole('heading', { name: /^Go du jour n°\s\d+$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retour aux problèmes' })).toHaveCount(0);
});
