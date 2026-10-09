import { expect, test, type Page } from '@playwright/test';
import { jouer } from './plateau';

// #492 : « Rejouer mes erreurs », pourquoi la bonne réponse est la bonne. Deux erreurs gardées sur l'appareil :
// - la position de Florian (Caillou, coup 5) : Noir C3 et G7, Blanc D5 et C2 ; KataGo préférait D3, Florian a joué C4,
//   environ 6 points d'écart. Aucun motif tactique sûr : phrase générale, chiffrée ;
// - un sauvetage : Noir E5 en atari (Blanc D5, F5, E6) ; le bon coup E4, le coup joué G3.
// Captures avant / après : `CAPTURES_492=<dossier> npx playwright test e2e/pourquoi-erreurs.spec.ts` (#497 compris).

const CAPTURES = process.env.CAPTURES_492;
const N = 9;
const idx = (l: string) => {
  const x = 'ABCDEFGHJ'.indexOf(l[0]), y = N - Number(l.slice(1));
  return y * N + x;
};
function rangees(noires: string[], blanches: string[]): string[] {
  const r = Array.from({ length: N }, () => '.'.repeat(N).split(''));
  for (const s of noires) r[Math.floor(idx(s) / N)][idx(s) % N] = 'X';
  for (const s of blanches) r[Math.floor(idx(s) / N)][idx(s) % N] = 'O';
  return r.map(l => l.join(''));
}
const base = { creeLe: '2026-01-01T10:00:00.000Z', prochain: '2026-01-01', rates: 1, reussites: 0, maj: 1, size: 9, toPlay: 1 };
const FLORIAN = {
  ...base, id: 'erreur-florian', rows: rangees(['C3', 'G7'], ['D5', 'C2']), reponses: [idx('D3')], joue: idx('C4'), coup: 5, adversaire: 'Caillou', perte: 5.6,
};
// #497 : la même position, gardée avec les faits de KataGo (vraie analyse, src/app/florian497.fixture.ts) : variante
// principale du bon coup, riposte de KataGo pour Blanc après C4, zone où se fait l'écart.
const FLORIAN_497 = {
  ...FLORIAN, id: 'erreur-florian-497', perte: 4,
  kataGo: {
    suite: ['D3', 'F4', 'D7', 'C7'].map(idx), riposte: ['E3', 'E4', 'D4'].map(idx),
    zone: { region: 'bas', gain: 4.2, total: 3, points: ['D4', 'E3', 'D2', 'E2', 'F2', 'C1', 'D1', 'E1'].map(idx) },
  },
};
const SAUVETAGE = {
  ...base, id: 'erreur-sauve', creeLe: '2026-01-02T10:00:00.000Z', rows: rangees(['E5'], ['D5', 'F5', 'E6']), reponses: [idx('E4')], joue: idx('G3'), coup: 12, adversaire: 'Pomme', perte: 4.2,
};

async function preremplir(page: Page, erreurs: object[]) {
  await page.addInitScript(e => {
    if (sessionStorage.getItem('pourquoi-pret')) return;
    localStorage.setItem('go.parties.v1', JSON.stringify({ n: 1, dernier: 'caillou', ordi: 1 }));
    localStorage.setItem('go.bilan.v1', JSON.stringify({ caillou: { v: 0, d: 1 } }));
    localStorage.setItem('go.erreurs.v1', JSON.stringify(e));
    localStorage.setItem('go.xp.premieres.v1', JSON.stringify(['probleme', 'partie']));
    sessionStorage.setItem('pourquoi-pret', '1');
  }, erreurs);
}

async function capture(page: Page, nom: string) {
  if (!CAPTURES) return;
  await page.screenshot({ path: `${CAPTURES}/${nom}.png` });
}

async function ouvrirSeance(page: Page) {
  await page.goto('/');
  const carte = page.getByTestId('tuile-revisions');
  await carte.scrollIntoViewIfNeeded();
  await carte.click();
  await expect(page.locator('.lecteur')).toBeVisible();
}

/** Raté, puis l'aide graduée (indice, pourquoi, réponse) : chaque marche s'ouvre après un nouvel essai raté. */
async function rateEtReponse(page: Page, faux: string[] = ['B7', 'A1', 'J9', 'H2']) {
  const aide = page.locator('.lecteur .lien-aide');
  for (const f of faux) {
    // Un point différent à chaque fois : toucher la pierre fausse encore affichée remettrait seulement la position.
    await jouer(page, f);
    await expect(aide).toBeVisible();
    const libelle = await aide.textContent();
    await aide.click();
    if (libelle === 'Voir la réponse') return;
  }
  throw new Error('La réponse n’est jamais proposée');
}

/** Réponse montrée : le premier toucher sur la pierre affichée remet la position, le second joue. */
async function rejouerReponse(page: Page, bon: string) {
  const resolu = page.locator('[data-vu]');
  await jouer(page, bon);
  if (!(await resolu.count())) await jouer(page, bon);
  await expect(resolu).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

async function sansDebord(page: Page, ecran: string) {
  const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(m.scroll, `${ecran} : défilement horizontal`).toBeLessThanOrEqual(m.client);
}

/** La croix rouge du plateau (coup joué dans la partie). */
const croix = (page: Page) => page.locator('.lecteur svg path[stroke="#D2432C"]');

test('échec : la réponse vient avec le pourquoi chiffré et la croix sur le coup joué (position de Florian)', async ({ page }) => {
  await preremplir(page, [FLORIAN]);
  await ouvrirSeance(page);
  await rateEtReponse(page);
  const pourquoi = page.locator('[data-pourquoi]');
  await expect(pourquoi).toHaveText(/^Selon KataGo, D3 gardait environ 6\spoints de plus que ton coup en C4\. Aucune pierre n’est en atari ici\s: l’écart ne vient pas d’une prise immédiate\.$/);
  await expect(page.getByText(/Rejoue-la pour la retenir/)).toHaveCount(0);
  await expect(page.getByText('La croix marque ton coup dans la partie.')).toBeVisible();
  await expect(croix(page)).toHaveCount(1);
  // « Revoir la suite » reste une cible de 44 px.
  const revoir = page.getByRole('button', { name: 'Revoir la suite' });
  expect((await revoir.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await sansDebord(page, 'réponse');
});

test('échec : « Revoir la suite » montre la prise que permettait le coup joué, puis le bon coup', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await preremplir(page, [SAUVETAGE]);
  await ouvrirSeance(page);
  await rateEtReponse(page);
  const verdict = page.locator('.verdict');
  await expect(verdict.getByText('Ton coup dans la partie : G3.')).toBeVisible();
  await expect(verdict.getByText('Blanc prend une pierre en E4.')).toBeVisible();
  await expect(verdict.getByText('Retour à la position de ta partie.')).toBeVisible();
  // Dernière position : le bon coup, et l'explication remplace la légende.
  await expect(page.locator('[data-pourquoi]')).toHaveText(
    /^E4 sort ta pierre de l’atari \(il ne lui restait qu’une liberté\)\s: elle a maintenant 3\slibertés\. Après ton coup en G3, Blanc pouvait prendre une de tes pierres en E4\.$/,
    { timeout: 10_000 },
  );
  await expect(page.locator('[data-ecart]')).toHaveText(/^Écart\s: environ 4\spoints selon KataGo\.$/);
  await expect(croix(page)).toHaveCount(1);
});

test('mouvements réduits : la suite saute à la fin, explication comprise', async ({ page }) => {
  await preremplir(page, [SAUVETAGE]);
  await ouvrirSeance(page);
  await rateEtReponse(page);
  await expect(page.locator('[data-pourquoi]')).toContainText('E4 sort ta pierre de l’atari');
  await page.getByRole('button', { name: 'Revoir la suite' }).click();
  await expect(page.locator('[data-pourquoi]')).toContainText('E4 sort ta pierre de l’atari');
});

test('réussite : courte confirmation du pourquoi', async ({ page }) => {
  await preremplir(page, [SAUVETAGE]);
  await ouvrirSeance(page);
  await jouer(page, 'E4');
  await expect(page.locator('.verdict-juste')).toContainText(/Bravo, c’est le coup de KataGo\s! E4 sort ta pierre de l’atari/);
});

const TEXTE_FLORIAN_497 = /^Selon KataGo, l’écart se fait en bas du plateau\s: avec D3, cette zone vaut environ 4\spoints de plus pour toi\. Après ton coup en C4, le meilleur coup de Blanc selon KataGo, E3, entrait dans cette zone\.$/;

test('#497 : position de Florian avec les faits de KataGo, la zone du bas et la riposte E3', async ({ page }) => {
  await preremplir(page, [FLORIAN_497]);
  await ouvrirSeance(page);
  await rateEtReponse(page);
  await expect(page.locator('[data-pourquoi]')).toHaveText(TEXTE_FLORIAN_497);
  await expect(page.locator('[data-ecart]')).toHaveText(/^Écart\s: environ 4\spoints selon KataGo\.$/);
  // La zone en carrés noirs (8 intersections du bas), expliquée en une ligne ; la croix sur C4.
  await expect(page.locator('[data-zone]')).toHaveText('Les carrés montrent cette zone.');
  await expect(page.locator('.lecteur [data-territoire="noir"]')).toHaveCount(8);
  await expect(croix(page)).toHaveCount(1);
  await sansDebord(page, 'réponse avec zone');
});

test('#497 : « Revoir la suite » suit KataGo (riposte de Blanc, puis la variante du bon coup)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await preremplir(page, [FLORIAN_497]);
  await ouvrirSeance(page);
  await rateEtReponse(page);
  const verdict = page.locator('.verdict');
  for (const legende of ['Ton coup dans la partie : C4.', 'Selon KataGo, Blanc répond en E3.', 'Suite de KataGo : Noir en E4.', 'Retour à la position de ta partie.', 'Le bon coup : D3.', 'Suite de KataGo : Noir en D7.']) {
    // Typographie française : l'espace avant « : » devient insécable.
    const motif = new RegExp(`^${legende.replace(/[.]/g, '\\.').replace(' : ', '\\s:\\s')}$`);
    await expect(verdict.getByText(motif)).toBeVisible({ timeout: 10_000 });
    if (legende.includes('répond')) await capture(page, 'florian-497-riposte');
  }
  await expect(page.locator('[data-pourquoi]')).toHaveText(TEXTE_FLORIAN_497, { timeout: 10_000 });
});

test('#497 : une erreur gardée avant #497 (sans faits de KataGo) s’explique comme avant', async ({ page }) => {
  await preremplir(page, [FLORIAN]);
  await ouvrirSeance(page);
  await rateEtReponse(page);
  await expect(page.locator('[data-pourquoi]')).toContainText('Selon KataGo, D3 gardait environ 6');
  await expect(page.locator('[data-zone]')).toHaveCount(0);
  await expect(page.locator('.lecteur [data-territoire]')).toHaveCount(0);
});

/** Problème classique « Première capture » (a01, réponse E4) : deux essais faux, puis l'aide jusqu'à la réponse. */
async function reponseClassique(page: Page) {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  await page.getByRole('button', { name: 'Tous les problèmes' }).click();
  await page.getByRole('button', { name: /^Problème \d+ : Première capture/ }).click();
  await jouer(page, 'A1');
  await page.getByRole('button', { name: 'Voir un indice' }).click();
  await jouer(page, 'B2');
  await page.getByRole('button', { name: 'Voir pourquoi' }).click();
  await page.getByRole('button', { name: 'Voir la réponse' }).click();
}

test('#497 : problème classique, la réponse vient avec son explication (texte de solution, sans « Bravo »)', async ({ page }) => {
  await reponseClassique(page);
  const texte = page.locator('[data-pourquoi-probleme]');
  await expect(texte).toHaveText(/^Voilà la réponse\s:\sE4\. Les points vides juste à côté d.une pierre sont ses libertés\. La pierre blanche n.en avait plus qu.une, E4\s: elle était en atari\./);
  await expect(page.getByText(/Rejoue-la pour la retenir|Bravo/)).toHaveCount(0);
  await sansDebord(page, 'problème classique');
});

for (const cas of [{ l: 320, h: 640, theme: 'dark' as const }, { l: 390, h: 844, theme: 'light' as const }]) {
  test(`#497 ${cas.l} px, ${cas.theme === 'dark' ? 'sombre' : 'clair'} : zone, explication et problème classique lisibles, sans débord`, async ({ page }) => {
    await page.setViewportSize({ width: cas.l, height: cas.h });
    await page.emulateMedia({ colorScheme: cas.theme, reducedMotion: 'reduce' });
    await preremplir(page, [FLORIAN_497]);
    await ouvrirSeance(page);
    await rateEtReponse(page);
    const texte = page.locator('[data-pourquoi]');
    await expect(texte).toHaveText(TEXTE_FLORIAN_497);
    await sansDebord(page, `${cas.l} px, zone`);
    const couleurs = await texte.evaluate(el => [getComputedStyle(el).color, getComputedStyle(el.closest('.verdict')!).backgroundColor]);
    expect(couleurs[0]).not.toBe(couleurs[1]);
    // « Revoir la suite » reste une cible de 44 px.
    expect((await page.getByRole('button', { name: 'Revoir la suite' }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await capture(page, `florian-497-zone-${cas.l}-${cas.theme}`);
    await reponseClassique(page);
    await expect(page.locator('[data-pourquoi-probleme]')).toBeVisible();
    await sansDebord(page, `${cas.l} px, problème classique`);
    await capture(page, `classique-497-${cas.l}-${cas.theme}`);
  });
}

for (const cas of [{ l: 320, h: 640, theme: 'dark' as const }, { l: 390, h: 844, theme: 'light' as const }]) {
  test(`${cas.l} px, ${cas.theme === 'dark' ? 'sombre' : 'clair'} : explication lisible, sans débord`, async ({ page }) => {
    await page.setViewportSize({ width: cas.l, height: cas.h });
    await page.emulateMedia({ colorScheme: cas.theme, reducedMotion: 'reduce' });
    await preremplir(page, [SAUVETAGE]);
    await ouvrirSeance(page);
    await rateEtReponse(page);
    const texte = page.locator('[data-pourquoi]');
    await expect(texte).toBeVisible();
    await sansDebord(page, `${cas.l} px`);
    // Contraste : le texte de l'explication se détache du fond de la feuille (couleurs calculées).
    const couleurs = await texte.evaluate(el => [getComputedStyle(el).color, getComputedStyle(el.closest('.verdict')!).backgroundColor]);
    expect(couleurs[0]).not.toBe(couleurs[1]);
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`captures (${theme})`, async ({ page }) => {
    test.skip(!CAPTURES, 'captures à la demande');
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await preremplir(page, [FLORIAN, SAUVETAGE]);
    await ouvrirSeance(page);
    await rateEtReponse(page);
    await page.waitForTimeout(300);
    await capture(page, `florian-reponse-${theme}`);
    await rejouerReponse(page, 'D3');
    await page.getByRole('button', { name: 'Révision suivante' }).click();
    await rateEtReponse(page);
    await page.waitForTimeout(300);
    await capture(page, `sauvetage-reponse-${theme}`);
  });
}
