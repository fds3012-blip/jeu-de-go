// Pages d'aperçu des liens courts (#285, #364) : titres, images, réécritures de vercel.json, et la même app.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APERCUS_FIXES, APRES, AVANT, apercuJour, apercus, ecrireApercus, numeroAu, pageApercu, reecrire, SITE } from './apercus';
import { numeroDuJour } from '../src/app/goDuJour';

const racine = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', racine), 'utf8');
const vercel = JSON.parse(readFileSync(new URL('vercel.json', racine), 'utf8')) as { rewrites: { source: string; destination: string }[] };

/** Contenu d'une balise d'aperçu d'une page. */
function meta(page: string, cle: string): string | null {
  const re = new RegExp(`<meta\\s+(?:property|name)="${cle.replace(/[:.]/g, '\\$&')}"\\s+content="([^"]*)"`);
  return re.exec(page)?.[1] ?? null;
}
/** Largeur, hauteur et poids d'un PNG de public/. */
function png(nom: string) {
  const b = readFileSync(new URL(`public/${nom}`, racine));
  return { largeur: b.readUInt32BE(16), hauteur: b.readUInt32BE(20), octets: b.length };
}

describe("pages d'aperçu des liens courts", () => {
  it('numéro du jour : le même que l’app', () => {
    for (const d of ['2026-09-27T12:00:00+02:00', '2026-10-05T23:30:00+02:00', '2027-03-28T01:30:00+01:00']) {
      expect(numeroAu(new Date(d)), d).toBe(numeroDuJour(new Date(d)));
    }
  });

  it('Go du jour : de J−30 à J+45, en français et en anglais, jamais avant le n° 1', () => {
    const pages = apercus(new Date('2026-10-05T12:00:00+02:00')).map(a => a.chemin);
    expect(pages).toContain('j/1');
    expect(pages).toContain('en/j/1');
    expect(pages).toContain(`j/${9 + APRES}`);
    expect(pages).not.toContain('j/0');
    const tard = apercus(new Date('2027-01-01T12:00:00+01:00')).map(a => a.chemin);
    const n = numeroAu(new Date('2027-01-01T12:00:00+01:00'));
    expect(tard).toContain(`j/${n - AVANT}`);
    expect(tard).not.toContain(`j/${n - AVANT - 1}`);
  });

  it('titres courts, descriptions qui tiennent dans WhatsApp, images 1200 × 630 légères', () => {
    for (const a of [...APERCUS_FIXES, apercuJour(9999, 'fr'), apercuJour(9999, 'en')]) {
      expect(a.titre.length, a.titre).toBeLessThanOrEqual(60);
      expect(a.description.length, a.description).toBeLessThanOrEqual(110);
      const { largeur, hauteur, octets } = png(a.image);
      expect({ largeur, hauteur }, a.image).toEqual({ largeur: 1200, hauteur: 630 });
      expect(octets, a.image).toBeLessThan(300 * 1024);
    }
  });

  it('même app, octet pour octet hors des balises d’aperçu ; noindex', () => {
    const a = APERCUS_FIXES.find(x => x.chemin === 'en/defi')!;
    const page = pageApercu(html, a);
    expect(meta(page, 'og:title')).toBe('A friend challenges you to a game of go');
    expect(meta(page, 'og:url')).toBe(`${SITE}/en/defi`);
    expect(meta(page, 'og:image')).toBe(`${SITE}/apercu-defi-en.png`);
    expect(meta(page, 'twitter:title')).toBe(meta(page, 'og:title'));
    expect(meta(page, 'twitter:image')).toBe(meta(page, 'og:image'));
    expect(meta(page, 'og:locale')).toBe('en_US');
    expect(meta(page, 'robots')).toBe('noindex');
    expect(page).toContain('<html lang="en">');
    const sansMeta = (h: string) => h.replace(/<meta[^>]*>/g, '').replace(/<html lang="\w+">/, '').replace(/\s+/g, ' ');
    expect(sansMeta(page)).toBe(sansMeta(html));
    // Le jour : son numéro dans le titre, jamais la position du problème (pas de spoiler : image commune).
    const jour = pageApercu(html, apercuJour(42, 'fr'));
    expect(meta(jour, 'og:title')).toBe('Go du jour n° 42 : trouveras-tu le bon coup ?');
    expect(meta(jour, 'og:image')).toBe(`${SITE}/apercu.png`);
    // La 404 : l'aperçu général, non indexée.
    const p404 = pageApercu(html, null);
    expect(meta(p404, 'og:title')).toBe(meta(html, 'og:title'));
    expect(meta(p404, 'robots')).toBe('noindex');
    expect(meta(html, 'robots')).toBeNull();
  });

  it('les textes sont échappés', () => {
    const page = pageApercu(html, { ...APERCUS_FIXES[0], titre: 'A "b" <c> & d' });
    expect(meta(page, 'og:title')).toBe('A &quot;b&quot; &lt;c> &amp; d');
  });

  it('écrit les pages à côté de dist/index.html', () => {
    const dossier = mkdtempSync(join(tmpdir(), 'apercus-'));
    try {
      writeFileSync(join(dossier, 'index.html'), html);
      const ecrits = ecrireApercus(dossier, new Date('2026-10-05T12:00:00+02:00'));
      expect(ecrits).toEqual(expect.arrayContaining(['defi/index.html', 'en/partie/index.html', 'j/9/index.html', 'en/j/54/index.html', '404.html']));
      expect(meta(readFileSync(join(dossier, 'j/9/index.html'), 'utf8'), 'og:url')).toBe(`${SITE}/j/9`);
    } finally { rmSync(dossier, { recursive: true, force: true }); }
  });

  it('vercel.json sert chaque lien court par sa page (aucune fonction serveur)', () => {
    const r = new Map(vercel.rewrites.map(x => [x.source, x.destination]));
    expect(r.get('/defi')).toBe('/defi/index.html');
    expect(r.get('/en/defi')).toBe('/en/defi/index.html');
    expect(r.get('/partie')).toBe('/partie/index.html');
    expect(r.get('/en/partie')).toBe('/en/partie/index.html');
    expect(r.get('/j/:n(\\d{1,6})')).toBe('/j/:n/index.html');
    expect(r.get('/en/j/:n(\\d{1,6})')).toBe('/en/j/:n/index.html');
    expect(JSON.stringify(vercel)).not.toMatch(/"functions"|\/api\//);
    // Mêmes réécritures dans `vite preview` (tests de bout en bout).
    expect(reecrire('/j/42', vercel.rewrites)).toBe('/j/42/index.html');
    expect(reecrire('/en/j/7', vercel.rewrites)).toBe('/en/j/7/index.html');
    expect(reecrire('/j/abc', vercel.rewrites)).toBeNull();
    expect(reecrire('/defi', vercel.rewrites)).toBe('/defi/index.html');
    expect(reecrire('/defis', vercel.rewrites)).toBeNull();
  });
});
