import { expect, test } from '@playwright/test';
import { jouer } from './plateau';

// Issue #40, phase 6 : chemin de pierres de gué, lecteur de leçon et fin de leçon.

test('terminer la leçon 1 affiche la fin de leçon, puis la pierre 1 est cochée sur le chemin', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();

  // Chemin neuf : la leçon 1 est la prochaine étape, le bouton principal dit « Commencer ».
  await expect(page.getByRole('button', { name: 'Leçon 1 : Libertés et capture, prochaine étape' })).toBeVisible();
  await expect(page.getByText('Bientôt')).toBeVisible();
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(debord).toBeLessThanOrEqual(0);
  await page.getByRole('button', { name: 'Commencer' }).click();

  // Barre de progression des étapes (pas de texte « étape 1 sur 3 »).
  const progression = page.getByRole('progressbar', { name: 'Progression de la leçon' });
  await expect(progression).toHaveAttribute('aria-valuenow', '0');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(progression).toHaveAttribute('aria-valuenow', '1');

  // Mauvaise réponse : verdict « à revoir », puis bonne réponse.
  await jouer(page, 'A1');
  await expect(page.getByText(/Essaie encore\./)).toBeVisible();
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await jouer(page, 'E5');
  await expect(page.getByText(/^Capturée/)).toBeVisible();
  await expect(progression).toHaveAttribute('aria-valuenow', '2');
  await page.getByRole('button', { name: 'Continuer' }).click();

  await jouer(page, 'E4');
  await page.getByRole('button', { name: 'Terminer la leçon' }).click();

  await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();
  // Célébration modeste : pas de confettis avant la dernière leçon.
  await expect(page.getByTestId('confettis')).toHaveCount(0);
  await expect(page.getByText(/Tu sais compter les libertés/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leçon suivante' })).toBeVisible();
  await page.getByRole('button', { name: 'Retour au chemin' }).click();

  const pierre1 = page.getByRole('button', { name: 'Leçon 1 : Libertés et capture, terminée' });
  await expect(pierre1).toBeVisible();
  await expect(pierre1).toHaveAttribute('data-etat', 'faite');
  await expect(page.getByRole('button', { name: /^Leçon 2 : .*, prochaine étape$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuer : Atari' })).toBeVisible();
  // Un seul bouton en relief : sous la leçon en cours, il n'affiche que le verbe.
  await expect(page.locator('.cta')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Continuer : Atari' })).toHaveText('Continuer');
  await expect(page.getByRole('button', { name: /^Leçon 3 : / })).toHaveAttribute('data-etat', 'avenir');
});

test('dernière leçon : « Chapitre terminé », confettis, sauf si les célébrations sont coupées', async ({ page }) => {
  const presque = { l1: 3, l2: 3, l3: 3, l4: 2, l5: 3, l6: 2 };
  for (const celebrations of [true, false]) {
    await page.addInitScript(([p, c]) => {
      localStorage.setItem('go.lecons.v1', JSON.stringify(p));
      localStorage.setItem('go.settings.v1', JSON.stringify({ celebrations: c }));
    }, [presque, celebrations] as const);
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
    await page.getByRole('button', { name: 'Continuer : Territoire et ouverture' }).click();
    await jouer(page, 'E5');
    await page.getByRole('button', { name: 'Terminer la leçon' }).click();
    await expect(page.getByRole('heading', { name: 'Chapitre terminé' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retour au chemin' })).toBeVisible();
    if (celebrations) await expect(page.getByTestId('confettis')).toBeAttached();
    else { await page.waitForTimeout(800); await expect(page.getByTestId('confettis')).toHaveCount(0); }
  }
});

test('« Leçon suivante » ouvre la leçon 2', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('go.lecons.v1', JSON.stringify({ l1: 2 })));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.getByRole('button', { name: 'Continuer : Libertés et capture' }).click();
  await jouer(page, 'E4');
  await page.getByRole('button', { name: 'Terminer la leçon' }).click();
  await page.getByRole('button', { name: 'Leçon suivante' }).click();
  await expect(page.getByRole('heading', { name: /^Atari/ })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Progression de la leçon' })).toHaveAttribute('aria-valuenow', '0');
});
