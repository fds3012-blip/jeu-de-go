// #498 : pas de fuite de tenseurs dans KataGo, ni sur N analyses, ni quand une lecture échoue (contexte GPU perdu,
// Worker mis en veille au milieu d'une analyse). Réseau factice (fakeNet.ts), TensorFlow.js sur CPU.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newPosition } from '../../go/rules';
import { fakeNetBytes } from './fakeNet';
import { features } from './features';
import { TfNet } from './net';
import { parseNet } from './parse';
import { search } from './search';

afterEach(() => { vi.restoreAllMocks(); });

describe('mémoire de KataGo (#498)', () => {
  it('numTensors stable sur 20 analyses, et après une lecture qui échoue', async () => {
    const tf = await import('@tensorflow/tfjs');
    await tf.setBackend('cpu');
    const net = new TfNet(tf, parseNet(fakeNetBytes(7)));
    // Première analyse : les poids du réseau sont mis en mémoire une fois pour toutes.
    await search(net, newPosition(9), { visits: 4 });
    const base = tf.memory().numTensors;
    for (let i = 0; i < 20; i++) await search(net, newPosition(9), { visits: 4 });
    expect(tf.memory().numTensors).toBe(base);

    // Lecture des sorties en échec : avant #498, les cinq tenseurs de sortie restaient en mémoire à chaque fois.
    const { spatial, global } = features(newPosition(9), { komi: 7 });
    for (let i = 0; i < 5; i++) {
      vi.spyOn(tf.Tensor.prototype, 'data').mockRejectedValueOnce(new Error('contexte GPU perdu'));
      await expect(net.evaluate(spatial, global, 9)).rejects.toThrow(/GPU perdu/);
      vi.restoreAllMocks();
    }
    expect(tf.memory().numTensors).toBe(base);

    net.dispose();
    expect(tf.memory().numTensors).toBeLessThan(base);
  }, 60_000);
});
