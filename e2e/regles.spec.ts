import { expect, test } from '@playwright/test';
import { attendrePierre, bandeau, fantome, jouer, jouerSuite, lancerADeux, message, partieADeux, pierres, toucher } from './plateau';

// Issue #7 : règles de base en partie à deux sur le même téléphone (les deux couleurs sont contrôlées).

test('poser une pierre', async ({ page }) => {
  await partieADeux(page);
  await expect(pierres(page, 'noir')).toHaveCount(0);

  await jouer(page, 'E5');
  await attendrePierre(page, 'E5', 'noir');
  await expect(message(page)).toHaveText('Blanc joue. Dernier coup : E5.');

  await jouer(page, 'C3');
  await attendrePierre(page, 'C3', 'blanc');
  await expect(message(page)).toHaveText('Noir joue. Dernier coup : C3.');

  // Toucher une intersection occupée ne fait rien.
  await jouer(page, 'E5');
  await expect(pierres(page, 'noir')).toHaveCount(1);
  await expect(pierres(page, 'blanc')).toHaveCount(1);
});

test('capturer une pierre met à jour le compteur de prisonniers', async ({ page }) => {
  await partieADeux(page);
  await expect(bandeau(page, 'Noir')).toContainText('0 pierre capturée');

  // Blanc E5 est entouré par D5, F5, E6 puis E4.
  await jouerSuite(page, ['D5', 'E5', 'F5', 'A1', 'E6', 'A2', 'E4']);

  await attendrePierre(page, 'E5', null);
  await expect(message(page)).toHaveText('Noir capture 1 pierre.');
  await expect(bandeau(page, 'Noir')).toContainText('1 pierre capturée');
  await expect(bandeau(page, 'Blanc')).toContainText('0 pierre capturée');
  await expect(pierres(page, 'noir')).toHaveCount(4);
  await expect(pierres(page, 'blanc')).toHaveCount(2);
});

test('le suicide est refusé avec un message clair', async ({ page }) => {
  await partieADeux(page);
  // Blanc A2 et B1 : Noir en A1 n'aurait aucune liberté.
  await jouerSuite(page, ['E5', 'A2', 'E6', 'B1']);
  await jouer(page, 'A1');

  await expect(message(page)).toHaveText('Coup interdit : cette pierre serait capturée par elle-même.');
  await attendrePierre(page, 'A1', null);
  await expect(pierres(page, 'noir')).toHaveCount(2);
  // C'est toujours à Noir de jouer.
  await expect(bandeau(page, 'Noir')).toHaveClass(/active/);
  await jouer(page, 'C3');
  await attendrePierre(page, 'C3', 'noir');
});

test('le ko : reprise immédiate refusée, permise après un coup ailleurs', async ({ page }) => {
  await partieADeux(page);
  // Noir C5, D6, D4 ; Blanc E6, F5, E4 ; Blanc entre en D5, Noir prend en E5.
  await jouerSuite(page, ['C5', 'E6', 'D6', 'F5', 'D4', 'E4', 'J9', 'D5', 'E5']);
  await attendrePierre(page, 'D5', null);
  await expect(message(page)).toHaveText('Noir capture 1 pierre.');

  // Blanc tente de reprendre tout de suite en D5.
  await jouer(page, 'D5');
  await expect(message(page)).toHaveText("Ko : tu ne peux pas reprendre tout de suite, joue d'abord ailleurs.");
  await attendrePierre(page, 'D5', null);
  await attendrePierre(page, 'E5', 'noir');
  await expect(bandeau(page, 'Blanc')).toHaveClass(/active/);

  // Blanc joue ailleurs, Noir répond ailleurs : la reprise devient légale.
  await jouerSuite(page, ['A1', 'J1', 'D5']);
  await attendrePierre(page, 'D5', 'blanc');
  await attendrePierre(page, 'E5', null);
  await expect(message(page)).toHaveText('Blanc capture 1 pierre.');
  await expect(bandeau(page, 'Blanc')).toContainText('1 pierre capturée');
});

test('au doigt, il faut toucher deux fois pour confirmer un coup', async ({ page }) => {
  await partieADeux(page);
  const debut = await message(page).textContent();

  await toucher(page, 'E5');
  // Première touche : pierre fantôme seulement, rien n'est joué.
  await expect(fantome(page)).toHaveCount(1);
  await expect(pierres(page, 'noir')).toHaveCount(0);
  await expect(message(page)).toHaveText(debut!);

  // Toucher une autre intersection déplace la pierre fantôme sans jouer.
  await toucher(page, 'D4');
  await expect(fantome(page)).toHaveCount(1);
  await expect(pierres(page, 'noir')).toHaveCount(0);

  // Seconde touche au même endroit : le coup est joué.
  await toucher(page, 'D4');
  await attendrePierre(page, 'D4', 'noir');
  await expect(fantome(page)).toHaveCount(0);
  await expect(message(page)).toHaveText('Blanc joue. Dernier coup : D4.');
});

test('au doigt, sans confirmation dans le Profil, une touche suffit', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await page.getByRole('button', { name: 'Non' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Jouer' }).click();
  await lancerADeux(page);

  await toucher(page, 'E5');
  await attendrePierre(page, 'E5', 'noir');
});
