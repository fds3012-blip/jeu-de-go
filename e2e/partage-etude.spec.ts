import { readFileSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { brancher, fauxServeur, JETON, type FauxServeur } from './fauxSupabase';
import { jouer, plateau } from './plateau';

// Issue #449 : partager une étude (goban libre de #372) avec la feuille de partage de #364. Le lien
// (`/partie#JETON`, même aperçu) ouvre chez l'ami, sans compte, la position et sa variante ; une seule action
// principale, « Étudie-la avec Mochi », ouvre une copie dans son écran d'étude. Supabase simulé (fauxSupabase.ts).

const ANA = '00000000-0000-4000-8000-0000000000a1';
const nav = (page: Page, nom: string) => page.getByRole('navigation').getByRole('button', { name: nom }).click();

async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, stockage: Record<string, string>,
  o: { largeur?: number; hauteur?: number; sombre?: boolean; consentement?: boolean; anglais?: boolean } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: o.largeur ?? 390, height: o.hauteur ?? 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    locale: o.anglais ? 'en-US' : 'fr-FR', baseURL, colorScheme: o.sombre ? 'dark' : 'light', reducedMotion: 'reduce', acceptDownloads: true,
    storageState: { cookies: [], origins: o.consentement === false ? [] : [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
  });
  return { ctx, page: await brancher(ctx, serveur, stockage) };
}

async function ouvrirEtude(page: Page) {
  await page.goto('/');
  await nav(page, 'Profil');
  await page.getByRole('button', { name: /^Mes parties/ }).click();
  await page.getByTestId('lien-etude').click();
  await expect(page.getByRole('heading', { name: 'Étudier une position' })).toBeVisible();
}

/** Trois pierres noires, deux blanches, puis une variante de deux coups (D5, F4). */
async function poserEtude(page: Page) {
  const outils = page.getByRole('group', { name: 'Outil' });
  for (const l of ['C3', 'G7', 'C7']) await jouer(page, l);
  await outils.getByRole('button', { name: 'Blanc' }).click();
  for (const l of ['G3', 'E5']) await jouer(page, l);
  await outils.getByRole('button', { name: 'Jouer' }).click();
  await jouer(page, 'D5');
  await jouer(page, 'F4');
  await expect(plateau(page).locator('[data-numero]')).toHaveCount(2);
}

const copie = (page: Page) => page.evaluate(() => (window as unknown as { __copie?: string }).__copie ?? '');

async function sansDefilementHorizontal(page: Page) {
  const m = await page.evaluate(() => {
    const d = document.documentElement, l = d.clientWidth;
    // Éléments dont le bord droit dépasse la page : dit quoi corriger quand le test échoue.
    const fautifs = [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > l + 0.5)
      .slice(-4).map(e => `${e.tagName.toLowerCase()}.${String(e.className).split(' ').join('.')} (${Math.round(e.getBoundingClientRect().right)} > ${l})`);
    return { debord: d.scrollWidth - l, fautifs };
  });
  expect(m.debord, `défilement horizontal : ${m.fautifs.join(' ; ')}`).toBeLessThanOrEqual(0);
}

test('partager une étude → l’ami ouvre le lien sans compte → « Étudie-la avec Mochi » ouvre sa copie', async ({ browser, baseURL }) => {
  test.setTimeout(150_000);
  const serveur = fauxServeur();
  const erreurs: string[] = [];
  const a = await telephone(browser, baseURL, serveur, { 'sb-supabase-auth-token': JSON.stringify(serveur.sessionCompte('ana@exemple.test', 'Ana', ANA)) });
  a.page.on('pageerror', e => erreurs.push(e.message));
  await ouvrirEtude(a.page);
  // Goban vide : rien à partager.
  await expect(a.page.getByTestId('etude-partager')).toBeDisabled();
  await poserEtude(a.page);

  // « Partager » : action secondaire ; « Analyser » reste la seule action en relief.
  const partager = a.page.getByTestId('etude-partager');
  await expect(partager).not.toHaveClass(/\bcta\b/);
  await expect(a.page.locator('.cta')).toHaveCount(1);
  expect((await partager.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await partager.click();
  const feuille = a.page.getByRole('dialog', { name: 'Partager ton étude' });
  await expect(feuille).toBeVisible();
  for (const nom of [/^Envoyer le lien/, /^Image de la position/, /^Fichier SGF/]) {
    const b = feuille.getByRole('button', { name: nom });
    await expect(b).toBeVisible();
    expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  // Pas de défi depuis une étude.
  await expect(feuille.getByRole('button', { name: /^Défier un ami/ })).toHaveCount(0);

  await feuille.getByRole('button', { name: /^Envoyer le lien/ }).click();
  await expect(feuille.getByText('Lien copié. Colle-le dans un message.')).toBeVisible();
  const texte = await copie(a.page);
  expect(texte).toMatch(/^Une position de go à étudier sur Mochi Go\. Regarde-la avec moi : http:\/\/localhost:\d+\/partie#[A-Za-z0-9_-]{32}$/);
  // Côté serveur : une étude, sans nom ni camp ; position (AB, AW), trait, variante.
  expect(serveur.partagees).toHaveLength(1);
  const p = serveur.partagees[0];
  expect(p).toMatchObject({ objet: 'etude', taille: 9, joueur: null, adversaire: null, coup: 2 });
  expect(p.sgf).toMatch(/AB\[[a-s]{2}\]\[[a-s]{2}\]\[[a-s]{2}\]AW\[[a-s]{2}\]\[[a-s]{2}\]PL\[B\];B\[de\];W\[ff\]\)$/);
  expect(p.sgf).not.toMatch(/PB|PW|RE\[/);
  // Partager deux fois : le même lien.
  await feuille.getByRole('button', { name: /^Envoyer le lien/ }).click();
  await expect.poll(() => copie(a.page)).toBe(texte);
  expect(serveur.partagees).toHaveLength(1);

  // L'ami : aucun stockage ni consentement. La position et la variante, la fin de la variante d'abord.
  const lien = texte.slice(texte.indexOf('http'));
  const b = await telephone(browser, baseURL, serveur, {}, { consentement: false });
  b.page.on('pageerror', e => erreurs.push(e.message));
  await b.page.goto(lien.replace(baseURL!, ''));
  await expect(b.page.getByRole('heading', { level: 2, name: 'Étude de Ana' })).toBeVisible();
  expect(new URL(b.page.url()).hash).toBe('');
  await expect(b.page.getByText('Variante : coup 2 sur 2')).toBeVisible();
  await expect(b.page.getByText('Au trait : Noir')).toBeVisible();
  const svg = plateau(b.page);
  await expect(svg.locator('[data-pierre]')).toHaveCount(7);
  await expect(svg.locator('[data-numero]')).toHaveCount(2);
  await b.page.getByRole('button', { name: 'Coup précédent' }).click();
  await expect(b.page.getByText('Variante : coup 1 sur 2')).toBeVisible();
  await expect(svg.locator('[data-pierre]')).toHaveCount(6);
  await b.page.getByRole('button', { name: 'Coup précédent' }).click();
  await expect(b.page.getByText('Position de départ')).toBeVisible();
  await expect(svg.locator('[data-numero]')).toHaveCount(0);
  // Aucune fenêtre avant son premier geste ; une seule action en relief.
  await expect(b.page.getByRole('dialog')).toHaveCount(0);
  const cta = b.page.locator('.cta');
  await expect(cta).toHaveCount(1);
  await expect(cta).toHaveText('Étudie-la avec Mochi');
  expect((await cta.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await sansDefilementHorizontal(b.page);
  await cta.click();

  // La copie, dans son écran d'étude : même position, même variante, gardée sur son appareil.
  await expect(b.page.getByRole('heading', { name: 'Étudier une position' })).toBeVisible();
  await expect(b.page.getByTestId('etude-consigne')).toHaveText('Copie de l’étude de Ana. Touche « Analyser ».');
  const goban = plateau(b.page);
  await expect(goban.locator('[data-pierre]')).toHaveCount(7);
  await expect(goban.locator('[data-numero]')).toHaveCount(2);
  for (const [l, c] of [['C3', 'noir'], ['G7', 'noir'], ['C7', 'noir'], ['G3', 'blanc'], ['E5', 'blanc'], ['D5', 'noir'], ['F4', 'blanc']]) {
    await expect(goban.locator(`[data-point="${l}"][data-pierre="${c}"]`)).toHaveCount(1);
  }
  await expect(b.page.locator('.cta')).toHaveText('Analyser');
  await expect.poll(() => b.page.evaluate(() => localStorage.getItem('go.etude.v1') ?? '')).toContain(';B[de];W[ff]');
  // Revenir : la position posée par Ana, intacte.
  await b.page.getByRole('button', { name: 'Revenir' }).click();
  await expect(goban.locator('[data-pierre]')).toHaveCount(5);

  // Ana rend l'étude privée : le lien ne montre plus rien.
  await feuille.getByRole('button', { name: 'Ne plus partager cette étude' }).click();
  await expect(feuille.getByText('Étude privée : le lien ne montre plus rien.')).toBeVisible();
  const c = await telephone(browser, baseURL, serveur, {});
  await c.page.goto(lien.replace(baseURL!, ''));
  // Ligne retirée : rien ne dit plus si c'était une partie ou une étude ; texte neutre.
  await expect(c.page.getByText('Ce lien n’est plus partagé.')).toBeVisible();
  await expect(c.page.locator('.cta')).toHaveText('Découvrir Mochi Go');
  expect(erreurs).toEqual([]);
  await Promise.all([a.ctx.close(), b.ctx.close(), c.ctx.close()]);
});

test('déjà une étude sur l’appareil : la copie s’ouvre, l’étude d’avant revient avec « Annuler » (anglais, sombre, 320 px)', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const serveur = fauxServeur();
  serveur.compteExistant('ana@exemple.test', 'Ana', ANA);
  serveur.partagees.push({ jeton: JETON, user_id: ANA, taille: 9, joueur: null, adversaire: null, coup: 1, objet: 'etude',
    sgf: '(;GM[1]FF[4]CA[UTF-8]SZ[9]KM[6.5]RU[Japanese]AB[cc][gg]AW[ee]PL[W];W[dd])' });
  const avant = '(;GM[1]FF[4]CA[UTF-8]SZ[9]KM[6.5]RU[Japanese]AB[aa][ab]PL[B])';
  const b = await telephone(browser, baseURL, serveur, { 'go.etude.v1': JSON.stringify({ sgf: avant }), 'go.parties.v1': JSON.stringify({ n: 2 }) },
    { largeur: 320, hauteur: 640, sombre: true, anglais: true });
  await b.page.goto(`/en/partie#${JETON}`);
  await expect(b.page.getByRole('heading', { level: 2, name: 'Ana’s study' })).toBeVisible();
  await expect(b.page.getByText('Line: move 1 of 1')).toBeVisible();
  await expect(b.page.getByText('To play: Black')).toBeVisible();
  await sansDefilementHorizontal(b.page);
  const cta = b.page.locator('.cta');
  await expect(cta).toHaveCount(1);
  await expect(cta).toHaveText('Study it with Mochi');
  await cta.click();
  await expect(b.page.getByTestId('etude-consigne')).toHaveText('Copy of Ana’s study. Tap “Analyze”. Your previous study comes back with “Undo”.');
  const goban = plateau(b.page);
  await expect(goban.locator('[data-pierre]')).toHaveCount(4);
  await sansDefilementHorizontal(b.page);
  await b.page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(goban.locator('[data-pierre]')).toHaveCount(2);
  await expect(goban.locator('[data-point="A9"][data-pierre="noir"]')).toHaveCount(1);
  await b.ctx.close();
});

test('sans compte : image et fichier SGF de l’étude, pas de lien ; zoom 200 % sans débord', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const serveur = fauxServeur();
  const a = await telephone(browser, baseURL, serveur, {}, { largeur: 195, hauteur: 422 });
  // Polices web bloquées : la police de repli de la CI (plus large) ne doit rien faire déborder.
  await a.page.route(/\.woff2?$/, r => r.abort());
  await ouvrirEtude(a.page);
  await poserEtude(a.page);
  await a.page.getByTestId('etude-partager').click();
  const feuille = a.page.getByRole('dialog', { name: 'Partager ton étude' });
  await expect(feuille).toBeVisible();
  await sansDefilementHorizontal(a.page);
  await expect(feuille.getByRole('button', { name: /^Envoyer le lien/ })).toHaveCount(0);
  await expect(feuille.getByText('Crée ton compte pour envoyer un lien.')).toBeVisible();
  const [sgf] = await Promise.all([a.page.waitForEvent('download'), feuille.getByRole('button', { name: /^Fichier SGF/ }).click()]);
  expect(sgf.suggestedFilename()).toMatch(/^etude-\d{4}-\d{2}-\d{2}\.sgf$/);
  const texte = readFileSync((await sgf.path())!, 'utf8');
  expect(texte).toMatch(/^\(;GM\[1\]FF\[4\]CA\[UTF-8\]SZ\[9\]KM\[6\.5\]RU\[Japanese\]AB/);
  expect(texte).toContain(';B[de];W[ff])');
  expect(texte).not.toMatch(/PB|PW/);
  const [image] = await Promise.all([a.page.waitForEvent('download'), feuille.getByRole('button', { name: /^Image de la position/ }).click()]);
  expect(image.suggestedFilename()).toMatch(/^etude-\d{4}-\d{2}-\d{2}\.png$/);
  const png = readFileSync((await image.path())!);
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  expect(serveur.partagees).toHaveLength(0);
  await a.ctx.close();
});

// Captures 390 × 844, clair et sombre, pour la relecture visuelle (CAPTURES_ETUDE=<dossier>) ; sautée sinon.
const CAPTURES = process.env.CAPTURES_ETUDE;
test('captures de relecture : feuille, vue de l’ami, copie ouverte', async ({ browser, baseURL }) => {
  test.skip(!CAPTURES, 'CAPTURES_ETUDE non défini');
  test.setTimeout(240_000);
  for (const sombre of [false, true]) {
    const serveur = fauxServeur();
    const suffixe = sombre ? 'sombre' : 'clair';
    const a = await telephone(browser, baseURL, serveur, { 'sb-supabase-auth-token': JSON.stringify(serveur.sessionCompte('ana@exemple.test', 'Ana', ANA)) }, { sombre });
    await ouvrirEtude(a.page);
    await poserEtude(a.page);
    await a.page.screenshot({ path: `${CAPTURES}/etude-${suffixe}.png` });
    await a.page.getByTestId('etude-partager').click();
    const feuille = a.page.getByRole('dialog', { name: 'Partager ton étude' });
    await feuille.getByRole('button', { name: /^Envoyer le lien/ }).click();
    await expect(feuille.getByText('Lien copié. Colle-le dans un message.')).toBeVisible();
    await a.page.screenshot({ path: `${CAPTURES}/feuille-${suffixe}.png` });
    const texte = await copie(a.page);
    const b = await telephone(browser, baseURL, serveur, {}, { consentement: false, sombre });
    await b.page.goto(texte.slice(texte.indexOf('http')).replace(baseURL!, ''));
    await expect(b.page.getByRole('heading', { level: 2, name: 'Étude de Ana' })).toBeVisible();
    await b.page.screenshot({ path: `${CAPTURES}/ami-${suffixe}.png` });
    await b.page.locator('.cta').click();
    await expect(b.page.getByRole('heading', { name: 'Étudier une position' })).toBeVisible();
    await b.page.screenshot({ path: `${CAPTURES}/copie-${suffixe}.png` });
    await Promise.all([a.ctx.close(), b.ctx.close()]);
  }
});
