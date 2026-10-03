import { expect, test, type Page } from '@playwright/test';
import { plateau } from './plateau';
import { ouvrirRevue, preparerRevue } from './revueFactice';

// Revue v3 « Bilan de la partie » (#405) : attente (proverbe, barre d'avancement) → bilan (précision, notes du go,
// « Démarrer le bilan ») → parcours des coups clés (« Suivant », sceau sur la pierre, pierre verte, avance).
// Partie fixe et KataGo factice : e2e/revueFactice.ts. Captures : `CAPTURES=1` (docs/design/captures/revue-bilan-v3).

const DOSSIER = 'docs/design/captures/revue-bilan-v3';

async function capture(page: Page, nom: string) {
  if (!process.env.CAPTURES) return;
  await page.screenshot({ path: `${DOSSIER}/${nom}.jpg`, type: 'jpeg', quality: 80 });
}

async function sansDebordement(page: Page, largeur: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur);
}

for (const [largeur, hauteur] of [[390, 844], [320, 568]] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`bilan de la partie : attente, résumé, parcours des coups clés (${largeur} px, ${theme === 'dark' ? 'sombre' : 'clair'})`, async ({ page }) => {
      const erreurs: string[] = [];
      page.on('pageerror', e => erreurs.push(e.message));
      await page.setViewportSize({ width: largeur, height: hauteur });
      await page.emulateMedia({ colorScheme: theme });
      await preparerRevue(page);
      await page.addInitScript(t => { document.documentElement.setAttribute('data-theme', t); }, theme);
      const suffixe = `${largeur}-${theme === 'dark' ? 'sombre' : 'clair'}`;
      const avecCaptures = largeur === 390 || theme === 'dark';

      await ouvrirRevue(page);
      // 1. Attente : Mochi, un proverbe sourcé, une vraie barre d'avancement.
      const barre = page.getByRole('progressbar', { name: 'Analyse de la partie' });
      await expect(barre).toBeVisible();
      await expect(page.getByText('Proverbe du go')).toBeVisible();
      await expect(page.locator('.bilan-proverbe blockquote')).toHaveText(/^«\s.+\s»$/);
      await expect(page.locator('.bilan-proverbe-source')).not.toBeEmpty();
      if (avecCaptures) await capture(page, `1-attente-${suffixe}`);

      // 2. Le bilan : une seule action principale, la précision de chaque joueur, le décompte des notes du go.
      const demarrer = page.getByRole('button', { name: 'Démarrer le bilan' });
      await expect(demarrer).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('.cta')).toHaveCount(1);
      await expect(demarrer).toBeInViewport();
      const table = page.getByRole('table', { name: 'Tes coups, note par note' });
      await expect(table.getByRole('columnheader', { name: 'Toi' })).toBeVisible();
      await expect(table.getByRole('columnheader', { name: 'Pomme' })).toBeVisible();
      await expect(table.getByRole('row', { name: /^Précision \d+\s% \d+\s%$/ })).toBeVisible();
      for (const [ligne, toi, pomme] of [['Brillant', '1', '–'], ['Classique', '3', '2'], ['Coup manqué', '1', '–'], ['Gaffe', '–', '1'], ['Erreur', '1', '–']] as const)
        await expect(table.getByRole('row', { name: ligne, exact: false }).first()).toHaveText(new RegExp(`${ligne}\\s*${toi}\\s*${pomme}`));
      // Aucune cote : seulement des pourcentages de précision.
      await expect(page.getByText(/\bElo\b|\bcote\b|\bkyu\b|\bdan\b/i)).toHaveCount(0);
      await expect(page.locator('.revue-courbe-point')).not.toHaveCount(0);
      await expect(page.locator('.bilan-bulle')).not.toBeEmpty();
      await sansDebordement(page, largeur);
      if (avecCaptures) await capture(page, `2-bilan-${suffixe}`);

      // 3. Le parcours : premier coup clé, C3, un coup classique expliqué.
      await demarrer.click();
      const bulle = page.locator('.parcours-bulle');
      await expect(bulle.locator('.parcours-titre')).toHaveText(/C3 est un coup classique/);
      await expect(bulle.locator('.parcours-detail')).toContainText('3-3');
      const sceau = plateau(page).locator('[data-note-sceau]');
      await expect(sceau).toHaveAttribute('data-note-sceau', 'Classique');
      const suivant = page.getByRole('button', { name: 'Suivant', exact: true });
      await expect(page.locator('.cta')).toHaveCount(1);
      await expect(suivant).toBeInViewport();

      // Suivant × 3 : G3 (classique), la gaffe de Pomme en E7, puis le coup manqué D6 (E3 punissait).
      await suivant.click();
      await expect(bulle.locator('.parcours-titre')).toHaveText(/G3 est un coup classique/);
      await suivant.click();
      await expect(bulle.locator('.parcours-titre')).toHaveText(/E7 est une gaffe/);
      await expect(bulle.locator('.parcours-detail')).toContainText('à toi de punir');
      await suivant.click();
      await expect(bulle.locator('.parcours-titre')).toHaveText(/D6 est un coup manqué/);
      await expect(sceau).toHaveAttribute('data-note-sceau', 'Coup manqué');
      // La pierre verte : E3, le coup qui punissait.
      await expect(plateau(page).locator('[data-meilleur]')).toHaveCount(1);
      await expect(bulle.locator('.parcours-detail')).toContainText('E3');
      // L'avance après le coup, dite simplement.
      await expect(bulle.locator('.parcours-avance')).toHaveAttribute('aria-label', /^Après ce coup, tu mènes de 5 points$/);
      if (avecCaptures) await capture(page, `3-parcours-manque-${suffixe}`);
      await suivant.click();
      await expect(bulle.locator('.parcours-titre')).toHaveText(/F7 est une erreur/);
      await expect(sceau).toHaveAttribute('data-note-sceau', 'Erreur');
      await expect(page.getByText(/Coup 9 sur 16/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Rejoue cette erreur' })).toBeVisible();
      await sansDebordement(page, largeur);

      // Le Brillant : D4, le seul bon coup.
      await suivant.click();
      await expect(bulle.locator('.parcours-titre')).toHaveText(/D4 est brillant/);
      await expect(sceau).toHaveAttribute('data-note-sceau', 'Brillant');
      if (avecCaptures) await capture(page, `4-parcours-brillant-${suffixe}`);

      // La bande des coups : toucher un coup l'affiche avec sa note.
      await page.getByRole('button', { name: /^Coup 5, E5,/ }).click();
      await expect(page.getByText(/Coup 5 sur 16/)).toBeVisible();
      await expect(bulle.locator('.parcours-titre')).toHaveText(/E5 est un coup classique/);
      await expect(bulle.locator('.parcours-detail')).toContainText('tengen');

      // Retour au résumé.
      await page.getByRole('button', { name: 'Retour au résumé' }).click();
      await expect(demarrer).toBeVisible();
      expect(erreurs).toEqual([]);
    });
  }
}

test('sans KataGo : échelle réduite et honnête (ni Brillant, ni Meilleur coup, ni Coup manqué)', async ({ page }) => {
  await preparerRevue(page, { katago: false });
  await ouvrirRevue(page);
  const demarrer = page.getByRole('button', { name: 'Démarrer le bilan' });
  await expect(demarrer).toBeVisible({ timeout: 60_000 });
  const table = page.getByRole('table', { name: 'Tes coups, note par note' });
  await expect(table.getByRole('row', { name: /Brillant|Meilleur coup|Coup manqué|Excellent/ })).toHaveCount(0);
  await expect(table.getByRole('row', { name: /Classique/ })).toBeVisible();
  await expect(page.getByText(/Sans KataGo, Mochi ne note que ce qui est sûr/)).toBeVisible();
  await demarrer.click();
  await expect(page.locator('.parcours-bulle .parcours-titre')).toHaveText(/C3 est un coup classique/);
  await expect(plateau(page).locator('[data-note-sceau]')).toHaveAttribute('data-note-sceau', 'Classique');
});

test('en anglais : le bilan et le parcours sont traduits', async ({ page }) => {
  await preparerRevue(page);
  await page.goto('/?lang=en');
  await page.getByRole('navigation').getByRole('button', { name: 'Profile' }).click();
  await page.getByRole('button', { name: /^My games/ }).click();
  await page.locator('.mp-parties > li > button').first().click();
  await expect(page.getByRole('progressbar', { name: 'Game analysis' })).toBeVisible();
  await expect(page.getByText('Go proverb')).toBeVisible();
  const demarrer = page.getByRole('button', { name: 'Start review' });
  await expect(demarrer).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('table', { name: 'Your moves, by rating' }).getByRole('row', { name: /Miss/ })).toBeVisible();
  await demarrer.click();
  await expect(page.locator('.parcours-bulle .parcours-titre')).toHaveText(/C3 is a standard move/);
  await expect(page.getByText(/Démarrer|Suivant|coup classique|Précision/)).toHaveCount(0);
});
