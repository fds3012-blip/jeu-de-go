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
  ['--text', '--bg'], ['--text', '--surface'], ['--text', '--surface-2'], ['--text', '--barre'],
  ['--muted', '--bg'], ['--muted', '--surface'], ['--muted', '--surface-2'], ['--muted', '--barre'],
  ['--accent-texte', '--bg'], ['--accent-texte', '--surface'],
  ['--danger-texte', '--bg'], ['--danger-texte', '--surface'],
  ['--vermillon', '--bg'], ['--vermillon', '--surface'],
  ['--recompense-texte', '--bg'], ['--recompense-texte', '--surface'],
  ['--on-accent', '--accent'], ['--on-accent', '--accent-press'],
  ['--on-accent', '--recompense'], ['--on-danger', '--danger'],
  ['--grille', '--kaya'], ['--grille', '--kaya-2'],
];

/** Éléments graphiques qui doivent se détacher de leur fond (WCAG 1.4.11 : 3:1). */
const GRAPHIC: [string, string][] = [
  // Le bouton en relief est dessiné par sa tranche (--accent-bord) ; les soulignés et points par --accent-trait.
  ['--accent-bord', '--bg'], ['--accent-trait', '--bg'], ['--accent-trait', '--surface'],
  ['--focus', '--bg'], ['--focus', '--surface'], ['--danger', '--bg'],
  // Barre du bas (#51) : pièce d'accent de l'icône active et point indicateur, propres à chaque onglet.
  ['--onglet-jouer', '--barre'], ['--onglet-apprendre', '--barre'], ['--onglet-problemes', '--barre'], ['--onglet-profil', '--barre'],
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

  for (const [mode, theme] of [['sombre', dark], ['clair', light]] as const) {
    for (const [fg, bg] of GRAPHIC) {
      it(`mode ${mode} : ${fg} se détache de ${bg} (3:1)`, () => {
        const ratio = contrast(resolve(theme, fg), resolve(theme, bg));
        expect(ratio, `${fg} sur ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(3);
      });
    }
  }

  it('garde les couleurs de la direction v2 (docs/design/v2/direction.md)', () => {
    expect(resolve(dark, '--bg')).toBe('#1C1916');
    expect(resolve(dark, '--surface')).toBe('#27221E');
    expect(resolve(dark, '--surface-2')).toBe('#332D28');
    expect(resolve(dark, '--line')).toBe('#3E3731');
    expect(resolve(dark, '--text')).toBe('#F3EDE3');
    expect(resolve(dark, '--muted')).toBe('#A99F92');
    expect(resolve(dark, '--accent')).toBe('#3CC48E');
    expect(resolve(dark, '--accent-bord')).toBe('#1E8A5F');
    expect(resolve(dark, '--on-accent')).toBe('#07231A');
    expect(resolve(dark, '--recompense')).toBe('#EFB84A');
    expect(resolve(dark, '--danger')).toBe('#D2432C');
    expect(dark['--hanko']).toBe('#D2432C');
    expect(dark['--or']).toBe('#EFB84A');
    expect(dark['--kaya']).toBe('#EDC27A');
    expect(dark['--kaya-2']).toBe('#C58D42');
    expect(resolve(light, '--bg')).toBe('#EFE8DC');
    expect(resolve(light, '--text')).toBe('#1C1916');
    expect(resolve(light, '--accent')).toBe('#3CC48E');
  });

  it('garde les alias v1 pour les styles en ligne des écrans', () => {
    for (const t of ['--encre', '--encre-2', '--ardoise', '--nuit', '--jade-fonce', '--vermillon']) {
      expect(() => resolve(dark, t), t).not.toThrow();
    }
  });

  it('décrit le bouton principal en relief : ombre dure de la couleur du bord', () => {
    expect(dark['--relief']).toBe('5px');
    for (const theme of [dark, light]) expect(theme['--ombre-relief']).toMatch(/^0 var\(--relief\) 0 var\(--accent-bord\)/);
    expect(parseFloat(dark['--cible-cta'])).toBeGreaterThanOrEqual(56);
    expect(dark['--radius-bouton']).toBe('16px');
  });

  it('allume un halo de lampe doré dans les deux modes', () => {
    for (const theme of [dark, light]) expect(theme['--halo']).toMatch(/^radial-gradient\(.*rgba\(239, 184, 74/);
  });

  // #465 (audit #461, point A) : le jade et l'or en texte gardent une marge (5:1) en clair, sur tous les fonds de
  // l'app, y compris le haut du halo, où l'or du halo (22 %) assombrit le papier : c'est là qu'ils tombaient à 4,5:1.
  it('garde une marge au-dessus de 4,5:1 pour le jade et l\'or en texte, en clair', () => {
    const halo = light['--halo'].match(/rgba\((\d+), (\d+), (\d+), \.(\d+)\)/)!;
    const a = Number(`0.${halo[4]}`);
    const bg = resolve(light, '--bg');
    const melange = '#' + [1, 3, 5].map((i, k) => Math.round(parseInt(bg.slice(i, i + 2), 16) * (1 - a) + Number(halo[k + 1]) * a)
      .toString(16).padStart(2, '0')).join('');
    for (const fg of ['--accent-texte', '--recompense-texte']) {
      for (const fond of [bg, melange, ...['--surface', '--surface-2', '--barre'].map(f => resolve(light, f))]) {
        const r = contrast(resolve(light, fg), fond);
        expect(r, `${fg} sur ${fond} = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(5);
      }
    }
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
    expect(dark['--font-titre']).toMatch(/^"Bricolage Grotesque"/);
    expect(dark['--font-titre']).not.toMatch(/(^|[\s,"])serif|Mincho|Georgia/);
    expect(dark['--fw-titre']).toBe('800');
    expect(dark['--tracking-titre']).toBe('-0.02em');
  });

  it('coupe les animations quand le système demande moins de mouvement', () => {
    const reduced = block('@media (prefers-reduced-motion: reduce)');
    expect(reduced).toEqual({ '--duree-rapide': '0ms', '--duree': '0ms', '--duree-recompense': '0ms', '--duree-pose': '0ms' });
  });
});
