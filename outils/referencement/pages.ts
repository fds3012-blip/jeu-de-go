// Pages de référencement (#472) : `/apprendre-le-go`, `/regles-du-go`, `/en/learn-go`, `/en/go-rules`, plus
// `sitemap.xml` et `robots.txt`, écrits dans dist/ au build. HTML statique et léger, sans le JS de l'app : du texte vrai
// (outils/referencement/textes.ts), une mini démo de capture (demo.js, inlinée et minifiée, jamais dans le bundle de
// l'app) avec sa version sans JS, et une seule action principale, « Jouer maintenant », qui ouvre l'app.
// Polices : les fichiers de l'app (dist/assets, empreinte dans le nom), partagés avec elle : déjà en cache à l'ouverture.
// Aucune mesure sur ces pages (aucune donnée personnelle) : le lien « Jouer maintenant » porte utm_campaign, que
// PostHog lit à l'ouverture de l'app. Servies par les réécritures de vercel.json (testées par pages.test.ts).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { transformWithEsbuild, type Plugin } from 'vite';
import { SITE } from '../apercus';
import { LECONS_INDEX } from '../../src/content/leconsIndex.gen';
import { COMMUN, LEGENDES, PAGES, type Langue, type Page } from './textes';

const SOURCE_DEMO = new URL('./demo.js', import.meta.url);

/** Fonctions de demo.js, exécutées dans Node pour dessiner les gobans de la version sans JS (et pour les tests). */
export interface Demo {
  DEFIS: { noires: string[]; blanches: string[]; but: 'capture' | 'sauver'; cible: string; cle: string }[];
  plateauDe(d: Demo['DEFIS'][number]): string;
  poser(p: string, i: number, c: 'b' | 'w'): { plateau: string; prises: number[] } | { erreur: 'occupe' | 'suicide' };
  groupe(p: string, i: number): { pierres: number[]; libertes: number[] };
  indexDe(nom: string): number;
  nomPoint(i: number): string;
  svgGoban(p: string, o?: { dernier?: number; marques?: number[] }): string;
}

export function chargerDemo(): Demo {
  const ctx = createContext({});
  runInContext(readFileSync(SOURCE_DEMO, 'utf8'), ctx);
  // Les fonctions déclarées deviennent des propriétés du contexte ; une constante non, on la lit.
  return { ...(ctx as unknown as Demo), DEFIS: runInContext('DEFIS', ctx) as Demo['DEFIS'] };
}

/** demo.js minifié, tel qu'inliné dans les pages. */
export async function demoMinifiee(): Promise<string> {
  const r = await transformWithEsbuild(readFileSync(SOURCE_DEMO, 'utf8'), 'demo.js', { minify: true, target: 'es2017', format: 'iife' });
  return r.code.trim();
}

/** Fichiers de police de l'app dans dist/assets (Bricolage pour les titres, Zen Kaku Gothic New pour le texte). */
export interface Polices { titre?: string; texte?: string; gras?: string }

export function trouverPolices(dossier: string): Polices {
  const assets = join(dossier, 'assets');
  if (!existsSync(assets)) return {};
  const f = readdirSync(assets);
  const un = (re: RegExp) => { const x = f.find(n => re.test(n)); return x ? `/assets/${x}` : undefined; };
  return {
    titre: un(/^bricolage-grotesque-latin-wght-normal-[\w-]+\.woff2$/),
    texte: un(/^zen-kaku-gothic-new-latin-400-normal-[\w-]+\.woff2$/),
    gras: un(/^zen-kaku-gothic-new-latin-700-normal-[\w-]+\.woff2$/),
  };
}

const echapper = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const texteBrut = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
/** JSON dans un `<script>` : rien ne peut le fermer. */
const jsonInline = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

export const url = (chemin: string) => `${SITE}/${chemin}`;

/** Lien « Jouer maintenant » : l'app, dans la langue de la page, avec la campagne pour PostHog. */
export function lienApp(p: Page): string {
  return `/?lang=${p.langue}&utm_source=mochi-go&utm_medium=page&utm_campaign=${p.campagne}`;
}

/** Remplace `{lecons}` (nombre de leçons, compté dans l'index). */
const remplir = (s: string) => s.replace(/\{lecons\}/g, String(LECONS_INDEX.length));

const figure = (svg: string, legende: string) => `<figure class="schema">${svg}<figcaption>${echapper(legende)}</figcaption></figure>`;

/** Schémas des règles. */
function schemas(demo: Demo, langue: Langue): Record<'libertes' | 'ko', string> {
  const i = demo.indexDe;
  const libertes = demo.plateauDe({ noires: ['E5'], blanches: [], but: 'capture', cible: 'E5', cle: 'E4' });
  const ko = demo.plateauDe({ noires: ['D5', 'E6', 'E4', 'F5'], blanches: ['F6', 'G5', 'F4'], but: 'capture', cible: 'E5', cle: 'E5' });
  return {
    libertes: figure(demo.svgGoban(libertes, { marques: ['D5', 'F5', 'E6', 'E4'].map(i) }), LEGENDES[langue].libertes),
    ko: figure(demo.svgGoban(ko, { dernier: i('F5'), marques: [i('E5')] }), LEGENDES[langue].ko),
  };
}

function section(s: { id: string; titre: string; html: string }, sch: Record<string, string>): string {
  const corps = remplir(s.html).replace(/\{schema:(\w+)\}/g, (_t, nom: string) => {
    if (!sch[nom]) throw new Error(`Schéma inconnu : ${nom}`);
    return sch[nom];
  });
  return `<section id="${s.id}" aria-labelledby="${s.id}-titre"><h2 id="${s.id}-titre">${echapper(s.titre)}</h2>\n${corps}</section>`;
}

/** Données structurées : l'app (WebApplication) et la FAQ visible de la page (FAQPage). */
export function donneesStructurees(p: Page): unknown {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': `${SITE}/#app`,
        name: 'Mochi Go',
        url: `${SITE}/`,
        description: remplir(p.description),
        applicationCategory: 'GameApplication',
        genre: p.langue === 'fr' ? 'Jeu de go' : 'Go (board game)',
        operatingSystem: 'Web',
        browserRequirements: 'JavaScript',
        inLanguage: ['fr', 'en'],
        isAccessibleForFree: true,
        image: `${SITE}/icon-512.png`,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      },
      {
        '@type': 'FAQPage',
        '@id': `${url(p.chemin)}#faq`,
        url: url(p.chemin),
        inLanguage: p.langue,
        mainEntity: p.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: texteBrut(f.r) } })),
      },
    ],
  };
}

const CSS = `
:root{--bg:#1C1916;--surface:#27221E;--line:#3E3731;--text:#F3EDE3;--muted:#A99F92;--accent:#3CC48E;--accent-bord:#1E8A5F;--on-accent:#07231A;--accent-texte:#3CC48E;--focus:#3CC48E;
--halo:radial-gradient(120% 420px at 50% -120px,rgba(239,184,74,.11),rgba(239,184,74,0) 70%);--ombre-relief:0 5px 0 var(--accent-bord),0 14px 28px -12px rgba(60,196,142,.55);--ombre-plateau:0 14px 28px -16px rgba(0,0,0,.7);
--font-ui:"Zen Kaku Gothic New",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--font-titre:"Bricolage Grotesque","Zen Kaku Gothic New",system-ui,-apple-system,"Segoe UI",sans-serif;color-scheme:dark}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]){--bg:#EFE8DC;--surface:#FBF8F2;--line:#D8CDBC;--text:#1C1916;--muted:#675D53;--accent-texte:#126541;--focus:#1E8A5F;
--halo:radial-gradient(120% 420px at 50% -120px,rgba(239,184,74,.22),rgba(239,184,74,0) 70%);--ombre-relief:0 5px 0 var(--accent-bord),0 14px 24px -14px rgba(30,138,95,.5);--ombre-plateau:0 14px 28px -16px rgba(60,40,15,.45);color-scheme:light}}
:root[data-theme="light"]{--bg:#EFE8DC;--surface:#FBF8F2;--line:#D8CDBC;--text:#1C1916;--muted:#675D53;--accent-texte:#126541;--focus:#1E8A5F;
--halo:radial-gradient(120% 420px at 50% -120px,rgba(239,184,74,.22),rgba(239,184,74,0) 70%);--ombre-relief:0 5px 0 var(--accent-bord),0 14px 24px -14px rgba(30,138,95,.5);--ombre-plateau:0 14px 28px -16px rgba(60,40,15,.45);color-scheme:light}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;background:var(--halo) no-repeat,var(--bg);color:var(--text);font:400 1rem/1.55 var(--font-ui);overflow-wrap:break-word}
.page{max-width:640px;margin:0 auto;padding:0 16px env(safe-area-inset-bottom,0px)}
a{color:var(--accent-texte);text-underline-offset:.15em}
:focus-visible{outline:3px solid var(--focus);outline-offset:2px;border-radius:4px}
.saut{position:absolute;left:16px;top:-100px;padding:12px 16px;background:var(--surface);color:var(--text);z-index:2}
.saut:focus{top:8px}
.entete{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:64px}
.marque{display:inline-flex;align-items:center;gap:10px;min-height:44px;color:var(--text);text-decoration:none;font:800 1.2rem/1 var(--font-titre);letter-spacing:-.02em}
.langue{display:inline-flex;align-items:center;min-height:44px;min-width:44px;padding:0 4px;font-weight:700}
h1,h2{font-family:var(--font-titre);font-weight:800;letter-spacing:-.02em;text-wrap:balance}
h1{font-size:clamp(2rem,8.5vw,2.75rem);line-height:1.08;margin:20px 0 12px}
h2{font-size:1.5rem;line-height:1.2;margin:0 0 12px}
.chapo{font-size:1.125rem;margin:0}
.cta{display:flex;align-items:center;justify-content:center;width:100%;max-width:420px;min-height:56px;margin:24px 0 10px;padding:0 16px;border-radius:16px;background:var(--accent);color:var(--on-accent);box-shadow:var(--ombre-relief);font:800 1.25rem/1.15 var(--font-titre);letter-spacing:-.01em;text-decoration:none;text-align:center}
.cta:focus-visible{outline-offset:4px}
@media (prefers-reduced-motion:no-preference){.cta{transition:transform .1s cubic-bezier(.2,.8,.2,1),box-shadow .1s}.cta:active{transform:translateY(5px);box-shadow:none}}
@media (prefers-reduced-motion:reduce){.cta:active{background:#34B07F}}
.mention{margin:0;color:var(--muted);font-size:.875rem}
main>section{margin:56px 0}
.demo-defi{margin:0 0 4px;font:700 1.0625rem/1.3 var(--font-titre)}
.demo-consigne{margin:0 0 12px}
.goban{position:relative;width:100%;max-width:440px;margin:16px auto 12px}
.goban-svg{display:block;width:100%;height:auto;border-radius:10px;box-shadow:var(--ombre-plateau)}
.goban-points{display:none;position:absolute;inset:0}
.demo.pret .goban-points{display:block}
.point{position:absolute;width:10.53%;height:10.53%;margin:0;padding:0;border:0;border-radius:50%;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
.point:focus-visible{outline:none;box-shadow:0 0 0 3px #07231A,0 0 0 5px #F3EDE3}
.demo[data-etat="jeu"] .point:active{background:radial-gradient(circle,rgba(5,6,6,.35) 0 45%,transparent 47%)}
@media (hover:hover) and (pointer:fine){.demo[data-etat="jeu"] .point:hover{background:radial-gradient(circle,rgba(5,6,6,.35) 0 45%,transparent 47%)}}
.demo-statut{min-height:3.1em;margin:0;font-weight:700}
.demo-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;min-height:48px}
.demo-fin{margin:0;flex-basis:100%}
.secondaire{min-height:48px;padding:0 20px;border:0;border-radius:16px;background:none;color:var(--text);box-shadow:inset 0 0 0 2px var(--line);font:700 1rem/1 var(--font-ui);cursor:pointer}
.avec-js{display:none}
.js .avec-js{display:block}
.js .sans-js{display:none}
.schema{max-width:300px;margin:16px auto}
figcaption{margin-top:8px;color:var(--muted);font-size:.875rem}
.regles{counter-reset:r;list-style:none;padding:0;margin:0 0 12px}
.regles li{counter-increment:r;position:relative;padding-left:44px;margin:0 0 14px}
.regles li::before{content:counter(r);position:absolute;left:0;top:0;width:30px;height:30px;border-radius:50%;background:var(--surface);box-shadow:inset 0 0 0 2px var(--accent);display:flex;align-items:center;justify-content:center;font:800 1rem/1 var(--font-titre)}
.raisons,.atouts{padding-left:20px;margin:0}
.raisons li,.atouts li{margin:0 0 10px}
.faq h3{font:700 1.0625rem/1.35 var(--font-ui);margin:20px 0 4px}
.faq p{margin:0}
.fin{text-align:center}
.fin .cta{margin:16px auto 10px}
.pied{border-top:1px solid var(--line);margin-top:56px;padding:16px 0 32px;color:var(--muted);font-size:.875rem}
.pied ul{list-style:none;display:flex;flex-wrap:wrap;gap:0 20px;padding:0;margin:0 0 8px}
.pied a{display:inline-flex;align-items:center;min-height:44px}
.pied p{margin:0}
`;

// `optional` : jamais de saut de mise en page quand la police arrive (Lighthouse : CLS 0,1 à 0,2 avec `swap`). Préchargées,
// elles arrivent le plus souvent à temps ; sinon la page garde la police système, et les suivantes (comme l'app) ont la vraie.
function fontFaces(p: Polices): string {
  const f = (famille: string, poids: string, src?: string) =>
    src ? `@font-face{font-family:"${famille}";font-style:normal;font-weight:${poids};font-display:optional;src:url(${src}) format("woff2")}` : '';
  return f('Bricolage Grotesque', '200 800', p.titre) + f('Zen Kaku Gothic New', '400', p.texte) + f('Zen Kaku Gothic New', '700', p.gras);
}

/** Script de tête : `js` sur <html> (démo à la place de la figure sans JS) et thème choisi dans le Profil de l'app. */
const TETE = `(function(h){h.className='js';try{var t=JSON.parse(localStorage.getItem('go.settings.v1')||'{}').theme;if(t==='dark'||t==='light')h.setAttribute('data-theme',t)}catch(e){}})(document.documentElement)`;

export interface Options { polices: Polices; demoJs: string }

/** HTML complet d'une page. */
export function pageHtml(p: Page, o: Options): string {
  const c = COMMUN[p.langue];
  const demo = chargerDemo();
  const sch = schemas(demo, p.langue);
  const autre = PAGES.find(x => x.chemin === p.traduction);
  if (!autre) throw new Error(`Traduction absente : ${p.traduction}`);
  const fr = p.langue === 'fr' ? p : autre;
  const en = p.langue === 'en' ? p : autre;
  // Même aperçu que l'accueil (#489) : la promesse générale avec Mochi, pas la question du Go du jour.
  const image = p.langue === 'en' ? 'apercu-accueil-en.png' : 'apercu-accueil.png';
  const titre = echapper(remplir(p.titre));
  const description = echapper(remplir(p.description));
  const apercu = echapper(remplir(p.apercu));
  const app = echapper(lienApp(p));
  const premier = demo.plateauDe(demo.DEFIS[0]);
  const regles = PAGES.find(x => x.langue === p.langue && x.chemin !== p.chemin && /regles|rules/.test(x.chemin)) ?? p;
  const apprendre = PAGES.find(x => x.langue === p.langue && /apprendre|learn/.test(x.chemin)) ?? p;
  const sectionDemo = `<section id="demo" class="demo" aria-labelledby="demo-titre">
<h2 id="demo-titre">${echapper(c.demoTitre)}</h2>
<p>${echapper(c.demoIntro)}</p>
<p class="demo-defi avec-js"></p>
<p class="demo-consigne avec-js"></p>
<div class="goban"><div class="goban-dessin">${demo.svgGoban(premier, { marques: [demo.indexDe(demo.DEFIS[0].cle)] })}</div><div class="goban-points" role="group"></div></div>
<p class="sans-js">${echapper(c.demoSansJs)}</p>
<p class="demo-statut avec-js" role="status"></p>
<div class="demo-actions avec-js"></div>
</section>`;
  return `<!doctype html>
<html lang="${p.langue}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${titre}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${url(p.chemin)}">
<link rel="alternate" hreflang="fr" href="${url(fr.chemin)}">
<link rel="alternate" hreflang="en" href="${url(en.chemin)}">
<link rel="alternate" hreflang="x-default" href="${url(en.chemin)}">
<meta name="theme-color" content="#1C1916" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#EFE8DC" media="(prefers-color-scheme: light)">
${[o.polices.titre, o.polices.texte].filter(Boolean).map(f => `<link rel="preload" href="${f}" as="font" type="font/woff2" crossorigin>\n`).join('')}<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icon-192.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Mochi Go">
<meta property="og:locale" content="${p.langue === 'en' ? 'en_US' : 'fr_FR'}">
<meta property="og:locale:alternate" content="${p.langue === 'en' ? 'fr_FR' : 'en_US'}">
<meta property="og:url" content="${url(p.chemin)}">
<meta property="og:title" content="${titre}">
<meta property="og:description" content="${apercu}">
<meta property="og:image" content="${SITE}/${image}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${echapper(c.imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${titre}">
<meta name="twitter:description" content="${apercu}">
<meta name="twitter:image" content="${SITE}/${image}">
<meta name="twitter:image:alt" content="${echapper(c.imageAlt)}">
<script type="application/ld+json">${jsonInline(donneesStructurees(p))}</script>
<script>${TETE}</script>
<style>${fontFaces(o.polices)}${CSS.trim()}</style>
</head>
<body>
<a class="saut" href="#contenu">${echapper(c.sauter)}</a>
<div class="page">
<header class="entete">
<a class="marque" href="${p.langue === 'en' ? '/?lang=en' : '/'}" aria-label="${echapper(c.accueil)}"><img src="/icon.svg" width="32" height="32" alt="">Mochi Go</a>
<a class="langue" href="/${autre.chemin}" hreflang="${autre.langue}" lang="${autre.langue}">${echapper(c.autreLangue)}</a>
</header>
<main id="contenu">
<section class="heros" aria-labelledby="h1">
<h1 id="h1">${echapper(p.h1)}</h1>
<p class="chapo">${echapper(remplir(p.chapo))}</p>
<a class="cta" href="${app}">${echapper(c.cta)}</a>
<p class="mention">${echapper(c.mention)}</p>
</section>
${p.avant.map(s => section(s, sch)).join('\n')}
${sectionDemo}
${p.apres.map(s => section(s, sch)).join('\n')}
<section id="faq" class="faq" aria-labelledby="faq-titre"><h2 id="faq-titre">${echapper(c.faqTitre)}</h2>
${p.faq.map(f => `<h3>${echapper(f.q)}</h3>\n<p>${f.r}</p>`).join('\n')}
</section>
<section class="fin" aria-labelledby="fin-titre"><h2 id="fin-titre">${echapper(c.finTitre)}</h2>
<a class="cta" href="${app}">${echapper(c.cta)}</a>
<p class="mention">${echapper(c.mention)}</p>
</section>
</main>
<footer class="pied">
<ul>
<li><a href="/${apprendre.chemin}">${echapper(c.piedApprendre)}</a></li>
<li><a href="/${regles.chemin}">${echapper(c.piedRegles)}</a></li>
<li><a href="/confidentialite">${echapper(c.confidentialite)}</a></li>
</ul>
<p>${echapper(c.credits)}</p>
</footer>
</div>
<script type="application/json" id="demo-textes">${jsonInline(c.demo)}</script>
<script>${o.demoJs}</script>
</body>
</html>
`;
}

/** Pages indexées : l'accueil de l'app et les pages de référencement. */
export function sitemap(): string {
  const alternates = (p: Page) => {
    const autre = PAGES.find(x => x.chemin === p.traduction)!;
    const fr = p.langue === 'fr' ? p : autre;
    const en = p.langue === 'en' ? p : autre;
    return [`    <xhtml:link rel="alternate" hreflang="fr" href="${url(fr.chemin)}"/>`,
      `    <xhtml:link rel="alternate" hreflang="en" href="${url(en.chemin)}"/>`,
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${url(en.chemin)}"/>`].join('\n');
  };
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${SITE}/</loc>
  </url>
${PAGES.map(p => `  <url>\n    <loc>${url(p.chemin)}</loc>\n${alternates(p)}\n  </url>`).join('\n')}
</urlset>
`;
}

export function robots(): string {
  return `# Mochi Go : tout est ouvert aux moteurs. Les pages d'aperçu des liens partagés portent noindex (outils/apercus.ts).
User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;
}

/** Écrit les pages, le sitemap et robots.txt dans `dossier` (dist/). */
export async function ecrireReferencement(dossier: string): Promise<string[]> {
  const o: Options = { polices: trouverPolices(dossier), demoJs: await demoMinifiee() };
  const ecrits: string[] = [];
  const ecrire = (chemin: string, contenu: string) => {
    const f = join(dossier, chemin);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, contenu);
    ecrits.push(chemin);
  };
  for (const p of PAGES) ecrire(`${p.chemin}/index.html`, pageHtml(p, o));
  ecrire('sitemap.xml', sitemap());
  ecrire('robots.txt', robots());
  return ecrits;
}

/** Plugin Vite : les pages de référencement, une fois le build écrit. */
export function pagesReferencement(): Plugin {
  let dossier = 'dist';
  return {
    name: 'go-pages-referencement',
    apply: 'build',
    configResolved(c) { dossier = join(c.root, c.build.outDir); },
    async closeBundle() { if (existsSync(join(dossier, 'index.html'))) await ecrireReferencement(dossier); },
  };
}
