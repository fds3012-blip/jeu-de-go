import { expect, test } from '@playwright/test';

// Issue #12 : aucun suivi sans consentement. Issue #50 : une seule fenêtre au premier lancement, qui mène aux conditions.
// Ces parcours partent d'un stockage vide (la configuration commune a déjà répondu à la fenêtre).
test.use({ storageState: { cookies: [], origins: [] } });

const fenetre = (page: import('@playwright/test').Page) => page.getByRole('dialog', { name: 'Tu m’aides à chasser les bugs ?' });

test('la fenêtre apparaît une fois, Accepter, rechargement : absente', async ({ page }) => {
  await page.goto('/');
  await expect(fenetre(page)).toBeVisible();
  await expect(fenetre(page)).toHaveAttribute('aria-modal', 'true');
  await fenetre(page).getByRole('button', { name: 'Oui, j’aide' }).click();
  await expect(fenetre(page)).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('go.consentement.v1'))).toBe('accepte');

  await page.reload();
  await expect(page.locator('.cta')).toBeVisible();
  await page.waitForTimeout(300);
  await expect(fenetre(page)).toBeHidden();
  // Le choix se retrouve dans les conditions, où l'on peut changer d'avis.
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await page.getByRole('button', { name: 'Conditions et confidentialité' }).click();
  const interrupteur = page.getByRole('switch', { name: /^Rapports de bugs et suivi détaillé/ });
  await expect(interrupteur).toHaveAttribute('aria-checked', 'true');
  await interrupteur.click();
  await expect(interrupteur).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => localStorage.getItem('go.consentement.v1'))).toBe('refuse');
  // Issue #64 : droit d'opposition à la mesure anonyme exemptée.
  const anonyme = page.getByRole('switch', { name: /^Comptage anonyme des parties/ });
  await expect(anonyme).toHaveAttribute('aria-checked', 'true');
  await anonyme.click();
  await expect(anonyme).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => localStorage.getItem('go.mesure.opposition.v1'))).toBe('1');
});

test('les deux choix de la fenêtre ont la même taille et le même style', async ({ page }) => {
  await page.goto('/');
  const oui = fenetre(page).getByRole('button', { name: 'Oui, j’aide' });
  const non = fenetre(page).getByRole('button', { name: 'Non merci' });
  // La fenêtre entre par un léger zoom : on attend sa fin, puis on mesure les deux boutons dans la même image.
  await fenetre(page).evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished)));
  await expect(non).toBeVisible();
  const [a, b] = await page.evaluate(() => {
    const [x, y] = [...document.querySelectorAll<HTMLElement>('.accord-choix')].map(e => e.getBoundingClientRect());
    return [x, y].map(r => ({ width: r.width, height: r.height }));
  });
  expect(Math.abs(a.width - b.width)).toBeLessThan(1);
  expect(Math.abs(a.height - b.height)).toBeLessThan(1);
  expect(a.height).toBeGreaterThanOrEqual(44);
  const style = (el: HTMLElement) => { const s = getComputedStyle(el); return [s.backgroundColor, s.color, s.fontWeight, s.fontSize, s.boxShadow].join('|'); };
  expect(await oui.evaluate(style)).toBe(await non.evaluate(style));
});

test('« Lire les conditions » ouvre la page, Retour ramène la fenêtre, Refuser la ferme pour de bon', async ({ page }) => {
  await page.goto('/');
  await fenetre(page).getByRole('button', { name: 'Lire les conditions' }).click();
  await expect(fenetre(page)).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Conditions et confidentialité' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ce qu’on garde' })).toBeVisible();
  await expect(page.getByRole('switch', { name: /^Rapports de bugs et suivi détaillé/ })).toHaveAttribute('aria-checked', 'false');

  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(fenetre(page)).toBeVisible();
  await fenetre(page).getByRole('button', { name: 'Non merci' }).click();
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
  await expect(fenetre(page).getByRole('heading', { name: 'Tu m’aides à chasser les bugs ?' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(fenetre(page).getByRole('button', { name: 'Non merci' })).toBeFocused();
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
  const plateau = page.locator('svg.board[aria-label="Plateau de go 9 × 9"]');
  const box = (await plateau.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByText(/Pomme (joue|capture|passe)/)).toBeVisible({ timeout: 5000 });

  // En partie, la navigation est masquée : on revient d'abord à l'accueil.
  await page.getByRole('button', { name: "Retour à l'accueil" }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await page.getByRole('button', { name: 'Conditions et confidentialité' }).click();
  await expect(page.getByRole('heading', { name: 'Conditions et confidentialité' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ce qu’on garde' })).toBeVisible();
  expect(suivi).toEqual([]);
});

test('conditions : sections repliables, aucune fausse adresse de contact', async ({ page }) => {
  await page.goto('/');
  await fenetre(page).getByRole('button', { name: 'Lire les conditions' }).click();
  await expect(page.getByRole('heading', { name: 'Conditions et confidentialité' })).toBeVisible();
  for (const titre of ['Ce qu’on garde', 'Pourquoi', 'Combien de temps', 'Tes droits']) {
    await expect(page.getByRole('heading', { name: titre })).toBeVisible();
  }
  // « Ce qu'on garde » est ouvert d'entrée ; les autres s'ouvrent au toucher.
  await expect(page.getByText('Pas de pub. Tes données ne sont jamais vendues.')).toBeVisible();
  await expect(page.getByText(/Chez Supabase, à Paris/)).toBeVisible();
  const contact = page.locator('.conditions-contact');
  await expect(contact).toBeHidden();
  const droits = page.locator('summary', { hasText: 'Tes droits' });
  expect((await droits.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await droits.click();
  await expect(contact).toBeVisible();
  await expect(contact).toHaveText(/^Contact\s*: bientôt disponible$/);
  const duree = page.getByText(/1 an, puis effacés/);
  await expect(duree).toBeHidden();
  await page.locator('summary', { hasText: 'Combien de temps' }).click();
  await expect(duree).toBeVisible();
  // Aucune adresse e-mail dans la page.
  expect(await page.locator('.conditions-texte').innerText()).not.toMatch(/@/);
});
