import { expect, type Page } from '@playwright/test';

// #653 : Problèmes est un sommaire de quatre entrées (Go du jour, Rejouer tes erreurs, Course aux problèmes, Par thème).
// « Par thème » ouvre la grille des séries et le lien « Tous les problèmes ».

/** Depuis le sommaire de Problèmes (ou déjà dans « Par thème »), ouvre le détail « Par thème ». */
export async function ouvrirParTheme(page: Page): Promise<void> {
  const page_ = page.locator('.problemes-par-theme');
  if (!(await page_.isVisible())) await page.getByTestId('entree-par-theme').click();
  await expect(page_).toBeVisible();
}

/** Ouvre « Tous les problèmes » : par « Par thème » depuis le sommaire. */
export async function ouvrirTous(page: Page): Promise<void> {
  const lien = page.getByRole('button', { name: /^(Tous les problèmes|All puzzles)$/ });
  if (!(await lien.isVisible())) await page.getByTestId('entree-par-theme').click();
  await lien.click();
}
