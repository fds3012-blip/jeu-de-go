// Issue #554 : réfutations prouvées des coups faux en vie et mort, seki et course aux libertés, calculées hors ligne.
// La recherche complète dépasse souvent les 40 ms d'une lecture en direct sur téléphone (jusqu'à plusieurs secondes) :
// elle est faite ici, et figée dans src/go/refutations-locales.gen.ts, chargé avec l'écran des problèmes.
//
// Régénérer après un changement de problème, de zone ou de lecteur : `npm run refutations-locales`
// (outils/refutationsLocales.test.ts vérifie que le fichier est à jour, et revérifie chaque preuve).
import { createHash } from 'node:crypto';
import { THEME_DU_PROBLEME } from '../src/content/themes';
import { startOf, type Puzzle } from '../src/data/puzzles';
import { fromLabel, toLabel } from '../src/go/coords';
import { groupAt, type Color } from '../src/go/rules';
import {
  VIDES_MAX, defautsZone, defautsZoneCourse, jouer, prouverLocale, zoneDeCourse, zoneDuGroupe, zoneFermee, type ButLocal, type PreuveLocale,
} from '../src/go/refutation-locale';
import { LECTURES_DECLAREES } from '../src/go/zones-problemes';
import {
  VIDES_MAX_FIN, defautsZoneFin, repliqueFin, valeursDepart, zoneOuverte, type ButFin, type FaitFaux, type ReferencesFin, type RepliqueFin,
} from '../src/go/refutation-fin';
import { butDe, comprendreParCapture, repliquesDuTexte, type But } from '../src/app/comprendreErreur';

/**
 * Thèmes lus ici : la série « Vie et mort » (src/app/seriesThemes.ts), et, depuis #558, la fin de partie, le comptage et
 * le ko (le joueur maître du ko : rien d'affirmé qui dépende des menaces de ko).
 */
export const THEMES_LOCAUX = new Set(['vie-mort', 'seki', 'semeai', 'fin-de-partie', 'comptage', 'ko']);
/** Thèmes lus par les preuves de vie et mort (zone fermée) : le ko aussi (vivre ou tuer par un ko, lot AA). */
const THEMES_VIE_MORT = new Set(['vie-mort', 'seki', 'semeai', 'ko']);
/** Thèmes dont la preuve est un compte de points (src/go/refutation-fin.ts) ; le ko aussi, faute de pierres marquées. */
const THEMES_FIN = new Set(['fin-de-partie', 'comptage', 'ko']);

/**
 * Preuves : celles de src/go/refutation-locale.ts, la lecture de capture (#549) faite hors ligne, sans borne de temps,
 * le joueur maître du ko : `prendre` (tu ne prends plus les pierres marquées dans les coups de la solution), `sauver`
 * (ta pierre marquée sera prise quoi que tu fasses) ; et le compte de points (#558, src/go/refutation-fin.ts) : `fin`
 * (tu perds au moins N points, quoi que tu joues, toi maître du ko), `ko` (la réplique prend un ko ; sans menace, tu
 * perds au moins N points).
 */
export type Preuve = PreuveLocale | 'prendre' | 'sauver' | 'fin' | 'ko';

/** Code d'une preuve dans le fichier généré. */
export const CODE_PREUVE: Record<Preuve, string> = { mort: 'm', sansYeux: 'y', vit: 'v', imprenable: 'i', course: 'c', prendre: 'p', sauver: 's', fin: 'f', ko: 'k' };
/** Code d'un fait sur le coup faux (fin de partie), après la perte : « F4f2m » : Blanc F4, tu perds 2 points, tu as pris une pierre morte. */
export const CODE_FAIT: Record<Exclude<FaitFaux, null>, string> = { territoire: 't', chezLui: 'l', dame: 'n', morte: 'm' };

/** Coups essayés au plus par question de la lecture de capture hors ligne (en direct : BUDGET_LECTURE). */
export const BUDGET_HORS_LIGNE = 200_000;

const memeChaine = (pz: Puzzle, pts: readonly number[]) => {
  const { pos } = startOf(pz);
  const g = new Set(groupAt(pos.board, pos.size, pts[0]).stones);
  return pts.every(p => g.has(p));
};

/** But local d'un problème (zone déclarée ou déduite, fermée), ou null s'il ne se lit pas ainsi. */
export function butLocal(pz: Puzzle): ButLocal | null {
  const theme = THEME_DU_PROBLEME[pz.id];
  if (!theme || !THEMES_VIE_MORT.has(theme)) return null;
  const { pos, marked } = startOf(pz), decl = LECTURES_DECLAREES[pz.id] ?? {}, at = (l: string) => fromLabel(l, pz.size);
  const miens = marked.filter(m => pos.board[m] === pz.toPlay), siens = marked.filter(m => pos.board[m] !== pz.toPlay);
  const zoneDecl = decl.zone?.map(at);
  if (theme === 'semeai' || (miens.length && siens.length) || decl.course) {
    const a = decl.course ? at(decl.course) : miens[0], b = siens[0];
    if (a === undefined || b === undefined || !memeChaine(pz, siens) || (!decl.course && !memeChaine(pz, miens))) return null;
    const zone = zoneDecl ?? zoneDeCourse(pos, a, b);
    return defautsZoneCourse(pos, a, b, zone).length ? null : { type: 'course', a, b, zone };
  }
  const tous = miens.length ? miens : siens;
  if (!tous.length) return null;
  const cible = decl.cible ? at(decl.cible) : tous[0];
  if (!decl.cible && !memeChaine(pz, tous)) return null;
  const zone = zoneDecl ?? zoneDuGroupe(pos, cible);
  if (zone.filter(z => !pos.board[z]).length > VIDES_MAX || defautsZone(pos, cible, zone).length) return null;
  return miens.length ? { type: 'vivre', cible, zone, seki: theme === 'seki' } : { type: 'tuer', cible, zone };
}

/**
 * #558 : but de fin de partie (compte de points) d'un problème : zone déclarée (src/go/zones-problemes.ts) ou déduite
 * (points ouverts), pierres mortes déclarées ; null si le thème n'est pas de fin de partie, si la zone déduite est trop
 * grande, ou si le but a un défaut (pierre pas prouvée morte, point vide hors de la zone à personne).
 */
export function butFin(pz: Puzzle): ButFin | null {
  const theme = THEME_DU_PROBLEME[pz.id];
  if (!theme || !THEMES_FIN.has(theme)) return null;
  const { pos } = startOf(pz), decl = LECTURES_DECLAREES[pz.id]?.fin ?? {}, at = (l: string) => fromLabel(l, pz.size);
  const mortes = (decl.mortes ?? []).map(at);
  const zone = decl.zone?.map(at) ?? zoneOuverte(pos, mortes);
  if (!zone.length || (!decl.zone && zone.length > VIDES_MAX_FIN)) return null;
  const but = { zone, mortes };
  return defautsZoneFin(pos, but).length ? null : but;
}

/** Valeurs de référence d'un problème de fin de partie (#558) : le bon coup, maître du ko et en ko simple ; la passe. */
export type MeilleuresFin = ReferencesFin;

/**
 * Valeur du bon coup, dans chaque modèle de ko, pour servir de référence à la perte : null quand la première réponse
 * n'atteint pas la meilleure valeur (le problème ne se prouve pas dans ce modèle, rien n'est affirmé).
 */
export function meilleuresFin(pz: Puzzle, but: ButFin): MeilleuresFin {
  const { pos } = startOf(pz);
  const ref = (maitre?: Color) => {
    const { valeurs, meilleure } = valeursDepart(pos, but, { maitre });
    const bon = valeurs.get(pz.answers[0]);
    return { bon: meilleure !== null && bon === meilleure ? meilleure : null, passe: valeurs.get(-1) ?? null };
  };
  const m = ref(pz.toPlay);
  return { maitre: m.bon, simple: ref().bon, passe: m.passe };
}

/** Réplique prouvée à un coup faux : point de l'adversaire et preuve ; fin de partie : la perte et le fait sur le coup faux. */
export interface Replique { reponse: number; preuve: Preuve; perte?: number; fait?: FaitFaux }

/**
 * Réplique de fin de partie codée. Un ko (`k`) ne porte ni perte ni fait : la lecture sans menace finit la partie à la
 * deuxième passe, ko pendant, ce qui peut compter un point de trop ; la phrase ne dit alors que le fait (c'est un ko).
 */
const repliqueDeFin = (r: RepliqueFin): Replique => (r.ko ? { reponse: r.reponse, preuve: 'ko' } : { reponse: r.reponse, preuve: 'fin', perte: r.perte, fait: r.fait });

/**
 * Ordre des répliques essayées : celles que nomme le texte relu du problème (la réservée à cette erreur d'abord), puis
 * les bonnes réponses (le point vital de l'un est souvent celui de l'autre), puis les points de la zone. Seuls les
 * points de la zone sont essayés : la preuve ne lit que là.
 */
export function ordreRepliques(pz: Puzzle, but: ButLocal, faux: number): number[] {
  const adv = (3 - pz.toPlay) as Color, dans = new Set(but.zone);
  const texte = repliquesDuTexte(pz.refutation, adv === 1 ? 'Noir' : 'Blanc', faux, pz.size);
  return [...new Set([...texte, ...pz.answers, ...but.zone])].filter(m => dans.has(m));
}

/**
 * But de la lecture de capture : celui des pierres marquées (#549), ou, dans une course où les deux camps sont marqués,
 * prendre les pierres marquées de l'adversaire.
 */
export function butCapture(pz: Puzzle): But | null {
  const b = butDe(pz, true);
  if (b || THEME_DU_PROBLEME[pz.id] !== 'semeai') return b;
  const { pos, marked } = startOf(pz), siennes = marked.filter(m => pos.board[m] !== pz.toPlay);
  return siennes.length && siennes.length < marked.length ? { type: 'prendre', cibles: siennes } : null;
}

/**
 * But local après le coup faux `faux` : le même si sa zone reste fermée ; sinon (un coup faux dehors a pris une liberté
 * à un mur), l'espace du groupe relu sur le nouveau plateau, s'il est fermé et que la zone n'était pas déclarée ; ou null.
 */
export function butApres(pz: Puzzle, but: ButLocal, faux: number): ButLocal | null {
  const apresFaux = jouer(startOf(pz).pos, faux);
  if (!apresFaux) return null;
  if (zoneFermee(apresFaux, but)) return but;
  if (but.type === 'course' || LECTURES_DECLAREES[pz.id]?.zone || !apresFaux.board[but.cible]) return null;
  const zone = zoneDuGroupe(apresFaux, but.cible);
  if (zone.filter(z => !apresFaux.board[z]).length > VIDES_MAX) return null;
  const autre = { ...but, zone };
  return zoneFermee(apresFaux, autre) ? autre : null;
}

/** Ce qu'il y a à lire dans un problème : but local (vie et mort), de fin de partie (compte), ou aucun des deux. */
export interface Buts { local: ButLocal | null; fin: ButFin | null; meilleures?: MeilleuresFin }

export function butsDe(pz: Puzzle): Buts {
  const local = butLocal(pz), fin = local ? null : butFin(pz);
  return { local, fin, meilleures: fin ? meilleuresFin(pz, fin) : undefined };
}

/** Ordre des répliques de fin de partie : celles du texte, les bonnes réponses, puis la zone (seuls ses points sont lus). */
export function ordreRepliquesFin(pz: Puzzle, but: ButFin, faux: number): number[] {
  const adv = (3 - pz.toPlay) as Color, dans = new Set(but.zone);
  const texte = repliquesDuTexte(pz.refutation, adv === 1 ? 'Noir' : 'Blanc', faux, pz.size);
  return [...new Set([...texte, ...pz.answers, ...but.zone])].filter(m => dans.has(m));
}

/**
 * Réplique prouvée au coup faux `faux`, ou null. La lecture locale d'abord (zone fermée) ; sinon (pas de zone, zone
 * ouverte par le coup faux, ou aucune réplique prouvée), la lecture de capture hors ligne ; sinon le compte de points
 * (#558, fin de partie, comptage, ko sans pierres marquées).
 */
export function repliqueProuvee(pz: Puzzle, buts: Buts, faux: number, memo?: Map<string, PreuveLocale | null>): Replique | null {
  const depart = startOf(pz).pos, apresFaux = jouer(depart, faux);
  if (!apresFaux) return null;
  const local = buts.local && butApres(pz, buts.local, faux);
  if (local) for (const m of ordreRepliques(pz, local, faux)) {
    if (apresFaux.board[m]) continue;
    const r = jouer(apresFaux, m);
    if (!r) continue;
    const preuve = prouverLocale(r, local, pz.toPlay, { memo });
    if (preuve) return { reponse: m, preuve };
  }
  const capture = butCapture(pz);
  const e = capture && comprendreParCapture(pz, faux, { reste: BUDGET_HORS_LIGNE, fin: Infinity, maitre: pz.toPlay }, true, capture);
  if (capture && e) return { reponse: e.reponse, preuve: capture.type === 'prendre' ? 'prendre' : 'sauver' };
  if (!buts.fin || !buts.meilleures) return null;
  const f = repliqueFin(depart, buts.fin, faux, ordreRepliquesFin(pz, buts.fin, faux), buts.meilleures);
  return f ? repliqueDeFin(f) : null;
}

/** Coups faux légaux d'un problème (sans la passe : le joueur pose une pierre). */
export function coupsFaux(pz: Puzzle): number[] {
  const { pos } = startOf(pz);
  return [...Array(pos.board.length).keys()].filter(m => !pz.answers.includes(m) && jouer(pos, m) !== null);
}

/** Réfutations d'un problème, codées : défaut (la plus fréquente) et exceptions ('' : rien de prouvé). */
export interface RefutationsCodees { defaut: string; sauf: Record<string, string> }

export function coder(pz: Puzzle, r: Replique | null): string {
  if (!r) return '';
  const suite = r.perte !== undefined ? `${r.perte}${r.fait ? CODE_FAIT[r.fait] : ''}` : '';
  return `${toLabel(r.reponse, pz.size)}${CODE_PREUVE[r.preuve]}${suite}`;
}

/** Lecture d'un code : point, preuve, et pour la fin de partie la perte et le fait. Null si le code est vide ou inconnu. */
export function decoder(code: string, size: number): Replique | null {
  const m = /^([A-HJ-T]\d{1,2})([a-z])(\d*)([a-z]?)$/.exec(code);
  if (!m) return null;
  const preuve = (Object.keys(CODE_PREUVE) as Preuve[]).find(k => CODE_PREUVE[k] === m[2]);
  const fait = (Object.keys(CODE_FAIT) as Exclude<FaitFaux, null>[]).find(k => CODE_FAIT[k] === m[4]);
  if (!preuve || (m[4] && !fait)) return null;
  return { reponse: fromLabel(m[1], size), preuve, ...(m[3] ? { perte: Number(m[3]), fait: fait ?? null } : {}) };
}

export function refutationsDe(pz: Puzzle, buts: Buts): RefutationsCodees {
  const memo = new Map<string, PreuveLocale | null>();
  const codes = new Map(coupsFaux(pz).map(f => [f, coder(pz, repliqueProuvee(pz, buts, f, memo))]));
  const compte = new Map<string, number>();
  for (const c of codes.values()) compte.set(c, (compte.get(c) ?? 0) + 1);
  const defaut = [...compte].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))[0]?.[0] ?? '';
  const sauf: Record<string, string> = {};
  for (const [f, c] of codes) if (c !== defaut) sauf[toLabel(f, pz.size)] = c;
  return { defaut, sauf };
}

/** Ligne du fichier généré pour un problème. */
export function ligne(pz: Puzzle, buts: Buts, r: RefutationsCodees): string {
  const L = (m: number) => toLabel(m, pz.size), but = buts.local;
  const tete = but ? (but.type === 'course' ? `but: 'course', a: '${L(but.a)}', b: '${L(but.b)}'` : `but: '${but.type}', cible: '${L(but.cible)}'`)
    : butCapture(pz) ? `but: '${butCapture(pz)!.type}'` : buts.fin ? "but: 'fin'" : "but: 'aucun'";
  const sauf = Object.entries(r.sauf).map(([k, v]) => `${k}: '${v}'`).join(', ');
  return `  ${pz.id}: { ${tete}, defaut: '${r.defaut}'${sauf ? `, sauf: { ${sauf} }` : ''} },`;
}

export const ENTETE = [
  '// Fichier généré par outils/refutationsLocales.ts (`npm run refutations-locales`) : ne pas modifier à la main.',
  '// #554 : réplique prouvée de l’adversaire à chaque coup faux des problèmes de vie et mort, seki et course aux libertés ;',
  '// #558 : fin de partie, comptage et ko aussi.',
  '// `defaut` vaut pour chaque coup faux légal absent de `sauf` ; « E1m » : l’adversaire joue E1, preuve « mort ».',
  '// Preuves (src/go/refutation-locale.ts) : m mort, y sansYeux, v vit, i imprenable, c course ; lecture de capture',
  '// (src/go/lecture-capture.ts, hors ligne, toi maître du ko) : p prendre, s sauver ; compte de points',
  '// (src/go/refutation-fin.ts) : « F4f2m » : f fin (tu perds au moins 2 points, toi maître du ko), puis le fait sur ton',
  '// coup : t dans ton territoire, l chez lui, n dame, m pierre déjà morte prise ; « E3k » : la réplique prend un ko (sans',
  '// menace, tu y perds ; la phrase ne dit que le fait). Vide : rien de prouvé.',
  '// prettier-ignore',
];

export function genererFichier(lignes: readonly string[], empreinte = ''): string {
  return [
    ...ENTETE,
    `export const EMPREINTE = '${empreinte}';`,
    "export type ButCode = 'vivre' | 'tuer' | 'course' | 'prendre' | 'sauver' | 'fin' | 'aucun';",
    'export interface RefutationsLocales { but: ButCode; cible?: string; a?: string; b?: string; defaut: string; sauf?: Readonly<Record<string, string>> }',
    'export const REFUTATIONS_LOCALES: Readonly<Record<string, RefutationsLocales>> = {',
    ...lignes,
    '};',
    '',
  ].join('\n');
}

/** Problèmes lus ici (thème de la série « Vie et mort »), dans l'ordre de la banque. */
export const problemesLocaux = (tous: readonly Puzzle[]): Puzzle[] => tous.filter(p => THEMES_LOCAUX.has(THEME_DU_PROBLEME[p.id] ?? ''));

/**
 * Sources dont dépend le fichier généré : les règles, les lecteurs, les zones déclarées, la lecture du texte des
 * réfutations et ce générateur. Toute modification change l'empreinte, et le test demande de régénérer.
 */
export const SOURCES = [
  'src/go/rules.ts', 'src/go/tactics.ts', 'src/go/preuve-vie-mort.ts', 'src/go/preuve-ko.ts', 'src/go/preuve-course.ts',
  'src/go/refutation-locale.ts', 'src/go/lecture-capture.ts', 'src/go/zones-problemes.ts', 'src/app/comprendreErreur.ts',
  // #558 : compte de points.
  'src/go/score.ts', 'src/go/frontieres.ts', 'src/go/preuve-fin-de-partie.ts', 'src/go/refutation-fin.ts',
  'outils/refutationsLocales.ts',
];

/** Empreinte des entrées : problèmes lus (position, réponses, texte français, thème) et sources. */
export function empreinteDe(problemes: readonly Puzzle[], lire: (f: string) => string): string {
  const h = createHash('sha256');
  for (const p of problemesLocaux(problemes)) h.update(JSON.stringify([p.id, p.size, p.rows, p.toPlay, p.answers, p.refutation, THEME_DU_PROBLEME[p.id]]));
  for (const f of SOURCES) h.update(`${f}\n${lire(f)}`);
  return h.digest('hex').slice(0, 16);
}

/**
 * Contenu complet de src/go/refutations-locales.gen.ts. `entre` : attendu après chaque problème (progression, et main
 * rendue à la boucle d'événements : la génération dure plusieurs minutes).
 */
export async function genererRefutationsLocales(problemes: readonly Puzzle[], empreinte: string, entre?: (id: string) => Promise<void>): Promise<string> {
  const lignes: string[] = [];
  for (const pz of problemesLocaux(problemes)) {
    const buts = butsDe(pz);
    const r = refutationsDe(pz, buts);
    await entre?.(pz.id);
    if (!buts.local && !buts.fin && !butCapture(pz)) continue;
    lignes.push(ligne(pz, buts, r));
  }
  return genererFichier(lignes, empreinte);
}

/**
 * Revérifie une réplique figée sur la vraie position : la preuve codée tient (lecture locale), la lecture de capture
 * dit encore non (prendre) ou oui (sauver), le joueur maître du ko, ou le compte de points donne la perte codée (et le
 * fait sur le coup faux). Sert au test, indépendamment de l'ordre d'essai.
 */
export function repliqueTient(pz: Puzzle, faux: number, code: string, memo?: Map<string, PreuveLocale | null>, buts = butsDe(pz)): boolean {
  const d = decoder(code, pz.size);
  if (!d) return false;
  const { reponse, preuve } = d, depart = startOf(pz).pos;
  const apresFaux = jouer(depart, faux), r = apresFaux && !apresFaux.board[reponse] ? jouer(apresFaux, reponse) : null;
  if (!r) return false;
  if (preuve === 'prendre' || preuve === 'sauver') {
    const capture = butCapture(pz);
    const e = capture && comprendreParCapture(pz, faux, { reste: BUDGET_HORS_LIGNE, fin: Infinity, maitre: pz.toPlay }, true, capture);
    return !!e && e.reponse === reponse && capture?.type === preuve;
  }
  if (preuve === 'fin' || preuve === 'ko') {
    if (!buts.fin || !buts.meilleures) return false;
    // La réplique codée seule est essayée : même modèle de ko ; fin : même perte, même fait.
    const f = repliqueFin(depart, buts.fin, faux, [reponse], buts.meilleures);
    if (!f || f.reponse !== reponse || (f.ko ? 'ko' : 'fin') !== preuve) return false;
    return preuve === 'ko' || (f.perte === d.perte && f.fait === d.fait);
  }
  const local = buts.local && butApres(pz, buts.local, faux);
  return !!local && prouverLocale(r, local, pz.toPlay, { seulement: preuve, memo }) === preuve;
}
