import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, jouer } from './plateau';

// Issue #214 : la série se lit sur la feuille de réussite du Go du jour (« 4 jours de série · À demain »),
// avec une vraie petite fête aux jalons 3, 7 et 30 ; Profil « Ton parcours » sans cote, vitrine qui se touche.
// Horloge figée le 27 septembre 2026 à midi, heure de Paris : Go du jour n° 1, le problème b1 (réponse E5).
const MIDI_PARIS = new Date('2026-09-27T12:00:00+02:00');

/** Sème le stockage une seule fois (pas à chaque rechargement). */
async function semer(page: Page, d: Record<string, unknown>) {
  await page.addInitScript(v => {
    if (sessionStorage.getItem('seme-214')) return;
    sessionStorage.setItem('seme-214', '1');
    for (const [k, x] of Object.entries(v)) localStorage.setItem(k, JSON.stringify(x));
  }, d);
}

async function reussir(page: Page) {
  await page.clock.setFixedTime(MIDI_PARIS);
  await page.goto('/?go-du-jour=1');
  await expect(page.getByText(/^Go du jour n°\s1$/)).toBeVisible();
  await jouer(page, 'E5');
  await attendrePierre(page, 'E5', 'noir');
  await expect(page.getByRole('button', { name: 'Partager' })).toBeVisible();
}

const serie = (page: Page) => page.getByTestId('serie-du-jour');

for (const largeur of [390, 320]) {
  for (const theme of ['dark', 'light'] as const) {
    const nom = `${largeur} px, ${theme === 'dark' ? 'sombre' : 'clair'}`;

    test(`réussite du Go du jour : « 4 jours de série · À demain » (${nom})`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: largeur === 320 ? 640 : 844 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await semer(page, { 'go.settings.v1': { theme }, 'go.go-du-jour.v1': { dernier: 0, jours: 3 } });
      await reussir(page);
      await expect(serie(page)).toHaveText(/^4 jours de série\s*À\sdemain$/);
      await expect(serie(page)).not.toHaveAttribute('data-jalon');
      // Dans la feuille, sous la réussite ; rien ne dépasse de l'écran.
      await expect(page.locator('.verdict').getByTestId('serie-du-jour')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur);
      // La série n'est pas une action : une seule action en relief dans la feuille.
      await expect(page.locator('.verdict .cta')).toHaveCount(1);
    });

    test(`jalon de 7 jours, mouvements réduits : la fête s'affiche sans animation ni confettis (${nom})`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: largeur === 320 ? 640 : 844 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await semer(page, { 'go.settings.v1': { theme }, 'go.go-du-jour.v1': { dernier: 0, jours: 6 } });
      await reussir(page);
      await expect(serie(page)).toHaveAttribute('data-jalon', '7');
      await expect(serie(page)).toContainText('7 jours de série');
      await expect(serie(page)).toContainText(/À\sdemain/);
      await expect(serie(page)).not.toHaveClass(/\banime\b/);
      await expect(page.getByTestId('confettis')).toHaveCount(0);
      // Le titre du jalon et le bouton principal restent à l'écran, au-dessus de la barre du bas.
      const titre = (await page.locator('.jalon-titre').boundingBox())!;
      const nav = (await page.getByRole('navigation').boundingBox())!;
      expect(titre.y).toBeGreaterThanOrEqual(0);
      expect(titre.y + titre.height).toBeLessThanOrEqual(nav.y);
      const cta = (await page.locator('.verdict .cta').boundingBox())!;
      expect(cta.y + cta.height).toBeLessThanOrEqual(nav.y);
      expect(cta.height).toBeGreaterThanOrEqual(44);
    });
  }
}

test('jalon de 3 jours, mouvements permis : la flamme s’allume, sans confettis (gardés pour 7 et 30)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await semer(page, { 'go.go-du-jour.v1': { dernier: 0, jours: 2 } });
  await reussir(page);
  await expect(serie(page)).toHaveAttribute('data-jalon', '3');
  await expect(serie(page)).toHaveClass(/\banime\b/);
  await expect(page.locator('.jalon-titre')).toHaveText(/^3 jours de série\s!$/);
  await expect(page.getByTestId('confettis')).toHaveCount(0);
});

test('jalon de 30 jours, mouvements permis : confettis', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await semer(page, { 'go.go-du-jour.v1': { dernier: 0, jours: 29 } });
  await reussir(page);
  await expect(serie(page)).toHaveAttribute('data-jalon', '30');
  await expect(serie(page)).toHaveClass(/\banime\b/);
  await expect(page.getByTestId('confettis')).toHaveCount(1);
});

test('réglage Célébrations coupé : le jalon se lit, sans animation ni confettis', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await semer(page, { 'go.settings.v1': { celebrations: false }, 'go.go-du-jour.v1': { dernier: 0, jours: 6 } });
  await reussir(page);
  await expect(serie(page)).toHaveAttribute('data-jalon', '7');
  await expect(serie(page)).not.toHaveClass(/\banime\b/);
  await expect(page.getByTestId('confettis')).toHaveCount(0);
});

test('série déjà allumée aujourd’hui par une leçon : pas de seconde fête, la ligne dit la série', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // #199 : la leçon du matin a fait passer la série à 3 ; le Go du jour n° 1 n'est pas encore fait.
  await semer(page, { 'go.go-du-jour.v1': { dernier: 1, jours: 3 }, 'go.go-du-jour.fait.v1': 0 });
  await reussir(page);
  await expect(serie(page)).toHaveText(/^3 jours de série\s*À\sdemain$/);
  await expect(serie(page)).not.toHaveAttribute('data-jalon');
});

test('premier Go du jour : « 1 jour de série »', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reussir(page);
  await expect(serie(page)).toHaveText(/^1 jour de série\s*À\sdemain$/);
});

test('Profil : aucune cote, la vitrine dit le prochain badge et un badge touché dit sa condition', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await semer(page, {
    'go.parties.v1': { n: 2 }, 'go.bilan.v1': { pomme: { v: 1, d: 1 } },
    'go.badges.v1': ['premiere-partie', 'victoire-pomme'],
  });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await expect(page.getByRole('main').getByText(/\bCote\b/)).toHaveCount(0);
  const vitrine = page.getByRole('region', { name: 'Badges, 2 sur 7' });
  await expect(vitrine.getByRole('heading')).toContainText('Tes badges');
  const detail = vitrine.locator('.vitrine-detail');
  await expect(detail).toHaveText('Prochain badge : Premier problème. Réussis un problème.');
  await vitrine.getByRole('button', { name: '7 jours de série : à gagner. Garde ta série 7 jours.' }).click();
  await expect(detail).toHaveText('7 jours de série : Garde ta série 7 jours.');
  await vitrine.getByRole('button', { name: 'Pomme battue : obtenu' }).click();
  await expect(detail).toHaveText('Pomme battue : gagné !');
  // Un second toucher referme : retour au prochain badge.
  await vitrine.getByRole('button', { name: 'Pomme battue : obtenu' }).click();
  await expect(detail).toHaveText(/^Prochain badge/);
});

test('Profil : un badge gagné depuis la dernière visite est annoncé dans la vitrine, une fois', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await semer(page, { 'go.parties.v1': { n: 1 }, 'go.badges.v1': [] });
  await page.goto('/');
  const profil = page.getByRole('navigation').getByRole('button', { name: 'Profil' });
  await profil.click();
  const vitrine = page.getByRole('region', { name: /^Badges/ });
  await expect(vitrine.locator('.vitrine-detail')).toHaveText('Première partie : gagné !');
  await expect(vitrine.locator('li.nouveau')).toHaveCount(1);
  await page.reload();
  await profil.click();
  await expect(vitrine.locator('li.nouveau')).toHaveCount(0);
  await expect(vitrine.locator('.vitrine-detail')).toHaveText(/^Prochain badge/);
});
