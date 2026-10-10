// #509, lot L4 : accueil et premier lancement. Barre de niveau en jauge (transform), portrait de la vedette
// immobile à l'ouverture de la feuille, mot « kyu » expliqué. Rendu statique (node, sans DOM).
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { BarreNiveau } from './Niveau';
import { CarrouselAdversaires } from './Carrousel';
import { traduire } from '../content/i18n/secondaires';

const css = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

afterEach(() => { vi.unstubAllGlobals(); });

describe('barre de niveau (n° 16)', () => {
  it('la part faite passe par une variable CSS, sans largeur ni position en ligne', () => {
    vi.stubGlobal('localStorage', { getItem: () => '40', setItem: () => {} });
    const html = renderToStaticMarkup(<BarreNiveau />);
    expect(html).toMatch(/--p:0\.\d+/);
    expect(html).not.toMatch(/width:|left:/);
    expect(html).toContain('niveau-rail');
  });

  it('anime transform seulement, et rien avec les mouvements réduits', () => {
    const s = css('./niveau.css');
    expect(s).not.toMatch(/transition:\s*(width|left)/);
    expect(s).toMatch(/\.niveau-plein\s*\{[^}]*transform:\s*scaleX\(var\(--p/);
    expect(s).toMatch(/\.niveau-rail\s*\{[^}]*transform:\s*translateX\(/);
    // La seule transition de la jauge est dans le bloc « no-preference ».
    const bloc = s.match(/@media \(prefers-reduced-motion: no-preference\)\s*\{\s*\.niveau-plein, \.niveau-rail\s*\{[^}]*\}/);
    expect(bloc?.[0]).toMatch(/transition:\s*transform/);
    expect(s.replace(bloc?.[0] ?? '', '')).not.toMatch(/\.niveau-(plein|rail|pierre)[^{]*\{[^}]*transition/);
  });

  it('pierre de 10 px, sans liseré or', () => {
    const regle = css('./niveau.css').match(/\.niveau-pierre\s*\{[^}]*\}/)?.[0] ?? '';
    expect(regle).toMatch(/width:\s*10px/);
    expect(regle).not.toContain('--recompense');
  });
});

describe('portrait de la vedette (n° 22)', () => {
  const cartes = [{ id: 'pomme' as const, nom: 'Pomme', rang: '20 kyu', battu: false, ouvert: true }];

  it('à l’ouverture de la feuille, pas de `data-nouveau` : le portrait ne bouge pas', () => {
    const html = renderToStaticMarkup(<CarrouselAdversaires cartes={cartes} choisi="pomme" onChoisir={() => {}} />);
    expect(html).toContain('choix-vedette');
    expect(html).not.toContain('data-nouveau');
  });

  it('l’entrée n’existe que sous `[data-nouveau]`, et seulement sans mouvements réduits', () => {
    const s = css('./accueil.css');
    const regles = [...s.matchAll(/([^{}]*)\{[^{}]*animation:\s*vedette-entree/g)].map(m => m[1].trim());
    expect(regles).toEqual(['.choix-vedette[data-nouveau] .vedette-portrait']);
    expect(s).toMatch(/@media \(prefers-reduced-motion: no-preference\)\s*\{\s*\.choix-vedette\[data-nouveau\]/);
  });
});

describe('le mot « kyu » expliqué (n° 10)', () => {
  it('français : grade, sens du nombre, tutoiement ; anglais : même idée', () => {
    const fr = traduire('fr', 'accueil.kyu');
    expect(fr).toMatch(/kyu/);
    expect(fr).toMatch(/grade/);
    expect(fr).toMatch(/plus le nombre est petit/);
    expect(fr).toMatch(/\bton\b/);
    expect(fr).not.toMatch(/niveau/); // « niveau » est réservé à la progression en XP (docs/design/vocabulaire.md).
    expect(traduire('en', 'accueil.kyu')).toMatch(/^Kyu is a Go rank: the smaller the number, the stronger/);
  });
});

describe('bandeau de consentement en 320 × 568 (n° 12)', () => {
  it('tant que le bandeau est ouvert, le plancher du goban d’accueil descend (mesuré en e2e : premier-ecran.spec.ts)', () => {
    expect(css('./accueil.css')).toMatch(/html:has\(\.accord\[open\]\) \.scene\s*\{\s*min-height:\s*120px/);
  });
});
