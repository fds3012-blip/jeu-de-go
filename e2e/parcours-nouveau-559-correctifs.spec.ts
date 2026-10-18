import { expect, test, type Page } from '@playwright/test';
import { jouer, passerJusquAuScore, plateau, toucher, toucherCta } from './plateau';

// #559 : correctifs du parcours du nouveau joueur (docs/qa/parcours-nouveau-2026-10.md), un test par défaut corrigé.
// Le bug « Rejouer » et la fête de niveau a son propre fichier : e2e/rejouer-fete-559.spec.ts.

/** Nombre de lignes du texte d'un élément (boîtes de ses caractères, groupées par bas de ligne). */
const lignes = (page: Page, sel: string) => page.locator(sel).first().evaluate(el => {
  const r = document.createRange(); r.selectNodeContents(el);
  return new Set([...r.getClientRects()].filter(b => b.width > 1).map(b => Math.round(b.bottom))).size;
});

/** Boîte d'un élément et haut de la barre de navigation, après l'avoir amené dans l'écran. */
async function sousLaBarre(page: Page, sel: string) {
  return page.locator(sel).first().evaluate((el: HTMLElement) => {
    el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    // #646 : la leçon est en plein écran ; sans barre, la limite est le bas de l'écran.
    const b = el.getBoundingClientRect(); const n = document.querySelector('nav'); const nav = { top: n ? n.getBoundingClientRect().top : innerHeight };
    const d = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return { bas: Math.round(b.bottom), haut: Math.round(b.top), nav: Math.round(nav.top), libre: !!d && el.contains(d) };
  });
}

for (const [largeur, hauteur] of [[390, 844], [320, 568]] as const) {
  test(`P-1 : revue sans KataGo, « 100 % » de précision tient sur une ligne (${largeur} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: hauteur });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Partie courte gagnée (paramètre de test ?komi=-100) : sans KataGo, Mochi note 100 % au joueur.
    await page.goto('/?komi=-100');
    await toucherCta(page);
    await expect(plateau(page)).toBeVisible();
    const passer = page.getByRole('button', { name: 'Passer' });
    await expect(passer).toBeEnabled({ timeout: 10_000 });
    await jouer(page, 'E5');
    await expect(passer).toBeEnabled({ timeout: 10_000 });
    await passerJusquAuScore(page);
    await page.getByRole('button', { name: 'Revoir la partie' }).click();
    const moi = page.locator('.bilan-score-moi');
    await expect(moi).toHaveText(/100\s%/, { timeout: 60_000 });
    expect(await lignes(page, '.bilan-score-moi'), '« 100 % » sur deux lignes').toBe(1);
    const b = (await moi.boundingBox())!;
    expect(b.height).toBeLessThan(56);
  });
}

test('P-2 : 320 × 568, leçon 1 : « Revoir » visible sans défiler (#646 : plus de barre du bas), « Continuer » aussi', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.getByRole('button', { name: 'Commencer' }).click();
  await jouer(page, 'E5');
  const cta = page.getByRole('button', { name: 'Continuer' });
  await expect(cta).toBeVisible();
  // L'action principale, entière au-dessus de la barre, sans défiler.
  const c = await cta.evaluate(el => { const b = el.getBoundingClientRect(); return { bas: Math.round(b.bottom), nav: Math.round(document.querySelector('nav')?.getBoundingClientRect().top ?? innerHeight), scroll: window.scrollY }; });
  expect(c.scroll).toBe(0);
  expect(c.bas).toBeLessThanOrEqual(c.nav + 1);
  // « Revoir » : entier au-dessus de la barre (après l'avoir fait défiler s'il le faut), et touchable en son centre.
  const r = await sousLaBarre(page, '.lecon-actions .revoir');
  expect(r.bas, `Revoir (${r.haut}–${r.bas}) sous la barre (${r.nav})`).toBeLessThanOrEqual(r.nav + 1);
  expect(r.libre).toBe(true);
  expect(r.bas - r.haut).toBeGreaterThanOrEqual(44);
});

test('P-2 bis : 320 × 568, règles en 8 gestes : « Revoir » visible sans défiler', async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] } });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Jamais joué' }).click();
  await expect(plateau(page, 7)).toBeVisible();
  await toucher(page, 'D4', 7); await toucher(page, 'D4', 7);
  await expect(page.locator('.lecon-actions').getByRole('button', { name: 'Continuer' })).toBeVisible();
  const r = await sousLaBarre(page, '.lecon-actions .revoir');
  expect(r.bas, `Revoir (${r.haut}–${r.bas}) sous la barre (${r.nav})`).toBeLessThanOrEqual(r.nav + 1);
  expect(r.libre).toBe(true);
  await ctx.close();
});
