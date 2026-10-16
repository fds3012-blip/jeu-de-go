// Arbre SGF (#562) : lecture et écriture d'un fichier avec ses variantes (parenthèses imbriquées) et ses commentaires.
// Logique pure, sans React. `readSgf` (src/go/sgf.ts, copié dans la fonction serveur) reste la lecture de la seule ligne
// principale ; ce module-ci n'est utilisé que par l'étude (chargée à la demande).
//
// - Lecture tolérante : propriétés en majuscules seulement (`AddBlack` des vieux fichiers FF[3] devient `AB`), valeurs
//   échappées (`\]`, `\\`), saut de ligne « doux » (`\` + retour à la ligne) retiré. Seul le premier jeu d'une
//   collection est lu. Lecture sans récursion : un fichier très profond ne fait pas déborder la pile.
// - Écriture : `(;racine;coup;coup(;variante…)(;variante…))`. La première branche est la ligne principale.
// - Bornes : 16 384 nœuds au plus (au-delà, le reste est ignoré) ; le texte lui-même est borné par l'appelant.

export interface NoeudSgf {
  /** Propriétés du nœud, dans l'ordre du fichier : `B`, `W`, `C`, `AB`… */
  props: Record<string, string[]>;
  /** Suites : la première est la ligne principale, les autres sont des variantes. */
  enfants: NoeudSgf[];
}

/** Nombre maximal de nœuds lus. */
export const MAX_NOEUDS = 16_384;

/** Lit le premier jeu d'un texte SGF, variantes comprises. Lève une erreur si ce n'est pas un SGF. */
export function lireArbreSgf(texte: string): NoeudSgf {
  const t = texte.trim();
  if (!t.startsWith('(')) throw new Error('Ce texte ne ressemble pas à un fichier SGF.');
  let racine: NoeudSgf | null = null;
  let cur: NoeudSgf | null = null;
  const pile: (NoeudSgf | null)[] = [];
  let i = 0, n = 0, profondeur = 0;
  const lireValeur = () => {
    let v = '';
    i++;
    while (i < t.length && t[i] !== ']') {
      if (t[i] === '\\') {
        i++;
        if (t[i] === '\r' || t[i] === '\n') { // saut de ligne « doux »
          if (t[i] === '\r' && t[i + 1] === '\n') i++;
          i++;
          continue;
        }
      }
      if (i < t.length) v += t[i];
      i++;
    }
    i++;
    return v;
  };
  while (i < t.length) {
    const ch = t[i];
    if (ch === '(') { pile.push(cur); profondeur++; i++; continue; }
    if (ch === ')') {
      cur = pile.pop() ?? null;
      profondeur--;
      i++;
      if (profondeur <= 0) break; // fin du premier jeu : les suivants de la collection sont ignorés
      continue;
    }
    if (ch === ';') {
      i++;
      if (++n > MAX_NOEUDS) break;
      const noeud: NoeudSgf = { props: {}, enfants: [] };
      if (cur) cur.enfants.push(noeud);
      else if (!racine) racine = noeud;
      else break;
      cur = noeud;
      continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      let id = '';
      while (i < t.length && /[A-Za-z]/.test(t[i])) { if (/[A-Z]/.test(t[i])) id += t[i]; i++; }
      while (/\s/.test(t[i] ?? '')) i++;
      const valeurs: string[] = [];
      while (t[i] === '[') { valeurs.push(lireValeur()); while (/\s/.test(t[i] ?? '')) i++; }
      if (cur && id) cur.props[id] = (cur.props[id] ?? []).concat(valeurs);
      continue;
    }
    if (ch === '[') { lireValeur(); continue; } // valeur sans propriété : ignorée
    i++;
  }
  if (!racine) throw new Error('Aucun nœud trouvé.');
  return racine;
}

/** Échappe une valeur SGF (`]` et `\`). */
export const echapperSgf = (s: string): string => s.replace(/([\]\\])/g, '\\$1');

function ecrireNoeud(n: NoeudSgf): string {
  let s = ';';
  for (const [id, valeurs] of Object.entries(n.props)) {
    if (!valeurs.length) continue;
    s += id + valeurs.map(v => `[${echapperSgf(v)}]`).join('');
  }
  return s;
}

/** Écrit l'arbre en SGF : une suite linéaire tant qu'il n'y a qu'une branche, des parenthèses à chaque embranchement. */
export function ecrireArbreSgf(racine: NoeudSgf): string {
  // Sans récursion : une pile de morceaux à écrire.
  let s = '';
  const pile: (NoeudSgf | ')' | '(')[] = ['(', racine];
  pile.reverse();
  while (pile.length) {
    const x = pile.pop()!;
    if (x === '(' || x === ')') { s += x; continue; }
    s += ecrireNoeud(x);
    if (x.enfants.length === 1) pile.push(x.enfants[0]);
    else if (x.enfants.length > 1) {
      for (let k = x.enfants.length - 1; k >= 0; k--) pile.push(')', x.enfants[k], '(');
    }
  }
  return `${s})`;
}
