import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, jouer, jouerSuite, partieADeux } from './plateau';

// Issue #207 : corrections de la recette du 28/09 (docs/qa/recette-2026-09-28.md sur la branche recette-nuit).
// Chaque défaut est vérifié à la taille d'écran où il a été vu.

// Horloge figée le 27 septembre 2026 à midi, heure de Paris : Go du jour n° 1, le problème b1 (réponse E5).
const MIDI_PARIS = new Date('2026-09-27T12:00:00+02:00');
const nav = (page: Page) => page.getByRole('navigation', { name: 'Navigation principale' });

async function resoudreGoDuJour(page: Page) {
  await page.goto('/?go-du-jour=1');
  await jouer(page, 'E5');
  await attendrePierre(page, 'E5', 'noir');
}

/** Deux boîtes se chevauchent-elles ? */
function chevauche(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

for (const [largeur, hauteur] of [[375, 667], [320, 640], [320, 568]] as const) {
  test.describe(`R1, ${largeur} × ${hauteur}`, () => {
    test.use({ viewport: { width: largeur, height: hauteur } });
    test('le but et le komi de Mochi se lisent sans défiler, au-dessus de la barre d’actions', async ({ page }) => {
      await page.goto('/');
      await page.locator('.cta').click();
      const intro = page.locator('.coach-intro');
      await expect(intro).toContainText(/Le but\s: entourer plus de territoire que Pomme/);
      await expect(page.locator('.annonce-komi')).toContainText('Le komi, ce sont des points donnés à Blanc');
      const [bulle, barre] = await Promise.all([intro.boundingBox(), page.getByRole('toolbar', { name: 'Actions de la partie' }).boundingBox()]);
      expect(bulle!.y).toBeGreaterThanOrEqual(0);
      expect(bulle!.y + bulle!.height).toBeLessThanOrEqual(barre!.y + 1);
      expect(await page.evaluate(() => scrollY)).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur);
      // Le plateau reste jouable au-dessus de la bulle, et il ne bouge pas quand elle s'efface.
      const avant = (await page.locator('.partie-plateau').boundingBox())!.y;
      await jouer(page, 'E7');
      await expect(page.locator('ol.coups li:not(.vide)')).toHaveCount(1);
      await expect(intro).toHaveAttribute('data-cache', 'true');
      expect(Math.abs((await page.locator('.partie-plateau').boundingBox())!.y - avant)).toBeLessThanOrEqual(2);
    });
  });
}

test('R2 : pas de « +XP » pendant le récit du score, la pastille arrive avec le résultat', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await partieADeux(page);
  // 18 coups (plus de 10 : la partie rapporte de l'XP), puis deux passes et le comptage.
  for (let r = 1; r <= 9; r++) await jouerSuite(page, [`E${r}`, `F${r}`]);
  const passer = page.getByRole('button', { name: 'Passer' });
  await passer.click();
  await passer.click();
  await page.getByRole('button', { name: 'Valider le score' }).click({ timeout: 10_000 });
  await expect(page.locator('.recit')).toBeVisible();
  const pastille = page.getByTestId('pastille-xp');
  await expect(page.locator('.recit-resultat.vu')).toBeVisible({ timeout: 5000 });
  await expect(pastille).toHaveCount(0);
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Noir gagne' })).toBeVisible();
  await expect(pastille).toContainText(/\+\d+\sXP/);
});

test.describe('R3, R6 : 390 × 844', () => {
  test('R3 : la pastille XP se pose sous le titre du problème', async ({ page }) => {
    await page.clock.setFixedTime(MIDI_PARIS);
    await resoudreGoDuJour(page);
    const pastille = page.getByTestId('pastille-xp');
    await expect(pastille).toBeVisible();
    const [p, titre] = await Promise.all([pastille.boundingBox(), page.getByRole('heading', { level: 2, name: 'Capture la pierre' }).boundingBox()]);
    expect(chevauche(p!, titre!)).toBe(false);
    expect(p!.y).toBeGreaterThanOrEqual(titre!.y + titre!.height);
  });
});

test.describe('R3, R6 : 320 × 640', () => {
  test.use({ viewport: { width: 320, height: 640 } });
  test('R6 : la carte « Niveau 2 ! » se ferme au changement d’écran, le titre du chemin reste libre', async ({ page }) => {
    await page.clock.setFixedTime(MIDI_PARIS);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => { if (localStorage.getItem('go.xp.v1') === null) localStorage.setItem('go.xp.v1', '90'); });
    await resoudreGoDuJour(page); // 90 + 20 + 10 : niveau 2
    const fete = page.getByTestId('fete-niveau');
    await expect(fete).toContainText(/Niveau\s2/);
    await nav(page).getByRole('button', { name: 'Apprendre' }).click();
    // Bien avant les 3,2 s de la carte.
    await expect(fete).toHaveCount(0, { timeout: 1000 });
  });

  test('R3 en 320 px : la pastille ne couvre pas le titre', async ({ page }) => {
    await page.clock.setFixedTime(MIDI_PARIS);
    await resoudreGoDuJour(page);
    const pastille = page.getByTestId('pastille-xp');
    await expect(pastille).toBeVisible();
    const [p, titre] = await Promise.all([pastille.boundingBox(), page.getByRole('heading', { level: 2, name: 'Capture la pierre' }).boundingBox()]);
    expect(chevauche(p!, titre!)).toBe(false);
  });
});

test('R4 : toucher l’onglet Problèmes pendant un problème ramène à la liste, sans rouvrir le Go du jour', async ({ page }) => {
  await page.clock.setFixedTime(MIDI_PARIS);
  await page.goto('/?go-du-jour=1'); // arrivée par un lien partagé : le Go du jour s'ouvre
  await expect(page.getByRole('heading', { level: 2, name: 'Capture la pierre' })).toBeVisible();
  await nav(page).getByRole('button', { name: 'Problèmes' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Capture la pierre' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Go du jour/ }).first()).toBeVisible();
  // Un autre problème ouvert depuis la liste : même geste, même retour.
  await page.getByRole('button', { name: /Go du jour/ }).first().click();
  await expect(page.getByRole('heading', { level: 2, name: 'Capture la pierre' })).toBeVisible();
  await nav(page).getByRole('button', { name: 'Problèmes' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Capture la pierre' })).toHaveCount(0);
});

test.describe('R5 : 320 × 640', () => {
  test.use({ viewport: { width: 320, height: 640 } });
  test('la réplique de Pomme tient en entier, sans décaler le plateau', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.locator('.cta').click();
    const plateau = page.locator('.partie-plateau');
    await expect(plateau).toBeVisible();
    const avant = (await plateau.boundingBox())!.y;
    // Toutes les répliques possibles, posées dans la bulle de Pomme : entières, et le plateau ne bouge pas.
    const toutes = ['Oh ! Bien vu.', 'Aïe !', 'Bien joué !', 'Oups…', 'Ça chauffe !', 'Tu me serres.', 'Hop, prise !', 'Merci !', 'Je la prends !',
      'Déjà fini ?', 'On compte ?', 'Tu es sûr ?', 'Je passe.', 'Rien à jouer.', 'À toi de voir.'];
    const mesures = await page.locator('.joueur[data-joueur="Pomme"] .joueur-nom').evaluate((nom, ts) => {
      const bulle = document.createElement('span');
      bulle.className = 'replique';
      nom.appendChild(bulle);
      const r = ts.map(t => { bulle.textContent = t; return { t, coupe: bulle.scrollWidth > bulle.clientWidth + 1, y: document.querySelector('.partie-plateau')!.getBoundingClientRect().y }; });
      bulle.remove();
      return r;
    }, toutes);
    expect(mesures.filter(m => m.coupe).map(m => m.t)).toEqual([]);
    for (const m of mesures) expect(Math.abs(m.y - avant)).toBeLessThanOrEqual(1);
    // Et pour de vrai : tu passes, Pomme répond dans sa bulle, en entier. Chaque bulle est mesurée dès qu'elle paraît
    // (la partie peut finir juste après, sur deux passes).
    await page.evaluate(() => {
      const vues: { texte: string; coupe: boolean }[] = [];
      (window as unknown as { vues: typeof vues }).vues = vues;
      new MutationObserver(() => document.querySelectorAll<HTMLElement>('.replique').forEach(e => {
        if (!vues.some(v => v.texte === e.textContent)) vues.push({ texte: e.textContent ?? '', coupe: e.scrollWidth > e.clientWidth + 1 });
      })).observe(document.body, { childList: true, subtree: true });
    });
    await page.getByRole('button', { name: 'Passer' }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { vues: unknown[] }).vues.length)).toBeGreaterThan(0);
    expect(await page.evaluate(() => (window as unknown as { vues: { coupe: boolean }[] }).vues.filter(v => v.coupe))).toEqual([]);
  });
});

test('Vitrine : chaque condition de badge tient sur ses deux lignes', async ({ page }) => {
  await page.goto('/');
  await nav(page).getByRole('button', { name: 'Profil' }).click();
  const conditions = page.locator('.vitrine-rangee small');
  await expect(conditions).toHaveCount(7);
  await page.evaluate(() => document.fonts.ready);
  const coupees = await conditions.evaluateAll(els => els.filter(e => e.scrollHeight > e.clientHeight + 1).map(e => e.textContent));
  expect(coupees).toEqual([]);
  await expect(page.getByRole('listitem', { name: 'Pomme battue : à gagner. Gagne contre Pomme.' })).toBeVisible();
});
