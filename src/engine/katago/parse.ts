// Lecture d'un réseau KataGo au format .bin (modèles v8 à v14, blocs ordinaires et gpool).
// Adapté de web-katrain (https://github.com/Sir-Teo/web-katrain, licence MIT, commit 8dd813a),
// fichiers src/engine/katago/binModelParser.ts et loadModelV8.ts. Voir LICENSE-web-katrain.
// Simplifié : pas d'encodeur de métadonnées (réseaux humains) ni de blocs « nested bottleneck ».

export type Activation = 'identity' | 'relu' | 'mish';
export interface BatchNorm { channels: number; scale: Float32Array; bias: Float32Array }
export interface Conv { kY: number; kX: number; inC: number; outC: number; dY: number; dX: number; w: Float32Array }
export interface MatMul { inC: number; outC: number; w: Float32Array }
export interface MatBias { channels: number; w: Float32Array }

export type Block =
  | { kind: 'ordinary'; preBN: BatchNorm; preAct: Activation; w1: Conv; midBN: BatchNorm; midAct: Activation; w2: Conv }
  | {
      kind: 'gpool'; preBN: BatchNorm; preAct: Activation; w1a: Conv; w1b: Conv; gpoolBN: BatchNorm; gpoolAct: Activation;
      w1r: MatMul; midBN: BatchNorm; midAct: Activation; w2: Conv;
    };

export interface ParsedNet {
  name: string;
  version: number;
  numInputChannels: number;
  numGlobalChannels: number;
  post: { scoreMean: number; scoreStdev: number; lead: number };
  trunk: { channels: number; conv1: Conv; ginput: MatMul; blocks: Block[]; tipBN: BatchNorm; tipAct: Activation };
  policy: { p1: Conv; g1: Conv; g1BN: BatchNorm; g1Act: Activation; gpoolToBias: MatMul; p1BN: BatchNorm; p1Act: Activation; p2: Conv; passMul: MatMul };
  value: { v1: Conv; v1BN: BatchNorm; v1Act: Activation; v2: MatMul; v2Bias: MatBias; v2Act: Activation; v3: MatMul; v3Bias: MatBias; sv3: MatMul; sv3Bias: MatBias; ownership: Conv };
}

const isSpace = (b: number) => b === 0x20 || b === 0x0a || b === 0x0d || b === 0x09;

class Reader {
  private i = 0;
  private dec = new TextDecoder('utf-8');
  constructor(private data: Uint8Array) {}
  private skip() { while (this.i < this.data.length && isSpace(this.data[this.i])) this.i++; }
  token(): string {
    this.skip();
    const s = this.i;
    while (this.i < this.data.length && !isSpace(this.data[this.i])) this.i++;
    if (this.i <= s) throw new Error('Réseau tronqué (fin de fichier inattendue)');
    return this.dec.decode(this.data.subarray(s, this.i));
  }
  int(): number {
    const t = this.token(), v = Number.parseInt(t, 10);
    if (!Number.isFinite(v)) throw new Error(`Entier invalide : ${t}`);
    return v;
  }
  float(): number {
    const t = this.token(), v = Number.parseFloat(t);
    if (!Number.isFinite(v)) throw new Error(`Réel invalide : ${t}`);
    return v;
  }
  floats(n: number): Float32Array {
    this.skip();
    const d = this.data, i = this.i;
    if (d[i] !== 0x40 || d[i + 1] !== 0x42 || d[i + 2] !== 0x49 || d[i + 3] !== 0x4e || d[i + 4] !== 0x40) throw new Error('Marqueur @BIN@ attendu');
    this.i += 5;
    const len = n * 4;
    if (this.i + len > d.length) throw new Error('Réseau tronqué (poids manquants)');
    // Copie alignée (petit-boutiste, comme le format KataGo et tous les navigateurs courants).
    const out = new Float32Array(n);
    new Uint8Array(out.buffer).set(d.subarray(this.i, this.i + len));
    this.i += len;
    return out;
  }
}

function bn(r: Reader): BatchNorm {
  r.token();
  const channels = r.int(), eps = r.float(), hasScale = r.int() !== 0, hasBias = r.int() !== 0;
  const mean = r.floats(channels), variance = r.floats(channels);
  const scale = hasScale ? r.floats(channels) : new Float32Array(channels).fill(1);
  const bias = hasBias ? r.floats(channels) : new Float32Array(channels);
  const s = new Float32Array(channels), b = new Float32Array(channels);
  for (let i = 0; i < channels; i++) { s[i] = scale[i] / Math.sqrt(variance[i] + eps); b[i] = bias[i] - s[i] * mean[i]; }
  return { channels, scale: s, bias: b };
}

function act(r: Reader, version: number): Activation {
  r.token();
  if (version < 11) return 'relu';
  const k = r.token();
  if (k === 'ACTIVATION_IDENTITY') return 'identity';
  if (k === 'ACTIVATION_RELU') return 'relu';
  if (k === 'ACTIVATION_MISH') return 'mish';
  throw new Error(`Activation inconnue : ${k}`);
}

function conv(r: Reader): Conv {
  r.token();
  const kY = r.int(), kX = r.int(), inC = r.int(), outC = r.int(), dY = r.int(), dX = r.int();
  return { kY, kX, inC, outC, dY, dX, w: r.floats(kY * kX * inC * outC) };
}

function matmul(r: Reader): MatMul {
  r.token();
  const inC = r.int(), outC = r.int();
  return { inC, outC, w: r.floats(inC * outC) };
}

function matbias(r: Reader): MatBias {
  r.token();
  const channels = r.int();
  return { channels, w: r.floats(channels) };
}

/** Lit un réseau KataGo décompressé (.bin). Lève une erreur claire si le format n'est pas pris en charge. */
export function parseNet(data: Uint8Array): ParsedNet {
  const r = new Reader(data);
  const name = r.token(), version = r.int();
  if (version < 8 || version > 14) throw new Error(`Version de réseau ${version} non prise en charge (8 à 14)`);
  const numInputChannels = r.int(), numGlobalChannels = r.int();
  if (numInputChannels !== 22 || numGlobalChannels !== 19) throw new Error(`Entrées ${numInputChannels}/${numGlobalChannels} inattendues (22/19)`);
  const post = { scoreMean: 20, scoreStdev: 20, lead: 20 };
  if (version >= 13) {
    r.float(); post.scoreMean = r.float(); post.scoreStdev = r.float(); post.lead = r.float();
    r.float(); r.float(); r.float();
  }
  r.token();
  const numBlocks = r.int(), channels = r.int();
  r.int(); r.int(); r.int(); r.int(); // mid, regular, dilated, gpool
  const conv1 = conv(r), ginput = matmul(r);
  const blocks: Block[] = [];
  for (let i = 0; i < numBlocks; i++) {
    const kind = r.token();
    r.token();
    if (kind === 'ordinary_block') {
      const preBN = bn(r), preAct = act(r, version), w1 = conv(r), midBN = bn(r), midAct = act(r, version), w2 = conv(r);
      blocks.push({ kind: 'ordinary', preBN, preAct, w1, midBN, midAct, w2 });
    } else if (kind === 'gpool_block') {
      const preBN = bn(r), preAct = act(r, version), w1a = conv(r), w1b = conv(r), gpoolBN = bn(r), gpoolAct = act(r, version);
      const w1r = matmul(r), midBN = bn(r), midAct = act(r, version), w2 = conv(r);
      blocks.push({ kind: 'gpool', preBN, preAct, w1a, w1b, gpoolBN, gpoolAct, w1r, midBN, midAct, w2 });
    } else throw new Error(`Bloc non pris en charge : ${kind}`);
  }
  const tipBN = bn(r), tipAct = act(r, version);
  r.token();
  const p1 = conv(r), g1 = conv(r), g1BN = bn(r), g1Act = act(r, version), gpoolToBias = matmul(r), p1BN = bn(r), p1Act = act(r, version);
  const p2 = conv(r), passMul = matmul(r);
  r.token();
  const v1 = conv(r), v1BN = bn(r), v1Act = act(r, version), v2 = matmul(r), v2Bias = matbias(r), v2Act = act(r, version);
  const v3 = matmul(r), v3Bias = matbias(r), sv3 = matmul(r), sv3Bias = matbias(r), ownership = conv(r);
  return {
    name, version, numInputChannels, numGlobalChannels, post,
    trunk: { channels, conv1, ginput, blocks, tipBN, tipAct },
    policy: { p1, g1, g1BN, g1Act, gpoolToBias, p1BN, p1Act, p2, passMul },
    value: { v1, v1BN, v1Act, v2, v2Bias, v2Act, v3, v3Bias, sv3, sv3Bias, ownership },
  };
}

/** Vrai si les octets commencent par l'en-tête gzip. */
export const isGzip = (d: Uint8Array) => d.length > 2 && d[0] === 0x1f && d[1] === 0x8b;

/** Décompresse un .bin.gz avec DecompressionStream (navigateurs récents, Node 18+). */
export async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  if (!isGzip(data)) return data;
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
