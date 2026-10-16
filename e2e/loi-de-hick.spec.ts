import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { brancher, fauxServeur, type FauxServeur } from './fauxSupabase';
import { abandonner, choisirMode, jouer, ouvrirPlus, plateau } from './plateau';
import { ouvrirRevue, preparerRevue } from './revueFactice';

// Loi de Hick (#571, docs/ux/loi-de-hick-2026-10.md) : pour chaque écran clé, en 390 × 844, on compte les choix
// visibles au premier regard (sans défiler) et ceux de la page entière, rangés par poids : action principale, choix
// secondaires de même poids, liens discrets, barre de navigation, plateau. Ce qui est sous une feuille modale ouverte
// ne compte pas : seule la feuille est active.
// Lancement manuel seulement : HICK=<dossier> npx playwright test loi-de-hick --workers 1
// HICK_CAPTURES=<dossier> : une capture JPEG par écran (sombre), pour regarder ce qu'on compte.

const DOSSIER = process.env.HICK;
test.skip(!DOSSIER, 'Audit de la loi de Hick : lancer avec HICK=<dossier>');
test.describe.configure({ mode: 'serial' });

type Poids = 'principale' | 'secondaire' | 'lien' | 'nav' | 'plateau';
export type Compte = { ecran: string; vue: Record<Poids, number>; page: Record<Poids, number>; libellesVue: string[]; alerte?: string };

const ANA = '00000000-0000-4000-8000-0000000000c1';
/** Joueur habitué : Pomme battue, trois leçons finies, Caillou en cours (comme e2e/accueil-modes.spec.ts). */
const HABITUE = {
  'go.premiere-pierre.v1': 'true',
  'go.parties.v1': JSON.stringify({ n: 6, dernier: 'caillou', ordi: 6 }), 'go.bilan.v1': JSON.stringify({ pomme: { v: 2, d: 1 }, caillou: { v: 0, d: 2 } }),
  'go.adversaire.v1': JSON.stringify('caillou'), 'go.lecons.v1': JSON.stringify({ l1: 99, l2: 99, l3: 99 }),
};

/** Compte les choix de l'écran affiché (voir l'en-tête). */
async function compter(page: Page, ecran: string): Promise<Compte> {
  const r = await page.evaluate(() => {
    const SEL = 'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="switch"], [role="radio"], [role="link"], [role="menuitem"], [role="option"], [role="checkbox"], svg[role="grid"], [data-testid="plateau-accueil"]';
    const lecteurSeul = (el: Element) => {
      for (let e: Element | null = el; e; e = e.parentElement) {
        const s = getComputedStyle(e);
        const b = e.getBoundingClientRect();
        if (s.overflow === 'hidden' && (b.width <= 2 || b.height <= 2)) return true;
        if (s.clip === 'rect(0px, 0px, 0px, 0px)' || s.clipPath === 'inset(50%)') return true;
      }
      return false;
    };
    const visible = (el: Element) => {
      const b = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05 && !lecteurSeul(el);
    };
    const modale = [...document.querySelectorAll('dialog:modal, [aria-modal="true"]')].find(visible) ?? null;
    const racine: ParentNode = modale ?? document;
    const tous = [...racine.querySelectorAll(SEL)].filter(el => {
      if (!visible(el)) return false;
      if (el.closest('[aria-hidden="true"]') && el.getAttribute('data-testid') !== 'plateau-accueil') return false;
      if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return false;
      if (el.closest('svg[role="grid"]') && el.getAttribute('role') !== 'grid') return false;
      return true;
    });
    // Un élément touchable dans un autre ne compte qu'une fois (le plus grand).
    const garde = tous.filter(el => !tous.some(o => o !== el && o.contains(el)));
    const poids = (el: Element): string => {
      if (el.matches('svg[role="grid"], [data-testid="plateau-accueil"]')) return 'plateau';
      if (el.closest('nav.nav')) return 'nav';
      if (el.matches('.cta, .btn.primary')) return 'principale';
      if (el.matches('.lien, a, .lien-discret') || el.classList.contains('lien')) return 'lien';
      return 'secondaire';
    };
    const vide = () => ({ principale: 0, secondaire: 0, lien: 0, nav: 0, plateau: 0 } as Record<string, number>);
    const vue = vide(), entiere = vide();
    const libelles: string[] = [];
    for (const el of garde) {
      const p = poids(el);
      entiere[p]++;
      const b = el.getBoundingClientRect();
      const cy = b.top + Math.min(b.height, 44) / 2;
      // Ce que la barre de navigation du bas recouvre n'est pas vu sans défiler.
      const bas = p === 'nav' || modale ? innerHeight : Math.min(innerHeight, document.querySelector('nav.nav')?.getBoundingClientRect().top ?? innerHeight);
      const dansVue = cy > 0 && cy < bas && b.left < innerWidth - 8 && b.right > 8;
      if (dansVue) {
        vue[p]++;
        const txt = ((el as HTMLElement).innerText || el.getAttribute('aria-label') || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 32);
        libelles.push(`${p[0].toUpperCase()}:${txt}`);
      }
    }
    return { vue, page: entiere, libellesVue: libelles };
  });
  return { ecran, ...(r as Omit<Compte, 'ecran'>) };
}

async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, stockage: Record<string, string>, o: { compte?: boolean; reponse?: boolean } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL, timezoneId: 'Europe/Paris',
    colorScheme: 'dark', reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }, ...(o.reponse === false ? [] : [{ name: 'go.connait-go.v1', value: '"sait"' }])] }] },
  });
  const s = { ...stockage };
  if (o.compte) s['sb-supabase-auth-token'] = JSON.stringify(serveur.sessionCompte('ana@exemple.test', 'Ana', ANA));
  return { ctx, page: await brancher(ctx, serveur, s) };
}

const comptes: Compte[] = [];
async function mesurer(page: Page, ecran: string) {
  await page.waitForTimeout(350);
  comptes.push(await compter(page, ecran));
  if (process.env.HICK_CAPTURES) {
    mkdirSync(process.env.HICK_CAPTURES, { recursive: true });
    await page.screenshot({ path: join(process.env.HICK_CAPTURES, `${ecran}.jpg`), type: 'jpeg', quality: 55 });
  }
}
async function etape(nom: string, page: Page, f: () => Promise<void>) {
  try { await f(); } catch (e) {
    comptes.push({ ecran: nom, vue: {} as Compte['vue'], page: {} as Compte['page'], libellesVue: [], alerte: String(e).split('\n').slice(0, 3).join(' / ').slice(0, 300) });
    if (process.env.HICK_CAPTURES) await page.screenshot({ path: join(process.env.HICK_CAPTURES, `echec-${nom}.jpg`), type: 'jpeg', quality: 50 }).catch(() => {});
  }
}
const nav = (page: Page, nom: RegExp) => page.getByRole('navigation').getByRole('button', { name: nom });

test.afterAll(() => {
  mkdirSync(DOSSIER!, { recursive: true });
  writeFileSync(join(DOSSIER!, 'hick.json'), JSON.stringify(comptes, null, 1));
});

test('premier lancement', async ({ browser, baseURL }) => {
  test.setTimeout(240_000);
  const serveur = fauxServeur();
  const q = await telephone(browser, baseURL, serveur, {}, { reponse: false });
  await etape('01-question', q.page, async () => {
    await q.page.goto('/');
    await expect(q.page.getByRole('region', { name: 'Tu connais le go ?' })).toBeVisible();
    await mesurer(q.page, '01-question');
  });
  await q.ctx.close();
  const a = await telephone(browser, baseURL, serveur, {});
  await etape('02-accueil-premier', a.page, async () => {
    await a.page.goto('/');
    await expect(a.page.locator('.cta')).toBeVisible();
    await mesurer(a.page, '02-accueil-premier');
  });
  await a.ctx.close();
  const b = await telephone(browser, baseURL, serveur, { 'go.premiere-pierre.v1': 'true' });
  await etape('03-accueil-apres-pierre', b.page, async () => {
    await b.page.goto('/');
    await expect(b.page.getByTestId('modes')).toBeVisible();
    await mesurer(b.page, '03-accueil-apres-pierre');
  });
  await b.ctx.close();
});

test('joueur habitué', async ({ browser, baseURL }) => {
  test.setTimeout(400_000);
  const serveur = fauxServeur();
  const { ctx, page } = await telephone(browser, baseURL, serveur, HABITUE, { compte: true });
  await etape('04-accueil-habitue', page, async () => {
    await page.goto('/');
    await expect(page.getByTestId('modes')).toBeVisible();
    await mesurer(page, '04-accueil-habitue');
  });
  await etape('05-feuille-changer', page, async () => {
    await page.getByRole('button', { name: /^(Changer|Change)$/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await mesurer(page, '05-feuille-changer');
    const avances = page.getByTestId('reglages-partie-ouvrir');
    if (await avances.count()) {
      await avances.click();
      await page.waitForTimeout(400);
      await mesurer(page, '05b-feuille-changer-avances');
    }
    await page.keyboard.press('Escape');
  });
  await etape('06-feuille-plus', page, async () => {
    await page.goto('/');
    await page.getByTestId('mode-plus').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await mesurer(page, '06-feuille-plus');
  });
  await etape('07-apprendre', page, async () => {
    await page.goto('/');
    await nav(page, /^Apprendre$/).click();
    await expect(page.locator('.cta').first()).toBeVisible();
    await mesurer(page, '07-apprendre');
  });
  await etape('08-problemes', page, async () => {
    await page.goto('/');
    await nav(page, /^Problèmes$/).click();
    await page.waitForTimeout(800);
    await mesurer(page, '08-problemes');
  });
  await etape('09-profil', page, async () => {
    await page.goto('/');
    await nav(page, /^Profil$/).click();
    await expect(page.getByRole('button', { name: /^Réglages/ })).toBeVisible();
    await mesurer(page, '09-profil');
    await page.getByRole('button', { name: /^Réglages/ }).click();
    await expect(page.getByRole('button', { name: /^Retour$/ })).toBeVisible();
    await mesurer(page, '10-reglages');
  });
  await etape('11-partie', page, async () => {
    await page.goto('/');
    await choisirMode(page, 'ordi');
    await expect(plateau(page)).toBeVisible();
    await jouer(page, 'E5');
    await page.waitForTimeout(2500);
    await mesurer(page, '11-partie');
    await ouvrirPlus(page);
    await mesurer(page, '11b-partie-menu-plus');
    await page.keyboard.press('Escape');
  });
  await etape('12-aide', page, async () => {
    await page.getByRole('button', { name: 'Aide : règles et mots du go' }).click();
    await expect(page.getByRole('dialog', { name: 'Aide' })).toBeVisible();
    await mesurer(page, '12-aide');
    await page.getByRole('dialog', { name: 'Aide' }).getByRole('button', { name: 'Fermer' }).click();
  });
  await etape('13-fin-de-partie', page, async () => {
    await abandonner(page);
    await page.waitForTimeout(2500);
    await mesurer(page, '13-fin-de-partie');
  });
  await etape('14-en-ligne', page, async () => {
    await page.goto('/');
    await choisirMode(page, 'en_ligne');
    await expect(page.getByTestId('direct-choix')).toBeVisible();
    await mesurer(page, '14-en-ligne-choix');
    await page.getByTestId('bascule-en-ligne').getByRole('button', { name: 'Partie lente' }).click();
    await expect(page.getByTestId('lentes')).toBeVisible();
    await page.waitForTimeout(800);
    await mesurer(page, '14c-partie-lente');
    await page.getByTestId('bascule-en-ligne').getByRole('button', { name: 'En direct' }).click();
  });
  await etape('14b-ami', page, async () => {
    await page.goto('/');
    await choisirMode(page, 'ami');
    await page.waitForTimeout(1200);
    await mesurer(page, '14b-ami');
  });
  await ctx.close();
});

test('revue et partage', async ({ browser, baseURL }) => {
  test.setTimeout(240_000);
  const serveur = fauxServeur();
  const { ctx, page } = await telephone(browser, baseURL, serveur, HABITUE, { compte: true });
  await etape('15-revue', page, async () => {
    await preparerRevue(page);
    await ouvrirRevue(page);
    await expect(page.getByRole('button', { name: 'Partager', exact: true })).toBeVisible({ timeout: 90_000 });
    await mesurer(page, '15-revue');
    await page.getByRole('button', { name: 'Partager', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Partager ta partie' })).toBeVisible();
    await mesurer(page, '16-partage');
  });
  await ctx.close();
});
