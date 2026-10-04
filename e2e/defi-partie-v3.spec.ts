import { expect, test, type Browser, type Page } from '@playwright/test';
import { brancher, fauxServeur, JETON, PARTIE, type FauxServeur } from './fauxSupabase';
import { abandonner, attendrePierre, barreActions, ouvrirPlus, plateau } from './plateau';

// Issue #393 (recette du 02/10 au soir, L1) : l'écran de partie du défi passe en v3, comme l'écran de partie (#384) :
// barre à trois places (aucune aide ici, « Passer » en bouton plein, menu « Plus » avec « Abandonner »), Mochi sous
// ton bandeau, le « ? » de l'aide au bout du ruban des coups (#390), et le pseudo de l'ami à la place de « Ton ami ».
// Supabase simulé (e2e/fauxSupabase.ts), sous la RLS simulée : profils visibles par tous.

const MOI = '00000000-0000-4000-8000-0000000000a1';
const LEA = '00000000-0000-4000-8000-0000000000b2';
const CAPTURES = process.env.CAPTURES_393; // ex. docs/design/captures/defi-ecran-v3
const H = 3_600_000;

/** Léa (Noir) a joué E5 et G7 ; j'ai joué C3 (Blanc). C'est à moi. */
function semerPartie(serveur: FauxServeur) {
  serveur.games.push({ id: PARTIE, white_id: MOI, black_id: LEA, created_by: MOI, size: 9, komi: 6.5, rules: 'japanese', handicap: 0,
    moves: 'eecggc', status: 'active', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0, prive: true, rated: false });
  serveur.defis.push({ partie_id: PARTIE, jeton: JETON, createur_id: MOI, invite_id: LEA, delai_coup: '3 days',
    date_limite: new Date(Date.now() + 50 * H).toISOString(), lien_expire_le: new Date(Date.now() + 7 * 864e5).toISOString(), cree_le: new Date().toISOString() });
  serveur.profiles.push({ id: LEA, username: 'Lea_du_go', rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 });
}

async function ouvrirPartie(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, largeur: number, sombre: boolean): Promise<Page> {
  const session = serveur.sessionCompte('moi@exemple.test', 'Florian', MOI);
  const ctx = await browser.newContext({
    viewport: { width: largeur, height: largeur === 320 ? 568 : 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
    colorScheme: sombre ? 'dark' : 'light', reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
  });
  const page = await brancher(ctx, serveur, { 'sb-supabase-auth-token': JSON.stringify(session), 'go.parties.v1': JSON.stringify({ n: 3 }) });
  await page.goto('/');
  await page.getByTestId('tuile-defi').click();
  await expect(plateau(page)).toBeVisible();
  await expect(page.getByText(/À toi de jouer\. Il te reste/)).toBeVisible();
  return page;
}

for (const largeur of [390, 320] as const) {
  for (const sombre of [false, true]) {
    const nom = `${largeur}-${sombre ? 'sombre' : 'clair'}`;
    test(`défi en v3, ${nom} : pseudo de l’ami, menu « Plus », aide et retour à la même position`, async ({ browser, baseURL }) => {
      const serveur = fauxServeur();
      semerPartie(serveur);
      const page = await ouvrirPartie(browser, baseURL, serveur, largeur, sombre);
      const erreurs: string[] = [];
      page.on('pageerror', e => erreurs.push(e.message));
      if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/defi-partie-${nom}.jpg`, type: 'jpeg', quality: 80 });

      // Le pseudo de l'ami, lu dans son profil, à la place de « Ton ami ».
      const bandeauAmi = page.locator('.joueur').first();
      await expect(bandeauAmi).toContainText('Lea_du_go');
      await expect(page.locator('.joueur').filter({ hasText: 'Ton ami' })).toHaveCount(0);
      await expect(page.locator('.joueur').last()).toContainText('Toi');
      // Mochi juste sous ton bandeau.
      const toi = (await page.locator('.joueur').last().boundingBox())!;
      const mochi = (await page.locator('.partie-mochi .coach').boundingBox())!;
      expect(mochi.y).toBeGreaterThanOrEqual(toi.y + toi.height - 1);
      expect(mochi.y - (toi.y + toi.height)).toBeLessThan(24);

      // Barre v3 : « Passer » visible, « Abandonner » rangé dans « Plus ».
      const barre = barreActions(page);
      await expect(barre.getByRole('button', { name: 'Passer' })).toBeVisible();
      await expect(barre.getByRole('button', { name: 'Abandonner', exact: true })).toBeHidden();
      for (const b of await barre.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      const feuille = await ouvrirPlus(page);
      await expect(feuille.getByRole('button', { name: 'Abandonner' })).toBeVisible();
      if (CAPTURES && largeur === 390) await page.screenshot({ path: `${CAPTURES}/defi-plus-${nom}.jpg`, type: 'jpeg', quality: 80 });
      await page.keyboard.press('Escape');
      await expect(feuille).toBeHidden();

      // Le « ? » au bout du ruban des coups ouvre l'aide ; en la fermant, on retrouve la même position.
      const aideBouton = page.locator('.coups-ruban').getByRole('button', { name: 'Aide : règles et mots du go' });
      await expect(aideBouton).toBeVisible();
      expect((await aideBouton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await aideBouton.click();
      const aide = page.getByRole('dialog', { name: /^(Aide|Help)$/ });
      await expect(aide).toBeVisible();
      await aide.getByRole('button', { name: 'Fermer' }).click();
      await expect(aide).toHaveCount(0);
      await attendrePierre(page, 'E5', 'noir');
      await attendrePierre(page, 'C3', 'blanc');
      await attendrePierre(page, 'G7', 'noir');
      await expect(page.getByText(/À toi de jouer\. Il te reste/)).toBeVisible();

      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur);
      expect(erreurs).toEqual([]);
      await page.context().close();
    });
  }
}

test('défi en v3 : abandonner passe par « Plus », puis « Confirmer ? »', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  semerPartie(serveur);
  const page = await ouvrirPartie(browser, baseURL, serveur, 390, false);
  await abandonner(page);
  // La demande part après le toucher : on l'attend (sous charge, la vérification immédiate échouait parfois, #425).
  await expect.poll(() => serveur.appels).toContain('POST /rest/v1/rpc/resign_game');
  await page.context().close();
});

// Issue #393, L2 : « Problème suivant · Deux pierres d'un c… » était coupé, même à 390 px. Le titre passe sous le verbe,
// en entier ; le verbe reste sur une ligne (#247).
for (const largeur of [390, 320] as const) {
  for (const sombre of [false, true]) {
    const nom = `${largeur}-${sombre ? 'sombre' : 'clair'}`;
    test(`problèmes, ${nom} : le titre du problème suivant se lit en entier`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: largeur === 320 ? 568 : 844 });
      await page.emulateMedia({ colorScheme: sombre ? 'dark' : 'light', reducedMotion: 'reduce' });
      await page.goto('/');
      await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
      const bouton = page.locator('button.continuer');
      await expect(bouton).toBeVisible();
      const titre = bouton.locator('.continuer-titre');
      // Le titre relevé par la recette (problème n01), posé à la place de celui que le tirage propose : la mise en page
      // est vérifiée avec le texte qui était coupé, quel que soit le problème suivant du jour.
      await titre.evaluate(el => { el.textContent = 'Deux pierres d’un coup'; });
      const texte = (await titre.innerText()).trim();
      // Rien de coupé : le titre tient dans sa boîte (au plus deux lignes), le bouton ne déborde pas, 44 px au moins.
      const mesure = await titre.evaluate(el => ({ coupe: el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1,
        lignes: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)) }));
      expect(mesure.coupe).toBe(false);
      expect(mesure.lignes).toBeLessThanOrEqual(2);
      expect(await bouton.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await expect(bouton).toHaveAccessibleName(`Problème suivant ${texte}`);
      const box = (await bouton.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width).toBeLessThanOrEqual(largeur);
      if (CAPTURES && !sombre) await bouton.locator('xpath=..').screenshot({ path: `${CAPTURES}/probleme-suivant-${nom}.jpg`, type: 'jpeg', quality: 80 });
    });
  }
}
