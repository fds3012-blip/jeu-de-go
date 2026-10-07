// Pages de référencement (#472) : règles de la démo, balises, données structurées, sitemap, réécritures de vercel.json,
// et les faits annoncés (comptés dans le dépôt, jamais écrits à la main).
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { reecrire, SITE } from '../apercus';
import { chargerDemo, demoMinifiee, donneesStructurees, ecrireReferencement, lienApp, pageHtml, robots, sitemap, url } from './pages';
import { COMMUN, PAGES } from './textes';
import { LECONS_INDEX } from '../../src/content/leconsIndex.gen';
import { ALL_PUZZLES } from '../../src/content/puzzles';
import { OPPONENTS } from '../../src/engine/simple';
import { LESSONS_EN } from '../../content/lessons.en.js';

const demo = chargerDemo();
const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')) as { rewrites: { source: string; destination: string }[] };
const options = { polices: { titre: '/assets/b.woff2', texte: '/assets/z4.woff2', gras: '/assets/z7.woff2' }, demoJs: await demoMinifiee() };
const html = Object.fromEntries(PAGES.map(p => [p.chemin, pageHtml(p, options)]));

const attr = (h: string, re: RegExp) => [...h.matchAll(re)].map(m => m[1]);
const meta = (h: string, cle: string) => new RegExp(`<meta (?:name|property)="${cle}" content="([^"]*)"`).exec(h)?.[1];

describe('démo de capture', () => {
  it('chaque défi : le point clé réussit, tout autre coup échoue', () => {
    for (const d of demo.DEFIS) {
      const p = demo.plateauDe(d);
      const cible = demo.indexDe(d.cible);
      const reussi = (q: string) => (d.but === 'capture' ? q[cible] === '.' : demo.groupe(q, cible).libertes.length >= 2);
      expect(demo.groupe(p, cible).libertes.map(demo.nomPoint), d.cible).toEqual([d.cle]);
      const gagnants = [];
      for (let i = 0; i < 81; i++) {
        const r = demo.poser(p, i, 'b');
        if ('plateau' in r && reussi(r.plateau)) gagnants.push(demo.nomPoint(i));
      }
      expect(gagnants).toEqual([d.cle]);
      // Un mauvais coup : Blanc joue le point clé, et c'est légal.
      const faux = demo.poser(p, demo.indexDe('A1'), 'b');
      expect('plateau' in faux && 'plateau' in demo.poser(faux.plateau, demo.indexDe(d.cle), 'w')).toBe(true);
    }
  });

  it('règles : capture, point occupé, suicide interdit sauf s’il capture', () => {
    const p = demo.plateauDe(demo.DEFIS[1]);
    const r = demo.poser(p, demo.indexDe('F4'), 'b');
    expect('prises' in r && r.prises.map(demo.nomPoint).sort()).toEqual(['E5', 'F5']);
    expect(demo.poser(p, demo.indexDe('E5'), 'b')).toEqual({ erreur: 'occupe' });
    // Blanc en A2 et B1 : Noir en A1 n'a aucune liberté.
    const coin = demo.plateauDe({ noires: [], blanches: ['A2', 'B1'], but: 'capture', cible: 'A2', cle: 'A1' });
    expect(demo.poser(coin, demo.indexDe('A1'), 'b')).toEqual({ erreur: 'suicide' });
    expect(demo.nomPoint(demo.indexDe('J9'))).toBe('J9');
    expect(demo.indexDe('A9')).toBe(0);
    expect(demo.indexDe('J1')).toBe(80);
  });

  it('JS de la démo : léger, et ne peut pas fermer sa balise', () => {
    expect(gzipSync(options.demoJs).length).toBeLessThan(15 * 1024);
    expect(options.demoJs).not.toMatch(/<\/script/i);
  });
});

describe('pages', () => {
  it('quatre pages, en paires fr/en', () => {
    expect(PAGES.map(p => p.chemin)).toEqual(['apprendre-le-go', 'regles-du-go', 'en/learn-go', 'en/go-rules']);
    for (const p of PAGES) {
      const t = PAGES.find(x => x.chemin === p.traduction)!;
      expect(t.traduction).toBe(p.chemin);
      expect(t.langue).not.toBe(p.langue);
    }
  });

  it('title, description, canonical, hreflang, Open Graph', () => {
    for (const p of PAGES) {
      const h = html[p.chemin];
      const titre = /<title>([^<]+)<\/title>/.exec(h)![1];
      expect(titre.length, titre).toBeLessThanOrEqual(60);
      expect(titre).toContain('Mochi Go');
      const description = meta(h, 'description')!;
      expect(description.length, description).toBeGreaterThan(100);
      expect(description.length, description).toBeLessThanOrEqual(160);
      expect(description).not.toContain('{');
      expect(h).toContain(`<html lang="${p.langue}">`);
      expect(attr(h, /<link rel="canonical" href="([^"]+)"/g)).toEqual([url(p.chemin)]);
      const alt = Object.fromEntries([...h.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map(m => [m[1], m[2]]));
      expect(alt[p.langue]).toBe(url(p.chemin));
      expect(alt[p.langue === 'fr' ? 'en' : 'fr']).toBe(url(p.traduction));
      expect(alt['x-default']).toBe(url(p.langue === 'en' ? p.chemin : p.traduction));
      expect(meta(h, 'og:url')).toBe(url(p.chemin));
      expect(meta(h, 'og:title')).toBe(titre);
      expect(meta(h, 'og:image')).toBe(`${SITE}/${p.langue === 'en' ? 'apercu-en.png' : 'apercu.png'}`);
      expect(existsSync(new URL(`../../public/${p.langue === 'en' ? 'apercu-en.png' : 'apercu.png'}`, import.meta.url))).toBe(true);
      expect(meta(h, 'twitter:card')).toBe('summary_large_image');
      expect(h).not.toContain('noindex');
      // Polices de l'app préchargées (titre et texte), affichées sans saut de mise en page.
      expect(attr(h, /<link rel="preload" href="([^"]+)" as="font"/g)).toEqual(['/assets/b.woff2', '/assets/z4.woff2']);
      expect(h).not.toContain('font-display:swap');
    }
  });

  it('un seul h1, une seule action principale (répétée en bas), qui ouvre l’app dans la langue de la page', () => {
    for (const p of PAGES) {
      const h = html[p.chemin];
      expect(h.match(/<h1\b/g)).toHaveLength(1);
      const ctas = attr(h, /<a class="cta" href="([^"]+)">/g);
      expect(ctas).toHaveLength(2);
      for (const c of ctas) expect(c.replace(/&amp;/g, '&')).toBe(lienApp(p));
      expect(lienApp(p)).toMatch(new RegExp(`^/\\?lang=${p.langue}&.*utm_campaign=${p.campagne}$`));
      expect(attr(h, /<a class="cta" href="[^"]+">([^<]+)</g)).toEqual([COMMUN[p.langue].cta, COMMUN[p.langue].cta]);
      // Aucun script tiers, aucune mesure, pas le JS de l'app.
      expect(h).not.toMatch(/<script[^>]+src=/);
      expect(h).not.toMatch(/posthog|sentry|supabase/i);
    }
  });

  it('données structurées : WebApplication gratuite et FAQPage identique à la FAQ visible', () => {
    for (const p of PAGES) {
      const h = html[p.chemin];
      const json = JSON.parse(/<script type="application\/ld\+json">([^<]+)<\/script>/.exec(h)![1]);
      expect(json).toEqual(JSON.parse(JSON.stringify(donneesStructurees(p))));
      const [app, faq] = json['@graph'];
      expect(app['@type']).toBe('WebApplication');
      expect(app.offers).toMatchObject({ price: '0' });
      expect(app).not.toHaveProperty('aggregateRating');
      expect(faq['@type']).toBe('FAQPage');
      const visibles = attr(h, /<h3>([^<]+)<\/h3>/g);
      expect(faq.mainEntity.map((q: { name: string }) => q.name.replace(/&/g, '&amp;'))).toEqual(visibles);
      expect(faq.mainEntity.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('version sans JS : la position du premier défi et sa solution ; textes de la démo complets', () => {
    for (const p of PAGES) {
      const h = html[p.chemin];
      expect(h).toContain('class="sans-js"');
      expect(h).toContain('class="marque"');
      const t = JSON.parse(/<script type="application\/json" id="demo-textes">([^<]+)<\/script>/.exec(h)![1]);
      expect(t.defis).toHaveLength(demo.DEFIS.length);
    }
    expect(html['regles-du-go'].match(/<figure class="schema">/g)).toHaveLength(2);
  });

  it('pages légères : moins de 15 Ko compressées, tout compris sauf les polices', () => {
    for (const p of PAGES) expect(gzipSync(html[p.chemin]).length, p.chemin).toBeLessThan(15 * 1024);
  });
});

describe('faits annoncés', () => {
  it('nombre de leçons compté, toutes traduites ; plus de 100 problèmes ; 9 adversaires de Pomme à Sensei', () => {
    expect(html['apprendre-le-go']).toContain(`${LECONS_INDEX.length} leçons`);
    expect(html['en/learn-go']).toContain(`${LECONS_INDEX.length} lessons`);
    expect(Object.keys(LESSONS_EN)).toHaveLength(LECONS_INDEX.length);
    expect(ALL_PUZZLES.length).toBeGreaterThan(100);
    expect(OPPONENTS).toHaveLength(9);
    expect([OPPONENTS[0].nom, OPPONENTS[0].rang]).toEqual(['Pomme', '20 kyu']);
    expect([OPPONENTS[8].nom, OPPONENTS[8].rang]).toEqual(['Sensei', '1 dan']);
  });

  it('aucune promesse interdite par les fiches stores', () => {
    for (const h of Object.values(html)) expect(h).not.toMatch(/toujours gratuit|always free|n° ?1|meilleur|best app|App Store|Google Play/i);
  });
});

describe('sitemap, robots.txt et vercel.json', () => {
  it('sitemap : l’accueil et chaque page, avec ses alternatives', () => {
    const s = sitemap();
    expect(attr(s, /<loc>([^<]+)<\/loc>/g)).toEqual([`${SITE}/`, ...PAGES.map(p => url(p.chemin))]);
    expect(s.match(/hreflang="x-default"/g)).toHaveLength(PAGES.length);
    expect(robots()).toContain(`Sitemap: ${SITE}/sitemap.xml`);
    expect(robots()).not.toMatch(/Disallow: \//);
  });

  it('chaque page est servie par une réécriture de vercel.json, l’app et les liens courts ne changent pas', () => {
    for (const p of PAGES) expect(reecrire(`/${p.chemin}`, vercel.rewrites)).toBe(`/${p.chemin}/index.html`);
    expect(reecrire('/en', vercel.rewrites)).toBe('/index.html');
    expect(reecrire('/j/12', vercel.rewrites)).toBe('/j/12/index.html');
    expect(reecrire('/apprendre', vercel.rewrites)).toBeNull();
  });

  it('écrit les pages, le sitemap et robots.txt', async () => {
    const d = mkdtempSync(join(tmpdir(), 'referencement-'));
    try {
      const ecrits = await ecrireReferencement(d);
      expect(ecrits.sort()).toEqual([...PAGES.map(p => `${p.chemin}/index.html`), 'robots.txt', 'sitemap.xml'].sort());
      // Sans dist/assets : pas de @font-face, les polices système prennent le relais.
      expect(readFileSync(join(d, 'apprendre-le-go/index.html'), 'utf8')).not.toContain('@font-face');
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});
