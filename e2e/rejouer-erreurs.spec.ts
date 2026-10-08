import { expect, test, type Page } from '@playwright/test';
import { jouer, plateau } from './plateau';
import { ouvrirRevue, preparerRevue } from './revueFactice';

// « Rejouer mes erreurs » (#428) : bilan → « Rejouer mes erreurs (2) » → chaque erreur, de la plus grave à la moins
// grave → « 1 sur 2 trouvée », XP et petite fête. Partie fixe et KataGo factice : e2e/revueFactice.ts. Tes erreurs :
// F7 (coup 9, Erreur, KataGo préférait F5) puis D6 (coup 7, Coup manqué, E3 punissait).
// Ici, le KataGo factice est complété pour la recherche courte qui juge un coup hors des candidats : une pierre noire
// en A1 fait perdre 3 points à Noir (A1 est donc « Pas encore »), tout autre coup ne change rien.
// Captures légères : `CAPTURES_REJEU=<dossier>` (390 × 844, clair et sombre).

const CAPTURES = process.env.CAPTURES_REJEU;

async function rechercheCourte(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __kataGoFactice: { analyze: (p: { board: Int8Array; toPlay: 1 | 2 }) => Promise<{ lead: number }> } };
    const f = w.__kataGoFactice;
    if (!f) return;
    const base = f.analyze.bind(f);
    f.analyze = async pos => {
      const r = await base(pos);
      // A1 (index 72) noir : avance de Noir moins 3 points ; `lead` est donné pour le joueur au trait.
      return pos.board[72] === 1 ? { ...r, lead: r.lead + (pos.toPlay === 2 ? 3 : -3) } : r;
    };
  });
}

async function capture(page: Page, nom: string) {
  if (!CAPTURES) return;
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${CAPTURES}/${nom}.jpg`, type: 'jpeg', quality: 55 });
}

async function sansDebord(page: Page, ecran: string) {
  const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(m.scroll, `${ecran} : défilement horizontal`).toBeLessThanOrEqual(m.client);
}

/** Le bouton principal est entier, dans la largeur, et rien ne le recouvre. */
async function ctaLibre(page: Page, ecran: string) {
  const cta = page.locator('.cta');
  await expect(cta).toHaveCount(1);
  const r = await cta.evaluate((el: HTMLElement) => {
    const b = el.getBoundingClientRect(), dessus = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return { g: b.left, d: b.right, l: document.documentElement.clientWidth, h: b.height, libre: !!dessus && el.contains(dessus), coupe: el.scrollWidth > el.clientWidth + 1 };
  });
  expect(r.g, ecran).toBeGreaterThanOrEqual(0);
  expect(r.d, ecran).toBeLessThanOrEqual(r.l + 1);
  expect(r.h, ecran).toBeGreaterThanOrEqual(44);
  expect(r.libre, `${ecran} : bouton principal recouvert`).toBe(true);
  expect(r.coupe, `${ecran} : texte du bouton coupé`).toBe(false);
}

async function ouvrirSeance(page: Page) {
  await ouvrirRevue(page);
  const rejouer = page.getByRole('button', { name: 'Rejouer mes erreurs (2)' });
  await expect(rejouer).toBeVisible({ timeout: 30_000 });
  // Une seule action principale : « Démarrer le bilan » reste là, en action secondaire.
  await expect(page.locator('.cta')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Démarrer le bilan' })).toBeVisible();
  await rejouer.click();
  await expect(page.getByRole('heading', { level: 2, name: 'Rejoue tes erreurs' })).toBeVisible();
}

for (const theme of ['light', 'dark'] as const) {
  test(`parcours complet : deux erreurs, « Pas encore », le coup montré, le coup trouvé, la fin (${theme === 'dark' ? 'sombre' : 'clair'})`, async ({ page }) => {
    const erreurs: string[] = [];
    page.on('pageerror', e => erreurs.push(e.message));
    await page.emulateMedia({ colorScheme: theme });
    await preparerRevue(page);
    await rechercheCourte(page);
    await page.addInitScript(t => { document.addEventListener('DOMContentLoaded', () => document.documentElement.setAttribute('data-theme', t)); }, theme);
    const s = theme === 'dark' ? 'sombre' : 'clair';
    const xpAvant = 0;

    await ouvrirSeance(page);
    const bulle = page.locator('.rejeu-bulle'), phrase = bulle.locator('.rejeu-phrase');

    // 1. La plus grave d'abord : F7, une Erreur. La position d'avant le coup 9 : 8 pierres.
    await expect(page.locator('.revue-compteur')).toHaveText('1 sur 2');
    await expect(bulle.locator('.rejeu-note > span:last-child')).toHaveText('Erreur, coup 9');
    await expect(phrase).toHaveText('Ici, tu as joué F7. Trouve mieux.');
    await expect(plateau(page).locator('g[data-pierre]')).toHaveCount(8);
    await expect(page.locator('.cta')).toHaveCount(0);
    const montre = page.getByRole('button', { name: 'Montre-moi le coup' });
    expect((await montre.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await sansDebord(page, 'consigne');
    await capture(page, `1-consigne-${s}`);

    // Rejouer F7 : jamais bon. A1 : hors des candidats, une recherche courte le juge (3 points perdus).
    await jouer(page, 'F7');
    await expect(phrase).toHaveText('Pas encore. Encore 2 essais.');
    await expect(plateau(page).locator('g[data-pierre]')).toHaveCount(8);
    await jouer(page, 'A1');
    await expect(phrase).toHaveText('Pas encore. Dernier essai.');
    await jouer(page, 'F7');
    // Troisième essai raté : Mochi montre le coup de KataGo, en pierre fantôme, et la croix sur ton coup.
    // #492 : le pourquoi, vérifié par le calcul ; ici aucun motif tactique sûr, donc la phrase générale chiffrée,
    // qui nomme le coup de KataGo (pierre fantôme) et le tien (croix).
    await expect(phrase).toHaveText(/^Selon KataGo, F5 gardait environ \d+\spoints de plus que ton coup en F7\. Aucune pierre n’est en atari ici\s: l’écart ne vient pas d’une prise immédiate\.$/);
    await expect(plateau(page).locator('[data-meilleur]')).toHaveCount(1);
    await expect(page.locator('.cta')).toHaveText('Erreur suivante');
    await ctaLibre(page, 'coup montré');
    await capture(page, `2-montre-${s}`);
    // Pas trouvée : elle rejoint « Tes erreurs à rejouer » (révision espacée, #77).
    const gardees = await page.evaluate(() => JSON.parse(localStorage.getItem('go.erreurs.v1') ?? '[]'));
    expect(gardees).toHaveLength(1);
    expect(gardees[0]).toMatchObject({ coup: 9, rates: 1 });
    await page.locator('.cta').click();

    // 2. D6, un Coup manqué : E3, le coup de KataGo, du premier coup.
    await expect(page.locator('.revue-compteur')).toHaveText('2 sur 2');
    await expect(bulle.locator('.rejeu-note > span:last-child')).toHaveText('Coup manqué, coup 7');
    await expect(phrase).toHaveText('Ici, tu as joué D6. Trouve mieux.');
    await jouer(page, 'E3');
    await expect(phrase).toHaveText(/^Bravo, c’est le coup de KataGo\s! Il vaut \d+\spoints de plus que D6\.$/);
    await expect(bulle).toHaveClass(/revue-rejeu-ok/);
    await expect(plateau(page).locator('g[data-pierre][data-point="E3"]')).toHaveCount(1);
    await expect(page.locator('.cta')).toHaveText('Voir mon résultat');
    await capture(page, `3-trouve-${s}`);
    await page.locator('.cta').click();

    // 3. La fin : « 1 sur 2 trouvée », une pastille par erreur, l'XP, et une petite fête (mouvements non réduits).
    await expect(page.getByRole('heading', { level: 3 })).toHaveText('1 sur 2 trouvée');
    const pastilles = page.getByRole('list', { name: 'Résultat de chaque erreur' }).getByRole('listitem');
    await expect(pastilles).toHaveCount(2);
    await expect(pastilles.nth(0)).toHaveAttribute('aria-label', 'Coup 9 : pas trouvé');
    await expect(pastilles.nth(1)).toHaveAttribute('aria-label', 'Coup 7 : trouvé');
    await expect(page.locator('.rejeu-fin-phrase')).toHaveText('Chaque coup trouvé, c’est un réflexe de plus pour ta prochaine partie.');
    await expect(page.locator('.rejeu-fin-xp')).toHaveText(/^\+\d+\sXP$/);
    await expect(page.getByTestId('confettis')).toHaveCount(1);
    expect(await page.evaluate(() => Number(localStorage.getItem('go.xp.v1')))).toBeGreaterThan(xpAvant);
    await expect(page.locator('.cta')).toHaveText('Retour au bilan');
    await ctaLibre(page, 'fin');
    await sansDebord(page, 'fin');
    await capture(page, `4-fin-${s}`);

    // Retour au bilan ; une deuxième séance sur la même partie ne rapporte plus d'XP.
    await page.locator('.cta').click();
    await expect(page.getByRole('button', { name: 'Rejouer mes erreurs (2)' })).toBeVisible();
    const xp = await page.evaluate(() => Number(localStorage.getItem('go.xp.v1')));
    await page.getByRole('button', { name: 'Rejouer mes erreurs (2)' }).click();
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: 'Montre-moi le coup' }).click();
      await page.locator('.cta').click();
    }
    await expect(page.getByRole('heading', { level: 3 })).toHaveText('0 sur 2 trouvée');
    await expect(page.getByText('L’XP de cette partie est déjà comptée.')).toBeVisible();
    await expect(page.getByTestId('confettis')).toHaveCount(0);
    expect(await page.evaluate(() => Number(localStorage.getItem('go.xp.v1')))).toBe(xp);
    expect(erreurs).toEqual([]);
  });
}

const PETITS = [
  { nom: '320 px', largeur: 320, hauteur: 568 },
  { nom: 'zoom 200 % (195 px)', largeur: 195, hauteur: 422 },
  { nom: 'police doublée (390 px)', largeur: 390, hauteur: 844, police: true },
];

for (const c of PETITS) {
  test(`petits écrans, mouvements réduits : ${c.nom}, sans débord ni bouton coupé`, async ({ page }) => {
    await page.setViewportSize({ width: c.largeur, height: c.hauteur });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await preparerRevue(page);
    if (c.police) await page.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '200%'; }); });
    await ouvrirSeance(page);
    await sansDebord(page, `${c.nom}, consigne`);
    await page.getByRole('button', { name: 'Montre-moi le coup' }).click();
    await expect(plateau(page).locator('[data-meilleur]')).toHaveCount(1);
    await sansDebord(page, `${c.nom}, coup montré`);
    await ctaLibre(page, `${c.nom}, coup montré`);
    await page.locator('.cta').click();
    await jouer(page, 'E3');
    await expect(page.locator('.cta')).toHaveText('Voir mon résultat');
    await page.locator('.cta').click();
    await expect(page.getByRole('heading', { level: 3 })).toHaveText('1 sur 2 trouvée');
    // Mouvements réduits : pas de confettis, le résultat est là d'emblée.
    await expect(page.getByTestId('confettis')).toHaveCount(0);
    await sansDebord(page, `${c.nom}, fin`);
    await ctaLibre(page, `${c.nom}, fin`);
  });
}

test('sans KataGo : pas de « Rejouer mes erreurs », le bilan garde son action principale', async ({ page }) => {
  await preparerRevue(page, { katago: false });
  await ouvrirRevue(page);
  await expect(page.getByRole('button', { name: 'Démarrer le bilan' })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.cta')).toHaveText('Démarrer le bilan');
  await expect(page.getByRole('button', { name: /Rejouer mes erreurs|Rejouer mon erreur/ })).toHaveCount(0);
});

test('en anglais : la séance est traduite', async ({ page }) => {
  await preparerRevue(page);
  await page.goto('/?lang=en');
  await page.getByRole('navigation').getByRole('button', { name: 'Profile' }).click();
  await page.getByRole('button', { name: /^My games/ }).click();
  await page.locator('.mp-parties > li > button').first().click();
  await page.getByRole('button', { name: 'Replay my mistakes (2)' }).click({ timeout: 30_000 });
  await expect(page.locator('.rejeu-phrase')).toHaveText('Here, you played F7. Find better.');
  await jouer(page, 'F5');
  await expect(page.locator('.rejeu-phrase')).toHaveText(/^Well done, that’s KataGo’s move! It’s worth \d+ points more than F7\.$/);
  await expect(page.locator('.cta')).toHaveText('Next mistake');
});
