import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { fromLabel } from '../go/coords';
import { Board } from './Board';
import { viewBoxOf } from './boardArt';
import { estSerre, Visee } from './Visee';

describe('visée du plateau serré (#400)', () => {
  it('seulement à partir du 13 × 13 : le 9 × 9 garde son comportement', () => {
    expect(estSerre(9)).toBe(false);
    expect(estSerre(13)).toBe(true);
    expect(estSerre(19)).toBe(true);
  });

  it('trace la ligne et la colonne du point, et allume sa lettre et son numéro au bord', () => {
    const html = renderToStaticMarkup(<svg><Visee p={fromLabel('D10', 13)} size={13} /></svg>);
    expect(html).toContain('data-visee="D10"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('pointer-events="none"');
    expect(html).toMatch(/>D<\/text>/);
    expect(html).toMatch(/>10<\/text>/);
  });

  it('les pastilles restent dans le bois, même au bord haut gauche (A13) et en 19 × 19', () => {
    for (const [label, size] of [['A13', 13], ['A19', 19], ['T1', 19]] as const) {
      const { min, span } = viewBoxOf(size);
      const html = renderToStaticMarkup(<svg><Visee p={fromLabel(label, size)} size={size} /></svg>);
      const rects = [...html.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map(m => m.slice(1).map(Number));
      expect(rects).toHaveLength(2);
      for (const [x, y, w, h] of rects) {
        expect(x).toBeGreaterThanOrEqual(min);
        expect(y).toBeGreaterThanOrEqual(min);
        expect(x + w).toBeLessThanOrEqual(min + span);
        expect(y + h).toBeLessThanOrEqual(min + span);
      }
    }
  });

  it('Board ne la dessine que sous une pierre fantôme', () => {
    const vide = new Int8Array(169);
    const html = renderToStaticMarkup(<Board size={13} board={vide} interactive onPlay={() => {}} surFantome={p => <Visee p={p} size={13} />} />);
    expect(html).not.toContain('data-visee');
  });
});
