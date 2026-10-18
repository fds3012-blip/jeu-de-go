import { expect, type Page } from '@playwright/test';
import { SCENARIO } from '../src/content/decouverte';
import { ouvrirAvecMochi, jouer } from './plateau';

// Partie de découverte (#524) : aides des parcours. Le scénario lui-même (src/content/decouverte.ts) dit quoi jouer.

/** L'écran de la découverte, sur le moment `id` (attribut data-etape). */
export const surMoment = (page: Page, id: string) => expect(page.locator(`.decouverte[data-etape="${id}"]`)).toBeVisible();

/** Ouvre la découverte depuis Apprendre › Jouer avec Mochi (#652). */
export async function ouvrirDepuisApprendre(page: Page): Promise<void> {
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await ouvrirAvecMochi(page);
  await page.getByTestId('carte-decouverte').click();
  await expect(page.locator('.decouverte')).toBeVisible();
}

/** Fait le bon geste du moment en cours, puis attend le moment suivant (ou l'écran de fin). */
export async function faireMoment(page: Page, i: number): Promise<void> {
  const m = SCENARIO[i];
  await surMoment(page, m.id);
  if (m.type === 'coup') {
    await jouer(page, m.attendu);
    if (m.bravo) await page.locator('.decouverte .cta').click();
  } else if (m.type === 'essai') {
    await jouer(page, m.points[0]);
  } else if (m.type === 'passe') {
    await page.getByRole('button', { name: 'Passer', exact: true }).click();
  } else {
    await page.locator('.decouverte .cta').click();
  }
  const suivant = SCENARIO[i + 1];
  if (suivant) await surMoment(page, suivant.id);
  else await expect(page.getByTestId('fin-decouverte')).toBeVisible();
}

/** Joue la découverte, du moment en cours jusqu'au moment `id` (exclu). */
export async function avancerJusqua(page: Page, id: string): Promise<void> {
  const fin = SCENARIO.findIndex(m => m.id === id);
  const courant = await page.locator('.decouverte').getAttribute('data-etape');
  for (let i = SCENARIO.findIndex(m => m.id === courant); i < fin; i++) await faireMoment(page, i);
}
