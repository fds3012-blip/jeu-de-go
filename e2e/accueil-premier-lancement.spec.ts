import { expect, test, type Page } from '@playwright/test';

// Accueil v3 (branche accueil-premier-lancement-v3) : les 60 premières secondes d'un nouveau joueur.
// Premier lancement : promesse en une phrase (Mochi), goban, une seule action « Joue ta première partie »,
// « Je sais déjà jouer » discret, ni XP ni niveau ni rang. Première partie en 1 tap. Retours : « Aujourd'hui »
// met en avant la bonne chose à faire (Go du jour à faire, puis leçon suivante). Tout tient en 320 × 568.
const DOSSIER = 'docs/design/captures/accueil-premier-lancement-v3';
const MIDI = new Date('2026-09-30T12:00:00+02:00');
const TAILLES = [{ width: 390, height: 844 }, { width: 320, height: 568 }] as const;
const THEMES = ['dark', 'light'] as const;
const nomTheme = (t: (typeof THEMES)[number]) => (t === 'dark' ? 'sombre' : 'clair');

async function semer(page: Page, cles: Record<string, string>) {
  await page.addInitScript(c => {
    if (sessionStorage.getItem('seme-v3')) return;
    sessionStorage.setItem('seme-v3', '1');
    for (const [k, v] of Object.entries(c)) localStorage.setItem(k, v);
  }, cles);
}

/** Joueur revenu au 3e jour : 3 parties, 40 XP, série de 2, Go du jour d'aujourd'hui à faire, leçon 1 finie. */
const RETOUR = {
  'go.parties.v1': JSON.stringify({ n: 3, dernier: 'pomme', ordi: 3 }),
  'go.bilan.v1': JSON.stringify({ pomme: { v: 1, d: 2 } }),
  'go.xp.v1': '40',
  'go.go-du-jour.v1': JSON.stringify({ dernier: 3, jours: 2 }),
  'go.visite.v1': JSON.stringify({ jour: 3, absence: 0 }),
  'go.retours.v1': JSON.stringify({ jour: 3, retours: 1 }),
  'go.lecons.v1': JSON.stringify({ l1: 5 }),
};

/** Une seule action principale : un seul bouton en relief, un seul `.cta`, au-dessus de la barre du bas. */
async function uneSeuleAction(page: Page) {
  await expect(page.locator('.cta')).toHaveCount(1);
  const relief = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('button')]
    .filter(b => b.offsetParent !== null && getComputedStyle(b).boxShadow.includes('0px 5px 0px')).length);
  expect(relief, 'un seul bouton en relief').toBe(1);
  const [cta, nav] = await Promise.all([page.locator('.cta').boundingBox(), page.getByRole('navigation').boundingBox()]);
  expect(cta!.y + cta!.height, 'le bouton principal au-dessus de la barre du bas, sans défiler').toBeLessThanOrEqual(nav!.y + 1);
  expect(cta!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
}

for (const taille of TAILLES) {
  for (const theme of THEMES) {
    test(`premier lancement : promesse, une seule action, rien à lire avant la première pierre (${taille.width} px, ${nomTheme(theme)})`, async ({ page }) => {
      await page.setViewportSize(taille);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.clock.setFixedTime(MIDI);
      await page.goto('/');

      await expect(page.locator('.cta')).toHaveText('Joue ta première partie');
      // Mochi fait la promesse, en une phrase, au-dessus du goban.
      const promesse = page.getByTestId('promesse');
      await expect(promesse).toContainText(/Apprends le go en jouant\s: je t’explique chaque coup\./);
      await expect(promesse.locator('[data-sceau="mochi"], .sceau')).toHaveCount(1);
      // Ni niveau, ni XP, ni rang, ni pastille « À faire », ni paragraphe sur le kyu.
      await expect(page.getByTestId('barre-niveau')).toHaveCount(0);
      await expect(page.getByText(/kyu/)).toHaveCount(0);
      await expect(page.getByTestId('etat-du-jour')).toHaveCount(0);
      await expect(page.locator('.tuiles-titre')).toHaveCount(0);
      // « Je sais déjà jouer » : un lien discret (pas un bouton plein), 44 px, sous le bouton.
      const lien = page.getByRole('button', { name: 'Je sais déjà jouer' });
      await expect(lien).toBeVisible();
      const [l, cta] = await Promise.all([lien.boundingBox(), page.locator('.cta').boundingBox()]);
      expect(l!.height).toBeGreaterThanOrEqual(44);
      expect(l!.y).toBeGreaterThan(cta!.y);
      expect(await lien.evaluate(el => getComputedStyle(el).backgroundColor)).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
      await uneSeuleAction(page);
      await page.screenshot({ path: `${DOSSIER}/premier-lancement-${taille.width}-${nomTheme(theme)}.png` });
    });
  }
}

test('première partie en 1 tap : le bouton ouvre la partie, Mochi explique, la première pierre se pose', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('.cta').tap();
  const plateau = page.locator('svg.board[aria-label="Plateau de go 9 × 9"]');
  await expect(plateau).toBeVisible();
  await expect(page.getByText(/Le but\s: entourer plus de territoire que Pomme/)).toBeVisible();
  const box = (await plateau.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByText(/Tu joues |Pomme réfléchit|Pomme (joue|capture|passe)/)).toBeVisible();
});

test('le goban du premier lancement lance la même partie que le bouton', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('plateau-accueil').tap();
  await expect(page.getByText(/Le but\s: entourer plus de territoire que Pomme/)).toBeVisible();
});

for (const theme of THEMES) {
  test(`retour : « Aujourd'hui » met le Go du jour à faire en premier, puis la leçon une fois qu'il est fait (${nomTheme(theme)})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.clock.setFixedTime(MIDI);
    await semer(page, RETOUR);
    await page.goto('/');

    await expect(page.locator('.cta')).toHaveText('Rejouer contre Pomme');
    // Le niveau se montre dès qu'il y a de l'XP.
    await expect(page.getByTestId('barre-niveau')).toContainText(/40\s\/\s100\sXP/);
    const tuiles = page.locator('.tuiles .tuile');
    await expect(page.locator('.tuiles-titre')).toHaveText('Aujourd’hui');
    await expect(tuiles.first()).toHaveClass(/tuile-probleme/);
    await expect(tuiles.first()).toHaveClass(/tuile-avant/);
    await expect(tuiles.first().getByTestId('etat-du-jour')).toHaveText('À faire');
    await expect(tuiles.first().locator('.mini-goban')).toBeVisible();
    await expect(tuiles.nth(1)).toHaveClass(/tuile-lecon/);
    await expect(page.locator('.tuile-avant')).toHaveCount(1);
    await uneSeuleAction(page);
    await page.screenshot({ path: `${DOSSIER}/retour-go-du-jour-${nomTheme(theme)}.png` });

    // Go du jour fait aujourd'hui : la leçon suivante passe devant, le Go du jour reste, « Fait ».
    await page.evaluate(() => {
      localStorage.setItem('go.go-du-jour.v1', JSON.stringify({ dernier: 4, jours: 3 }));
      localStorage.setItem('go.go-du-jour.fait.v1', '4');
    });
    await page.reload();
    await expect(tuiles.first()).toHaveClass(/tuile-lecon/);
    await expect(tuiles.first()).toHaveClass(/tuile-avant/);
    await expect(tuiles.first()).toContainText('Leçon suivante');
    await expect(tuiles.nth(1).getByTestId('etat-du-jour')).toHaveText('Fait');
    await uneSeuleAction(page);
    await page.screenshot({ path: `${DOSSIER}/retour-lecon-${nomTheme(theme)}.png` });
  });
}

test('retour en 320 × 568 : le bouton principal reste au-dessus de la barre du bas', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.setFixedTime(MIDI);
  await semer(page, RETOUR);
  await page.goto('/');
  await expect(page.locator('.cta')).toHaveText('Rejouer contre Pomme');
  await uneSeuleAction(page);
  await page.screenshot({ path: `${DOSSIER}/retour-320-sombre.png` });
});

for (const theme of THEMES) {
  test(`placement : repères d'étape, puis le niveau expliqué avec une échelle de kyu (${nomTheme(theme)})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Je sais déjà jouer' }).click();
    await expect(page.getByText('Placement, 1 sur 3')).toBeVisible();
    await expect(page.locator('.placement-reperes i')).toHaveCount(3);
    await expect(page.locator('.placement-reperes i.fait')).toHaveCount(1);
    await page.screenshot({ path: `${DOSSIER}/placement-1-${nomTheme(theme)}.png` });
  });
}
