import { expect, test, type Browser } from '@playwright/test';
import { brancher, fauxServeur, type FauxServeur } from './fauxSupabase';

// Issue #561 : titres mensuels. Le serveur (tâche pg_cron du 1er du mois) écrit le titre ; le faux Supabase le sème.
// À l'ouverture, une fête discrète une seule fois ; au Profil, la ligne « Titre du mois dernier » et son sceau.
// Sans titre (garde-fou des 200 actifs non atteint, ou joueur hors du top 20 %) : ni fête, ni ligne.

const MOI = '00000000-0000-4000-8000-0000000000a1';

/** Mois de Paris qui vient de finir, `AAAA-MM-01` (même calcul que src/app/titres.ts). */
function moisDernier(): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const an = Number(p.find(x => x.type === 'year')!.value), mois = Number(p.find(x => x.type === 'month')!.value);
  const [a, m] = mois === 1 ? [an - 1, 12] : [an, mois - 1];
  return `${a}-${String(m).padStart(2, '0')}-01`;
}

async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur) {
  const session = serveur.sessionCompte('moi@exemple.test', 'Florian', MOI);
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL, reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }, { name: 'go.connait-go.v1', value: '"sait"' }] }] },
  });
  const page = await brancher(ctx, serveur, { 'sb-supabase-auth-token': JSON.stringify(session), 'go.parties.v1': JSON.stringify({ n: 3 }) });
  return { ctx, page };
}

test('nouveau titre : fête une seule fois à l’ouverture, puis la ligne du Profil avec son sceau', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const mois = moisDernier();
  serveur.titres.push({ user_id: MOI, mois, titre: 'expert', cote: 1635, parties: 14 }, { user_id: 'autre', mois, titre: 'maitre', cote: 2400, parties: 30 });
  const { ctx, page } = await telephone(browser, baseURL, serveur);
  await page.goto('/');
  const fete = page.getByTestId('fete-titre');
  await expect(fete).toBeVisible();
  await expect(fete).toContainText('Nouveau titre : Expert du mois');
  await expect(fete).toContainText(/Top 5\s%/);
  await expect(fete.locator('.sceau-titre[data-titre="expert"]')).toBeVisible();
  expect((await fete.getByRole('button').boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await fete.getByRole('button').click();
  await expect(fete).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('go.titre-fete.v1'))).toBe(JSON.stringify(mois));

  // Réouverture : plus de fête.
  await page.reload();
  await expect(page.getByRole('navigation').getByRole('button', { name: /^Profil/ })).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('fete-titre')).toHaveCount(0);

  // Profil : la ligne « Titre du mois dernier », son sceau ; jamais le titre d'un autre ; le Profil tient sans défiler.
  await page.getByRole('navigation').getByRole('button', { name: /^Profil/ }).click();
  const ligne = page.getByTestId('ligne-titre');
  await expect(ligne).toContainText('Titre du mois dernier');
  await expect(ligne).toContainText('Expert du mois');
  await expect(ligne).toContainText(new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' }).format(new Date(`${mois.slice(0, 7)}-15T12:00:00Z`)).replace(/^./, c => c.toUpperCase()));
  await expect(ligne).toHaveAccessibleName(/^Titre du mois dernier\s?: Expert du mois/);
  await expect(ligne).not.toContainText('Maître');
  await expect(ligne.locator('.sceau-titre[data-titre="expert"]')).toBeVisible();
  // Le titre partage la ligne de « Ta cote » ; le toucher ouvre « Ta cote ».
  await expect(ligne).toContainText(/Top 5\s% des joueurs actifs/);
  expect((await ligne.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const { scroll, largeur } = await page.evaluate(() => ({ scroll: document.documentElement.scrollHeight, largeur: document.documentElement.scrollWidth }));
  if (process.env.CAPTURE_561) await page.screenshot({ path: process.env.CAPTURE_561, fullPage: true });
  expect(largeur).toBeLessThanOrEqual(390);
  expect(scroll).toBeLessThanOrEqual(844);
  await ligne.click();
  await expect(page.getByRole('heading', { name: 'Ta cote' })).toBeVisible();
  await ctx.close();
});

test('sans titre (garde-fou non atteint) : ni fête, ni ligne au Profil', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  // Un titre d'il y a deux mois ne compte plus comme « le mois dernier ».
  serveur.titres.push({ user_id: MOI, mois: '2020-01-01', titre: 'maitre', cote: 2400, parties: 30 });
  const { ctx, page } = await telephone(browser, baseURL, serveur);
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: /^Profil/ }).click();
  await expect(page.getByRole('heading', { name: 'Profil', exact: true })).toBeVisible();
  await expect(page.getByTestId('ligne-cote')).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(page.getByTestId('ligne-titre')).toHaveCount(0);
  await expect(page.getByTestId('fete-titre')).toHaveCount(0);
  // #647 (F4) : sans titre, « Ta cote » occupe toute la ligne ; le niveau de départ est dedans.
  await expect(page.getByRole('button', { name: /Ton niveau de départ/ })).toHaveCount(0);
  await page.getByTestId('ligne-cote').click();
  await expect(page.getByRole('button', { name: /Ton niveau de départ/ })).toBeVisible();
  await ctx.close();
});
