// Conseil de Mochi (#80) : l'analyse KataGo passée à `conseil()`. Jamais de téléchargement, deux recherches courtes.
import { afterEach, describe, expect, it } from 'vitest';
import { analyseConseil, setKataGo, type Analysis, type KataGoBackend } from './index';
import { conseil, phraseConseil } from './conseil';
import { fromLabel } from '../go/coords';
import { newPosition, type Position } from '../go/rules';

function faux(state: 'pret' | 'chargement', repondre: (pos: Position) => Partial<Analysis>) {
  const vus: { toPlay: number; visits?: number; timeMs?: number }[] = [];
  const k: KataGoBackend = {
    info: { state } as KataGoBackend['info'],
    async analyze(pos, o): Promise<Analysis> {
      vus.push({ toPlay: pos.toPlay, visits: o.visits, timeMs: o.timeMs });
      return { moves: [], winrate: 0.5, lead: 0, ownership: new Float32Array(pos.size * pos.size), visits: 1, ms: 1, engine: 'faux', ...repondre(pos) };
    },
  };
  return { k, vus };
}
const coup = (l: string) => ({ move: fromLabel(l, 9), visits: 10, prior: 0.2, winrate: 0.5, lead: 1, scoreLoss: 0 });

describe('analyseConseil', () => {
  afterEach(() => setKataGo(undefined));

  it('sans KataGo prêt : null, sans rien analyser (les règles seules répondent)', async () => {
    const { k, vus } = faux('chargement', () => ({}));
    setKataGo(k);
    expect(await analyseConseil(newPosition(9), 6.5)).toBeNull();
    setKataGo(null);
    expect(await analyseConseil(newPosition(9), 6.5)).toBeNull();
    expect(vus).toEqual([]);
  });

  it('KataGo prêt : la position, puis la même avec l’adversaire au trait ; budget court (moins de 2 s en tout)', async () => {
    const { k, vus } = faux('pret', pos => (pos.toPlay === 1 ? { moves: [coup('C3'), coup('G7')] } : { moves: [coup('G3')] }));
    setKataGo(k);
    const a = await analyseConseil(newPosition(9), 6.5);
    expect(vus.map(v => v.toPlay)).toEqual([1, 2]);
    expect(vus.reduce((s, v) => s + (v.timeMs ?? 0), 0)).toBeLessThanOrEqual(1600);
    expect(a?.coups).toEqual([fromLabel('C3', 9), fromLabel('G7', 9)]);
    expect(a?.menace).toBe(fromLabel('G3', 9));
    // Branchée sur conseil() : le meilleur coup de KataGo est dans un coin vide.
    const c = conseil(newPosition(9), a!);
    expect(c?.modele).toBe('grand-coup');
    expect(phraseConseil(c!, 9, 'fr')).toBe('Le plus grand coup est dans le coin en bas à gauche, encore vide.');
    expect(phraseConseil(c!, 9, 'en')).toBe('The biggest move is in the empty bottom-left corner.');
  });

  it('une erreur de KataGo : null (pas de phrase au hasard)', async () => {
    setKataGo({ info: { state: 'pret' } as KataGoBackend['info'], analyze: async () => { throw new Error('perdu'); } });
    expect(await analyseConseil(newPosition(9), 6.5)).toBeNull();
  });
});
