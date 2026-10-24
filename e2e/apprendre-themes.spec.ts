import { expect, test, type Page } from '@playwright/test';
import { jouer } from './plateau';

// #590, #614 : « Par thème » dans Apprendre. Une grille de cartes sous la carte de la prochaine leçon, au même rendu que
// dans Problèmes (secondaire : « Reprendre » reste la seule action en relief) : la vignette, le nom, ce qu'on y apprend,
// puis « Maîtrisé » ou une barre. #652 : tous les thèmes, sans pli, sous les entrées du sommaire. Une carte ouvre la page du thème :
// sa notion expliquée, ses leçons avec leur état, et « S'entraîner sur ce thème » (3 problèmes du thème).

async function apprendre(page: Page, lecons: Record<string, number>) {
  await page.addInitScript(p => { if (!sessionStorage.getItem('pose')) { sessionStorage.setItem('pose', '1'); localStorage.setItem('go.lecons.v1', JSON.stringify(p)); } }, lecons);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
}

for (const theme of ['light', 'dark'] as const) {
  test(`grille « Par thème » sous le sommaire, 390 × 844 (${theme}) : tous les thèmes ; secondaire, 44 px`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: theme });
    await apprendre(page, { l1: 99, l2: 99, l3: 2 });
    const grille = page.getByTestId('par-theme');
    await expect(grille.getByRole('heading', { name: 'Par thème' })).toBeVisible();
    const cartes = grille.locator('.theme-carte');
    // Tous les thèmes, dans l'ordre où les leçons les font découvrir : Capture (leçon 1) d'abord.
    await expect(cartes).toHaveCount(15);
    expect((await cartes.evaluateAll(els => els.map(e => e.getAttribute('data-theme')))).slice(0, 7)).toEqual(['capture', 'atari', 'double-atari', 'bord', 'echelle', 'ko', 'vie-mort']);
    // Nom accessible : le nom, puis l'état ; la ligne de description décrit la carte.
    await expect(cartes.first()).toHaveAccessibleName(/^Capture, 1 leçon faite sur \d+$/);
    await expect(cartes.first()).toHaveAccessibleDescription('Bouche la dernière liberté pour prendre la pierre.');
    await expect(cartes.nth(1)).toHaveAccessibleName('Atari, Maîtrisé');
    await expect(cartes.nth(1).locator('.theme-maitrise-mot')).toHaveText('Maîtrisé');
    await expect(cartes.nth(1).locator('.theme-maitrise')).toHaveCount(0);
    // Rien de fait : une barre vide, sans texte.
    await expect(cartes.nth(2)).toHaveAccessibleName('Double atari, 0 leçon faite sur 1');
    expect(await cartes.nth(2).locator('.theme-maitrise > i').evaluate(i => i.getBoundingClientRect().width)).toBe(0);
    // Sous les entrées du sommaire (#652), proche d'elles.
    const carte = (await page.getByTestId('apprendre-entrees').boundingBox())!, r = (await grille.boundingBox())!;
    expect(r.y).toBeGreaterThan(carte.y + carte.height - 1);
    expect(r.y - (carte.y + carte.height)).toBeLessThan(48);
    for (const b of await cartes.all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // Une seule action en relief ; les cartes sont à plat ; une colonne sur téléphone, sans défilement de côté.
    await expect(page.locator('.apprendre .cta')).toHaveCount(1);
    expect(await cartes.first().evaluate(b => getComputedStyle(b).boxShadow)).toBe('none');
    // #625 : à plat, sans bordure, comme les tuiles d'Entraînement ; groupées en un bloc (2 px d'écart).
    expect(await cartes.evaluateAll(els => els.map(e => getComputedStyle(e).borderTopWidth))).toEqual(Array(15).fill('0px'));
    const ys = await cartes.evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; }));
    expect(Math.round(ys[1].top - ys[0].bottom)).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const xs = new Set(await cartes.evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().x))));
    expect(xs.size).toBe(1);
    await expect(grille.getByRole('button', { name: 'Tous les thèmes' })).toHaveCount(0);
  });
}

test('« Par thème » à 600 px : deux colonnes', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await apprendre(page, { l1: 99 });
  await expect(page.getByTestId('par-theme').locator('.theme-carte')).toHaveCount(15);
  const xs = new Set(await page.getByTestId('par-theme').locator('.theme-carte').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().x))));
  expect(xs.size).toBe(2);
  // #625 : sur plusieurs colonnes, des cartes séparées, toutes arrondies, toujours sans bordure.
  expect(await page.getByTestId('par-theme').locator('.theme-carte').evaluateAll(els => els.map(e => getComputedStyle(e).borderTopWidth + ' ' + getComputedStyle(e).borderBottomLeftRadius)))
    .toEqual(Array(15).fill('0px 16px'));
});

test('page d’un thème : notion expliquée, leçons avec leur état, une leçon s’ouvre et y ramène', async ({ page }) => {
  await apprendre(page, { l1: 99 });
  await page.getByTestId('par-theme').getByRole('button', { name: /^Capture,/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Capture' })).toBeVisible();
  await expect(page.getByText(/Une liberté, c’est un point vide juste à côté d’une pierre/)).toBeVisible();
  const lecons = page.locator('.theme-lecon');
  expect(await lecons.count()).toBeGreaterThanOrEqual(2);
  // #652 : le nom accessible dit le rang dans le programme et l'état, comme la carte de la prochaine leçon.
  await expect(lecons.first()).toHaveAccessibleName('Leçon 1 : Libertés et capture, terminée');
  await expect(lecons.nth(1)).toHaveAccessibleName(/^Leçon \d+ : [^,]+$/);
  // #627 (V12) : la leçon faite porte son sceau ; plus de pastille texte « Faite » ni « À faire ».
  await expect(lecons.first().locator('.sceau-lecon[data-lecon]')).toHaveCount(1);
  await expect(lecons.nth(1).locator('.sceau-lecon')).toHaveCount(0);
  await expect(page.locator('.theme-lecon-etat')).toHaveCount(0);
  await expect(page.locator('.theme-lecons').getByText(/^(Faite|À faire)$/)).toHaveCount(0);
  for (const b of await lecons.all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('.cta')).toHaveCount(1);
  await expect(page.locator('.cta')).toHaveText('S’entraîner sur ce thème');
  // Toucher une leçon l'ouvre ; en sortir ramène au thème.
  await lecons.first().click();
  await expect(page.locator('.lecteur-tete')).toBeVisible();
  await page.locator('.lecteur-tete .retour').click();
  await expect(page.getByRole('heading', { level: 2, name: 'Capture' })).toBeVisible();
  // « Retour à Apprendre » ramène au sommaire, avec la grille.
  await page.getByRole('button', { name: 'Retour à Apprendre' }).click();
  await expect(page.getByTestId('par-theme')).toBeVisible();
  // L'onglet Apprendre touché depuis la page d'un thème ramène aussi au sommaire.
  await page.getByTestId('par-theme').getByRole('button', { name: /^Atari,/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Atari' })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await expect(page.getByTestId('par-theme')).toBeVisible();
});

test('« S’entraîner sur ce thème » : 3 problèmes du thème, puis retour au thème', async ({ page }) => {
  await apprendre(page, { l1: 99 });
  await page.getByTestId('par-theme').getByRole('button', { name: /^Capture,/ }).click();
  await page.getByRole('button', { name: 'S’entraîner sur ce thème' }).click();
  const serie = page.locator('.serie-pratique');
  await expect(serie).toHaveAttribute('data-serie', /^\S+ \S+ \S+$/);
  await expect(serie).toHaveAttribute('data-rang', '1');
  // Le premier problème (le plus facile de la capture) : a01, « Première capture ».
  await expect(serie).toHaveAttribute('data-serie', /^a01 /);
  await jouer(page, 'E4');
  await expect(page.locator('.verdict')).toBeVisible();
  // Le retour du lecteur dit où il mène : la page du thème.
  await page.getByRole('button', { name: 'Retour au thème', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Capture' })).toBeVisible();
});

// #683 (Florian) : Ouverture, la réponse montrée au 1er problème arrêtait la série (« Revoir la suite » seul), et le
// lancement suivant reprenait « Le coin libre ». La série enchaîne ses 3 problèmes, puis un autre lancement en commence un autre.
test('« S’entraîner sur ce thème » (Ouverture) : 3 problèmes même après « Voir la réponse », puis un autre départ', async ({ page }) => {
  await apprendre(page, {});
  const carte = page.getByTestId('par-theme').getByRole('button', { name: /^Ouverture,/ });
  await carte.scrollIntoViewIfNeeded();
  await carte.click();
  await page.getByRole('button', { name: 'S’entraîner sur ce thème' }).click();
  const serie = page.locator('.serie-pratique');
  await expect(serie).toHaveAttribute('data-serie', 'x04 x05 x06');
  // Le surtitre dit d'où vient l'exercice : un entraînement du thème, pas une leçon de la liste.
  await expect(page.locator('.serie-surtitre')).toContainText('Entraînement · Ouverture');
  // x04 : erreur, indice, erreur, pourquoi, puis la réponse.
  await jouer(page, 'G7', 13);
  await page.getByRole('button', { name: 'Voir un indice' }).click();
  await jouer(page, 'G7', 13);
  await page.getByRole('button', { name: 'Voir pourquoi' }).click();
  await page.getByRole('button', { name: 'Voir la réponse' }).click();
  await expect(page.locator('[data-pourquoi-probleme]')).toBeVisible();
  await expect(page.locator('.rejoue-plateau')).toBeVisible();
  await page.getByRole('button', { name: 'Problème suivant' }).click();
  await expect(serie).toHaveAttribute('data-rang', '2');
  await jouer(page, 'D4', 13);
  await page.getByRole('button', { name: 'Problème suivant' }).click();
  await expect(serie).toHaveAttribute('data-rang', '3');
  await jouer(page, 'K4', 13);
  await expect(page.locator('.verdict')).toBeVisible();
  await page.locator('.verdict').getByRole('button', { name: 'Retour au thème' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Ouverture' })).toBeVisible();
  // 2e lancement : x04 (vu), x05 et x06 (réussis) ne reviennent pas sans le dire (#694) : seuls x07 et x08 sont neufs.
  await page.getByRole('button', { name: 'S’entraîner sur ce thème' }).click();
  await expect(serie).toHaveAttribute('data-serie', 'x07 x08');
});

// #694 (QA bug 4) : Compter n'a que 3 problèmes. Une fois faits, le thème le dit au lieu de les reproposer en boucle.
test('« S’entraîner sur ce thème » (Compter) : thème épuisé, dit clairement, puis révision au choix', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('go.problemes.v1', JSON.stringify({ w07: true, w08: true, w09: true })); });
  await apprendre(page, {});
  const carte = page.getByTestId('par-theme').getByRole('button', { name: /^Compter,/ });
  await carte.scrollIntoViewIfNeeded();
  await carte.click();
  await page.getByRole('button', { name: 'S’entraîner sur ce thème' }).click();
  await expect(page.locator('[data-theme-epuise]')).toContainText('Tu as fait tous les problèmes de ce thème. Reviens plus tard ou essaie un autre thème.');
  await expect(page.locator('.serie-pratique')).toHaveCount(0);
  await page.getByRole('button', { name: 'Les refaire pour réviser' }).click();
  await expect(page.locator('.serie-pratique')).toHaveAttribute('data-serie', /^w0[789] w0[789] w0[789]$/);
});
