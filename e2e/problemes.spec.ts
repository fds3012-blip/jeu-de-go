import { expect, test } from '@playwright/test';
import { attendrePierre, jouer, plateau } from './plateau';

// Issue #11 : problèmes sans connexion (copie locale des problèmes de base).

test('problèmes sans compte : erreur, bonne réponse, suite et problème suivant', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();

  await expect(page.getByRole('heading', { name: /^Go du jour n°\s\d+$/ })).toBeVisible();
  // Issue #196 : un écran, une action. Le Go du jour, un seul « Problème suivant », le palier en cours ; pas de grille ni de cadenas.
  await expect(page.getByRole('button', { name: 'Résoudre le Go du jour' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Problème suivant / })).toHaveCount(1);
  await expect(page.locator('[data-palier-en-cours="debutant"]')).toContainText('Débutant');
  await expect(page.getByRole('button', { name: /^Problème \d+ : / })).toHaveCount(0);
  await expect(page.locator('svg.cadenas')).toHaveCount(0);
  // Le Go du jour passe avant l'invitation à se connecter.
  const yJour = (await page.getByRole('heading', { name: /^Go du jour/ }).boundingBox())!.y;
  const yInvit = (await page.getByRole('button', { name: 'Créer mon compte' }).boundingBox())!.y;
  expect(yJour).toBeLessThan(yInvit);
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(debord).toBeLessThanOrEqual(0);
  // Page courte : au plus deux écrans (elle en faisait vingt).
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(2 * 844);

  // La grille est derrière un lien discret : les paliers ouverts seulement (le premier, pour un joueur neuf).
  await page.getByRole('button', { name: 'Tous les problèmes' }).click();
  const miniatures = await page.getByRole('button', { name: /^Problème \d+ : / }).count();
  expect(miniatures).toBeGreaterThan(0);
  expect(miniatures).toBe(await page.getByRole('group', { name: /^Débutant/ }).locator('[data-probleme]').count());

  // Le problème b1 (par son titre, les lots de #91 s'intercalent par difficulté) : la pierre blanche D5 n'a plus qu'une liberté, en E5.
  await page.getByRole('button', { name: /^Problème \d+ : Capture la pierre/ }).click();
  await expect(plateau(page)).toBeVisible();

  await jouer(page, 'A1');
  await expect(page.getByText('Pas tout à fait. Essaie encore.')).toBeVisible();
  // #237 (N6) : la réfutation est montrée (Blanc s'échappe en E5), d'un coup en mouvements réduits, puis la position revient seule.
  await attendrePierre(page, 'E5', 'blanc');
  await expect(page.locator('.verdict [role="status"]')).toContainText('Pas tout à fait');
  await expect(page.getByText('Rejoue directement sur le plateau.')).toBeVisible();
  await attendrePierre(page, 'A1', null);
  await attendrePierre(page, 'E5', null);
  // #237 (N6) : comme en leçon, une seule suite après l'erreur, rejouer sur le plateau ; l'indice est un lien discret.
  await expect(page.getByRole('button', { name: 'Réessayer' })).toHaveCount(0);
  const indice = page.getByRole('button', { name: 'Voir un indice' });
  await expect(indice).toHaveClass(/\blien\b/);
  await expect(page.locator('.verdict .cta, .verdict .btn')).toHaveCount(0);
  expect((await indice.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  await jouer(page, 'E5');
  await expect(page.getByText('Bravo, c’est le bon coup !')).toBeVisible();
  await attendrePierre(page, 'E5', 'noir');
  await attendrePierre(page, 'D5', null);

  await page.getByRole('button', { name: 'Voir la suite' }).click();
  await expect(page.getByText(/Voilà la suite/)).toBeVisible();
  await attendrePierre(page, 'E5', 'noir');

  await page.getByRole('button', { name: 'Problème suivant' }).click();
  // #284 : le suivant est choisi à ta mesure, plus un ordre fixe. b1 a été raté au premier essai :
  // le suivant est un autre problème, « Facile ».
  const lecteur = page.locator('.lecteur');
  await expect(lecteur).toHaveAttribute('data-probleme', /.+/);
  await expect(lecteur).not.toHaveAttribute('data-probleme', 'b1');
  await expect(lecteur.locator('.lecteur-tete .difficulte')).toHaveText(/Facile/);

  // Le problème réussi reste coché après rechargement.
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  // Le palier en cours dit « N réussis », sans total.
  await expect(page.locator('[data-palier-en-cours]')).toContainText(/\d+\sréussis?/);
  await expect(page.locator('[data-palier-en-cours]').getByText(/\d+\s\/\s\d+/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Tous les problèmes' }).click();
  await expect(page.getByRole('button', { name: /^Problème \d+ : Capture la pierre, réussi/ })).toBeVisible();
});

// Issue #93 : paliers. Novice est verrouillé tant que 60 % des Débutant ne sont pas réussis.
// Issue #196 : dans « Tous les problèmes », le palier fermé suivant tient en une ligne, sans ses miniatures.
// Le test ne dépend pas du nombre de problèmes (les lots de #91 agrandissent les paliers) :
// il lit les problèmes du palier Débutant, en marque réussis juste un de moins que le seuil, puis résout b4.
test('paliers : Novice verrouillé, puis ouvert après les réussites', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  await page.getByRole('button', { name: 'Tous les problèmes' }).click();
  const debutant = page.getByRole('group', { name: /^Débutant/ });
  const ids = await debutant.locator('[data-probleme]').evaluateAll(els => els.map(e => e.getAttribute('data-probleme')!));
  expect(ids).toContain('b4');
  const seuil = Math.ceil(ids.length * 0.6);
  const avant = Object.fromEntries(ids.filter(id => id !== 'b4').slice(0, seuil - 1).map(id => [id, true]));
  await page.evaluate(v => localStorage.setItem('go.problemes.v1', JSON.stringify(v)), avant);
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  await expect(page.getByRole('button', { name: /^Problème suivant / })).toBeVisible();
  await page.getByRole('button', { name: 'Tous les problèmes' }).click();

  const novice = page.getByRole('group', { name: /^Novice/ });
  await expect(debutant).toHaveAttribute('data-reussis', String(seuil - 1));
  // Aucun total visible : les problèmes doivent sembler sans fin.
  await expect(debutant.getByRole('progressbar')).toHaveCount(0);
  await expect(page.locator('svg.montagne')).toHaveCount(0);
  await expect(debutant.getByText(/\d+\s\/\s\d+/)).toHaveCount(0);
  await expect(novice).toHaveAccessibleName(/verrouillé/);
  await expect(novice.getByText('Réussis encore quelques problèmes du palier d’avant pour l’ouvrir.')).toBeVisible();
  // Pas de mur de cadenas : aucune miniature verrouillée, un seul palier fermé annoncé.
  await expect(page.getByRole('button', { name: /, verrouillé$/ })).toHaveCount(0);
  await expect(novice.locator('[data-probleme]')).toHaveCount(0);
  await expect(page.getByRole('group', { name: /verrouillé/ })).toHaveCount(1);
  await expect(page.locator('svg.cadenas')).toHaveCount(1);

  // On résout « Sauve ta pierre » (b4) : le seuil est atteint, Novice s'ouvre.
  await debutant.locator('[data-probleme="b4"]').click();
  await expect(page.getByRole('heading', { name: 'Sauve ta pierre' })).toBeVisible();
  await jouer(page, 'D4');
  await expect(page.getByRole('button', { name: 'Problème suivant' })).toBeVisible();
  // Retour à la liste complète, d'où le problème a été ouvert.
  await page.getByRole('button', { name: 'Retour aux problèmes' }).first().click();

  await expect(debutant).toHaveAttribute('data-reussis', String(seuil));
  await expect(novice).not.toHaveAccessibleName(/verrouillé/);
  await expect(novice.getByText('Réussis encore quelques problèmes du palier d’avant pour l’ouvrir.')).toHaveCount(0);
  await expect(novice.getByRole('button').first()).toBeEnabled();
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(debord).toBeLessThanOrEqual(0);
});

// #237 (N6) : après une erreur, pas de bouton ; la réfutation se joue, et toucher le plateau pendant qu'elle est montrée
// remet la position et joue le coup tout de suite, comme en leçon.
test('problème : la réfutation se montre après l’erreur, puis on rejoue directement', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  await page.getByRole('button', { name: 'Tous les problèmes' }).click();
  await page.getByRole('button', { name: /^Problème \d+ : Capture la pierre/ }).click();
  await expect(plateau(page)).toBeVisible();

  await jouer(page, 'A1');
  await expect(page.locator('.verdict [role="status"]')).toContainText('Pas tout à fait');
  await expect(page.getByRole('button', { name: 'Réessayer' })).toHaveCount(0);
  // Le coup faux reste posé, puis Blanc répond au point clé.
  await attendrePierre(page, 'A1', 'noir');
  await attendrePierre(page, 'E5', 'blanc');
  // Toucher un autre point pendant la réfutation : la position revient et le coup se joue (ici, encore faux).
  await jouer(page, 'J9');
  await attendrePierre(page, 'A1', null);
  await attendrePierre(page, 'J9', 'noir');
  // La position revient d'elle-même ; on joue alors le bon coup.
  await attendrePierre(page, 'J9', null);
  await attendrePierre(page, 'E5', null);
  await jouer(page, 'E5');
  await expect(page.getByText('Bravo, c’est le bon coup !')).toBeVisible();
});
