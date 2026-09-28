import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, jouer, partieADeux, plateau } from './plateau';

// Issue #268 : suite de l'audit Web Interface Guidelines (docs/design/audit-web-guidelines-2026-09-28.md),
// points 1, 2 et 5.

const retour = (page: Page) => page.getByRole('button', { name: "Retour à l'accueil" });
const choixQuitter = (page: Page) => page.getByRole('group', { name: 'Quitter la partie ?' });
const accueil = (page: Page) => page.locator('.cta');

test.describe('point 1 : quitter une partie en cours', () => {
  test('sans coup joué, « ‹ » ramène à l’accueil sans rien demander', async ({ page }) => {
    await partieADeux(page);
    await retour(page).click();
    await expect(plateau(page)).toHaveCount(0);
    await expect(accueil(page)).toBeVisible();
  });

  test('partie en cours : Mochi demande, « Jouer encore » garde la partie, « Quitter » sort', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await partieADeux(page);
    await jouer(page, 'E5');
    await attendrePierre(page, 'E5', 'noir');

    await retour(page).click();
    // La bulle de Mochi à deux choix (celle du passe, #235) : rien n'est quitté.
    await expect(choixQuitter(page)).toBeVisible();
    await expect(page.locator('.coach p[aria-live="polite"]')).toHaveText('Tu quittes la partie ? Elle sera perdue.');
    await expect(plateau(page)).toBeVisible();
    const [quitter, rester] = [choixQuitter(page).getByRole('button', { name: 'Quitter', exact: true }), choixQuitter(page).getByRole('button', { name: 'Jouer encore' })];
    // Le choix sûr prend le focus : au clavier, Entrée ne quitte pas par erreur.
    await expect(rester).toBeFocused();
    for (const b of [quitter, rester]) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // La bulle reste au-dessus de la barre d'actions, sans défilement horizontal à 390 px.
    const barre = (await page.getByRole('toolbar').boundingBox())!, zone = (await choixQuitter(page).boundingBox())!;
    expect(zone.y + zone.height).toBeLessThanOrEqual(barre.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    if (process.env.CAPTURE_DIR) for (const theme of ['dark', 'light'] as const) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.screenshot({ path: `${process.env.CAPTURE_DIR}/quitter-partie-${theme}.png` });
    }

    // « Jouer encore » : la bulle part, la partie est intacte, le focus revient sur « ‹ ».
    await rester.click();
    await expect(choixQuitter(page)).toHaveCount(0);
    await attendrePierre(page, 'E5', 'noir');
    await expect(retour(page)).toBeFocused();

    // Deuxième fois : « Quitter » ramène à l'accueil.
    await retour(page).click();
    await choixQuitter(page).getByRole('button', { name: 'Quitter', exact: true }).click();
    await expect(plateau(page)).toHaveCount(0);
    await expect(accueil(page)).toBeVisible();
  });

  test('partie finie : l’écran de fin ramène à l’accueil sans rien demander', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await partieADeux(page);
    await jouer(page, 'E5');
    await attendrePierre(page, 'E5', 'noir');
    const abandon = page.getByRole('toolbar').getByRole('button', { name: /Abandonner/ });
    await abandon.click();
    await page.getByRole('toolbar').getByRole('button', { name: /Confirmer/ }).click();
    await page.getByRole('button', { name: 'Accueil', exact: true }).click();
    await expect(choixQuitter(page)).toHaveCount(0);
    await expect(accueil(page)).toBeVisible();
  });
});

test('point 2 : le nom accessible de « Problème suivant » est son texte visible (WCAG 2.5.3)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  const bouton = page.locator('button.continuer');
  await expect(bouton).toBeVisible();
  const visible = (await bouton.innerText()).replace(/\s+/g, ' ').trim();
  expect(visible).toMatch(/^Problème suivant /);
  // Le nom commence par le texte visible, dans le même ordre : la commande vocale « Problème suivant » le trouve.
  const nom = await bouton.evaluate((el) => el.getAttribute('aria-label'));
  expect(nom).toBeNull();
  await expect(bouton).toHaveAccessibleName(visible);
});

test('point 5 : la feuille de verdict ne cache pas l’élément qui a le focus', async ({ page }) => {
  // Go du jour n° 1 (problème b1, réponse E5), horloge figée comme dans recette-matin.spec.ts.
  await page.clock.setFixedTime(new Date('2026-09-27T12:00:00+02:00'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?go-du-jour=1');
  await jouer(page, 'E5');
  await attendrePierre(page, 'E5', 'noir');
  const verdict = page.locator('.verdict');
  await expect(verdict).toBeVisible();

  // Tout ce qui est amené à l'écran (focus clavier) doit s'arrêter au-dessus du haut de la feuille.
  const { padding, cache } = await page.evaluate(() => {
    const v = document.querySelector('.verdict')!.getBoundingClientRect();
    return { padding: parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom) || 0, cache: window.innerHeight - v.top };
  });
  expect(padding).toBeGreaterThanOrEqual(cache);

  // La feuille fermée (retour à la liste), la réserve revient à la seule barre de navigation.
  await page.getByRole('button', { name: 'Retour aux problèmes' }).first().click();
  await expect(verdict).toHaveCount(0);
  const apres = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom) || 0);
  expect(apres).toBeLessThan(cache);
});
