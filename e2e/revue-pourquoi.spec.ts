import { expect, test, type Page } from '@playwright/test';
import { plateau } from './plateau';
import { COTE_JOUEUR_FORT, demarrerParcours, ouvrirRevue } from './revueFactice';

// #673 : « Pourquoi ? » dans la revue. Partie fixe contre Pomme : au coup 11, tes pierres D6-D5 sont en atari (seule
// liberté D4) et tu joues ailleurs (G7) ; Pomme les prend en D4. KataGo factice (build de test) : il préfère D4 et donne
// sa suite et la propriété, comme le vrai (src/engine/index.ts, analyseErreur). Captures : `CAPTURES=1`
// (docs/design/captures/revue-pourquoi-673).

const DOSSIER = 'docs/design/captures/revue-pourquoi-673';
// 1 D6, 2 C6, 3 D5, 4 E6, 5 C3, 6 C5, 7 G3, 8 E5, 9 G5, 10 D7 (atari), 11 G7 (l'erreur), 12 D4 (prise), passes.
const SGF = '(;GM[1]FF[4]CA[UTF-8]SZ[9]KM[6.5]RU[Japanese]PB[Toi]PW[Pomme]RE[W+10.5]'
  + ';B[dd];W[cd];B[de];W[ed];B[cg];W[ce];B[gg];W[ee];B[ge];W[dc];B[gc];W[df];B[tt];W[tt])';

async function preparer(page: Page) {
  await page.addInitScript(({ sgf, cote }) => {
    if (!sessionStorage.getItem('revue-semee')) {
      sessionStorage.setItem('revue-semee', '1');
      localStorage.setItem('go.revue.v1', JSON.stringify({ sgf, adversaire: 'pomme', date: new Date(Date.now() - 3_600_000).toISOString() }));
      localStorage.setItem('go.cote-joueur.v1', JSON.stringify(cote));
    }
    const i = (s: string) => (s.charCodeAt(1) - 97) * 9 + (s.charCodeAt(0) - 97);
    const COUPS = ['dd', 'cd', 'de', 'ed', 'cg', 'ce', 'gg', 'ee', 'ge', 'dc', 'gc', 'df'];
    const own = (v: Record<string, number>) => { const o = new Float32Array(81); for (const [k, x] of Object.entries(v)) o[i(k)] = x; return o; };
    (window as unknown as { __kataGoFactice: unknown }).__kataGoFactice = {
      info: { state: 'pret' },
      async analyze(pos: { toPlay: 1 | 2; lastMove: number | null }) {
        await new Promise(r => setTimeout(r, 20));
        // Indice de la position : 0 au départ, k après le coup k (les passes finales : 13 puis 14).
        const k = pos.lastMove == null ? 0 : pos.lastMove < 0 ? (pos.toPlay === 2 ? 13 : 14) : COUPS.findIndex(c => i(c) === pos.lastMove) + 1;
        const s = pos.toPlay === 1 ? 1 : -1, noir = k <= 10 ? 2 : -6;
        const base = { winrate: 0.5, ownership: own({}), visits: 64, ms: 1, engine: 'factice' };
        if (k === 10) {
          // Avant l'erreur : D4 sauve (variante D4, puis Pomme ailleurs) ; G7 perd 8 points.
          return { ...base, lead: 2, ownershipApres: own({ dd: 0.9, de: 0.9, df: 0.9 }),
            moves: [{ move: i('df'), visits: 48, lead: 2, pv: [i('df'), i('gc')] }, { move: i('gc'), visits: 10, lead: -6 }] };
        }
        if (k === 11) {
          // Après l'erreur : Pomme prend en D4 ; tes pierres sont à elle.
          return { ...base, lead: 6, ownership: own({ dd: -0.9, de: -0.9 }), moves: [{ move: i('df'), visits: 50, lead: 6, pv: [i('df')] }] };
        }
        const suivant = k < COUPS.length ? i(COUPS[k]) : -1;
        return { ...base, lead: s * noir, moves: [{ move: suivant, visits: 40, lead: s * noir }] };
      },
    };
  }, { sgf: SGF, cote: COTE_JOUEUR_FORT });
}

async function capture(page: Page, nom: string) {
  if (!process.env.CAPTURES) return;
  await page.screenshot({ path: `${DOSSIER}/${nom}.jpg`, type: 'jpeg', quality: 80 });
}

for (const theme of ['dark', 'light'] as const) {
  test(`« Pourquoi ? » : l'erreur et le bon coup expliqués, la suite rejouée coup par coup (390 px, ${theme === 'dark' ? 'sombre' : 'clair'})`, async ({ page }) => {
    const erreurs: string[] = [];
    page.on('pageerror', e => erreurs.push(e.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: theme });
    await preparer(page);
    const suffixe = theme === 'dark' ? 'sombre' : 'clair';

    await ouvrirRevue(page);
    await demarrerParcours(page, 11);
    const bulle = page.locator('.parcours-bulle');
    // Le bon coup se cherche d'abord (#77) : pas de « Pourquoi ? » tant qu'il est caché.
    await expect(bulle.getByRole('button', { name: 'Voir le bon coup' })).toBeVisible({ timeout: 30_000 });
    await expect(bulle.getByRole('button', { name: /^Pourquoi/ })).toHaveCount(0);
    await bulle.getByRole('button', { name: 'Voir le bon coup' }).click();
    const lien = bulle.getByRole('button', { name: 'Pourquoi c’est une erreur, et pourquoi D4 est meilleur' });
    await expect(lien).toBeVisible();
    await expect(lien).toHaveText('Pourquoi ?');
    await expect(lien).toHaveAttribute('aria-expanded', 'false');
    await capture(page, `1-parcours-${suffixe}`);

    // Ouvert : ta suite d'abord. Une seule action principale (« Suivant »), pas de défilement horizontal.
    await lien.click();
    const pq = page.getByTestId('pourquoi');
    await expect(pq.getByRole('heading', { name: 'Pourquoi c’est une erreur' })).toBeVisible();
    await expect(pq).toContainText('Tes 2 pierres en D6 étaient en atari (il ne leur restait qu’une liberté) et tu n’as pas répondu : Pomme les prend en D4.');
    await expect(pq.getByRole('button', { name: 'Ton coup' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.cta')).toHaveCount(1);
    await expect(page.locator('.cta')).toHaveText('Suivant');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    // La bande des coups laisse la place à la suite : coup 1 (ton coup G7), tes pierres entourées.
    await expect(page.getByRole('list', { name: /coups/i })).toHaveCount(0);
    await expect(page.getByText('Coup 1 sur 2 de la suite')).toBeVisible();
    await expect(plateau(page).locator('[data-cible]')).toHaveCount(2);
    await capture(page, `2-pourquoi-erreur-${suffixe}`);

    // Coup suivant de la suite : Pomme prend en D4 ; les deux pierres disparaissent.
    await page.getByRole('button', { name: 'Coup suivant de la suite' }).click();
    await expect(page.getByText('Coup 2 sur 2 de la suite')).toBeVisible();
    await expect(plateau(page).locator('g[data-point="D6"][data-pierre]')).toHaveCount(0);
    await expect(plateau(page).locator('g[data-point="D4"][data-pierre="blanc"]')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Coup suivant de la suite' })).toBeDisabled();
    await capture(page, `3-pourquoi-suite-${suffixe}`);

    // Le bon coup : sa suite, et ce qu'il garde. Clavier : flèche gauche sans effet à l'étape 1.
    await pq.getByRole('button', { name: 'Le bon coup' }).click();
    await expect(pq.getByRole('heading', { name: 'Pourquoi D4 est meilleur' })).toBeVisible();
    await expect(pq).toContainText('Avec D4, ces 2 pierres ne sont pas prises.');
    await expect(page.getByText('Coup 1 sur 2 de la suite')).toBeVisible();
    await expect(plateau(page).locator('g[data-point="D4"][data-pierre="noir"]')).toHaveCount(1);
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Coup 2 sur 2 de la suite')).toBeVisible();
    await capture(page, `4-pourquoi-meilleur-${suffixe}`);

    // Fermer : le parcours revient tel quel.
    await bulle.getByRole('button', { name: 'Fermer' }).click();
    await expect(page.getByTestId('pourquoi')).toHaveCount(0);
    await expect(page.getByRole('list', { name: /coups/i })).toBeVisible();
    await expect(page.getByText(/Coup 11 sur \d+/)).toBeVisible();
    expect(erreurs).toEqual([]);
  });
}
