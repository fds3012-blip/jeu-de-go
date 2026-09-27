// Planche de l'identité « deux pierres » (issue #51) : docs/design/v2/identite.png.
// Rend les vrais composants (IconesNav, Reflexion) avec les vrais styles (tokens.css, nav.css), puis capture avec Chromium.
// Usage : npx vite-node scripts/planche-identite.tsx  (PW_CHROMIUM_PATH pour choisir le navigateur)
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from '@playwright/test';
import { IconeNav } from '../src/ui/IconesNav';
import { ONGLETS } from '../src/ui/onglets';
import { Reflexion } from '../src/ui/Reflexion';

const root = fileURLToPath(new URL('..', import.meta.url));
const css = (await readFile(`${root}src/ui/tokens.css`, 'utf8')) + (await readFile(`${root}src/ui/nav.css`, 'utf8'));
const svg = await readFile(`${root}public/icon.svg`, 'utf8');
const icone = `<img alt="" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`;
const bricolage = `${root}node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2`;
const zen = `${root}node_modules/@fontsource/zen-kaku-gothic-new/files/zen-kaku-gothic-new-latin-700-normal.woff2`;

/** Une rangée d'icônes (4 onglets) dans un état donné, en grand. */
const rangee = (actif: boolean) => renderToStaticMarkup(
  <div className="rangee">
    {ONGLETS.map(o => (
      <div key={o.id} className={`case onglet-${o.id}`}>
        <div className="grand"><IconeNav onglet={o.id} actif={actif} /></div>
        <span className={actif ? 'lib actif' : 'lib'}>{o.libelle}</span>
        <span className="point" style={{ opacity: actif ? 1 : 0 }} />
      </div>
    ))}
  </div>,
);
/** L'orbite de l'indicateur d'attente, figée à quatre instants. */
const orbite = renderToStaticMarkup(
  <div className="orbite">
    {[0, 90, 180, 270].map(a => (
      <div key={a} className="fige" style={{ ['--a' as string]: `${a}deg` }}><Reflexion taille={56} /></div>
    ))}
  </div>,
);

const theme = (mode: 'dark' | 'light', titre: string) => `
<section class="theme" data-mode="${mode}">
  <h2>${titre}</h2>
  <p class="legende">Inactifs : encre brume, noire pleine, blanche en contour.</p>
  ${rangee(false)}
  <p class="legende">Actifs : matière du goban et une pièce d'accent par onglet.</p>
  ${rangee(true)}
  <p class="legende">Attente : le logo qui tourne (quatre instants d'un tour).</p>
  ${orbite}
</section>`;

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
@font-face { font-family: "Bricolage Grotesque"; src: url(file://${bricolage}); font-weight: 200 800; }
@font-face { font-family: "Zen Kaku Gothic New"; src: url(file://${zen}); font-weight: 700; }
${css}
html, body { margin: 0; }
body { font-family: var(--font-ui); width: 1600px; }
.planche { display: grid; grid-template-columns: 1fr 1fr; }
.theme { padding: 48px 56px 56px; background: var(--barre); color: var(--text); }
.theme[data-mode="light"] { --barre: #F7F2E9; --text: #1C1916; --muted: #675D53; --line: #D8CDBC;
  --onglet-jouer: var(--jade-bord); --onglet-apprendre: #A0680A; --onglet-problemes: var(--hanko); --onglet-profil: var(--indigo); --pierre-n-bord: rgba(28, 25, 22, 0); }
h1, h2 { font-family: var(--font-titre); letter-spacing: var(--tracking-titre); margin: 0; }
h2 { font-size: 30px; font-weight: 800; margin-bottom: 18px; }
.legende { color: var(--muted); font-size: 17px; margin: 26px 0 12px; }
.rangee { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.case { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--muted); }
.case .grand .icone-nav { width: 112px; height: 112px; }
.lib { font-size: 20px; font-weight: 500; }
.lib.actif { color: var(--text); font-weight: 700; }
.point { width: 12px; height: 12px; border-radius: 50%; background: var(--onglet); }
.orbite { display: flex; gap: 36px; }
.fige .reflexion-orbite { animation: none !important; transform: rotate(var(--a)); }
.fige .reflexion-n, .fige .reflexion-b { animation: none !important; transform: rotate(calc(-1 * var(--a))); }
.bas { grid-column: 1 / -1; display: flex; gap: 56px; align-items: center; padding: 48px 56px; background: var(--sumi-2); color: var(--papier); }
.bas img.app { width: 220px; height: 220px; border-radius: 48px; display: block; }
.bas .petit img { width: 48px; height: 48px; border-radius: 11px; display: block; }
.bas .fav img { width: 16px; height: 16px; display: block; }
.bas p { color: var(--brume); font-size: 18px; max-width: 560px; line-height: 1.5; margin: 10px 0 0; }
.tailles { display: flex; gap: 28px; align-items: end; margin-top: 24px; }
.tailles span { display: block; color: var(--brume); font-size: 14px; margin-top: 6px; }
</style></head><body><div class="planche">
${theme('dark', 'Encre (sombre)')}
${theme('light', 'Papier (clair)')}
<div class="bas">
  ${icone.replace('<img ', '<img class="app" ')}
  <div>
    <h2>Icône de l'app</h2>
    <p>Le logo sur l'encre, sous la lampe : une noire devant, une blanche derrière, qui se touchent, sur une grille de kaya à peine visible.</p>
    <div class="tailles">
      <div class="petit">${icone}<span>48 px</span></div>
      <div class="fav">${icone}<span>16 px</span></div>
    </div>
  </div>
</div>
</div></body></html>`;

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
// Mode sombre par défaut des jetons ; la moitié claire redéfinit ses rôles localement (.theme[data-mode="light"]).
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' });
// Page écrite sur disque : les polices en file:// ne se chargent pas depuis about:blank.
const fichier = `${tmpdir()}/planche-identite.html`;
await writeFile(fichier, html);
await page.goto(`file://${fichier}`, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.locator('.planche').screenshot({ path: `${root}docs/design/v2/identite.png` });
await browser.close();
console.log('docs/design/v2/identite.png');
