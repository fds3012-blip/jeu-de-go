import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, jouer } from './plateau';
import { LESSONS_FR, type LessonStep } from '../src/content/lessons';
import LOT_W from '../src/content/lots/w-seki-fin-compte';

// Issue #16 : la leçon 14 (le seki) se finit, puis sa série d'entraînement : les 3 problèmes de seki du lot W
// (w01 à w03, prouvés par src/go/lot-w.test.ts), chacun avec une erreur d'abord (la réfutation), puis la réponse.
// Règle de Florian : aucun total ni cote affichés pendant la série. À 390 px en clair et à 320 px en sombre.
// Captures (JPEG) : docs/design/captures/lecons-pratique-14-16.

const norm = (s: string) => s.replace(/[\u00A0\u202F\s]+/g, ' ').trim();
const L14 = LESSONS_FR.find(l => l.id === 'l14')!;
const derniere = L14.steps.at(-1) as Extract<LessonStep, { kind: 'move' }>;
/** Les leçons 1 à 13 faites, la leçon 14 arrêtée à sa dernière étape. */
const PROGRES = {
  ...Object.fromEntries(LESSONS_FR.slice(0, LESSONS_FR.findIndex(l => l.id === 'l14')).map(l => [l.id, l.steps.length])),
  l14: L14.steps.length - 1,
};
const pb = (id: string) => LOT_W.find(r => r.id === id)!;
/** Erreur jouée d'abord dans chaque problème (sa réfutation est prouvée par lot-w.test.ts). */
const ERREUR: Record<string, string> = { w01: 'D9', w02: 'C1', w03: 'B1' };

async function sansDebordement(page: Page, ecran: string) {
  const { large, fenetre } = await page.evaluate(() => ({ large: document.documentElement.scrollWidth, fenetre: innerWidth }));
  expect(large, `défilement horizontal : ${ecran}`).toBeLessThanOrEqual(fenetre);
  for (const b of await page.locator('.verdict, .serie-pratique h2').all()) {
    const { sw, cw } = await b.evaluate(e => ({ sw: e.scrollWidth, cw: e.clientWidth }));
    expect(sw, `texte coupé : ${ecran}`).toBeLessThanOrEqual(cw);
  }
}

for (const [largeur, hauteur, theme] of [[390, 844, 'light'], [320, 568, 'dark']] as const) {
  test(`leçon 14 finie, puis ses 3 problèmes de seki, à ${largeur} px (${theme === 'light' ? 'clair' : 'sombre'})`, async ({ page }) => {
    await page.addInitScript(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), PROGRES);
    await page.setViewportSize({ width: largeur, height: hauteur });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
    const photo = (n: string) => page.screenshot({ path: `docs/design/captures/lecons-pratique-14-16/${largeur}-${n}.jpg`, type: 'jpeg', quality: 80 });
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
    await page.getByRole('button', { name: 'Reprendre la leçon : Le seki' }).click();

    // Dernière étape de la leçon : faire seki en E2, puis finir.
    await expect(page.locator('.bubble p')).toHaveText(norm(derniere.text));
    await jouer(page, 'E2');
    await expect(page.locator('.verdict')).toContainText(norm(derniere.ok));
    await page.getByRole('button', { name: 'Terminer la leçon' }).click();
    await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();
    // Le sceau de la leçon 14 a son dessin (plus le rond par défaut).
    await expect(page.locator('.fin-sceau [data-lecon="l14"] path')).not.toHaveCount(0);

    // Une seule action en relief : l'entraînement sur le seki.
    const pratique = page.getByRole('button', { name: /^Entraîne-toi\s:\s3 problèmes sur ce thème, Seki$/ });
    await expect(pratique).toHaveClass(/\bcta\b/);
    await expect(page.locator('.fin-lecon .cta')).toHaveCount(1);
    expect((await pratique.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await sansDebordement(page, 'fin de la leçon 14');
    await photo('0-fin-l14');
    await pratique.click();

    const serie = page.locator('.serie-pratique');
    await expect(serie).toHaveAttribute('data-serie', 'w01 w02 w03');
    for (const [rang, id] of [[1, 'w01'], [2, 'w02'], [3, 'w03']] as const) {
      const p = pb(id);
      await expect(serie).toHaveAttribute('data-rang', String(rang));
      await expect(page.getByRole('heading', { name: p.title! })).toBeVisible();
      await expect(page.getByText(norm(p.prompt!))).toBeVisible();
      // R2 et règle de Florian : « Entraînement » et des points, aucun chiffre, aucune cote.
      await expect(page.locator('.serie-surtitre')).toContainText('Entraînement');
      expect(await page.locator('.serie-surtitre').innerText()).not.toMatch(/\d/);
      await sansDebordement(page, `${id}, énoncé`);
      if (rang === 1) await photo('1-w01-enonce');

      // Erreur : la réfutation s'affiche, Blanc répond au point clé, puis la position revient.
      const faux = ERREUR[id];
      await jouer(page, faux);
      await expect(page.locator('.verdict [role="status"]')).toContainText('Pas tout à fait');
      await expect(page.locator('.verdict')).toContainText(norm((p.setup as { refutation: string }).refutation));
      await attendrePierre(page, p.answers[0], 'blanc');
      await sansDebordement(page, `${id}, erreur`);
      if (rang === 1) await photo('2-w01-erreur');
      await attendrePierre(page, faux, null);
      await attendrePierre(page, p.answers[0], null);

      // La réponse : seki.
      await jouer(page, p.answers[0]);
      await expect(page.locator('.verdict [role="status"]')).toContainText(norm(p.explanation!));
      await attendrePierre(page, p.answers[0], 'noir');
      await sansDebordement(page, `${id}, réussi`);
      if (rang === 3) await photo('3-w03-reussi');
      if (rang < 3) await page.getByRole('button', { name: 'Problème suivant' }).click();
    }

    // Fin de la série : retour au chemin (un niveau franchi a d'abord son écran à lui).
    await page.locator('.verdict').getByRole('button', { name: 'Retour au chemin' }).click();
    const niveau = page.getByTestId('niveau-atteint');
    const chemin = page.getByRole('button', { name: 'Leçon 14 : Le seki, terminée' });
    await expect(niveau.or(chemin).first()).toBeAttached();
    if (await niveau.count()) await niveau.getByRole('button', { name: 'Retour au chemin' }).click();
    await expect(chemin).toBeAttached();
    const reussis = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('go.problemes.v1') ?? '{}')));
    expect(reussis.sort()).toEqual(['w01', 'w02', 'w03']);
  });
}
