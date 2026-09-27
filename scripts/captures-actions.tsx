// Captures de la barre d'actions de la partie (issue #65) : docs/design/v2/captures/actions-*.png.
// 1. Planche des quatre icônes en grand (vrais composants, vrais styles), sombre et clair, dans leurs états.
// 2. Écran de partie 390 × 844, sombre et clair, au repos et à l'étape « Confirmer ? ».
// Usage : lancer `npx vite --port 4326`, puis `npx vite-node scripts/captures-actions.tsx`
// (CAPTURES_URL pour une autre adresse, PW_CHROMIUM_PATH pour choisir le navigateur).
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from '@playwright/test';
import { IconeAction, type NomAction } from '../src/ui/IconesActions';

const NOMS_ACTIONS: NomAction[] = ['indice', 'annuler', 'passer', 'abandonner'];

const root = fileURLToPath(new URL('..', import.meta.url));
const sortie = `${root}docs/design/v2/captures`;
const url = process.env.CAPTURES_URL ?? 'http://localhost:4326/';
const css = (await readFile(`${root}src/ui/tokens.css`, 'utf8')) + (await readFile(`${root}src/ui/partie.css`, 'utf8'));
const bricolage = `${root}node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2`;
const zen = `${root}node_modules/@fontsource/zen-kaku-gothic-new/files/zen-kaku-gothic-new-latin-700-normal.woff2`;
const LIBELLES: Record<NomAction, string> = { indice: 'Indice', annuler: 'Annuler', passer: 'Passer', abandonner: 'Abandonner' };

/** Une rangée de la barre d'actions, en grand, dans un état donné. */
const rangee = (etat: 'repos' | 'desactive' | 'appui') => renderToStaticMarkup(
  <div className={`actions rangee ${etat}`}>
    {NOMS_ACTIONS.map(n => (
      <button key={n} type="button" disabled={etat === 'desactive'} className={etat === 'appui' ? 'appuye' : undefined}>
        <IconeAction nom={n} /><span>{LIBELLES[n]}</span>
      </button>
    ))}
  </div>,
);
const abandonner = renderToStaticMarkup(
  <div className="actions rangee">
    <button type="button"><IconeAction nom="abandonner" /><span>Abandonner</span></button>
  </div>,
);
const confirmer = renderToStaticMarkup(
  <div className="actions rangee">
    <button type="button" className="danger"><IconeAction nom="abandonner" /><span>Confirmer ?</span></button>
  </div>,
);
const petit = renderToStaticMarkup(
  <div className="actions petit">
    {NOMS_ACTIONS.map(n => (
      <button key={n} type="button" disabled={n === 'annuler'}><IconeAction nom={n} /><span>{LIBELLES[n]}</span></button>
    ))}
  </div>,
);

const theme = (mode: 'dark' | 'light', titre: string) => `
<section class="theme" data-theme="${mode}">
  <h2>${titre}</h2>
  <p class="legende">Disponibles : les pierres du goban. Seule l'indice a une couleur, le halo jade.</p>
  ${rangee('repos')}
  <p class="legende">Désactivées : encre brume, comme un onglet inactif.</p>
  ${rangee('desactive')}
  <p class="legende">Abandonner, puis « Confirmer ? » : le couvercle devient sceau hanko.</p>
  <div class="duo">${abandonner}${confirmer}</div>
  <p class="legende">Taille réelle (28 px), Annuler désactivé au premier coup.</p>
  ${petit}
</section>`;

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
@font-face { font-family: "Bricolage Grotesque"; src: url(file://${bricolage}); font-weight: 200 800; }
@font-face { font-family: "Zen Kaku Gothic New"; src: url(file://${zen}); font-weight: 700; }
${css}
html, body { margin: 0; }
body { font-family: var(--font-ui); width: 1600px; }
.planche { display: grid; grid-template-columns: 1fr 1fr; }
.theme { padding: 44px 48px 52px; background: var(--barre); color: var(--text); }
.theme[data-theme="light"] { --bg: #EFE8DC; --surface: #FBF8F2; --barre: #F7F2E9; --text: #1C1916; --muted: #675D53; --line: #D8CDBC;
  --danger-texte: #B23520; --onglet-jouer: var(--jade-bord); --pierre-n-bord: rgba(28, 25, 22, 0); }
h2 { font-family: var(--font-titre); letter-spacing: var(--tracking-titre); font-size: 30px; font-weight: 800; margin: 0 0 8px; }
.legende { color: var(--muted); font-size: 17px; margin: 26px 0 10px; }
.actions.rangee, .actions.petit { position: static; border: 0; padding: 0; background: none; justify-content: flex-start; }
.actions.rangee button { max-width: none; flex: 0 0 170px; gap: 10px; font-size: 20px; }
.actions.rangee .icone-action { width: 104px; height: 104px; }
.actions.rangee .appuye .pose { transform: translateY(1.2px) scale(.9); }
.duo { display: flex; }
.duo .actions.rangee { flex: none; }
.actions.petit { width: 390px; border-top: 1px solid var(--line); padding-top: 4px; }
</style></head><body><div class="planche">
${theme('dark', 'Encre (sombre)')}
${theme('light', 'Papier (clair)')}
</div></body></html>`;

const PREINSTALLED = '/opt/pw-browsers/chromium';
const executablePath = process.env.PW_CHROMIUM_PATH ?? (existsSync(chromium.executablePath()) ? undefined : existsSync(PREINSTALLED) ? PREINSTALLED : undefined);
const browser = await chromium.launch(executablePath ? { executablePath } : {});

// 1. Planche
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  const fichier = `${tmpdir()}/planche-actions.html`;
  await writeFile(fichier, html);
  await page.goto(`file://${fichier}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.planche').screenshot({ path: `${sortie}/actions-planche.png` });
  await page.close();
}

// 2. Écran de partie, 390 × 844
for (const mode of ['dark', 'light'] as const) {
  const nom = mode === 'dark' ? 'sombre' : 'clair';
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: mode, locale: 'fr-FR', reducedMotion: 'reduce' });
  await ctx.addInitScript(() => localStorage.setItem('go.consentement.v1', 'refuse'));
  const page = await ctx.newPage();
  await page.goto(url);
  await page.locator('.cta').click();
  const barre = page.getByRole('toolbar', { name: 'Actions de la partie' });
  await barre.waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${sortie}/actions-${nom}.png` });
  await barre.getByRole('button', { name: 'Abandonner' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${sortie}/actions-confirmer-${nom}.png` });
  await ctx.close();
}
await browser.close();
console.log('docs/design/v2/captures/actions-*.png');
