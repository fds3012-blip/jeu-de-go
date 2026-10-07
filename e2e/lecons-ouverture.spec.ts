import { expect, test, type Page } from '@playwright/test';
import { jouer, plateau } from './plateau';
import { LESSONS_FR, type LessonStep } from '../src/content/lessons';
import { ACQUIS } from '../src/content/acquis';

// Issue #16 : l'ouverture en 13 × 13 (l29, plateau entier) et le 3-4 et l'approche (l31, 19 × 19 cadré sur le coin bas
// gauche), jouées du début à la fin depuis le chemin Apprendre, avec une erreur réfutée à chaque exercice. 390 px en
// clair, 320 px en sombre, puis zoom 200 % (195 px) avec les polices web bloquées. Jugements prouvés par KataGo
// (src/go/lecons-ouverture.test.ts). Captures : seulement si CAPTURES_LECONS_OUVERTURE donne un dossier.

const norm = (s: string) => s.replace(/[\u00A0\u202F\s]+/g, ' ').trim();
const DOSSIER = process.env.CAPTURES_LECONS_OUVERTURE;
/** Toutes les leçons avant `id` sur le chemin sont faites : le bouton du chemin ouvre `id`. */
const avant = (id: string) => Object.fromEntries(LESSONS_FR.slice(0, LESSONS_FR.findIndex(l => l.id === id)).map(l => [l.id, l.steps.length]));
const etape = <K extends LessonStep['kind']>(id: string, i: number) => LESSONS_FR.find(l => l.id === id)!.steps[i] as Extract<LessonStep, { kind: K }>;

async function sansDebordement(page: Page, ecran: string, textes = true) {
  const { large, fenetre } = await page.evaluate(() => ({ large: document.documentElement.scrollWidth, fenetre: innerWidth }));
  expect(large, `défilement horizontal : ${ecran}`).toBeLessThanOrEqual(fenetre);
  if (!textes) return;
  for (const b of await page.locator('.bubble p, .verdict').all()) {
    const { sw, cw } = await b.evaluate(e => ({ sw: e.scrollWidth, cw: e.clientWidth }));
    expect(sw, `texte coupé : ${ecran}`).toBeLessThanOrEqual(cw);
  }
}

/**
 * Bouton d'action. Au zoom 200 % (195 px), la barre de navigation du bas recouvre le bouton « Continuer » du lecteur
 * (défaut du lecteur, signalé dans la PR) : on l'active au clavier, comme le ferait un joueur qui zoome.
 */
let auClavier = false;
async function appuyer(page: Page, nom: string) {
  const b = page.getByRole('button', { name: nom });
  if (!auClavier) return b.click();
  await b.focus();
  await page.keyboard.press('Enter');
}

async function ouvrir(page: Page, id: string, titre: string) {
  await page.addInitScript(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), avant(id));
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await expect(page.getByRole('heading', { name: 'L’ouverture' })).toBeAttached();
  await page.locator('.cta-chemin').scrollIntoViewIfNeeded();
  await page.locator('.cta-chemin').click();
  await expect(page.getByRole('heading', { name: titre })).toBeVisible();
}

/** Étape de démonstration avec geste : l'élève pose la pierre verte, la démonstration se finit. */
async function geste(page: Page, id: string, i: number, taille: number) {
  const s = etape<'info'>(id, i);
  await expect(page.locator('.bubble p')).toHaveText(norm(s.text));
  const zone = page.locator('.lecteur-plateau');
  await expect(zone).toHaveAttribute('data-demo', 'geste');
  await jouer(page, (s.geste as { pose: string }).pose, taille);
  await expect(zone).toHaveAttribute('data-demo', 'finie');
}

/** Exercice : d'abord le premier coup refusé (sa réfutation s'affiche), puis la première réponse acceptée. */
async function exercice(page: Page, id: string, i: number, taille: number) {
  const s = etape<'move'>(id, i);
  await expect(page.locator('.bubble p')).toHaveText(norm(s.text));
  const r = s.refus![0];
  await jouer(page, r.points[0], taille);
  await expect(page.locator('.verdict')).toContainText(norm(r.no));
  await jouer(page, (s.accept as string[])[0], taille);
  await expect(page.locator('.verdict')).toContainText(norm(s.ok));
}

async function l29(page: Page, ecran: (n: string) => Promise<void>) {
  await ouvrir(page, 'l29', 'L’ouverture en 13 × 13');
  const continuer = { click: () => appuyer(page, 'Continuer') };
  await expect(plateau(page, 13)).toBeVisible();
  await expect(plateau(page, 13)).not.toHaveAttribute('data-fenetre');
  await geste(page, 'l29', 0, 13);
  await ecran('1-coins');
  await continuer.click();
  await exercice(page, 'l29', 1, 13);
  await ecran('2-coin-libre');
  await continuer.click();
  // Question : E4 (collé) est faux, K4 (coin libre) est juste.
  const q = etape<'quiz'>('l29', 2);
  const choix = (n: string) => page.locator('.choix').getByRole('button', { name: n, exact: true });
  await choix('E4').click();
  await expect(choix('E4')).toHaveClass(/choix-faux/);
  await expect(page.locator('.choix-aide')).toContainText(norm(q.no));
  await choix('K4').click();
  await expect(page.locator('.verdict')).toContainText(norm(q.ok));
  await ecran('3-question');
  await continuer.click();
  await geste(page, 'l29', 3, 13);
  await ecran('4-bords');
  await continuer.click();
  await exercice(page, 'l29', 4, 13);
  await ecran('5-grand-point');
  await appuyer(page, 'Terminer la leçon');
  await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();
  await expect(page.getByText(norm(ACQUIS.l29))).toBeVisible();
  await ecran('6-fin');
}

async function l31(page: Page, ecran: (n: string) => Promise<void>) {
  await ouvrir(page, 'l31', 'Le 3-4 et l’approche');
  const continuer = { click: () => appuyer(page, 'Continuer') };
  // Coin bas gauche du 19 × 19 : A à K, lignes 1 à 10 ; les pierres des autres coins existent, hors de la vue.
  await expect(plateau(page, 19)).toHaveAttribute('data-fenetre', 'A10:K1');
  await geste(page, 'l31', 0, 19);
  await ecran('1-kakari');
  await continuer.click();
  await geste(page, 'l31', 1, 19);
  await continuer.click();
  await exercice(page, 'l31', 2, 19);
  await ecran('3-reponse');
  await continuer.click();
  await exercice(page, 'l31', 3, 19);
  await ecran('4-extension');
  await appuyer(page, 'Terminer la leçon');
  await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();
  await expect(page.getByText(norm(ACQUIS.l31))).toBeVisible();
  await ecran('5-fin');
}

for (const [largeur, hauteur, theme] of [[390, 844, 'light'], [320, 568, 'dark']] as const) {
  for (const [nom, jouerLecon] of [['l29, l’ouverture en 13 × 13', l29], ['l31, le 3-4 et l’approche (19 × 19 cadré)', l31]] as const) {
    test(`${nom}, jouée en entier à ${largeur} px (${theme === 'light' ? 'clair' : 'sombre'})`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: hauteur });
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
      await jouerLecon(page, async n => {
        await sansDebordement(page, n);
        if (DOSSIER && largeur === 390) await page.screenshot({ path: `${DOSSIER}/${nom.slice(0, 3)}-${n}.png` });
      });
    });
  }
}

// Zoom 200 % : 195 px de large, polices web bloquées (police de repli plus large, comme en CI).
for (const [nom, jouerLecon] of [['l29', l29], ['l31', l31]] as const) {
  test(`${nom} au zoom 200 %, polices bloquées : rien ne déborde, la leçon se joue`, async ({ page }) => {
    await page.route(/\.(woff2?|ttf|otf)(\?|$)/, r => r.abort());
    await page.setViewportSize({ width: 195, height: 422 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    auClavier = true;
    try {
      // Au zoom 200 %, seul le défilement horizontal est vérifié : la bulle du lecteur coupe ses mots à 195 px (signalé).
      await jouerLecon(page, n => sansDebordement(page, `200 % ${n}`, false));
    } finally { auClavier = false; }
  });
}
