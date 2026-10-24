import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, jouer } from './plateau';

// Issue #213 : la flamme dit l'état du jour ; Pomme accueille selon le jour.
// Horloge figée en heure de Paris. Le Go du jour n° 7 (03/10/2026) est le problème b1 (réponse E5).
const JOUR_7 = new Date('2026-10-03T08:10:00+02:00');
const bulle = (page: Page) => page.locator('.scene-bulle');

async function semer(page: Page, donnees: Record<string, unknown>) {
  await page.goto('/');
  await page.evaluate(d => { for (const [k, v] of Object.entries(d)) localStorage.setItem(k, JSON.stringify(v)); }, donnees);
  await page.reload();
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('flamme creuse et tuile « À faire », puis flamme pleine et « Fait » après le Go du jour', async ({ page }) => {
  await page.clock.setFixedTime(JOUR_7);
  await semer(page, {
    'go.go-du-jour.v1': { dernier: 6, jours: 6 },
    'go.parties.v1': { n: 2, dernier: 'pomme' },
    'go.visite.v1': { jour: 6, absence: 0 },
  });

  const flamme = page.getByTestId('flamme');
  await expect(flamme).toHaveAttribute('data-etat', 'creuse');
  await expect(flamme).toHaveAccessibleName(/^Série de 6\sjours\. Go du jour à faire aujourd’hui/);
  await expect(page.getByTestId('etat-du-jour')).toHaveText('À faire');
  const tuile = page.getByRole('button', { name: /^Go du jour n°\s7 : .+\. À faire\.$/ });
  await expect(tuile).toBeVisible();
  // #695 (U2) : la bulle de l'adversaire dit l'état du jour : la série en jeu.
  await expect(bulle(page)).toHaveText('Série de 6 jours. Un Go du jour et c’est 7.');

  // La tuile ouvre le Go du jour lui-même (recette du 02/10 au soir) ; on le résout.
  await tuile.click();
  await jouer(page, 'E5');
  await attendrePierre(page, 'E5', 'noir');

  // Retour à l'accueil (#646 : la sortie du problème, posé sur l'accueil) : la flamme s'allume (une fois), la tuile dit « Fait ».
  await page.getByRole('button', { name: 'Retour', exact: true }).click();
  await expect(flamme).toHaveAttribute('data-etat', 'pleine');
  await expect(flamme).toHaveText('7');
  await expect(flamme).toHaveClass(/allumage/);
  await expect(flamme).not.toHaveClass(/allumage/);
  await expect(flamme).toHaveAccessibleName(/Go du jour fait aujourd’hui/);
  await expect(page.getByTestId('etat-du-jour')).toHaveText('Fait');
  await expect(bulle(page)).toHaveText(/^Fait pour aujourd’hui\. À demain\s!$/);

  // Rechargement : toujours pleine, sans nouvel allumage.
  await page.reload();
  await expect(flamme).toHaveAttribute('data-etat', 'pleine');
  await expect(flamme).not.toHaveClass(/allumage/);
});

test('la bulle de l’adversaire change selon le jour (la série en jeu), et après une absence', async ({ page }) => {
  const parties = { n: 3, dernier: 'pomme' };
  const textes: string[] = [];
  for (const [i, iso] of ['2026-10-03T09:00:00+02:00', '2026-10-04T09:00:00+02:00', '2026-10-05T09:00:00+02:00'].entries()) {
    await page.clock.setFixedTime(new Date(iso));
    // La veille a été réussie : la série compte un jour de plus chaque matin.
    await semer(page, { 'go.parties.v1': parties, 'go.visite.v1': { jour: 6 + i, absence: 0 }, 'go.go-du-jour.v1': { dernier: 6 + i, jours: 6 + i } });
    textes.push((await bulle(page).textContent()) ?? '');
    // Même jour, même réplique au rechargement.
    await page.reload();
    await expect(bulle(page)).toHaveText(textes[i]);
  }
  expect(textes).toEqual(['Série de 6 jours. Un Go du jour et c’est 7.', 'Série de 7 jours. Un Go du jour et c’est 8.', 'Série de 8 jours. Un Go du jour et c’est 9.']);

  // Cinq jours sans venir : un accueil de retour, et il tient toute la journée.
  await page.clock.setFixedTime(new Date('2026-10-10T18:20:00+02:00'));
  await semer(page, { 'go.parties.v1': parties, 'go.visite.v1': { jour: 9, absence: 0 } });
  const retour = (await bulle(page).textContent()) ?? '';
  expect(retour).toMatch(/revoilà|plaisir de te revoir|manqué/);
  expect(retour).not.toMatch(/On rejoue/);
  await page.reload();
  await expect(bulle(page)).toHaveText(retour);
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(deborde).toBe(false);
});
