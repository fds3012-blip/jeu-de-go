// Ouverture animée (#406) : la décision (fonction en ligne dans index.html), le manifeste et les images de lancement.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const racine = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', racine), 'utf8');
const manifeste = JSON.parse(readFileSync(new URL('public/manifest.webmanifest', racine), 'utf8')) as { background_color: string; theme_color: string };

interface Contexte {
  webdriver: boolean; forcer: string | null; cachee: boolean; adresse: string; navigation: string | null;
  dejaVue: boolean; reduit: boolean; derniere: number; maintenant: number;
}
type Mode = 'plein' | 'court' | 'reduit' | null;
const source = html.match(/function modeOuverture\(c\) \{[\s\S]*?\n {6}\}/)?.[0];
const modeOuverture = new Function(`${source}; return modeOuverture;`)() as (c: Contexte) => Mode;

const MAINTENANT = 1_800_000_000_000;
const lancement = (c: Partial<Contexte> = {}): Mode => modeOuverture({
  webdriver: false, forcer: null, cachee: false, adresse: '', navigation: 'navigate', dejaVue: false, reduit: false,
  derniere: 0, maintenant: MAINTENANT, ...c,
});

describe('modeOuverture', () => {
  it('se trouve dans index.html', () => expect(source).toBeTruthy());

  it('premier lancement : version entière', () => expect(lancement()).toBe('plein'));

  it('réouverture moins de 10 min après : version courte ; au-delà : entière', () => {
    expect(lancement({ derniere: MAINTENANT - 5 * 60_000 })).toBe('court');
    expect(lancement({ derniere: MAINTENANT - 11 * 60_000 })).toBe('plein');
  });

  it('mouvements réduits : simple fondu', () => {
    expect(lancement({ reduit: true })).toBe('reduit');
    expect(lancement({ reduit: true, derniere: MAINTENANT - 1000 })).toBe('reduit');
  });

  it('rien sur un lien de défi ni sur un retour de connexion', () => {
    expect(lancement({ adresse: '#defi=abc123&de=Lou' })).toBeNull();
    expect(lancement({ adresse: '#access_token=x&refresh_token=y&type=magiclink' })).toBeNull();
    expect(lancement({ adresse: '#error_description=expire' })).toBeNull();
    expect(lancement({ adresse: '?code=abc' })).toBeNull();
    expect(lancement({ adresse: '?token_hash=abc&type=email' })).toBeNull();
    expect(lancement({ adresse: '?lang=en' })).toBe('plein');
  });

  it('rien sur un rechargement (« nouvelle version prête », langue, erreur) ni un retour arrière', () => {
    expect(lancement({ navigation: 'reload' })).toBeNull();
    expect(lancement({ navigation: 'back_forward' })).toBeNull();
    expect(lancement({ dejaVue: true })).toBeNull();
    expect(lancement({ dejaVue: true, reduit: true })).toBeNull();
  });

  it('rien dans un onglet caché (préchargement)', () => expect(lancement({ cachee: true })).toBeNull());

  it('tests automatisés : rien, sauf demande explicite ; « 0 » la coupe partout', () => {
    expect(lancement({ webdriver: true })).toBeNull();
    expect(lancement({ webdriver: true, forcer: '1' })).toBe('plein');
    expect(lancement({ forcer: '0' })).toBeNull();
  });
});

/** Découpe aux virgules hors parenthèses : `opacity 1s var(--a, cubic-bezier(0, 0, 1, 1)), transform 1s`. */
function virgulesDeSurface(s: string): string[] {
  const parts: string[] = [];
  let prof = 0, debut = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') prof++;
    else if (s[i] === ')') prof--;
    else if (s[i] === ',' && prof === 0) { parts.push(s.slice(debut, i)); debut = i + 1; }
  }
  return [...parts, s.slice(debut)];
}

describe('index.html', () => {
  const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';

  it("l'ouverture est décorative et peinte avant le script de l'app", () => {
    expect(html).toMatch(/<div id="ouverture" aria-hidden="true"/);
    expect(html.indexOf('id="ouverture"')).toBeLessThan(html.indexOf('src="/src/main.tsx"'));
  });

  it('les mouvements ne touchent que transform, translate et opacity', () => {
    const images = [...style.matchAll(/@keyframes [\w-]+ \{([\s\S]*?)\}\s*\}/g)].map(m => m[1]);
    expect(images.length).toBeGreaterThanOrEqual(6);
    for (const corps of images) {
      for (const [, prop] of corps.matchAll(/([a-z-]+)\s*:/g)) expect(['transform', 'translate', 'opacity']).toContain(prop);
    }
    for (const [, props] of style.matchAll(/transition:\s*([^;]+);/g)) {
      for (const p of virgulesDeSurface(props)) expect(['opacity', 'transform']).toContain(p.trim().split(/\s+/)[0]);
    }
  });

  it("l'action principale et la barre arrivent avant le contenu (aucun délai sur elles)", () => {
    for (const [, sel] of style.matchAll(/([^{}]*)\{\s*animation-delay/g)) expect(sel).toMatch(/:not\(\.cta\)/);
  });

  it('Android : le fond du manifeste est celui de la première image (sombre)', () => {
    expect(manifeste.background_color.toUpperCase()).toBe('#1C1916');
    expect(manifeste.theme_color.toUpperCase()).toBe('#1C1916');
    expect(style).toMatch(/\.ouv-debut \{[^}]*background: #1C1916/);
  });

  it('iOS : une image de lancement claire et une sombre par taille, et chaque fichier existe', () => {
    const liens = [...html.matchAll(/<link rel="apple-touch-startup-image" href="\/([^"]+)" media="([^"]+)"/g)];
    expect(liens.length).toBeGreaterThanOrEqual(12);
    expect(liens.filter(l => l[2].includes('dark')).length).toBe(liens.filter(l => l[2].includes('light')).length);
    for (const [, fichier] of liens) expect(existsSync(new URL(`public/${fichier}`, racine)), fichier).toBe(true);
  });
});
