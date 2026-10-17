// Issue #586 : la garde de outils/boucleLibre.setup.ts mesure bien un bloc synchrone, et ne compte pas le temps rendu.
import { performance } from 'node:perf_hooks';
import { LIMITE_BLOC_MS, blocEnCours, messageBloc } from './boucleLibre.setup';
import { cederLaMain } from '../src/go/preuve-par-coup';

const occuper = (ms: number) => { const fin = performance.now() + ms; while (performance.now() < fin) { /* calcul */ } };
const attendre = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('garde contre les longs blocs synchrones (#586)', () => {
  it('un calcul d’un seul bloc est mesuré en entier', () => {
    occuper(700);
    expect(blocEnCours()).toBeGreaterThanOrEqual(700);
  });

  it('le même calcul découpé, la main rendue entre deux morceaux : seul le plus long morceau compte', async () => {
    for (let i = 0; i < 4; i++) {
      occuper(200);
      await cederLaMain();
      await attendre(300); // laisse passer un tic (toutes les 250 ms)
    }
    expect(blocEnCours()).toBeLessThan(600);
  });

  it('la limite laisse une marge de deux sous le délai de Vitest (60 s), et le message dit quoi faire', () => {
    expect(LIMITE_BLOC_MS * 2).toBeLessThanOrEqual(60_000);
    expect(messageBloc(42_000, 'Ce test')).toContain('42.0 s');
    expect(messageBloc(42_000, 'Ce test')).toContain('cederLaMain');
  });
});
