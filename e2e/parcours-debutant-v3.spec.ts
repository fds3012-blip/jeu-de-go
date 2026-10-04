import { expect, test, type Browser, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brancher, CODE, fauxServeur, type FauxServeur } from './fauxSupabase';
import { mesurer, type Mesure } from './mesures';
import { choisirMode, jouer, plateau } from './plateau';

// Parcours débutant v3 (recette du 02/10 au soir, docs/qa/recette-2026-10-02-soir.md) : les parcours clés d'un vrai
// débutant enchaînés sur un même téléphone, Supabase simulé (e2e/fauxSupabase.ts), donc avec l'essai limité (#343).
//   premier lancement → partie contre Pomme jusqu'au score raconté, fin et revue → leçon 1 entière → accueil
//   → Go du jour (tuile, puis lien partagé résolu) → 2 parties de plus → 4e partie : « Crée ton compte »
//   → leçon 4 : « Crée ton compte » → compte (code, pseudo) → leçon 4 ouverte → un problème → Mes parties
//   → aide depuis une partie → défi par lien (l'ami crée son compte et joue) → hors ligne.
// À chaque écran : pas d'erreur JS, pas de défilement de côté, jamais plus d'une action principale.
//
// Par défaut : 390 × 844, français, clair, sans capture. RECETTE_SOIR=<dossier> : les 4 configurations
// (390 × 844 et 320 × 568, français et anglais), chaque écran capturé en sombre et en clair (JPEG) avec ses mesures
// (contraste, cibles, textes coupés : e2e/mesures.ts) dans <dossier>.

const DOSSIER = process.env.RECETTE_SOIR;

type Langue = 'fr' | 'en';
type Config = { largeur: number; hauteur: number; langue: Langue };
const CONFIGS: Config[] = DOSSIER
  ? [{ largeur: 390, hauteur: 844, langue: 'fr' }, { largeur: 320, hauteur: 568, langue: 'fr' }, { largeur: 390, hauteur: 844, langue: 'en' }, { largeur: 320, hauteur: 568, langue: 'en' }]
  : [{ largeur: 390, hauteur: 844, langue: 'fr' }];

const T = {
  nonMerci: /^(Non merci|No thanks)$/, premiere: /^(Joue ta première partie|Play your first game)/,
  apprendre: /^(Apprendre|Learn)$/, problemes: /^(Problèmes|Puzzles)$/, profil: /^(Profil|Profile)$/, jouer: /^(Jouer|Play)$/,
  passer: /^(Passer|Pass)$/, passeGroupe: /^(Passer maintenant\s?\?|Pass now\?)$/, valider: /^(Valider le score|Confirm score)$/,
  resultat: /^(Voir le résultat|See the result)$/, retourBilan: /^(Retour au bilan|Back to results)$/, revoir: /^(Revoir ma partie|Review my game)$/, accueil: /^(Accueil|Home)$/,
  commencer: /^(Commencer|Start)$/, continuer: /^(Continuer|Continue)$/, terminer: /^(Terminer la leçon|Finish the lesson)$/,
  retourChemin: /^(Retour au chemin|Back to the path)$/, plus: /^(Plus|More)$/, abandonner: /^(Abandonner|Resign)$/, confirmer: /^(Confirmer|Confirm)/,
  email: /^(Ton adresse e-mail|Your email address)$/, age: /^(J’ai 15\s+ans ou plus|I’m 15 or older)/, code: /^(Code à 6 chiffres|6-digit code)$/,
  recevoir: /^(Recevoir mon code|Get my code)$/, pseudo: /^(Pseudo|Username)$/, monPseudo: /^(C’est mon pseudo|That’s my username)$/,
  aide: /^(Aide : règles et mots du go|Help: rules and Go words)$/, feuilleAide: /^(Aide|Help)$/, mots: /^(Mots|Words)$/,
  chercher: /^(Chercher un mot|Search for a word)$/, fermer: /^(Fermer|Close)$/, mesParties: /^(Mes parties|My games)/,
  envoyerLien: /^(Envoyer un lien|Send a link)$/, probleme: /^(Problème|Puzzle) \d+/, tous: /^(Tous les problèmes|All puzzles)$/,
};

/** Chaque écran du parcours : vérifications légères ; avec RECETTE_SOIR, capture sombre et clair et mesures. */
function verificateur(cfg: Config, mesures: Mesure[]) {
  const dossierCaptures = DOSSIER ? join(DOSSIER, 'captures') : '';
  return async (page: Page, ecran: string) => {
    // Une animation d'entrée peut encore tourner : on laisse l'écran se poser.
    await page.waitForTimeout(DOSSIER ? 250 : 50);
    const { large, vue, principales } = await page.evaluate(() => {
      const vis = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== 'hidden'; };
      const modale = [...document.querySelectorAll('dialog[open], [aria-modal="true"]')].find(vis) ?? null;
      const n = [...document.querySelectorAll('.cta, .btn.primary')].filter(vis).filter(el => !modale || modale.contains(el)).length;
      return { large: document.documentElement.scrollWidth, vue: innerWidth, principales: n };
    });
    expect(large, `défilement de côté : ${ecran}`).toBeLessThanOrEqual(vue);
    expect(principales, `une seule action principale : ${ecran}`).toBeLessThanOrEqual(1);
    if (!DOSSIER) return;
    mkdirSync(dossierCaptures, { recursive: true });
    for (const theme of ['dark', 'light'] as const) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.waitForTimeout(200);
      await page.screenshot({ path: join(dossierCaptures, `${ecran}-${cfg.largeur}-${theme === 'dark' ? 'sombre' : 'clair'}-${cfg.langue}.jpg`), type: 'jpeg', quality: 70 });
      mesures.push(await mesurer(page, ecran, theme, cfg.largeur));
    }
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  };
}

// #391 : un onglet avec un point jade ajoute la raison à son nom (« Problèmes, Garde ta série de 1 jour »).
const nav = (page: Page, nom: RegExp) => page.getByRole('navigation')
  .getByRole('button', { name: new RegExp(nom.source.replace(/\$$/, '(,|$)'), nom.flags) });
const barre = (page: Page) => page.getByRole('toolbar').first();
const boutonPasser = (page: Page) => barre(page).getByRole('button', { name: T.passer });
const fin = (page: Page) => page.locator('.recit, .barre-comptage').filter({ visible: true });

/** Passe, en confirmant si Mochi prévient ; attend que la passe soit jouée ou la partie finie. */
async function passer(page: Page) {
  const avant = await page.locator('ol.coups > li:not(.vide)').count();
  const choix = page.getByRole('group', { name: T.passeGroupe });
  await expect(boutonPasser(page)).toBeEnabled({ timeout: 30_000 });
  await boutonPasser(page).click();
  await expect.poll(async () => (await choix.count()) > 0 || (await page.locator('ol.coups > li:not(.vide)').count()) > avant || (await fin(page).count()) > 0, { timeout: 30_000 }).toBe(true);
  if (await choix.count()) await choix.getByRole('button', { name: T.passer }).click();
}

/** Contre l'ordi : passe jusqu'au comptage, l'écran de comptage est vérifié, puis le score est validé. */
async function jusquAuScore(page: Page, voir: (p: Page, e: string) => Promise<void>) {
  for (let i = 0; i < 8 && !(await fin(page).count()); i++) {
    await passer(page);
    await expect.poll(async () => (await fin(page).count()) > 0 || (await boutonPasser(page).isEnabled().catch(() => false)), { timeout: 30_000 }).toBe(true);
  }
  await expect(fin(page).first()).toBeVisible({ timeout: 30_000 });
  // Comptage automatique (#117) : la barre de comptage s'affiche pendant la recherche des pierres mortes, puis le récit
  // arrive seul. Comptage manuel : « Valider le score » devient actif et attend le joueur.
  const recit = page.locator('.recit');
  const valider = page.getByRole('button', { name: T.valider });
  await expect.poll(async () => (await recit.isVisible()) || (await valider.isEnabled().catch(() => false)), { timeout: 30_000 }).toBe(true);
  if (!(await recit.isVisible())) {
    await page.waitForTimeout(300);
    if (!(await recit.isVisible())) {
      await expect(page.locator('.coach p[aria-live="polite"]')).not.toContainText(/Je cherche les pierres mortes|looking for dead stones/i);
      await voir(page, '04-comptage');
      await valider.click({ timeout: 3_000 }).catch(() => { /* récit arrivé entre-temps */ });
    }
  }
  await expect(recit).toBeVisible({ timeout: 30_000 });
}

/** Partie contre l'ordi abandonnée tout de suite, depuis l'accueil (elle compte dans l'essai). */
async function partieAbandonnee(page: Page) {
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  await expect(boutonPasser(page)).toBeEnabled({ timeout: 30_000 });
  await barre(page).locator('[data-action="plus"]').click();
  const menu = barre(page).locator('.actions-menu');
  await menu.getByRole('button', { name: T.abandonner }).click();
  await menu.getByRole('button', { name: T.confirmer }).click();
  // Aucun coup joué : pas de revue, l'écran de fin propose de rejouer ou l'accueil.
  await page.getByRole('button', { name: T.accueil, exact: true }).click();
  await expect(page.locator('.cta')).toBeVisible();
}

/** Compte par code : e-mail, case d'âge, code, pseudo. */
async function creerCompte(page: Page, email: string, pseudo: string) {
  await page.getByLabel(T.email).fill(email);
  await page.getByRole('checkbox', { name: T.age }).check();
  await page.getByRole('button', { name: T.recevoir }).click();
  await page.getByLabel(T.code).fill(CODE);
  await expect(page.getByTestId('pseudo-obligatoire')).toBeVisible();
  await page.getByRole('textbox', { name: T.pseudo }).fill(pseudo);
  await expect(page.getByText(new RegExp(`^${pseudo} (est libre|is available)\\.$`))).toBeVisible();
}

function options(cfg: Config, baseURL: string | undefined, consentement: boolean) {
  return {
    viewport: { width: cfg.largeur, height: cfg.hauteur }, deviceScaleFactor: DOSSIER ? 1.5 : 1, isMobile: true, hasTouch: true,
    locale: cfg.langue === 'fr' ? 'fr-FR' : 'en-US', timezoneId: 'Europe/Paris', colorScheme: 'light' as const, reducedMotion: 'reduce' as const, baseURL,
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [
      { name: 'go.langue.v1', value: JSON.stringify(cfg.langue) }, ...(consentement ? [{ name: 'go.consentement.v1', value: 'refuse' }] : []),
    ] }] },
  };
}

async function ouvrir(browser: Browser, cfg: Config, baseURL: string | undefined, serveur: FauxServeur, consentement: boolean, erreurs: string[], nom: string) {
  const ctx = await browser.newContext(options(cfg, baseURL, consentement));
  // Un libellé introuvable échoue vite, au lieu d'attendre la fin du test.
  ctx.setDefaultTimeout(20_000);
  const page = await brancher(ctx, serveur);
  page.on('pageerror', e => erreurs.push(`[${nom}] ${e.message}`));
  return { ctx, page };
}

for (const cfg of CONFIGS) {
  test(`parcours débutant v3 : du premier lancement au défi, hors ligne compris (${cfg.largeur} × ${cfg.hauteur}, ${cfg.langue})`, async ({ browser, baseURL }) => {
    test.setTimeout(DOSSIER ? 600_000 : 240_000);
    const mesures: Mesure[] = [];
    const voir = verificateur(cfg, mesures);
    const erreurs: string[] = [];
    const serveur = fauxServeur();
    const { ctx, page } = await ouvrir(browser, cfg, baseURL, serveur, false, erreurs, 'joueur');

    // 1. Premier lancement : consentement, puis l'accueil et sa seule action. `?komi=-100` (paramètre de test) :
    //    la première partie se gagne en passant, pour aller jusqu'au score raconté.
    await page.goto('/?komi=-100');
    await expect(page.getByRole('dialog')).toBeVisible();
    await voir(page, '01-consentement');
    await page.getByRole('button', { name: T.nonMerci }).click();
    await expect(page.locator('.cta')).toHaveText(T.premiere);
    await voir(page, '02-accueil');

    // 2. Première pierre, puis la partie jusqu'au bout : comptage, score raconté, fin, revue.
    await page.locator('.cta').click();
    await expect(plateau(page)).toBeVisible();
    await expect(boutonPasser(page)).toBeEnabled({ timeout: 30_000 });
    await jouer(page, 'E5');
    await expect(plateau(page).locator('g[data-pierre="noir"]')).toHaveCount(1);
    await expect(boutonPasser(page)).toBeEnabled({ timeout: 30_000 });
    await voir(page, '03-premiere-pierre');
    await jusquAuScore(page, voir);
    await voir(page, '05-score-raconte');
    await page.getByRole('button', { name: T.resultat }).click();
    await expect(page.getByRole('button', { name: T.revoir })).toBeVisible();
    await voir(page, '06-fin-de-partie');
    await page.getByRole('button', { name: T.revoir }).click();
    await expect(page.locator('.revue-analyse')).toHaveCount(0, { timeout: 90_000 });
    await voir(page, '07-revue');
    // La revue n'a pas de barre du bas : retour au bilan, puis l'accueil.
    await page.getByRole('button', { name: T.retourBilan }).click();
    await page.getByRole('button', { name: T.accueil, exact: true }).click();

    // 3. Leçon 1 en entier, depuis Apprendre, puis retour à l'accueil.
    await nav(page, T.apprendre).click();
    await page.getByRole('button', { name: T.commencer }).click();
    await expect(page.locator('.lecteur-plateau')).toBeVisible();
    await voir(page, '08-lecon1-debut');
    await jouer(page, 'E5');
    await page.getByRole('button', { name: T.continuer }).click();
    for (const p of ['A1', 'D6']) {
      await jouer(page, p);
      await page.getByRole('button', { name: T.continuer }).click();
    }
    await jouer(page, 'E5');
    await page.getByRole('button', { name: T.continuer }).click();
    await jouer(page, 'E5');
    await page.getByRole('button', { name: T.continuer }).click();
    await jouer(page, 'E4');
    await page.getByRole('button', { name: T.terminer }).click();
    await expect(page.locator('.fin-lecon')).toBeVisible();
    await voir(page, '09-lecon1-fin');
    await nav(page, T.jouer).click();
    await expect(page.locator('.cta')).toBeVisible();
    await voir(page, '10-accueil-retour');

    // 4. Go du jour : la tuile de l'accueil ouvre celui du jour ; un lien partagé (n° 1) se résout.
    // La tuile « À faire » ouvre le Go du jour lui-même.
    await page.locator('.tuile-probleme').click();
    await expect(plateau(page)).toBeVisible();
    await expect(page.getByText(/^(Go du jour|Daily Go)/).first()).toBeVisible();
    await voir(page, '11-go-du-jour');
    await page.goto('/?go-du-jour=1');
    await expect(plateau(page)).toBeVisible();
    await jouer(page, 'E5');
    await expect(page.locator('.verdict-juste, .verdict').first()).toBeVisible();
    await voir(page, '12-go-du-jour-reussi');

    // 5. Essai : la première partie, finie sur un plateau presque vide, ne compte pas (#251) ; 3 parties menées à leur
    //    terme (ici abandonnées), puis la 4e demande un compte.
    const terminees = () => page.evaluate(() => JSON.parse(localStorage.getItem('go.essai.v1') ?? '{}').terminees);
    expect(await terminees()).toBe(0);
    await page.goto('/');
    for (let i = 0; i < 3; i++) await partieAbandonnee(page);
    expect(await terminees()).toBe(3);
    await page.locator('.cta').click();
    await expect(page.getByTestId('creer-compte')).toHaveAttribute('data-raison', 'parties');
    await expect(page.getByRole('navigation')).toHaveCount(0);
    await voir(page, '13-compte-4e-partie');

    // 6. Leçons 2 et 3 faites (posées sur l'appareil) : la leçon 4 demande un compte, qu'on crée ici.
    await page.evaluate(() => localStorage.setItem('go.lecons.v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('go.lecons.v1') ?? '{}'), l1: 99, l2: 99, l3: 99 })));
    await page.goto('/');
    await nav(page, T.apprendre).click();
    await page.locator('.apprendre .cta, .chemin .cta').first().click();
    await expect(page.getByTestId('creer-compte')).toHaveAttribute('data-raison', 'lecons');
    await voir(page, '14-compte-lecon4');
    await creerCompte(page, 'debutant@exemple.test', 'Debutant_1');
    await voir(page, '15-pseudo');
    await page.getByRole('button', { name: T.monPseudo }).click();
    await expect(page.locator('.lecteur-plateau')).toBeVisible();
    await voir(page, '16-lecon4-ouverte');

    // 7. Un problème (compte complet : plus de limite).
    await nav(page, T.problemes).click();
    await page.getByRole('button', { name: T.tous }).click();
    await page.getByRole('button', { name: T.probleme }).first().click();
    await expect(plateau(page)).toBeVisible();
    await voir(page, '17-probleme');
    await jouer(page, 'A1');
    await expect(page.locator('.verdict').first()).toBeVisible();
    await voir(page, '18-probleme-verdict');

    // 8. Mes parties : les 3 parties, la plus récente d'abord ; un toucher ouvre la revue.
    await nav(page, T.profil).click();
    await page.getByRole('button', { name: T.mesParties }).click();
    const lignes = page.getByRole('list', { name: T.mesParties }).getByRole('button');
    await expect(lignes.first()).toBeVisible();
    await voir(page, '19-mes-parties');
    await lignes.first().click();
    // Revue v3 (#405) : le bilan de la partie s'ouvre d'abord, puis « Démarrer le bilan » montre le goban.
    await page.getByRole('button', { name: /^(Démarrer le bilan|Start review)$/ }).click({ timeout: 90_000 });
    await expect(plateau(page)).toBeVisible({ timeout: 30_000 });
    await voir(page, '20-mes-parties-revue');

    // 9. Aide depuis une partie : « ? », un mot, fermer ; la partie est intacte.
    await page.goto('/');
    // #429 : Pomme battue et premières leçons faites, l'action principale devient la partie en ligne ; l'ordi est une tuile.
    await choisirMode(page, 'ordi');
    await expect(boutonPasser(page)).toBeEnabled({ timeout: 30_000 });
    await jouer(page, 'C3');
    await expect(boutonPasser(page)).toBeEnabled({ timeout: 30_000 });
    const coups = await page.locator('ol.coups > li:not(.vide)').count();
    await page.getByRole('button', { name: T.aide }).click();
    const aide = page.getByRole('dialog', { name: T.feuilleAide });
    await expect(aide).toBeVisible();
    await voir(page, '21-aide-regles');
    await aide.getByRole('tab', { name: T.mots }).click();
    await aide.getByRole('searchbox', { name: T.chercher }).fill(cfg.langue === 'fr' ? 'atari' : 'atari');
    await voir(page, '22-aide-glossaire');
    await aide.getByRole('button', { name: T.fermer }).click();
    await expect(aide).toBeHidden();
    await expect(page.locator('ol.coups > li:not(.vide)')).toHaveCount(coups);

    // 10. Défi par lien : le joueur (compte complet) envoie un lien ; l'ami crée son compte puis joue.
    await page.goto('/');
    await page.getByTestId('mode-ami').click();
    await page.getByRole('button', { name: T.envoyerLien }).click();
    await expect(page.getByTestId('defi-lien')).toBeVisible();
    await voir(page, '23-defi-lien');
    const lien = await page.getByTestId('defi-lien').locator('input').inputValue();
    const ami = await ouvrir(browser, cfg, baseURL, serveur, true, erreurs, 'ami');
    await ami.page.goto(lien);
    await expect(ami.page.getByRole('heading', { name: /Debutant_1/ })).toBeVisible();
    await voir(ami.page, '24-defi-arrivee');
    await creerCompte(ami.page, 'ami@exemple.test', 'Ami_du_go');
    await ami.page.getByRole('button', { name: T.monPseudo }).click();
    await expect(plateau(ami.page)).toBeVisible();
    await jouer(ami.page, 'E5');
    await expect(plateau(ami.page).locator('g[data-pierre="noir"]')).toHaveCount(1);
    await voir(ami.page, '25-defi-partie');
    await ami.ctx.close();
    await page.goto('/');
    await page.getByTestId('mode-ami').click();
    // #400 : la ligne du défi porte le pseudo de l'ami (plus « Partie du… » une fois le lien ouvert).
    await page.getByRole('button', { name: /^Ami_du_go/ }).click();
    await expect(plateau(page).locator('g[data-pierre="noir"]')).toHaveCount(1);

    // 11. Hors ligne : l'app se rouvre et ses onglets s'ouvrent.
    await page.goto('/');
    await page.waitForFunction(async () => { const r = await navigator.serviceWorker.ready; return r.active?.state === 'activated' && !!navigator.serviceWorker.controller; }, null, { timeout: 20_000 });
    await ctx.setOffline(true);
    await page.reload();
    await expect(page.locator('.cta')).toBeVisible();
    await voir(page, '26-hors-ligne-accueil');
    await nav(page, T.apprendre).click();
    await expect(page.locator('.cta')).toBeVisible();
    await nav(page, T.profil).click();
    await expect(page.getByRole('button', { name: T.mesParties })).toBeVisible();
    await voir(page, '27-hors-ligne-profil');
    await ctx.setOffline(false);

    expect(erreurs).toEqual([]);
    if (DOSSIER) writeFileSync(join(DOSSIER, `mesures-${cfg.largeur}-${cfg.langue}.json`), JSON.stringify(mesures, null, 1));
    await ctx.close();
  });
}
