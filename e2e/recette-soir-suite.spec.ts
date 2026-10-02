import { expect, test, type Browser, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { brancher, fauxServeur } from './fauxSupabase';
import { mesurer } from './mesures';
import { jouer, partieADeux, plateau as goban } from './plateau';
import { LESSONS_FR } from '../src/content/lessons';

// Suite de la recette du 02/10 au soir (docs/qa/recette-2026-10-02-soir.md, « Laissé aux responsables ») et défauts
// vus sur les captures du lot X (#398). Chaque test porte le numéro du défaut. En 390 × 844 et 320 × 568 ; avec
// RECETTE_SUITE=<dossier>, chaque état est capturé en clair et en sombre (JPEG) dans ce dossier.

const DOSSIER = process.env.RECETTE_SUITE;
const TAILLES = [[390, 844], [320, 568]] as const;

/** Capture l'écran en clair puis en sombre (si RECETTE_SUITE est posé), et revient au clair. */
async function photo(page: Page, nom: string) {
  if (!DOSSIER) return;
  mkdirSync(DOSSIER, { recursive: true });
  const largeur = page.viewportSize()!.width;
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.waitForTimeout(150);
    await page.screenshot({ path: join(DOSSIER, `${nom}-${largeur}-${theme === 'light' ? 'clair' : 'sombre'}.jpg`), type: 'jpeg', quality: 80 });
  }
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
}

async function preparer(page: Page, largeur: number, hauteur: number, lecons?: Record<string, number>) {
  if (lecons) await page.addInitScript(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), lecons);
  await page.setViewportSize({ width: largeur, height: hauteur });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
}

/** Haut de la barre de navigation (ou bas de l'écran sans barre). */
const hautNav = (page: Page) => page.evaluate(() => document.querySelector('nav')?.getBoundingClientRect().top ?? innerHeight);

for (const [largeur, hauteur] of TAILLES) {
  // ---------- L14 et lot X : fin de leçon et fin de chapitre ----------
  test(`L14, fin de leçon (${largeur}) : la leçon suivante nommée une seule fois, sur le lien`, async ({ page }) => {
    await preparer(page, largeur, hauteur, { l1: 5 });
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
    await page.getByRole('button', { name: 'Reprendre la leçon : Libertés et capture' }).click();
    await jouer(page, 'E4');
    await page.getByRole('button', { name: 'Terminer la leçon' }).click();
    await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();
    await photo(page, 'l14-fin-lecon');
    // Plus de « Prochain pas : Atari » au-dessus des boutons : le lien dit lui-même où il mène.
    await expect(page.locator('.fin-prochain')).toHaveCount(0);
    await expect(page.locator('.fin-lecon')).not.toContainText('Prochain pas');
    const suivante = page.getByRole('button', { name: 'Leçon suivante : Atari', exact: true });
    await expect(suivante).toHaveClass(/\blien\b/);
    expect((await suivante.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // Tout tient au-dessus de la barre, sans défiler.
    const bas = (await page.getByRole('button', { name: 'Retour au chemin' }).boundingBox())!;
    expect(bas.y + bas.height).toBeLessThanOrEqual(await hautNav(page));
  });

  test(`lot X, fin de chapitre (${largeur}) : « Retour au chemin » au-dessus de la barre`, async ({ page }) => {
    await preparer(page, largeur, hauteur, { l1: 6, l2: 6, l3: 8, l4: 5, l5: 5, l6: 6, l7: 5 });
    await page.addInitScript(() => localStorage.setItem('go.settings.v1', JSON.stringify({ celebrations: false })));
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
    await page.getByRole('button', { name: /^Reprendre la leçon : / }).click();
    const quiz = page.locator('.choix');
    await expect(quiz).toBeVisible();
    // Dernière étape de la leçon 7 : un quiz ; la bonne réponse est celle qui mène à « Terminer la leçon ».
    for (const choix of await quiz.getByRole('button').all()) {
      await choix.click();
      if (await page.getByRole('button', { name: 'Terminer la leçon' }).isVisible()) break;
    }
    await page.getByRole('button', { name: 'Terminer la leçon' }).click();
    await expect(page.getByRole('heading', { name: 'Chapitre terminé' })).toBeVisible();
    await photo(page, 'x-fin-chapitre');
    // « Prochain pas : Joue contre Pomme » répétait le bouton principal (L14).
    await expect(page.locator('.fin-prochain')).toHaveCount(0);
    await expect(page.locator('.fin-lecon .cta')).toHaveCount(1);
    // Chaque action de la fin se voit entière au-dessus de la barre des onglets, sans défiler.
    const nav = await hautNav(page);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    for (const b of await page.locator('.fin-actions button').all()) {
      const r = (await b.boundingBox())!;
      expect(r.y + r.height, await b.innerText()).toBeLessThanOrEqual(nav);
      expect(r.height).toBeGreaterThanOrEqual(44);
    }
  });

  // ---------- Lot X : série d'entraînement (surtitre rogné, vide sous le plateau) ----------
  test(`lot X, série d'entraînement (${largeur}) : en-tête jamais rogné, verdict collé au plateau`, async ({ page }) => {
    await preparer(page, largeur, hauteur, { l1: 5 });
    await page.addInitScript(() => localStorage.setItem('go.settings.v1', JSON.stringify({ celebrations: false })));
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
    // Fin de la leçon 1 : elle propose l'entraînement (a02, n02, a03).
    await page.getByRole('button', { name: 'Reprendre la leçon : Libertés et capture' }).click();
    await jouer(page, 'E4');
    await page.getByRole('button', { name: 'Terminer la leçon' }).click();
    const pratique = page.getByRole('button', { name: /^Entraîne-toi/ });
    await pratique.click();
    await expect(page.locator('.serie-pratique')).toHaveAttribute('data-rang', '1');
    await expect(page.getByRole('heading', { name: 'Capture au bord' })).toBeVisible();

    /** En-tête : chaque ligne de texte est entière à l'écran, ou entièrement sortie par le haut (jamais coupée). */
    const enteteEntiere = async (moment: string) => {
      const lignes = await page.locator('.lecteur-tete small, .lecteur-tete h2').evaluateAll(els => els.map(e => {
        const r = e.getBoundingClientRect();
        return { texte: (e as HTMLElement).innerText, haut: r.top, bas: r.bottom };
      }));
      for (const l of lignes) expect(l.haut >= -0.5 || l.bas <= 0.5, `${moment} : « ${l.texte} » coupé (${l.haut} → ${l.bas})`).toBe(true);
    };
    /** Vide entre le dernier élément au-dessus de la feuille (plateau ou Mochi) et le haut de la feuille de verdict. */
    const vide = () => page.evaluate(() => {
      const feuille = document.querySelector('.verdict')!.getBoundingClientRect();
      const dessus = [...document.querySelectorAll('.lecteur > .board-wrap, .lecteur > .lecteur-mochi')]
        .filter(e => getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden')
        .map(e => e.getBoundingClientRect().bottom);
      return feuille.top - Math.max(...dessus);
    });

    // Erreur d'abord : la feuille monte, la page défile pour montrer le plateau entier.
    await jouer(page, 'A9');
    await expect(page.locator('.verdict-revoir')).toBeVisible();
    await page.waitForTimeout(300);
    await photo(page, 'x-serie-erreur');
    await enteteEntiere('erreur');
    // La feuille reste posée sur la barre des onglets (jamais en l'air), le coup joué visible au-dessus d'elle.
    const feuille = (await page.locator('.verdict').boundingBox())!;
    expect(Math.abs(feuille.y + feuille.height - await hautNav(page))).toBeLessThanOrEqual(2);
    const plateau = (await page.locator('.lecteur > .board-wrap').boundingBox())!;
    expect(plateau.y).toBeLessThan(feuille.y);
    if (largeur === 390) expect(await vide()).toBeLessThanOrEqual(24);

    // Puis la bonne réponse : « Bravo », l'XP et la suite, au même endroit.
    await jouer(page, 'E2');
    await expect(page.locator('.verdict-juste')).toBeVisible();
    await page.waitForTimeout(300);
    await photo(page, 'x-serie-reussi');
    await enteteEntiere('réussi');
    if (largeur === 390) expect(await vide()).toBeLessThanOrEqual(24);
    // La feuille reste posée sur la barre des onglets et l'action principale reste entière à l'écran.
    const suivant = (await page.getByRole('button', { name: 'Problème suivant' }).boundingBox())!;
    expect(suivant.y + suivant.height).toBeLessThanOrEqual(await hautNav(page));
  });

  // ---------- Lot X : la même chose en 13 × 13 (leçon 8, série d'ouverture), là où le défaut a été vu ----------
  test(`lot X, série 13 × 13 (${largeur}) : le surtitre « Entraînement » jamais rogné après le défilement`, async ({ page }) => {
    const i = LESSONS_FR.findIndex(l => l.id === 'l8');
    const progres = { ...Object.fromEntries(LESSONS_FR.slice(0, i).map(l => [l.id, l.steps.length])), l8: LESSONS_FR[i].steps.length - 1 };
    await preparer(page, largeur, hauteur, progres);
    await page.addInitScript(() => localStorage.setItem('go.settings.v1', JSON.stringify({ celebrations: false })));
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
    await page.getByRole('button', { name: `Reprendre la leçon : ${LESSONS_FR[i].title}` }).click();
    await jouer(page, 'C5');
    await page.getByRole('button', { name: 'Terminer la leçon' }).click();
    await page.getByRole('button', { name: /^Entraîne-toi/ }).click();
    await expect(goban(page, 13)).toBeVisible();
    // Erreur type (2e ligne, au bord du coin libre) : la feuille monte, la page défile pour montrer le plateau.
    await jouer(page, 'B12', 13);
    await expect(page.locator('.verdict-revoir')).toBeVisible();
    await page.waitForTimeout(300);
    await photo(page, 'x-serie-13-erreur');
    for (const l of await page.locator('.lecteur-tete small, .lecteur-tete h2').evaluateAll(els => els.map(e => {
      const r = e.getBoundingClientRect();
      return { texte: (e as HTMLElement).innerText, haut: r.top, bas: r.bottom };
    }))) expect(l.haut >= -0.5 || l.bas <= 0.5, `« ${l.texte} » coupé (${l.haut} → ${l.bas})`).toBe(true);
    // Le coup joué (B12) reste au-dessus de la feuille.
    const feuille = (await page.locator('.verdict').boundingBox())!;
    const faux = (await page.locator('[data-point="B12"]').boundingBox())!;
    expect(faux.y + faux.height).toBeLessThanOrEqual(feuille.y);
  });

  // ---------- L12, L7, L5, L4 : une partie à deux jusqu'à la revue ----------
  test(`L12, L7, L5 : comptage, récit du score et fin de partie (${largeur})`, async ({ page }) => {
    test.setTimeout(120_000);
    await preparer(page, largeur, hauteur);
    await page.clock.install();
    await partieADeux(page);
    for (let r = 1; r <= 9; r++) { await jouer(page, `E${r}`); await jouer(page, `F${r}`); }
    const passer = page.getByRole('button', { name: 'Passer' });
    await passer.click();
    await jouer(page, 'B5');
    await passer.click();
    await passer.click();
    const valider = page.getByRole('button', { name: 'Valider le score' });
    await expect(valider).toBeEnabled({ timeout: 10_000 });
    const b5 = page.locator('[data-point="B5"]');
    if ((await b5.getAttribute('data-morte')) === null) await jouer(page, 'B5');
    await expect(b5).toHaveAttribute('data-morte', '');
    await photo(page, 'l12-comptage');
    // L12 : pendant le comptage, aucune pierre de joueur grisée : c'est aux joueurs de valider.
    const opacites = await page.locator('.joueur .portrait, .joueur .joueur-nom b').evaluateAll(els => els.map(e => getComputedStyle(e).opacity));
    expect(opacites.every(o => o === '1'), opacites.join(' ')).toBe(true);

    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
    await valider.click();
    const recit = page.locator('.recit');
    await expect(recit).toBeVisible();
    await page.clock.runFor(2600);
    await photo(page, 'l7-recit');
    // L7 : le signe colle au nombre, et le moins est un vrai signe moins (U+2212), jamais un trait d'union.
    await expect(recit).toContainText('+6,5 komi pour Blanc');
    await expect(recit).toContainText('+1 prisonnier pour Noir');
    expect(await recit.innerText()).not.toMatch(/[+−-] \d/);

    await page.clock.runFor(1200);
    await page.clock.resume();
    await expect(page.getByRole('heading', { level: 2, name: 'Noir gagne' })).toBeVisible();
    // L5 : l'XP de la partie se lit dans l'écran de fin, sous le résultat, jamais posée sur le plateau.
    const xp = page.locator('.fin-feuille [data-testid="pastille-xp"]');
    await page.waitForTimeout(200);
    await photo(page, 'l5-fin');
    await expect(xp).toBeVisible();
    await expect(page.locator('.annonce-xp [data-testid="pastille-xp"]')).toHaveCount(0);
    const pastille = (await xp.boundingBox())!;
    const titre = (await page.locator('.fin-titre').boundingBox())!;
    expect(pastille.y).toBeGreaterThanOrEqual(titre.y + titre.height);
    // Elle reste à sa place après l'annonce (rien ne saute) : toujours là 4 s plus tard, et toujours seule.
    await page.waitForTimeout(4000);
    await expect(xp).toBeVisible();
    await expect(page.getByTestId('pastille-xp')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur);

    // L4 : la courbe « Qui mène » de la revue.
    await page.getByRole('button', { name: 'Revoir ma partie' }).click();
    await expect(page.locator('.revue-analyse')).toHaveCount(0, { timeout: 90_000 });
    await page.locator('.revue-courbe').scrollIntoViewIfNeeded();
    await photo(page, 'l4-revue');
  });

  // ---------- L8 : Problèmes sans compte ----------
  test(`L8, Problèmes sans compte (${largeur}) : « Crée ton compte », comme partout depuis #343`, async ({ browser, baseURL }) => {
    const { page } = await avecServeur(browser, baseURL, largeur, hauteur);
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: /^Problèmes/ }).click();
    const invitation = page.locator('.invitation');
    await invitation.scrollIntoViewIfNeeded();
    await photo(page, 'l8-problemes');
    await expect(invitation).toContainText('Crée ton compte pour garder ta série');
    await expect(invitation).not.toContainText('Connecte-toi');
    const bouton = invitation.getByRole('button', { name: 'Créer mon compte' });
    await expect(bouton).toBeVisible();
    expect((await bouton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.context().close();
  });

  // ---------- L10 : badges verrouillés du Profil ----------
  test(`L10, Profil (${largeur}) : chiffres des badges à gagner lisibles (AA) en clair et en sombre`, async ({ page }) => {
    await preparer(page, largeur, hauteur);
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: /^Profil/ }).click();
    const vitrine = page.locator('.vitrine');
    await vitrine.scrollIntoViewIfNeeded();
    await photo(page, 'l10-badges');
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      // Le texte des sceaux est dans un SVG : la mesure partagée ne le voit pas, on mesure l'encre sur le fond du sceau.
      const ratios = await page.locator('.sceau-badge.eteint .s-texte').evaluateAll(els => els.map(e => {
        const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
        const lum = (rgb: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); };
        const s = getComputedStyle(e);
        const fondEl = e.closest('svg')!.querySelector('.b-fond')!;
        let fond = parse(getComputedStyle(fondEl).fill);
        // « 7 » est dessiné dans la flamme (la forme juste avant lui) : son fond est la flamme posée sur le sceau.
        const forme = e.previousElementSibling;
        if (forme?.classList.contains('s-plein')) {
          const f = getComputedStyle(forme), c = parse(f.fill), o = parseFloat(f.opacity);
          fond = c.slice(0, 3).map((v, i) => v * o + fond[i] * (1 - o));
        }
        const encre = parse(s.fill);
        const a = parseFloat(s.opacity) * parseFloat(s.fillOpacity || '1');
        const vue = encre.slice(0, 3).map((v, i) => v * a + fond[i] * (1 - a));
        const [l1, l2] = [lum(vue), lum(fond)].sort((x, y) => y - x);
        return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
      }));
      expect(ratios.length).toBeGreaterThan(0);
      for (const r of ratios) expect(r, `contraste d'un chiffre de badge (${theme})`).toBeGreaterThanOrEqual(4.5);
    }
  });

  // ---------- L11 : liens des conditions dans la case d'âge ----------
  test(`L11, création de compte (${largeur}) : les conditions s'ouvrent par une cible de 44 px`, async ({ browser, baseURL }) => {
    const { page } = await avecServeur(browser, baseURL, largeur, hauteur, { 'go.lecons.v1': JSON.stringify({ l1: 99, l2: 99, l3: 99 }) });
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: /^Apprendre/ }).click();
    await page.locator('.apprendre .cta, .chemin .cta').first().click();
    await expect(page.getByTestId('creer-compte')).toHaveAttribute('data-raison', 'lecons');
    await photo(page, 'l11-compte');
    const m = await mesurer(page, 'creer-compte', 'clair', largeur);
    expect(m.cibles, JSON.stringify(m.cibles)).toEqual([]);
    expect(m.contrastes).toEqual([]);
    const lire = page.getByRole('button', { name: 'Lire les conditions' });
    await expect(lire).toBeVisible();
    // L'action principale reste visible sans défiler (audit du 02/10, n° 8).
    const cta = (await page.locator('.creer-compte .cta, .creer-compte .btn.primary').first().boundingBox())!;
    expect(cta.y + cta.height).toBeLessThanOrEqual(hauteur);
    await lire.click();
    await expect(page.getByRole('heading', { name: /Conditions/ })).toBeVisible();
    await page.context().close();
  });
}

async function avecServeur(browser: Browser, baseURL: string | undefined, largeur: number, hauteur: number, stockage: Record<string, string> = {}) {
  const serveur = fauxServeur();
  const ctx = await browser.newContext({
    viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
    colorScheme: 'light', reducedMotion: 'reduce', timezoneId: 'Europe/Paris',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
  });
  const page = await brancher(ctx, serveur, stockage);
  return { page, serveur };
}
