import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { mesurer } from './mesures';

// #485 : au tout premier écran, le consentement est un bandeau bas compact et non modal.
// L'action principale (« Joue ta première partie ») reste visible et utilisable ; refuser est aussi simple qu'accepter ;
// sans réponse, rien de non essentiel n'est chargé. Captures facultatives : CAPTURES_485=<dossier>.
test.use({ storageState: { cookies: [], origins: [] } });

const CAPTURES = process.env.CAPTURES_485;
const bandeau = (page: Page, nom: string | RegExp = 'Tu m’aides à chasser les bugs ?') => page.getByRole('dialog', { name: nom });

/** Le bouton principal est entièrement au-dessus du bandeau, et c'est bien lui qui reçoit un toucher en son centre. */
async function ctaLibre(page: Page) {
  return page.evaluate(() => {
    const cta = document.querySelector<HTMLElement>('.cta')!.getBoundingClientRect();
    const accord = document.querySelector<HTMLElement>('.accord')!.getBoundingClientRect();
    const centre = document.elementFromPoint(cta.x + cta.width / 2, cta.y + cta.height / 2);
    return { dessous: Math.round(cta.bottom), bandeau: Math.round(accord.top), touche: !!centre?.closest('.cta'), vue: innerHeight };
  });
}

for (const [largeur, hauteur] of [[320, 568], [390, 844]] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`premier écran ${largeur} × ${hauteur}, ${theme === 'dark' ? 'sombre' : 'clair'} : « jouer » visible, choix égaux de 44 px, contrastes AA`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: hauteur });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto('/');
      await expect(bandeau(page)).toBeVisible();
      await expect(page.locator('.cta')).toBeVisible();
      await bandeau(page).evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished)));

      const libre = await ctaLibre(page);
      expect(libre.dessous, JSON.stringify(libre)).toBeLessThanOrEqual(libre.bandeau);
      expect(libre.touche).toBe(true);
      expect(libre.dessous).toBeLessThanOrEqual(libre.vue);

      // Pas de voile : rien ne recouvre la page en dehors du bandeau.
      const voile = await page.evaluate(() => getComputedStyle(document.querySelector('.accord')!, '::backdrop').backgroundColor);
      expect(['rgba(0, 0, 0, 0)', 'transparent', '']).toContain(voile);

      // Trois cibles de 44 px au moins ; Oui et Non identiques (CNIL : même niveau, même format).
      for (const nom of ['Détails', 'Oui, j’aide', 'Non merci']) {
        const b = (await bandeau(page).getByRole('button', { name: nom }).boundingBox())!;
        expect(b.height, nom).toBeGreaterThanOrEqual(44);
        expect(b.width, nom).toBeGreaterThanOrEqual(44);
      }
      const [oui, non] = await Promise.all(['Oui, j’aide', 'Non merci'].map(n => bandeau(page).getByRole('button', { name: n }).evaluate(el => {
        const s = getComputedStyle(el); const r = el.getBoundingClientRect();
        return [Math.round(r.width), Math.round(r.height), s.backgroundColor, s.color, s.fontWeight, s.fontSize, s.boxShadow].join('|');
      })));
      expect(oui).toBe(non);

      // Contrastes AA, cibles et défilement horizontal, mesurés dans le bandeau (outil commun de l'audit visuel).
      const m = await mesurer(page, 'consentement', theme, largeur);
      expect(m.defilement).toBeLessThanOrEqual(0);
      expect(m.cibles, JSON.stringify(m.cibles)).toEqual([]);
      expect(m.contrastes, JSON.stringify(m.contrastes)).toEqual([]);
      expect(m.coupes, JSON.stringify(m.coupes)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur);

      if (CAPTURES) {
        mkdirSync(CAPTURES, { recursive: true });
        await page.screenshot({ path: join(CAPTURES, `bandeau-${largeur}-${theme === 'dark' ? 'sombre' : 'clair'}-fr.png`) });
      }
    });
  }
}

test('« jouer » se touche sans répondre : la partie démarre, sans suivi, et le bandeau attend la fin', async ({ page }) => {
  const suivi: string[] = [];
  page.on('request', r => { if (/posthog|sentry/i.test(r.url())) suivi.push(r.url()); });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await expect(bandeau(page)).toBeVisible();
  await page.locator('.cta').click();
  await expect(page.getByRole('grid', { name: /Plateau de go/ })).toBeVisible();
  await expect(bandeau(page)).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('go.consentement.v1'))).toBeNull();
  expect(suivi).toEqual([]);
});

test('Non merci : refus enregistré, bandeau parti pour de bon ; Oui : accord enregistré', async ({ browser, baseURL }) => {
  for (const [choix, valeur] of [['Non merci', 'refuse'], ['Oui, j’aide', 'accepte']] as const) {
    const ctx = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] }, viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto('/');
    await bandeau(page).getByRole('button', { name: choix }).click();
    await expect(bandeau(page)).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('go.consentement.v1'))).toBe(valeur);
    // La place gardée sous la page pour le bandeau est rendue.
    expect(await page.evaluate(() => getComputedStyle(document.body).paddingBottom)).toBe('0px');
    await page.reload();
    await expect(page.locator('.cta')).toBeVisible();
    await page.waitForTimeout(300);
    await expect(bandeau(page)).toBeHidden();
    await ctx.close();
  }
});

test('lecteur d’écran : boîte de dialogue non modale, nommée par le titre, décrite par le texte ; clavier sans piège', async ({ page }) => {
  await page.goto('/');
  const d = bandeau(page);
  await expect(d).toBeVisible();
  await expect(d).not.toHaveAttribute('aria-modal', 'true');
  expect(await d.evaluate(el => el.matches(':modal'))).toBe(false);
  await expect(d).toHaveAccessibleDescription('Si oui, on reçoit les rapports de bug et on voit si tu reviens. Change d’avis dans Profil.');
  await expect(d.getByRole('heading', { level: 2, name: 'Tu m’aides à chasser les bugs ?' })).toBeFocused();
  // La page dessous n'est pas rendue inerte.
  expect(await page.evaluate(() => (document.querySelector('.cta') as HTMLElement).closest('[inert]'))).toBeNull();
  // Ordre : Détails, Oui, Non, puis la page ; Maj+Tab depuis le titre ressort aussi.
  const ordre: string[] = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    ordre.push(await page.evaluate(() => document.activeElement?.closest('dialog') ? (document.activeElement as HTMLElement).innerText : 'page'));
  }
  expect(ordre).toEqual(['Détails', 'Oui, j’aide', 'Non merci', 'page']);
  // Entrée sur « Non merci » au clavier : refus enregistré.
  await d.getByRole('button', { name: 'Non merci' }).focus();
  await page.keyboard.press('Enter');
  await expect(d).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('go.consentement.v1'))).toBe('refuse');
});

test('mouvements réduits : simple fondu, sans glissement ; sinon le bandeau monte de 16 px', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(bandeau(page)).toBeVisible();
  expect(await page.locator('.accord').evaluate(el => getComputedStyle(el).transitionProperty)).not.toMatch(/transform/);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await page.locator('.accord').evaluate(el => getComputedStyle(el).transitionProperty)).toMatch(/transform/);
});

test('anglais : même bandeau, mêmes choix', async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ baseURL, locale: 'en-US', storageState: { cookies: [], origins: [] }, viewport: { width: 320, height: 568 } });
  const page = await ctx.newPage();
  await page.goto('/');
  const d = bandeau(page, 'Will you help us catch bugs?');
  await expect(d).toBeVisible();
  await expect(d).toHaveAccessibleDescription('If yes, we get bug reports and see if you come back. Change your mind in Profile.');
  for (const nom of ['Details', 'Yes, I’ll help', 'No thanks']) await expect(d.getByRole('button', { name: nom })).toBeVisible();
  const libre = await ctaLibre(page);
  expect(libre.dessous, JSON.stringify(libre)).toBeLessThanOrEqual(libre.bandeau);
  if (CAPTURES) {
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.waitForTimeout(200);
      await page.screenshot({ path: join(CAPTURES, `bandeau-320-${theme === 'dark' ? 'sombre' : 'clair'}-en.png`) });
    }
  }
  await ctx.close();
});
