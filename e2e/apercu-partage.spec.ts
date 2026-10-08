import { expect, test, type APIRequestContext } from '@playwright/test';
import { numeroAu } from '../outils/apercus';

// #489 : avant de partager mochi-go.app à grande échelle (WhatsApp, Messenger, SMS, iMessage, Discord, X, Facebook,
// LinkedIn). Ces robots lisent le HTML servi, sans exécuter le JS : on lit donc la réponse brute de chaque page
// partageable, servie comme sur Vercel (réécritures de vercel.json appliquées par `vite preview`), et on vérifie que
// les balises Open Graph et Twitter Card sont complètes, cohérentes entre elles, et que l'image tient les limites.

const SITE = 'https://mochi-go.app';
const n = numeroAu(new Date());

/** Pages partageables : [chemin servi, langue, og:url attendue (sans le site), image]. */
const PAGES: readonly (readonly [string, 'fr' | 'en', string, string])[] = [
  ['/', 'fr', '/', 'apercu-accueil.png'],
  ['/en', 'en', '/en', 'apercu-accueil-en.png'],
  ['/defi', 'fr', '/defi', 'apercu-defi.png'],
  ['/en/defi', 'en', '/en/defi', 'apercu-defi-en.png'],
  // Partie partagée et étude partagée (#449) : le même lien `/partie#JETON`.
  ['/partie', 'fr', '/partie', 'apercu-partie.png'],
  ['/en/partie', 'en', '/en/partie', 'apercu-partie-en.png'],
  [`/j/${n}`, 'fr', `/j/${n}`, 'apercu.png'],
  [`/en/j/${n}`, 'en', `/en/j/${n}`, 'apercu-en.png'],
  ['/apprendre-le-go', 'fr', '/apprendre-le-go', 'apercu-accueil.png'],
  ['/regles-du-go', 'fr', '/regles-du-go', 'apercu-accueil.png'],
  ['/en/learn-go', 'en', '/en/learn-go', 'apercu-accueil-en.png'],
  ['/en/go-rules', 'en', '/en/go-rules', 'apercu-accueil-en.png'],
  // La page de confidentialité est l'app : l'aperçu de l'accueil.
  ['/confidentialite', 'fr', '/', 'apercu-accueil.png'],
];

/** Toutes les balises `<meta property|name="…" content="…">` d'une page (valeurs multiples gardées). */
function metas(html: string): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const [balise] of html.matchAll(/<meta\b[^>]*>/g)) {
    const cle = /\b(?:property|name)="([^"]+)"/.exec(balise)?.[1];
    const valeur = /\bcontent="([^"]*)"/.exec(balise)?.[1];
    if (cle && valeur !== undefined) m.set(cle, [...(m.get(cle) ?? []), valeur]);
  }
  return m;
}

const images = new Map<string, Promise<{ largeur: number; hauteur: number; octets: number; type: string }>>();
function image(request: APIRequestContext, nom: string) {
  if (!images.has(nom)) {
    images.set(nom, (async () => {
      const rep = await request.get(`/${nom}`);
      expect(rep.status(), nom).toBe(200);
      const b = await rep.body();
      expect(b.subarray(0, 8).toString('hex'), nom).toBe('89504e470d0a1a0a');
      return { largeur: b.readUInt32BE(16), hauteur: b.readUInt32BE(20), octets: b.length, type: rep.headers()['content-type'] ?? '' };
    })());
  }
  return images.get(nom)!;
}

for (const [chemin, langue, ogUrl, nomImage] of PAGES) {
  test(`aperçu du lien ${chemin} : balises complètes et cohérentes, image 1200 × 630 légère`, async ({ request }) => {
    const rep = await request.get(chemin);
    expect(rep.status()).toBe(200);
    const html = await rep.text();
    const m = metas(html);
    const un = (cle: string) => {
      const v = m.get(cle);
      expect(v, cle).toHaveLength(1);
      return v![0];
    };

    expect(html).toContain(`<html lang="${langue}">`);
    expect(un('og:type')).toBe('website');
    expect(un('og:site_name')).toBe('Mochi Go');
    expect(un('og:url')).toBe(`${SITE}${ogUrl}`);
    expect(un('og:locale')).toBe(langue === 'fr' ? 'fr_FR' : 'en_US');
    expect(un('og:locale:alternate')).toBe(langue === 'fr' ? 'en_US' : 'fr_FR');

    const titre = un('og:title');
    const description = un('og:description');
    expect(titre.length, titre).toBeGreaterThan(10);
    expect(titre.length, titre).toBeLessThanOrEqual(60);
    expect(description.length, description).toBeGreaterThan(30);
    // Au-delà d'environ 110 caractères, WhatsApp et Messages coupent la description.
    expect(description.length, description).toBeLessThanOrEqual(110);

    expect(un('og:image')).toBe(`${SITE}/${nomImage}`);
    expect(un('og:image:type')).toBe('image/png');
    expect(un('og:image:width')).toBe('1200');
    expect(un('og:image:height')).toBe('630');
    expect(un('og:image:alt').length).toBeGreaterThan(20);

    expect(un('twitter:card')).toBe('summary_large_image');
    expect(un('twitter:title')).toBe(titre);
    expect(un('twitter:description')).toBe(description);
    expect(un('twitter:image')).toBe(un('og:image'));
    expect(un('twitter:image:alt')).toBe(un('og:image:alt'));

    // Couleur de la barre du navigateur, en clair et en sombre.
    expect(m.get('theme-color')?.sort()).toEqual(['#1C1916', '#EFE8DC']);

    // Langue cohérente : aucun texte d'aperçu français sur une page anglaise, et inversement.
    const accents = /[àâçéèêëîïôûùœ]|\b(?:le|la|les|ton|ta|tu|te|une?|et)\b/i;
    if (langue === 'en') expect(`${titre} ${description}`).not.toMatch(accents);
    else expect(`${titre} ${description}`).toMatch(accents);

    // L'image : servie par le site, PNG 1200 × 630, sous 300 Ko (WhatsApp ignore les images plus lourdes).
    const img = await image(request, nomImage);
    expect(img.type).toContain('image/png');
    expect({ largeur: img.largeur, hauteur: img.hauteur }).toEqual({ largeur: 1200, hauteur: 630 });
    expect(img.octets).toBeLessThan(300 * 1024);

    // Indexation : l'accueil et les pages de référencement oui (canonique vers elles-mêmes), les pages d'aperçu non.
    const canonique = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1] ?? null;
    if (m.has('robots')) {
      expect(un('robots')).toBe('noindex');
      expect(canonique).toBeNull();
    } else {
      expect(canonique).toBe(`${SITE}${ogUrl}`);
    }
  });
}
