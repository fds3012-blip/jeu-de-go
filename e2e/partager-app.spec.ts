import { expect, test, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jouer, passerJusquAuScore, plateau } from './plateau';

// Issue #521 : partager l'app elle-même. Ligne « Partager Mochi Go » toujours dans le Profil (feuille native, sinon
// « Lien copié » annoncé au lecteur d'écran) ; invitation discrète après une victoire, une leçon finie ou un record,
// jamais pendant une partie, jamais avant la 2e partie finie ni dans la première minute, au plus une fois par semaine,
// toujours en action secondaire (une seule action en relief). Règle et mesure : src/app/partageApp.test.tsx.

const CAPTURES = process.env.CAPTURES_521; // dossier des captures (compte rendu de la PR)
const capture = async (page: Page, nom: string) => { if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/${nom}.png` }); };

type Fenetre = Window & { __partages: ShareData[] };

/** Feuille native simulée : chaque partage est noté ; `ferme` : le joueur ferme la feuille sans envoyer. */
async function feuilleNative(page: Page, ferme = false) {
  await page.addInitScript((f: boolean) => {
    const w = window as unknown as Fenetre;
    w.__partages = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (d: ShareData) => {
      w.__partages.push(d);
      if (f) throw new DOMException('fermée', 'AbortError');
    } });
  }, ferme);
}
const partages = (page: Page) => page.evaluate(() => (window as unknown as Fenetre).__partages);

/** La visite a commencé il y a plus d'une minute (la règle lit `performance.now()`). */
async function apresUneMinute(page: Page) {
  await page.addInitScript(() => {
    const vrai = performance.now.bind(performance);
    performance.now = () => vrai() + 90_000;
  });
}

/** Parties déjà finies sur l'appareil (posé une fois, avant le premier chargement). */
async function partiesFinies(page: Page, n: number) {
  await page.addInitScript((k: number) => {
    if (sessionStorage.getItem('pret-521')) return;
    sessionStorage.setItem('pret-521', '1');
    localStorage.setItem('go.parties.v1', JSON.stringify({ n: k, ordi: k, dernier: 'pomme' }));
    localStorage.setItem('go.intro-but.v1', 'true');
    localStorage.setItem('go.premiere-victoire.v1', '1');
  }, n);
}

const invitation = (page: Page) => page.getByTestId('inviter-app');
const ligne = (page: Page) => page.getByTestId('partager-app-profil');

test.use({ colorScheme: 'dark', reducedMotion: 'reduce' });

test.describe('Profil : « Partager Mochi Go », toujours là', () => {
  test('feuille native : titre, texte et lien ; rien ne change à l’écran', async ({ page }) => {
    await feuilleNative(page);
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
    await expect(ligne(page)).toBeVisible();
    await expect(ligne(page)).toHaveAccessibleName('Partager Mochi Go');
    await expect(ligne(page)).toHaveText('Partager');
    const b = (await ligne(page).boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.width).toBeGreaterThanOrEqual(44);
    // À droite du titre, sur la même ligne que « Aide » : aucune hauteur prise.
    const aide = (await page.getByRole('button', { name: 'Aide' }).boundingBox())!;
    expect(Math.abs(aide.y - b.y)).toBeLessThan(4);
    expect(b.x + b.width).toBeLessThanOrEqual(aide.x + 1);
    // Le Profil tient toujours sans défiler en 390 × 844, et le dernier lien reste au-dessus de la barre.
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(844);
    const conditions = (await page.getByRole('button', { name: 'Conditions et confidentialité' }).boundingBox())!;
    expect(conditions.y + conditions.height).toBeLessThanOrEqual((await page.getByRole('navigation').boundingBox())!.y);
    await capture(page, 'profil-ligne-sombre-390');

    await ligne(page).click();
    await expect.poll(() => partages(page)).toEqual([{
      title: 'Mochi Go', url: 'https://mochi-go.app',
      text: 'Je joue au go sur Mochi Go : c’est gratuit, sans pub, et on apprend en jouant, même débutant. Viens essayer !',
    }]);
    await expect(ligne(page)).toHaveText('Partager');
  });

  test('sans feuille native : « Lien copié » dans le bouton, annoncé au lecteur d’écran, texte et lien copiés', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(() => Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }));
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
    await ligne(page).click();
    await expect(ligne(page)).toContainText('Lien copié');
    await expect(page.locator('.profil [role="status"]').filter({ hasText: 'Lien copié. Colle-le dans un message.' })).toHaveCount(1);
    await expect(ligne(page)).toHaveAccessibleName('Partager Mochi Go');
    expect(await page.evaluate(() => navigator.clipboard.readText()))
      .toBe('Je joue au go sur Mochi Go : c’est gratuit, sans pub, et on apprend en jouant, même débutant. Viens essayer ! https://mochi-go.app');
    await capture(page, 'profil-lien-copie-clair-390');
    // La confirmation est courte : la ligne redevient elle-même.
    await expect(ligne(page)).toHaveText('Partager', { timeout: 4000 });
  });

  test('320 px : l’icône seule, le titre et « Aide » tiennent sur leur ligne, rien ne déborde', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
    await expect(ligne(page)).toHaveAccessibleName('Partager Mochi Go');
    const b = (await ligne(page).boundingBox())!;
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
    const titre = (await page.getByRole('heading', { name: 'Ton parcours' }).boundingBox())!;
    const aide = (await page.getByRole('button', { name: 'Aide' }).boundingBox())!;
    expect(Math.abs(titre.y + titre.height / 2 - (b.y + b.height / 2))).toBeLessThan(8);
    expect(b.x + b.width).toBeLessThanOrEqual(aide.x + 1);
    expect(aide.x + aide.width).toBeLessThanOrEqual(320);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await capture(page, 'profil-320-sombre');
  });

  test('en anglais : « Share Mochi Go », lien /en', async ({ page }) => {
    await feuilleNative(page);
    await page.goto('/?lang=en');
    await page.getByRole('navigation').getByRole('button', { name: 'Profile' }).click();
    await expect(ligne(page)).toHaveAccessibleName('Share Mochi Go');
    await expect(ligne(page)).toHaveText('Share');
    await ligne(page).click();
    await expect.poll(() => partages(page)).toEqual([{
      title: 'Mochi Go', url: 'https://mochi-go.app/en',
      text: 'I play go on Mochi Go: it’s free, no ads, and you learn by playing, even as a beginner. Come and try it!',
    }]);
    await capture(page, 'profil-ligne-en-sombre-390');
  });
});

test.describe('invitation après une victoire', () => {
  test('absente la première fois (1re partie finie), même passé la première minute', async ({ page }) => {
    await apresUneMinute(page);
    await page.goto('/?komi=-100');
    await page.locator('.cta').click();
    await expect(plateau(page)).toBeVisible();
    await passerJusquAuScore(page);
    await expect(page.getByRole('heading', { level: 2, name: 'Victoire' })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1500);
    await expect(invitation(page)).toHaveCount(0);
  });

  test('absente dans la première minute de la visite', async ({ page }) => {
    await partiesFinies(page, 2);
    await page.goto('/?komi=-100');
    await page.locator('.cta').click();
    await passerJusquAuScore(page);
    await expect(page.getByRole('heading', { level: 2, name: 'Victoire' })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1500);
    await expect(invitation(page)).toHaveCount(0);
  });

  for (const largeur of [390, 320] as const) {
    test(`3e partie gagnée : absente en pleine partie, puis discrète sous l’action principale (${largeur} px)`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: largeur === 320 ? 568 : 844 });
      await feuilleNative(page);
      await apresUneMinute(page);
      await partiesFinies(page, 2);
      await page.goto('/?komi=-100');
      await page.locator('.cta').click();
      await expect(plateau(page)).toBeVisible();
      await jouer(page, 'E5');
      // Pendant la partie : jamais.
      await expect(invitation(page)).toHaveCount(0);
      await passerJusquAuScore(page);
      await expect(page.getByRole('heading', { level: 2, name: 'Victoire' })).toBeVisible({ timeout: 15_000 });

      // Après la fête de l'XP, l'invitation arrive ; l'action principale ne change pas (une seule en relief).
      await expect(invitation(page)).toBeVisible({ timeout: 10_000 });
      await expect(invitation(page)).toHaveAttribute('data-depuis', 'victoire');
      await expect(invitation(page)).toContainText('Ça te plaît ? Fais découvrir le go à un ami.');
      await expect(page.locator('.cta, .btn.primary')).toHaveCount(1);
      await expect(page.locator('.cta')).toHaveAccessibleName(/^Défier Caillou/);
      await expect(invitation(page).locator('.cta, .btn.primary')).toHaveCount(0);
      const bouton = invitation(page).getByRole('button', { name: 'Partager Mochi Go' });
      const b = (await bouton.boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(44);
      if (largeur === 390) {
        const cta = (await page.locator('.cta').boundingBox())!;
        expect(cta.y + cta.height, 'action principale visible sans défiler').toBeLessThanOrEqual(844);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      await bouton.scrollIntoViewIfNeeded();
      await capture(page, `fin-victoire-invitation-sombre-${largeur}`);

      await bouton.click();
      await expect.poll(() => partages(page)).toHaveLength(1);
      expect((await partages(page))[0].url).toBe('https://mochi-go.app');
      // Repère du plafond posé : au plus une fois par semaine.
      const repere = await page.evaluate(() => Number(localStorage.getItem('go.invitation-app.v1')));
      expect(Date.now() - repere).toBeLessThan(60_000);
    });
  }

  test('plafond : déjà invitée cette semaine, plus rien après une nouvelle victoire', async ({ page }) => {
    await apresUneMinute(page);
    await partiesFinies(page, 4);
    await page.addInitScript(() => localStorage.setItem('go.invitation-app.v1', String(Date.now() - 2 * 24 * 3600 * 1000)));
    await page.goto('/?komi=-100');
    await page.locator('.cta').click();
    await passerJusquAuScore(page);
    await expect(page.getByRole('heading', { level: 2, name: 'Victoire' })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2500);
    await expect(invitation(page)).toHaveCount(0);
  });

  test('feuille native fermée sans envoyer : rien d’affiché, pas de copie', async ({ page }) => {
    await feuilleNative(page, true);
    await apresUneMinute(page);
    await partiesFinies(page, 2);
    await page.goto('/?komi=-100');
    await page.locator('.cta').click();
    await passerJusquAuScore(page);
    await expect(invitation(page)).toBeVisible({ timeout: 15_000 });
    await invitation(page).getByRole('button', { name: 'Partager Mochi Go' }).click();
    await expect.poll(() => partages(page)).toHaveLength(1);
    await expect(invitation(page)).not.toContainText('Lien copié');
    await expect(invitation(page).getByRole('alert')).toHaveCount(0);
  });
});

test('fin de leçon : invitation sous les actions, en clair', async ({ page }) => {
  await apresUneMinute(page);
  await partiesFinies(page, 2);
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('go.lecons.v1', JSON.stringify({ l1: 5 })));
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.getByRole('button', { name: /^Reprendre la leçon/ }).click();
  await jouer(page, 'E4');
  await page.getByRole('button', { name: 'Terminer la leçon' }).click();
  await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();
  await expect(invitation(page)).toBeVisible();
  await expect(invitation(page)).toHaveAttribute('data-depuis', 'lecon');
  await expect(page.locator('.cta, .btn.primary')).toHaveCount(1);
  // L'invitation vient après l'action principale et ses liens.
  const cta = (await page.locator('.fin-actions .cta').boundingBox())!;
  expect((await invitation(page).boundingBox())!.y).toBeGreaterThan(cta.y + cta.height);
  await invitation(page).scrollIntoViewIfNeeded();
  await capture(page, 'fin-lecon-invitation-clair-390');
});

// Bonne réponse de chaque problème, lue dans les sources (comme e2e/problemes-par-theme.spec.ts).
const CONTENU = fileURLToPath(new URL('../src/content', import.meta.url));
const sources = [join(CONTENU, 'puzzles.ts'), ...readdirSync(join(CONTENU, 'lots')).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts')).map(f => join(CONTENU, 'lots', f))];
const REPONSES = new Map(sources.flatMap(f => [...readFileSync(f, 'utf8').matchAll(/id: ?'([^']+)', size: ?(\d+), difficulty: ?\d+, answers: ?\[([^\]]+)\]/g)]
  .map(m => [m[1], { taille: Number(m[2]), coups: [...m[3].matchAll(/'([A-T]\d+)'/g)].map(x => x[1]) }] as const)));

test('record d’une série par thème : un bouton secondaire de plus dans la feuille de réussite, rien de recouvert', async ({ page }) => {
  await apresUneMinute(page);
  await partiesFinies(page, 2);
  await feuilleNative(page);
  // Record de 1 dans « Capturer », et 1 réussite d'affilée : la prochaine réussite bat le record.
  await page.addInitScript(() => localStorage.setItem('go.series-themes.v1', JSON.stringify({ capturer: { affilee: 1, record: 1 } })));
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  await page.getByRole('button', { name: /^Capturer/ }).click();
  const id = (await page.locator('.lecteur').getAttribute('data-probleme'))!;
  const r = REPONSES.get(id)!;
  await expect(plateau(page, r.taille)).toBeVisible();
  // Pendant l'exercice : rien.
  await expect(invitation(page)).toHaveCount(0);
  await jouer(page, r.coups[0], r.taille);
  await expect(page.locator('.lecteur .theme-affilee.record')).toBeVisible();
  const verdict = page.locator('.verdict');
  await expect(verdict.getByTestId('inviter-app')).toHaveAttribute('data-depuis', 'record');
  await expect(page.locator('.cta, .btn.primary')).toHaveCount(1);
  await expect(verdict.locator('.cta')).toHaveAccessibleName('Problème suivant');
  const bouton = verdict.getByRole('button', { name: 'Partager Mochi Go' });
  await expect(bouton).toBeInViewport({ ratio: 1 });
  expect((await bouton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await capture(page, 'record-theme-invitation-sombre-390');
  await bouton.click();
  await expect.poll(() => partages(page)).toHaveLength(1);
  // Problème suivant, encore réussi (record encore battu) : l'invitation ne revient pas (une fois par semaine).
  await verdict.getByRole('button', { name: 'Problème suivant' }).click();
  const id2 = (await page.locator('.lecteur').getAttribute('data-probleme'))!;
  const r2 = REPONSES.get(id2)!;
  await expect(plateau(page, r2.taille)).toBeVisible();
  await jouer(page, r2.coups[0], r2.taille);
  await expect(page.locator('.verdict')).toBeVisible();
  await expect(invitation(page)).toHaveCount(0);
});
