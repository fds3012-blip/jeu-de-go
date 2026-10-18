import { expect, test, type Browser, type Page } from '@playwright/test';
import { ouvrirParTheme } from './problemes';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENARIO } from '../src/content/decouverte';
import { faireMoment, surMoment } from './decouverte';
import { brancher, fauxServeur } from './fauxSupabase';
import { mesurer, type Mesure } from './mesures';
import { abandonner, attendrePierre, jouer, jouerSuite, lancerADeux, passer, passerJusquAuScore, plateau, toucher, toucherCta } from './plateau';
import { ouvrirRevue, preparerRevue } from './revueFactice';

// #559 : parcours d'un nouveau joueur (docs/qa/parcours-nouveau-2026-10.md), rejoué comme Florian sur iPhone en navigation
// privée : première ouverture, règles en 8 gestes, découverte avec Mochi, placement, leçon 1, Go du jour (réussite,
// échec et réfutation), partie contre Pomme jusqu'au score et à la revue, 3e partie d'essai et « Crée ton compte »,
// mentions légales, « Ton avis compte », hors ligne, partage. Chaque écran est capturé en 390 × 844 et 320 × 568,
// clair et sombre, et mesuré (défilement, cibles sous 44 px, contraste, textes coupés). Lancement manuel seulement :
//   PARCOURS_559=<dossier des mesures> PW_PORT=4759 npx playwright test parcours-nouveau-559 --workers 1
// PARCOURS_ETAPES=01,05 : seulement ces étapes.

const DOSSIER_MESURES = process.env.PARCOURS_559;
test.skip(!DOSSIER_MESURES, 'Parcours #559 : lancer avec PARCOURS_559=<dossier>');
test.describe.configure({ mode: 'serial' });
test.use({ actionTimeout: 15_000 });

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const CAPTURES = join(RACINE, 'docs', 'qa', 'captures', 'parcours-nouveau');
const MIDI_PARIS = new Date('2026-09-27T12:00:00+02:00');

type Cfg = { largeur: number; hauteur: number; langue: 'fr' | 'en' };
const CONFIGS: Cfg[] = [{ largeur: 390, hauteur: 844, langue: 'fr' }, { largeur: 320, hauteur: 568, langue: 'fr' }, { largeur: 320, hauteur: 568, langue: 'en' }];

const VIDE = (baseURL: string, cfg: Cfg) => ({
  viewport: { width: cfg.largeur, height: cfg.hauteur }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: cfg.langue === 'en' ? 'en-US' : 'fr-FR', baseURL,
  storageState: { cookies: [], origins: cfg.langue === 'en' ? [{ origin: baseURL, localStorage: [{ name: 'go.langue.v1', value: '"en"' }] }] : [] },
});
/** Consentement et question répondus (« Je sais jouer ») : l'appareil d'un joueur qui a déjà ouvert l'app. */
const REPONDU = (baseURL: string, cfg: Cfg, extra: { name: string; value: string }[] = []) => ({
  ...VIDE(baseURL, cfg),
  storageState: { cookies: [], origins: [{ origin: baseURL, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }, { name: 'go.connait-go.v1', value: '"sait"' },
    ...(cfg.langue === 'en' ? [{ name: 'go.langue.v1', value: '"en"' }] : []), ...extra] }] },
});

async function capturer(page: Page, cfg: Cfg, ecran: string, mesures: Mesure[], options: { pleine?: boolean } = {}) {
  mkdirSync(CAPTURES, { recursive: true });
  // Les écrans chargés à la demande arrivent après ~200 ms : on attend leur contenu (sinon la première capture est vide).
  await page.waitForFunction(() => (document.querySelector('main, [role="dialog"], .app')?.textContent ?? '').trim().length > 60, null, { timeout: 5000 }).catch(() => {});
  for (const theme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.waitForTimeout(200);
    const chemin = join(CAPTURES, `${ecran}-${cfg.largeur}-${theme === 'dark' ? 'sombre' : 'clair'}-${cfg.langue}.jpg`);
    await page.screenshot({ path: chemin, type: 'jpeg', quality: 55, fullPage: !!options.pleine });
    try { mesures.push(await mesurer(page, `${ecran}-${cfg.langue}`, theme, cfg.largeur)); } catch (e) {
      mesures.push({ ecran, theme, largeur: cfg.largeur, defilement: 0, cibles: [], principales: 0, contrastes: [], coupes: [], horsEcran: [], alertes: [`mesure impossible : ${String(e).slice(0, 120)}`] });
    }
  }
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
}

async function etape(nom: string, mesures: Mesure[], cfg: Cfg, page: Page, f: () => Promise<void>) {
  const filtre = process.env.PARCOURS_ETAPES?.split(',').filter(Boolean);
  if (filtre?.length && !filtre.some(p => nom.startsWith(p))) return;
  try { await f(); } catch (e) {
    const m = String(e).split('\n').filter(l => /Error|Locator|locator|Expected|Received|waiting/.test(l)).slice(0, 4).join(' / ').slice(0, 400);
    mesures.push({ ecran: `${nom}-${cfg.langue}`, theme: '-', largeur: cfg.largeur, defilement: 0, cibles: [], principales: 0, contrastes: [], coupes: [], horsEcran: [], alertes: [`ÉTAPE ÉCHOUÉE : ${m}`] });
    await page.screenshot({ path: join(DOSSIER_MESURES!, `echec-${nom}-${cfg.largeur}-${cfg.langue}.png`) }).catch(() => {});
  }
}

const T = {
  nonMerci: /^(Non merci|No thanks)$/, continuer: /^(Continuer|Continue)$/, terminer: /^(Terminer|Finish)$/,
  apprendre: /^(Apprendre|Learn)$/, problemes: /^(Problèmes|Puzzles)$/, profil: /^(Profil|Profile)$/, jouer: /^(Jouer|Play)$/,
  commencer: /^(Commencer|Start)$/, terminerLecon: /^(Terminer la leçon|Finish the lesson)$/, retourChemin: /^(Retour à Apprendre|Back to Learn)/,
  jamais: /^(Jamais joué|Never played)$/, unPeu: /^(Un peu|A little)$/, saisJouer: /^(Je sais jouer|I know how to play)$/,
  saisDeja: /^(Je sais déjà jouer|I already know how to play)$/, jouerMochi: /^(Jouer avec Mochi|Play with Mochi)$/,
  voirIndice: /^(Voir un indice|Show a hint)$/, voirPourquoi: /^(Voir pourquoi|Show me why)$/, voirReponse: /^(Voir la réponse|Show the answer)$/,
  revoir: /^(Revoir la partie|Review the game)$/, demarrerBilan: /^(Démarrer le bilan|Start review)$/, rejouerErreurs: /^(Rejouer mes erreurs|Replay my mistakes)/,
  conditions: /^(Conditions et confidentialité|Terms and privacy)$/, mentions: /^(Mentions légales|Legal notice)$/, aide: /^(Aide|Help)$/,
  questions: /^(Questions|FAQ)$/, tousProblemes: /^(Tous les problèmes|All puzzles)$/, suivant: /^(Problème suivant|Next puzzle)$/,
  valider: /^(Valider le score|Confirm score)$/, rejouer: /^(Rejouer|Play again)/,
};

const action = (page: Page, nom: RegExp) => page.locator('.lecon-actions').getByRole('button', { name: nom });
const nav = (page: Page) => page.getByRole('navigation', { name: /^(Navigation principale|Main navigation)$/ });

for (const cfg of CONFIGS) {
  const taille = `${cfg.largeur} × ${cfg.hauteur} ${cfg.langue}`;
  test(`parcours du nouveau joueur (${taille})`, async ({ browser, baseURL }) => {
    test.setTimeout(900_000);
    mkdirSync(DOSSIER_MESURES!, { recursive: true });
    const mesures: Mesure[] = [];
    const erreursJs: string[] = [];
    const ouvrir = async (etat: Parameters<Browser['newContext']>[0]) => {
      const ctx = await browser.newContext({ ...etat, reducedMotion: 'reduce', colorScheme: 'dark' });
      const page = await ctx.newPage();
      page.on('pageerror', e => erreursJs.push(`${cfg.largeur} ${cfg.langue} : ${e.message}`));
      return { ctx, page };
    };

    // 1. Premier lancement : bandeau de consentement + « Tu connais le go ? ».
    await etape('01-premier-lancement', mesures, cfg, null as unknown as Page, async () => {
      const { ctx, page } = await ouvrir(VIDE(baseURL!, cfg));
      await page.goto('/');
      await expect(page.getByRole('region', { name: /^(Tu connais le go\s?\?|Do you know Go\?)$/ })).toBeVisible();
      await capturer(page, cfg, '01a-question-et-bandeau', mesures);
      await page.getByRole('dialog').getByRole('button', { name: T.nonMerci }).click();
      await capturer(page, cfg, '01b-question-seule', mesures);

      // 2. « Jamais joué » : les 8 gestes, puis la découverte jusqu'au bout.
      await page.getByRole('button', { name: T.jamais }).click();
      await expect(plateau(page, 7)).toBeVisible();
      await capturer(page, cfg, '02a-regles-1-poser', mesures);
      await jouer(page, 'A1', 7); // mauvais geste : l'aide
      await capturer(page, cfg, '02b-regles-1-aide', mesures);
      await toucher(page, 'D4', 7); await toucher(page, 'D4', 7);
      await attendrePierre(page, 'E5', 'blanc', 7);
      await capturer(page, cfg, '02c-regles-1-fait', mesures);
      await action(page, T.continuer).click();
      await jouer(page, 'D5', 7); await capturer(page, cfg, '02d-regles-2-libertes', mesures); await action(page, T.continuer).click();
      await jouer(page, 'D3', 7); await capturer(page, cfg, '02e-regles-3-capture', mesures); await action(page, T.continuer).click();
      await jouer(page, 'D3', 7); await capturer(page, cfg, '02f-regles-4-atari', mesures); await action(page, T.continuer).click();
      await jouer(page, 'A1', 7); await capturer(page, cfg, '02g-regles-5-suicide', mesures); await jouer(page, 'G5', 7); await action(page, T.continuer).click();
      await jouer(page, 'C4', 7); await capturer(page, cfg, '02h-regles-6-ko', mesures); await action(page, T.continuer).click();
      await jouer(page, 'B4', 7); await capturer(page, cfg, '02i-regles-7-territoire', mesures); await action(page, T.continuer).click();
      await capturer(page, cfg, '02j-regles-8-compte', mesures);
      await page.locator('.choix').getByRole('button', { name: /^(Noir|Black)$/ }).click();
      await capturer(page, cfg, '02k-regles-8-reponse', mesures);
      await action(page, T.terminer).click();
      await expect(page.getByTestId('fin-intro')).toBeVisible();
      await capturer(page, cfg, '02l-regles-fin', mesures);
      await page.getByRole('button', { name: T.jouerMochi }).click();
      await surMoment(page, SCENARIO[0].id);
      await capturer(page, cfg, '02m-decouverte-1', mesures);
      // En anglais, les aides (faireMoment : « Passer ») parlent français : la découverte s'arrête avant le moment « mort » (une passe).
      const dernier = cfg.langue === 'en' ? SCENARIO.findIndex(m => m.id === 'mort') : SCENARIO.length;
      for (let i = 0; i < dernier; i++) {
        const m = SCENARIO[i];
        if (['capture', 'echelle', 'ko2', 'frontiere', 'mort', 'compte2', 'compte6'].includes(m.id)) await capturer(page, cfg, `02n-decouverte-${m.id}`, mesures);
        await faireMoment(page, i);
      }
      if (cfg.langue === 'en') { await ctx.close(); return; }
      await capturer(page, cfg, '02o-decouverte-fin', mesures);
      await page.getByTestId('fin-decouverte').locator('.cta').click();
      await expect(page.locator('.accueil')).toBeVisible();
      await capturer(page, cfg, '02p-accueil-apres-decouverte', mesures);
      await capturer(page, cfg, '02q-accueil-apres-decouverte-page', mesures, { pleine: true });
      await ctx.close();
    });

    // 1 bis. « Un peu » : rappel express.
    await etape('01c-un-peu', mesures, cfg, null as unknown as Page, async () => {
      const { ctx, page } = await ouvrir({ ...VIDE(baseURL!, cfg), storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }, ...(cfg.langue === 'en' ? [{ name: 'go.langue.v1', value: '"en"' }] : [])] }] } });
      await page.goto('/');
      await page.getByRole('button', { name: T.unPeu }).click();
      await capturer(page, cfg, '01c-express-1', mesures);
      for (let i = 1; i <= 8; i++) await page.getByTestId('je-sais').click();
      await expect(page.getByTestId('fin-intro')).toBeVisible();
      await capturer(page, cfg, '01d-express-fin', mesures);
      await ctx.close();
    });

    // 3. « Je sais jouer » puis « Je sais déjà jouer » : le placement.
    await etape('03-placement', mesures, cfg, null as unknown as Page, async () => {
      const { ctx, page } = await ouvrir({ ...VIDE(baseURL!, cfg), storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }, ...(cfg.langue === 'en' ? [{ name: 'go.langue.v1', value: '"en"' }] : [])] }] } });
      await page.goto('/');
      await page.getByRole('button', { name: T.saisJouer }).click();
      await expect(page.locator('.accueil[data-epure]')).toBeVisible();
      await capturer(page, cfg, '03a-accueil-epure', mesures);
      await page.getByRole('button', { name: T.saisDeja }).click();
      await expect(page.locator('.placement')).toBeVisible();
      await capturer(page, cfg, '03b-placement-1', mesures);
      // Un coup faux au premier (verdict d'échec), puis on passe par la bonne réponse lue dans le lecteur.
      for (let i = 1; i <= 3; i++) {
        await expect(page.locator('.placement')).toHaveAttribute('data-rang', String(i));
        const id = (await page.locator('.placement').getAttribute('data-probleme'))!;
        const reponse = REPONSES.get(id);
        if (!reponse) throw new Error(`réponse inconnue pour ${id}`);
        if (i === 1) {
          for (const c of ['A1', 'J1', 'A9', 'J9', 'B1'].filter(x => !reponse.coups.includes(x))) {
            await jouer(page, c, reponse.taille);
            if (await page.locator('.verdict').isVisible().catch(() => false)) break;
            await page.waitForTimeout(150);
          }
          await capturer(page, cfg, '03c-placement-rate', mesures);
        } else {
          await jouer(page, reponse.coups[0], reponse.taille);
          await expect(page.locator('.verdict')).toBeVisible();
          if (i === 2) await capturer(page, cfg, '03d-placement-reussi', mesures);
        }
        await page.locator('.verdict .cta').click();
      }
      await expect(page.getByTestId('placement-fin')).toBeVisible();
      await capturer(page, cfg, '03e-placement-fin', mesures);
      await ctx.close();
    });

    // 4. Accueil complet, leçon 1 jusqu'à « Leçon terminée », retour.
    await etape('04-lecon-1', mesures, cfg, null as unknown as Page, async () => {
      const { ctx, page } = await ouvrir(REPONDU(baseURL!, cfg));
      await page.goto('/');
      await capturer(page, cfg, '04a-accueil-premier', mesures);
      await nav(page).getByRole('button', { name: T.apprendre }).click();
      await capturer(page, cfg, '04b-apprendre', mesures);
      await page.getByRole('button', { name: T.commencer }).click();
      await capturer(page, cfg, '04c-lecon1-etape1', mesures);
      await jouer(page, 'E5');
      await capturer(page, cfg, '04d-lecon1-etape1-faite', mesures);
      await page.getByRole('button', { name: T.continuer }).click();
      for (const p of ['A1', 'D6']) { await jouer(page, p); await page.getByRole('button', { name: T.continuer }).click(); }
      await jouer(page, 'A1');
      await capturer(page, cfg, '04e-lecon1-etape4-erreur', mesures);
      await jouer(page, 'E5');
      await page.getByRole('button', { name: T.continuer }).click();
      await jouer(page, 'E5');
      await capturer(page, cfg, '04f-lecon1-etape5', mesures);
      await page.getByRole('button', { name: T.continuer }).click();
      await jouer(page, 'E4');
      await capturer(page, cfg, '04f2-lecon1-etape6', mesures);
      await page.getByRole('button', { name: T.terminerLecon }).click();
      await expect(page.locator('.fin-lecon')).toBeVisible();
      await capturer(page, cfg, '04g-lecon1-fin', mesures);
      await page.locator('.fin-lecon').getByRole('button', { name: T.retourChemin }).click();
      await capturer(page, cfg, '04h-apprendre-apres', mesures);
      await nav(page).getByRole('button', { name: T.jouer }).click();
      await capturer(page, cfg, '04i-accueil-apres-lecon', mesures);
      await ctx.close();
    });

    // 5. Go du jour : échec et réfutation, « Voir la réponse », puis réussite ; la maîtrise par thème.
    await etape('05-go-du-jour', mesures, cfg, null as unknown as Page, async () => {
      const { ctx, page } = await ouvrir(REPONDU(baseURL!, cfg, [{ name: 'go.premiere-pierre.v1', value: 'true' }]));
      await page.clock.setFixedTime(MIDI_PARIS);
      await page.goto('/');
      await nav(page).getByRole('button', { name: T.problemes }).click();
      await expect(page.getByTestId('problemes-sommaire')).toBeVisible();
      await capturer(page, cfg, '05a-problemes', mesures);
      await capturer(page, cfg, '05b-problemes-page', mesures, { pleine: true });
      await page.locator('.problemes .cta').click();
      await expect(plateau(page)).toBeVisible();
      await capturer(page, cfg, '05c-go-du-jour', mesures);
      await jouer(page, 'A1');
      await capturer(page, cfg, '05d-go-du-jour-rate', mesures);
      await page.getByRole('button', { name: T.voirIndice }).click();
      await capturer(page, cfg, '05e-go-du-jour-indice', mesures);
      await jouer(page, 'B2');
      await page.getByRole('button', { name: T.voirPourquoi }).click();
      await capturer(page, cfg, '05f-go-du-jour-refutation', mesures);
      await page.getByRole('button', { name: T.voirReponse }).click();
      await capturer(page, cfg, '05g-go-du-jour-reponse', mesures);
      await jouer(page, 'E5'); await jouer(page, 'E5');
      await capturer(page, cfg, '05h-go-du-jour-vu', mesures);
      await page.getByRole('button', { name: T.suivant }).click().catch(() => {});
      await capturer(page, cfg, '05i-probleme-suivant', mesures);
      await ctx.close();

      // Réussite, sur un autre appareil.
      const b = await ouvrir(REPONDU(baseURL!, cfg, [{ name: 'go.premiere-pierre.v1', value: 'true' }]));
      await b.page.clock.setFixedTime(MIDI_PARIS);
      await b.page.goto('/');
      await nav(b.page).getByRole('button', { name: T.problemes }).click();
      await b.page.locator('.problemes .cta').click();
      await expect(plateau(b.page)).toBeVisible();
      await jouer(b.page, 'E5');
      await expect(b.page.locator('.verdict')).toBeVisible();
      await capturer(b.page, cfg, '05j-go-du-jour-reussi', mesures);
      await b.page.getByRole('button', { name: /^(Retour aux problèmes|Back to puzzles)$/ }).first().click();
      await expect(b.page.getByTestId('problemes-sommaire')).toBeVisible();
      await capturer(b.page, cfg, '05k-problemes-apres', mesures);
      await ouvrirParTheme(b.page);
      // Série « Capturer » : la barre de maîtrise en tête, et une vignette ouverte.
      await b.page.getByRole('button', { name: /^(Capturer|Capture)/ }).click();
      await expect(plateau(b.page)).toBeVisible();
      await capturer(b.page, cfg, '05l-serie-capturer', mesures);
      await b.ctx.close();
    });

    // 6. Partie contre Pomme jusqu'au score, fin, revue, « Rejouer mes erreurs ».
    if (cfg.langue === 'fr') await etape('06-partie-pomme', mesures, cfg, null as unknown as Page, async () => {
      const { ctx, page } = await ouvrir(REPONDU(baseURL!, cfg));
      await page.goto('/?komi=-100');
      await toucherCta(page);
      await expect(plateau(page)).toBeVisible();
      await capturer(page, cfg, '06a-partie-debut', mesures);
      for (const c of ['E5', 'C3', 'G7']) {
        await expect(page.getByRole('button', { name: /^(Passer|Pass)$/ })).toBeEnabled({ timeout: 10_000 });
        await jouer(page, c);
        await expect(page.getByRole('button', { name: /^(Passer|Pass)$/ })).toBeEnabled({ timeout: 10_000 });
      }
      await capturer(page, cfg, '06b-partie-milieu', mesures);
      await passerJusquAuScore(page);
      await capturer(page, cfg, '06c-recit-score', mesures);
      await expect(page.locator('.fin-titre')).toBeVisible({ timeout: 15_000 });
      await capturer(page, cfg, '06d-fin-de-partie', mesures);
      await capturer(page, cfg, '06e-fin-de-partie-page', mesures, { pleine: true });
      await page.getByRole('button', { name: T.revoir }).click();
      await expect(page.getByRole('button', { name: T.demarrerBilan })).toBeVisible({ timeout: 60_000 });
      await capturer(page, cfg, '06f-revue-bilan', mesures);
      await ctx.close();

      // « Rejouer mes erreurs » : partie fixe et KataGo factice (revueFactice).
      const b = await ouvrir(REPONDU(baseURL!, cfg));
      await preparerRevue(b.page);
      await ouvrirRevue(b.page);
      const rejouer = b.page.getByRole('button', { name: T.rejouerErreurs });
      await expect(rejouer).toBeVisible({ timeout: 30_000 });
      await capturer(b.page, cfg, '06g-revue-bilan-katago', mesures);
      await rejouer.click();
      await expect(b.page.getByRole('heading', { level: 2 })).toBeVisible();
      await capturer(b.page, cfg, '06h-rejouer-erreurs', mesures);
      await b.ctx.close();
    });

    // 7. 3e partie d'essai → « Crée ton compte » ; mentions légales ; « Ton avis compte » ; hors ligne ; partage.
    await etape('07-compte-et-aide', mesures, cfg, null as unknown as Page, async () => {
      const ctx = await browser.newContext({ ...REPONDU(baseURL!, cfg), reducedMotion: 'reduce', colorScheme: 'dark' });
      const page = await brancher(ctx, fauxServeur(), { 'go.essai.v1': JSON.stringify({ terminees: 2 }), 'go.premiere-pierre.v1': 'true' });
      page.on('pageerror', e => erreursJs.push(`${cfg.largeur} ${cfg.langue} : ${e.message}`));
      await page.goto('/');
      await capturer(page, cfg, '07a-accueil-comptes', mesures);
      await toucherCta(page);
      await expect(plateau(page)).toBeVisible();
      await abandonner(page);
      await expect(page.locator('.cta')).toBeVisible();
      await capturer(page, cfg, '07b-abandon-3e-partie', mesures);
      await toucherCta(page);
      await expect(page.getByTestId('creer-compte')).toBeVisible();
      await capturer(page, cfg, '07c-creer-compte', mesures);
      await capturer(page, cfg, '07d-creer-compte-page', mesures, { pleine: true });
      // Erreurs du formulaire : adresse vide et case non cochée.
      await page.getByRole('button', { name: /^(Recevoir mon code|Get my code)$/ }).click({ force: true });
      await capturer(page, cfg, '07e-creer-compte-erreur', mesures);
      await page.getByRole('button', { name: /^(Retour|Back)$/ }).first().click().catch(() => {});

      await page.goto('/');
      await nav(page).getByRole('button', { name: T.profil }).click();
      await capturer(page, cfg, '07f-profil', mesures);
      await page.getByRole('button', { name: T.conditions }).click();
      await capturer(page, cfg, '07g-confidentialite', mesures);
      await page.getByRole('button', { name: T.mentions }).click();
      await capturer(page, cfg, '07h-mentions-legales', mesures);
      await capturer(page, cfg, '07i-mentions-legales-page', mesures, { pleine: true });

      await page.goto('/');
      await nav(page).getByRole('button', { name: T.profil }).click();
      await page.getByRole('button', { name: T.aide, exact: true }).click();
      const aide = page.locator('dialog.aide');
      await aide.getByRole('tab', { name: T.questions }).click();
      await capturer(page, cfg, '07j-aide-questions', mesures);
      await aide.getByTestId('aide-donner-avis').click();
      await expect(aide.getByTestId('retours')).toBeVisible();
      await capturer(page, cfg, '07k-ton-avis', mesures);
      await aide.getByTestId('retours').getByRole('button', { name: /^(Envoyer|Send)$/ }).click();
      await capturer(page, cfg, '07l-ton-avis-erreur', mesures);
      await aide.getByRole('button', { name: /^(Fermer|Close)$/ }).first().click();

      // Partage de l'app depuis le Profil (sans feuille native : « Lien copié »).
      await page.getByTestId('partager-app-profil').click();
      await page.waitForTimeout(300);
      await capturer(page, cfg, '07m-partage-profil', mesures);

      // Hors ligne : le service worker a eu le temps de s'installer.
      await page.waitForFunction(async () => { const r = await navigator.serviceWorker.ready; return r.active?.state === 'activated' && !!navigator.serviceWorker.controller; }, null, { timeout: 20_000 });
      await ctx.setOffline(true);
      await page.goto('/');
      await expect(page.locator('.cta')).toBeVisible();
      await capturer(page, cfg, '07n-accueil-hors-ligne', mesures);
      await ctx.close();
    });

    // 8. Partie à deux : fin, « Rejouer », la fête ne couvre pas le plateau.
    if (cfg.langue === 'fr') await etape('08-partie-a-deux-rejouer', mesures, cfg, null as unknown as Page, async () => {
      const { ctx, page } = await ouvrir(REPONDU(baseURL!, cfg, [{ name: 'go.premiere-pierre.v1', value: 'true' }, { name: 'go.xp.v1', value: '90' }]));
      await page.goto('/');
      await lancerADeux(page);
      await expect(plateau(page)).toBeVisible();
      await capturer(page, cfg, '08a-partie-a-deux', mesures);
      await jouerSuite(page, ['C3', 'G7', 'C4', 'G6', 'C5', 'G5', 'C6', 'G4', 'C7', 'G3', 'D3', 'F7']);
      await passer(page); await passer(page);
      await capturer(page, cfg, '08b-comptage-a-deux', mesures);
      await page.getByRole('button', { name: T.valider }).click();
      await expect(page.locator('.fin-titre')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('fete-niveau')).toBeVisible({ timeout: 3000 });
      await capturer(page, cfg, '08c-fin-a-deux-fete', mesures);
      await page.getByRole('button', { name: T.rejouer }).first().click();
      await expect(plateau(page)).toBeVisible();
      await page.waitForTimeout(300);
      await capturer(page, cfg, '08d-rejouer-plateau', mesures);
      await ctx.close();
    });

    writeFileSync(join(DOSSIER_MESURES!, `mesures-${cfg.largeur}-${cfg.langue}.json`), JSON.stringify({ mesures, erreursJs }, null, 1));
  });
}

// Bonne réponse de chaque problème, lue dans les sources (comme e2e/placement.spec.ts).
import { readFileSync, readdirSync } from 'node:fs';
const CONTENU = join(RACINE, 'src', 'content');
const sources = [join(CONTENU, 'puzzles.ts'), ...readdirSync(join(CONTENU, 'lots')).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts')).map(f => join(CONTENU, 'lots', f))];
const REPONSES = new Map(sources.flatMap(f => [...readFileSync(f, 'utf8').matchAll(/id: ?'([^']+)', size: ?(\d+), difficulty: ?\d+, answers: ?\[([^\]]*)\]/g)]
  .map(m => [m[1], { taille: Number(m[2]), coups: [...m[3].matchAll(/'([A-T]\d+)'/g)].map(x => x[1]) }] as const)));
