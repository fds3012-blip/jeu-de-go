import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, jouer, plateau } from './plateau';

// Issue #286 : analyser une partie jouée ailleurs (SGF). Profil → « Analyser une partie » → coller le SGF → choisir son camp
// → revue → « Rejoue cette erreur ». KataGo est remplacé par l'analyseur factice de e2e/rejoue-erreur.spec.ts
// (`window.__kataGoFactice`, build VITE_E2E) : plateau vide, D4 est le meilleur coup (+5), F4 perd 0,9 point (accepté),
// E5 perd 10 points (Grosse erreur) ; ensuite, Noir est mené de 5 points.
// CAPTURES_SGF=<dossier> : captures 390 × 844 en clair et en sombre (revue de design), hors du dépôt.

async function kataGoFactice(page: Page, attente = 0) {
  await page.addInitScript((ms: number) => {
    const idx = (l: string) => { const x = 'ABCDEFGHJ'.indexOf(l[0]); return (9 - Number(l.slice(1))) * 9 + x; };
    (window as unknown as { __kataGoFactice: unknown }).__kataGoFactice = {
      info: { state: 'pret' },
      async analyze(pos: { board: Int8Array; toPlay: 1 | 2; size: number }) {
        if (ms) await new Promise(r => setTimeout(r, ms));
        const vide = !Array.from(pos.board).some(c => c !== 0);
        const base = { winrate: 0.5, ownership: new Float32Array(pos.size * pos.size), visits: 64, ms: 1, engine: 'factice' };
        if (vide && pos.size === 9) {
          return { ...base, lead: 5, moves: [
            { move: idx('D4'), visits: 40, lead: 5 },
            { move: idx('F4'), visits: 20, lead: 4.1 },
            { move: idx('C5'), visits: 20, lead: 3.5 },
            { move: idx('E5'), visits: 20, lead: -5 },
          ] };
        }
        return { ...base, lead: pos.toPlay === 1 ? -5 : 5, moves: [] };
      },
    };
  }, attente);
}

// Partie d'OGS en 9 × 9 : Noir (« florian_go ») ouvre en E5, puis les deux passent.
const OGS_9 = `(;FF[4]CA[UTF-8]GM[1]DT[2026-09-20]PC[OGS: https://online-go.com/game/67000002]
PB[florian_go]PW[Takumi88]BR[8k]WR[7k]RE[W+R]SZ[9]KM[6.5]RU[Japanese]
C[florian_go: bonne partie !]
;B[ee]BL[595.1];W[cc]WL[590.3];B[gg];W[gc];B[];W[])`;

async function ouvrirImport(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Profil' }).click();
  await page.getByRole('button', { name: /Analyser une partie/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Analyser une partie' })).toBeVisible();
}

async function capturer(page: Page, nom: string) {
  const dossier = process.env.CAPTURES_SGF;
  if (!dossier) return;
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.screenshot({ path: `${dossier}/${nom}-${theme === 'light' ? 'clair' : 'sombre'}.png` });
  }
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
}

test('import SGF : coller, choisir son camp, revue, rejouer une erreur', async ({ page }) => {
  const erreursPage: string[] = [];
  page.on('pageerror', e => erreursPage.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await kataGoFactice(page);
  await ouvrirImport(page);
  await capturer(page, 'import-saisie');

  // Un texte qui n'est pas un SGF : message clair, tutoyé, et on reste sur l'écran.
  const texte = page.getByLabel('ou colle le texte du SGF');
  await texte.fill('ma partie de dimanche');
  await page.getByRole('button', { name: 'Lire la partie' }).click();
  await expect(page.getByRole('alert')).toContainText('n’est pas un SGF lisible');
  // Un coup illégal : le numéro du coup est donné.
  await texte.fill('(;GM[1]SZ[9];B[ee];W[cc];B[ee])');
  await page.getByRole('button', { name: 'Lire la partie' }).click();
  await expect(page.getByRole('alert')).toContainText('Le coup 3 est impossible');
  await capturer(page, 'import-erreur');

  await texte.fill(OGS_9);
  await page.getByRole('button', { name: 'Lire la partie' }).click();

  // Choix du camp : aucun pseudo (sans compte), rien n'est présélectionné, l'action attend le choix.
  await expect(page.getByRole('heading', { level: 2, name: 'Quelle couleur avais-tu ?' })).toBeVisible();
  await expect(page.getByText(/9 × 9 · 6 coups · komi 6,5/)).toBeVisible();
  const analyser = page.getByRole('button', { name: 'Analyser la partie' });
  await expect(analyser).toBeDisabled();
  const noir = page.getByRole('button', { name: /Noir\s*florian_go/ });
  await expect(page.getByRole('button', { name: /Blanc\s*Takumi88/ })).toBeVisible();
  expect((await noir.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await noir.click();
  await expect(noir).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await capturer(page, 'import-camp');
  await analyser.click();

  // La revue s'ouvre sur la partie importée ; elle est gardée sur l'appareil comme la dernière revue.
  await expect(page.getByRole('heading', { level: 2, name: 'Revoir ma partie' })).toBeVisible();
  await expect(page.locator('.revue-analyse')).toHaveCount(0, { timeout: 30_000 });
  const gardee = await page.evaluate(() => JSON.parse(localStorage.getItem('go.revue.v1') ?? 'null'));
  expect(gardee).toMatchObject({ importee: true, joueur: 1, adversaire: 'Takumi88' });
  expect(gardee.sgf).not.toContain('bonne partie');
  // Pas de « Rejouer d'ici » pour une partie importée ; l'import reste accessible en action secondaire.
  await expect(page.getByRole('button', { name: "Rejouer d'ici" })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Analyser une autre partie' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await capturer(page, 'import-revue');

  // L'erreur du coup 1 (E5, Grosse erreur) : « Rejoue cette erreur ».
  const puce = page.locator('.revue-erreur', { hasText: 'Coup 1' });
  if (await puce.count()) await puce.click();
  else await page.locator('.revue-erreur-cle').click();
  await page.getByRole('button', { name: 'Rejoue cette erreur' }).first().click();
  await expect(page.getByRole('heading', { level: 2, name: 'Rejoue ton erreur' })).toBeVisible();
  await expect(plateau(page).locator('g[data-pierre]')).toHaveCount(0);
  await jouer(page, 'F4');
  await attendrePierre(page, 'F4', 'noir');
  await expect(page.getByText(/Bravo/)).toBeVisible();
  await page.getByRole('button', { name: 'Retour à la revue' }).last().click();
  await expect(page.getByRole('heading', { level: 2, name: 'Revoir ma partie' })).toBeVisible();

  // « ‹ » ramène à l'import, qui propose de revoir la dernière partie importée.
  await page.getByRole('button', { name: 'Retour à l’import' }).click();
  await expect(page.getByRole('button', { name: 'Revoir ta dernière partie importée' })).toBeVisible();

  expect(erreursPage).toEqual([]);
});

test('import SGF : 19 × 19 avec handicap, barre d’avancement et analyse annulable', async ({ page }) => {
  const erreursPage: string[] = [];
  page.on('pageerror', e => erreursPage.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await kataGoFactice(page, 400);
  await ouvrirImport(page);

  // Fox : handicap 2 (pierres AB), Blanc commence.
  const coups = ['dd', 'pp', 'qf', 'nc', 'fq', 'dn', 'cf', 'qk', 'jd', 'jp', 'cj', 'jj'];
  const fox = `(;GM[1]FF[4]SZ[19]PB[Lune]PW[Soleil]KM[0]HA[2]RU[Chinese]AP[foxwq]RE[B+12.5]AB[pd][dp]${coups.map((c, i) => `;${i % 2 ? 'B' : 'W'}[${c}]`).join('')})`;
  await page.getByLabel('ou colle le texte du SGF').fill(fox);
  await page.getByRole('button', { name: 'Lire la partie' }).click();
  await expect(page.getByText(/19 × 19 · 12 coups · komi 0 · handicap 2/)).toBeVisible();
  await page.getByRole('button', { name: /Blanc\s*Soleil/ }).click();
  await page.getByRole('button', { name: 'Analyser la partie' }).click();

  // L'analyse avance (barre), la partie reste lisible, et on peut l'arrêter.
  await expect(page.getByRole('progressbar', { name: 'Avancement de l’analyse' })).toBeVisible();
  await expect(plateau(page, 19).locator('g[data-pierre]')).not.toHaveCount(0);
  const arreter = page.getByRole('button', { name: 'Arrêter l’analyse' });
  expect((await arreter.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await capturer(page, 'import-analyse-19');
  await arreter.click();
  await expect(page.locator('.revue-analyse')).toHaveCount(0);
  await expect(page.getByText('Analyse arrêtée')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  expect(erreursPage).toEqual([]);
});
