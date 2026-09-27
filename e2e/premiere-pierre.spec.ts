import { expect, test } from '@playwright/test';

// Issue #23 : un nouveau joueur pose sa première pierre en 2 touches depuis l'ouverture.
test('première pierre en deux touches, accueil sans défilement', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto('/');

  // Une seule action principale, et la bulle de Pomme dit la même chose.
  const cta = page.locator('.cta');
  await expect(cta).toHaveCount(1);
  await expect(cta).toHaveText('Joue ta première partie');
  await expect(cta).toHaveAccessibleName('Joue ta première partie contre Pomme');
  await expect(page.getByText(/Touche le centre pour poser ta première pierre\s!/)).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Pomme' })).toBeVisible();
  await expect(page.getByText('Elle apprend comme toi.', { exact: false })).toBeVisible();
  await expect(page.getByText('Plateau 9 × 9, tu as Noir')).toBeVisible();

  // L'accueil tient dans l'écran (390 × 844) : pas de défilement.
  const m = await page.evaluate(() => ({
    scroll: document.scrollingElement!.scrollHeight,
    haut: window.innerHeight,
    nav: document.querySelector('nav')!.getBoundingClientRect().height,
    large: document.scrollingElement!.scrollWidth,
    vue: window.innerWidth,
  }));
  expect(m.scroll).toBeLessThanOrEqual(m.haut + m.nav);
  expect(m.large).toBeLessThanOrEqual(m.vue);

  // Touche 1 : le bouton principal.
  await cta.tap();
  const plateau = page.getByRole('img', { name: /Plateau de go 9 × 9/ });
  await expect(plateau).toBeVisible();
  // Mochi explique le but, une seule fois.
  await expect(page.getByText(/Le but\s: entourer plus de territoire que Pomme/)).toBeVisible();

  // Touche 2 : clic souris au centre du plateau (pas de confirmation à la souris).
  const box = (await plateau.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  // Le message « Tu joues … » laisse vite place à « Pomme réfléchit… » : l'un ou l'autre prouve que la pierre est posée.
  await expect(page.getByText(/Tu joues |Pomme réfléchit|Pomme (joue|capture|passe)/)).toBeVisible();

  // Au retour, Mochi et le bouton restent cohérents, et la bulle du but ne revient plus.
  await page.getByRole('button', { name: "Retour à l'accueil" }).click();
  await expect(page.locator('.cta')).toHaveText('Rejouer contre Pomme');
  await expect(page.getByText(/Te revoilà\s! On rejoue/)).toBeVisible();
  await page.locator('.cta').click();
  await expect(plateau).toBeVisible();
  await expect(page.getByText(/Le but\s: entourer/)).toHaveCount(0);
  expect(erreurs).toEqual([]);
});

test('« Changer » ouvre le choix de l’adversaire et de la taille', async ({ page }) => {
  await page.goto('/');
  const changer = page.getByRole('button', { name: 'Changer' });
  await expect(changer).toHaveAttribute('aria-expanded', 'false');
  await changer.click();
  await expect(changer).toHaveAttribute('aria-expanded', 'true');
  const feuille = page.getByRole('dialog', { name: 'Ton adversaire' });
  await feuille.getByRole('button', { name: 'Caillou, 16 kyu' }).click();
  await feuille.getByRole('button', { name: '13 × 13' }).click();
  await expect(feuille.getByRole('button', { name: 'Caillou, 16 kyu' })).toHaveAttribute('aria-pressed', 'true');
  // Cibles tactiles d'au moins 44 px dans la feuille.
  for (const b of [feuille.getByRole('button', { name: 'Caillou, 16 kyu' }), feuille.getByRole('button', { name: 'Fermer' }), feuille.getByRole('button', { name: 'Jouer à deux sur ce téléphone' })]) {
    expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await feuille.getByRole('button', { name: 'Fermer' }).click();
  await expect(feuille).toBeHidden();
  await expect(page.getByRole('heading', { level: 2, name: 'Caillou' })).toBeVisible();
  await expect(page.getByText('Plateau 13 × 13, tu as Noir')).toBeVisible();
  await expect(page.locator('.cta')).toHaveText('Joue ta première partie');
  await expect(page.locator('.cta')).toHaveAccessibleName('Joue ta première partie contre Caillou');
});
