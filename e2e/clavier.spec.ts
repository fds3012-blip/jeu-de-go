import { expect, test, type Locator, type Page } from '@playwright/test';
import { fromLabel, toLabel } from '../src/go/coords';
import { attendrePierre, attendreReponse, boutonPasser, coupsJoues, pierres } from './plateau';

// Issue #116 : une partie contre Pomme jouée uniquement au clavier, annonces du lecteur d'écran comprises.

const grille = (page: Page) => page.getByRole('grid', { name: 'Plateau de go 9 × 9' });
const annonce = (page: Page) => page.locator('[data-annonce-plateau]');

/** Amène le curseur sur `label` aux flèches, en partant de sa position affichée (data-curseur). */
async function allerA(page: Page, label: string): Promise<void> {
  const curseur = grille(page).locator('[data-curseur]');
  const depart = fromLabel((await curseur.getAttribute('data-curseur'))!, 9), cible = fromLabel(label, 9);
  const dx = (cible % 9) - (depart % 9), dy = Math.floor(cible / 9) - Math.floor(depart / 9);
  for (let i = 0; i < Math.abs(dx); i++) await page.keyboard.press(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
  for (let i = 0; i < Math.abs(dy); i++) await page.keyboard.press(dy > 0 ? 'ArrowDown' : 'ArrowUp');
  await expect(curseur).toHaveAttribute('data-curseur', label);
}

/** Tabule (vers l'avant) jusqu'à `cible`, sans souris ni focus programmé. */
async function tabulerVers(page: Page, cible: Locator): Promise<void> {
  for (let i = 0; i < 40 && !(await cible.evaluate(el => el === document.activeElement).catch(() => false)); i++) await page.keyboard.press('Tab');
  await expect(cible).toBeFocused();
}

/** Choisit une intersection vide parmi des candidates. */
async function libre(page: Page, candidats: string[]): Promise<string> {
  for (const l of candidats) {
    if ((await grille(page).locator(`g[data-point="${l}"][data-pierre]`).count()) === 0) return l;
  }
  throw new Error('Aucune intersection libre');
}

test('partie contre Pomme jouée entièrement au clavier', async ({ page }) => {
  await page.goto('/');
  const cta = page.locator('.cta');
  await expect(cta).toHaveAccessibleName(/contre Pomme$/);
  await cta.focus();
  await page.keyboard.press('Enter');

  // Un seul arrêt de tabulation mène au plateau.
  await expect(grille(page)).toBeVisible();
  for (let i = 0; i < 20 && !(await grille(page).evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(grille(page)).toBeFocused();

  // Le curseur jade part du centre, et la cellule active porte un nom lu.
  await expect(grille(page).locator('[data-curseur]')).toHaveAttribute('data-curseur', 'E5');
  const actif = await grille(page).getAttribute('aria-activedescendant');
  await expect(page.locator(`[id="${actif}"]`)).toHaveAttribute('aria-label', 'E5, vide');

  // Home, End, PageUp, PageDown vont aux bords.
  await page.keyboard.press('Home');
  await expect(grille(page).locator('[data-curseur]')).toHaveAttribute('data-curseur', 'A5');
  await page.keyboard.press('PageUp');
  await expect(grille(page).locator('[data-curseur]')).toHaveAttribute('data-curseur', 'A9');
  await page.keyboard.press('End');
  await page.keyboard.press('PageDown');
  await expect(grille(page).locator('[data-curseur]')).toHaveAttribute('data-curseur', 'J1');

  const coups = [['C3', 'C4', 'D3'], ['G7', 'G6', 'F7'], ['C7', 'D7', 'C6'], ['G3', 'F3', 'G4']];
  for (let n = 0; n < coups.length; n++) {
    const l = await libre(page, coups[n]);
    await allerA(page, l);
    // La case sous le curseur est annoncée dans la zone polie (#116 : « D5, vide »).
    await expect(annonce(page)).toHaveText(`${l}, vide`);
    // « Confirmer au doigt » est actif par défaut : le premier Entrée montre la pierre fantôme, le second la pose.
    await page.keyboard.press('Enter');
    await expect(grille(page).locator('g[data-fantome]')).toHaveCount(1);
    await expect(annonce(page)).toHaveText(`${l} : appuie encore pour poser`);
    await page.keyboard.press(n % 2 ? ' ' : 'Enter');
    await attendrePierre(page, l, 'noir');
    await expect(pierres(page, 'noir')).toHaveCount(n + 1);
    // Pomme répond, et la région polie annonce son coup.
    await expect(pierres(page, 'blanc')).toHaveCount(n + 1, { timeout: 10_000 });
    await expect(annonce(page)).toHaveText(/^Pomme a joué [A-J][1-9]/);
    const reponse = (await annonce(page).textContent())!.match(/a joué ([A-J][1-9])/)![1];
    expect(toLabel(fromLabel(reponse, 9), 9)).toBe(reponse);
    await expect(grille(page)).toBeFocused();
  }
});

test('partie contre Pomme jusqu’au score, uniquement au clavier', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  // Aucun clic, aucun focus programmé : seulement Tab, les flèches, Entrée et Espace.
  await tabulerVers(page, page.locator('.cta'));
  await page.keyboard.press('Enter');
  await tabulerVers(page, grille(page));

  // Le plateau vide se lit avec la touche L.
  await page.keyboard.press('l');
  await expect(annonce(page)).toHaveText('Le plateau est vide.');

  for (const cands of [['C3', 'C4', 'D3'], ['G7', 'G6', 'F7']]) {
    const l = await libre(page, cands), n = await pierres(page, 'noir').count();
    await allerA(page, l);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await attendrePierre(page, l, 'noir');
    await expect(pierres(page, 'blanc')).toHaveCount(n + 1, { timeout: 10_000 });
    await expect(annonce(page)).toHaveText(/^Pomme a joué [A-J][1-9]/);
  }

  // « Lire le plateau » décrit les pierres ligne par ligne, relu à la demande (même texte, nouvelle annonce).
  await page.keyboard.press('L');
  await expect(annonce(page)).toHaveText(/^2 pierres noires, 2 pierres blanches\. Ligne \d : /);
  await expect(annonce(page)).toContainText('C3 noire');
  // Le même texte, redemandé par le bouton caché jusqu'au focus : il apparaît au Tab, fait au moins 44 px.
  const lire = page.getByRole('button', { name: 'Lire le plateau' });
  await page.keyboard.press('Tab');
  await expect(lire).toBeFocused();
  expect((await lire.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Enter');
  await expect(annonce(page)).toContainText('C3 noire');

  // On passe jusqu'à la fin de la partie ; Pomme finit par passer aussi.
  const fin = page.locator('.recit, .barre-comptage .btn.primary:enabled');
  const choix = page.getByRole('group', { name: 'Passer maintenant ?' });
  for (let i = 0; i < 6 && !(await fin.first().isVisible()); i++) {
    await expect(boutonPasser(page)).toBeEnabled({ timeout: 10_000 });
    const avant = await coupsJoues(page).count();
    await tabulerVers(page, boutonPasser(page));
    await page.keyboard.press('Enter');
    // Mochi peut prévenir que la partie n'est pas finie : on confirme, toujours au clavier.
    await expect.poll(async () => (await choix.count()) > 0 || (await coupsJoues(page).count()) > avant || (await fin.first().isVisible()), { timeout: 10_000 }).toBe(true);
    if (await choix.count()) {
      await tabulerVers(page, choix.getByRole('button', { name: 'Passer', exact: true }));
      await page.keyboard.press('Enter');
    }
    await attendreReponse(page, avant);
  }
  await expect(fin.first()).toBeVisible({ timeout: 10_000 });
  const valider = page.getByRole('button', { name: 'Valider le score' });
  if (await valider.isVisible()) {
    await tabulerVers(page, valider);
    await page.keyboard.press('Enter');
  }

  // Le récit du score, puis le résultat.
  await expect(page.locator('.recit')).toBeVisible();
  const voir = page.getByRole('button', { name: 'Voir le résultat' });
  await tabulerVers(page, voir);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 2, name: /^(Victoire|Défaite|Égalité)$/ })).toBeVisible({ timeout: 5_000 });
});

test('curseur clavier : visible en mode sombre et clair, sans animation si les mouvements sont réduits', async ({ page }) => {
  for (const colorScheme of ['dark', 'light'] as const) {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme });
    await page.goto('/');
    await tabulerVers(page, page.locator('.cta'));
    await page.keyboard.press('Enter');
    await tabulerVers(page, grille(page));
    await page.keyboard.press('ArrowLeft');
    const curseur = grille(page).locator('[data-curseur]');
    await expect(curseur).toHaveAttribute('data-curseur', 'D5');
    await expect(annonce(page)).toHaveText('D5, vide');
    // Liseré presque noir et anneau jade clair (contraste vérifié dans src/ui/boardA11y.test.ts).
    await expect(curseur.locator('rect')).toHaveCount(2);
    await expect(curseur.locator('rect').first()).toHaveAttribute('stroke', '#0B1A14');
    await expect(curseur.locator('rect').last()).toHaveAttribute('stroke', '#4CD39B');
    // Aucune animation sur le curseur ni sur le plateau en mouvements réduits.
    expect(await grille(page).evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
    await page.locator('.partie-plateau').screenshot({ path: `test-results/curseur-clavier-${colorScheme}.png` });
  }
});
