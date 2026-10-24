import { expect, type Page } from '@playwright/test';
import { fromRows } from '../src/go/position';
import { toLabel } from '../src/go/coords';
import { aideMini } from '../src/content/miniPartie';
import { jouer, pierres } from './plateau';

// « Ta première partie » (#715) : aides de parcours pour les e2e qui traversent l'introduction des règles.

/** La position affichée, relue sur le plateau : le coup que l'aide de Mochi montrerait. */
export async function coupDeLAide(page: Page): Promise<string> {
  const rows: string[][] = Array.from({ length: 5 }, () => Array(5).fill('.'));
  for (const [couleur, signe] of [['noir', 'X'], ['blanc', 'O']] as const) {
    const points = await pierres(page, couleur, 5).evaluateAll(ns => ns.map(n => n.getAttribute('data-point')!));
    for (const l of points) rows[5 - Number(l.slice(1))]['ABCDE'.indexOf(l[0])] = signe;
  }
  return toLabel(aideMini(fromRows(rows.map(r => r.join('')), 1).pos)!.p, 5);
}

/** Joue la mini-partie en suivant l'aide de Mochi jusqu'à la victoire (la fin de l'introduction s'affiche). */
export async function gagnerLaMiniPartie(page: Page): Promise<void> {
  await expect(page.locator('.mini-partie')).toBeVisible();
  for (let i = 0; i < 4; i++) {
    if (await page.getByTestId('fin-intro').isVisible()) return;
    await expect(page.locator('.mini-partie')).toHaveAttribute('data-phase', 'noir');
    await jouer(page, await coupDeLAide(page), 5);
  }
  await expect(page.getByTestId('fin-intro')).toBeVisible();
}
