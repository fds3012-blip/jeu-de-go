import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jouer, plateau } from './plateau';

// Issue #284 : « Continuer » à ta mesure. Un nouveau joueur qui réussit 5 problèmes d'affilée reçoit ensuite
// un problème « Moyen ». Et rien ne change à l'écran : un seul bouton, aucune cote ni total affichés (#137).

// Bonne réponse de chaque problème, lue dans les sources (import.meta.glob n'existe pas côté Playwright).
const CONTENU = fileURLToPath(new URL('../src/content', import.meta.url));
const sources = [join(CONTENU, 'puzzles.ts'), ...readdirSync(join(CONTENU, 'lots')).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts')).map(f => join(CONTENU, 'lots', f))];
const REPONSES = new Map(sources.flatMap(f => [...readFileSync(f, 'utf8').matchAll(/id: ?'([^']+)', size: ?(\d+), difficulty: ?\d+, answers: ?\['([A-T]\d+)'/g)]
  .map(m => [m[1], { taille: Number(m[2]), coup: m[3] }] as const)));

// Horloge figée le 27 septembre 2026 à midi, heure de Paris : Go du jour n° 1 (b1), hors du choix à ta mesure.
const MIDI_PARIS = new Date('2026-09-27T12:00:00+02:00');

test('5 réussites d’affilée : le 6e problème est « Moyen », sans cote affichée', async ({ page }) => {
  expect(REPONSES.size).toBeGreaterThan(150);
  await page.clock.setFixedTime(MIDI_PARIS);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  await page.getByRole('button', { name: /^Problème suivant / }).click();

  const lecteur = page.locator('.lecteur');
  const vus: string[] = [];
  for (let i = 0; i < 5; i++) {
    const id = await lecteur.getAttribute('data-probleme');
    expect(id).toBeTruthy();
    expect(vus).not.toContain(id);
    vus.push(id!);
    await expect(lecteur.locator('.lecteur-tete .difficulte')).toHaveText(/Facile/);
    const r = REPONSES.get(id!)!;
    await expect(plateau(page, r.taille)).toBeVisible();
    await jouer(page, r.coup, r.taille);
    const verdict = page.locator('.verdict');
    await expect(verdict.getByRole('button', { name: 'Problème suivant' })).toBeVisible();
    // Jamais de cote à ta mesure affichée (sans compte, aucune cote du tout).
    await expect(verdict).not.toContainText(/cote/i);
    await verdict.getByRole('button', { name: 'Problème suivant' }).click();
    await expect(lecteur).not.toHaveAttribute('data-probleme', id!);
  }
  await expect(lecteur.locator('.lecteur-tete .difficulte')).toHaveText(/Moyen/);

  // La cote vit sur l'appareil, sous la clé citée dans la politique de confidentialité.
  const etat = await page.evaluate(() => JSON.parse(localStorage.getItem('go.cote-joueur.v1') ?? 'null'));
  expect(etat.essais).toBe(5);
  expect(etat.serie).toBe(5);

  // Retour à la liste : un seul « Problème suivant », aucune cote ni total.
  await page.getByRole('button', { name: 'Retour aux problèmes' }).first().click();
  await expect(page.getByRole('button', { name: /^Problème suivant / })).toHaveCount(1);
  await expect(page.getByText(/\d+\s\/\s\d+/)).toHaveCount(0);
  await expect(page.getByText(String(Math.round(etat.cote)), { exact: true })).toHaveCount(0);
});
