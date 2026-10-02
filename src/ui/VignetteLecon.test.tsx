// Vignettes des leçons (chemin v3) : une position distincte par leçon, sur la grille, sans pierres superposées.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LESSONS_FR } from '../content/lessons';
import { VignetteLecon } from './VignetteLecon';
import { MOTIFS, type Point } from './vignettes';

const cle = ([c, r]: Point) => `${c},${r}`;

describe('MOTIFS', () => {
  it('chaque leçon du contenu a sa propre position', () => {
    for (const l of LESSONS_FR) expect(MOTIFS[l.id], l.id).toBeDefined();
    const dessins = LESSONS_FR.map(l => JSON.stringify(MOTIFS[l.id]));
    expect(new Set(dessins).size).toBe(LESSONS_FR.length);
  });
  it('tout reste sur la grille 4 × 4, et deux pierres ne partagent jamais un point', () => {
    for (const [id, m] of Object.entries(MOTIFS)) {
      const tous = [...(m.noir ?? []), ...(m.blanc ?? []), ...(m.jade ?? []), ...(m.or ?? []), ...(m.hoshi ?? []), ...(m.cases?.points ?? [])];
      for (const [c, r] of tous) { expect(c, id).toBeGreaterThanOrEqual(0); expect(c, id).toBeLessThanOrEqual(3); expect(r, id).toBeGreaterThanOrEqual(0); expect(r, id).toBeLessThanOrEqual(3); }
      const pierres = [...(m.noir ?? []), ...(m.blanc ?? [])].map(cle);
      expect(new Set(pierres).size, id).toBe(pierres.length);
      // Un point à jouer (jade) ou un œil (or) est toujours un point vide.
      for (const p of [...(m.jade ?? []), ...(m.or ?? [])]) expect(pierres, `${id} ${cle(p)}`).not.toContain(cle(p));
    }
  });
  it('chaque motif a au plus 11 pierres : lisible à 44 px', () => {
    for (const [id, m] of Object.entries(MOTIFS)) expect((m.noir?.length ?? 0) + (m.blanc?.length ?? 0), id).toBeLessThanOrEqual(11);
  });
});

describe('VignetteLecon', () => {
  it('est décorative, dessine le bois et les pierres, et pâlit une leçon verrouillée', () => {
    const html = renderToStaticMarkup(<VignetteLecon id="l1" taille={56} />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-vignette="l1"');
    expect(html).toContain('width:56px');
    expect((html.match(/<circle/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(renderToStaticMarkup(<VignetteLecon id="l1" pale />)).toContain('vignette-pale');
  });
  it('une leçon inconnue reçoit une pierre seule, sans erreur', () => {
    expect(renderToStaticMarkup(<VignetteLecon id="l99" />)).toContain('<circle');
  });
});
