import { expect, test, type Page } from '@playwright/test';
import { versProblemeSuivant } from './problemes';
import { ouvrirDepuisApprendre } from './decouverte';
import { choisirMode, passerJusquAuScore, plateau, toucherCta } from './plateau';
import { demarrerParcours } from './revueFactice';
import { brancherContexte, fauxServeur, JETON, PARTIE } from './fauxSupabase';

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
//   #670 : les parties en ligne aussi (défi, partie lente, en direct, fin d'une partie classée), sur le faux serveur.
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

/** #670 : une partie en ligne, sur le faux serveur (e2e/fauxSupabase.ts), vue par « Florian » (Blanc), à son tour. */
const MOI = '00000000-0000-4000-8000-0000000006a1';
const AMI = '00000000-0000-4000-8000-0000000006b2';
async function partieEnLigne(page: Page, quoi: 'defi' | 'lente' | 'fin' | 'direct') {
  const s = fauxServeur();
  s.profiles.push({ id: AMI, username: 'Lea_du_go', rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 });
  const fini = quoi === 'fin';
  if (quoi === 'direct') {
    s.games.push({ id: PARTIE, black_id: MOI, white_id: AMI, created_by: AMI, bot_id: null, size: 9, komi: 6.5, rules: 'japanese', handicap: 0, moves: 'eecc',
      status: 'active', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0, prive: false, rated: true, updated_at: new Date().toISOString() });
    s.pendules.push({ partie_id: PARTIE, cadence: 'normale', main_ms: 600000, periodes: 3, periode_ms: 30000, noir_ms: 500000, blanc_ms: 400000,
      noir_periodes: 3, blanc_periodes: 3, trait_depuis: new Date().toISOString(), comptage_depuis: null, noir_vu_le: null, blanc_vu_le: null });
  } else {
    s.games.push({ id: PARTIE, white_id: MOI, black_id: AMI, created_by: MOI, size: 9, komi: 6.5, rules: 'japanese', handicap: 0, moves: fini ? 'eecggctttt' : 'eecggc',
      status: fini ? 'finished' : 'active', counting: false, dead_stones: null, dead_proposed_by: null, result: fini ? 'W+R' : null, resumed_at: 0, prive: true,
      rated: quoi !== 'defi', updated_at: new Date().toISOString() });
    s.defis.push({ partie_id: PARTIE, jeton: JETON, createur_id: MOI, invite_id: AMI, delai_coup: quoi === 'defi' ? '3 days' : '1 day',
      date_limite: new Date(Date.now() + 20 * 3_600_000).toISOString(), lien_expire_le: new Date(Date.now() + 7 * 864e5).toISOString(), cree_le: new Date().toISOString() });
    // La fin la plus chargée : partie classée, « +162 » et le grade gagné.
    if (fini) s.ratingHistory.push({ user_id: MOI, kind: 'game', game_id: PARTIE, rating: 962, ecart: 162, rd: 290, created_at: new Date().toISOString() });
  }
  await brancherContexte(page.context(), s, { 'sb-supabase-auth-token': JSON.stringify(s.sessionCompte('florian@exemple.test', 'Florian', MOI)),
    'go.parties.v1': JSON.stringify({ n: 3 }) });
  await page.goto('/');
  if (quoi === 'defi') await page.getByTestId('tuile-defi').click();
  else {
    await choisirMode(page, 'en_ligne');
    if (quoi !== 'direct') {
      const lente = page.getByTestId('bascule-en-ligne').getByRole('button', { name: 'Partie lente' });
      if ((await lente.getAttribute('aria-pressed')) !== 'true') await lente.click();
      await page.locator('.defi-ligne').first().click();
    }
  }
  await expect(plateau(page)).toBeVisible();
  if (fini) await expect(page.getByTestId('cote-gain')).toBeVisible();
  else await expect(page.getByRole('toolbar').getByRole('button', { name: 'Passer' })).toBeEnabled();
}

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
  // #670 : les parties en ligne (.defi-partie), leur panneau rangé autrement que celui de la partie contre l'ordi.
  { nom: 'Défi', activite: true, ouvrir: (page) => partieEnLigne(page, 'defi') },
  { nom: 'Partie lente', activite: true, ouvrir: (page) => partieEnLigne(page, 'lente') },
  { nom: 'En direct', activite: true, ouvrir: (page) => partieEnLigne(page, 'direct') },
  { nom: 'Fin en ligne', activite: true, ouvrir: (page) => partieEnLigne(page, 'fin') },
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
  // #670 : en portrait, la fin d'une partie en ligne (résultat, cote, liens) défile sous le goban, comme avant. Hors #670,
  // qui ne touche pas au portrait ; en paysage, elle ne défile plus.
  '360/Fin en ligne/defilement': 'fin en ligne en portrait',
  '390/Fin en ligne/defilement': 'fin en ligne en portrait',
  '430/Fin en ligne/defilement': 'fin en ligne en portrait',
  '768/Fin en ligne/defilement': 'fin en ligne en portrait',
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
