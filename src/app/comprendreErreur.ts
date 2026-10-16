// Issue #549 : comprendre son erreur, et voir la solution complète. Logique pure, sans React.
//
// Règle d'or : aucune phrase de go inventée. Tout ce qui est montré ici sort du lecteur exact de capture
// (src/go/lecture-capture.ts) et des règles (src/go/rules.ts) :
// - la réponse de l'adversaire à un coup faux est un coup **prouvé** : après lui, le but du problème n'est plus
//   atteignable (prendre : tu ne peux plus prendre les pierres marquées dans le nombre de coups de la solution ;
//   sauver : ta pierre marquée sera prise quoi que tu fasses, dans la borne de lecture) ;
// - la phrase ne dit que des faits lus sur le plateau : le point joué, les pierres prises, la chaîne reliée, le nombre de
//   libertés ;
// - la solution complète alterne le bon coup et la défense qui tient le plus longtemps, jusqu'à la prise.
// Si le problème n'est pas de ce type (vie et mort, fin de partie…), ou si la lecture dépasse son budget, rien n'est
// calculé : le lecteur garde le comportement d'avant (#197, #237), le texte relu du problème.
import { groupAt, play, type Color, type Position } from '../go/rules';
import { fromLabel, toLabel } from '../go/coords';
import {
  attaquantPrend, compteur, coupsAvantPrise, coupsPourPrendre, defenseurEchoue, ordreDefense, prise, BUDGET_LECTURE, DELAI_LECTURE, K_ECHELLE, K_MAX, type Compteur
} from '../go/lecture-capture';
import { aDeuxYeux, fauxOeilCree } from '../go/faits-vie-mort';
import { REFUTATIONS_LOCALES } from '../go/refutations-locales.gen';
import { startOf, type Puzzle } from '../data/puzzles';
import { t } from '../content/i18n/secondaires';
import { THEME_DU_PROBLEME } from '../content/themes';

/** But lisible sur le plateau : prendre les pierres marquées de l'adversaire, ou sauver les tiennes. */
export type But = { type: 'prendre' | 'sauver'; cibles: number[] };

/** Thèmes dont les pierres marquées montrent une pierre morte à ne pas prendre (#558) : jamais une cible de capture. */
const THEMES_FIN = new Set(['fin-de-partie', 'comptage']);

/**
 * Le but d'un problème, d'après ses pierres marquées ; `null` s'il n'en a pas, s'il en a des deux couleurs, si c'est un
 * problème de fin de partie (la pierre marquée est morte : à laisser, #558), ou de ko sans `avecKo`. Le ko (CI de #551) :
 * en direct, le lecteur ne connaît que le ko simple, sans menaces de ko ailleurs ; « ta pierre ne peut plus être sauvée »
 * pourrait y être faux dans une vraie partie. Hors ligne (#558, `avecKo`), le joueur est maître du ko : la lecture tient
 * quelle que soit la gestion des menaces, et ses répliques sont figées (src/go/refutations-locales.gen.ts).
 */
export function butDe(pz: Puzzle, avecKo = false): But | null {
  const theme = THEME_DU_PROBLEME[pz.id];
  if ((theme === 'ko' && !avecKo) || (theme && THEMES_FIN.has(theme))) return null;
  const { pos, marked } = startOf(pz);
  if (!marked.length) return null;
  const couleurs = new Set(marked.map(m => pos.board[m]));
  if (couleurs.size !== 1) return null;
  return { type: couleurs.has(pz.toPlay) ? 'sauver' : 'prendre', cibles: marked };
}

const joue = (pos: Position, m: number): Position | null => {
  const r = play(pos, m);
  return typeof r === 'string' ? null : r;
};

/** Pierres d'une couleur retirées entre deux positions. */
const prises = (avant: Position, apres: Position, c: Color) => {
  let n = 0;
  for (let i = 0; i < avant.board.length; i++) if (avant.board[i] === c && apres.board[i] !== c) n++;
  return n;
};

/**
 * État des pierres marquées encore sur le plateau, en une phrase : leurs libertés (la plus petite, et si elles diffèrent
 * d'une chaîne à l'autre). Fait lu sur le plateau.
 */
function etatCibles(pos: Position, cibles: readonly number[], sien = false): { phrase: string; min: number } {
  const vues = new Set<number>(), libs: number[] = [];
  for (const c of cibles) {
    if (!pos.board[c] || vues.has(c)) continue;
    const g = groupAt(pos.board, pos.size, c);
    g.stones.forEach(s => vues.add(s));
    libs.push(g.liberties.size);
  }
  const min = Math.min(...libs);
  // #554 : pierres marquées des deux camps (course aux libertés) : « son groupe marqué », sans ambiguïté.
  const cle = sien && libs.length === 1 ? 'erreur.libertes.sien'
    : libs.length === 1 ? (vues.size === 1 ? 'erreur.libertes.pierre' : 'erreur.libertes.groupe')
    : libs.every(l => l === min) ? 'erreur.libertes.chacun' : 'erreur.libertes.auMoins';
  return { phrase: t(cle, { n: min }), min };
}

/** Le coup `m` relie-t-il une chaîne des cibles à une autre chaîne de sa couleur ? */
function relie(avant: Position, apres: Position, m: number, cibles: readonly number[]): boolean {
  const c = apres.board[m];
  const chaine = new Set(groupAt(apres.board, apres.size, m).stones);
  if (!cibles.some(x => chaine.has(x))) return false;
  const chainesAvant = new Set<number>();
  for (const s of chaine) {
    if (s === m || avant.board[s] !== c) continue;
    chainesAvant.add(Math.min(...groupAt(avant.board, avant.size, s).stones));
  }
  return chainesAvant.size >= 2;
}

/** Coups qu'il te reste à jouer après le bon coup pour prendre (lu une fois par problème). */
const DU_BON_COUP = new WeakMap<Puzzle, number | null>();
function coupsDuBonCoup(pz: Puzzle, depart: Position, cibles: readonly number[], c: Compteur): number | null {
  if (DU_BON_COUP.has(pz)) return DU_BON_COUP.get(pz)!;
  const apresBon = joue(depart, pz.answers[0]);
  const avant = c.reste;
  // Lecture complète d'abord, puis lecture d'échelle (une prise trouvée suffit : on cherche une borne, pas un « non »).
  const k = apresBon ? coupsAvantPrise(apresBon, cibles, c) ?? coupsAvantPrise(apresBon, cibles, c, K_ECHELLE, true) : null;
  // Un budget épuisé n'est pas une réponse : on ne le garde pas.
  if (k !== null || c.reste >= 0 || avant < 0) DU_BON_COUP.set(pz, k);
  return k;
}

/** Réponse prouvée de l'adversaire à un coup faux, et la phrase qui la dit. */
export interface ErreurComprise {
  faux: number;
  /** Coup de l'adversaire. */
  reponse: number;
  /** Position après le coup faux. */
  apresFaux: Position;
  /** Position après la réponse. */
  pos: Position;
  /** Une phrase courte, faite de faits lus sur le plateau. */
  phrase: string;
  /** Ce que tu devais faire (mesures) : sauver tes pierres (vivre, seki) ou prendre les siennes (tuer, course). */
  but: 'prendre' | 'sauver';
}

const nomCouleur = (c: Color) => t(c === 1 ? 'erreur.noir' : 'erreur.blanc');

/**
 * Points que le texte relu du problème fait jouer à l'adversaire : ceux qui suivent son nom (« Blanc s'allonge en B1 »).
 * Essayés en premier, pour que le plateau montre la réponse dont parle le texte quand elle est prouvée.
 */
export function pointsDuTexte(pz: Puzzle, adv: Color, faux = -1): number[] {
  return repliquesDuTexte(pz.refutation, nomCouleur(adv), faux, pz.size);
}

const POINT = '[A-HJ-T](?:1[0-9]|[1-9])';
/** Réplique réservée à certaines erreurs : « ou D1 si tu as joué E1 ou C1 », « or D1 if you played E1 or C1 ». */
const CONDITION = new RegExp(`\\b(?:ou (${POINT}) si tu as joué|or (${POINT}) if you played) (${POINT}(?:(?: ou | or )${POINT})*)\\b`, 'g');

/**
 * #554 : points que le texte `texte` fait jouer à l'adversaire (nommé `adv`) après le coup faux `faux`. La réplique
 * réservée à cette erreur d'abord (« Blanc joue G1, ou D1 si tu as joué E1 » : D1 après E1), puis les points cités
 * après son nom, sans ceux des répliques réservées (aux autres erreurs) ni les coups qu'elles citent.
 */
export function repliquesDuTexte(texte: string | null, adv: string, faux: number, size: number): number[] {
  if (!texte) return [];
  const i = texte.indexOf(adv);
  if (i < 0) return [];
  const suite = texte.slice(i), out: number[] = [];
  const lire = (l: string) => { try { const p = fromLabel(l, size); if (p >= 0) out.push(p); } catch { /* hors du plateau : ignoré */ } };
  for (const m of suite.matchAll(CONDITION)) {
    const si = m[3].split(/ ou | or /);
    if (faux >= 0 && si.some(l => { try { return fromLabel(l, size) === faux; } catch { return false; } })) lire(m[1] ?? m[2]);
  }
  for (const m of suite.replace(CONDITION, '').matchAll(new RegExp(`\\b${POINT}\\b`, 'g'))) lire(m[0]);
  return [...new Set(out)];
}

/**
 * Ordre des réponses essayées : celles que nomme le texte du problème, puis les bonnes réponses (« le point clé de ton
 * adversaire est ton point clé »), puis l'ordre naturel. Seules les réponses prouvées sont gardées.
 */
const candidats = (pos: Position, pz: Puzzle, ordre: number[], local = false) =>
  [...new Set([...pointsDuTexte(pz, pos.toPlay, pos.lastMove ?? -1), ...pz.answers, ...(local ? ordre.slice(0, ordre.indexOf(-1)) : ordre)])]
    .filter(m => m >= 0 && !pos.board[m]);

/**
 * Comprendre un coup faux (#549) : la réponse de l'adversaire qui le réfute, prouvée par le lecteur exact, et sa phrase.
 * `null` quand le problème n'est pas une prise ou un sauvetage, quand le coup faux atteint quand même le but, ou quand
 * la lecture dépasse son budget : le lecteur garde alors le texte du problème.
 */
export function comprendreErreur(pz: Puzzle, faux: number, c: Compteur = compteur()): ErreurComprise | null {
  if (pz.answers.includes(faux)) return null;
  // #554 : vie et mort, seki, course aux libertés : réplique prouvée hors ligne, figée dans refutations-locales.gen.ts.
  // Ce fichier fait foi pour ses problèmes : rien n'y est relu en direct (la lecture hors ligne va plus loin).
  if (REFUTATIONS_LOCALES[pz.id]) return erreurFigee(pz, faux);
  return comprendreParCapture(pz, faux, c);
}

/**
 * Lecture de capture (#549) : réponse prouvée par le lecteur exact de capture, ou null. En direct dans l'app (borne de
 * temps), et hors ligne pour figer les réfutations (#554, sans borne de temps, joueur maître du ko). `local` : réponses
 * au contact seulement (texte, bonnes réponses, libertés des pierres marquées et leurs voisins), jamais un coup loin.
 */
export function comprendreParCapture(pz: Puzzle, faux: number, c: Compteur, local = false, but = butDe(pz)): ErreurComprise | null {
  if (!but || pz.answers.includes(faux)) return null;
  const depart = startOf(pz).pos;
  const apresFaux = joue(depart, faux);
  if (!apresFaux) return null;
  const adv = apresFaux.toPlay, moi = pz.toPlay;
  if (but.type === 'prendre') {
    // Combien de coups te restait-il avec le bon coup ? Le faux doit les avoir perdus.
    const k = coupsDuBonCoup(pz, depart, but.cibles, c);
    if (k === null || prise(apresFaux, but.cibles, adv)) return null;
    for (const m of candidats(apresFaux, pz, ordreDefense(apresFaux, but.cibles), local)) {
      const r = joue(apresFaux, m);
      if (!r) continue;
      const v = attaquantPrend(r, but.cibles, k, c);
      if (v === null) return null;
      if (v) continue;
      return { faux, reponse: m, apresFaux, pos: r, phrase: phrasePrendre(apresFaux, r, m, but.cibles, adv), but: but.type };
    }
    return null;
  }
  // Sauver : l'adversaire prend ta pierre marquée quoi que tu fasses, dans la borne (lecture complète, sinon d'échelle :
  // une prise trouvée contre toutes tes défenses est une preuve).
  let echelle = false;
  let k = coupsPourPrendre(apresFaux, but.cibles, c);
  if (k === null) { echelle = true; k = coupsPourPrendre(apresFaux, but.cibles, c, K_ECHELLE, true); }
  if (k === null) return null;
  // La réponse que nomme le texte du problème d'abord, si elle gagne aussi, même moins vite (« Blanc joue F5 : ta pierre
  // reste en atari ») : le plateau montre alors ce que dit le texte.
  const kMax = echelle ? K_ECHELLE : K_MAX;
  for (const m of pointsDuTexte(pz, adv, faux)) {
    const r = apresFaux.board[m] ? null : joue(apresFaux, m);
    if (!r || defenseurEchoue(r, but.cibles, kMax - 1, c, echelle) !== true) continue;
    return { faux, reponse: m, apresFaux, pos: r, phrase: phraseSauver(r, m, but.cibles, moi, adv), but: but.type };
  }
  for (const m of candidats(apresFaux, pz, ordreDefense(apresFaux, but.cibles), local)) {
    const r = joue(apresFaux, m);
    if (!r) continue;
    const v = defenseurEchoue(r, but.cibles, k - 1, c, echelle);
    if (v === null) return null;
    if (!v) continue;
    return { faux, reponse: m, apresFaux, pos: r, phrase: phraseSauver(r, m, but.cibles, moi, adv), but: but.type };
  }
  return null;
}

const PREUVE_DU_CODE = { m: 'mort', y: 'sansYeux', v: 'vit', i: 'imprenable', c: 'course', p: 'prendre', s: 'sauver' } as const;
/** Preuve d'une réplique figée (src/go/refutation-locale.ts) : ce qui est sûr après elle, quoi que tu joues. */
export type PreuveFigee = (typeof PREUVE_DU_CODE)[keyof typeof PREUVE_DU_CODE];

/**
 * #554 : réplique figée hors ligne (src/go/refutations-locales.gen.ts, outils/refutationsLocales.ts) au coup faux
 * `faux` : `undefined` si le problème n'en a pas, `null` si rien n'est prouvé pour ce coup. `cible` : ton groupe
 * (vivre, course) ou le sien (tuer).
 */
export function repliqueFigee(pz: Puzzle, faux: number): { reponse: number; preuve: PreuveFigee; cible: number } | null | undefined {
  const r = REFUTATIONS_LOCALES[pz.id];
  if (!r) return undefined;
  const code = r.sauf?.[toLabel(faux, pz.size)] ?? r.defaut;
  const preuve = PREUVE_DU_CODE[code.slice(-1) as keyof typeof PREUVE_DU_CODE];
  if (!preuve) return null;
  const cible = r.cible ?? r.a;
  return { reponse: fromLabel(code.slice(0, -1), pz.size), preuve, cible: cible ? fromLabel(cible, pz.size) : -1 };
}

/** Coup faux expliqué par une réplique figée, ou null (pas de réplique figée, ou position qui ne correspond plus). */
function erreurFigee(pz: Puzzle, faux: number): ErreurComprise | null {
  const f = repliqueFigee(pz, faux);
  if (!f) return null;
  const apresFaux = joue(startOf(pz).pos, faux);
  const r = apresFaux && !apresFaux.board[f.reponse] ? joue(apresFaux, f.reponse) : null;
  if (!apresFaux || !r) return null;
  const adv = apresFaux.toPlay, { marked } = startOf(pz);
  // Lecture de capture figée : même phrase qu'en direct (#549).
  if (f.preuve === 'prendre') {
    // Course où les deux camps sont marqués : les pierres à prendre sont les siennes.
    const siennes = marked.filter(p => apresFaux.board[p] === adv), sien = siennes.length < marked.length;
    return { faux, reponse: f.reponse, apresFaux, pos: r, phrase: phrasePrendre(apresFaux, r, f.reponse, siennes, adv, sien), but: 'prendre' };
  }
  if (f.preuve === 'sauver') return { faux, reponse: f.reponse, apresFaux, pos: r, phrase: phraseSauver(r, f.reponse, marked, pz.toPlay, adv), but: 'sauver' };
  const sauver = f.preuve === 'mort' || f.preuve === 'sansYeux';
  return { faux, reponse: f.reponse, apresFaux, pos: r, phrase: phraseLocale(pz, apresFaux, r, f.reponse, f.preuve, f.cible), but: sauver ? 'sauver' : 'prendre' };
}

/**
 * Phrase d'une réplique figée : le geste (faits lus sur le plateau : prise, faux œil, point que tu devais jouer), puis
 * l'issue que la preuve garantit. Rien d'autre.
 */
function phraseLocale(pz: Puzzle, avant: Position, apres: Position, m: number, preuve: Exclude<PreuveFigee, 'prendre' | 'sauver'>, cible: number): string {
  const adv = avant.toPlay, moi = pz.toPlay, couleur = nomCouleur(adv), point = toLabel(m, pz.size);
  const n = prises(avant, apres, moi);
  const oeil = preuve === 'mort' || preuve === 'sansYeux' ? fauxOeilCree(avant, apres, cible) : -1;
  const geste = n > 0 ? t('erreur.prendre.prise', { couleur, point, n })
    : oeil >= 0 ? t('erreur.vm.fauxOeil', { couleur, point, oeil: toLabel(oeil, pz.size) })
    : pz.answers.includes(m) ? t('erreur.vm.pointCle', { couleur, point })
    : t('erreur.vm.joue', { couleur, point });
  const pris = apres.board[cible] !== avant.board[cible];
  const issue = preuve === 'mort' ? t(pris ? 'erreur.vm.pris' : 'erreur.vm.mort')
    : preuve === 'sansYeux' ? t('erreur.vm.sansYeux')
    : preuve === 'vit' ? t(aDeuxYeux(apres, cible) ? 'erreur.vm.deuxYeux' : 'erreur.vm.vit')
    : preuve === 'imprenable' ? t('erreur.vm.imprenable')
    : t(pris ? 'erreur.vm.coursePris' : 'erreur.vm.course');
  return `${geste} ${issue}`;
}

function phraseSauver(apres: Position, m: number, cibles: readonly number[], moi: Color, adv: Color): string {
  return t(prise(apres, cibles, moi) ? 'erreur.sauver.prise' : 'erreur.sauver.perdue', { couleur: nomCouleur(adv), point: toLabel(m, apres.size) });
}

function phrasePrendre(avant: Position, apres: Position, m: number, cibles: readonly number[], adv: Color, sien = false): string {
  const point = toLabel(m, apres.size), couleur = nomCouleur(adv);
  const n = prises(avant, apres, (3 - adv) as Color);
  const etat = etatCibles(apres, cibles, sien).phrase;
  const geste = n > 0 ? t('erreur.prendre.prise', { couleur, point, n })
    : relie(avant, apres, m, cibles) ? t('erreur.prendre.relie', { couleur, point })
    : t('erreur.prendre.repond', { couleur, point });
  return `${geste} ${etat}`;
}

/** Une position de la solution complète, avec sa légende. */
export interface CadreSolution { pos: Position; legende: string }

/** Coups de la solution au plus (bon coup et défenses comprises) : au-delà, la suite n'est pas montrée. */
export const SOLUTION_MAX = 2 * K_ECHELLE;

/**
 * Solution complète d'un problème de prise (#549) : le bon coup, puis la défense qui tient le plus longtemps, puis ton
 * coup qui prend le plus vite, et ainsi de suite jusqu'à la prise. Chaque coup est prouvé par le lecteur exact. `null`
 * si le problème n'est pas une prise, si la suite tient en un seul coup (la réponse suffit), ou si la lecture dépasse
 * son budget (la solution s'ouvre sur un geste du joueur : trois fois le délai d'une réfutation, 120 ms au plus).
 */
export function solutionComplete(pz: Puzzle, c: Compteur = compteur(3 * BUDGET_LECTURE, 3 * DELAI_LECTURE)): CadreSolution[] | null {
  const but = butDe(pz);
  if (!but || but.type !== 'prendre') return null;
  const depart = startOf(pz).pos, moi = pz.toPlay, adv = (3 - moi) as Color;
  const premier = joue(depart, pz.answers[0]);
  if (!premier) return null;
  const cadres: CadreSolution[] = [{ pos: depart, legende: '' }, { pos: premier, legende: legendeAttaque(depart, premier, pz.answers[0], but.cibles, moi) }];
  let pos = premier;
  // Coups qu'il te faut encore, l'adversaire au trait : lecture complète, sinon lecture d'échelle (ton coup sur une
  // liberté des pierres marquées à chaque tour ; une prise trouvée contre toutes les défenses reste une preuve).
  let echelle = false;
  let k = coupsAvantPrise(pos, but.cibles, c);
  if (k === null) { echelle = true; k = coupsAvantPrise(pos, but.cibles, c, K_ECHELLE, true); }
  if (k === null) return null;
  while (!prise(pos, but.cibles, adv)) {
    if (cadres.length > SOLUTION_MAX) return null;
    // La défense qui tient le plus longtemps parmi les coups au contact (libertés des pierres marquées et leurs voisins) :
    // celle après laquelle il te faut le plus de coups ; à égalité, la plus naturelle (ordreDefense). S'il n'y en a
    // aucune de jouable, l'adversaire ne peut plus rien : la suite le dit, sans inventer de coup (passe).
    let meilleure: { m: number; r: Position; k: number } | null = null;
    const locaux = ordreDefense(pos, but.cibles);
    for (const m of locaux.slice(0, locaux.indexOf(-1))) {
      const r = joue(pos, m);
      if (!r || prise(r, but.cibles, adv)) continue;
      const kr = coupsPourPrendre(r, but.cibles, c, k, echelle);
      if (kr === null) return null;
      if (!meilleure || kr > meilleure.k) meilleure = { m, r, k: kr };
      if (kr === k) break;
    }
    if (meilleure) {
      cadres.push({ pos: meilleure.r, legende: legendeDefense(pos, meilleure.r, meilleure.m, but.cibles, adv) });
      pos = meilleure.r;
      k = meilleure.k;
    } else {
      const passe = joue(pos, -1);
      if (!passe) return null;
      cadres.push({ pos: passe, legende: t('solution.sansDefense', { couleur: nomCouleur(adv) }) });
      pos = passe;
    }
    // Ton coup qui prend en `k` coups au plus (les libertés des pierres marquées d'abord).
    let choisi: { m: number; r: Position } | null = null;
    for (const m of ordreDefense(pos, but.cibles)) {
      if (m < 0) continue;
      const r = joue(pos, m);
      if (!r) continue;
      const v = defenseurEchoue(r, but.cibles, k - 1, c, echelle);
      if (v === null) return null;
      if (v) { choisi = { m, r }; break; }
    }
    if (!choisi) return null;
    cadres.push({ pos: choisi.r, legende: legendeAttaque(pos, choisi.r, choisi.m, but.cibles, moi) });
    pos = choisi.r;
    k -= 1;
  }
  return cadres.length > 2 ? cadres : null;
}

function legendeAttaque(avant: Position, apres: Position, m: number, cibles: readonly number[], moi: Color): string {
  const point = toLabel(m, apres.size), couleur = nomCouleur(moi), adv = (3 - moi) as Color;
  const n = prises(avant, apres, adv);
  if (prise(apres, cibles, adv)) return t('solution.prise', { couleur, point, n });
  const e = etatCibles(apres, cibles);
  const geste = n > 0 ? t('erreur.prendre.prise', { couleur, point, n }) : t(e.min === 1 ? 'solution.atari' : 'solution.coup', { couleur, point });
  return `${geste} ${e.phrase}`;
}

function legendeDefense(avant: Position, apres: Position, m: number, cibles: readonly number[], adv: Color): string {
  const point = toLabel(m, apres.size), couleur = nomCouleur(adv);
  const n = prises(avant, apres, (3 - adv) as Color);
  const geste = n > 0 ? t('solution.defense.prise', { couleur, point, n }) : t('solution.defense', { couleur, point });
  return `${geste} ${etatCibles(apres, cibles).phrase}`;
}
