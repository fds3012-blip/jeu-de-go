import { expect, test, type Browser, type Page } from '@playwright/test';
import { brancher, fauxServeur, type FauxServeur } from './fauxSupabase';

// Issue #729 : « Inviter un ami ». Deux téléphones (deux contextes) et un faux serveur qui applique les règles de
// 20261026090000_invitations.sql : Alice partage son lien depuis Profil › Mes amis, Bruno l'ouvre, joue, et les deux
// reçoivent le goban Cerisier. Aucun accueil modifié : l'entrée n'existe que dans « Mes amis ».
// Captures : CAPTURES_729=docs/design/captures/invitation-729 npx playwright test e2e/invitation.spec.ts

const CAPTURES = process.env.CAPTURES_729;
const ALICE = '00000000-0000-4000-8000-0000000000a1';
const BRUNO = '00000000-0000-4000-8000-0000000000b2';
const PARTIE_12_COUPS = '(;GM[1]FF[4]CA[UTF-8]SZ[9]KM[6.5]RU[Japanese]RE[B+6.5]'
  + ';B[ee];W[cc];B[ec];W[ce];B[gc];W[cg];B[gg];W[ge];B[eg];W[eb];B[ga];W[ca])';
const MAINTENANT = new Date().toISOString();
const HISTORIQUE = JSON.stringify([{ id: MAINTENANT, date: MAINTENANT, sgf: PARTIE_12_COUPS, mode: 'ordi', taille: 9, joueur: 1, adversaire: 'pomme', resultat: 'B+6.5' }]);

async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, session: object | null, o: { sombre?: boolean; locale?: string } = {}, stockage: Record<string, string> = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: o.locale ?? 'fr-FR', baseURL,
    colorScheme: o.sombre ? 'dark' : 'light',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }, { name: 'go.connait-go.v1', value: '"sait"' }] }] },
  });
  const page = await brancher(ctx, serveur, { 'go.premiere-pierre.v1': 'true', ...(session ? { 'sb-supabase-auth-token': JSON.stringify(session) } : {}), ...stockage });
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  return { ctx, page, erreurs };
}

async function capture(page: Page, nom: string) {
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/${nom}.jpg`, type: 'jpeg', quality: 80, fullPage: true });
}

async function ouvrirAmis(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Profil', exact: true }).click();
  await page.getByRole('button', { name: /^Mes amis/ }).click();
  await expect(page.getByRole('heading', { name: /^Mes amis/ })).toBeVisible();
}

const lienCopie = (page: Page) => page.evaluate(() => (window as unknown as { __copie?: string }).__copie ?? '');
const gobanOuvert = async (page: Page, id: string) => {
  await page.getByRole('button', { name: 'Profil', exact: true }).click();
  await page.getByRole('button', { name: /^Réglages/ }).click();
  return page.locator(`[data-theme-goban="${id}"]`);
};

test('Alice partage son lien, Bruno l’ouvre et joue : les deux reçoivent le goban Cerisier', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const a = await telephone(browser, baseURL, serveur, serveur.sessionCompte('alice@exemple.test', 'Alice', ALICE));
  const b = await telephone(browser, baseURL, serveur, serveur.sessionCompte('bruno@exemple.test', 'Bruno', BRUNO), { sombre: true });

  // L'accueil ne propose rien : l'entrée est dans Profil › Mes amis, en bas, discrète.
  await a.page.goto('/');
  await expect(a.page.getByText('Inviter un ami')).toHaveCount(0);
  await ouvrirAmis(a.page);
  const entree = a.page.getByTestId('inviter-entree');
  await expect(entree).toBeVisible();
  expect((await entree.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(entree).toHaveAttribute('aria-expanded', 'false');
  await expect(a.page.getByTestId('invitation')).toHaveCount(0);

  // L'encart : une phrase, un seul bouton, aucun chiffre trompeur.
  await entree.click();
  const encart = a.page.getByTestId('invitation');
  await expect(encart.getByRole('heading', { name: 'Invite un ami' })).toBeVisible();
  await expect(a.page.getByTestId('invitation-progres')).toHaveText('Aucun ami n’est encore arrivé.');
  await expect(encart.getByRole('button')).toHaveCount(1);
  await expect(a.page.locator('.btn.primary')).toHaveCount(1); // « Ajouter » reste l'action principale de l'écran
  await capture(a.page, 'invitation-encart-390-clair');
  await encart.getByRole('button', { name: 'Partager mon lien' }).click();
  await expect(encart.getByRole('button', { name: 'Lien copié' })).toBeVisible();
  const lien = await lienCopie(a.page);
  const m = /(https:\/\/mochi-go\.app)(\/i)#([A-Za-z0-9_-]{32})(?:\s|$)/.exec(lien);
  expect(m, lien).not.toBeNull();
  const adresse = `${m![2]}#${m![3]}`;

  // Bruno ouvre le lien : l'accueil s'ouvre, l'adresse redevient `/`, le code reste sur l'appareil, rien n'est donné.
  await b.page.goto(adresse);
  await expect(b.page).toHaveURL(/\/$/);
  expect(await b.page.evaluate(() => location.hash + location.search)).toBe('');
  expect(await b.page.evaluate(() => document.documentElement.hasAttribute('data-invitation'))).toBe(true);
  expect(JSON.parse(await b.page.evaluate(() => localStorage.getItem('go.invitation.v1') ?? 'null')).c).toBe(m![3]);
  await expect(b.page.getByRole('button', { name: 'Profil', exact: true })).toBeVisible();
  // Sans partie jouée, le serveur répond « en attente » : le code est gardé, aucun cadeau.
  await expect.poll(() => serveur.appels.filter(x => x.endsWith('/rpc/valider_invitation')).length, { timeout: 15_000 }).toBeGreaterThan(0).catch(() => undefined);
  expect(serveur.invitations).toHaveLength(0);
  expect(await b.page.evaluate(() => localStorage.getItem('go.cadeaux.v1'))).toBeNull();

  // Bruno joue sa première vraie partie (12 coups) : elle part sur son compte, le serveur valide.
  await b.page.evaluate(h => localStorage.setItem('go.historique.v1', h), HISTORIQUE);
  await b.page.reload();
  await expect.poll(() => serveur.invitations.length, { timeout: 20_000 }).toBe(1);
  await expect.poll(() => b.page.evaluate(() => localStorage.getItem('go.invitation.v1'))).toBeNull();
  await expect.poll(() => b.page.evaluate(() => localStorage.getItem('go.cadeaux.v1'))).toContain('cerisier');
  expect(JSON.parse(await b.page.evaluate(() => localStorage.getItem('go.badges.v1') ?? '[]'))).toContain('invite');
  const cerisierBruno = await gobanOuvert(b.page, 'cerisier');
  await expect(cerisierBruno).not.toHaveAttribute('aria-disabled', 'true');
  await capture(b.page, 'invitation-cadeau-invite-390-sombre');

  // Alice : un ami est arrivé (sans savoir qui), le Cerisier est à elle.
  await a.page.reload();
  await ouvrirAmis(a.page);
  await a.page.getByTestId('inviter-entree').click();
  await expect(a.page.getByTestId('invitation-progres')).toHaveText('1 ami sur 5 est arrivé.');
  await expect(a.page.getByTestId('invitation').locator('[data-cadeau="cerisier"]')).toBeVisible();
  await expect(a.page.getByTestId('invitation')).not.toContainText('Bruno');
  await capture(a.page, 'invitation-parrain-390-clair');
  const cerisierAlice = await gobanOuvert(a.page, 'cerisier');
  await expect(cerisierAlice).not.toHaveAttribute('aria-disabled', 'true');
  expect(JSON.parse(await a.page.evaluate(() => localStorage.getItem('go.badges.v1') ?? '[]'))).toContain('parrain');

  // Une seule récompense : un second passage ne change rien.
  await b.page.reload();
  await new Promise(r => setTimeout(r, 2500));
  expect(serveur.invitations).toHaveLength(1);
  expect(a.erreurs).toEqual([]);
  expect(b.erreurs).toEqual([]);
  await a.ctx.close(); await b.ctx.close();
});

test('sans compte : le lien garde son code, n’appelle pas le serveur, et ne montre rien de plus', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const code = 'abcdefghijklmnopqrstuvwxyzABCD_-';
  const c = await telephone(browser, baseURL, serveur, null, { locale: 'en-GB' });
  await c.page.goto(`/en/i#${code}`);
  await expect(c.page).toHaveURL(/\/$/);
  expect(await c.page.evaluate(() => location.hash)).toBe('');
  expect(JSON.parse(await c.page.evaluate(() => localStorage.getItem('go.invitation.v1') ?? 'null')).c).toBe(code);
  await expect(c.page.getByText('Inviter un ami')).toHaveCount(0);
  await expect(c.page.getByText('Invite a friend')).toHaveCount(0);
  await new Promise(r => setTimeout(r, 2500));
  expect(serveur.appels.some(x => x.includes('invitation'))).toBe(false);
  // Le premier lien reçu gagne : un second lien ne remplace pas le premier.
  await c.page.goto('/i#ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ');
  expect(JSON.parse(await c.page.evaluate(() => localStorage.getItem('go.invitation.v1') ?? 'null')).c).toBe(code);
  expect(c.erreurs).toEqual([]);
  await c.ctx.close();
});

test('un lien abîmé ouvre quand même l’accueil, sans rien garder', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const d = await telephone(browser, baseURL, serveur, null);
  await d.page.goto('/i#court');
  await expect(d.page).toHaveURL(/\/$/);
  expect(await d.page.evaluate(() => localStorage.getItem('go.invitation.v1'))).toBeNull();
  expect(await d.page.evaluate(() => document.documentElement.hasAttribute('data-invitation'))).toBe(false);
  await expect(d.page.getByRole('button', { name: 'Profil', exact: true })).toBeVisible();
  await d.ctx.close();
});

test('en anglais, l’encart et le lien sont en anglais , avec le lien en /en/i', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const e = await telephone(browser, baseURL, serveur, serveur.sessionCompte('alice@exemple.test', 'Alice', ALICE), { locale: 'en-GB', sombre: true });
  await e.page.goto('/');
  await e.page.getByRole('button', { name: 'Profile', exact: true }).click();
  await e.page.getByRole('button', { name: /^My friends/ }).click();
  await e.page.getByTestId('inviter-entree').click();
  await expect(e.page.getByRole('heading', { name: 'Invite a friend' })).toBeVisible();
  await e.page.getByRole('button', { name: 'Share my link' }).click();
  expect(await lienCopie(e.page)).toMatch(/https:\/\/mochi-go\.app\/en\/i#[A-Za-z0-9_-]{32}/);
  await capture(e.page, 'invitation-encart-390-sombre-en');
  await e.ctx.close();
});
