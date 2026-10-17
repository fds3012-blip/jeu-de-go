import { expect, type Page } from '@playwright/test';

/**
 * #620 : marque le Go du jour affiché comme fait sur cet appareil (`go.go-du-jour.fait.v1`). Dans Problèmes, la carte
 * « Problème suivant », avec le palier et ses réussites, passe alors en tête. À appeler sur la racine de Problèmes ;
 * la page doit être rechargée ensuite.
 */
export async function marquerGoDuJourFait(page: Page): Promise<void> {
  const titre = page.locator('#jour-titre');
  await expect(titre).toBeVisible();
  const numero = Number(/(\d+)/.exec((await titre.textContent()) ?? '')![1]);
  await page.evaluate(n => localStorage.setItem('go.go-du-jour.fait.v1', String(n)), numero);
}
