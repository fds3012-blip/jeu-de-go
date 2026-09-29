// Fin de partie contre l'ordi (issue #22) : bilan par adversaire, adversaire suivant et texte de Mochi.
// Logique pure, testée par Vitest ; l'écran (App.tsx) garde le bilan en localStorage.
import { nombre, t } from '../content/i18n';

/** Victoires et défaites par adversaire. En attendant les comptes et les parties sauvegardées. */
export type Bilan = Record<string, { v: number; d: number }>;
export const BILAN_KEY = 'go.bilan.v1';

interface Adv { id: string; nom: string }

/** Nouveau bilan après une partie (le bilan d'entrée n'est pas modifié). */
export function enregistrer(bilan: Bilan, id: string, gagne: boolean): Bilan {
  const b = bilan[id] ?? { v: 0, d: 0 };
  return { ...bilan, [id]: gagne ? { v: b.v + 1, d: b.d } : { v: b.v, d: b.d + 1 } };
}

/** Relit un bilan venu du stockage, en ignorant tout ce qui est mal formé. */
export function lireBilan(raw: unknown): Bilan {
  const out: Bilan = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, x] of Object.entries(raw as Record<string, unknown>)) {
    const r = x as { v?: unknown; d?: unknown } | null;
    const v = Number(r?.v), d = Number(r?.d);
    if (Number.isFinite(v) && Number.isFinite(d)) out[id] = { v: Math.max(0, Math.floor(v)), d: Math.max(0, Math.floor(d)) };
  }
  return out;
}

export const battu = (bilan: Bilan, id: string) => (bilan[id]?.v ?? 0) > 0;
/** Au moins une partie finie (gagnée ou perdue) contre cet adversaire (#309). */
export const dejaAffronte = (bilan: Bilan, id: string) => (bilan[id]?.v ?? 0) + (bilan[id]?.d ?? 0) > 0;

/** Adversaire suivant dans l'ordre de la liste, ou `undefined` pour le dernier. */
export function suivant<T extends { id: string }>(liste: readonly T[], id: string): T | undefined {
  const i = liste.findIndex(o => o.id === id);
  return i >= 0 ? liste[i + 1] : undefined;
}

/** Ce que l'écran de partie sait de la partie qui vient de finir (issue #40, phase 5). */
export interface StatsPartie {
  /** Coups joués, passes comprises. */
  coups: number;
  /** Pierres adverses que tu as capturées. */
  capturesMoi: number;
  /** Tes pierres capturées par l'adversaire. */
  capturesAdv: number;
  /** Fois où l'un de tes groupes a été mis en atari. */
  atarisSubis: number;
  /** Partie finie par abandon (le tien : l'ordi n'abandonne pas). */
  abandon: boolean;
  /** Écart final en points (0 si abandon). */
  marge: number;
  /** Komi de la partie. */
  komi: number;
  /** Pierres sur le plateau à la fin (#251). Absent : inconnu, on ne présume pas d'un plateau vide. */
  pierres?: number;
}

/**
 * Plateau « presque vide » à la fin (#251, recette du 28/09, M4) : moins de 10 pierres posées, quelle que soit la taille.
 * Pourquoi 10 : c'est 5 coups chacun, moins d'un huitième des 81 points du 9 × 9. En dessous, aucun camp n'a encore
 * fermé de territoire : le résultat vient du komi, pas du jeu. On compte les pierres et non les coups, pour que
 * des passes répétées sur un plateau vide ne fassent pas passer la partie pour « jouée ».
 */
export const PIERRES_PLATEAU_VIDE = 10;

/** Vrai si la partie s'est finie au comptage (pas par abandon) sur un plateau presque vide. */
export function finTropTot(s: StatsPartie): boolean {
  return !s.abandon && s.pierres !== undefined && s.pierres < PIERRES_PLATEAU_VIDE;
}

export type Issue = 'victoire' | 'defaite' | 'egalite';

export interface Fin {
  /** Leçon de la partie, par Mochi, en une ou deux phrases courtes. */
  mochi: string;
  /** Leçon conseillée par Mochi après une défaite (id de src/content/lessons). */
  lecon?: string;
  /** Libellé de l'action principale. */
  cta: string;
  /** Adversaire de la prochaine partie proposée par l'action principale. */
  cible: string;
  /** Bilan en une phrase : le début, puis la partie mise en valeur (« 1 victoire »). */
  bilan: { texte: string; gras: string };
}

/** Bilan contre un adversaire : « 1 victoire », « 2 victoires, 1 défaite », « 1 défaite ». */
export function texteBilan(b: { v: number; d: number }): string {
  if (!b.d) return t('bilan.victoires', { n: b.v });
  if (!b.v) return t('bilan.defaites', { n: b.d });
  return `${t('bilan.victoires', { n: b.v })}, ${t('bilan.defaites', { n: b.d })}`;
}

/** Début de la phrase de bilan : « 34 coups, 3 pierres capturées. » */
export function texteCoups(coups: number, captures: number): string {
  const c = coups ? t('bilan.coups', { n: coups }) : t('bilan.aucunCoup');
  const p = captures ? t('bilan.pierresCapturees', { n: captures }) : t('bilan.aucunePierre');
  return `${c}, ${p}.`;
}

/**
 * Leçon que Mochi tire de la partie, avec ce qu'on sait sans analyse : captures, atari subis, écart, abandon.
 * Victoire : ce qui a marché, puis l'adversaire suivant. Défaite : ton encourageant et, si c'est utile, une leçon.
 */
export function leconMochi(issue: Issue, s: StatsPartie, adv: string, suivant?: string): { texte: string; lecon?: string } {
  if (issue === 'egalite') return { texte: t('lecon.egalite') };
  if (issue === 'victoire') {
    let pourquoi: string;
    if (s.capturesMoi >= 3 && s.capturesMoi > s.capturesAdv) pourquoi = t('lecon.captures', { n: s.capturesMoi });
    else if (s.coups >= 20 && s.capturesAdv === 0) pourquoi = t('lecon.intacte');
    else if (s.marge < 5) pourquoi = t('lecon.dePeu');
    else if (s.marge >= 30) pourquoi = t('lecon.nette');
    else pourquoi = t('lecon.territoire', { adv });
    return { texte: `${pourquoi} ${suivant ? t('lecon.suivant', { suivant }) : t('lecon.personne')}` };
  }
  // #251 : passé très tôt, le débutant perd au komi sans l'avoir vu venir. Pas de « perdu de peu » : on explique.
  if (finTropTot(s)) return { texte: t(s.marge <= s.komi ? 'lecon.finTotKomi' : 'lecon.finTot'), lecon: 'l6' };
  if (s.abandon && s.coups < 10) return { texte: t('lecon.abandonTot', { adv }) };
  if (s.capturesAdv >= 3) return { texte: t('lecon.prises', { adv, n: s.capturesAdv }), lecon: 'l2' };
  if (s.atarisSubis >= 2) return { texte: t('lecon.atariSubis', { n: s.atarisSubis }), lecon: 'l2' };
  if (s.abandon) return { texte: t('lecon.revois') };
  if (s.marge < s.komi) return { texte: t('lecon.komi', { komi: nombre(s.komi) }) };
  if (s.marge <= 10) return { texte: t('lecon.perduDePeu') };
  return { texte: t('lecon.territoireAdv', { adv }), lecon: 'l6' };
}

/**
 * Écran de fin contre l'ordi. `bilan` est le bilan APRÈS la partie.
 * - Victoire : « Défier <suivant> » ; contre le dernier adversaire, « Rejouer contre <adv> ».
 * - Défaite ou égalité : « Rejouer contre <adv> ».
 */
export function fin(adv: Adv, issue: Issue, stats: StatsPartie, bilan: Bilan, liste: readonly Adv[]): Fin {
  const b = bilan[adv.id] ?? { v: 0, d: 0 };
  const s = issue === 'victoire' ? suivant(liste, adv.id) : undefined;
  const { texte, lecon } = leconMochi(issue, stats, adv.nom, s?.nom);
  return {
    mochi: texte,
    ...(lecon ? { lecon } : {}),
    cta: s ? t('bilan.defier', { nom: s.nom }) : t('bilan.rejouerContre', { nom: adv.nom }),
    cible: s ? s.id : adv.id,
    bilan: { texte: t('bilan.tonBilan', { coups: texteCoups(stats.coups, stats.capturesMoi), nom: adv.nom }), gras: texteBilan(b) },
  };
}

/**
 * Komi du comptage final. Paramètre d'URL `?komi=` réservé aux tests de bout en bout
 * (ex. `?komi=-100` : Noir gagne à coup sûr dès que les deux joueurs passent).
 * Il ne change que le comptage : l'ordi choisit ses coups avec le komi normal, donc il passe comme d'habitude.
 */
export function komiDepuisUrl(search: string, defaut = 6.5): number {
  const raw = new URLSearchParams(search).get('komi');
  if (raw === null || raw.trim() === '') return defaut;
  const k = Number(raw.replace(',', '.'));
  return Number.isFinite(k) && Math.abs(k) <= 400 ? k : defaut;
}
