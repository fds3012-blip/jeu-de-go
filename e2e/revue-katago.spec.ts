import { existsSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { SGF_424 } from '../src/app/partie424.fixture';
import { demarrerParcours, ouvrirRevue } from './revueFactice';

// Issue #424 : la revue de la partie entre amis de Florian (9 × 9, B+17,5) s'est faite « Sans KataGo » sur iPhone.
// Cause : la revue ne prenait KataGo que s'il était déjà en cache ; une partie entre amis ne l'avait jamais chargé.
// Ici, la même partie, revue dans Chromium :
// 1. avec le vrai réseau g170-b6c96 (servi depuis public/models, `npm run fetch-model`) : KataGo tourne ;
// 2. téléchargement impossible : une phrase dit pourquoi, et la revue sans KataGo ne prétend rien de faux.
// Dans un build de test, la revue ne télécharge le réseau que si le test le demande (`__kataGoTelechargement`).

const MODELE = 'public/models/g170-b6c96-s175395328-d26788732.bin.gz';
const CAPTURES = process.env.CAPTURES ? 'docs/design/captures/revue-katago-424' : null;

/** La partie de Florian, gardée sur l'appareil comme un défi entre amis terminé (il a Noir). */
async function garderPartie(page: Page) {
  await page.addInitScript(sgf => {
    localStorage.setItem('go.historique.v1', JSON.stringify([{
      id: 'ami-424', date: new Date(Date.now() - 3_600_000).toISOString(), sgf, mode: 'defi', taille: 9, joueur: 1, adversaire: 'Ami', resultat: 'B+17.5',
    }]));
    (window as unknown as { __kataGoTelechargement: boolean }).__kataGoTelechargement = true;
  }, SGF_424);
}

async function capture(page: Page, nom: string) {
  if (!CAPTURES) return;
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${CAPTURES}/${nom}.jpg`, type: 'jpeg', quality: 60 });
}

test('avec le vrai réseau : KataGo tourne pour la revue d’une partie entre amis, sans cache préalable', async ({ page }) => {
  test.skip(!existsSync(MODELE), 'réseau absent : npm run fetch-model');
  test.setTimeout(400_000);
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  let telecharge = 0;
  await page.route('**/g170-b6c96-*.bin.gz', route => {
    telecharge++;
    return route.fulfill({ status: 200, body: readFileSync(MODELE), headers: { 'content-type': 'application/octet-stream', 'access-control-allow-origin': '*' } });
  });
  await garderPartie(page);
  await ouvrirRevue(page);
  await expect(page.getByText('Mochi prépare KataGo, une seule fois (4 Mo).')).toBeVisible();
  await capture(page, '1-chargement');

  const demarrer = page.getByRole('button', { name: 'Démarrer le bilan' });
  await expect(demarrer).toBeVisible({ timeout: 360_000 });
  expect(telecharge).toBe(1);
  // KataGo a noté la partie : pas de phrase « sans KataGo », et des notes que seul KataGo donne.
  await expect(page.locator('.revue-sans-katago')).toHaveCount(0);
  const table = page.getByRole('table', { name: 'Tes coups, note par note' });
  await expect(table.getByRole('row', { name: /Meilleur coup|Coup manqué|Excellent|Bon/ }).first()).toBeVisible();
  await expect(table.getByRole('row', { name: /Solide/ })).toHaveCount(0);
  await capture(page, '2-bilan-katago');

  // Le coup 27 (B8) : KataGo préférait F5. Gaffe d'environ 11 points avec 32 visites pleines (src/app/revue424.test.ts) ;
  // dans le navigateur, la recherche est bornée en temps (moins de visites sous charge) : au moins une note de perte.
  await demarrerParcours(page, 27);
  const bulle = page.locator('.parcours-bulle');
  await expect(bulle.locator('.parcours-titre')).toContainText('B8');
  await expect(page.getByRole('button', { name: /^Coup 27, B8, (Imprécision|Erreur|Coup manqué|Gaffe)$/ })).toBeVisible();
  await capture(page, '3-b8-gaffe');
  expect(erreurs).toEqual([]);
});

test('téléchargement impossible : une phrase le dit, et aucune note ne contredit la pastille', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.route('**/g170-b6c96-*.bin.gz', route => route.abort('internetdisconnected'));
  await garderPartie(page);
  await ouvrirRevue(page);
  const demarrer = page.getByRole('button', { name: 'Démarrer le bilan' });
  await expect(demarrer).toBeVisible({ timeout: 120_000 });
  await expect(page.locator('.revue-sans-katago')).toHaveText('KataGo n’a pas pu se télécharger (connexion) : Mochi ne note que ce qui est sûr.');
  await capture(page, '4-bilan-sans-katago');

  // Le bilan compte chaque camp à part : les deux colonnes ne sont plus identiques, et J8 compte chez Blanc.
  const table = page.getByRole('table', { name: 'Tes coups, note par note' });
  await expect(table.getByRole('row', { name: /Gaffe/ }).locator('td').nth(1)).not.toHaveText('–');
  const colonnes = await table.locator('tbody tr:not([data-ligne="precision"])').evaluateAll(lignes =>
    lignes.map(l => [...l.querySelectorAll('td')].map(td => td.textContent)));
  expect(colonnes.some(([noir, blanc]) => noir !== blanc)).toBe(true);

  // J8 (coup 28) : une Gaffe (8 pierres prises ensuite), plus « Solide » à côté de −87,5.
  await demarrerParcours(page, 28);
  const bulle = page.locator('.parcours-bulle');
  await expect(bulle.locator('.parcours-titre')).toContainText('J8');
  await expect(page.getByRole('button', { name: /^Coup 28, J8, Gaffe$/ })).toBeVisible();
  await expect(bulle.locator('.parcours-detail')).not.toContainText('Mochi ne voit pas de perte');
  const avance = await bulle.locator('.parcours-avance > [aria-hidden]').textContent();
  expect(Math.abs(Number((avance ?? '0').replace('−', '-').replace(',', '.')))).toBeLessThan(40);
  await capture(page, '5-j8-gaffe');

  // Chaque coup « Solide » de la bande : la pastille ne chute pas de plus de 4 points pour celui qui a joué.
  const solides = await page.getByRole('button', { name: /^Coup \d+, [A-T]\d, Solide$/ }).all();
  expect(solides.length).toBeGreaterThan(0);
  for (const b of solides.slice(0, 12)) {
    const coup = Number((await b.getAttribute('aria-label'))!.match(/^Coup (\d+)/)![1]);
    const lire = async (k: number) => {
      await page.getByRole('button', { name: new RegExp(`^Coup ${k},`) }).click();
      const t = await bulle.locator('.parcours-avance > [aria-hidden]').textContent({ timeout: 2000 }).catch(() => null);
      return t == null ? null : Number(t.replace('−', '-').replace(',', '.'));
    };
    const avant = coup > 1 ? await lire(coup - 1) : 0, apres = await lire(coup);
    const s = coup % 2 ? 1 : -1; // Florian a Noir : la pastille est l'avance de Noir
    if (avant != null && apres != null) expect(s * (avant - apres), `coup ${coup}`).toBeLessThanOrEqual(4);
  }
  expect(erreurs).toEqual([]);
});
