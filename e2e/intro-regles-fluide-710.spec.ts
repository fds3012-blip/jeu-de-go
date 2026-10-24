import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { attendrePierre, fantome, jouer, toucher } from './plateau';

// #710 : l'introduction des règles se lit comme elle se joue. Expliquer, puis faire ; la bulle de Mochi décrit toujours
// l'écran ; chaque geste réussi répond tout de suite ; « Continuer » est dit par la bulle. Parcours au doigt, avec les
// animations (les démonstrations se jouent vraiment), puis en mouvements réduits.

const SANS_REPONSE = (baseURL: string) => ({ storageState: { cookies: [], origins: [{ origin: baseURL, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] } });
const bulle = (page: Page) => page.locator('.mochi-bulle p');
const action = (page: Page, nom: string) => page.locator('.lecon-actions').getByRole('button', { name: nom, exact: true });
const plateauDemo = (page: Page) => page.locator('.lecteur-plateau');

async function ouvrir(browser: Browser, baseURL: string, o: { w?: number; h?: number; reduit?: boolean; theme?: 'dark' | 'light' } = {}) {
  const ctx = await browser.newContext({ ...SANS_REPONSE(baseURL), viewport: { width: o.w ?? 390, height: o.h ?? 844 }, reducedMotion: o.reduit ? 'reduce' : 'no-preference',
    colorScheme: o.theme ?? 'dark', hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByRole('region', { name: 'Tu connais le go ?' }).getByRole('button', { name: 'Jamais joué', exact: true }).click();
  await expect(page.getByTestId('notion')).toBeVisible();
  return { ctx, page };
}

/** Écran 1 (plateau, #712) : toucher C3, puis « Continuer ». */
async function passerPlateau(page: Page) {
  await toucher(page, 'C3', 7);
  await action(page, 'Continuer').click();
}

/** Rien ne défile : l'écran de l'introduction tient dans la fenêtre (épure P5). */
async function tient(page: Page, largeur: number, etat = '') {
  const m = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, vh: innerHeight, w: document.documentElement.scrollWidth }));
  expect(m.h, `${etat} ${JSON.stringify(m)}`).toBeLessThanOrEqual(m.vh);
  expect(m.w).toBeLessThanOrEqual(largeur);
}

test('au doigt, avec les animations : plateau, poser, puis les libertés montrées avant d’être demandées', async ({ browser, baseURL }) => {
  const { ctx, page } = await ouvrir(browser, baseURL!);

  // Écran 1 : le plateau et ses lettres. Une touche répond, la colonne C et la ligne 3 s'allument.
  await expect(page.getByTestId('notion')).toHaveText('Mot du goCroisement');
  await expect(bulle(page)).toContainText('Touche C3.');
  await expect(plateauDemo(page)).toHaveAttribute('data-demo', 'geste');
  await toucher(page, 'E5', 7);
  await expect(bulle(page)).toHaveText('Cherche la colonne C, en haut, puis la ligne 3, sur le côté.');
  await toucher(page, 'C3', 7);
  await expect(fantome(page, 7)).toHaveCount(0);
  await expect(bulle(page)).toContainText('Oui, C3 : colonne C, ligne 3.');
  await expect(page.locator('.etapes')).toHaveAttribute('aria-valuenow', '1');
  await expect(action(page, 'Continuer')).toHaveClass(/cta-appel/);
  await tient(page, 390);
  await action(page, 'Continuer').click();

  // Écran 1 : le mot, la phrase qui explique, rien d'autre à toucher que le point vert.
  await expect(page.getByTestId('notion')).toHaveText('Mot du goTour de jeu');
  await expect(bulle(page)).toContainText('Une pierre se pose sur un croisement des lignes');
  await expect(action(page, 'Continuer')).toHaveCount(0);
  await tient(page, 390);
  await toucher(page, 'D4', 7);
  await expect(fantome(page, 7)).toHaveCount(1); // première touche : la pierre fantôme, comme en partie
  await toucher(page, 'D4', 7);
  await attendrePierre(page, 'D4', 'noir', 7);
  // Le geste est fait : la bulle ne parle plus du point vert, elle dit ce qui se passe et où toucher ensuite.
  await expect(bulle(page)).toContainText('Bien joué ! Chacun son tour');
  await expect(bulle(page)).not.toContainText('point vert');
  await expect(page.locator('.mochi-bulle')).toHaveClass(/verdict-juste/);
  await expect(page.locator('.etapes')).toHaveAttribute('aria-valuenow', '2');
  await expect(page.getByTestId('bulle-suite')).toHaveText('Touche « Continuer ».');
  await expect(action(page, 'Continuer')).toHaveClass(/cta-appel/);
  await attendrePierre(page, 'E5', 'blanc', 7);
  await tient(page, 390);
  await action(page, 'Continuer').click();

  // Écran 3 : le but, le territoire qui se colorie d'abord, puis la demande.
  await expect(page.getByTestId('notion')).toHaveText('Mot du goTerritoire');
  await expect(plateauDemo(page)).toHaveAttribute('data-demo', 'en-cours');
  await expect(bulle(page)).toHaveText('Le but : entourer plus de territoire que l’autre. Ici, tes pierres entourent des croisements vides : ton territoire.');
  await expect(plateauDemo(page)).toHaveAttribute('data-demo', 'geste', { timeout: 8000 });
  await expect(bulle(page)).toContainText('À toi : touches-en un.');
  await toucher(page, 'B4', 7);
  await expect(bulle(page)).toContainText('Le but : entourer plus de territoire que Blanc');
  await action(page, 'Continuer').click();

  // Écran 4 : la démonstration se joue d'abord (les libertés s'allument), rien à toucher encore.
  await expect(page.getByTestId('notion')).toHaveText('Mot du goLiberté');
  await expect(plateauDemo(page)).toHaveAttribute('data-demo', 'en-cours');
  await expect(bulle(page)).toContainText('Regarde les libertés de cette pierre');
  await expect(action(page, 'Continuer')).toHaveCount(0);
  // Puis la demande, une fois les 4 libertés allumées.
  await expect(plateauDemo(page)).toHaveAttribute('data-demo', 'geste', { timeout: 8000 });
  await expect(bulle(page)).toContainText('celle-ci en a 4. À toi : touches-en une.');
  await expect(action(page, 'Continuer')).toHaveCount(0);
  // Une diagonale n'est pas une liberté : une seule touche répond, sans pierre fantôme.
  await toucher(page, 'C5', 7);
  await expect(bulle(page)).toHaveText('Une liberté touche ta pierre par une ligne, pas en diagonale.');
  await expect(fantome(page, 7)).toHaveCount(0);
  await toucher(page, 'D5', 7);
  await expect(fantome(page, 7)).toHaveCount(0);
  await expect(bulle(page)).toContainText('Oui, c’est une liberté !');
  await expect(page.locator('.etapes')).toHaveAttribute('aria-valuenow', '4');
  await expect(page.getByTestId('bulle-suite')).toBeVisible();
  await tient(page, 390);
  await action(page, 'Continuer').click();

  // Écran 5 : la capture ; le point vert est montré avant d'être demandé.
  await expect(page.getByTestId('notion')).toHaveText('Mot du goCapture');
  await expect(bulle(page)).toContainText('La blanche n’en a plus qu’une : joue sur le point vert.');
  await ctx.close();
});

for (const [w, h] of [[390, 844], [320, 568]] as const) {
  for (const theme of ['dark', 'light'] as const) {
    test(`${w} × ${h}, ${theme === 'dark' ? 'sombre' : 'clair'} : le mot du go, la bulle et le pointeur sont lisibles (axe), l’écran ne défile pas`, async ({ browser, baseURL }) => {
      const { ctx, page } = await ouvrir(browser, baseURL!, { w, h, theme, reduit: true });
      await passerPlateau(page);
      await toucher(page, 'D4', 7); await toucher(page, 'D4', 7);
      await attendrePierre(page, 'E5', 'blanc', 7);
      await expect(page.getByTestId('bulle-suite')).toBeVisible();
      await tient(page, w);
      const bas = await action(page, 'Continuer').boundingBox();
      expect(bas!.y + bas!.height).toBeLessThanOrEqual(h);
      expect(bas!.height).toBeGreaterThanOrEqual(44);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map(v => v.id)).toEqual([]);
      await ctx.close();
    });
  }
}

test('mouvements réduits : la démonstration est déjà finie, la demande s’affiche tout de suite avec sa définition', async ({ browser, baseURL }) => {
  const { ctx, page } = await ouvrir(browser, baseURL!, { reduit: true });
  await passerPlateau(page);
  await toucher(page, 'D4', 7); await toucher(page, 'D4', 7);
  await attendrePierre(page, 'E5', 'blanc', 7);
  await action(page, 'Continuer').click();
  await expect(plateauDemo(page)).toHaveAttribute('data-demo', 'geste');
  // Sans la phrase « Regarde… », la demande se suffit : elle définit le territoire (puis la liberté).
  await expect(bulle(page)).toContainText('Les croisements vides que tes pierres entourent sont ton territoire');
  await toucher(page, 'B4', 7);
  await action(page, 'Continuer').click();
  await expect(bulle(page)).toContainText('Les libertés sont les croisements vides collés à une pierre');
  await expect(page.locator('.cta-appel')).toHaveCount(0);
  await ctx.close();
});

for (const [w, h] of [[390, 844], [320, 568]] as const) {
  test(`${w} × ${h} : de l’écran 1 au dernier, chaque état tient sans défiler, avec son mot du go et sa bulle`, async ({ browser, baseURL }) => {
    const { ctx, page } = await ouvrir(browser, baseURL!, { w, h, reduit: true });
    const mots = ['Croisement', 'Tour de jeu', 'Territoire', 'Liberté', 'Capture', 'Atari', 'Coup interdit', 'Ko', 'Passer', 'Compte'];
    // Par écran : les coups joués (un faux d'abord s'il y en a un), puis « Continuer » (ou « Terminer »).
    const gestes: string[][] = [['E5', 'C3'], ['A1', 'D4'], ['F4', 'B4'], ['C5', 'D5'], ['A1', 'D3'], ['B2', 'D3'], ['A1', 'G5'], ['D2', 'C4'], [], []];
    for (let i = 0; i < 10; i++) {
      await expect(page.getByTestId('notion')).toHaveText(`Mot du go${mots[i]}`);
      await expect(page.locator('.etapes')).toHaveAttribute('aria-valuenow', String(i));
      await tient(page, w, `écran ${i + 1} avant`);
      for (const p of gestes[i]) {
        if (i === 0) await toucher(page, p, 7);
        else if (i === 1 && p === 'D4') { await toucher(page, 'D4', 7); await toucher(page, 'D4', 7); } else await jouer(page, p, 7);
        await tient(page, w, `écran ${i + 1} après ${p}`);
      }
      if (i === 8) {
        await page.locator('.choix').getByRole('button', { name: 'Je joue encore' }).click();
        await tient(page, w, 'écran 9 mauvaise réponse');
        await page.locator('.choix').getByRole('button', { name: 'Je passe' }).click();
      }
      if (i === 9) {
        await page.locator('.choix').getByRole('button', { name: 'Blanc' }).click();
        await tient(page, w, 'écran 10 mauvaise réponse');
        await page.locator('.choix').getByRole('button', { name: 'Noir' }).click();
      }
      // Chaque geste réussi allume le point de progression et dit où toucher.
      await expect(page.locator('.etapes')).toHaveAttribute('aria-valuenow', String(i + 1));
      await expect(page.getByTestId('bulle-suite')).toBeVisible();
      await tient(page, w, `écran ${i + 1} fait`);
      await action(page, i === 9 ? 'Terminer' : 'Continuer').click();
    }
    await expect(page.locator('.mini-partie')).toBeVisible(); // #715 : la mini-partie suit les règles
    await ctx.close();
  });
}
