// Import d'une partie jouée ailleurs (OGS, Fox, KGS…) pour la revue (issue #286). Logique pure, testée dans importSgf.test.ts.
// Lecture tolérante de la branche principale (readSgf), puis chaque coup est validé par replay. Le SGF gardé est
// réécrit par writeSgf : seuls les coups, la taille, le komi, le handicap, les noms et le résultat survivent
// (commentaires, variantes et propriétés inconnues disparaissent ; rien du fichier n'est exécuté ni affiché tel quel).
import { readSgf, writeSgf, type GameRecord } from './sgf';
import { replay } from './replay';

/** Taille maximale du fichier : un SGF de 400 coups avec commentaires tient en quelques dizaines de Ko. */
export const MAX_OCTETS = 200_000;
/** Nombre maximal de coups (passes comprises) : au-delà, l'analyse sur mobile serait trop longue. */
export const MAX_COUPS = 500;
/** Longueur maximale d'un nom de joueur gardé (un nom plus long est coupé). */
export const MAX_NOM = 40;

export type RaisonRefus = 'vide' | 'trop-gros' | 'format' | 'pas-go' | 'taille' | 'sans-coups' | 'trop-long' | 'installation' | 'illegal';

export type Import =
  | { ok: true; partie: GameRecord; sgf: string; coups: number }
  | { ok: false; raison: RaisonRefus; coup?: number; taille?: number };

/** Nom lisible : sans caractères de contrôle, espaces resserrés, coupé à MAX_NOM. */
export function nettoyerNom(nom: string | undefined): string | undefined {
  if (!nom) return undefined;
  // eslint-disable-next-line no-control-regex
  const n = nom.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return n ? (n.length > MAX_NOM ? `${n.slice(0, MAX_NOM - 1)}…` : n) : undefined;
}

/**
 * Komi lisible. Fox écrit parfois le komi en centièmes de pierre de compensation (KM[375] : 3,75 pierres,
 * soit 7,5 points) ; toute autre valeur hors de ±150 ou non numérique revient à 6,5.
 */
export function komiLisible(km: number): number {
  if (!Number.isFinite(km)) return 6.5;
  if (Math.abs(km) <= 150) return km;
  if (km % 25 === 0 && km <= 2000) return km / 50;
  return 6.5;
}

/** Jeu de caractères déclaré (propriété CA), lu dans les premiers octets du fichier. */
export function jeuDeCaracteres(octets: Uint8Array): string | null {
  const debut = String.fromCharCode(...octets.subarray(0, Math.min(octets.length, 2000)));
  return /CA\s*\[\s*([A-Za-z0-9_-]+)\s*\]/.exec(debut)?.[1] ?? null;
}

/** Texte du fichier : UTF-8, ou le jeu de caractères annoncé par CA (Fox : GB2312 ; KGS ancien : ISO-8859-1). */
export function decoderSgf(octets: Uint8Array): string {
  const ca = jeuDeCaracteres(octets);
  if (ca && !/^utf-?8$/i.test(ca)) {
    try { return new TextDecoder(ca).decode(octets); } catch { /* jeu inconnu : UTF-8 ci-dessous */ }
  }
  return new TextDecoder('utf-8').decode(octets);
}

/** Lit, nettoie et valide un SGF collé ou choisi. `octets` : taille du fichier (sinon celle du texte). */
export function importerSgf(texte: string, octets = new TextEncoder().encode(texte).length): Import {
  if (!texte.trim()) return { ok: false, raison: 'vide' };
  if (octets > MAX_OCTETS) return { ok: false, raison: 'trop-gros' };
  // Un SGF commence par « (; ». Certains sites ajoutent un en-tête avant : on part de la première parenthèse.
  const debut = texte.indexOf('(');
  if (debut < 0) return { ok: false, raison: 'format' };
  const gm = /GM\s*\[\s*(\d+)\s*\]/.exec(texte.slice(debut, debut + 2000));
  if (gm && gm[1] !== '1') return { ok: false, raison: 'pas-go' };
  let g: GameRecord;
  try { g = readSgf(texte.slice(debut)); } catch (e) {
    const m = /Plateau (\d+)/.exec(e instanceof Error ? e.message : '');
    return m ? { ok: false, raison: 'taille', taille: Number(m[1]) } : { ok: false, raison: 'format' };
  }
  if (!g.moves.length) return { ok: false, raison: 'sans-coups' };
  if (g.moves.length > MAX_COUPS) return { ok: false, raison: 'trop-long' };
  const partie: GameRecord = {
    ...g, komi: komiLisible(g.komi),
    black: nettoyerNom(g.black), white: nettoyerNom(g.white), result: nettoyerNom(g.result),
  };
  if (partie.black === undefined) delete partie.black;
  if (partie.white === undefined) delete partie.white;
  if (partie.result === undefined) delete partie.result;
  // Tolérant sur l'alternance (certains serveurs notent deux coups de suite de la même couleur après un handicap libre),
  // strict sur la légalité : pierre sur une pierre, suicide ou ko refusés, avec le numéro du coup.
  const r = replay(partie, { strictTurns: false });
  if (!r.ok) return r.error === 'installation' ? { ok: false, raison: 'installation' } : { ok: false, raison: 'illegal', coup: r.index + 1 };
  return { ok: true, partie, sgf: writeSgf(partie), coups: partie.moves.length };
}

const simple = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Camp proposé : celui dont le nom correspond au pseudo (sans accents ni casse), sinon `null`. */
export function campDuPseudo(g: Pick<GameRecord, 'black' | 'white'>, pseudo: string | null | undefined): 1 | 2 | null {
  const p = pseudo ? simple(pseudo) : '';
  if (!p) return null;
  const b = g.black ? simple(g.black) : '', w = g.white ? simple(g.white) : '';
  if (b === p && w !== p) return 1;
  if (w === p && b !== p) return 2;
  return null;
}
