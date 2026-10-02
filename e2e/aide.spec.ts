import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, coupsJoues, jouerSuite, message, partieADeux, passer, pierres, plateau } from './plateau';

// Aide du joueur (#362) : règles en 5 cartes, « Comment on compte ? », glossaire cherchable.
// Feuille posée par-dessus l'écran : la partie ou la leçon reste où elle était.

const feuille = (page: Page) => page.getByRole('dialog', { name: /^(Aide|Help)$/ });
const boutonAide = (page: Page) => page.getByRole('button', { name: 'Aide : règles et mots du go' });

test('depuis une partie : « ? », chercher « ko », lire, fermer, la partie est intacte', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await partieADeux(page);
  await jouerSuite(page, ['D5', 'E5', 'F5']);
  await attendrePierre(page, 'F5', 'noir');
  const avant = { coups: await coupsJoues(page).count(), message: await message(page).textContent() };
  expect(avant.coups).toBe(3);

  // Le « ? » du bandeau du haut : 44 px, à droite, dans l'écran.
  const bouton = boutonAide(page);
  const b = (await bouton.boundingBox())!;
  expect(b.width).toBeGreaterThanOrEqual(44);
  expect(b.x + b.width).toBeLessThanOrEqual(390);
  await bouton.click();
  const aide = feuille(page);
  await expect(aide).toBeVisible();
  await expect(aide.getByRole('tab', { name: 'Règles' })).toHaveAttribute('aria-selected', 'true');
  // Depuis une partie, aucun lien ne fait quitter la partie pour une leçon.
  await expect(aide.getByRole('button', { name: /^Rejoue la leçon/ })).toHaveCount(0);

  await aide.getByRole('tab', { name: 'Mots' }).click();
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

  // Le raccourci clavier « ? » ouvre la même aide (clavier externe, lecteur d'écran).
  await page.keyboard.press('?');
  await expect(feuille(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(feuille(page)).toBeHidden();
  await expect(coupsJoues(page)).toHaveCount(4);
});

test('depuis le comptage : un toucher ouvre « Comment on compte ? », un toucher ramène à la partie intacte', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await partieADeux(page);
  // Deux murs : Noir à gauche (colonne D), Blanc à droite (colonne F), puis deux passes.
  await jouerSuite(page, ['D1', 'F1', 'D2', 'F2', 'D3', 'F3', 'D4', 'F4', 'D5', 'F5', 'D6', 'F6', 'D7', 'F7', 'D8', 'F8', 'D9', 'F9']);
  await attendrePierre(page, 'F9', 'blanc');
  await passer(page);
  await passer(page);
  const barre = page.getByRole('toolbar', { name: 'Comptage des points' });
  await expect(barre).toBeVisible();
  const avant = {
    texte: await page.locator('p.comptage').textContent(),
    noires: await pierres(page, 'noir').count(), blanches: await pierres(page, 'blanc').count(),
    coups: await coupsJoues(page).count(),
  };

  await boutonAide(page).click();
  const aide = feuille(page);
  await expect(aide.getByRole('tab', { name: 'Compter' })).toHaveAttribute('aria-selected', 'true');
  await expect(aide.getByText('À la fin, qui a gagné ? Voici comment on compte.')).toBeVisible();
  await expect(aide.getByRole('heading', { name: /Le territoire/ })).toBeVisible();
  await expect(aide.getByRole('heading', { name: /Le komi/ })).toBeAttached();

  await aide.getByRole('button', { name: 'Fermer' }).click();
  await expect(aide).toBeHidden();
  await expect(barre).toBeVisible();
  await expect(page.locator('p.comptage')).toHaveText(avant.texte!);
  await expect(pierres(page, 'noir')).toHaveCount(avant.noires);
  await expect(pierres(page, 'blanc')).toHaveCount(avant.blanches);
  await expect(coupsJoues(page)).toHaveCount(avant.coups);
});

test('questions fréquentes : compte, série, gel, hors ligne, supprimer mon compte', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await page.getByRole('button', { name: 'Aide', exact: true }).click();
  const aide = feuille(page);
  await aide.getByRole('tab', { name: 'Questions' }).click();
  const questions = aide.locator('[data-question]');
  await expect(questions).toHaveCount(5);
  await expect(aide.getByRole('heading', { name: /À quoi sert un gel/ })).toBeVisible();
  await expect(aide.locator('[data-question="supprimer"]')).toContainText('Mon compte');
});

test('titre de leçon lisible en 320 px malgré le « ? »', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => localStorage.setItem('go.lecons.v1', JSON.stringify({ l1: 6, l2: 6 })));
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.getByRole('button', { name: 'Commencer la leçon : Techniques de capture' }).click();
  const titre = page.locator('.lecteur-lecon .lecteur-titre > span:not([data-lecon])');
  await expect(titre).toHaveText(/Techniques de capture/);
  // Le texte entier tient (sur 2 lignes au plus) : rien n'est coupé.
  const m = await titre.evaluate(e => ({ plein: e.scrollHeight, vu: e.clientHeight, large: e.scrollWidth, vuLarge: e.clientWidth }));
  expect(m.plein).toBeLessThanOrEqual(m.vu + 1);
  expect(m.large).toBeLessThanOrEqual(m.vuLarge + 1);
  await expect(page.getByRole('button', { name: 'Aide : règles et mots du go' })).toBeVisible();
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
      for (const onglet of ['Règles', 'Compter', 'Mots']) {
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
  await aide.getByRole('tab', { name: 'Words' }).click();
  await aide.getByRole('searchbox', { name: 'Search for a word' }).fill('ko');
  await expect(aide.getByRole('listitem').first().getByRole('heading')).toHaveText('Ko');
  await expect(aide.getByRole('listitem').first()).toContainText('after a single stone is captured');
});
