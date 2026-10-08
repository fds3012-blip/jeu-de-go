// Évaluation d'un réseau KataGo avec TensorFlow.js (NHWC, taille du plateau quelconque).
// Adapté de web-katrain (https://github.com/Sir-Teo/web-katrain, licence MIT, commit 8dd813a),
// fichiers src/engine/katago/modelV8.ts et evalV8.ts. Voir LICENSE-web-katrain.
// TensorFlow.js est injecté (import dynamique dans le Worker) pour rester hors du bundle principal.
import type * as TF from '@tensorflow/tfjs';
import type { Activation, BatchNorm, Block, Conv, MatMul, ParsedNet } from './parse';

export type Tf = typeof TF;

/** Sortie brute d'une évaluation, du point de vue du joueur au trait. */
export interface NetOutput {
  policy: Float32Array; // logits, N*N points puis la passe (N*N + 1 valeurs)
  value: [number, number, number]; // logits victoire, défaite, sans résultat
  score: Float32Array; // scoreMean, scoreStdev (avant softplus), lead, ...
  ownership: Float32Array; // logits de propriété (N*N), avant tanh
}

/** Ce dont la recherche a besoin : un réseau factice suffit dans les tests. */
export interface Evaluator {
  readonly name: string;
  /** Multiplicateurs de score du réseau (20 pour les réseaux g170). */
  readonly post?: { scoreMean: number; scoreStdev: number; lead: number };
  evaluate(spatial: Float32Array, global: Float32Array, size: number): Promise<NetOutput>;
  dispose?(): void;
}

export class TfNet implements Evaluator {
  readonly name: string;
  readonly post: ParsedNet['post'];
  private tensors: TF.Tensor[] = [];
  private p: ParsedNet;
  private cache = new Map<object, TF.Tensor>();

  constructor(private tf: Tf, parsed: ParsedNet) {
    this.name = parsed.name;
    this.p = parsed;
    this.post = parsed.post;
  }

  private t(key: Conv | MatMul | Float32Array, make: () => TF.Tensor): TF.Tensor {
    let v = this.cache.get(key);
    if (!v) { v = this.tf.tidy(make); this.tf.keep(v); this.cache.set(key, v); this.tensors.push(v); }
    return v;
  }
  private conv(x: TF.Tensor4D, c: Conv): TF.Tensor4D {
    const f = this.t(c, () => this.tf.tensor4d(c.w, [c.kY, c.kX, c.inC, c.outC])) as TF.Tensor4D;
    return this.tf.conv2d(x, f, 1, 'same', 'NHWC', [c.dY, c.dX]);
  }
  private mm(x: TF.Tensor2D, m: MatMul): TF.Tensor2D {
    return this.tf.matMul(x, this.t(m, () => this.tf.tensor2d(m.w, [m.inC, m.outC])) as TF.Tensor2D);
  }
  private vec(v: Float32Array, shape: number[]): TF.Tensor { return this.t(v, () => this.tf.tensor(v, shape)); }
  private act<T extends TF.Tensor>(x: T, a: Activation): T {
    if (a === 'identity') return x;
    if (a === 'relu') return this.tf.relu(x);
    return this.tf.mul(x, this.tf.tanh(this.tf.softplus(x)));
  }
  private bnAct(x: TF.Tensor4D, b: BatchNorm, a: Activation): TF.Tensor4D {
    const s = this.vec(b.scale, [1, 1, 1, b.channels]), o = this.vec(b.bias, [1, 1, 1, b.channels]);
    return this.act(this.tf.add(this.tf.mul(x, s), o) as TF.Tensor4D, a);
  }
  private gpool(x: TF.Tensor4D): TF.Tensor2D {
    const f = ((x.shape[1] ?? 19) - 14) * 0.1, mean = this.tf.mean(x, [1, 2]) as TF.Tensor2D;
    return this.tf.concat([mean, mean.mul(f), this.tf.max(x, [1, 2]) as TF.Tensor2D], 1) as TF.Tensor2D;
  }
  private vpool(x: TF.Tensor4D): TF.Tensor2D {
    const base = (x.shape[1] ?? 19) - 14, mean = this.tf.mean(x, [1, 2]) as TF.Tensor2D;
    return this.tf.concat([mean, mean.mul(base * 0.1), mean.mul(base * base * 0.01 - 0.1)], 1) as TF.Tensor2D;
  }
  private addBias(x: TF.Tensor4D, b: TF.Tensor2D): TF.Tensor4D {
    return x.add(b.reshape([b.shape[0], 1, 1, b.shape[1]]));
  }
  private block(x: TF.Tensor4D, b: Block): TF.Tensor4D {
    const a = this.bnAct(x, b.preBN, b.preAct);
    if (b.kind === 'ordinary') return x.add(this.conv(this.bnAct(this.conv(a, b.w1), b.midBN, b.midAct), b.w2));
    let reg = this.conv(a, b.w1a);
    const g = this.bnAct(this.conv(a, b.w1b), b.gpoolBN, b.gpoolAct);
    reg = this.addBias(reg, this.mm(this.gpool(g), b.w1r));
    return x.add(this.conv(this.bnAct(reg, b.midBN, b.midAct), b.w2));
  }

  async evaluate(spatial: Float32Array, global: Float32Array, size: number): Promise<NetOutput> {
    const tf = this.tf, { trunk, policy: P, value: V } = this.p;
    const out = tf.tidy(() => {
      const sp = tf.tensor4d(spatial, [1, size, size, 22]), gl = tf.tensor2d(global, [1, 19]);
      let x = this.addBias(this.conv(sp, trunk.conv1), this.mm(gl, trunk.ginput));
      for (const b of trunk.blocks) x = this.block(x, b);
      x = this.bnAct(x, trunk.tipBN, trunk.tipAct);
      const g1 = this.bnAct(this.conv(x, P.g1), P.g1BN, P.g1Act), g1c = this.gpool(g1);
      const p1 = this.bnAct(this.addBias(this.conv(x, P.p1), this.mm(g1c, P.gpoolToBias)), P.p1BN, P.p1Act);
      const pol = this.conv(p1, P.p2), pass = this.mm(g1c, P.passMul);
      const v1 = this.bnAct(this.conv(x, V.v1), V.v1BN, V.v1Act);
      const v2 = this.act(this.mm(this.vpool(v1), V.v2).add(this.vec(V.v2Bias.w, [1, V.v2Bias.channels])) as TF.Tensor2D, V.v2Act);
      const val = this.mm(v2, V.v3).add(this.vec(V.v3Bias.w, [1, V.v3Bias.channels]));
      const sc = this.mm(v2, V.sv3).add(this.vec(V.sv3Bias.w, [1, V.sv3Bias.channels]));
      const own = this.conv(v1, V.ownership);
      return { pol, pass, val, sc, own };
    });
    // #498 : tenseurs libérés même si une lecture échoue (contexte GPU perdu, Worker en veille). Avant, chaque échec
    // laissait les cinq sorties en mémoire du GPU.
    let lus: TF.TypedArray[];
    try {
      lus = await Promise.all([out.pol.data<'float32'>(), out.pass.data<'float32'>(), out.val.data<'float32'>(), out.sc.data<'float32'>(), out.own.data<'float32'>()]);
    } finally {
      tf.dispose([out.pol, out.pass, out.val, out.sc, out.own]);
    }
    const [pol, pass, val, sc, own] = lus;
    const n = size * size, ch = P.p2.outC, policy = new Float32Array(n + 1);
    // Plusieurs canaux de politique (réseaux récents) : on garde le premier, la politique principale.
    for (let i = 0; i < n; i++) policy[i] = pol[i * ch];
    policy[n] = pass[0];
    return { policy, value: [val[0], val[1], val[2]], score: Float32Array.from(sc), ownership: Float32Array.from(own) };
  }

  dispose() { this.tf.dispose(this.tensors); this.tensors = []; this.cache.clear(); }
}

const softplus = (x: number) => (x > 20 ? x : Math.log1p(Math.exp(x)));

/** Probabilité de victoire et avance au score, pour le joueur au trait (evalV8 de web-katrain, simplifié). */
export function postprocess(o: NetOutput, post = { scoreMean: 20, scoreStdev: 20, lead: 20 }) {
  const m = Math.max(...o.value), w = Math.exp(o.value[0] - m), l = Math.exp(o.value[1] - m), nr = Math.exp(o.value[2] - m), s = w + l + nr;
  const noResult = nr / s;
  return {
    winrate: w / (w + l || 1),
    scoreMean: o.score[0] * post.scoreMean * (1 - noResult),
    scoreStdev: softplus(o.score[1] ?? 0) * post.scoreStdev,
    lead: (o.score[2] ?? o.score[0]) * post.lead * (1 - noResult),
  };
}
