import { expect, type Locator, type Page } from '@playwright/test';

// #646 (lot N2, règle A5) : une activité (leçon, problème, course, découverte, règles, placement, révisions) prend tout
// l'écran, sans barre du bas. Un parcours qui veut changer d'onglet en sort d'abord par sa seule sortie, « ‹ ».

/** La barre du bas. */
export const barre = (page: Page): Locator => page.getByRole('navigation');

/** Sort des activités ouvertes (« ‹ » de l'écran affiché) jusqu'à retrouver la barre du bas. */
export async function sortirActivite(page: Page): Promise<void> {
  // « ‹ », ou, sur la fin d'une leçon, son lien « Retour au chemin ».
  const retour = page.locator('.calque:not([hidden]) :is(.retour, .fin-actions [data-action="chemin"])').last();
  for (let i = 0; i < 4; i++) {
    // L'écran peut encore se charger : on attend la barre ou une sortie.
    await expect(barre(page).or(retour).first()).toBeVisible();
    if (await barre(page).isVisible()) break;
    await retour.click();
  }
  await expect(barre(page)).toBeVisible();
}

/** Touche l'onglet `nom` de la barre du bas, après être sorti de l'activité en cours s'il y en a une. */
export async function onglet(page: Page, nom: string | RegExp, options: { exact?: boolean } = {}): Promise<void> {
  await sortirActivite(page);
  await barre(page).getByRole('button', { name: nom, exact: options.exact }).click();
}

/**
 * Haut de la zone libre en bas de l'écran : le haut de la barre du bas, ou le bas de l'écran pendant une activité
 * (#646 : plus de barre). L'intention « au-dessus de la barre » devient « visible sans défiler ».
 */
export async function basLibre(page: Page): Promise<number> {
  return page.evaluate(() => {
    const nav = document.querySelector('nav.nav');
    return nav && nav.getClientRects().length ? nav.getBoundingClientRect().top : innerHeight;
  });
}
