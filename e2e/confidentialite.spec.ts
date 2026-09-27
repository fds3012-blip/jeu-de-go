import { expect, test } from '@playwright/test';

// Issue #12 : aucun suivi sans consentement, et la section Confidentialité est accessible depuis Profil.
test('aucune requête de suivi sans consentement, section Confidentialité dans Profil', async ({ page }) => {
  const suivi: string[] = [];
  page.on('request', (r) => { if (/posthog|sentry/i.test(r.url())) suivi.push(r.url()); });

  await page.goto('/');
  await page.locator('.cta').click();
  const plateau = page.getByRole('img', { name: /Plateau de go 9 × 9/ });
  const box = (await plateau.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByText(/Pomme (joue|capture|passe)/)).toBeVisible({ timeout: 5000 });

  // En partie, la navigation est masquée : on revient d'abord à l'accueil.
  await page.getByRole('button', { name: "Retour à l'accueil" }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await expect(page.getByRole('heading', { name: 'Confidentialité' })).toBeVisible();
  await expect(page.getByText('Ce qui reste sur ton téléphone')).toBeVisible();
  expect(suivi).toEqual([]);
});
