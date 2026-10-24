import { expect, test } from '@playwright/test';
import { attendrePierre, plateau } from './plateau';
import { OUVERTURES } from '../src/content/ouvertures';
import { CATALOGUE_OUVERTURES, type CleOuvertures } from '../src/content/i18n/ouvertures';
import { fromSgf, toLabel } from '../src/go/coords';
import { lireOuverture } from '../src/go/ouvertures';

// Issue #591 : le répertoire d'ouvertures, ouvert depuis Apprendre à 390 × 844 : la liste par taille, une entrée jouée
// coup par coup (avancer, reculer), puis l'erreur courante et son coût. Preuves KataGo : src/go/ouvertures.test.ts.

const norm = (s: string) => s.replace(/[\u00a0\u202f\s]+/g, ' ').replace(/(?<=\p{L})'(?=\p{L})/gu, '’').trim();
const FR = CATALOGUE_OUVERTURES.fr;
const T = (k: string) => norm(FR[k as CleOuvertures]);

test('Apprendre → Ouvertures : avancer, reculer, voir l’erreur courante', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  const entree = page.getByTestId('entree-ouvertures');
  await entree.scrollIntoViewIfNeeded();
  await expect(entree).toContainText('Ouvertures');
  const h = await entree.boundingBox();
  expect(h!.height).toBeGreaterThanOrEqual(44);
  await entree.click();

  // La liste : 9 × 9 d'abord, puis 19 × 19.
  await expect(page.getByRole('heading', { name: 'Ouvertures' })).toBeVisible();
  const cartes = page.locator('.ouv-carte');
  await expect(cartes).toHaveCount(OUVERTURES.filter(o => o.taille === 9).length);
  // #626 (V4) : des cartes visuelles (mini-goban de la position finale, nom, une ligne), sans compteur de coups ; le choix
  // de la taille est un .seg à plat : aucun aplat jade ni relief sur cet écran (E1).
  const premiere = cartes.first();
  await expect(premiere.locator('svg.mini-goban')).toHaveCount(1);
  await expect(premiere).toHaveAccessibleName(norm(FR['o.n9-centre.nom']));
  await expect(premiere).toHaveAccessibleDescription(norm(FR['o.n9-centre.ligne']));
  await expect(page.getByText(/\d+ coups?$/)).toHaveCount(0);
  await expect(page.locator('.ouvertures .cta, .ouvertures .btn.primary')).toHaveCount(0);
  const neuf = page.getByRole('button', { name: '9 × 9', exact: true });
  await expect(neuf).toHaveAttribute('aria-pressed', 'true');
  expect(await neuf.evaluate(b => getComputedStyle(b).boxShadow)).toBe('none');
  expect(await neuf.evaluate(b => getComputedStyle(b).backgroundColor)).not.toBe(await page.evaluate(() => {
    const t = document.createElement('i'); t.style.color = 'var(--accent)'; document.body.append(t); const c = getComputedStyle(t).color; t.remove(); return c;
  }));
  // Deux colonnes à 390, cibles de 44 px au moins.
  const xs = new Set(await cartes.evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().x))));
  expect(xs.size).toBe(2);
  for (const b of await cartes.all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.getByRole('button', { name: '19 × 19', exact: true }).click();
  await expect(page.getByRole('button', { name: '19 × 19', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(cartes).toHaveCount(OUVERTURES.filter(o => o.taille === 19 && o.repertoire !== false).length);

  // L'invasion au 3-3 : jouée coup par coup.
  const o = OUVERTURES.find(x => x.id === 'h-sansan')!, lue = lireOuverture(o);
  await page.locator(`.ouv-carte[data-id="${o.id}"]`).click();
  const lecteur = page.getByTestId('ouverture');
  await expect(page.getByRole('heading', { name: norm(FR['o.h-sansan.nom']) })).toBeVisible();
  await expect(plateau(page, 19)).toHaveAttribute('data-fenetre');
  const texte = page.getByTestId('ouverture-texte');
  await expect(texte).toContainText(T('o.h-sansan.idee'));
  // La preuve KataGo, au départ ; plus de phrase « Touche Suivant ».
  await expect(texte).toContainText(T('preuve'));
  const suivant = page.getByTestId('ouverture-suivant');
  for (const [i, c] of lue.coups.entries()) {
    await suivant.click();
    await expect(lecteur).toHaveAttribute('data-coup', String(i + 1));
    await expect(texte).toContainText(T(`o.h-sansan.c${i + 1}`));
    await attendrePierre(page, toLabel(c.point, 19), c.couleur === 1 ? 'noir' : 'blanc', 19);
  }
  await expect(texte).toContainText(T('fin'));
  // Reculer : le dernier coup s'efface.
  await page.getByRole('button', { name: 'Précédent' }).click();
  await expect(lecteur).toHaveAttribute('data-coup', String(lue.coups.length - 1));
  await attendrePierre(page, toLabel(lue.coups.at(-1)!.point, 19), null, 19);

  // L'erreur courante : la pierre fausse, la réplique de KataGo, le coût.
  await page.getByTestId('voir-erreur').click();
  const e = o.erreurs[0];
  await expect(lecteur).toHaveAttribute('data-erreur', '0');
  await expect(texte).toContainText(T('o.h-sansan.e1'));
  await expect(texte).toContainText(norm(FR.perte.replace('{pts}', String(e.perte))));
  await attendrePierre(page, toLabel(fromSgf(e.c, 19), 19), 'noir', 19);
  if (e.reponse) await attendrePierre(page, toLabel(fromSgf(e.reponse, 19), 19), 'blanc', 19);
  // Puis retour à la séquence, au coup que l'erreur remplaçait.
  await page.getByRole('button', { name: 'Revenir à la séquence' }).click();
  await expect(lecteur).toHaveAttribute('data-coup', String(e.coup + 1));
  await attendrePierre(page, toLabel(lue.coups[e.coup].point, 19), 'noir', 19);

  // Rien ne déborde en largeur à 390 px.
  const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(largeur).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/ouvertures-lecteur.png' });
  await page.getByRole('button', { name: 'Retour aux ouvertures' }).click();
  await expect(cartes.first()).toBeVisible();
});
