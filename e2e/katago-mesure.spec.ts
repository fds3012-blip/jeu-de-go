import { appendFileSync } from 'node:fs';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { SGF_424 } from '../src/app/partie424.fixture';
import { ouvrirRevue } from './revueFactice';

// Issue #475 : mesure du temps avant que KataGo soit prêt pour la revue (vrai réseau g170, vrai TensorFlow.js),
// dans Chromium avec un réseau ralenti simulé (« 4G lente » : 1,6 Mbit/s, 150 ms). Facultatif et lourd :
//   MESURE_KATAGO=1 [MESURE_SORTIE=fichier.jsonl] [MESURE_ETIQUETTE=avant|apres] PW_PORT=… npx playwright test e2e/katago-mesure.spec.ts --workers=1
// Le même fichier mesure la version précédente (build de main servi sur PW_PORT, réseau en /models/ via
// VITE_KATAGO_MODEL_URL) et celle-ci : seuls les parcours d'interface communs sont utilisés.
// Résultats et limites (iOS) : docs/qa/katago-demarrage-475.md.

const ETIQUETTE = process.env.MESURE_ETIQUETTE ?? 'apres';
const LENT = { offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 90_000 };

test.skip(!process.env.MESURE_KATAGO, 'mesure facultative : MESURE_KATAGO=1');
test.describe.configure({ mode: 'serial' });

function noter(scenario: string, ms: number, extra: Record<string, unknown> = {}) {
  const ligne = JSON.stringify({ etiquette: ETIQUETTE, scenario, ms: Math.round(ms), ...extra });
  console.log(ligne);
  if (process.env.MESURE_SORTIE) appendFileSync(process.env.MESURE_SORTIE, ligne + '\n');
}

async function preparer(ctx: BrowserContext, parties = 5) {
  await ctx.addInitScript(({ sgf, parties }) => {
    localStorage.setItem('go.historique.v1', JSON.stringify([{
      id: 'ami-475', date: new Date(Date.now() - 3_600_000).toISOString(), sgf, mode: 'defi', taille: 9, joueur: 1, adversaire: 'Ami', resultat: 'B+17.5',
    }]));
    localStorage.setItem('go.parties.v1', JSON.stringify({ n: parties }));
    (window as unknown as { __kataGoTelechargement: boolean }).__kataGoTelechargement = true;
  }, { sgf: SGF_424, parties });
}

async function ralentir(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', LENT);
}

/**
 * Ouvre la revue et mesure le temps jusqu'à KataGo prêt (la phrase « Mochi prépare KataGo » disparaît).
 * KataGo a-t-il vraiment démarré ? Les deux versions écrivent « KataGo indisponible pour la revue » sinon.
 */
async function revueJusquAPret(page: Page): Promise<{ ms: number; katago: boolean; raison?: string }> {
  let raison: string | undefined;
  page.on('console', m => { if (/KataGo indisponible/.test(m.text())) raison = m.text(); });
  await ouvrirRevue(page);
  const t0 = Date.now();
  const phrase = page.locator('.bilan-katago');
  await expect(phrase).toHaveCount(0, { timeout: 300_000 });
  const ms = Date.now() - t0;
  await page.waitForTimeout(300);
  return { ms, katago: !raison, ...(raison ? { raison } : {}) };
}

test('1. premier usage : rien en cache, revue ouverte juste après la partie', async ({ browser, baseURL }) => {
  test.setTimeout(400_000);
  const ctx = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  await preparer(ctx);
  const page = await ctx.newPage();
  await page.goto('/');
  await ralentir(page);
  const r = await revueJusquAPret(page);
  noter('froid', r.ms, { katago: r.katago, raison: r.raison });
  expect(r.katago).toBe(true);

  // 2. Même appareil, plus tard : réseau et code en cache (nouvelle page, même stockage).
  await page.close();
  const p2 = await ctx.newPage();
  await p2.goto('/');
  await ralentir(p2);
  const r2 = await revueJusquAPret(p2);
  noter('cache', r2.ms, { katago: r2.katago, raison: r2.raison });
  expect(r2.katago).toBe(true);
  const memo = await p2.evaluate(() => localStorage.getItem('go.katago.backend.v1'));
  noter('backend', 0, { memo });
  await ctx.close();
});

test('3. après #475 : préchargé à la fin de la partie, puis revue', async ({ browser, baseURL }) => {
  test.skip(ETIQUETTE !== 'apres', 'le préchargement n’existe qu’après #475');
  test.setTimeout(400_000);
  const ctx = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  await preparer(ctx);
  const page = await ctx.newPage();
  await page.goto('/');
  await ralentir(page);
  // Ce que fait la fin de partie (Game.tsx), sans le délai de 3 s ; on mesure la durée du préchargement en fond.
  const t0 = Date.now();
  await page.evaluate(async () => {
    const [e] = await (window as unknown as { __moteurE2E: () => Promise<[{ prechargerApresPartie(n: number, d: number): Promise<unknown>; kataGoInfo(): { prechargement?: string } }]> }).__moteurE2E();
    await e.prechargerApresPartie(5, 0);
    (window as unknown as { __m: unknown }).__m = e;
  });
  const info = () => page.evaluate(() => (window as unknown as { __m: { kataGoInfo(): { prechargement?: string; erreurPrechargement?: string } } }).__m.kataGoInfo());
  await expect.poll(async () => (await info()).prechargement, { timeout: 300_000, intervals: [250] }).not.toBe('en-cours');
  noter('prechargement-fond', Date.now() - t0, { info: await info() });
  expect((await info()).prechargement).toBe('fait');
  const r = await revueJusquAPret(page);
  noter('precharge', r.ms, { katago: r.katago, raison: r.raison });
  expect(r.katago).toBe(true);
  const etapes = await page.evaluate(async () => {
    const [e] = await (window as unknown as { __moteurE2E: () => Promise<[{ kataGoInfo(): unknown }]> }).__moteurE2E();
    return e.kataGoInfo();
  });
  noter('etapes', 0, { info: etapes });
  await ctx.close();
});
