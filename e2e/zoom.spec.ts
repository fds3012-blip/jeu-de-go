import { expect, test, type Locator, type Page } from '@playwright/test';
import { CHAPITRES } from '../src/content/lessons';

// Issue #121 : zoom 200 % et reflow (WCAG 1.4.4 et 1.4.10).
// - 195 × 422 : un iPhone de 390 px zoomé à 200 % ;
// - 320 × 640 : plus petite largeur CSS exigée par 1.4.10 ;
// - 390 × 844 avec la taille de police racine doublée (texte agrandi à 200 %).
// Sur chaque écran principal : pas de défilement horizontal, et le bouton principal
// est entier dans la largeur et n'est recouvert par rien.

type Cas = { nom: string; largeur: number; hauteur: number; police?: boolean };
const CAS: Cas[] = [
  { nom: 'zoom 200 % (195 px)', largeur: 195, hauteur: 422 },
  { nom: '320 px', largeur: 320, hauteur: 640 },
  { nom: 'police doublée (390 px)', largeur: 390, hauteur: 844, police: true },
];

async function sansDebord(page: Page, ecran: string) {
  const m = await page.evaluate(() => {
    const d = document.documentElement;
    // Éléments qui dépassent à droite : utile pour savoir quoi corriger quand le test échoue.
    // Le dernier élément HTML dont le contenu déborde de sa boîte est en général la cause.
    const fautifs = [...document.querySelectorAll('body *')]
      .filter(e => e instanceof HTMLElement && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible')
      .slice(-4)
      .map(e => `${e.tagName.toLowerCase()}.${String(e.className).split(' ').join('.')} (${e.scrollWidth} > ${e.clientWidth})`);
    return { scroll: d.scrollWidth, client: d.clientWidth, fautifs };
  });
  expect(m.scroll, `${ecran} : défilement horizontal (${m.fautifs.join(' ; ')})`).toBeLessThanOrEqual(m.client);
}

async function boutonLibre(bouton: Locator, ecran: string) {
  await bouton.scrollIntoViewIfNeeded();
  await expect(bouton).toBeVisible();
  const r = await bouton.evaluate((el: HTMLElement) => {
    const b = el.getBoundingClientRect();
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    const dessus = document.elementFromPoint(cx, cy);
    return {
      gauche: b.left, droite: b.right, largeur: document.documentElement.clientWidth,
      libre: !!dessus && (el === dessus || el.contains(dessus)),
      dessus: dessus ? `${dessus.tagName.toLowerCase()}.${String(dessus.className)}` : 'rien',
      // Texte coupé : contenu plus large que la boîte sans retour à la ligne possible.
      coupe: el.scrollWidth > el.clientWidth + 1,
    };
  });
  expect(r.gauche, `${ecran} : bouton principal coupé à gauche`).toBeGreaterThanOrEqual(0);
  expect(r.droite, `${ecran} : bouton principal coupé à droite`).toBeLessThanOrEqual(r.largeur + 1);
  expect(r.libre, `${ecran} : bouton principal recouvert par ${r.dessus}`).toBe(true);
  expect(r.coupe, `${ecran} : texte du bouton principal coupé`).toBe(false);
}

/**
 * #169 : chemin d'Apprendre lisible. Les rangées (pierre, titre, description, bouton) ne se chevauchent pas,
 * et aucun texte du chemin n'est recouvert : au milieu de chaque ligne de texte, l'élément visible est
 * celui qui porte le texte (ou un de ses enfants), jamais une autre rangée, le bouton ou la barre du bas.
 */
async function cheminLisible(page: Page, ecran: string) {
  const r = await page.evaluate(async () => {
    const soucis: string[] = [];
    const rangees = [...document.querySelectorAll<HTMLElement>('.gue .pas')];
    const boites = rangees.map(li => li.getBoundingClientRect()).map(b => ({ top: b.top + scrollY, bottom: b.bottom + scrollY }));
    const ordre = boites.map((b, i) => ({ ...b, i })).sort((a, b) => a.top - b.top);
    for (let j = 1; j < ordre.length; j++) {
      if (ordre[j].top < ordre[j - 1].bottom - 0.5) soucis.push(`rangées ${ordre[j - 1].i + 1} et ${ordre[j].i + 1} se chevauchent (${Math.round(ordre[j - 1].bottom - ordre[j].top)} px)`);
    }
    // Chaque ligne de texte du chemin, amenée au milieu de l'écran (la barre du bas ne compte pas).
    const porteurs = [...document.querySelectorAll<HTMLElement>('.gue .pas-texte b, .gue .pas-texte small, .gue .cta-chemin')];
    for (const el of porteurs) {
      for (const n of el.childNodes) {
        if (n.nodeType !== Node.TEXT_NODE || !n.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        const lignes = [...range.getClientRects()].filter(l => l.width > 1 && l.height > 1).map(l => ({ x: l.left + l.width / 2, y: l.top + l.height / 2 + scrollY }));
        for (const l of lignes) {
          window.scrollTo(0, l.y - innerHeight / 2);
          await new Promise(requestAnimationFrame);
          const dessus = document.elementFromPoint(l.x, l.y - scrollY);
          if (!dessus || !(dessus === el || el.contains(dessus))) {
            soucis.push(`« ${n.textContent.trim().slice(0, 24)} » recouvert par ${dessus ? `${dessus.tagName.toLowerCase()}.${String(dessus.className)}` : 'rien (hors écran)'}`);
            break;
          }
        }
      }
    }
    window.scrollTo(0, 0);
    return { soucis, n: rangees.length };
  });
  expect(r.n, `${ecran} : chemin introuvable`).toBeGreaterThan(0);
  expect(r.soucis, `${ecran} : chemin illisible`).toEqual([]);
}

const onglet = (page: Page, nom: string) =>
  page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: nom });

for (const c of CAS) {
  test.describe(c.nom, () => {
    test.use({ viewport: { width: c.largeur, height: c.hauteur } });
    test.beforeEach(async ({ page }) => {
      if (c.police) await page.addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '200%'; });
      });
    });

    test('accueil, problèmes, profil et apprendre sans défilement horizontal', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.cta')).toBeVisible();
      await sansDebord(page, 'Accueil');
      await boutonLibre(page.locator('.cta'), 'Accueil');

      // Barre du bas : les onglets ne se chevauchent pas.
      const boites = [];
      for (const n of ['Jouer', 'Apprendre', 'Problèmes', 'Profil']) boites.push((await onglet(page, n).boundingBox())!);
      for (let i = 1; i < boites.length; i++) expect(boites[i].x, 'onglets de la barre du bas qui se chevauchent').toBeGreaterThanOrEqual(boites[i - 1].x + boites[i - 1].width - 1);

      await onglet(page, 'Problèmes').click();
      await page.waitForTimeout(300);
      await sansDebord(page, 'Problèmes');

      await onglet(page, 'Profil').click();
      await expect(page.getByRole('heading', { name: 'Ton parcours' })).toBeVisible();
      await sansDebord(page, 'Profil');
      // #214 : les réglages, derrière leur ligne, sans débord non plus.
      await page.getByRole('button', { name: /^Réglages/ }).click();
      await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();
      await sansDebord(page, 'Réglages');
    });

    test('apprendre et leçon 1 sans défilement horizontal', async ({ page }) => {
      await page.goto('/');
      await onglet(page, 'Apprendre').click();
      await expect(page.getByRole('button', { name: 'Commencer' })).toBeVisible();
      await sansDebord(page, 'Apprendre');
      await boutonLibre(page.getByRole('button', { name: 'Commencer' }), 'Apprendre');

      await page.getByRole('button', { name: 'Commencer' }).click();
      await expect(page.getByRole('progressbar', { name: 'Progression de la leçon' })).toBeVisible();
      await sansDebord(page, 'Leçon 1');
    });

    // #177 : sept leçons dans « Les bases » ; la septième et ses choix longs tiennent dans la largeur.
    // #228 : le chapitre 2 (leçon 8) suit, sous la leçon 7 et son bouton.
    test('chemin de sept leçons et leçon 7 sans défilement horizontal', async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('go.lecons.v1', JSON.stringify({ l1: 6, l2: 6, l3: 8, l4: 5, l5: 5, l6: 6, l7: 4 })));
      await page.goto('/');
      await onglet(page, 'Apprendre').click();
      await expect(page.locator('[data-chapitre="c1"] .gue li')).toHaveCount(7);
      // #16 : le chapitre 2 grandit (l8, puis l27…) : autant de pierres que de leçons.
      await expect(page.locator('[data-chapitre="c2"] .gue li')).toHaveCount(CHAPITRES.find(x => x.id === 'c2')!.lecons.length);
      await sansDebord(page, 'Apprendre (7 leçons)');
      const cta = page.getByRole('button', { name: 'Reprendre la leçon : Compter les points' });
      await boutonLibre(cta, 'Apprendre (leçon 7)');
      const pierre = page.getByRole('button', { name: 'Leçon 7 : Compter les points, prochaine étape' });
      const b = (await pierre.boundingBox())!;
      expect(b.x, 'pierre 7 coupée à gauche').toBeGreaterThanOrEqual(0);
      expect(b.x + b.width, 'pierre 7 coupée à droite').toBeLessThanOrEqual(c.largeur + 1);
      // Le bouton de la dernière leçon ne mord pas sur « Bientôt » (après la mesure des rangées, qui peut suivre d'un rendu).
      await expect.poll(async () => {
        const bas = (await cta.boundingBox())!, bientot = (await page.getByRole('heading', { name: 'Bientôt' }).boundingBox())!;
        return bientot.y - (bas.y + bas.height);
      }, { message: 'bouton de la leçon 7 sur « Bientôt »' }).toBeGreaterThanOrEqual(0);
      await expect.poll(async () => {
        const bas = (await cta.boundingBox())!, chap2 = (await page.getByRole('heading', { name: 'L’ouverture' }).boundingBox())!;
        return chap2.y - (bas.y + bas.height);
      }, { message: 'bouton de la leçon 7 sur le chapitre 2' }).toBeGreaterThanOrEqual(0);
      // #232 : aussi avec la police doublée (les rangées 2/3, 3/4 et 6/7 du chapitre 1 se chevauchaient).
      await page.evaluate(() => document.fonts.ready);
      await cheminLisible(page, 'Apprendre (2 chapitres)');
      await cta.click();
      for (const n of ['Je passe', 'Chez moi', 'Chez Blanc']) {
        const choix = page.locator('.choix').getByRole('button', { name: n, exact: true });
        await expect(choix).toBeVisible();
        const r = (await choix.boundingBox())!;
        expect(r.x + r.width, `choix « ${n} » coupé`).toBeLessThanOrEqual(c.largeur + 1);
        expect(r.height, `choix « ${n} » trop petit`).toBeGreaterThanOrEqual(44);
      }
      await sansDebord(page, 'Leçon 7');
    });

    test('partie contre l’ordinateur sans défilement horizontal', async ({ page }) => {
      await page.goto('/');
      await page.locator('.cta').click();
      await expect(page.locator('.board, [role="grid"]').first()).toBeVisible();
      await sansDebord(page, 'Partie');
    });
  });
}

// En 320 px, « Abandonner » débordait de son bouton et passait sous « Passer » (bouton plein).
// Chaque libellé de la barre d'actions tient dans son bouton, sans toucher le voisin, et chaque bouton garde 44 px.
for (const largeur of [320, 375, 390]) {
  test(`barre d’actions de la partie à ${largeur} px : libellés entiers`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 640 });
    await page.goto('/');
    await page.locator('.cta').click();
    const barre = page.getByRole('toolbar', { name: 'Actions de la partie' });
    await expect(barre.getByRole('button', { name: 'Plus' })).toBeVisible();
    const boutons = await barre.getByRole('button').evaluateAll(bs => bs.map(b => {
      const bb = b.getBoundingClientRect();
      const libelle = b.querySelector(':scope > span:last-child');
      const lb = libelle?.getBoundingClientRect();
      return { nom: libelle?.textContent ?? '', gauche: bb.left, droite: bb.right, largeur: bb.width, hauteur: bb.height,
        texteGauche: lb?.left ?? bb.left, texteDroite: lb?.right ?? bb.right };
    }));
    for (const [i, b] of boutons.entries()) {
      expect(b.largeur, `« ${b.nom} » : cible trop étroite`).toBeGreaterThanOrEqual(44);
      expect(b.hauteur, `« ${b.nom} » : cible trop basse`).toBeGreaterThanOrEqual(44);
      if (!b.nom.trim()) continue;
      expect(b.texteGauche, `« ${b.nom} » coupé à gauche`).toBeGreaterThanOrEqual(b.gauche - 0.5);
      expect(b.texteDroite, `« ${b.nom} » coupé à droite`).toBeLessThanOrEqual(b.droite + 0.5);
      const suivant = boutons[i + 1];
      if (suivant) expect(b.texteDroite, `« ${b.nom} » passe sous « ${suivant.nom} »`).toBeLessThanOrEqual(suivant.gauche);
    }
  });
}

// #169 : à 195 px, les titres du chemin passaient sur 4 à 6 lignes et chevauchaient la rangée suivante,
// et « Commencer » recouvrait « Atari ». Vérifié sur un chemin neuf, en cours et fini.
const PROGRESSIONS: Record<string, Record<string, number>> = {
  neuf: {},
  'leçon 2 en cours': { l1: 99, l2: 1 },
  'dernière leçon en cours': { l1: 99, l2: 99, l3: 99, l4: 99, l5: 99 },
  fini: { l1: 99, l2: 99, l3: 99, l4: 99, l5: 99, l6: 99 },
};
// #232 : et à 390 px avec la police doublée, où la pierre est dessinée jusqu'à 110 px sous sa ligne.
for (const [largeur, hauteur, police] of [[195, 422, false], [320, 640, false], [390, 844, false], [390, 844, true]] as const) {
  test.describe(`chemin d’Apprendre à ${largeur} px${police ? ', police doublée' : ''}`, () => {
    test.use({ viewport: { width: largeur, height: hauteur } });
    for (const [nom, p] of Object.entries(PROGRESSIONS)) {
      test(`${nom} : rangées sans chevauchement, textes non recouverts`, async ({ page }) => {
        await page.addInitScript(v => localStorage.setItem('go.lecons.v1', v), JSON.stringify(p));
        if (police) await page.addInitScript(() => {
          document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '200%'; });
        });
        await page.goto('/');
        await onglet(page, 'Apprendre').click();
        await expect(page.locator('.cta-chemin')).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await cheminLisible(page, `Apprendre ${largeur} px${police ? ' (police doublée)' : ''}, ${nom}`);
      });
    }
  });
}
