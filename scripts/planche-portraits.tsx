// Planche des 9 portraits et de leurs 3 humeurs (issue #102) : npx vite-node scripts/planche-portraits.tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { Portrait, PORTRAITS, NOMS } from '../src/ui/Portrait';

const humeurs = ['neutre', 'content', 'surpris'] as const;
const lignes = PORTRAITS.map(id => `<div class="l"><b>${NOMS[id]}</b>${humeurs.map(h => renderToStaticMarkup(<Portrait id={id} humeur={h} taille={160} />)).join('')}${renderToStaticMarkup(<Portrait id={id} taille={44} rond decoratif />)}</div>`).join('');
const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#F7E9DA;font:600 18px system-ui;color:#1B1A18}
main{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px 30px;padding:28px;width:max-content}
.l{display:flex;align-items:center;gap:10px}.l b{width:84px}.portrait{position:relative;display:inline-block;line-height:0}
.portrait-signature{position:absolute;right:6%;bottom:6%}.sceau{display:inline-block;line-height:0}.sceau svg{display:block}
h1{grid-column:1/-1;margin:0;font-size:22px}</style>
<main><h1>Adversaires illustrés : neutre, content (il a gagné), surpris (tu l'as battu), vignette 44 px</h1>${lignes}</main>`;
const fichier = join(tmpdir(), 'planche-portraits.html');
writeFileSync(fichier, html);
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const p = await b.newPage({ deviceScaleFactor: 1 });
await p.goto(`file://${fichier}`);
await p.locator('main').screenshot({ path: process.argv[2] ?? 'docs/design/v2/portraits.png' });
await b.close();
