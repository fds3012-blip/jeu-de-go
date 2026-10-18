import { expect, type Page } from '@playwright/test';

// #652 : Apprendre est un sommaire. Hors de la prochaine leçon (sa carte), une leçon s'ouvre depuis la page de son thème.

/** L'onglet Apprendre de la barre du bas (français ou anglais). */
export async function ongletApprendre(page: Page): Promise<void> {
  await page.getByRole('navigation').getByRole('button', { name: /^(Apprendre|Learn)$/ }).click();
}

/** Ouvre la page d'un thème depuis la grille « Par thème » du sommaire (`theme` : son nom affiché, « Compter »). */
export async function ouvrirTheme(page: Page, theme: string | RegExp): Promise<void> {
  const carte = page.getByTestId('par-theme').getByRole('button', { name: typeof theme === 'string' ? new RegExp(`^${theme}(,|$)`) : theme });
  await carte.scrollIntoViewIfNeeded();
  await carte.click();
  await expect(page.locator('.theme-lecons')).toBeVisible();
}

/**
 * La ligne d'une leçon dans la page d'un thème, par son nom accessible (« Leçon 7 : Compter les points, terminée »),
 * après avoir ouvert le thème depuis le sommaire.
 */
export async function leconDuTheme(page: Page, theme: string | RegExp, lecon: string | RegExp) {
  await ouvrirTheme(page, theme);
  return page.locator('.theme-lecons').getByRole('button', { name: lecon });
}
