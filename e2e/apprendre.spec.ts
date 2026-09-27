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
  // Leçons v2 (#101) : démonstrations ; mouvements réduits, l'état final est là d'emblée (4 libertés, compteur 4).
  await expect(page.locator('.board .liberte')).toHaveCount(4);
  await expect(page.locator('[data-note-sceau="4 libertés"]')).toBeAttached();
  for (let i = 1; i <= 3; i++) {
    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(progression).toHaveAttribute('aria-valuenow', String(i));
  }

  // Mauvaise réponse : verdict « à revoir », puis bonne réponse.
  await jouer(page, 'A1');
  await expect(page.getByText(/Essaie encore\./)).toBeVisible();
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await jouer(page, 'E5');
  await expect(page.getByText(/^Capturée/)).toBeVisible();
  await expect(progression).toHaveAttribute('aria-valuenow', '4');
  await page.getByRole('button', { name: 'Continuer' }).click();
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
  const presque = { l1: 6, l2: 6, l3: 8, l4: 5, l5: 5, l6: 5 };
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
  await page.addInitScript(() => localStorage.setItem('go.lecons.v1', JSON.stringify({ l1: 5 })));
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

// Leçons v2 (#101) : démonstration animée, un temps toutes les 600 ms ; toucher le plateau passe à la fin, « Revoir » rejoue.
test('démonstration : les libertés s’allument une à une, toucher passe, « Revoir » rejoue', async ({ page }) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.getByRole('button', { name: 'Commencer' }).click();
  const zone = page.locator('.lecteur-plateau');
  await expect(zone).toHaveAttribute('data-demo', 'en-cours');
  await expect(page.locator('.board .liberte')).toHaveCount(0);
  await page.clock.runFor(1300);
  await expect(page.locator('.board .liberte')).toHaveCount(1);
  await expect(page.locator('[data-note-sceau="1 liberté"]')).toBeAttached();
  await zone.click({ position: { x: 5, y: 5 } });
  await expect(zone).toHaveAttribute('data-demo', 'finie');
  await expect(page.locator('.board .liberte')).toHaveCount(4);
  await page.getByRole('button', { name: 'Revoir' }).click();
  await expect(zone).toHaveAttribute('data-demo', 'en-cours');
  await expect(page.locator('.board .liberte')).toHaveCount(0);
});

test('territoire : l’élève touche le goban, puis on compte avec lui', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('go.lecons.v1', JSON.stringify({ l1: 6, l2: 6, l3: 8, l4: 5, l5: 5 })));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.getByRole('button', { name: 'Continuer : Territoire et ouverture' }).click();
  // La question vient avant la réponse : aucun carré de territoire, aucun choix de nombre.
  await expect(page.locator('[data-territoire]')).toHaveCount(0);
  await expect(page.locator('.choix')).toHaveCount(0);
  await jouer(page, 'G5');
  await expect(page.getByText(/Essaie encore\./)).toBeVisible();
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await jouer(page, 'B5');
  await expect(page.getByText(/Ces points vides sont entourés par Noir/)).toBeVisible();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.locator('[data-territoire="noir"]')).toHaveCount(27);
  await expect(page.locator('.demo-compteur')).toHaveAttribute('data-compteur', '27');
});

test('captures des leçons v2 (390 × 844, sombre)', async ({ page }) => {
  test.skip(!process.env.CAPTURES, 'captures à la demande');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install();
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
  const ouvrir = async (progres: Record<string, number>, lecon: string) => {
    await page.evaluate(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), progres);
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
    await page.getByRole('button', { name: `Continuer : ${lecon}` }).click();
  };
  const photo = (n: string) => page.screenshot({ path: `docs/design/v2/captures/lecons-v2-${n}.png` });
  const avance = async (n: number) => { for (let i = 0; i < n; i++) { await page.clock.runFor(600); await page.waitForTimeout(80); } };
  await page.goto('/');
  await ouvrir({ l1: 2 }, 'Libertés et capture');
  await avance(2);
  await photo('1-libertes');
  await avance(3);
  await photo('2-compteur');
  await avance(3);
  await photo('3-atari');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await jouer(page, 'E5');
  await page.waitForTimeout(120);
  await photo('4-capture');
  await ouvrir({ l1: 6, l2: 6, l3: 8, l4: 5, l5: 5 }, 'Territoire et ouverture');
  await photo('5-territoire-question');
  await ouvrir({ l1: 6, l2: 6, l3: 8, l4: 5, l5: 5, l6: 1 }, 'Territoire et ouverture');
  await avance(2);
  await page.clock.runFor(2000);
  await page.waitForTimeout(2600);
  await photo('6-territoire-compte');
});

// Suite de #101 : leçons 2 à 4. Le ko se répond sur le goban, en touchant le point interdit.
test('ko : la question se répond en touchant le goban, sans poser de pierre', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('go.lecons.v1', JSON.stringify({ l1: 6, l2: 6, l3: 8, l4: 4 })));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.getByRole('button', { name: 'Continuer : Le ko' }).click();
  await jouer(page, 'H5');
  await expect(page.getByText(/Essaie encore\./)).toBeVisible();
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await jouer(page, 'E5');
  await expect(page.getByText(/Blanc doit d.abord jouer ailleurs/)).toBeVisible();
  await page.getByRole('button', { name: 'Terminer la leçon' }).click();
  await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();
});

test('captures des leçons 2 à 4 (390 × 844, sombre)', async ({ page }) => {
  test.skip(!process.env.CAPTURES, 'captures à la demande');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  const avant: Record<string, Record<string, number>> = { Atari: { l1: 6 }, 'Techniques de capture': { l1: 6, l2: 6 }, 'Le ko': { l1: 6, l2: 6, l3: 8 } };
  const cles: Record<string, string> = { Atari: 'l2', 'Techniques de capture': 'l3', 'Le ko': 'l4' };
  const ouvrir = async (lecon: string, etape: number) => {
    await page.evaluate(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), { ...avant[lecon], [cles[lecon]]: etape });
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
    await page.getByRole('button', { name: `Continuer : ${lecon}` }).click();
    await expect(page.locator('.lecteur-plateau')).toBeVisible();
  };
  const photo = (n: string) => page.screenshot({ path: `docs/design/v2/captures/lecons-v2-${n}.png` });
  await page.goto('/');
  await ouvrir('Atari', 0); await photo('l2-1-atari');
  await ouvrir('Atari', 2); await photo('l2-2-je-montre');
  await ouvrir('Atari', 3); await photo('l2-3-ensemble');
  await ouvrir('Techniques de capture', 0); await photo('l3-1-double-atari');
  await ouvrir('Techniques de capture', 3); await photo('l3-2-bord');
  await ouvrir('Techniques de capture', 6); await photo('l3-3-echelle');
  await ouvrir('Le ko', 1); await photo('l4-1-ko-barre');
  await ouvrir('Le ko', 2); await photo('l4-2-reprise');
  await ouvrir('Le ko', 4); await jouer(page, 'E5'); await photo('l4-3-touche');
});
