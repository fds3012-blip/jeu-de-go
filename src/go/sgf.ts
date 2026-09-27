import { fromSgf, toSgf } from './coords';

export interface GameRecord {
  size: number;
  komi: number;
  rules: 'japanese' | 'chinese';
  black?: string;
  white?: string;
  result?: string;
  setupBlack: number[];
  setupWhite: number[];
  moves: { color: 1 | 2; p: number }[];
}

const esc = (s: string) => s.replace(/([\]\\])/g, '\\$1');

export function writeSgf(g: GameRecord): string {
  let s = `(;GM[1]FF[4]CA[UTF-8]SZ[${g.size}]KM[${g.komi}]RU[${g.rules === 'chinese' ? 'Chinese' : 'Japanese'}]`;
  if (g.black) s += `PB[${esc(g.black)}]`;
  if (g.white) s += `PW[${esc(g.white)}]`;
  if (g.result) s += `RE[${esc(g.result)}]`;
  if (g.setupBlack.length) s += 'AB' + g.setupBlack.map(p => `[${toSgf(p, g.size)}]`).join('');
  if (g.setupWhite.length) s += 'AW' + g.setupWhite.map(p => `[${toSgf(p, g.size)}]`).join('');
  for (const m of g.moves) s += `;${m.color === 1 ? 'B' : 'W'}[${m.p < 0 ? '' : toSgf(m.p, g.size)}]`;
  return s + ')';
}

/** Lit la ligne principale d'un SGF (les variantes sont ignorées). */
export function readSgf(text: string): GameRecord {
  const t = text.trim();
  if (!t.startsWith('(')) throw new Error('Ce texte ne ressemble pas à un fichier SGF.');
  const nodes: Record<string, string[]>[] = [];
  const done: boolean[] = [];
  let i = 0, depth = 0, skip = 0;
  let cur: Record<string, string[]> | null = null;
  const readValue = () => {
    let v = '';
    i++;
    while (i < t.length && t[i] !== ']') { if (t[i] === '\\') i++; v += t[i]; i++; }
    i++;
    return v;
  };
  while (i < t.length) {
    const ch = t[i];
    if (skip) {
      if (ch === '[') { readValue(); continue; }
      if (ch === '(') skip++; else if (ch === ')') skip--;
      i++; continue;
    }
    if (ch === '(') { depth++; if (done[depth]) { skip = 1; depth--; } i++; continue; }
    if (ch === ')') { done[depth] = true; depth--; i++; continue; }
    if (ch === ';') { cur = {}; nodes.push(cur); i++; continue; }
    if (/[A-Za-z]/.test(ch)) {
      let id = '';
      while (i < t.length && /[A-Za-z]/.test(t[i])) { if (/[A-Z]/.test(t[i])) id += t[i]; i++; }
      while (/\s/.test(t[i] ?? '')) i++;
      const values: string[] = [];
      while (t[i] === '[') { values.push(readValue()); while (/\s/.test(t[i] ?? '')) i++; }
      if (cur) cur[id] = (cur[id] ?? []).concat(values);
      continue;
    }
    i++;
  }
  if (!nodes.length) throw new Error('Aucun nœud trouvé.');
  const root = nodes[0];
  const size = Number((root.SZ?.[0] ?? '19').split(':')[0]);
  if (![9, 13, 19].includes(size)) throw new Error(`Plateau ${size} × ${size} non pris en charge.`);
  const komi = Number(root.KM?.[0] ?? '6.5');
  const ru = (root.RU?.[0] ?? '').toLowerCase();
  const list = (k: string) => (root[k] ?? []).map(v => fromSgf(v, size)).filter(p => p >= 0);
  const moves: GameRecord['moves'] = [];
  for (const n of nodes.slice(1)) {
    if (n.B) moves.push({ color: 1, p: fromSgf(n.B[0], size) });
    else if (n.W) moves.push({ color: 2, p: fromSgf(n.W[0], size) });
  }
  return {
    size, komi: Number.isFinite(komi) ? komi : 6.5,
    rules: /chin|aga|area|tromp/.test(ru) ? 'chinese' : 'japanese',
    black: root.PB?.[0], white: root.PW?.[0], result: root.RE?.[0],
    setupBlack: list('AB'), setupWhite: list('AW'), moves
  };
}
