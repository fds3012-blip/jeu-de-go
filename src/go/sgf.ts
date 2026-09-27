import { fromSgf, toSgf } from './coords';

export interface GameRecord {
  size: number;
  komi: number;
  rules: 'japanese' | 'chinese';
  black?: string;
  white?: string;
  result?: string;
  handicap?: number; // propriété HA (informative, les pierres sont dans setupBlack)
  toPlay?: 1 | 2; // propriété PL : qui joue le premier coup
  setupBlack: number[];
  setupWhite: number[];
  moves: { color: 1 | 2; p: number }[]; // p = -1 pour une passe
}

const esc = (s: string) => s.replace(/([\]\\])/g, '\\$1');

/** Écrit la partie en SGF (FF[4]). Les passes sont notées `tt`, comme dans le reste du projet. */
export function writeSgf(g: GameRecord): string {
  let s = `(;GM[1]FF[4]CA[UTF-8]SZ[${g.size}]KM[${g.komi}]RU[${g.rules === 'chinese' ? 'Chinese' : 'Japanese'}]`;
  if (g.handicap) s += `HA[${g.handicap}]`;
  if (g.black) s += `PB[${esc(g.black)}]`;
  if (g.white) s += `PW[${esc(g.white)}]`;
  if (g.result) s += `RE[${esc(g.result)}]`;
  if (g.setupBlack.length) s += 'AB' + g.setupBlack.map(p => `[${toSgf(p, g.size)}]`).join('');
  if (g.setupWhite.length) s += 'AW' + g.setupWhite.map(p => `[${toSgf(p, g.size)}]`).join('');
  if (g.toPlay) s += `PL[${g.toPlay === 1 ? 'B' : 'W'}]`;
  for (const m of g.moves) s += `;${m.color === 1 ? 'B' : 'W'}[${toSgf(m.p, g.size)}]`;
  return s + ')';
}

/** Coup SGF vers index : `[]` et `[tt]` sont des passes (plateaux jusqu'à 19 × 19) ; une coordonnée hors plateau est refusée. */
function readMove(v: string, size: number): number {
  if (v === '' || v === 'tt') return -1;
  const p = v.length === 2 ? fromSgf(v, size) : -1;
  if (p < 0) throw new Error(`Coup SGF invalide : [${v}]`);
  return p;
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
    while (i < t.length && t[i] !== ']') {
      if (t[i] === '\\') { i++; if (t[i] === '\n' || t[i] === '\r') { i++; continue; } } // saut de ligne « doux »
      v += t[i]; i++;
    }
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
  const ha = Number(root.HA?.[0] ?? '0');
  const ru = (root.RU?.[0] ?? '').toLowerCase();
  const pl = root.PL?.[0]?.toUpperCase();
  const list = (k: string) => (root[k] ?? []).map(v => fromSgf(v, size)).filter(p => p >= 0);
  const moves: GameRecord['moves'] = [];
  for (const n of nodes) {
    if (n.B) moves.push({ color: 1, p: readMove(n.B[0], size) });
    else if (n.W) moves.push({ color: 2, p: readMove(n.W[0], size) });
  }
  return {
    size, komi: Number.isFinite(komi) ? komi : 6.5,
    rules: /chin|aga|area|tromp|nz|new zealand/.test(ru) ? 'chinese' : 'japanese',
    black: root.PB?.[0], white: root.PW?.[0], result: root.RE?.[0],
    ...(ha > 0 ? { handicap: ha } : {}),
    ...(pl === 'B' ? { toPlay: 1 as const } : pl === 'W' ? { toPlay: 2 as const } : {}),
    setupBlack: list('AB'), setupWhite: list('AW'), moves
  };
}
