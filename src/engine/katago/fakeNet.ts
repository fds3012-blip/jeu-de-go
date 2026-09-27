// Petit réseau KataGo factice au format .bin (modèle v8), pour les tests : même structure que
// g170-b6c96 (bloc ordinaire, bloc gpool, têtes politique et valeur), mais quelques canaux seulement.

export function fakeNetBytes(seed = 1, name = 'factice-b2c4'): Uint8Array {
  let s = seed | 0 || 1;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296 - 0.5) * 0.2; };
  const enc = new TextEncoder(), parts: Uint8Array[] = [];
  const txt = (...t: (string | number)[]) => parts.push(enc.encode(t.join(' ') + '\n'));
  const bin = (n: number, f: () => number = rnd) => {
    const a = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = f();
    parts.push(enc.encode('@BIN@'), new Uint8Array(a.buffer), enc.encode('\n'));
  };
  const conv = (k: number, i: number, o: number) => { txt('conv', k, k, i, o, 1, 1); bin(k * k * i * o); };
  const mm = (i: number, o: number) => { txt('mm', i, o); bin(i * o); };
  const bias = (c: number) => { txt('bias', c); bin(c); };
  const bn = (c: number) => { txt('bn', c, 0.001, 1, 1); bin(c); bin(c, () => 1); bin(c, () => 1); bin(c); };
  const act = () => txt('act');
  const C = 4, G = 2, R = 2, P1 = 2, G1 = 2, V1 = 2, V2 = 3;
  txt(name, 8, 22, 19);
  txt('trunk', 2, C, C, R, 0, G);
  conv(3, 22, C); mm(19, C);
  txt('ordinary_block', 'b0'); bn(C); act(); conv(3, C, C); bn(C); act(); conv(3, C, C);
  txt('gpool_block', 'b1'); bn(C); act(); conv(3, C, R); conv(3, C, G); bn(G); act(); mm(3 * G, R); bn(R); act(); conv(3, R, C);
  bn(C); act();
  txt('policyhead'); conv(1, C, P1); conv(1, C, G1); bn(G1); act(); mm(3 * G1, P1); bn(P1); act(); conv(1, P1, 1); mm(3 * G1, 1);
  txt('valuehead'); conv(1, C, V1); bn(V1); act(); mm(3 * V1, V2); bias(V2); act(); mm(V2, 3); bias(3); mm(V2, 4); bias(4); conv(1, V1, 1);
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
