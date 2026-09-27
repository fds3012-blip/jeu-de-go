import { expect, test } from '@playwright/test';

// Issue #23 : un nouveau joueur pose sa première pierre en 2 touches depuis l'ouverture.
test('première pierre en deux touches, accueil sans défilement', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto('/');

  // Une seule action principale, et Mochi dit la même chose.
  const cta = page.locator('.cta');
  await expect(cta).toHaveCount(1);
  await expect(cta).toHaveText('Joue ta première partie contre Pomme');
  await expect(page.getByText(/Nouveau au go \? Pose ta première pierre contre Pomme/)).toBeVisible();
  await expect(page.getByText('Pomme · 9 × 9')).toBeVisible();

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
  await expect(page.getByText(/Le but : entourer plus de territoire que Pomme/)).toBeVisible();

  // Touche 2 : clic souris au centre du plateau (pas de confirmation à la souris).
  const box = (await plateau.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  // Le message « Tu joues … » laisse vite place à « Pomme réfléchit… » : l'un ou l'autre prouve que la pierre est posée.
  await expect(page.getByText(/Tu joues |Pomme réfléchit|Pomme (joue|capture|passe)/)).toBeVisible();

  // Au retour, Mochi et le bouton restent cohérents, et la bulle du but ne revient plus.
  await page.getByRole('button', { name: '‹ Accueil' }).click();
  await expect(page.locator('.cta')).toHaveText('Rejouer contre Pomme');
  await expect(page.getByText(/Pomme t'attend/)).toBeVisible();
  await page.locator('.cta').click();
  await expect(plateau).toBeVisible();
  await expect(page.getByText(/Le but : entourer/)).toHaveCount(0);
  expect(erreurs).toEqual([]);
});

test('« Changer » déplie les réglages de la partie', async ({ page }) => {
  await page.goto('/');
  const changer = page.getByRole('button', { name: 'Changer' });
  await expect(changer).toHaveAttribute('aria-expanded', 'false');
  await changer.click();
  await page.getByRole('button', { name: 'Caillou' }).click();
  await page.getByRole('button', { name: '13 × 13' }).click();
  await expect(page.getByText('Caillou · 13 × 13')).toBeVisible();
  await expect(page.locator('.cta')).toHaveText('Joue ta première partie contre Caillou');
  // Actions secondaires : cibles tactiles d'au moins 44 px.
  for (const nom of ['Jouer à deux', 'Apprendre']) {
    const b = page.locator('.dock').getByRole('button', { name: nom });
    expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
});
