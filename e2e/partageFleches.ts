import { expect, type Page } from '@playwright/test';
import { plateau } from './plateau';

/** #460 : coup précédent et suivant à l'écran sans défiler, au-dessus du plateau, 44 px ; chevrons au trait. */
export async function fleches(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const cta = (await page.locator('.cta').boundingBox())!;
  const goban = (await plateau(page).boundingBox())!;
  for (const nom of ['Coup précédent', 'Coup suivant']) {
    const b = page.getByRole('button', { name: nom });
    const r = (await b.boundingBox())!;
    expect(r.height, nom).toBeGreaterThanOrEqual(44);
    expect(r.y + r.height, `${nom} au-dessus du plateau`).toBeLessThanOrEqual(goban.y);
    expect(r.y + r.height, `${nom} au-dessus du bouton principal`).toBeLessThanOrEqual(cta.y);
    const trait = await b.locator('svg').evaluate(s => ({ fill: getComputedStyle(s).fill, stroke: getComputedStyle(s).stroke }));
    expect(trait.fill, `${nom} : chevron sans remplissage`).toBe('none');
    expect(trait.stroke, `${nom} : chevron au trait`).not.toBe('none');
  }
}
