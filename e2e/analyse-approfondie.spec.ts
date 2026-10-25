import { expect, test, type Page } from '@playwright/test';

// C8 (#732) : « Analyse approfondie » (Profil › Réglages), réseau simulé. Le vrai fichier (11 Mo) n'est jamais servi :
// - jamais téléchargée sans le geste du joueur ;
// - un fichier qui n'a pas la bonne empreinte est refusé (rien n'est gardé, rien n'est activé) ;
// - annulation en cours de route ;
// - réseau déjà en cache : activer, désactiver, libérer la place, sans aucune requête.
const NOM = 'g170e-b10c128-s1141046784-d204142634';
const URL_RESEAU = `https://raw.githubusercontent.com/lightvector/KataGo/master/cpp/tests/models/${NOM}.bin.gz`;
const CLE = 'go.katago.approfondie.v1';
const DEJA_JOUE = { 'go.parties.v1': JSON.stringify({ n: 1, ordi: 1, dernier: 'pomme' }), 'go.intro-but.v1': 'true', 'go.premiere-pierre.v1': 'true' };

async function ouvrirReglages(page: Page) {
  await page.addInitScript(v => {
    if (sessionStorage.getItem('e2e.stocke')) return;
    sessionStorage.setItem('e2e.stocke', '1');
    for (const [k, x] of Object.entries(v)) localStorage.setItem(k, x);
  }, DEJA_JOUE);
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Profil' }).click();
  const titre = page.getByRole('heading', { name: 'L’IA sur ton téléphone' });
  await expect(titre.or(page.getByRole('button', { name: /^Réglages/ })).first()).toBeVisible();
  if (!(await titre.isVisible())) await page.getByRole('button', { name: /^Réglages/ }).click();
  await expect(page.getByTestId('reglage-approfondie')).toBeVisible();
}

const ligne = (page: Page) => page.getByTestId('reglage-approfondie');
const dansLeCache = (page: Page) => page.evaluate(async url => !!(await (await caches.open('katago-reseaux-v1')).match(url)), URL_RESEAU);
const reglage = (page: Page) => page.evaluate(c => localStorage.getItem(c), CLE);

test('jamais par défaut : taille et Wi-Fi annoncés, aucune requête vers le réseau', async ({ page }) => {
  const requetes: string[] = [];
  page.on('request', r => { if (r.url().includes('raw.githubusercontent.com')) requetes.push(r.url()); });
  await ouvrirReglages(page);
  await expect(ligne(page)).toHaveAttribute('data-etat', 'desactivee');
  await expect(ligne(page)).toContainText('Analyse approfondie');
  await expect(ligne(page)).toContainText('Plus précis sur la vie et la mort, mais plus lent.');
  await expect(ligne(page)).toContainText('11,1 Mo à télécharger, une seule fois. Mieux en Wi-Fi.');
  await expect(page.getByTestId('ap-activer')).toBeVisible();
  await page.waitForTimeout(500);
  expect(requetes).toEqual([]);
  expect(await reglage(page)).toBeNull();
  expect(await dansLeCache(page)).toBe(false);
});

test('un fichier qui n’a pas la bonne empreinte est refusé : rien d’activé ni gardé, l’analyse normale reste', async ({ page }) => {
  let demandes = 0;
  await page.route(URL_RESEAU, route => {
    demandes++;
    return route.fulfill({ status: 200, body: Buffer.alloc(200_000, 7), headers: { 'content-type': 'application/octet-stream', 'access-control-allow-origin': '*' } });
  });
  await ouvrirReglages(page);
  await page.getByTestId('ap-activer').click();
  await expect(ligne(page)).toContainText('Le téléchargement n’a pas abouti. L’analyse normale reste active.', { timeout: 30_000 });
  expect(demandes).toBeGreaterThan(0);
  await expect(ligne(page)).toHaveAttribute('data-etat', 'desactivee');
  await expect(page.getByTestId('ap-activer')).toHaveText('Réessayer');
  expect(await reglage(page)).toBeNull();
  expect(await dansLeCache(page)).toBe(false);
});

test('annulation pendant le téléchargement : retour à l’état de départ, rien de gardé', async ({ page }) => {
  let arret: () => void = () => {};
  const bloque = new Promise<void>(r => { arret = r; });
  await page.route(URL_RESEAU, async route => { await bloque; await route.abort().catch(() => {}); });
  await ouvrirReglages(page);
  await page.getByTestId('ap-activer').click();
  await expect(ligne(page)).toHaveAttribute('data-etat', 'telechargement');
  await expect(page.getByRole('progressbar', { name: 'Téléchargement de l’analyse approfondie' })).toBeVisible();
  await page.getByTestId('ap-annuler').click();
  await expect(ligne(page)).toHaveAttribute('data-etat', 'desactivee');
  await expect(ligne(page)).toContainText('Téléchargement annulé. Rien n’a été gardé.');
  expect(await reglage(page)).toBeNull();
  expect(await dansLeCache(page)).toBe(false);
  arret();
});

test('réseau déjà en cache : réactiver, désactiver, libérer la place, sans aucune requête', async ({ page }) => {
  const requetes: string[] = [];
  page.on('request', r => { if (r.url().includes('raw.githubusercontent.com')) requetes.push(r.url()); });
  await page.goto('/');
  await page.evaluate(async url => {
    await (await caches.open('katago-reseaux-v1')).put(url, new Response(new Uint8Array(4096), { headers: { 'content-type': 'application/octet-stream' } }));
  }, URL_RESEAU);
  await ouvrirReglages(page);
  await expect(ligne(page)).toHaveAttribute('data-etat', 'en-cache');
  await expect(ligne(page)).toContainText('Désactivée. Elle reste sur ton téléphone (11,1 Mo).');

  await page.getByTestId('ap-reactiver').click();
  await expect(ligne(page)).toHaveAttribute('data-etat', 'active');
  await expect(ligne(page)).toContainText('Activée. Elle marche aussi sans réseau.');
  expect(JSON.parse((await reglage(page))!)).toMatchObject({ actif: true });

  await page.getByTestId('ap-desactiver').click();
  await expect(ligne(page)).toHaveAttribute('data-etat', 'en-cache');
  expect(await reglage(page)).toBeNull();
  expect(await dansLeCache(page)).toBe(true);

  await page.getByTestId('ap-liberer').click();
  await expect(ligne(page)).toHaveAttribute('data-etat', 'desactivee');
  expect(await dansLeCache(page)).toBe(false);
  expect(requetes).toEqual([]);
});
