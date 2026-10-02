// Génère public/icon-192.png et public/icon-512.png à partir de public/icon.svg,
// puis les images de lancement iOS (#406) : la première image de l'ouverture animée (index.html, `.ouv-logo`),
// en clair et en sombre, pour les tailles d'iPhone courantes, et leurs balises dans index.html.
// Utilise le Chromium de Playwright (pas de dépendance image en plus).
// Usage : node scripts/generate-icons.mjs
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('..', import.meta.url));
const svg = await readFile(`${root}public/icon.svg`, 'utf8');

const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
);
const page = await browser.newPage();
for (const size of [192, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: `${root}public/icon-${size}.png`, omitBackground: false });
  console.log(`public/icon-${size}.png`);
}
await page.close();

// --- Images de lancement iOS -----------------------------------------------------------------------------------
// Sans `apple-mobile-web-app-status-bar-style`, la page commence sous la barre d'état : le centre de la page est
// donc à mi-hauteur de la barre sous le centre de l'écran. `barre` : hauteur de la barre d'état, en points.
const IPHONES = [
  { l: 375, h: 667, dpr: 2, barre: 20 }, // SE 2e et 3e génération, 8
  { l: 375, h: 812, dpr: 3, barre: 44 }, // X, XS, 11 Pro, 12 mini, 13 mini
  { l: 390, h: 844, dpr: 3, barre: 47 }, // 12, 13, 14
  { l: 393, h: 852, dpr: 3, barre: 54 }, // 14 Pro, 15, 15 Pro, 16
  { l: 402, h: 874, dpr: 3, barre: 62 }, // 16 Pro, 17
  { l: 414, h: 896, dpr: 2, barre: 48 }, // XR, 11
  { l: 428, h: 926, dpr: 3, barre: 47 }, // 12 Pro Max, 13 Pro Max, 14 Plus
  { l: 430, h: 932, dpr: 3, barre: 54 }, // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  { l: 440, h: 956, dpr: 3, barre: 62 }, // 16 Pro Max, 17 Pro Max
];
const THEMES = { sombre: { fond: '#1C1916', lune: 0.22, schema: 'dark' }, clair: { fond: '#EFE8DC', lune: 0, schema: 'light' } };

let html = await readFile(`${root}index.html`, 'utf8');
const logo = html.match(/<svg class="ouv-logo"[\s\S]*?<\/svg>/)?.[0];
if (!logo) throw new Error('index.html : logo de l’ouverture (.ouv-logo) introuvable');

await rm(`${root}public/lancement`, { recursive: true, force: true });
await mkdir(`${root}public/lancement`, { recursive: true });
const liens = [];
for (const { l, h, dpr, barre } of IPHONES) {
  for (const [nom, t] of Object.entries(THEMES)) {
    const p = await browser.newPage({ viewport: { width: l, height: h }, deviceScaleFactor: dpr });
    // Même géométrie que la première image de index.html : 240 px, centré dans la page.
    await p.setContent(`<style>html,body{margin:0;background:${t.fond}}
      .ouv-logo{position:absolute;left:50%;top:calc(50% + ${barre / 2}px);width:240px;height:240px;margin:-120px 0 0 -120px}
      .ouv-logo .detache{fill:${t.fond}} .ouv-logo .detache-debut{display:none} .ouv-logo .lune{stroke:#F3EDE3;stroke-opacity:${t.lune}}</style>${logo}`);
    const fichier = `lancement/iphone-${l}x${h}-${nom}.png`;
    await p.screenshot({ path: `${root}public/${fichier}` });
    await p.close();
    liens.push(`<link rel="apple-touch-startup-image" href="/${fichier}" media="(device-width: ${l}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait) and (prefers-color-scheme: ${t.schema})" />`);
    console.log(`public/${fichier}`);
  }
}
await browser.close();

const debut = '<!--LANCEMENT-IOS-->', fin = '<!--/LANCEMENT-IOS-->';
const i = html.indexOf(debut), j = html.indexOf(fin);
if (i < 0) throw new Error(`index.html : repère ${debut} introuvable`);
const avant = html.slice(0, i), apres = j < 0 ? html.slice(i + debut.length) : html.slice(j + fin.length);
html = `${avant}${debut}\n    ${liens.join('\n    ')}\n    ${fin}${apres}`;
await writeFile(`${root}index.html`, html);
console.log(`index.html : ${liens.length} images de lancement`);
