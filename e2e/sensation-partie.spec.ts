import { expect, test, type Page } from '@playwright/test';
import { fromLabel, toLabel } from '../src/go/coords';
import { newPosition, play, type Position } from '../src/go/rules';
import { metEnAtari } from '../src/app/partie';
import { BONUS_CAPTURE } from '../src/app/rythme';
import { attendrePierre, attendreReponse, coupsJoues, jouer, message, plateau } from './plateau';

// Issue #187 : sensation en partie contre Pomme. Plateau stable au premier coup, capture du joueur fêtée.

/** Haut du plateau à l'écran. */
async function hautPlateau(page: Page): Promise<number> {
  return (await plateau(page).boundingBox())!.y;
}

/** Position lue sur le plateau affiché (Noir au trait : on ne lit qu'à notre tour). */
async function lirePosition(page: Page): Promise<Position> {
  const pos = newPosition(9);
  const pierres = await plateau(page).locator('g[data-pierre]:not([data-morte])').evaluateAll(els =>
    els.map(e => [e.getAttribute('data-point')!, e.getAttribute('data-pierre')!] as const));
  for (const [label, c] of pierres) pos.board[fromLabel(label, 9)] = c === 'noir' ? 1 : 2;
  return pos;
}

/** Un coup pour Noir : une capture si possible, sinon un atari, sinon un point sûr (au moins 2 libertés). */
function choisir(pos: Position): { p: number; capture: boolean } | null {
  const libres = Array.from({ length: 81 }, (_, i) => i).filter(i => !pos.board[i]);
  const essais = libres.map(p => ({ p, r: play(pos, p) })).filter((x): x is { p: number; r: Position } => typeof x.r !== 'string');
  const capture = essais.find(x => x.r.captures[1] > pos.captures[1]);
  if (capture) return { p: capture.p, capture: true };
  const atari = essais.find(x => metEnAtari(x.r, x.p));
  if (atari) return { p: atari.p, capture: false };
  const centre = [40, 30, 50, 32, 48, 22, 58, 38, 42, 24, 56, 20, 60];
  const sur = essais.find(x => centre.includes(x.p)) ?? essais[Math.floor(essais.length / 2)];
  return sur ? { p: sur.p, capture: false } : null;
}

const BRAVO = /^Bravo, tu captures \d+ pierres?\s!$/;

/** Un état de l'écran : horodatage (ms, horloge de la page), coups joués, phrase de Mochi, « +N » de ton couvercle. */
interface Etat { t: number; coups: number; message: string; gain: string | null }

/**
 * Journal de l'écran (#260), tenu dans la page à chaque changement du DOM. Il remplace « attendre 400 ms puis
 * relire » : sous charge, ces 400 ms côté test pouvaient dépasser l'attente de Pomme. Mêmes sélecteurs que
 * `coupsJoues` et `message` de e2e/plateau.ts (un script de page ne peut pas importer les locators).
 */
async function ouvrirJournal(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const journal: Etat[] = [];
    (window as unknown as { journalEcran: Etat[] }).journalEcran = journal;
    const noter = () => {
      const e: Etat = {
        t: performance.now(),
        coups: document.querySelectorAll('ol.coups > li:not(.vide)').length,
        message: document.querySelector('.coach p[aria-live="polite"]')?.textContent ?? '',
        gain: document.querySelector('.joueur[data-joueur="Toi"] .gain-capture')?.textContent ?? null,
      };
      const d = journal[journal.length - 1];
      if (!d || d.coups !== e.coups || d.message !== e.message || d.gain !== e.gain) journal.push(e);
    };
    new MutationObserver(noter).observe(document, { childList: true, subtree: true, characterData: true });
  });
}

async function lireJournal(page: Page): Promise<Etat[]> {
  return page.evaluate(() => (window as unknown as { journalEcran: Etat[] }).journalEcran);
}

test('le plateau ne bouge pas au premier coup, intro de Mochi comprise (±2 px)', async ({ page }) => {
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(page.getByText(/Le but\s: entourer plus de territoire que Pomme/)).toBeVisible();
  const avant = await hautPlateau(page);
  await jouer(page, 'E5');
  // #260 : Pomme répond en 60 ms en e2e. On attend ta pierre, pas « un seul coup joué » : sa réponse peut déjà être là.
  await attendrePierre(page, 'E5', 'noir');
  expect(Math.abs((await hautPlateau(page)) - avant)).toBeLessThanOrEqual(2);
  // La réponse de Pomme remplace la bulle : toujours rien ne bouge.
  expect(await attendreReponse(page, 0), 'la partie ne finit pas au premier coup').toBe(false);
  await expect(message(page)).toContainText(/Pomme (joue|capture)|Atari|Passe/);
  expect(Math.abs((await hautPlateau(page)) - avant)).toBeLessThanOrEqual(2);
});

test('le plateau ne bouge pas au premier coup, sans intro (±2 px)', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('go.parties.v1', JSON.stringify({ n: 3, ordi: 3, dernier: 'pomme' }));
    localStorage.setItem('go.intro-but.v1', 'true');
  });
  await page.reload();
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  const avant = await hautPlateau(page);
  await jouer(page, 'E5');
  await attendrePierre(page, 'E5', 'noir');
  expect(Math.abs((await hautPlateau(page)) - avant)).toBeLessThanOrEqual(2);
  expect(await attendreReponse(page, 0), 'la partie ne finit pas au premier coup').toBe(false);
  expect(Math.abs((await hautPlateau(page)) - avant)).toBeLessThanOrEqual(2);
});

for (const mouvement of ['no-preference', 'reduce'] as const) {
  test(`ta capture est fêtée : « Bravo » lisible, Pomme attend${mouvement === 'reduce' ? ', pas de « +N » (mouvements réduits)' : ', « +N » vers ton couvercle'}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: mouvement, colorScheme: process.env.CAPTURE_THEME === 'light' ? 'light' : 'dark' });
    await ouvrirJournal(page);
    await page.goto('/');
    await page.locator('.cta').click();
    await expect(plateau(page)).toBeVisible();
    let captureVue = false;
    for (let tour = 0; tour < 35 && !captureVue; tour++) {
      const n = await coupsJoues(page).count();
      const pos = await lirePosition(page);
      const coup = choisir(pos);
      if (!coup) break;
      await jouer(page, toLabel(coup.p, 9));
      await expect.poll(() => coupsJoues(page).count()).toBeGreaterThan(n);
      if (coup.capture) {
        captureVue = true;
        // Captures 390 × 844 : CAPTURE_DIR et CAPTURE_THEME (dark ou light) pour la revue de design.
        if (process.env.CAPTURE_DIR && mouvement === 'no-preference') {
          await expect(message(page)).toHaveText(BRAVO);
          await page.screenshot({ path: `${process.env.CAPTURE_DIR}/capture-bravo-${process.env.CAPTURE_THEME ?? 'dark'}.png` });
        }
        expect(await attendreReponse(page, n), 'Pomme répond à ta capture').toBe(false);
        // #260 : on relit ce que l'écran a montré, horodaté dans la page (la charge de la machine ne fausse rien).
        const j = await lireJournal(page);
        const debut = j.findIndex(e => BRAVO.test(e.message));
        const reponse = j.findIndex(e => e.coups >= n + 2);
        expect(debut, 'le « Bravo » s’affiche').toBeGreaterThanOrEqual(0);
        expect(j[debut].coups, 'le « Bravo » arrive avec ta pierre, avant la réponse de Pomme').toBe(n + 1);
        expect(reponse).toBeGreaterThan(debut);
        // Jusqu'à la réponse de Pomme, le « Bravo » reste, avec le « +N » vers ton couvercle (aucun en mouvements réduits).
        for (const e of j.slice(debut, reponse)) {
          expect(e.message).toMatch(BRAVO);
          if (mouvement === 'reduce') expect(e.gain).toBeNull();
          else expect(e.gain).toMatch(/^\+\d+$/);
        }
        // Pomme attend : le « Bravo » se lit au moins BONUS_CAPTURE ms avant sa réponse.
        expect(j[reponse].t - j[debut].t).toBeGreaterThanOrEqual(BONUS_CAPTURE);
        await expect(page.locator('.joueur[data-joueur="Toi"] .gain-capture')).toHaveCount(0);
      }
      else if (await attendreReponse(page, n)) break;
    }
    expect(captureVue, 'aucune capture en 35 coups').toBe(true);
  });
}
