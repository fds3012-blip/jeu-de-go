/// <reference types="vite/client" />
import css from './tokens.css?raw';

/** Extrait les déclarations `--nom: valeur;` du premier bloc qui suit `selector`. */
function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`Bloc introuvable : ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const body = css.slice(open + 1, close).replace(/\/\*[\s\S]*?\*\//g, '');
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}

const dark = block(':root {');
const lightAttr = block(':root[data-theme="light"]');
const lightMedia = block(':root:not([data-theme="dark"])');
const light = { ...dark, ...lightAttr };

function resolve(theme: Record<string, string>, name: string, depth = 0): string {
  const v = theme[name];
  if (v == null) throw new Error(`Token manquant : ${name}`);
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  if (ref && depth < 10) return resolve(theme, ref[1], depth + 1);
  return v;
}

function luminance(hex: string): number {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) throw new Error(`Couleur non hexadécimale : ${hex}`);
  const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Paires texte / fond utilisées par l'interface. */
const PAIRS: [string, string][] = [
  ['--text', '--bg'], ['--text', '--surface'],
  ['--muted', '--bg'], ['--muted', '--surface'],
  ['--accent-texte', '--bg'], ['--accent-texte', '--surface'],
  ['--danger-texte', '--bg'], ['--danger-texte', '--surface'],
  ['--recompense-texte', '--bg'], ['--recompense-texte', '--surface'],
  ['--on-accent', '--accent'], ['--on-accent', '--accent-press'],
  ['--on-accent', '--recompense'], ['--on-accent', '--danger'],
  ['--grille', '--kaya'], ['--grille', '--kaya-2'],
];

describe('tokens Encre & Jade', () => {
  it('calcule le contraste de référence (blanc sur noir = 21)', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
  });

  for (const [mode, theme] of [['sombre', dark], ['clair', light]] as const) {
    for (const [fg, bg] of PAIRS) {
      it(`mode ${mode} : ${fg} sur ${bg} atteint AA (4,5:1)`, () => {
        const ratio = contrast(resolve(theme, fg), resolve(theme, bg));
        expect(ratio, `${fg} sur ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('garde les couleurs de la doc Encre & Jade', () => {
    expect(dark['--encre']).toBe('#16202B');
    expect(dark['--encre-2']).toBe('#1F2C3A');
    expect(dark['--ardoise']).toBe('#2E3D4E');
    expect(dark['--papier']).toBe('#F4EFE6');
    expect(dark['--brume']).toBe('#9FB0BF');
    expect(dark['--jade']).toBe('#2EBD85');
    expect(dark['--or']).toBe('#F2B84B');
    expect(dark['--vermillon']).toBe('#E4572E');
    expect(dark['--kaya']).toBe('#DBAE62');
    expect(dark['--kaya-2']).toBe('#C99550');
    expect(resolve(light, '--bg')).toBe('#F4EFE6');
    expect(resolve(light, '--surface')).toBe('#FFFFFF');
    expect(resolve(light, '--text')).toBe('#16202B');
  });

  it('définit le mode clair de la même façon (préférence système et choix manuel)', () => {
    expect(lightMedia).toEqual(lightAttr);
  });

  it('impose des cibles tactiles de 44 px minimum', () => {
    for (const t of ['--cible-min', '--cible-bouton', '--cible-cta', '--nav-h']) {
      expect(parseFloat(resolve(dark, t)), t).toBeGreaterThanOrEqual(44);
    }
  });

  it('suit une grille d\'espacement de 4 px', () => {
    const spaces = Object.keys(dark).filter(k => k.startsWith('--space-'));
    expect(spaces.length).toBeGreaterThanOrEqual(8);
    for (const k of spaces) expect(parseFloat(dark[k]) % 4, k).toBe(0);
  });

  it('définit rayons, typographies et durées', () => {
    for (const t of ['--radius-xs', '--radius-plateau', '--radius-s', '--radius-bouton', '--radius', '--radius-pill',
      '--font-ui', '--font-titre', '--fs-s', '--fs-m', '--fs-xl', '--fs-3xl', '--duree-rapide', '--duree', '--duree-recompense']) {
      expect(dark[t], t).toBeTruthy();
    }
    expect(dark['--font-ui']).toMatch(/^"Zen Kaku Gothic New"/);
    expect(dark['--font-titre']).toMatch(/^"Shippori Mincho"/);
  });

  it('coupe les animations quand le système demande moins de mouvement', () => {
    const reduced = block('@media (prefers-reduced-motion: reduce)');
    expect(reduced).toEqual({ '--duree-rapide': '0ms', '--duree': '0ms', '--duree-recompense': '0ms' });
  });
});
