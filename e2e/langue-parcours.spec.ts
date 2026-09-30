import { expect, test, type Page } from '@playwright/test';
import { jouer } from './plateau';
import { readdirSync, readFileSync } from 'node:fs';
// Textes anglais : chargés à la demande dans l'app (#325), enregistrés ici pour `localiser(…, 'en')`.
import '../src/content/anglais.setup';
import { CHAPITRES, LESSONS, localiser } from '../src/content/lessons';

/**
 * Textes des problèmes, lus dans les sources (src/content/puzzles.ts et lots/*.ts) : ces fichiers passent par
 * `import.meta.glob` de Vite, qu'on ne peut pas importer ici. Champs : title, prompt, explanation, refutation.
 */
function textesProblemes(): string[] {
  const dossier = 'src/content/lots';
  const fichiers = ['src/content/puzzles.ts', ...readdirSync(dossier).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts')).map(f => `${dossier}/${f}`)];
  const textes: string[] = [];
  for (const f of fichiers) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\b(?:title|prompt|explanation|refutation)\s*:\s*(['"`])((?:\\.|(?!\1).)*)\1/gs)) textes.push(m[2].replace(/\\(.)/g, '$1'));
  }
  return textes;
}

// Issue #167, étape 5 : toute l'app en `?lang=en` (accueil, partie jusqu'à la revue, Apprendre et une leçon,
// Problèmes et un problème, Profil, Réglages, Compte, Conditions). Aucun texte visible ne doit contenir de mot français
// courant, hors contenu pas encore traduit.
//
// Exclusions (documentées) :
// 1. Contenu des leçons pas encore traduites (content/lessons.fr.js) : titres, descriptions, consignes, réponses et choix
//    des quiz. Les leçons de content/lessons.en.js s'affichent en anglais et ne sont pas exclues (anglais vérifié ici aussi).
// 2. Contenu des problèmes (src/content/puzzles.ts et table `puzzles`) : titres, consignes, explications, réfutations.
// 3. Noms propres des adversaires et de Mochi (glossaire : gardés comme des prénoms). « Rivière » porte un accent.
// 4. « Français » dans le réglage Langue : chaque langue garde son nom dans sa langue.
// Ces textes sont retirés de la page avant la recherche ; tout le reste (boutons, titres d'écran, bulles de Mochi,
// messages, textes pour lecteur d'écran visibles dans l'arbre) doit être en anglais.

/** Mots français courants, absents de l'anglais de l'interface. Les lettres accentuées aussi. */
const FRANCAIS = /\b(le|la|les|des|du|une|est|et|pour|avec|sans|ton|ta|tes|tu|toi|je|pas|sur|dans|qui|que|mon|mes|au|aux|ce|cette|leçons?|parties?|joue[rsz]?|jouer|problèmes?|coups?|pierres?|réglages|accueil|suivante?|continuer|terminer|revoir|compte|niveau|série|jours?|noir|blanc|retour|partout|encore)\b|[àâçéèêëîïôûùœ]/giu;
const NOMS = ['Rivière', 'Français'];

const norm = (s: string) => s.replace(/[\u00A0\u202F\s]+/g, ' ').trim();

/** Tous les textes de contenu, du plus long au plus court (un titre peut être dans une consigne). */
const CONTENU: string[] = (() => {
  const textes = new Set<string>();
  const ajouter = (v: unknown) => {
    if (typeof v === 'string') { if (/\s/.test(v.trim())) textes.add(norm(v)); }
    else if (Array.isArray(v)) v.forEach(ajouter);
    else if (v && typeof v === 'object') Object.values(v).forEach(ajouter);
  };
  // Leçons entières (titres, descriptions, consignes, réponses, réfutations) et chapitres (titre, intro, phrase de fin).
  ajouter(LESSONS);
  // Choix des quiz d'un seul mot (« Noir », « Blanc ») : ajoutés à part, le filtre ci-dessus ne garde que les phrases.
  for (const l of LESSONS) for (const s of l.steps) if ('choices' in s) for (const c of s.choices) textes.add(norm(c));
  for (const c of CHAPITRES) { ajouter(c.titre); ajouter(c.intro); if (c.fin) { ajouter(c.fin); ajouter(c.fin.replace(/\.$/, ' !')); } }
  ajouter(textesProblemes());
  return [...textes].sort((a, b) => b.length - a.length);
})();

/** Titre court d'une leçon (avant « : »), tel que le chemin l'affiche dans les boutons. */
const COURTS = LESSONS.map(l => norm(l.title.split(/\s*:\s*/)[0]));

async function sansFrancais(page: Page, ecran: string) {
  expect(await textesFrancais(page), `textes français sur l'écran « ${ecran} »`).toEqual([]);
  // Les textes anglais tiennent dans l'écran : aucun défilement horizontal.
  const { large, fenetre } = await page.evaluate(() => ({ large: document.documentElement.scrollWidth, fenetre: innerWidth }));
  expect(large, `défilement horizontal sur l'écran « ${ecran} »`).toBeLessThanOrEqual(fenetre);
}

/** Lignes visibles qui gardent un mot français une fois le contenu et les noms propres retirés. */
async function textesFrancais(page: Page): Promise<string[]> {
  const brut = await page.evaluate(() => document.body.innerText);
  const lignes = brut.split('\n').map(norm).filter(Boolean).map(ligne => {
    let l = ligne;
    for (const c of CONTENU) if (l.includes(c)) l = l.split(c).join(' ');
    for (const c of COURTS) l = l.split(c).join(' ');
    for (const n of NOMS) l = l.split(n).join(' ');
    return { ligne, reste: l };
  });
  return lignes.filter(({ reste }) => reste.match(FRANCAIS)).map(({ ligne, reste }) => `${ligne}  [${reste.match(FRANCAIS)!.join(', ')}]`);
}

test('le détecteur trouve bien le français de l’interface, et ignore le contenu des leçons', async ({ page }) => {
  await page.goto('/');
  expect(await textesFrancais(page)).toEqual(expect.arrayContaining([expect.stringMatching(/^Joue ta première partie/)]));
  await page.goto('/?lang=en');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Learn' }).click();
  // Leçon 1 traduite (#167) : sa description est en anglais.
  await expect(page.getByText(localiser(LESSONS[0], 'en').desc)).toBeVisible();
  await sansFrancais(page, 'Apprendre');
});

for (const largeur of [390, 320]) test(`?lang=en : toute l’interface en anglais, hors contenu des leçons et des problèmes, à ${largeur} px`, async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: largeur, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto('/?lang=en&komi=-100');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });

  // Accueil.
  await expect(page.getByRole('button', { name: 'Play your first game against Pomme' })).toBeVisible();
  await sansFrancais(page, 'accueil');

  // Partie courte contre Pomme : un coup, des passes, le score, la fin, la revue.
  await page.getByRole('button', { name: 'Play your first game against Pomme' }).click();
  const actions = page.getByRole('toolbar', { name: 'Game actions' });
  const passer = actions.getByRole('button', { name: 'Pass', exact: true });
  await expect(passer).toBeEnabled({ timeout: 10_000 });
  await sansFrancais(page, 'partie');
  await jouer(page, 'E5');
  await expect(page.getByRole('list', { name: 'Moves played' })).toContainText('1. E5');
  await expect(passer).toBeEnabled({ timeout: 10_000 });
  await sansFrancais(page, 'partie, après un coup');
  const fin = page.locator('.recit, .barre-comptage .btn.primary:enabled');
  for (let i = 0; i < 6 && !(await fin.first().isVisible()); i++) {
    await expect(passer).toBeEnabled({ timeout: 10_000 });
    await passer.click();
    // #235 : si Mochi prévient que la partie n'est pas finie, on vérifie l'avertissement en anglais puis on confirme.
    const choix = page.getByRole('group', { name: 'Pass now?' });
    if (await choix.waitFor({ state: 'visible', timeout: 600 }).then(() => true, () => false)) {
      await sansFrancais(page, `partie, avertissement ${i + 1}`);
      await choix.getByRole('button', { name: 'Pass', exact: true }).click();
    }
    await expect(fin.or(page.getByText(/Pomme (plays|captures|keeps playing)|Some borders are still open/)).first()).toBeVisible({ timeout: 10_000 });
    await sansFrancais(page, `partie, passe ${i + 1}`);
  }
  await expect(fin.first()).toBeVisible({ timeout: 10_000 });
  const valider = page.getByRole('button', { name: 'Confirm score' });
  if (await valider.isVisible()) {
    await sansFrancais(page, 'comptage');
    await valider.click();
  }
  const recit = page.getByRole('region', { name: 'Counting the points' });
  await expect(recit).toBeVisible();
  await sansFrancais(page, 'récit du score');
  await recit.getByRole('button', { name: 'See the result' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Victory' })).toBeVisible();
  await sansFrancais(page, 'fin de partie');
  await page.getByRole('button', { name: 'Review my game' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Review my game' })).toBeVisible();
  await expect(page.locator('.revue-analyse')).toHaveCount(0, { timeout: 30_000 });
  await sansFrancais(page, 'revue');

  // Apprendre : le chemin, puis la première leçon.
  await page.goto('/?lang=en');
  await nav.getByRole('button', { name: 'Learn' }).click();
  await expect(page.getByRole('heading', { name: 'Coming soon' })).toBeVisible();
  await sansFrancais(page, 'Apprendre');
  await page.screenshot({ path: `docs/localisation/captures/apprendre-en-${largeur}.png` });
  await page.locator('.cta-chemin').click();
  await expect(page.getByRole('button', { name: 'Back to the path' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Lesson progress' })).toHaveAttribute('aria-valuetext', /^0 of \d+ steps done$/);
  await sansFrancais(page, 'leçon');
  await page.screenshot({ path: `docs/localisation/captures/lecon-en-${largeur}.png` });
  const continuer = page.getByRole('button', { name: 'Continue', exact: true });
  if (await continuer.isVisible()) {
    await continuer.click();
    await sansFrancais(page, 'leçon, étape 2');
  }
  await page.getByRole('button', { name: 'Back to the path' }).click();

  // Problèmes : l'écran, puis un problème et une mauvaise réponse.
  await nav.getByRole('button', { name: 'Puzzles' }).click();
  await expect(page.getByRole('heading', { name: /^Daily Go #\d+$/ })).toBeVisible();
  await sansFrancais(page, 'Problèmes');
  await page.getByRole('button', { name: 'All puzzles' }).click();
  await sansFrancais(page, 'tous les problèmes');
  await page.getByRole('group', { name: 'Beginner' }).locator('[data-probleme]').first().click();
  await expect(page.getByRole('button', { name: 'Back to puzzles' })).toBeVisible();
  await sansFrancais(page, 'problème');
  await page.getByRole('button', { name: 'Back to puzzles' }).click();

  // Profil, Réglages, Compte, Conditions (toutes les sections ouvertes).
  await nav.getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByRole('heading', { name: 'Your journey' })).toBeVisible();
  await sansFrancais(page, 'Profil');
  await page.getByRole('button', { name: /^Settings/ }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await sansFrancais(page, 'Réglages');
  await nav.getByRole('button', { name: 'Profile' }).click();
  await page.getByRole('button', { name: /^My account/ }).click();
  await expect(page.getByText(/^(Your account|Create your account|Loading your account…)$/).first()).toBeVisible();
  await sansFrancais(page, 'Compte');
  await page.screenshot({ path: `docs/localisation/captures/compte-en-${largeur}.png` });
  await nav.getByRole('button', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'Terms and privacy' }).click();
  await expect(page.getByRole('heading', { name: 'Terms and privacy' })).toBeVisible();
  await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
  await expect(page.getByText('Under 15? Create your account with a parent.')).toBeVisible();
  await sansFrancais(page, 'Conditions');
  await page.screenshot({ path: `docs/localisation/captures/conditions-en-${largeur}.png`, fullPage: true });
  expect(erreurs).toEqual([]);
});

test('?lang=en : suppression du compte en anglais, mot de confirmation « DELETE »', async ({ page }) => {
  await page.goto('/?lang=en&compte-simule');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Profile' }).click();
  await page.getByRole('button', { name: /^My account/ }).click();
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await expect(page.getByText('Delete your account?')).toBeVisible();
  const final = page.getByRole('button', { name: 'Delete permanently' });
  await expect(final).toBeDisabled();
  await page.getByLabel('To confirm, type DELETE').fill('delete');
  await expect(final).toBeEnabled();
  await sansFrancais(page, 'suppression du compte');
});
