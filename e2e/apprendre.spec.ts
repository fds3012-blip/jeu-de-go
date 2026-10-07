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
  // #198 : dès le premier écran, on pose sa pierre. Un seul point vert, pas de « Continuer » avant le geste.
  const zone = page.locator('.lecteur-plateau');
  await expect(zone).toHaveAttribute('data-demo', 'geste');
  await expect(page.locator('.board .liberte')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Continuer' })).toHaveCount(0);
  // Geste faux : le point se marque, l'aide dit quoi faire, sans bouton ; on rejoue tout de suite.
  await jouer(page, 'D4');
  await expect(page.getByText('Pose ta pierre sur le point vert.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Réessayer' })).toHaveCount(0);
  await jouer(page, 'E5');
  // Mouvements réduits : l'état final est là d'emblée (4 libertés, compteur 4).
  await expect(zone).toHaveAttribute('data-demo', 'finie');
  await expect(page.locator('.board .liberte')).toHaveCount(4);
  await expect(page.locator('[data-note-sceau="4 libertés"]')).toBeAttached();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(progression).toHaveAttribute('aria-valuenow', '1');
  // Le coin, puis boucher les libertés : deux autres pierres à poser.
  for (const [i, p] of [[2, 'A1'], [3, 'D6']] as const) {
    await expect(zone).toHaveAttribute('data-demo', 'geste');
    await jouer(page, p);
    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(progression).toHaveAttribute('aria-valuenow', String(i));
  }

  // Mauvaise réponse : verdict « à revoir » sans bouton, puis bonne réponse jouée directement.
  await jouer(page, 'A1');
  await expect(page.getByText(/Essaie encore\./)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Réessayer' })).toHaveCount(0);
  await jouer(page, 'E5');
  await expect(page.getByText(/^Capturée/)).toBeVisible();
  await expect(progression).toHaveAttribute('aria-valuenow', '4');
  await page.getByRole('button', { name: 'Continuer' }).click();
  // Groupe : on touche une pierre du groupe, ses libertés partagées s'allument.
  await expect(zone).toHaveAttribute('data-demo', 'geste');
  await jouer(page, 'E5');
  await expect(page.locator('.board .liberte')).toHaveCount(1);
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
  await expect(page.getByRole('button', { name: 'Commencer la leçon : Atari' })).toBeVisible();
  // Un seul bouton en relief : sous la leçon en cours, il n'affiche que le verbe.
  await expect(page.locator('.cta')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Commencer la leçon : Atari' })).toHaveText('Commencer');
  await expect(page.getByRole('button', { name: /^Leçon 3 : / })).toHaveAttribute('data-etat', 'avenir');
});

test('dernière leçon : « Chapitre terminé », confettis, sauf si les célébrations sont coupées', async ({ page }) => {
  const presque = { l1: 6, l2: 6, l3: 8, l4: 5, l5: 5, l6: 6, l7: 5 };
  for (const celebrations of [true, false]) {
    await page.addInitScript(([p, c]) => {
      localStorage.setItem('go.lecons.v1', JSON.stringify(p));
      localStorage.setItem('go.settings.v1', JSON.stringify({ celebrations: c }));
    }, [presque, celebrations] as const);
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
    await page.getByRole('button', { name: 'Reprendre la leçon : Compter les points' }).click();
    await page.locator('.choix').getByRole('button', { name: '39', exact: true }).click();
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
  await page.getByRole('button', { name: 'Reprendre la leçon : Libertés et capture' }).click();
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
  // #198 : la démonstration attend la pierre de l'élève (un point vert), puis se joue.
  await expect(zone).toHaveAttribute('data-demo', 'geste');
  await expect(page.locator('.board .liberte')).toHaveCount(1);
  await page.clock.runFor(2000);
  await expect(zone).toHaveAttribute('data-demo', 'geste');
  await jouer(page, 'E5');
  await expect(zone).toHaveAttribute('data-demo', 'en-cours');
  await expect(page.locator('.board .liberte')).toHaveCount(0);
  await page.clock.runFor(700);
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
  await page.getByRole('button', { name: 'Commencer la leçon : Territoire et ouverture' }).click();
  // La question vient avant la réponse : aucun carré de territoire, aucun choix de nombre.
  await expect(page.locator('[data-territoire]')).toHaveCount(0);
  await expect(page.locator('.choix')).toHaveCount(0);
  await jouer(page, 'G5');
  await expect(page.getByText(/Essaie encore\./)).toBeVisible();
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
    await page.getByRole('button', { name: new RegExp(`^(Commencer|Reprendre) la leçon : ${lecon}$`) }).click();
  };
  const photo = (n: string) => page.screenshot({ path: `docs/design/v2/captures/lecons-v2-${n}.png` });
  const avance = async (n: number) => { for (let i = 0; i < n; i++) { await page.clock.runFor(600); await page.waitForTimeout(80); } };
  await page.goto('/');
  await ouvrir({ l1: 2 }, 'Libertés et capture');
  await avance(2);
  await photo('1-libertes');
  await avance(3);
  await photo('2-compteur');
  await jouer(page, 'D6');
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
  await page.getByRole('button', { name: 'Reprendre la leçon : Le ko' }).click();
  await jouer(page, 'H5');
  await expect(page.getByText(/Essaie encore\./)).toBeVisible();
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
    await page.getByRole('button', { name: new RegExp(`^(Commencer|Reprendre) la leçon : ${lecon}$`) }).click();
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

// Issue #177 : leçon 7, compter les points. Komi, frontière à fermer, quand passer, compte final.
const AVANT_L7 = { l1: 6, l2: 6, l3: 8, l4: 5, l5: 5, l6: 6 };

test('leçon 7 : compter les points, jusqu’à « Chapitre terminé »', async ({ page }) => {
  await page.addInitScript(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), AVANT_L7);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await expect(page.getByRole('button', { name: 'Leçon 7 : Compter les points, prochaine étape' })).toBeVisible();
  await page.getByRole('button', { name: 'Commencer la leçon : Compter les points' }).click();
  const progression = page.getByRole('progressbar', { name: 'Progression de la leçon' });
  const choix = (n: string) => page.locator('.choix').getByRole('button', { name: n, exact: true });

  // 1. Je montre : territoire noir puis blanc (mouvements réduits : l'état final, 27 points blancs).
  await expect(page.locator('.demo-compteur')).toHaveAttribute('data-compteur', '27');
  await page.getByRole('button', { name: 'Continuer' }).click();
  // 2. Ensemble : le territoire est colorié ; oublier le komi est une erreur.
  await expect(page.locator('[data-territoire="blanc"]')).toHaveCount(27);
  await choix('27').click();
  await expect(page.getByText(/ajoute le komi\. Essaie encore\./)).toBeVisible();
  // #198 : le choix faux se marque, les réponses restent visibles et on rechoisit tout de suite.
  await expect(choix('27')).toHaveClass(/choix-faux/);
  await expect(page.locator('.verdict')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Réessayer' })).toHaveCount(0);
  await choix('33,5').click();
  await expect(page.getByText(/Noir a 36\s:\sil gagne de 2,5\spoints/)).toBeVisible();
  await page.getByRole('button', { name: 'Continuer' }).click();
  // 3. Je fais avec toi : l'élève ferme E7 (point vert), puis on compte 36.
  await expect(page.locator('.lecteur-plateau')).toHaveAttribute('data-demo', 'geste');
  await jouer(page, 'E7');
  await expect(page.locator('.demo-compteur')).toHaveAttribute('data-compteur', '36');
  await page.getByRole('button', { name: 'Continuer' }).click();
  // 4. Ensemble : le point vert est le trou à fermer.
  await expect(page.locator('.board .liberte')).toHaveCount(1);
  await jouer(page, 'B3');
  await expect(page.getByText(/Blanc peut entrer chez toi/)).toBeVisible();
  await jouer(page, 'E3');
  await expect(page.getByText(/tes 36\spoints comptent enfin/)).toBeVisible();
  await page.getByRole('button', { name: 'Continuer' }).click();
  // 5. Quand passer.
  await choix('Chez moi').click();
  await expect(page.getByText(/tu perds un point/)).toBeVisible();
  await choix('Je passe').click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  // 6. Seul : compte final avec les prisonniers.
  await expect(page.locator('[data-territoire]')).toHaveCount(0);
  await choix('42,5').click();
  await expect(page.getByText(/Le komi, lui, va à Blanc/)).toBeVisible();
  await choix('39').click();
  await expect(page.getByText(/Noir gagne d.un demi-point/)).toBeVisible();
  await expect(progression).toHaveAttribute('aria-valuenow', '6');
  await page.getByRole('button', { name: 'Terminer la leçon' }).click();
  await expect(page.getByRole('heading', { name: 'Chapitre terminé' })).toBeVisible();
  await expect(page.getByText(/fermer tes frontières/)).toBeVisible();
  await page.getByRole('button', { name: 'Retour au chemin' }).click();
  await expect(page.getByRole('button', { name: 'Leçon 7 : Compter les points, terminée' })).toBeVisible();
  await expect(page.getByText('Chapitre terminé. Tu connais les règles du go !')).toBeVisible();
});

test('captures de la leçon 7 (390 × 844, sombre)', async ({ page }) => {
  test.skip(!process.env.CAPTURES, 'captures à la demande');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  const ouvrir = async (etape: number) => {
    await page.evaluate(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), { ...AVANT_L7, l7: etape });
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
    await page.getByRole('button', { name: /^(Commencer|Reprendre) la leçon : Compter les points$/ }).click();
    await expect(page.locator('.lecteur-plateau')).toBeVisible();
  };
  const photo = (n: string) => page.screenshot({ path: `docs/design/v2/captures/lecons-v2-l7-${n}.png` });
  const choix = (n: string) => page.locator('.choix').getByRole('button', { name: n, exact: true });
  await page.goto('/');
  await ouvrir(0); await photo('1-komi');
  await ouvrir(1); await choix('33,5').click(); await photo('2-ensemble');
  await ouvrir(2); await photo('3-frontiere');
  await ouvrir(3); await photo('4-fermer');
  await ouvrir(4); await photo('5-passer');
  await ouvrir(5); await photo('6-compte-final');
  await choix('39').click(); await photo('7-reponse');
  await page.evaluate(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), AVANT_L7);
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.waitForTimeout(200);
  await photo('8-chemin');
});

// Issue #228 : chapitre 2, leçon 8. Coins, bords, centre ; ne pas coller ; s'étendre ; la première ligne rapporte peu.
test('leçon 8 : bien commencer sur 9 × 9, du chemin à la fin de leçon', async ({ page }) => {
  await page.addInitScript(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), { ...AVANT_L7, l7: 6 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  // Les bases finies ; le chapitre 2 s'ouvre sous elles, la leçon 8 est la prochaine étape.
  await expect(page.getByText('Chapitre terminé. Tu connais les règles du go !')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'L’ouverture' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leçon 8 : Les premiers coups, prochaine étape' })).toBeVisible();
  await expect(page.locator('.cta')).toHaveCount(1);
  await page.getByRole('button', { name: 'Commencer la leçon : Les premiers coups' }).click();
  const continuer = page.getByRole('button', { name: 'Continuer' });

  // 1. Je montre : l'élève ferme le coin ; les trois zones de 4 points s'allument.
  await expect(page.locator('.lecteur-plateau')).toHaveAttribute('data-demo', 'geste');
  await jouer(page, 'C1');
  await expect(page.locator('.board .liberte')).toHaveCount(12);
  await continuer.click();
  // 2. Le 3-3, puis Blanc au 5-5.
  await jouer(page, 'C3');
  await continuer.click();
  // 3. Ensemble : neuf points verts ; chaque erreur a sa réfutation.
  await expect(page.locator('.board .liberte')).toHaveCount(9);
  await jouer(page, 'E6');
  await expect(page.getByText(/Collée à Blanc/)).toBeVisible();
  await jouer(page, 'B8');
  await expect(page.getByText(/deux premières lignes/)).toBeVisible();
  await jouer(page, 'G7');
  await expect(page.getByText(/le 3-3 garde le coin/)).toBeVisible();
  await continuer.click();
  // 4. Touche la pierre collée.
  await jouer(page, 'D4');
  await expect(page.getByText(/Cherche la pierre noire qui touche/)).toBeVisible();
  await jouer(page, 'F5');
  await continuer.click();
  // 5. S'étendre au point vert.
  await jouer(page, 'E3');
  await continuer.click();
  // 6. Seul : trop serrée, puis la bonne extension.
  await expect(page.locator('.board .liberte')).toHaveCount(0);
  await jouer(page, 'D3');
  await expect(page.getByText(/Trop serrée/)).toBeVisible();
  await jouer(page, 'C5');
  await expect(page.getByText(/Bien étendu/)).toBeVisible();
  await page.getByRole('button', { name: 'Terminer la leçon' }).click();

  // Chapitre en cours d'écriture : la leçon 8 ne le ferme pas, fin de leçon classique (pas de partie contre Pomme).
  // #16, lot X : sa série d'ouverture (13 × 13) y est l'action principale, comme pour les leçons 9 à 16.
  await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();
  await expect(page.getByText(/coins, bords, puis centre/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Entraîne-toi\s:\s3 problèmes sur ce thème, Ouverture$/ })).toHaveClass(/\bcta\b/);
  await expect(page.locator('.fin-lecon .cta')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Joue contre Pomme' })).toHaveCount(0);
  await expect(page.getByTestId('confettis')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retour au chemin' }).click();
  await expect(page.getByRole('button', { name: 'Leçon 8 : Les premiers coups, terminée' })).toBeVisible();
  await expect(page.getByText('Tout est fait. La suite arrive bientôt.')).toBeVisible();
});
