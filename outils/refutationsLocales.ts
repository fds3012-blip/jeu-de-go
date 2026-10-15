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
import { butDe, comprendreParCapture, repliquesDuTexte, type But } from '../src/app/comprendreErreur';

/** Thèmes lus ici : la série « Vie et mort » (src/app/seriesThemes.ts). Le ko garde le comportement d'avant (#551). */
export const THEMES_LOCAUX = new Set(['vie-mort', 'seki', 'semeai']);

/**
 * Preuves : celles de src/go/refutation-locale.ts, et la lecture de capture (#549) faite hors ligne, sans borne de temps,
 * le joueur maître du ko : `prendre` (tu ne prends plus les pierres marquées dans les coups de la solution), `sauver`
 * (ta pierre marquée sera prise quoi que tu fasses).
 */
export type Preuve = PreuveLocale | 'prendre' | 'sauver';

/** Code d'une preuve dans le fichier généré. */
export const CODE_PREUVE: Record<Preuve, string> = { mort: 'm', sansYeux: 'y', vit: 'v', imprenable: 'i', course: 'c', prendre: 'p', sauver: 's' };

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
  if (!theme || !THEMES_LOCAUX.has(theme)) return null;
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

/** Réplique prouvée à un coup faux : point de l'adversaire et preuve. */
export interface Replique { reponse: number; preuve: Preuve }

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
  const b = butDe(pz);
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

/**
 * Réplique prouvée au coup faux `faux`, ou null. La lecture locale d'abord (zone fermée) ; sinon (pas de zone, zone
 * ouverte par le coup faux, ou aucune réplique prouvée), la lecture de capture hors ligne.
 */
export function repliqueProuvee(pz: Puzzle, but: ButLocal | null, faux: number, memo?: Map<string, PreuveLocale | null>): Replique | null {
  const apresFaux = jouer(startOf(pz).pos, faux);
  if (!apresFaux) return null;
  const local = but && butApres(pz, but, faux);
  if (local) for (const m of ordreRepliques(pz, local, faux)) {
    if (apresFaux.board[m]) continue;
    const r = jouer(apresFaux, m);
    if (!r) continue;
    const preuve = prouverLocale(r, local, pz.toPlay, { memo });
    if (preuve) return { reponse: m, preuve };
  }
  const capture = butCapture(pz);
  const e = capture && comprendreParCapture(pz, faux, { reste: BUDGET_HORS_LIGNE, fin: Infinity, maitre: pz.toPlay }, true, capture);
  return capture && e ? { reponse: e.reponse, preuve: capture.type === 'prendre' ? 'prendre' : 'sauver' } : null;
}

/** Coups faux légaux d'un problème (sans la passe : le joueur pose une pierre). */
export function coupsFaux(pz: Puzzle): number[] {
  const { pos } = startOf(pz);
  return [...Array(pos.board.length).keys()].filter(m => !pz.answers.includes(m) && jouer(pos, m) !== null);
}

/** Réfutations d'un problème, codées : défaut (la plus fréquente) et exceptions ('' : rien de prouvé). */
export interface RefutationsCodees { defaut: string; sauf: Record<string, string> }

export function coder(pz: Puzzle, r: Replique | null): string {
  return r ? `${toLabel(r.reponse, pz.size)}${CODE_PREUVE[r.preuve]}` : '';
}

export function refutationsDe(pz: Puzzle, but: ButLocal | null): RefutationsCodees {
  const memo = new Map<string, PreuveLocale | null>();
  const codes = new Map(coupsFaux(pz).map(f => [f, coder(pz, repliqueProuvee(pz, but, f, memo))]));
  const compte = new Map<string, number>();
  for (const c of codes.values()) compte.set(c, (compte.get(c) ?? 0) + 1);
  const defaut = [...compte].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))[0]?.[0] ?? '';
  const sauf: Record<string, string> = {};
  for (const [f, c] of codes) if (c !== defaut) sauf[toLabel(f, pz.size)] = c;
  return { defaut, sauf };
}

/** Ligne du fichier généré pour un problème. */
export function ligne(pz: Puzzle, but: ButLocal | null, r: RefutationsCodees): string {
  const L = (m: number) => toLabel(m, pz.size);
  const tete = !but ? `but: '${butCapture(pz)?.type ?? 'aucun'}'`
    : but.type === 'course' ? `but: 'course', a: '${L(but.a)}', b: '${L(but.b)}'` : `but: '${but.type}', cible: '${L(but.cible)}'`;
  const sauf = Object.entries(r.sauf).map(([k, v]) => `${k}: '${v}'`).join(', ');
  return `  ${pz.id}: { ${tete}, defaut: '${r.defaut}'${sauf ? `, sauf: { ${sauf} }` : ''} },`;
}

export const ENTETE = [
  '// Fichier généré par outils/refutationsLocales.ts (`npm run refutations-locales`) : ne pas modifier à la main.',
  '// #554 : réplique prouvée de l’adversaire à chaque coup faux des problèmes de vie et mort, seki et course aux libertés.',
  '// `defaut` vaut pour chaque coup faux légal absent de `sauf` ; « E1m » : l’adversaire joue E1, preuve « mort ».',
  '// Preuves (src/go/refutation-locale.ts) : m mort, y sansYeux, v vit, i imprenable, c course ; lecture de capture',
  '// (src/go/lecture-capture.ts, hors ligne, toi maître du ko) : p prendre, s sauver. Vide : rien de prouvé.',
  '// prettier-ignore',
];

export function genererFichier(lignes: readonly string[], empreinte = ''): string {
  return [
    ...ENTETE,
    `export const EMPREINTE = '${empreinte}';`,
    "export type ButCode = 'vivre' | 'tuer' | 'course' | 'prendre' | 'sauver' | 'aucun';",
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
    const but = butLocal(pz);
    const r = refutationsDe(pz, but);
    await entre?.(pz.id);
    if (!but && !butCapture(pz)) continue;
    lignes.push(ligne(pz, but, r));
  }
  return genererFichier(lignes, empreinte);
}

/**
 * Revérifie une réplique figée sur la vraie position : la preuve codée tient (lecture locale), ou la lecture de capture
 * dit encore non (prendre) ou oui (sauver), le joueur maître du ko. Sert au test, indépendamment de l'ordre d'essai.
 */
export function repliqueTient(pz: Puzzle, faux: number, code: string, memo?: Map<string, PreuveLocale | null>): boolean {
  const lettre = code.slice(-1), reponse = fromLabel(code.slice(0, -1), pz.size);
  const apresFaux = jouer(startOf(pz).pos, faux), r = apresFaux && !apresFaux.board[reponse] ? jouer(apresFaux, reponse) : null;
  if (!r) return false;
  const preuve = (Object.keys(CODE_PREUVE) as Preuve[]).find(k => CODE_PREUVE[k] === lettre);
  if (preuve === 'prendre' || preuve === 'sauver') {
    const capture = butCapture(pz);
    const e = capture && comprendreParCapture(pz, faux, { reste: BUDGET_HORS_LIGNE, fin: Infinity, maitre: pz.toPlay }, true, capture);
    return !!e && e.reponse === reponse && capture?.type === preuve;
  }
  const but = butLocal(pz), local = but && butApres(pz, but, faux);
  return !!preuve && !!local && prouverLocale(r, local, pz.toPlay, { seulement: preuve, memo }) === preuve;
}
