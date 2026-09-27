// Génère public/icon-192.png et public/icon-512.png à partir de public/icon.svg.
// Utilise le Chromium de Playwright (pas de dépendance image en plus).
// Usage : node scripts/generate-icons.mjs
import { readFile } from 'node:fs/promises';
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
await browser.close();
