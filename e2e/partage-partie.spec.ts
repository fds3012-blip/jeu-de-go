import { readFileSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { brancher, fauxServeur, JETON, type FauxServeur } from './fauxSupabase';
import { plateau } from './plateau';
import { fleches } from './partageFleches';
import { ouvrirRevue, preparerRevue } from './revueFactice';

// Issue #364 (« partager pour recruter ») : depuis le bilan, « Partager » ouvre une feuille : lien vers la revue en
// lecture seule (compte avec pseudo), image du moment clé, fichier SGF, défi par lien. L'ami ouvre le lien sans compte
// ni stockage : la bonne partie, au bon coup, puis une seule action. Supabase simulé (fauxSupabase.ts) ; partie fixe et
// KataGo factice (revueFactice.ts). Aperçus des liens courts : pages statiques (outils/apercus.ts).

const ANA = '00000000-0000-4000-8000-0000000000a1';

async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, stockage: Record<string, string>,
  o: { largeur?: number; hauteur?: number; sombre?: boolean; consentement?: boolean } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: o.largeur ?? 390, height: o.hauteur ?? 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
    colorScheme: o.sombre ? 'dark' : 'light', reducedMotion: 'reduce', acceptDownloads: true,
    storageState: { cookies: [], origins: o.consentement === false ? [] : [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
  });
  return { ctx, page: await brancher(ctx, serveur, stockage) };
}

/** Bilan de la partie gardée (contre Pomme), puis la feuille « Partager ». */
async function ouvrirFeuille(page: Page) {
  await preparerRevue(page);
  await ouvrirRevue(page);
  const partager = page.getByRole('button', { name: 'Partager', exact: true });
  await expect(partager).toBeVisible({ timeout: 90_000 });
  // Action secondaire : l'action principale du bilan reste seule en relief.
  await expect(partager).not.toHaveClass(/\bcta\b|primary/);
  await expect(page.locator('.revue-bilan .cta')).toHaveCount(1);
  expect((await partager.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await partager.click();
  const feuille = page.getByRole('dialog', { name: 'Partager ta partie' });
  await expect(feuille).toBeVisible();
  return feuille;
}

const copie = (page: Page) => page.evaluate(() => (window as unknown as { __copie?: string }).__copie ?? '');

test('lien de la revue : partagé depuis le bilan, ouvert par un ami sans compte au moment clé', async ({ browser, baseURL }) => {
  test.setTimeout(150_000);
  const serveur = fauxServeur();
  const erreurs: string[] = [];
  const a = await telephone(browser, baseURL, serveur, { 'sb-supabase-auth-token': JSON.stringify(serveur.sessionCompte('ana@exemple.test', 'Ana', ANA)) });
  a.page.on('pageerror', e => erreurs.push(e.message));
  const feuille = await ouvrirFeuille(a.page);
  for (const nom of [/^Envoyer le lien/, /^Image du moment clé/, /^Fichier SGF/, /^Défier un ami/]) {
    const b = feuille.getByRole('button', { name: nom });
    await expect(b).toBeVisible();
    expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }

  // Pas de feuille de partage native ici : le lien est copié.
  await feuille.getByRole('button', { name: /^Envoyer le lien/ }).click();
  await expect(feuille.getByText('Lien copié. Colle-le dans un message.')).toBeVisible();
  const texte = await copie(a.page);
  expect(texte).toMatch(/^Ma partie de go contre Pomme sur Mochi Go\. Revois-la avec moi : http:\/\/localhost:\d+\/partie#[A-Za-z0-9_-]{32}$/);
  // Côté serveur : la partie seule (ni « Toi », ni noms), le camp, l'adversaire et le moment clé.
  expect(serveur.partagees).toHaveLength(1);
  const p = serveur.partagees[0];
  expect(p.sgf).not.toMatch(/PB|PW|Toi/);
  expect(p).toMatchObject({ taille: 9, joueur: 1, adversaire: 'Pomme' });
  const coup = Number(p.coup);
  expect(coup).toBeGreaterThan(0);
  // Partager deux fois : le même lien.
  await feuille.getByRole('button', { name: /^Envoyer le lien/ }).click();
  await expect.poll(() => copie(a.page)).toBe(texte);
  expect(serveur.partagees).toHaveLength(1);

  // L'ami : aucun stockage, aucune réponse à la fenêtre de consentement. Le lien court ouvre la partie au moment clé.
  const lien = texte.slice(texte.indexOf('http'));
  const b = await telephone(browser, baseURL, serveur, {}, { consentement: false });
  b.page.on('pageerror', e => erreurs.push(e.message));
  await b.page.goto(lien.replace(baseURL!, ''));
  await expect(b.page.getByRole('heading', { level: 2, name: 'Partie de Ana' })).toBeVisible();
  expect(new URL(b.page.url()).hash).toBe(''); // le jeton ne reste pas dans l'adresse
  await expect(b.page.getByText('Moment clé')).toBeVisible();
  await expect(b.page.getByText(`Coup ${coup} sur 16`)).toBeVisible();
  await expect(b.page.locator('.partagee-camps')).toHaveText(/Ana.*Pomme/);
  await expect(b.page.getByText('Noir gagne de 1,5 point')).toBeVisible();
  // Partie sans prise : autant de pierres que de coups joués (passes exclues).
  await expect(plateau(b.page).locator('g[data-pierre]')).toHaveCount(Math.min(coup, 14));
  // #460 : à 390 × 844, les flèches se touchent sans défiler (sous le plateau, le bouton du bas les recouvrait), et leurs
  // chevrons sont tracés au trait (remplis de noir, ils disparaissaient en sombre).
  await fleches(b.page);
  await b.page.getByRole('button', { name: 'Coup suivant' }).click();
  await expect(b.page.getByText(`Coup ${coup + 1} sur 16`)).toBeVisible();
  // Aucune fenêtre avant son premier geste, une seule action en relief.
  await expect(b.page.getByRole('dialog')).toHaveCount(0);
  const cta = b.page.locator('.cta');
  await expect(cta).toHaveCount(1);
  await expect(cta).toHaveText('Joue ta première partie');
  expect((await cta.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await b.page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await cta.click();
  await expect(plateau(b.page)).toBeVisible();

  // Ana rend la partie privée : le lien ne montre plus rien.
  await feuille.getByRole('button', { name: 'Ne plus partager cette partie' }).click();
  await expect(feuille.getByText('Partie privée : le lien ne montre plus rien.')).toBeVisible();
  const c = await telephone(browser, baseURL, serveur, {});
  await c.page.goto(lien.replace(baseURL!, ''));
  await expect(c.page.getByText('Ce lien n’est plus partagé.')).toBeVisible();
  // #460 : l'état vide dit pourquoi, en une phrase.
  await expect(c.page.getByText('Son auteur l’a peut-être retiré, ou le lien est incomplet.')).toBeVisible();
  await expect(c.page.locator('.cta')).toHaveText('Découvrir Mochi Go');
  expect(erreurs).toEqual([]);
  await Promise.all([a.ctx.close(), b.ctx.close(), c.ctx.close()]);
});

test('déjà joueur : « Revois-la avec Mochi » ouvre la revue complète, sans « Partager »', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const serveur = fauxServeur();
  serveur.compteExistant('ana@exemple.test', 'Ana', ANA);
  serveur.partagees.push({ jeton: JETON, user_id: ANA, taille: 9, joueur: 2, adversaire: 'Bruno', coup: 3,
    sgf: '(;GM[1]FF[4]CA[UTF-8]SZ[9]KM[6.5]RU[Japanese]RE[W+R];B[ee];W[cc];B[gg];W[gc])' });
  const b = await telephone(browser, baseURL, serveur, { 'go.parties.v1': JSON.stringify({ n: 3 }) }, { sombre: true });
  await preparerRevue(b.page);
  await b.page.goto(`/en/partie#${JETON}`);
  await expect(b.page.getByRole('heading', { level: 2, name: 'Partie de Ana' })).toBeVisible();
  await expect(b.page.locator('.partagee-camps')).toHaveText(/Bruno.*Ana/);
  await expect(b.page.getByText('Coup 3 sur 4')).toBeVisible();
  const cta = b.page.locator('.cta');
  await expect(cta).toHaveText('Revois-la avec Mochi');
  await cta.click();
  await expect(b.page.getByRole('heading', { level: 2, name: 'Revoir ma partie' })).toBeVisible();
  await expect(b.page.getByRole('button', { name: 'Partager', exact: true })).toHaveCount(0);
  await b.ctx.close();
});

test('fichier SGF : téléchargé hors ligne, il se réimporte sans erreur', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const serveur = fauxServeur();
  const a = await telephone(browser, baseURL, serveur, {});
  const feuille = await ouvrirFeuille(a.page);
  // Sans compte : l'image et le fichier, pas de lien ; la feuille dit pourquoi.
  await expect(feuille.getByRole('button', { name: /^Envoyer le lien/ })).toHaveCount(0);
  await expect(feuille.getByText('Crée ton compte pour envoyer un lien ou défier un ami.')).toBeVisible();
  await a.ctx.setOffline(true);
  const [telechargement] = await Promise.all([a.page.waitForEvent('download'), feuille.getByRole('button', { name: /^Fichier SGF/ }).click()]);
  expect(telechargement.suggestedFilename()).toMatch(/^pomme-\d{4}-\d{2}-\d{2}\.sgf$/);
  const sgf = readFileSync((await telechargement.path())!, 'utf8');
  expect(sgf).toMatch(/^\(;GM\[1\]PB\[Noir\]PW\[Pomme\]FF\[4\]/);
  expect(sgf).toContain(';B[cg];W[gc]');
  await expect(feuille.getByText('Fichier enregistré.')).toBeVisible();
  await a.ctx.setOffline(false);

  await feuille.getByRole('button', { name: 'Fermer' }).click();
  await expect(feuille).toBeHidden();
  await a.ctx.close();

  // Réimport dans « Analyser une partie » (Profil › Mes parties), sur un appareil sans comptes configurés.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] } });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Profil' }).click();
  await page.getByRole('button', { name: /^Mes parties/ }).click();
  await page.getByRole('button', { name: /Analyser une partie/ }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: telechargement.suggestedFilename(), mimeType: 'application/x-go-sgf', buffer: Buffer.from(sgf, 'utf8') });
  await expect(page.getByRole('heading', { level: 2, name: 'Quelle couleur avais-tu ?' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText(/9 × 9 · 16 coups · komi 6,5/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Blanc\s*Pomme/ })).toBeVisible();
  await ctx.close();
});

test('image du moment clé : PNG 1200 × 630, téléchargée quand le partage de fichier manque', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const serveur = fauxServeur();
  const a = await telephone(browser, baseURL, serveur, {}, { largeur: 320, hauteur: 568, sombre: true });
  const feuille = await ouvrirFeuille(a.page);
  // 320 px, sombre : rien ne déborde, chaque choix garde 44 px.
  expect(await a.page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const [telechargement] = await Promise.all([a.page.waitForEvent('download'), feuille.getByRole('button', { name: /^Image du moment clé/ }).click()]);
  expect(telechargement.suggestedFilename()).toMatch(/^pomme-\d{4}-\d{2}-\d{2}\.png$/);
  const b = readFileSync((await telechargement.path())!);
  expect(b.subarray(1, 4).toString('ascii')).toBe('PNG');
  expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual([1200, 630]);
  await a.ctx.close();
});

test('défier un ami depuis le bilan : le lien court ouvre directement le défi chez l’ami', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const serveur = fauxServeur();
  const a = await telephone(browser, baseURL, serveur, { 'sb-supabase-auth-token': JSON.stringify(serveur.sessionCompte('ana@exemple.test', 'Ana', ANA)) });
  const feuille = await ouvrirFeuille(a.page);
  await feuille.getByRole('button', { name: /^Défier un ami/ }).click();
  await expect(feuille.getByText('Lien copié. Colle-le dans un message.')).toBeVisible();
  const texte = await copie(a.page);
  expect(texte).toContain(`${baseURL}/defi#${JETON}&de=Ana`);
  expect(serveur.appels).toContain('POST /rest/v1/rpc/creer_defi');
  const b = await telephone(browser, baseURL, serveur, {});
  await b.page.goto(`/defi#${JETON}&de=Ana`);
  await expect(b.page.getByRole('heading', { name: 'Ana te défie !' })).toBeVisible();
  expect(new URL(b.page.url()).hash).toBe('');
  await Promise.all([a.ctx.close(), b.ctx.close()]);
});

test('aperçus riches : chaque lien court a sa page et son image (sans serveur)', async ({ request }) => {
  const contenu = (html: string, cle: string) => new RegExp(`<meta\\s+(?:property|name)="${cle}"\\s+content="([^"]*)"`).exec(html)?.[1];
  for (const [chemin, titre, image] of [
    ['/defi', 'Un ami te défie au go', '/apercu-defi.png'],
    ['/en/defi', 'A friend challenges you to a game of go', '/apercu-defi-en.png'],
    ['/partie', 'Une partie de go à revoir', '/apercu-partie.png'],
    ['/j/2', 'Go du jour n° 2 : trouveras-tu le bon coup ?', '/apercu.png'],
    ['/en/j/2', 'Daily go #2: can you find the right move?', '/apercu-en.png'],
  ] as const) {
    const rep = await request.get(chemin);
    expect(rep.status(), chemin).toBe(200);
    const html = await rep.text();
    expect(contenu(html, 'og:title'), chemin).toBe(titre);
    expect(contenu(html, 'og:image'), chemin).toBe(`https://mochi-go.app${image}`);
    expect(contenu(html, 'twitter:card'), chemin).toBe('summary_large_image');
    const img = await request.get(image);
    expect(img.status(), image).toBe(200);
    expect(img.headers()['content-type']).toContain('image/png');
  }
});
