import { expect, test, type Page } from '@playwright/test';

// Issue #114 : « Supprimer mon compte », sans aucun appel réel au serveur.

async function ouvrirMonCompte(page: Page, url: string) {
  await page.goto(url);
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await page.getByRole('button', { name: /^Mon compte/ }).click();
  await expect(page.getByRole('heading', { name: 'Mon compte' })).toBeVisible();
}

test('sans compte, le bouton « Supprimer mon compte » n’apparaît pas', async ({ page }) => {
  await ouvrirMonCompte(page, '/');
  await expect(page.getByRole('button', { name: 'Supprimer mon compte' })).toHaveCount(0);
});

for (const theme of ['dark', 'light'] as const) {
  test(`confirmation en deux temps, puis retour à l’accueil (${theme === 'dark' ? 'sombre' : 'clair'})`, async ({ page }) => {
    const appels: string[] = [];
    page.on('request', r => { if (/supabase|\/rpc\//.test(r.url())) appels.push(r.url()); });
    await page.addInitScript(t => localStorage.setItem('go.settings.v1', JSON.stringify({ theme: t })), theme);
    await ouvrirMonCompte(page, '/?compte-simule');

    const lien = page.getByRole('button', { name: 'Supprimer mon compte' });
    expect((await lien.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await lien.click();

    await expect(page.getByText(/C’est définitif/)).toBeVisible();
    await expect(page.getByText(/joueur supprimé/)).toBeVisible();
    const final = page.getByRole('button', { name: 'Supprimer définitivement' });
    await expect(final).toBeDisabled();
    expect((await final.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    const champ = page.getByLabel(/Pour confirmer, tape SUPPRIMER/);
    await champ.fill('SUPPRIME');
    await expect(final).toBeDisabled();

    // Annuler referme sans rien supprimer.
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect(final).toHaveCount(0);

    await page.getByRole('button', { name: 'Supprimer mon compte' }).click();
    await page.getByLabel(/Pour confirmer, tape SUPPRIMER/).fill('SUPPRIMER');
    await expect(final).toBeEnabled();
    await final.click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Mon compte' })).toHaveCount(0);
    expect(appels).toEqual([]);
  });
}
