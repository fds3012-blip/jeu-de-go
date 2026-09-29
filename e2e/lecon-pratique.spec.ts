import { expect, test } from '@playwright/test';
import { jouer } from './plateau';

// Issue #200 : de la leçon à la pratique. Fin de leçon : 3 problèmes du même thème, enchaînés dans le lecteur
// de problèmes. Fin de chapitre : « Joue contre Pomme » en action principale.

test('fin de la leçon 1 : 3 problèmes de capture enchaînés, puis retour au chemin', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('go.lecons.v1', JSON.stringify({ l1: 5 })));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.getByRole('button', { name: 'Reprendre la leçon : Libertés et capture' }).click();
  await jouer(page, 'E4');
  await page.getByRole('button', { name: 'Terminer la leçon' }).click();
  await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();

  // Une seule action en relief : l'entraînement. La leçon suivante et le chemin restent en liens.
  const pratique = page.getByRole('button', { name: /^Entraîne-toi\s:\s3 problèmes sur ce thème, Capture$/ });
  await expect(pratique).toHaveClass(/\bcta\b/);
  await expect(page.locator('.fin-lecon .cta')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Leçon suivante' })).toHaveClass(/\blien\b/);
  await expect(page.getByRole('button', { name: 'Retour au chemin' })).toBeVisible();
  const cible = await pratique.boundingBox();
  expect(cible!.height).toBeGreaterThanOrEqual(44);
  await pratique.click();

  // Les trois plus faciles du thème, dans le lecteur de problèmes existant. #237 : pas ceux qui répètent la leçon
  // (b1 est l'étape 4, a01 et n01 ont la même forme que les étapes 4 et 6).
  const serie = page.locator('.serie-pratique');
  await expect(serie).toHaveAttribute('data-serie', 'a02 n02 a03');
  for (const [rang, titre, coup] of [[1, 'Capture au bord', 'E2'], [2, 'Le plus gros d’abord', 'F1'], [3, 'Capture dans le coin', 'A2']] as const) {
    await expect(page.getByText(`Entraînement, ${rang} sur 3`)).toBeVisible();
    await expect(page.getByRole('heading', { name: titre })).toBeVisible();
    await jouer(page, coup);
    await expect(page.locator('.verdict')).toBeVisible();
    if (rang < 3) await page.getByRole('button', { name: 'Problème suivant' }).click();
  }
  // Fin de la série. #233 (C8) : leçon 1 (30 + 20 première fois) et 3 problèmes (10 + 20 première fois, puis 10 et 10)
  // font 100 XP : le niveau 2 tombe à la fin de la première leçon et de son entraînement. Il a son écran à lui (#236),
  // entre la feuille « Bravo » et le chemin, où la leçon 2 attend.
  await page.locator('.verdict').getByRole('button', { name: 'Retour au chemin' }).click();
  const ecranNiveau = page.getByTestId('niveau-atteint');
  await expect(ecranNiveau.getByRole('heading', { name: /Niveau\s2/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('go.xp.v1'))).toBe('100');
  await ecranNiveau.getByRole('button', { name: 'Retour au chemin' }).click();
  await expect(page.getByRole('button', { name: 'Commencer la leçon : Atari' })).toBeVisible();
  const reussis = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('go.problemes.v1') ?? '{}')));
  expect(reussis.sort()).toEqual(['a02', 'a03', 'n02']);
  // #237 : réussis en pratique, ils ne reviendront pas dès demain dans la Révision du jour.
  const recents = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('go.revision.v1') ?? '{}').recents ?? {}));
  expect(recents.sort()).toEqual(['a02', 'a03', 'n02']);

});

test('fin de chapitre : « Joue contre Pomme » en action principale, qui lance la partie', async ({ page }) => {
  const presque = { l1: 6, l2: 6, l3: 8, l4: 5, l5: 5, l6: 6, l7: 5 };
  await page.addInitScript(p => {
    localStorage.setItem('go.lecons.v1', JSON.stringify(p));
    localStorage.setItem('go.settings.v1', JSON.stringify({ celebrations: false }));
  }, presque);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.getByRole('button', { name: 'Reprendre la leçon : Compter les points' }).click();
  await page.locator('.choix').getByRole('button', { name: '39', exact: true }).click();
  await page.getByRole('button', { name: 'Terminer la leçon' }).click();
  await expect(page.getByRole('heading', { name: 'Chapitre terminé' })).toBeVisible();

  const jouerPomme = page.getByRole('button', { name: 'Joue contre Pomme' });
  await expect(jouerPomme).toHaveClass(/\bcta\b/);
  await expect(page.locator('.fin-lecon .cta')).toHaveCount(1);
  // La leçon 7 (comptage) n'a pas encore de problèmes : pas d'entraînement proposé.
  await expect(page.getByRole('button', { name: /^Entraîne-toi/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retour au chemin' })).toHaveClass(/\blien\b/);
  await jouerPomme.click();
  await expect(page.locator('main.app-partie')).toBeVisible();
  await expect(page.getByText(/Pomme/).first()).toBeVisible();
});

test('fin de la leçon 3, toutes les autres faites : fin de chapitre, et un problème de chaque piège', async ({ page }) => {
  const presque = { l1: 6, l2: 6, l3: 7, l4: 5, l5: 5, l6: 6, l7: 6 };
  await page.addInitScript(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), presque);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.getByRole('button', { name: 'Reprendre la leçon : Techniques de capture' }).click();
  await jouer(page, 'F5');
  await page.getByRole('button', { name: 'Terminer la leçon' }).click();

  // Toutes les leçons sont faites : c'est aussi la fin du chapitre. Pomme en relief, l'entraînement en lien.
  await expect(page.getByRole('heading', { name: 'Chapitre terminé' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Joue contre Pomme' })).toHaveClass(/\bcta\b/);
  const pratique = page.getByRole('button', { name: /^Entraîne-toi\s:\s3 problèmes sur ce thème, Double atari, Vers le bord, Échelle$/ });
  await expect(pratique).toHaveClass(/\blien\b/);
  await pratique.click();
  await expect(page.locator('.serie-pratique')).toHaveAttribute('data-serie', 'c1 n06 i09');
  await expect(page.getByText('Entraînement, 1 sur 3')).toBeVisible();
  // Le retour du lecteur ramène au chemin.
  await page.getByRole('button', { name: 'Retour au chemin' }).first().click();
  await expect(page.getByText('Chapitre terminé. Tu connais les règles du go !')).toBeVisible();
});
