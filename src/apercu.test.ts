// Issue #285 : aperçu riche des liens partagés (Open Graph et Twitter Card) dans index.html.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const racine = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(`${racine}index.html`, 'utf8');
const SITE = 'https://jeu-de-go.vercel.app';

/** Contenu de la balise `<meta property|name="cle" content="…">` (null si absente). */
function meta(cle: string): string | null {
  const re = new RegExp(`<meta\\s+(?:property|name)="${cle.replace(/[:.]/g, '\\$&')}"\\s+content="([^"]*)"`);
  return re.exec(html)?.[1] ?? null;
}

/** Largeur et hauteur d'un PNG, lues dans l'en-tête IHDR. */
function taillePng(chemin: string): { largeur: number; hauteur: number; octets: number } {
  const b = readFileSync(chemin);
  expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(b.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { largeur: b.readUInt32BE(16), hauteur: b.readUInt32BE(20), octets: b.length };
}

describe('aperçu des liens partagés', () => {
  test('balises Open Graph présentes, en français', () => {
    for (const cle of ['og:type', 'og:site_name', 'og:title', 'og:description', 'og:image', 'og:url', 'og:image:alt']) {
      expect(meta(cle), cle).toBeTruthy();
    }
    expect(meta('og:locale')).toBe('fr_FR');
    expect(meta('og:locale:alternate')).toBe('en_US');
    expect(meta('og:url')).toBe(`${SITE}/`);
    expect(meta('og:image:width')).toBe('1200');
    expect(meta('og:image:height')).toBe('630');
  });

  test('Twitter Card en grande image, cohérente avec Open Graph', () => {
    expect(meta('twitter:card')).toBe('summary_large_image');
    expect(meta('twitter:title')).toBe(meta('og:title'));
    expect(meta('twitter:description')).toBe(meta('og:description'));
    expect(meta('twitter:image')).toBe(meta('og:image'));
  });

  test('titre de 60 caractères au plus, description courte', () => {
    expect(meta('og:title')!.length).toBeLessThanOrEqual(60);
    expect(/<title>([^<]*)<\/title>/.exec(html)![1].length).toBeLessThanOrEqual(60);
    // Au-delà d'environ 110 caractères, WhatsApp et Messages coupent la description.
    expect(meta('og:description')!.length).toBeLessThanOrEqual(110);
  });

  test("l'image est une URL absolue du site vers un PNG 1200 × 630 de public/", () => {
    const url = meta('og:image')!;
    expect(url.startsWith(`${SITE}/`)).toBe(true);
    const fichier = `${racine}public${new URL(url).pathname}`;
    const { largeur, hauteur, octets } = taillePng(fichier);
    expect({ largeur, hauteur }).toEqual({ largeur: 1200, hauteur: 630 });
    // WhatsApp ignore les images d'aperçu trop lourdes (au-delà d'environ 300 Ko, l'image peut sauter).
    expect(octets).toBeLessThan(300 * 1024);
  });
});
