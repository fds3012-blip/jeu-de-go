import { mkdirSync } from 'node:fs';
import { onglet } from './onglet';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Request } from '@playwright/test';
import { mesurer } from './mesures';
import { attendrePierre, jouer, plateau, toucher } from './plateau';
import { faireMoment, surMoment } from './decouverte';
import { gagnerLaMiniPartie } from './mini';
import { SCENARIO } from '../src/content/decouverte';

// #523 : au tout premier lancement, « Tu connais le go ? » avec Mochi et trois réponses de même poids, plus « Plus tard ».
// « Jamais joué » → introduction interactive des règles (10 écrans, un geste chacun, aide après un mauvais geste), puis la
// partie de découverte ; « Un peu » → rappel express (chaque écran passable par « Je sais »), puis découverte ou Pomme ;
// « Je sais jouer » → l'accueil épuré d'avant (#487). La question vit avec le bandeau de consentement (#485) sans le
// cacher ni être cachée. Captures facultatives : CAPTURES_523=<dossier>.

const CAPTURES = process.env.CAPTURES_523;
const VIDE = { storageState: { cookies: [], origins: [] } };
/** Appareil neuf, consentement déjà répondu (la question seule). */
const SANS_REPONSE = (baseURL: string) => ({ storageState: { cookies: [], origins: [{ origin: baseURL, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] } });

const question = (page: Page) => page.getByRole('region', { name: 'Tu connais le go ?' });
const reponse = (page: Page, nom: string) => question(page).getByRole('button', { name: nom, exact: true });
const bulle = (page: Page) => page.locator('.mochi-bulle p');
const action = (page: Page, nom: string) => page.locator('.lecon-actions').getByRole('button', { name: nom, exact: true });

async function capture(page: Page, nom: string) {
  if (!CAPTURES) return;
  mkdirSync(CAPTURES, { recursive: true });
  await page.screenshot({ path: join(CAPTURES, `${nom}.png`) });
}

/** Un élément est entier à l'écran, au-dessus du bandeau s'il est là, et c'est bien lui qui reçoit un toucher en son centre. */
async function libre(el: ReturnType<Page['locator']>) {
  return el.evaluate((n: HTMLElement) => {
    const b = n.getBoundingClientRect();
    const accord = document.querySelector<HTMLElement>('.accord[open]')?.getBoundingClientRect();
    const dessus = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return { haut: Math.round(b.top), bas: Math.round(b.bottom), bandeau: accord ? Math.round(accord.top) : innerHeight, vue: innerHeight,
      touche: !!dessus && (n === dessus || n.contains(dessus)), w: Math.round(b.width), h: Math.round(b.height) };
  });
}

test.describe('coexistence avec le bandeau de consentement', () => {
  test.use(VIDE);
  for (const [largeur, hauteur] of [[320, 568], [390, 844]] as const) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${largeur} × ${hauteur}, ${theme === 'dark' ? 'sombre' : 'clair'} : question et bandeau entiers, ni l’un ni l’autre recouvert`, async ({ page }) => {
        await page.setViewportSize({ width: largeur, height: hauteur });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await page.goto('/');
        const bandeau = page.getByRole('dialog', { name: 'Tu m’aides à chasser les bugs ?' });
        await expect(bandeau).toBeVisible();
        await expect(question(page)).toBeVisible();
        await expect(question(page).getByRole('heading', { level: 2, name: 'Tu connais le go ?' })).toBeVisible();
        // Pas l'accueil épuré en même temps : une seule chose à faire.
        await expect(page.locator('.accueil')).toHaveCount(0);
        await capture(page, `question-bandeau-${largeur}-${theme === 'dark' ? 'sombre' : 'clair'}`);

        // Les trois réponses et « Plus tard » : entiers, au-dessus du bandeau, touchables en leur centre ; 44 px au moins.
        const tailles: string[] = [];
        for (const nom of ['Jamais joué', 'Un peu', 'Je sais jouer', 'Plus tard']) {
          const r = await libre(question(page).getByRole('button', { name: nom, exact: true }));
          expect(r.haut, `${nom} ${JSON.stringify(r)}`).toBeGreaterThanOrEqual(0);
          expect(r.bas, `${nom} sous le bandeau ${JSON.stringify(r)}`).toBeLessThanOrEqual(r.bandeau);
          expect(r.touche, `${nom} recouvert`).toBe(true);
          expect(r.h, nom).toBeGreaterThanOrEqual(44);
          expect(r.w, nom).toBeGreaterThanOrEqual(44);
          if (nom !== 'Plus tard') tailles.push(`${r.w}×${r.h}`);
        }
        // Choix égaux : même taille, même style ; aucun n'est l'action principale.
        expect(new Set(tailles).size).toBe(1);
        const styles = await question(page).locator('.question-go-reponses button').evaluateAll(bs => bs.map(b => {
          const s = getComputedStyle(b); return [s.backgroundColor, s.color, s.fontWeight, s.fontSize, s.borderColor].join('|');
        }));
        expect(new Set(styles).size).toBe(1);
        await expect(page.locator('.cta, .btn.primary')).toHaveCount(0);
        // Le bandeau aussi reste entier et touchable (ses trois choix).
        for (const nom of ['Détails', 'Oui, j’aide', 'Non merci']) {
          const r = await libre(bandeau.getByRole('button', { name: nom }));
          expect(r.touche, `${nom} recouvert`).toBe(true);
          expect(r.bas, nom).toBeLessThanOrEqual(r.vue);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur);
        // Répondre au bandeau ne touche pas à la question, et inversement.
        await bandeau.getByRole('button', { name: 'Non merci' }).click();
        await expect(bandeau).toBeHidden();
        await expect(question(page)).toBeVisible();
      });
    }
  }

  test('lecteur d’écran et clavier : le bandeau garde le focus d’arrivée, puis Tab mène à ses choix, puis à la question', async ({ page }) => {
    await page.goto('/');
    const bandeau = page.getByRole('dialog', { name: 'Tu m’aides à chasser les bugs ?' });
    await expect(bandeau.getByRole('heading', { level: 2 })).toBeFocused();
    // La question n'est ni inerte ni cachée aux lecteurs d'écran : une région nommée par son titre, un groupe de réponses.
    expect(await page.evaluate(() => document.querySelector('.question-go')?.closest('[inert], [aria-hidden="true"]') ?? null)).toBeNull();
    await expect(question(page).getByRole('group', { name: 'Tu connais le go ?' })).toBeVisible();
    const ordre: string[] = [];
    for (let i = 0; i < 16 && ordre.length < 8; i++) {
      await page.keyboard.press('Tab');
      const nom = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.innerText?.trim() ?? '');
      if (nom && !ordre.includes(nom)) ordre.push(nom);
    }
    const iDetails = ordre.indexOf('Détails'), iJamais = ordre.indexOf('Jamais joué');
    expect(ordre.slice(iDetails, iDetails + 3)).toEqual(['Détails', 'Oui, j’aide', 'Non merci']);
    expect(ordre.slice(iJamais, iJamais + 4)).toEqual(['Jamais joué', 'Un peu', 'Je sais jouer', 'Plus tard']);
  });
});

test.describe('les trois réponses', () => {
  test.use({ reducedMotion: 'reduce' });

  test('« Plus tard » : la question part pour la session, rien n’est gardé, elle revient à la prochaine ouverture', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ ...SANS_REPONSE(baseURL!), viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    await reponse(page, 'Plus tard').click();
    await expect(question(page)).toHaveCount(0);
    // L'accueil épuré d'avant (#487), son action principale au focus.
    await expect(page.locator('.accueil .cta')).toBeFocused();
    await expect(page.getByRole('button', { name: 'Je sais déjà jouer' })).toBeVisible();
    await expect(page.getByTestId('modes')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('go.connait-go.v1'))).toBeNull();
    await page.reload();
    await expect(question(page)).toBeVisible();
    await ctx.close();
  });

  test('« Je sais jouer » : réponse gardée, accueil épuré et placement comme avant, plus de question', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ ...SANS_REPONSE(baseURL!), viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    await reponse(page, 'Je sais jouer').click();
    await expect(question(page)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('go.connait-go.v1'))).toBe('"sait"');
    await expect(page.locator('.accueil[data-epure]')).toBeVisible();
    await expect(page.locator('.accueil .cta')).toHaveText(/Joue ta première partie/);
    await page.reload();
    await expect(page.locator('.accueil .cta')).toBeVisible();
    await expect(question(page)).toHaveCount(0);
    // « Je sais déjà jouer » mène toujours au placement.
    await page.getByRole('button', { name: 'Je sais déjà jouer' }).click();
    await expect(plateau(page)).toBeVisible();
    await ctx.close();
  });

  test('« Jamais joué » : les 10 écrans, chacun un mauvais geste (aide) puis le bon, puis la partie de découverte', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ ...SANS_REPONSE(baseURL!), viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const erreurs: string[] = [];
    page.on('pageerror', e => erreurs.push(e.message));
    await page.goto('/');
    await reponse(page, 'Jamais joué').click();
    expect(await page.evaluate(() => localStorage.getItem('go.connait-go.v1'))).toBe('"jamais"');
    await expect(plateau(page, 7)).toBeVisible();
    await expect(page.locator('.lecteur-titre')).toHaveText('Les règles du go');
    expect(await page.title()).toContain('Les règles du go');

    // (i) Plateau : une lettre et un chiffre ; un mauvais croisement aide, C3 allume sa colonne et sa ligne.
    await expect(page.getByTestId('notion')).toHaveText('Mot du goCroisement');
    await expect(bulle(page)).toContainText('Chaque croisement a un nom : sa colonne (lettre) et sa ligne (chiffre, compté depuis le bas). Touche C3.');
    await expect(action(page, 'Continuer')).toHaveCount(0);
    await capture(page, 'intro-0-plateau-clair');
    await toucher(page, 'E5', 7);
    await expect(bulle(page)).toHaveText('Cherche la colonne C, en haut, puis la ligne 3, sur le côté.');
    await toucher(page, 'C3', 7); // une seule touche répond : pas de pierre fantôme (#710)
    await expect(bulle(page)).toContainText('Oui, C3 : colonne C, ligne 3.');
    await expect(page.locator('.board [data-fantome]')).toHaveCount(0);
    await expect(page.locator('.etapes')).toHaveAttribute('aria-valuenow', '1');
    await action(page, 'Continuer').click();

    // (a) Poser : le mot du go, la phrase qui explique (croisement, deux touches), mauvais point, aide ; puis le point vert.
    await expect(page.getByTestId('notion')).toHaveText('Mot du goTour de jeu');
    await expect(bulle(page)).toHaveText('Une pierre se pose sur un croisement des lignes. Noir commence : touche le point vert, puis touche-le encore.');
    await expect(action(page, 'Continuer')).toHaveCount(0);
    await capture(page, 'intro-1-poser-clair');
    await jouer(page, 'A1', 7);
    await expect(bulle(page)).toHaveText('Pose ta pierre sur le point vert.');
    await attendrePierre(page, 'A1', null, 7);
    await toucher(page, 'D4', 7);
    await toucher(page, 'D4', 7);
    await attendrePierre(page, 'D4', 'noir', 7);
    await attendrePierre(page, 'E5', 'blanc', 7);
    // #710 : la bulle ne parle plus du point vert : elle dit ce qui vient de se passer, et où toucher ensuite.
    await expect(bulle(page)).toContainText('Bien joué ! Chacun son tour');
    await expect(bulle(page)).not.toContainText('point vert');
    await expect(page.getByTestId('bulle-suite')).toHaveText('Touche « Continuer ».');
    await expect(page.locator('.etapes')).toHaveAttribute('aria-valuenow', '2');
    await capture(page, 'intro-1b-poser-fait-clair');
    await action(page, 'Continuer').click();

    // (g) Objectif : le but, le territoire montré d'abord, puis demandé ; un point blanc n'est pas à toi.
    await expect(page.getByTestId('notion')).toHaveText('Mot du goTerritoire');
    await expect(page.locator('.lecteur-plateau')).toHaveAttribute('data-demo', 'geste');
    await expect(bulle(page)).toContainText('sont ton territoire : chacun vaut 1 point. À toi : touches-en un.');
    await expect(page.locator('.demo-compteur')).toHaveAttribute('data-compteur', '21');
    await jouer(page, 'F4', 7);
    await expect(bulle(page)).toHaveText('Ton territoire est du côté de tes pierres noires, à gauche.');
    await jouer(page, 'B4', 7);
    await expect(bulle(page)).toContainText('Oui ! Le but : entourer plus de territoire que Blanc (14 points).');
    await capture(page, 'intro-3-objectif-clair');
    await action(page, 'Continuer').click();

    // (b) Libertés : montrées d'abord, demandées ensuite ; une diagonale n'en est pas une.
    await expect(page.getByTestId('notion')).toHaveText('Mot du goLiberté');
    await expect(page.locator('.lecteur-plateau')).toHaveAttribute('data-demo', 'geste');
    await expect(bulle(page)).toContainText('Les libertés sont les croisements vides collés à une pierre : celle-ci en a 4. À toi : touches-en une.');
    await expect(action(page, 'Continuer')).toHaveCount(0);
    await jouer(page, 'C5', 7);
    await expect(bulle(page)).toHaveText('Une liberté touche ta pierre par une ligne, pas en diagonale.');
    await jouer(page, 'D5', 7);
    await expect(page.locator('.lecteur-plateau')).toHaveAttribute('data-demo', 'finie');
    await expect(bulle(page)).toContainText('Oui, c’est une liberté !');
    await capture(page, 'intro-2-libertes-clair');
    await action(page, 'Continuer').click();

    // (c) Capturer.
    await expect(bulle(page)).toContainText('Pour capturer une pierre, on lui prend toutes ses libertés');
    await jouer(page, 'A1', 7);
    await expect(bulle(page)).toContainText('Touche le point vert : c’est la dernière liberté de la pierre blanche. Essaie encore.');
    await jouer(page, 'D3', 7);
    await expect(bulle(page)).toContainText('Capturée ! Elle quitte le plateau et devient ton prisonnier.');
    await attendrePierre(page, 'D4', null, 7);
    await action(page, 'Continuer').click();

    // (d) Atari : se sauver.
    await expect(bulle(page)).toContainText('est en atari');
    await jouer(page, 'B2', 7);
    await expect(bulle(page)).toContainText('Joue collé à ta pierre marquée, sur son seul croisement vide.');
    await jouer(page, 'D3', 7);
    await expect(bulle(page)).toContainText('Sauvée ! Collées, tes deux pierres partagent 3 libertés');
    await action(page, 'Continuer').click();

    // (e) Suicide interdit, sauf s'il capture : A1 est refusé et expliqué, G5 capture.
    await expect(bulle(page)).toContainText('sauf si elle capture');
    await jouer(page, 'A1', 7);
    await expect(bulle(page)).toContainText('Interdit : en A1, ta pierre n’aurait aucune liberté et ne capture rien.');
    await attendrePierre(page, 'A1', null, 7);
    await capture(page, 'intro-5-suicide-refuse-clair');
    await jouer(page, 'G5', 7);
    await expect(bulle(page)).toContainText('Permis : ta pierre capture 2 pierres et gagne 2 libertés.');
    await attendrePierre(page, 'G6', null, 7);
    await attendrePierre(page, 'G4', null, 7);
    await action(page, 'Continuer').click();

    // (f) Ko.
    await expect(bulle(page)).toContainText('C’est le ko.');
    await jouer(page, 'D2', 7);
    await expect(bulle(page)).toHaveText('Pose ta pierre sur le point vert.');
    await jouer(page, 'C4', 7);
    await attendrePierre(page, 'D4', null, 7);
    await expect(page.locator('.lecteur-plateau')).toHaveAttribute('data-demo', 'finie');
    await expect(bulle(page)).toContainText('Blanc ne peut pas reprendre en D4 (la croix)');
    await capture(page, 'intro-6-ko-clair');
    await action(page, 'Continuer').click();

    // (j) Passer : quand les deux passent, la partie s'arrête.
    await expect(page.getByTestId('notion')).toHaveText('Mot du goPasser');
    await expect(bulle(page)).toContainText('Chaque camp a fermé sa zone. Quand tu ne vois plus de coup utile, que fais-tu ?');
    await page.locator('.choix').getByRole('button', { name: 'Je joue encore' }).click();
    await expect(bulle(page)).toContainText('Quand aucun coup n’est utile, on peut passer son tour.');
    await page.locator('.choix').getByRole('button', { name: 'Je passe' }).click();
    await expect(bulle(page)).toContainText('Quand les deux joueurs passent de suite, la partie s’arrête.');
    await capture(page, 'intro-9-passer-clair');
    await action(page, 'Continuer').click();

    // (h) Compte : les totaux, le komi expliqué, qui gagne.
    await expect(page.getByTestId('notion')).toHaveText('Mot du goCompte');
    await expect(bulle(page)).toContainText('6,5 de komi (compensation, car Noir a commencé). Qui gagne');
    await capture(page, 'intro-8-compte-clair');
    await page.locator('.choix').getByRole('button', { name: 'Blanc' }).click();
    await expect(bulle(page)).toContainText('Compare 23 à 14 + 1 + 6,5');
    await page.locator('.choix').getByRole('button', { name: 'Noir' }).click();
    await expect(bulle(page)).toContainText('Noir gagne de 1,5 point');
    await action(page, 'Terminer').click();

    // #715 : « Ta première partie », la mini-partie 5 × 5 contre Pomme, gagnée en suivant l'aide de Mochi.
    await expect(page.locator('.lecteur-titre')).toHaveText('Ta première partie');
    await capture(page, 'intro-mini-clair');
    await gagnerLaMiniPartie(page);

    // Fin : une seule action, la partie de découverte (#524), au premier moment de son scénario.
    await expect(page.getByTestId('fin-intro')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Victoire !' })).toBeFocused();
    await expect(page.locator('.cta')).toHaveCount(1);
    await capture(page, 'intro-fin-clair');
    // #677 (A9) : le bouton dit ce qu'il ouvre ; « Jouer avec Mochi » reste le nom de l'entrée d'Apprendre.
    await page.getByRole('button', { name: 'Partie de découverte avec Mochi', exact: true }).click();
    await surMoment(page, SCENARIO[0].id);
    expect(await page.title()).toContain('Partie de découverte');
    await capture(page, 'decouverte-apres-intro-clair');
    // Jouée jusqu'au bout : sa fin ramène à l'accueil (et non au chemin des leçons, comme depuis Apprendre).
    for (let i = 0; i < SCENARIO.length; i++) await faireMoment(page, i);
    await page.getByTestId('fin-decouverte').locator('.cta').click();
    await expect(page.locator('.accueil')).toBeVisible();
    await expect(question(page)).toHaveCount(0);
    expect(erreurs).toEqual([]);
    await ctx.close();
  });

  test('« Un peu » : rappel express, « Je sais » passe un écran, puis « Jouer contre Pomme » (ou la découverte)', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ ...SANS_REPONSE(baseURL!), viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    await reponse(page, 'Un peu').click();
    expect(await page.evaluate(() => localStorage.getItem('go.connait-go.v1'))).toBe('"un_peu"');
    await expect(page.locator('.lecteur-titre')).toHaveText('Rappel des règles');
    await expect(bulle(page)).toContainText('Un croisement : une lettre et un chiffre. Touche C3.');
    await capture(page, 'express-1-320-clair');
    // Écrans 1 à 3 passés ; écran 4 (libertés) fait avec le bon geste ; les six autres passés.
    for (let i = 1; i <= 3; i++) await page.getByTestId('je-sais').click();
    await expect(bulle(page)).toContainText('Elle a 4 libertés');
    await jouer(page, 'D5', 7);
    await expect(page.getByTestId('je-sais')).toHaveCount(0);
    await action(page, 'Continuer').click();
    for (let i = 5; i <= 10; i++) {
      await expect(page.locator('.etapes')).toHaveAttribute('aria-valuenow', String(i - 1));
      await page.getByTestId('je-sais').click();
    }
    await gagnerLaMiniPartie(page); // #715
    await expect(page.getByTestId('fin-intro')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Victoire !' })).toBeVisible();
    await expect(page.locator('.cta')).toHaveText('Partie de découverte avec Mochi');
    await capture(page, 'express-fin-320-clair');
    await page.getByRole('button', { name: 'Jouer contre Pomme' }).click();
    await expect(plateau(page)).toBeVisible();
    expect(await page.title()).toMatch(/Pomme/);
    await ctx.close();
  });

  test('« Un peu » : « Partie de découverte avec Mochi », l’action principale de la fin, ouvre la partie de découverte', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ ...SANS_REPONSE(baseURL!), viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    await reponse(page, 'Un peu').click();
    for (let i = 1; i <= 10; i++) {
      await expect(page.locator('.etapes')).toHaveAttribute('aria-valuenow', String(i - 1));
      await page.getByTestId('je-sais').click();
    }
    await gagnerLaMiniPartie(page); // #715
    await page.getByRole('button', { name: 'Partie de découverte avec Mochi' }).click();
    await surMoment(page, SCENARIO[0].id);
    // Quitter ramène à l'accueil (là d'où l'on venait), sans reposer la question.
    await page.getByRole('button', { name: 'Quitter la partie de découverte' }).click();
    await expect(page.locator('.accueil')).toBeVisible();
    await expect(question(page)).toHaveCount(0);
    await ctx.close();
  });

  test('quitter l’introduction en route : retour à l’accueil épuré, réponse gardée, pas de nouvelle question', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ ...SANS_REPONSE(baseURL!), viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    await reponse(page, 'Jamais joué').click();
    await expect(plateau(page, 7)).toBeVisible();
    await page.getByRole('button', { name: 'Quitter' }).click();
    await expect(page.locator('.accueil .cta')).toBeVisible();
    await expect(question(page)).toHaveCount(0);
    await ctx.close();
  });
});

test.describe('« Revoir les règles »', () => {
  test.use({ reducedMotion: 'reduce' });

  test('dans le sommaire d’Apprendre, et dans l’aide ; « Retour » ramène là d’où l’on vient', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: /Apprendre/ }).click();
    const lien = page.getByTestId('revoir-regles');
    await expect(lien).toHaveText(/Revoir les règles/);
    // #652 : une entrée du sommaire, avec Ouvertures et Jouer avec Mochi.
    await expect(lien).toHaveAttribute('data-entree', 'regles');
    await lien.click();
    await expect(page.locator('.lecteur-titre')).toHaveText('Les règles du go');
    await expect(plateau(page, 7)).toBeVisible();
    await page.getByRole('button', { name: 'Quitter' }).click();
    await expect(page.getByTestId('revoir-regles')).toBeVisible();

    // Depuis l'aide (raccourci « ? »), onglet Règles.
    await page.keyboard.press('?');
    const aide = page.getByRole('dialog', { name: 'Aide' });
    await expect(aide).toBeVisible();
    await aide.getByTestId('aide-revoir-regles').click();
    await expect(aide).toBeHidden();
    await expect(page.locator('.lecteur-titre')).toHaveText('Les règles du go');
  });
});

test.describe('mesure', () => {
  const HOTE = 'https://posthog-e2e.test';
  // posthog-js jette les événements des navigateurs pilotés : on se présente comme un navigateur ordinaire.
  test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', reducedMotion: 'reduce' });

  test('connait_go, intro_regles_etape, intro_regles_quittee et intro_regles_finie partent avec leurs propriétés', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ ...SANS_REPONSE(baseURL!), viewport: { width: 390, height: 844 }, reducedMotion: 'reduce',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
    const page = await ctx.newPage();
    const envois: string[] = [];
    await page.route(`${HOTE}/**`, async route => {
      const r = route.request();
      if (r.method() === 'POST') envois.push(lireEnvoi(r));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' });
    });
    await page.addInitScript(hote => {
      localStorage.setItem('e2e.posthog.hote', hote);
      Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });
      Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => undefined });
    }, HOTE);
    await page.goto('/');
    await reponse(page, 'Un peu').click();
    // Rappel express passé écran par écran, jusqu'à la fin.
    for (let i = 1; i <= 10; i++) {
      await expect(page.locator('.etapes')).toHaveAttribute('aria-valuenow', String(i - 1));
      await page.getByTestId('je-sais').click();
    }
    await gagnerLaMiniPartie(page); // #715
    await expect(page.getByTestId('fin-intro')).toBeVisible();
    // Puis « Revoir les règles » depuis Apprendre, quitté au 1er écran (#646 : on sort d'abord de la fin, plein écran).
    await onglet(page, /Apprendre/);
    await page.getByTestId('revoir-regles').click();
    await expect(plateau(page, 7)).toBeVisible();
    await page.getByRole('button', { name: 'Quitter' }).click();
    await expect.poll(() => envois.join('\n'), { timeout: 15_000 }).toMatch(/"event":"intro_regles_quittee"/);
    const evenements = envois.join('\n').split(/(?="event":)/);
    const un = (nom: string) => evenements.filter(e => e.startsWith(`"event":"${nom}"`));
    expect(un('connait_go').join()).toMatch(/"reponse":"un_peu"/);
    const etapes = un('intro_regles_etape');
    expect(etapes.some(e => /"index":10/.test(e) && /"parcours":"express"/.test(e) && /"depuis":"accueil"/.test(e))).toBe(true);
    expect(un('intro_regles_finie').join()).toMatch(/"passees":10/);
    // #715 : la mini-partie est mesurée (commencée, première capture, finie et gagnée à la première fois).
    expect(un('mini_partie_commencee').join()).toMatch(/"rang":0/);
    expect(un('mini_partie_finie').join()).toMatch(/"gagnee":true/);
    expect(un('mini_partie_finie').join()).toMatch(/"premiere":true/);
    const quittee = un('intro_regles_quittee').join();
    expect(quittee).toMatch(/"index":1/);
    expect(quittee).toMatch(/"parcours":"complete"/);
    expect(quittee).toMatch(/"depuis":"apprendre"/);
    await ctx.close();
  });
});

/** Corps d'un envoi PostHog (gzip, base64 en formulaire ou JSON brut) ; même lecture que e2e/accueil-modes.spec.ts. */
function lireEnvoi(r: Request): string {
  const brut = r.postDataBuffer();
  if (!brut) return '';
  if (new URL(r.url()).searchParams.get('compression') === 'gzip-js' || (brut[0] === 0x1f && brut[1] === 0x8b)) return gunzipSync(brut).toString('utf8');
  const texte = brut.toString('utf8');
  if (texte.startsWith('data=')) {
    const data = decodeURIComponent(texte.slice(5).split('&')[0].replace(/\+/g, ' '));
    try { return Buffer.from(data, 'base64').toString('utf8'); } catch { return data; }
  }
  return texte;
}

test('a11y : la question et un écran de l’introduction n’ont aucune violation axe (sombre)', async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ ...SANS_REPONSE(baseURL!), viewport: { width: 390, height: 844 }, colorScheme: 'dark', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(question(page)).toBeVisible();
  const m = await mesurer(page, 'question', 'dark', 390);
  expect(m.cibles, JSON.stringify(m.cibles)).toEqual([]);
  expect(m.contrastes, JSON.stringify(m.contrastes)).toEqual([]);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map(v => v.id)).toEqual([]);
  await capture(page, 'question-390-sombre');
  await reponse(page, 'Jamais joué').click();
  await expect(plateau(page, 7)).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map(v => v.id)).toEqual([]);
  await capture(page, 'intro-1-poser-sombre');
  await ctx.close();
});
