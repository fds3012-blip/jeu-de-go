import { expect, test, type Page } from '@playwright/test';
import { versProblemeSuivant } from './problemes';
import { ouvrirDepuisApprendre } from './decouverte';
import { passerJusquAuScore, plateau, toucherCta } from './plateau';
import { demarrerParcours } from './revueFactice';

// #619 (lot V0) : garde-fou responsive (docs/ux/visuel-responsive-2026-10.md, principes P5, P6 et P8 de DESIGN.md).
// Les écrans principaux aux 7 tailles de l'audit, pour un joueur neuf. Pour chacun :
// - aucun débordement horizontal ;
// - le goban entier dans le cadre, barres fixées du bas déduites (Jouer et les activités : partie, leçon, problème) ;
// - dans une activité, un goban d'au moins 260 px (plancher du 9 × 9, décision #527) ;
// - un seul relief d'action principale au plus (E1 : `--ombre-relief`, « le bouton principal, et rien d'autre ») ;
// - une activité ne défile pas (P5) ;
// - la barre de navigation à sa place (P8, #648) : en bas sous 1024 px, à gauche au-delà, contenu et bouton fixe à sa droite ;
//   aucune barre pendant une partie ;
// - Jouer (#648, lot V10) : en paysage, le goban à côté du bouton principal, au moins aussi grand qu'avant ; en portrait, au-dessus.
// - #649 (lot V6) : en paysage, chaque activité en deux zones, le goban à gauche à la hauteur de l'écran, le panneau à droite.
// On ne vérifie que ce qui est vrai aujourd'hui. Ce qui est cassé est dans CONNU, avec le lot qui le corrige :
// le contrôle y est sauté, et un `test.fixme` le nomme. Un lot qui corrige un cas le retire de CONNU.

const TAILLES = [
  { nom: '360', l: 360, h: 780, mobile: true },
  { nom: '390', l: 390, h: 844, mobile: true },
  { nom: '430', l: 430, h: 932, mobile: true },
  { nom: '844x390', l: 844, h: 390, mobile: true },
  { nom: '768', l: 768, h: 1024, mobile: true },
  { nom: '1024', l: 1024, h: 768, mobile: true },
  { nom: '1440', l: 1440, h: 900, mobile: false },
] as const;

type Controle = 'debord' | 'goban' | 'taille' | 'relief' | 'defilement' | 'deuxZones';
type Ecran = { nom: string; activite: boolean; ouvrir: (page: Page) => Promise<void> };

const onglet = (page: Page, nom: string) => page.getByRole('navigation').getByRole('button', { name: nom, exact: true }).click();

const ECRANS: Ecran[] = [
  { nom: 'Jouer', activite: false, ouvrir: async (page) => {
    await page.goto('/');
    await expect(page.locator('.cta')).toBeVisible();
  } },
  { nom: 'Partie', activite: true, ouvrir: async (page) => {
    await page.goto('/');
    await page.locator('.cta').click();
    await expect(plateau(page)).toBeVisible();
  } },
  { nom: 'Apprendre', activite: false, ouvrir: async (page) => {
    await page.goto('/');
    await onglet(page, 'Apprendre');
    await expect(page.locator('.cta').first()).toBeVisible();
  } },
  { nom: 'Leçon', activite: true, ouvrir: async (page) => {
    await page.goto('/');
    await onglet(page, 'Apprendre');
    await page.getByRole('button', { name: /^(Commencer|Reprendre)( la leçon)?/ }).first().click();
    await expect(page.getByRole('progressbar', { name: 'Progression de la leçon' })).toBeVisible();
    await expect(page.locator('.board-wrap').first()).toBeVisible();
  } },
  { nom: 'Problèmes', activite: false, ouvrir: async (page) => {
    await page.goto('/');
    await onglet(page, 'Problèmes');
    await expect(page.getByRole('heading', { name: /^Go du jour/ })).toBeVisible();
  } },
  { nom: 'Problème', activite: true, ouvrir: async (page) => {
    await page.goto('/');
    await onglet(page, 'Problèmes');
    await versProblemeSuivant(page);
    await page.getByRole('button', { name: /^Problème suivant / }).click();
    await expect(plateau(page).first()).toBeVisible();
  } },
  // #649 (lot V6) : les autres activités à goban (fin, revue, course, découverte, règles, placement, révisions).
  { nom: 'Fin de partie', activite: true, ouvrir: async (page) => {
    await page.goto('/?komi=-100');
    await toucherCta(page);
    await expect(plateau(page)).toBeVisible();
    await passerJusquAuScore(page);
    await expect(page.getByRole('heading', { level: 2, name: 'Victoire' })).toBeVisible({ timeout: 15_000 });
  } },
  { nom: 'Revue', activite: true, ouvrir: async (page) => {
    await page.goto('/?komi=-100');
    await toucherCta(page);
    await expect(plateau(page)).toBeVisible();
    await passerJusquAuScore(page);
    await page.getByRole('button', { name: 'Revoir la partie' }).click({ timeout: 15_000 });
    await demarrerParcours(page);
    await expect(plateau(page)).toBeVisible();
  } },
  { nom: 'Course', activite: true, ouvrir: async (page) => {
    await page.goto('/');
    await onglet(page, 'Problèmes');
    await page.getByTestId('entree-course').click();
    await page.getByRole('button', { name: 'C’est parti' }).click();
    await expect(page.locator('.course-en-cours .board-wrap')).toBeVisible();
  } },
  { nom: 'Découverte', activite: true, ouvrir: async (page) => {
    await page.goto('/');
    await ouvrirDepuisApprendre(page);
    await expect(page.locator('.decouverte .board-wrap')).toBeVisible();
  } },
  { nom: 'Règles', activite: true, ouvrir: async (page) => {
    await page.goto('/');
    await onglet(page, 'Apprendre');
    await page.getByTestId('revoir-regles').click();
    await expect(plateau(page, 7)).toBeVisible();
  } },
  { nom: 'Placement', activite: true, ouvrir: async (page) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Je sais déjà jouer' }).click();
    await expect(page.locator('.placement .board-wrap')).toBeVisible();
  } },
  { nom: 'Révisions', activite: true, ouvrir: async (page) => {
    await page.addInitScript(() => {
      localStorage.setItem('go.parties.v1', JSON.stringify({ n: 1, dernier: 'pomme', ordi: 1 }));
      localStorage.setItem('go.revisions.v1', JSON.stringify({ problemes: { b1: { etape: 0, prochain: '2026-01-01', echecs: 1, maj: 1 } }, acquises: {} }));
    });
    await page.goto('/');
    await page.getByTestId('tuile-revisions').click();
    await expect(page.locator('.seance-revisions .board-wrap, .lecteur .board-wrap').first()).toBeVisible();
  } },
  { nom: 'Profil', activite: false, ouvrir: async (page) => {
    await page.goto('/');
    await onglet(page, 'Profil');
    await expect(page.getByRole('button', { name: /^Réglages/ })).toBeVisible();
  } },
];

// Connu, à corriger par un lot du plan : « taille/écran/contrôle » → lot.
const CONNU: Record<string, string> = {
  // #649 : la revue coup par coup défile en portrait (la courbe et la barre « Suivant » sous le goban). Hors lot V6,
  // qui ne touche pas au portrait ; en paysage, elle ne défile plus.
  '360/Revue/defilement': 'revue en portrait',
  '390/Revue/defilement': 'revue en portrait',
  '430/Revue/defilement': 'revue en portrait',
  '768/Revue/defilement': 'revue en portrait',
};

/** Mesures de la vue : débordement, gobans, reliefs, défilement. */
async function mesurer(page: Page) {
  return page.evaluate(() => {
    const sonde = document.createElement('div');
    sonde.style.boxShadow = 'var(--ombre-relief)';
    document.body.append(sonde);
    const relief = getComputedStyle(sonde).boxShadow;
    sonde.remove();
    const visible = (e: Element) => {
      const b = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && Number(s.opacity) > 0;
    };
    // Le cadre : la vue, moins les barres fixées en bas (barre du bas, barre d'actions) qui recouvrent la page.
    const barres = [...document.querySelectorAll('body *')].filter((e) => {
      const s = getComputedStyle(e);
      if (s.position !== 'fixed' || s.pointerEvents === 'none' || !visible(e)) return false;
      const b = e.getBoundingClientRect();
      return b.bottom >= innerHeight - 2 && b.top > innerHeight / 2 && b.width >= innerWidth / 2;
    });
    const bas = Math.min(innerHeight, ...barres.map((e) => e.getBoundingClientRect().top));
    const d = document.documentElement;
    const boite = (e: Element | null) => {
      if (!e || !visible(e)) return null;
      const b = e.getBoundingClientRect();
      return { g: Math.round(b.left), d: Math.round(b.right), h: Math.round(b.top), b: Math.round(b.bottom) };
    };
    return {
      nav: boite(document.querySelector('nav.nav')),
      cta: boite(document.querySelector('.accueil .cta')),
      app: boite(document.querySelector('main.app')),
      fixes: [...document.querySelectorAll('.cta, .dock')].filter((e) => getComputedStyle(e).position === 'fixed').map(boite).filter((b) => b !== null),
      debord: d.scrollWidth - d.clientWidth,
      defilement: d.scrollHeight - innerHeight,
      reliefs: [...document.querySelectorAll('body *')].filter((e) => getComputedStyle(e).boxShadow === relief && visible(e))
        .map((e) => (e.textContent ?? '').trim().slice(0, 40)),
      gobans: [...document.querySelectorAll('.board-wrap')].filter(visible).map((e) => {
        const b = e.getBoundingClientRect();
        return { g: Math.round(b.left), d: Math.round(b.right), h: Math.round(b.top), b: Math.round(b.bottom) };
      }),
      vue: { l: innerWidth, h: innerHeight, bas: Math.round(bas) },
      // #649 : ce qui est posé à droite du premier goban (titres, textes, boutons) : le panneau des deux zones.
      aDroite: (() => {
        const g = [...document.querySelectorAll('.board-wrap')].find(visible);
        if (!g) return 0;
        const d = g.getBoundingClientRect().right;
        return [...document.querySelectorAll('button, h2, p')].filter((e) => {
          const b = e.getBoundingClientRect();
          return visible(e) && b.left >= d - 1 && b.top < innerHeight;
        }).length;
      })(),
    };
  });
}

for (const t of TAILLES) {
  test.describe(`à ${t.nom}`, () => {
    test.use({ viewport: { width: t.l, height: t.h }, isMobile: t.mobile, hasTouch: t.mobile, deviceScaleFactor: 1 });
    test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });

    for (const e of ECRANS) {
      const connu = (c: Controle) => CONNU[`${t.nom}/${e.nom}/${c}`];
      test(`${e.nom}`, async ({ page }) => {
        await e.ouvrir(page);
        // L'écran s'est posé (polices, mise en page après le premier rendu).
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => window.scrollTo(0, 0));
        const m = await mesurer(page);
        const info = JSON.stringify(m);
        if (process.env.RESPONSIVE_MESURES) console.log(`MESURE ${t.nom} ${e.nom} ${info}`);

        if (!connu('debord')) expect(m.debord, `débordement horizontal ${info}`).toBeLessThanOrEqual(0);
        if (!connu('relief')) expect(m.reliefs.length, `reliefs ${info}`).toBeLessThanOrEqual(1);
        if (e.activite || e.nom === 'Jouer') {
          if (!connu('goban')) {
            expect(m.gobans.length, `goban ${info}`).toBeGreaterThan(0);
            for (const g of m.gobans) {
              expect(g.g >= 0 && g.h >= 0 && g.d <= m.vue.l && g.b <= m.vue.bas, `goban dans le cadre ${info}`).toBe(true);
            }
          }
        }
        // P8 (#648, lot V10) : Jouer en deux zones en paysage ; goban plus grand qu'avant le lot (1024 : 314 px, 1440 : 506, 844 × 390 : 168).
        if (e.nom === 'Jouer') {
          const g = m.gobans[0];
          if (t.l > t.h) {
            expect(m.cta!.g >= g.d && m.cta!.h >= g.h - 1 && m.cta!.h < g.b, `goban à côté du bouton ${info}`).toBe(true);
            expect(g.d - g.g, `taille du goban de Jouer ${info}`).toBeGreaterThanOrEqual({ '1024': 314, '1440': 506, '844x390': 168 }[t.nom as string] ?? 0);
          } else expect(m.cta!.h, `bouton sous le goban ${info}`).toBeGreaterThanOrEqual(g.b);
        }
        // P8 (#648, lot V8) : barre latérale à partir de 1024 px, barre du bas en dessous ; pas de barre en partie.
        if (e.nom === 'Partie') expect(m.nav, `pas de barre en partie ${info}`).toBeNull();
        else if (m.nav) {
          if (t.l >= 1024) {
            expect(m.nav.g === 0 && m.nav.h <= 0 && m.nav.b >= m.vue.h - 1 && m.nav.d - m.nav.g <= 96, `barre latérale ${info}`).toBe(true);
            expect(m.app!.g, `contenu à droite de la barre ${info}`).toBeGreaterThanOrEqual(m.nav.d);
            for (const f of m.fixes) expect(f.g >= m.nav.d && f.b <= m.vue.h, `bouton fixe à droite de la barre ${info}`).toBe(true);
          } else {
            expect(m.nav.g === 0 && m.nav.d === m.vue.l && m.nav.b === m.vue.h, `barre du bas ${info}`).toBe(true);
            for (const f of m.fixes) expect(f.b, `bouton fixe au-dessus de la barre ${info}`).toBeLessThanOrEqual(m.nav.h);
          }
        } else if (!e.activite) throw new Error(`barre de navigation absente ${info}`);
        if (e.activite) {
          if (!connu('taille')) for (const g of m.gobans) expect(Math.min(g.d - g.g, g.b - g.h), `taille du goban ${info}`).toBeGreaterThanOrEqual(260);
          if (!connu('defilement')) expect(m.defilement, `défilement ${info}`).toBeLessThanOrEqual(1);
          // P8 (#649, lot V6) : en paysage, deux zones. Le goban à gauche, à la hauteur de l'écran (ou de la largeur
          // que lui laisse le panneau), et le panneau à sa droite.
          if (t.l > t.h && !connu('deuxZones')) {
            const g = m.gobans[0];
            expect(m.aDroite, `panneau à droite du goban ${info}`).toBeGreaterThan(0);
            expect(g.b - g.h, `goban à la hauteur de l'écran ${info}`).toBeGreaterThanOrEqual(Math.round(0.8 * Math.min(m.vue.h, 0.65 * m.vue.l)));
          }
        }
      });
    }

    for (const [cle, lot] of Object.entries(CONNU).filter(([cle]) => cle.startsWith(`${t.nom}/`))) {
      const [, ecran, controle] = cle.split('/');
      test.fixme(`connu, ${lot} : ${ecran}, ${controle}`, () => {});
    }
  });
}

// #648 (lot V8) : la barre latérale reste la même navigation (nom, quatre onglets, ordre, onglet actif) et se pilote au clavier.
test.describe('barre latérale à 1440', () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  test('même navigation, au clavier', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    const onglets = nav.getByRole('button');
    await expect(onglets).toHaveCount(4);
    for (const [i, nom] of ['Jouer', 'Apprendre', 'Problèmes', 'Profil'].entries()) {
      await expect(onglets.nth(i)).toHaveAccessibleName(nom);
      await expect(onglets.nth(i).getByText(nom, { exact: true })).toBeVisible();
    }
    await expect(nav.getByRole('button', { name: 'Jouer' })).toHaveAttribute('aria-current', 'page');
    // Chaque onglet a sa cible de 44 px au moins, libellé visible sous l'icône.
    for (const b of await nav.getByRole('button').all()) {
      const r = (await b.boundingBox())!;
      expect(Math.min(r.width, r.height)).toBeGreaterThanOrEqual(44);
    }
    await nav.getByRole('button', { name: 'Apprendre' }).focus();
    await page.keyboard.press('Tab');
    await expect(nav.getByRole('button', { name: 'Problèmes' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(nav.getByRole('button', { name: 'Problèmes' })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('button', { name: 'Jouer' })).not.toHaveAttribute('aria-current', 'page');
  });
});
