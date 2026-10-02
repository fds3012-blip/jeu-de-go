import { expect, test, type Page } from '@playwright/test';
import { jouer } from './plateau';

// Lecteur de leçon v3 (recette du 30/09, R2) : plateau en haut, Mochi qui parle en bas, points d'étapes sans chiffre,
// halo de guidage la première fois, une seule action en relief. La leçon 1 entière puis son entraînement,
// à 390 × 844 et 320 × 568, en clair et en sombre : tout tient sans défiler sur l'étape de jeu.

/** Aucun défilement, ni horizontal ni vertical, sur l'étape de jeu. */
async function tientDansLecran(page: Page, ecran: string) {
  const m = await page.evaluate(() => ({
    large: document.documentElement.scrollWidth, fenetre: innerWidth,
    haut: document.scrollingElement!.scrollHeight, vue: innerHeight,
  }));
  expect(m.large, `défilement horizontal : ${ecran}`).toBeLessThanOrEqual(m.fenetre);
  expect(m.haut, `défilement vertical : ${ecran}`).toBeLessThanOrEqual(m.vue + 1);
}

/** L'élément est entier à l'écran, au-dessus de la barre de navigation. */
async function visibleAuDessusDeLaNav(page: Page, selecteur: string) {
  const r = await page.locator(selecteur).first().boundingBox();
  const nav = await page.getByRole('navigation').boundingBox();
  expect(r, selecteur).not.toBeNull();
  expect(r!.y).toBeGreaterThanOrEqual(0);
  expect(r!.y + r!.height).toBeLessThanOrEqual(nav!.y + 1);
}

for (const [largeur, hauteur] of [[390, 844], [320, 568]] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`leçon 1 puis entraînement, ${largeur} × ${hauteur}, ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: hauteur });
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
      await page.goto('/');
      await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
      await page.getByRole('button', { name: 'Commencer' }).click();

      // Barre : retour, titre, points d'étapes (aucun chiffre à l'écran, le lecteur d'écran a le compte).
      const progression = page.getByRole('progressbar', { name: 'Progression de la leçon' });
      await expect(progression).toHaveAttribute('aria-valuenow', '0');
      await expect(progression.locator('span')).toHaveCount(6);
      await expect(progression.locator('span.encours')).toHaveCount(1);
      await expect(page.locator('.lecteur-tete')).not.toContainText(/\d/);
      // Mochi parle en bas, sous le plateau, portrait neutre ; la consigne est la sienne.
      const portrait = page.locator('.mochi-portrait');
      await expect(portrait).toHaveAttribute('data-humeur', 'neutre');
      const plateau = await page.locator('.board-wrap').boundingBox();
      const mochi = await page.locator('.mochi-zone').boundingBox();
      expect(mochi!.y).toBeGreaterThanOrEqual(plateau!.y + plateau!.height - 1);
      expect((await portrait.boundingBox())!.width).toBeGreaterThanOrEqual(72);
      await expect(page.locator('.mochi-bulle p')).toContainText('Pose ta pierre au point vert.');
      // Guidage de la toute première étape : un halo sur le point à poser, posé une fois dans l'appareil.
      await expect(page.locator('.halos')).toHaveAttribute('data-guide', 'E5');
      expect(await page.evaluate(() => localStorage.getItem('go.lecons.guide.v1'))).toBe('"1"');
      // Pas d'action tant que le geste n'est pas fait ; tout tient dans l'écran.
      await expect(page.getByRole('button', { name: 'Continuer' })).toHaveCount(0);
      await tientDansLecran(page, 'étape 1');

      // Geste faux : Mochi réfléchit avec toi, erreur douce dans sa bulle, le plateau reste jouable.
      await jouer(page, 'D4');
      await expect(portrait).toHaveAttribute('data-humeur', 'pensif');
      await expect(page.locator('.mochi-bulle')).toContainText('Pose ta pierre sur le point vert.');
      await expect(page.locator('.lecteur-lecon')).toHaveAttribute('data-moment', 'revoir');
      await jouer(page, 'E5');
      await expect(page.locator('.lecteur-plateau')).toHaveAttribute('data-demo', 'finie');
      await expect(page.locator('.halos')).toHaveCount(0);
      // L'action principale, seule en relief, entière au-dessus de la navigation.
      await expect(page.locator('.lecteur-lecon .cta')).toHaveCount(1);
      await visibleAuDessusDeLaNav(page, '.lecteur-lecon .cta');
      await tientDansLecran(page, 'étape 1 finie');
      await page.getByRole('button', { name: 'Continuer' }).click();
      await expect(progression).toHaveAttribute('aria-valuenow', '1');
      await expect(page.locator('.halos')).toHaveCount(0);

      for (const p of ['A1', 'D6']) {
        await jouer(page, p);
        await page.getByRole('button', { name: 'Continuer' }).click();
      }
      // Étape à jouer : erreur douce (secousse de la bulle, hors mouvements réduits), puis bravo en jade et « Continuer ».
      await jouer(page, 'A1');
      await expect(page.locator('.mochi-bulle.verdict-revoir')).toContainText(/Essaie encore\./);
      await expect(portrait).toHaveAttribute('data-humeur', 'pensif');
      await expect(page.getByRole('button', { name: 'Continuer' })).toHaveCount(0);
      await jouer(page, 'E5');
      await expect(page.locator('.mochi-bulle.verdict-juste')).toContainText(/^Capturée/);
      await expect(portrait).toHaveAttribute('data-humeur', 'content');
      await expect(progression).toHaveAttribute('aria-valuenow', '4');
      await visibleAuDessusDeLaNav(page, '.lecteur-lecon .cta');
      await tientDansLecran(page, 'étape 4 juste');
      await page.getByRole('button', { name: 'Continuer' }).click();
      await jouer(page, 'E5');
      await page.getByRole('button', { name: 'Continuer' }).click();
      await jouer(page, 'E4');
      await page.getByRole('button', { name: 'Terminer la leçon' }).click();

      // Fin de leçon : l'XP lue sur place (pas de pastille flottante), le prochain pas, une seule action en relief.
      await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();
      await expect(page.locator('.fin-gain [data-testid="pastille-xp"]')).toContainText(/\+50\sXP/);
      await expect(page.locator('.annonce-xp [data-testid="pastille-xp"]')).toHaveCount(0);
      await expect(page.locator('.fin-prochain')).toContainText('Prochain pas : Atari');
      await expect(page.locator('.fin-lecon .cta')).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur);
      await page.getByRole('button', { name: /^Entraîne-toi/ }).click();

      // Entraînement : « Entraînement » et ses points, aucun chiffre ; trois problèmes puis le chemin.
      const serie = page.locator('.serie-pratique');
      await expect(serie).toHaveAttribute('data-serie', 'a02 n02 a03');
      for (const [rang, coup] of [[1, 'E2'], [2, 'F1'], [3, 'A2']] as const) {
        await expect(serie).toHaveAttribute('data-rang', String(rang));
        const points = page.getByRole('progressbar', { name: "Progression de l'entraînement" });
        await expect(points).toHaveAttribute('aria-valuenow', String(rang - 1));
        await expect(page.locator('.lecteur-tete')).toContainText('Entraînement');
        await expect(page.locator('.lecteur-tete small')).not.toContainText(/\d/);
        await jouer(page, coup);
        await expect(page.locator('.verdict-juste')).toBeVisible();
        if (rang < 3) await page.getByRole('button', { name: 'Problème suivant' }).click();
      }
      await page.locator('.verdict').getByRole('button', { name: 'Retour au chemin' }).click();
      // 100 XP : le niveau 2, sur son écran à lui, puis le chemin.
      await page.getByTestId('niveau-atteint').getByRole('button', { name: 'Retour au chemin' }).click();
      await expect(page.getByRole('button', { name: 'Commencer la leçon : Atari' })).toBeVisible();

      // Le halo ne revient pas : la leçon 2 s'ouvre sans guidage.
      await page.getByRole('button', { name: 'Commencer la leçon : Atari' }).click();
      await expect(page.locator('.lecteur-plateau')).toHaveAttribute('data-demo', 'geste');
      await expect(page.locator('.halos')).toHaveCount(0);
    });
  }
}

test('quiz : l’erreur douce dans la bulle de Mochi, les choix restent touchables, puis le bravo', async ({ page }) => {
  const presque = { l1: 6, l2: 6, l3: 8, l4: 5, l5: 5, l6: 6, l7: 1 };
  await page.addInitScript(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), presque);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.getByRole('button', { name: 'Reprendre la leçon : Compter les points' }).click();
  const choix = (n: string) => page.locator('.choix').getByRole('button', { name: n, exact: true });
  await expect(choix('27')).toBeVisible();
  await choix('27').click();
  await expect(page.locator('.mochi-bulle.choix-aide')).toContainText(/Essaie encore\./);
  await expect(page.locator('.verdict')).toHaveCount(0);
  await expect(page.locator('.mochi-portrait')).toHaveAttribute('data-humeur', 'pensif');
  await expect(choix('27')).toHaveClass(/choix-faux/);
  await choix('33,5').click();
  await expect(page.locator('.mochi-bulle.verdict-juste')).toContainText(/Noir a 36/);
  await expect(page.locator('.mochi-portrait')).toHaveAttribute('data-humeur', 'content');
  await visibleAuDessusDeLaNav(page, '.lecteur-lecon .cta');
});

test('mouvements non réduits : halo qui respire, secousse après l’erreur, anneau de jade sur la bonne réponse', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.getByRole('button', { name: 'Commencer' }).click();
  // Première étape : le halo respire autour du point à poser (1,6 s, en boucle, transform et opacité seulement).
  const halo = page.locator('.halo-guide');
  await expect(halo).toBeVisible();
  expect(await halo.evaluate(e => getComputedStyle(e).animationName)).toBe('halo-respire');
  // Geste faux : la bulle de Mochi tremble un peu (240 ms).
  await jouer(page, 'D4');
  const bulle = page.locator('.lecteur-lecon[data-moment="revoir"] .mochi-bulle');
  expect(await bulle.evaluate(e => getComputedStyle(e).animationName)).toContain('secousse');
  await jouer(page, 'E5');
  await expect(page.locator('.lecteur-plateau')).toHaveAttribute('data-demo', 'en-cours');
  await expect(halo).toHaveCount(0);
  await page.getByRole('button', { name: 'Continuer' }).click({ timeout: 15_000 });
  await jouer(page, 'A1'); await page.getByRole('button', { name: 'Continuer' }).click({ timeout: 15_000 });
  await jouer(page, 'D6'); await page.getByRole('button', { name: 'Continuer' }).click({ timeout: 15_000 });
  // Étape à jouer : la bonne réponse ouvre un anneau de jade autour de la pierre, 300 ms au plus.
  await jouer(page, 'E5');
  const anneau = page.locator('.halo-juste');
  await expect(anneau).toBeAttached();
  expect(await anneau.evaluate(e => getComputedStyle(e).animationName)).toBe('halo-ouvre');
  expect(await anneau.evaluate(e => parseFloat(getComputedStyle(e).animationDuration) * 1000)).toBeLessThanOrEqual(300);
});
