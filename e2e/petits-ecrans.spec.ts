import { expect, test, type Locator, type Page } from '@playwright/test';
import { attendrePierre, jouer, plateau, point } from './plateau';

// Issue #250 : petits écrans (320 × 640), suite de la recette du matin du 28/09 (docs/qa/recette-2026-09-28-matin.md).
// M5 : le verdict « Bravo » du Go du jour ne cache plus la pierre gagnante.
// M6 : la bulle de Mochi (but et komi) ne recouvre plus le plateau au début de la première partie.
// M8 : dans le verdict, « Problème suivant » tient sur une ligne.
// M9 : à la fin de la pratique, « Niveau 2 ! » ne couvre pas le titre du chemin.

test.use({ viewport: { width: 320, height: 640 } });

// Horloge figée le 28 septembre 2026 à midi, heure de Paris : Go du jour n° 2, « Vers le bord » (réponse E3).
const MIDI_PARIS_28 = new Date('2026-09-28T12:00:00+02:00');

async function resoudreGoDuJour2(page: Page) {
  await page.clock.setFixedTime(MIDI_PARIS_28);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?go-du-jour=1');
  await expect(page.getByRole('heading', { level: 2, name: 'Vers le bord' })).toBeVisible();
  await jouer(page, 'E3');
  await attendrePierre(page, 'E3', 'noir');
  await expect(page.locator('.verdict-juste')).toBeVisible();
}

/** Le texte d'un bouton tient-il sur une seule ligne ? */
async function uneLigne(bouton: Locator): Promise<boolean> {
  return bouton.evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const rects = [...r.getClientRects()].filter((x) => x.width > 0);
    const s = getComputedStyle(el);
    const ligne = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.3;
    return Math.max(...rects.map((x) => x.bottom)) - Math.min(...rects.map((x) => x.top)) <= ligne * 1.2;
  });
}

test('M5 : le verdict « Bravo » laisse voir la pierre gagnante et le bas du plateau', async ({ page }) => {
  await resoudreGoDuJour2(page);
  const verdict = page.locator('.verdict');
  // La page se pose d'elle-même (sans animation en mouvements réduits) : le plateau entier au-dessus du verdict.
  await expect.poll(async () => {
    const haut = (await verdict.boundingBox())!.y;
    const [e3, e1] = [await point(page, 'E3'), await point(page, 'E1')];
    return e3.y < haut - 12 && e1.y < haut - 12;
  }, { timeout: 3000 }).toBe(true);
  // Le haut du plateau reste à l'écran, et la page ne déborde pas en largeur.
  expect((await point(page, 'E9')).y).toBeGreaterThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  // Les actions du verdict restent entières et à 44 px.
  const partager = verdict.getByRole('button', { name: /Partager/ });
  expect((await partager.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test('M6 : la bulle de Mochi (but et komi) ne recouvre pas le plateau au premier coup', async ({ page }) => {
  await page.goto('/');
  await page.locator('.cta').click();
  const intro = page.locator('.coach-intro');
  await expect(page.locator('.annonce-komi')).toContainText('Le komi');
  const [bulle, jeu, barre] = await Promise.all([
    intro.boundingBox(), plateau(page).boundingBox(), page.getByRole('toolbar', { name: 'Actions de la partie' }).boundingBox(),
  ]);
  expect(jeu!.y + jeu!.height).toBeLessThanOrEqual(bulle!.y + 1);
  // R1 tient toujours : la bulle se lit en entier, au-dessus de la barre d'actions, sans défiler.
  expect(bulle!.y + bulle!.height).toBeLessThanOrEqual(barre!.y + 1);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  // Le plateau reste assez grand pour jouer, et il ne bouge pas quand la bulle s'efface.
  expect(jeu!.width).toBeGreaterThanOrEqual(220);
  await jouer(page, 'E5');
  await expect(intro).toHaveAttribute('data-cache', 'true');
  const apres = (await plateau(page).boundingBox())!;
  expect(Math.abs(apres.y - jeu!.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(apres.width - jeu!.width)).toBeLessThanOrEqual(2);
});

test('M8 : dans le verdict, « Voir la suite » et « Problème suivant » tiennent chacun sur une ligne', async ({ page }) => {
  await resoudreGoDuJour2(page);
  const liens = page.locator('.verdict .liens-du-jour .lien');
  await expect(liens).toHaveCount(2);
  for (const lien of await liens.all()) {
    expect(await uneLigne(lien)).toBe(true);
    const box = (await lien.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  }
  await expect(liens.nth(1)).toHaveText('Problème suivant');
});

test('M9 : fin de la pratique, « Niveau 2 ! » ne couvre pas le titre du chemin', async ({ page }) => {
  await page.addInitScript(() => { if (localStorage.getItem('go.lecons.v1') === null) localStorage.setItem('go.lecons.v1', JSON.stringify({ l1: 5 })); });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.getByRole('button', { name: 'Reprendre la leçon : Libertés et capture' }).click();
  await jouer(page, 'E4');
  await page.getByRole('button', { name: 'Terminer la leçon' }).click();
  await page.getByRole('button', { name: /^Entraîne-toi/ }).click();
  for (const [rang, coup] of [[1, 'E2'], [2, 'F1'], [3, 'A2']] as const) {
    await expect(page.getByText(`Entraînement, ${rang} sur 3`)).toBeVisible();
    // Le dernier problème fait passer au niveau 2 (100 XP).
    if (rang === 3) await page.evaluate(() => localStorage.setItem('go.xp.v1', '95'));
    await jouer(page, coup);
    await expect(page.locator('.verdict')).toBeVisible();
    if (rang < 3) await page.getByRole('button', { name: 'Problème suivant' }).click();
  }
  // La série est finie. #236 (N2) : le niveau n'arrive plus sur la feuille de réussite, mais sur son propre écran,
  // entre la feuille et le chemin (e2e/une-fete.spec.ts). Ici : rien ne couvre le chemin ensuite.
  await page.locator('.verdict').getByRole('button', { name: 'Retour au chemin' }).click();
  const ecranNiveau = page.getByTestId('niveau-atteint');
  await expect(ecranNiveau).toContainText(/Niveau\s2/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const retour = ecranNiveau.getByRole('button', { name: 'Retour au chemin' });
  expect((await retour.boundingBox())!.y + 44).toBeLessThanOrEqual(640);
  await retour.click();
  const titre = page.getByRole('heading', { level: 2, name: 'Les bases' });
  await expect(titre).toBeVisible();
  // Pendant 4 s (la carte dure 3,2 s), jamais de carte sur le titre du chemin.
  const fin = Date.now() + 4000;
  while (Date.now() < fin) {
    const couvre = await page.evaluate(() => {
      const c = document.querySelector('[data-testid="fete-niveau"]')?.getBoundingClientRect();
      const t = [...document.querySelectorAll('h2')].find((h) => h.textContent === 'Les bases')?.getBoundingClientRect();
      return !!c && !!t && c.bottom > t.top && t.bottom > c.top;
    });
    expect(couvre, 'la carte « Niveau 2 ! » couvre « Les bases »').toBe(false);
    await page.waitForTimeout(100);
  }
});
