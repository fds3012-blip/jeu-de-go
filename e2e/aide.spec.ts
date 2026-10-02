import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, coupsJoues, jouerSuite, message, partieADeux, pierres, plateau } from './plateau';

// Aide du joueur (#362) : règles en 5 cartes, « Comment on compte ? », glossaire cherchable.
// Feuille posée par-dessus l'écran : la partie ou la leçon reste où elle était.

const feuille = (page: Page) => page.getByRole('dialog', { name: /^(Aide|Help)$/ });

test('depuis une partie : « ? », chercher « ko », lire, fermer, la partie est intacte', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await partieADeux(page);
  await jouerSuite(page, ['D5', 'E5', 'F5']);
  await attendrePierre(page, 'F5', 'noir');
  const avant = { coups: await coupsJoues(page).count(), message: await message(page).textContent() };
  expect(avant.coups).toBe(3);

  // Raccourci « ? » : en attendant le bouton de la barre du haut de la partie (#381), l'aide s'ouvre au clavier.
  await page.keyboard.press('?');
  const aide = feuille(page);
  await expect(aide).toBeVisible();
  await expect(aide.getByRole('tab', { name: 'Règles' })).toHaveAttribute('aria-selected', 'true');
  // Depuis une partie, aucun lien ne fait quitter la partie pour une leçon.
  await expect(aide.getByRole('button', { name: /^Rejoue la leçon/ })).toHaveCount(0);

  await aide.getByRole('tab', { name: 'Mots du go' }).click();
  await aide.getByRole('searchbox', { name: 'Chercher un mot' }).fill('ko');
  const premier = aide.getByRole('listitem').first();
  await expect(premier.getByRole('heading', { name: 'Ko', exact: true })).toBeVisible();
  await expect(premier).toContainText('après la prise d’une seule pierre');
  await expect(aide.getByRole('status')).toHaveText(/mots trouvés/);

  await aide.getByRole('button', { name: 'Fermer' }).click();
  await expect(aide).toBeHidden();

  // Même partie : mêmes pierres, mêmes coups, même message, et on continue à jouer.
  await expect(coupsJoues(page)).toHaveCount(3);
  await expect(pierres(page, 'noir')).toHaveCount(2);
  await expect(pierres(page, 'blanc')).toHaveCount(1);
  await expect(message(page)).toHaveText(avant.message!);
  await jouerSuite(page, ['E6']);
  await attendrePierre(page, 'E6', 'blanc');
  await expect(coupsJoues(page)).toHaveCount(4);
});

test('depuis le Profil : 5 cartes de règles, le comptage, puis une leçon ; Échap ferme et rend le focus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  const ligne = page.getByRole('button', { name: 'Aide', exact: true });
  await ligne.click();
  const aide = feuille(page);
  await expect(aide).toBeVisible();
  const cartes = aide.locator('.aide-cartes > li');
  await expect(cartes).toHaveCount(5);
  await expect(cartes.nth(0).getByRole('heading')).toHaveText(/Poser une pierre/);
  await expect(cartes.nth(3).getByRole('heading')).toHaveText(/Le ko/);
  // Chaque carte a son petit plateau (décoratif : le texte dit tout).
  await expect(aide.locator('.aide-cartes .aide-schema svg.board')).toHaveCount(5);

  await aide.getByRole('tab', { name: 'Compter' }).click();
  await expect(aide.locator('.aide-cartes > li')).toHaveCount(5);
  await expect(aide.getByRole('heading', { name: /Le komi/ })).toBeVisible();

  // Échap ferme ; le focus revient sur la ligne du Profil.
  await page.keyboard.press('Escape');
  await expect(aide).toBeHidden();
  await expect(ligne).toBeFocused();

  // « Rejoue la leçon » ouvre la leçon et ferme l'aide.
  await ligne.click();
  await feuille(page).getByRole('button', { name: 'Rejoue la leçon : Libertés et capture' }).first().click();
  await expect(feuille(page)).toBeHidden();
  await expect(page.getByRole('heading', { name: /Libertés et capture/ })).toBeVisible();
});

test('dans une leçon : « ? » ouvre le mot de la leçon, fermer ramène à la même étape', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.getByRole('button', { name: 'Commencer' }).click();
  const etapes = page.getByRole('progressbar', { name: 'Progression de la leçon' });
  const etape = await etapes.getAttribute('aria-valuenow');

  const bouton = page.getByRole('button', { name: 'Aide : règles et mots du go' });
  const b = (await bouton.boundingBox())!;
  expect(b.width).toBeGreaterThanOrEqual(44);
  expect(b.height).toBeGreaterThanOrEqual(44);
  await bouton.click();
  const aide = feuille(page);
  await expect(aide.getByRole('searchbox')).toHaveValue('Liberté');
  await expect(aide.getByRole('listitem').first().getByRole('heading')).toHaveText('Liberté');
  // La leçon en cours n'est pas proposée : on y est déjà.
  await expect(aide.getByRole('button', { name: 'Rejoue la leçon : Libertés et capture' })).toHaveCount(0);
  await aide.getByRole('button', { name: 'Fermer' }).click();
  await expect(aide).toBeHidden();
  await expect(etapes).toHaveAttribute('aria-valuenow', etape!);
  await expect(plateau(page)).toBeVisible();
});

for (const [largeur, hauteur] of [[390, 844], [320, 568]] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`feuille d'aide en ${largeur} × ${hauteur}, ${theme} : 44 px, sans débordement`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: hauteur });
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
      await page.goto('/');
      await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
      await page.getByRole('button', { name: 'Aide', exact: true }).click();
      const aide = feuille(page);
      for (const onglet of ['Règles', 'Compter', 'Mots du go']) {
        await aide.getByRole('tab', { name: onglet }).click();
        const mesures = await aide.evaluate(d => ({
          large: d.scrollWidth, fenetre: d.clientWidth,
          corps: d.querySelector('.aide-corps')!.scrollWidth, corpsVue: d.querySelector('.aide-corps')!.clientWidth,
          petites: [...d.querySelectorAll<HTMLElement>('button, input')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 44)
            .map(e => e.textContent || e.getAttribute('aria-label') || e.tagName),
        }));
        expect(mesures.large, onglet).toBeLessThanOrEqual(mesures.fenetre);
        expect(mesures.corps, onglet).toBeLessThanOrEqual(mesures.corpsVue);
        expect(mesures.petites, onglet).toEqual([]);
      }
      // Rien de la page ne défile sous la feuille.
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden');
    });
  }
}

test('en anglais : Help, Go words, et « ko » trouve Ko', async ({ page }) => {
  await page.goto('/?lang=en');
  await page.getByRole('navigation').getByRole('button', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  const aide = feuille(page);
  await expect(aide.getByRole('heading', { name: 'Help' })).toBeVisible();
  await aide.getByRole('tab', { name: 'Go words' }).click();
  await aide.getByRole('searchbox', { name: 'Search for a word' }).fill('ko');
  await expect(aide.getByRole('listitem').first().getByRole('heading')).toHaveText('Ko');
  await expect(aide.getByRole('listitem').first()).toContainText('after a single stone is captured');
});
