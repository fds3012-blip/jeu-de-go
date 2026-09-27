import { expect, test } from '@playwright/test';

// Issue #12 : aucun suivi sans consentement. Issue #50 : une seule fenêtre au premier lancement, qui mène aux conditions.
// Ces parcours partent d'un stockage vide (la configuration commune a déjà répondu à la fenêtre).
test.use({ storageState: { cookies: [], origins: [] } });

const fenetre = (page: import('@playwright/test').Page) => page.getByRole('dialog', { name: 'Aide-nous à améliorer le jeu' });

test('la fenêtre apparaît une fois, Accepter, rechargement : absente', async ({ page }) => {
  await page.goto('/');
  await expect(fenetre(page)).toBeVisible();
  await expect(fenetre(page)).toHaveAttribute('aria-modal', 'true');
  await fenetre(page).getByRole('button', { name: 'Accepter' }).click();
  await expect(fenetre(page)).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('go.consentement.v1'))).toBe('accepte');

  await page.reload();
  await expect(page.locator('.cta')).toBeVisible();
  await page.waitForTimeout(300);
  await expect(fenetre(page)).toBeHidden();
  // Le choix se retrouve dans les conditions, où l'on peut changer d'avis.
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await page.getByRole('button', { name: 'Conditions et confidentialité' }).click();
  const interrupteur = page.getByRole('switch', { name: /^Mesure d’audience et erreurs/ });
  await expect(interrupteur).toHaveAttribute('aria-checked', 'true');
  await interrupteur.click();
  await expect(interrupteur).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => localStorage.getItem('go.consentement.v1'))).toBe('refuse');
});

test('« Lire les conditions » ouvre la page, Retour ramène la fenêtre, Refuser la ferme pour de bon', async ({ page }) => {
  await page.goto('/');
  await fenetre(page).getByRole('button', { name: 'Lire les conditions' }).click();
  await expect(fenetre(page)).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Conditions et confidentialité' })).toBeVisible();
  await expect(page.getByText('Ce qui reste sur ton téléphone')).toBeVisible();
  await expect(page.getByRole('switch', { name: /^Mesure d’audience et erreurs/ })).toHaveAttribute('aria-checked', 'false');

  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(fenetre(page)).toBeVisible();
  await fenetre(page).getByRole('button', { name: 'Refuser' }).click();
  await expect(fenetre(page)).toBeHidden();
  await page.reload();
  await expect(page.getByRole('navigation')).toBeVisible();
  await page.waitForTimeout(300);
  await expect(fenetre(page)).toBeHidden();
});

test('focus piégé dans la fenêtre ; Échap ferme sans choix, elle revient au lancement suivant', async ({ page }) => {
  await page.goto('/');
  await expect(fenetre(page)).toBeVisible();
  // À l'ouverture, le focus est sur le titre (aucun des deux choix n'est mis en avant).
  await expect(fenetre(page).getByRole('heading', { name: 'Aide-nous à améliorer le jeu' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(fenetre(page).getByRole('button', { name: 'Refuser' })).toBeFocused();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);

  await page.keyboard.press('Escape');
  await expect(fenetre(page)).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('go.consentement.v1'))).toBeNull();
  await page.reload();
  await expect(fenetre(page)).toBeVisible();
});

test('aucune requête de suivi sans consentement, conditions accessibles depuis Profil', async ({ page }) => {
  const suivi: string[] = [];
  page.on('request', (r) => { if (/posthog|sentry/i.test(r.url())) suivi.push(r.url()); });

  await page.goto('/');
  await expect(fenetre(page)).toBeVisible();
  await page.keyboard.press('Escape'); // pas de choix
  await expect(fenetre(page)).toBeHidden();
  await page.locator('.cta').click();
  const plateau = page.getByRole('img', { name: /Plateau de go 9 × 9/ });
  const box = (await plateau.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByText(/Pomme (joue|capture|passe)/)).toBeVisible({ timeout: 5000 });

  // En partie, la navigation est masquée : on revient d'abord à l'accueil.
  await page.getByRole('button', { name: "Retour à l'accueil" }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await page.getByRole('button', { name: 'Conditions et confidentialité' }).click();
  await expect(page.getByRole('heading', { name: 'Conditions et confidentialité' })).toBeVisible();
  await expect(page.getByText('Ce qui reste sur ton téléphone')).toBeVisible();
  expect(suivi).toEqual([]);
});
