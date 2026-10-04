// Génère public/apercu.png (1200 × 630), l'image d'aperçu des liens partagés (Open Graph, issue #285).
// Même approche que scripts/generate-icons.mjs : le Chromium de Playwright, aucune dépendance image en plus.
// Logo à deux pierres (public/icon.svg), goban décoratif (aucun vrai problème : pas de spoiler) et phrase d'accroche,
// aux couleurs Encre & Jade (src/ui/tokens.css). Textes en grand : l'aperçu WhatsApp fait environ 300 px de large.
// Usage : node scripts/generate-apercu.mjs
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('..', import.meta.url));
const W = 1200;
const H = 630;

const logo = (await readFile(`${root}public/icon.svg`, 'utf8')).replace('<svg ', '<svg class="logo" ');
async function police(chemin) {
  return (await readFile(`${root}node_modules/${chemin}`)).toString('base64');
}
const titre = await police('@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2');
const texte = await police('@fontsource/zen-kaku-gothic-new/files/zen-kaku-gothic-new-latin-700-normal.woff2');

// Goban 9 × 9 décoratif, dessiné en perspective légère à droite.
const N = 9;
const pas = 50;
const marge = 30;
const cote = marge * 2 + pas * (N - 1);
const lignes = [];
for (let i = 0; i < N; i++) {
  const p = marge + i * pas;
  lignes.push(`M${marge} ${p}H${marge + pas * (N - 1)}M${p} ${marge}V${marge + pas * (N - 1)}`);
}
const hoshi = [
  [2, 2], [6, 2], [4, 4], [2, 6], [6, 6],
].map(([x, y]) => `<circle cx="${marge + x * pas}" cy="${marge + y * pas}" r="5" fill="#3A2912"/>`).join('');
// Position de début de partie, sans enjeu tactique.
const pierres = [
  ['n', 2, 2], ['b', 6, 2], ['n', 6, 6], ['b', 2, 6], ['n', 4, 3], ['b', 5, 4],
].map(([c, x, y]) => {
  const cx = marge + x * pas;
  const cy = marge + y * pas;
  return `<circle cx="${cx + 3}" cy="${cy + 5}" r="23" fill="rgba(0,0,0,.35)"/><circle cx="${cx}" cy="${cy}" r="23" fill="url(#${c})"/>`;
}).join('');
// Le coup à trouver : un anneau jade sur un point vide, rien de plus.
const cible = `<circle cx="${marge + 4 * pas}" cy="${marge + 5 * pas}" r="19" fill="none" stroke="#3CC48E" stroke-width="6"/>`;
const goban = `<svg class="goban" viewBox="0 0 ${cote} ${cote}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="n" cx="36%" cy="30%" r="72%"><stop offset="0" stop-color="#6a6e6c"/><stop offset=".22" stop-color="#2e3130"/><stop offset=".6" stop-color="#151716"/><stop offset="1" stop-color="#050606"/></radialGradient>
    <radialGradient id="b" cx="38%" cy="32%" r="78%"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#F3EEE3"/><stop offset=".85" stop-color="#DDD5C4"/><stop offset="1" stop-color="#BDB3A0"/></radialGradient>
    <linearGradient id="k" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EDC27A"/><stop offset="1" stop-color="#C58D42"/></linearGradient>
  </defs>
  <rect width="${cote}" height="${cote}" rx="14" fill="url(#k)"/>
  <path d="${lignes.join('')}" stroke="#3A2912" stroke-width="2.4"/>
  ${hoshi}${pierres}${cible}
</svg>`;

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
@font-face { font-family: 'Bricolage'; src: url(data:font/woff2;base64,${titre}) format('woff2'); font-weight: 200 800; }
@font-face { font-family: 'Zen'; src: url(data:font/woff2;base64,${texte}) format('woff2'); font-weight: 700; }
html, body { margin: 0; }
body { width: ${W}px; height: ${H}px; overflow: hidden; position: relative; color: #F3EDE3;
  background: radial-gradient(900px 520px at 78% -10%, rgba(239,184,74,.22), rgba(239,184,74,0) 70%), #1C1916; }
.gauche { position: absolute; left: 72px; top: 64px; width: 600px; }
.marque { display: flex; align-items: center; gap: 22px; font: 800 44px/1 'Bricolage', sans-serif; letter-spacing: -.5px; }
.logo { width: 92px; height: 92px; border-radius: 22px; box-shadow: 0 10px 24px -10px rgba(0,0,0,.8); }
h1 { margin: 58px 0 0; font: 800 76px/1.02 'Bricolage', sans-serif; letter-spacing: -1.5px; }
h1 em { font-style: normal; color: #3CC48E; }
p { margin: 30px 0 0; font: 700 32px/1.3 'Zen', sans-serif; color: #EFE8DC; }
.pastille { display: inline-block; margin-top: 34px; padding: 14px 30px; border-radius: 16px; background: #3CC48E; color: #07231A;
  font: 800 32px/1 'Bricolage', sans-serif; box-shadow: 0 6px 0 #1E8A5F; }
.goban { position: absolute; right: 64px; top: 75px; width: 480px; height: 480px;
  filter: drop-shadow(0 26px 30px rgba(0,0,0,.6)); }
</style></head><body>
<div class="gauche">
  <div class="marque">${logo}<span>Mochi Go</span></div>
  <h1>Trouveras-tu <em>le bon coup ?</em></h1>
  <p>Un défi par jour. Gratuit, sans compte.</p>
  <span class="pastille">Joue en 1 minute</span>
</div>
${goban}
</body></html>`;

const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: `${root}public/apercu.png`, omitBackground: false });
console.log('public/apercu.png');
await browser.close();
