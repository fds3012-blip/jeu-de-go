import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, jouer, plateau } from './plateau';
import { LESSONS_FR, type LessonStep } from '../src/content/lessons';
import LOT_W from '../src/content/lots/w-seki-fin-compte';
import LOT_X from '../src/content/lots/x-ko-ouverture';

// Issue #16, lot X : séries de fin des leçons 4, 6, 7 et 8.
// - Leçon 7 (compter les points) finie, puis sa série : w04, w07, w05 du lot W (fermer, la dame, fermer), chacun avec
//   une erreur d'abord (réfutation et réplique de Blanc), puis la réponse. À 390 px en clair et à 320 px en sombre.
// - Leçons 4 (le ko) et 8 (les premiers coups) : leur série depuis la fin de leçon ; le ko en 9 × 9, l'ouverture en
//   13 × 13 (premiers problèmes 13 × 13 de l'appli : le plateau doit tenir à 320 px).
// Règle de Florian : aucun total ni cote affichés pendant la série.
// Captures (JPEG, 10 au total) : docs/design/captures/pratique-lecons-4-6-7-8.

const norm = (s: string) => s.replace(/[\u00A0\u202F\s]+/g, ' ').trim();
const LOTS = [...LOT_W, ...LOT_X];
const pb = (id: string) => LOTS.find(r => r.id === id)!;
const refut = (id: string) => (pb(id).setup as { refutation: string }).refutation;

/** Les leçons avant `id` faites, la leçon `id` arrêtée à sa dernière étape. */
function progres(id: string) {
  const i = LESSONS_FR.findIndex(l => l.id === id);
  return { ...Object.fromEntries(LESSONS_FR.slice(0, i).map(l => [l.id, l.steps.length])), [id]: LESSONS_FR[i].steps.length - 1 };
}

async function sansDebordement(page: Page, ecran: string) {
  const { large, fenetre } = await page.evaluate(() => ({ large: document.documentElement.scrollWidth, fenetre: innerWidth }));
  expect(large, `défilement horizontal : ${ecran}`).toBeLessThanOrEqual(fenetre);
  for (const b of await page.locator('.verdict, .serie-pratique h2').all()) {
    const { sw, cw } = await b.evaluate(e => ({ sw: e.scrollWidth, cw: e.clientWidth }));
    expect(sw, `texte coupé : ${ecran}`).toBeLessThanOrEqual(cw);
  }
}

async function ouvrirLecon(page: Page, id: string, largeur: number, hauteur: number, theme: 'light' | 'dark') {
  await page.addInitScript(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), progres(id));
  await page.setViewportSize({ width: largeur, height: hauteur });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  const titre = LESSONS_FR.find(l => l.id === id)!.title;
  await page.getByRole('button', { name: `Reprendre la leçon : ${titre}` }).click();
}

/** Un problème de la série : une erreur (réfutation, réplique de Blanc), puis la réponse. */
async function resoudre(page: Page, id: string, faux: string, taille: number, photo?: (n: string) => Promise<unknown>, etapes: string[] = []) {
  const cliche = (n: string) => (etapes.includes(n) ? photo?.(`${id}-${n}`) : undefined);
  const p = pb(id);
  await expect(page.getByRole('heading', { name: p.title! })).toBeVisible();
  await expect(page.getByText(norm(p.prompt!))).toBeVisible();
  await expect(plateau(page, taille)).toBeVisible();
  // Règle de Florian : « Entraînement » et des points, aucun chiffre, aucune cote.
  await expect(page.locator('.serie-surtitre')).toContainText('Entraînement');
  expect(await page.locator('.serie-surtitre').innerText()).not.toMatch(/\d/);
  await sansDebordement(page, `${id}, énoncé`);
  await cliche('enonce');

  await jouer(page, faux, taille);
  await expect(page.locator('.verdict [role="status"]')).toContainText('Pas tout à fait');
  await expect(page.locator('.verdict')).toContainText(norm(refut(id)));
  await attendrePierre(page, p.answers[0], 'blanc', taille);
  await sansDebordement(page, `${id}, erreur`);
  await cliche('erreur');
  await attendrePierre(page, faux, null, taille);
  await attendrePierre(page, p.answers[0], null, taille);

  await jouer(page, p.answers[0], taille);
  await expect(page.locator('.verdict [role="status"]')).toContainText(norm(p.explanation!));
  await attendrePierre(page, p.answers[0], 'noir', taille);
  await sansDebordement(page, `${id}, réussi`);
  await cliche('reussi');
}

for (const [largeur, hauteur, theme] of [[390, 844, 'light'], [320, 568, 'dark']] as const) {
  test(`leçon 7 finie, puis sa série (fermer, la dame, fermer), à ${largeur} px (${theme === 'light' ? 'clair' : 'sombre'})`, async ({ page }) => {
    const photo = (n: string) => page.screenshot({ path: `docs/design/captures/pratique-lecons-4-6-7-8/${largeur}-l7-${n}.jpg`, type: 'jpeg', quality: 80 });
    await ouvrirLecon(page, 'l7', largeur, hauteur, theme);

    // Dernière étape : le quiz « combien de points pour Noir ? » (39).
    const derniere = LESSONS_FR.find(l => l.id === 'l7')!.steps.at(-1) as Extract<LessonStep, { kind: 'quiz' }>;
    await expect(page.locator('.bubble p')).toHaveText(norm(derniere.text));
    await page.locator('.choix').getByRole('button', { name: derniere.choices[derniere.answer], exact: true }).click();
    await expect(page.locator('.verdict')).toContainText(norm(derniere.ok));
    await page.getByRole('button', { name: 'Terminer la leçon' }).click();

    // Fin du chapitre 1 : l'action principale reste la partie contre le premier adversaire ; l'entraînement est
    // proposé juste après, avec ses deux thèmes.
    const pratique = page.getByRole('button', { name: /^Entraîne-toi\s:\s3 problèmes sur ce thème, Finir la partie, Compter$/ });
    await expect(pratique).toBeVisible();
    // #220 : en fin de chapitre, Pomme garde seul le relief ; l'entraînement est un lien.
    await expect(page.getByRole('button', { name: 'Joue contre Pomme' })).toHaveClass(/\bcta\b/);
    await expect(pratique).toHaveClass(/\blien\b/);
    await expect(page.locator('.fin-lecon .cta')).toHaveCount(1);
    expect((await pratique.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await sansDebordement(page, 'fin de la leçon 7');
    await photo('0-fin');
    await pratique.click();

    const serie = page.locator('.serie-pratique');
    await expect(serie).toHaveAttribute('data-serie', 'w04 w07 w05');
    const faux: Record<string, string> = { w04: 'E4', w07: 'A9', w05: 'D3' };
    for (const [rang, id] of [[1, 'w04'], [2, 'w07'], [3, 'w05']] as const) {
      await expect(serie).toHaveAttribute('data-rang', String(rang));
      await resoudre(page, id, faux[id], 9, photo, rang === 2 ? ['erreur'] : []);
      if (rang < 3) await page.getByRole('button', { name: 'Problème suivant' }).click();
    }
    await page.locator('.verdict').getByRole('button', { name: 'Retour au chemin' }).click();
    const niveau = page.getByTestId('niveau-atteint');
    const chemin = page.getByRole('button', { name: /^Leçon 7 : Compter les points, terminée/ });
    await expect(niveau.or(chemin).first()).toBeAttached();
    if (await niveau.count()) await niveau.getByRole('button', { name: 'Retour au chemin' }).click();
    await expect(chemin).toBeAttached();
    const reussis = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('go.problemes.v1') ?? '{}')));
    expect(reussis.sort()).toEqual(['w04', 'w05', 'w07']);
  });
}

/** Finit la dernière étape d'une leçon dont la dernière étape est un coup, puis ouvre la série. */
async function finirEtPratiquer(page: Page, id: string, coup: string, themes: string) {
  const derniere = LESSONS_FR.find(l => l.id === id)!.steps.at(-1) as Extract<LessonStep, { kind: 'move' | 'touche' }>;
  await expect(page.locator('.bubble p')).toHaveText(norm(derniere.text));
  await jouer(page, coup);
  await expect(page.locator('.verdict')).toContainText(norm(derniere.ok));
  await page.getByRole('button', { name: 'Terminer la leçon' }).click();
  const pratique = page.getByRole('button', { name: new RegExp(`^Entraîne-toi\\s:\\s3 problèmes sur ce thème, ${themes}$`) });
  await expect(pratique).toBeVisible();
  await pratique.click();
}

for (const [largeur, hauteur, theme] of [[390, 844, 'light'], [320, 568, 'dark']] as const) {
  test(`leçon 4 finie, puis ses 3 problèmes de ko, à ${largeur} px (${theme === 'light' ? 'clair' : 'sombre'})`, async ({ page }) => {
    const photo = (n: string) => page.screenshot({ path: `docs/design/captures/pratique-lecons-4-6-7-8/${largeur}-l4-${n}.jpg`, type: 'jpeg', quality: 80 });
    await ouvrirLecon(page, 'l4', largeur, hauteur, theme);
    // Dernière étape : « Touche le point où Blanc ne peut pas reprendre » (E5).
    await finirEtPratiquer(page, 'l4', 'E5', 'Ko');
    const serie = page.locator('.serie-pratique');
    await expect(serie).toHaveAttribute('data-serie', 'x01 x02 x03');
    const faux: Record<string, string> = { x01: 'A3', x02: 'D7', x03: 'C5' };
    for (const [rang, id] of [[1, 'x01'], [2, 'x02'], [3, 'x03']] as const) {
      await expect(serie).toHaveAttribute('data-rang', String(rang));
      await resoudre(page, id, faux[id], 9, photo, rang === 3 ? ['reussi'] : []);
      if (rang < 3) await page.getByRole('button', { name: 'Problème suivant' }).click();
    }
    // Le ko : Blanc ne peut pas reprendre en E5 tout de suite (le lecteur ne propose plus de coup, la série est finie).
    await expect(page.locator('.verdict').getByRole('button', { name: 'Retour au chemin' })).toBeVisible();
  });

  test(`leçon 8 finie, puis 3 problèmes d’ouverture en 13 × 13, à ${largeur} px (${theme === 'light' ? 'clair' : 'sombre'})`, async ({ page }) => {
    const photo = (n: string) => page.screenshot({ path: `docs/design/captures/pratique-lecons-4-6-7-8/${largeur}-l8-${n}.jpg`, type: 'jpeg', quality: 80 });
    await ouvrirLecon(page, 'l8', largeur, hauteur, theme);
    // Dernière étape : « étends-toi le long du bord » (C5).
    await finirEtPratiquer(page, 'l8', 'C5', 'Ouverture');
    const serie = page.locator('.serie-pratique');
    await expect(serie).toHaveAttribute('data-serie', 'x04 x05 x06');
    // Erreur type : la 2e ligne, au bord du coin libre.
    const faux: Record<string, string> = { x04: 'B12', x05: 'B2', x06: 'L2' };
    for (const [rang, id] of [[1, 'x04'], [2, 'x05'], [3, 'x06']] as const) {
      await expect(serie).toHaveAttribute('data-rang', String(rang));
      // À 320 px, le 13 × 13 garde au moins 18 px entre deux lignes (19 px mesurés, comme en partie 13 × 13) :
      // sous les 44 px d'une cible tactile, d'où la confirmation du coup proposée dans les réglages.
      const box = (await plateau(page, 13).boundingBox())!;
      expect(box.width / 14, `${id} : écart entre lignes`).toBeGreaterThanOrEqual(18);
      await resoudre(page, id, faux[id], 13, photo, rang === 1 ? ['enonce', 'erreur'] : []);
      if (rang < 3) await page.getByRole('button', { name: 'Problème suivant' }).click();
    }
  });
}
