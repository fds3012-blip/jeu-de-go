import { expect, type Locator, type Page } from '@playwright/test';
import { fromLabel } from '../src/go/coords';

// Géométrie du plateau (src/ui/boardArt.ts) : écart C entre les lignes, marge M autour de la grille.
const C = 40;
const M = 34;

/** Le plateau de go (SVG accessible) : une grille s'il est jouable (issue #116), une image sinon. En français ou en anglais (#167). */
export function plateau(page: Page, taille = 9): Locator {
  const name = new RegExp(`^(Plateau de go|Go board) ${taille} × ${taille}$`);
  return page.getByRole('grid', { name }).or(page.getByRole('img', { name }));
}

/** Coordonnées dans le viewBox d'une intersection affichée (« D5 » : lettres A à J sans I, lignes depuis le bas). */
function centre(label: string, taille: number): { cx: number; cy: number } {
  const p = fromLabel(label, taille);
  return { cx: M + (p % taille) * C, cy: M + Math.floor(p / taille) * C };
}

/** Position à l'écran (coordonnées de la page) d'une intersection affichée. */
export async function point(page: Page, label: string, taille = 9): Promise<{ x: number; y: number }> {
  const svg = plateau(page, taille);
  await svg.scrollIntoViewIfNeeded();
  const box = await svg.boundingBox();
  if (!box) throw new Error('Plateau introuvable');
  // viewBox « x y étendue étendue » : une bande de coordonnées déborde en haut et à gauche (x, y < 0) ; sur un plateau
  // cadré (#454), x et y sont ceux du coin de la zone montrée.
  const [x0, y0, w] = (await svg.getAttribute('viewBox'))!.split(' ').map(Number);
  const { cx, cy } = centre(label, taille);
  return { x: box.x + ((cx - x0) * box.width) / w, y: box.y + ((cy - y0) * box.height) / w };
}

/** Pose une pierre à la souris (pas de seconde touche de confirmation à la souris). */
export async function jouer(page: Page, label: string, taille = 9): Promise<void> {
  const { x, y } = await point(page, label, taille);
  await page.mouse.click(x, y);
}

/** Joue une suite de coups à la souris ; les couleurs alternent (Noir commence). */
export async function jouerSuite(page: Page, labels: string[], taille = 9): Promise<void> {
  for (const l of labels) await jouer(page, l, taille);
}

/** Touche une intersection au doigt. */
export async function toucher(page: Page, label: string, taille = 9): Promise<void> {
  const { x, y } = await point(page, label, taille);
  await page.touchscreen.tap(x, y);
}

// Chaque pierre posée porte data-pierre (« noir » ou « blanc ») et data-point (« D5 »). Les pierres fantômes
// et les pierres prises en train de s'effacer n'ont pas data-pierre. Les pierres mortes du comptage portent data-morte.
/** Pierres posées d'une couleur (les pierres fantômes et les pierres mortes du comptage sont exclues). */
export function pierres(page: Page, couleur: 'noir' | 'blanc', taille = 9): Locator {
  return plateau(page, taille).locator(`g[data-pierre="${couleur}"]:not([data-morte])`);
}

/** Pierre fantôme (coup en attente de confirmation au doigt). */
export function fantome(page: Page, taille = 9): Locator {
  return plateau(page, taille).locator('g[data-fantome]');
}

/** Vérifie la pierre posée à une intersection (null : intersection vide). */
export async function attendrePierre(page: Page, label: string, couleur: 'noir' | 'blanc' | null, taille = 9): Promise<void> {
  fromLabel(label, taille); // valide la coordonnée
  const ici = plateau(page, taille).locator(`g[data-point="${label.toUpperCase()}"][data-pierre]:not([data-morte])`);
  if (couleur === null) await expect(ici).toHaveCount(0);
  else await expect(ici.and(page.locator(`[data-pierre="${couleur}"]`))).toHaveCount(1);
}

/**
 * Depuis l'accueil déjà affiché, choisit un mode de jeu (#429) : le bouton principal s'il porte ce mode, sinon sa tuile,
 * sinon « Plus » puis la ligne du mode. Au plus deux touchers.
 */
export async function choisirMode(page: Page, mode: 'en_ligne' | 'ordi' | 'ami' | 'deux' | 'guidee'): Promise<void> {
  const principal = page.locator(`.cta[data-mode="${mode}"]`);
  const tuile = page.getByTestId(`mode-${mode}`);
  await page.locator('.cta').waitFor();
  // #487 : avant la toute première pierre, l'accueil n'a que « Joue ta première partie » (contre l'ordi). Pour un autre
  // mode, le parcours part d'un appareil où une pierre a déjà été posée (repère go.premiere-pierre.v1, comme après une
  // leçon) : l'accueil complet revient sans recharger, par l'événement que le plateau envoie à la première pierre.
  if (mode !== 'ordi' && await page.locator('.accueil[data-epure]').count()) {
    await page.evaluate(() => { localStorage.setItem('go.premiere-pierre.v1', 'true'); window.dispatchEvent(new Event('go:premiere-pierre')); });
  }
  if (mode !== 'ordi' || !(await principal.count())) await page.getByTestId('modes').waitFor();
  if (await principal.count()) return principal.click();
  if (await tuile.count()) return tuile.click();
  await page.getByTestId('mode-plus').click();
  const nom = mode === 'deux' ? 'Jouer à deux sur ce téléphone' : 'Partie guidée contre Mochi';
  await page.getByRole('dialog', { name: 'Autres façons de jouer' }).getByRole('button', { name: new RegExp('^' + nom) }).click();
}

/** Depuis l'accueil déjà affiché : « Jouer à deux sur ce téléphone » (tuile, ou « Plus » avec les comptes ; #429). */
export async function lancerADeux(page: Page): Promise<void> {
  await choisirMode(page, 'deux');
}

/** Ouvre une partie à deux sur le même téléphone depuis l'accueil. */
export async function partieADeux(page: Page): Promise<void> {
  await page.goto('/');
  await lancerADeux(page);
  await expect(plateau(page)).toBeVisible();
}

/** Bandeau d'un joueur (« Noir », « Blanc », « Toi » ou le nom de l'adversaire), avec son couvercle. */
export function bandeau(page: Page, nom: string): Locator {
  return page.locator(`.joueur[data-joueur="${nom}"]`);
}

/** Couvercle d'un joueur : pierres qu'il a capturées (texte accessible « 1 pierre capturée »). */
export function couvercle(page: Page, nom: string): Locator {
  return bandeau(page, nom).locator('.couvercle');
}

/** Phrase du coach Mochi sous le plateau (zone aria-live). */
export function message(page: Page): Locator {
  return page.locator('.coach p[aria-live="polite"]');
}

/** « Passer » de la barre d'actions (la bulle de Mochi peut en montrer un second, #235). */
export function boutonPasser(page: Page): Locator {
  return page.getByRole('toolbar').getByRole('button', { name: 'Passer', exact: true });
}

/** Barre d'actions de la partie (en français ou en anglais). */
export function barreActions(page: Page): Locator {
  return page.getByRole('toolbar', { name: /^(Actions de la partie|Game actions)$/ });
}

/**
 * Ouvre le menu « Plus » (⋯) de la barre d'actions (partie-ecran-v3 : annuler, abandonner et réglages y sont rangés)
 * et renvoie sa feuille. S'il est déjà ouvert, le laisse ouvert.
 */
export async function ouvrirPlus(page: Page): Promise<Locator> {
  const plus = barreActions(page).locator('[data-action="plus"]');
  if ((await plus.getAttribute('aria-expanded')) !== 'true') await plus.click();
  const feuille = barreActions(page).locator('.actions-menu');
  await expect(feuille).toBeVisible();
  return feuille;
}

/** « Abandonner » (dans le menu « Plus »), puis « Confirmer ? » : la partie est perdue par abandon. */
export async function abandonner(page: Page): Promise<void> {
  const feuille = await ouvrirPlus(page);
  await feuille.getByRole('button', { name: /^(Abandonner|Resign)$/ }).click();
  await feuille.getByRole('button', { name: /^(Confirmer|Confirm)/ }).click();
}

/** Coups joués de la partie en cours (liste « Coups joués » au-dessus du plateau, passes comprises). */
export function coupsJoues(page: Page): Locator {
  return page.locator('ol.coups > li:not(.vide)');
}

/** Fin de partie contre l'ordi : récit du score, ou comptage manuel prêt à valider. */
export function finDePartie(page: Page): Locator {
  return page.locator('.recit, .barre-comptage .btn.primary:enabled').first();
}

/**
 * Passe. Si Mochi prévient que la partie n'est pas finie (#235, « Tu passes quand même ? »), confirme avec « Passer ».
 * Renvoie vrai si Mochi a prévenu. Au retour, la passe est jouée : un coup de plus dans la liste des coups.
 *
 * #258 : on attend un état observable (l'avertissement, ou la passe inscrite dans la liste), jamais une phrase de
 * Mochi. Avant, une phrase encore affichée (« Pomme joue E3. ») suffisait à croire l'attente finie, et l'erreur
 * d'attente était avalée : la passe pouvait ne pas être jouée au retour.
 */
export async function passer(page: Page): Promise<boolean> {
  const avant = await coupsJoues(page).count();
  const choix = page.getByRole('group', { name: 'Passer maintenant ?' });
  // La passe est jouée : elle est inscrite, ou la partie est déjà finie (l'écran de résultat remplace le plateau).
  const passeJouee = async () => (await coupsJoues(page).count()) > avant || (await partieQuittee(page));
  await boutonPasser(page).click();
  await expect.poll(async () => (await choix.count()) > 0 || (await passeJouee()), { timeout: 10_000 }).toBe(true);
  const averti = (await choix.count()) > 0;
  if (averti) {
    await choix.getByRole('button', { name: 'Passer', exact: true }).click();
    await expect.poll(async () => (await choix.count()) === 0 && (await passeJouee()), { timeout: 10_000 }).toBe(true);
  }
  return averti;
}

/** Plus de partie à l'écran (liste des coups absente) : l'écran de résultat a pris la place. */
async function partieQuittee(page: Page): Promise<boolean> {
  return (await page.locator('ol.coups').count()) === 0;
}

/**
 * Contre l'ordi, après ton coup ou ta passe (`avant` : nombre de coups avant le tien) : attend que l'adversaire ait
 * répondu (deux coups de plus, et « Passer » de nouveau actif) ou que la partie soit finie. Vrai si elle est finie.
 * On n'attend pas une phrase de Mochi : selon la réponse (atari, conseil de passer, « continue »…), elle change.
 */
export async function attendreReponse(page: Page, avant: number): Promise<boolean> {
  const aToi = boutonPasser(page).and(page.locator('button:enabled'));
  const finie = async () => (await finDePartie(page).isVisible()) || (await partieQuittee(page));
  await expect.poll(async () => (await finie())
    || ((await coupsJoues(page).count()) >= avant + 2 && (await aToi.count()) > 0), { timeout: 10_000 }).toBe(true);
  return finie();
}

/**
 * Contre l'ordi : passe jusqu'à la fin de la partie, puis valide le score. Depuis #117, le comptage est automatique
 * quand les pierres mortes sont sûres (récit direct) ; sinon, phase manuelle et « Valider le score ».
 */
export async function passerJusquAuScore(page: Page): Promise<void> {
  const fin = page.locator('.recit, .barre-comptage .btn.primary:enabled');
  for (let i = 0; i < 6 && !(await fin.first().isVisible()); i++) {
    await expect(boutonPasser(page)).toBeEnabled({ timeout: 10_000 });
    const avant = await coupsJoues(page).count();
    await passer(page);
    await attendreReponse(page, avant);
  }
  await expect(fin.first()).toBeVisible({ timeout: 10_000 });
  const valider = page.getByRole('button', { name: 'Valider le score' });
  if (await valider.isVisible()) await valider.click();
}
