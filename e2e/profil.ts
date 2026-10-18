import { expect, type Page } from '@playwright/test';

// #654 : le Profil est un sommaire. La barre de niveau (XP), les chiffres du parcours et la vitrine des badges sont dans
// le détail « Niveau et badges » (ligne `ligne-niveau` de la rubrique « Ta progression »).

/** Depuis le sommaire du Profil, ouvre « Niveau et badges » (rien à faire s'il est déjà ouvert). */
export async function ouvrirNiveauBadges(page: Page): Promise<void> {
  const detail = page.locator('.profil-niveau');
  if (!(await detail.isVisible())) await page.getByTestId('ligne-niveau').click();
  await expect(detail).toBeVisible();
}
