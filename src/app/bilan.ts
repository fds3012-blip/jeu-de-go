// Fin de partie contre l'ordi (issue #22) : bilan par adversaire, adversaire suivant et texte de Mochi.
// Logique pure, testée par Vitest ; l'écran (App.tsx) garde le bilan en localStorage.

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

const fois = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const virgule = (n: number) => String(n).replace('.', ',');

/** Bilan contre un adversaire : « 1 victoire », « 2 victoires, 1 défaite », « 1 défaite ». */
export function texteBilan(b: { v: number; d: number }): string {
  if (!b.d) return fois(b.v, 'victoire');
  if (!b.v) return fois(b.d, 'défaite');
  return `${fois(b.v, 'victoire')}, ${fois(b.d, 'défaite')}`;
}

/** Début de la phrase de bilan : « 34 coups, 3 pierres capturées. » */
export function texteCoups(coups: number, captures: number): string {
  const c = coups ? fois(coups, 'coup') : 'Aucun coup joué';
  const p = captures ? `${fois(captures, 'pierre')} capturée${captures > 1 ? 's' : ''}` : 'aucune pierre capturée';
  return `${c}, ${p}.`;
}

/**
 * Leçon que Mochi tire de la partie, avec ce qu'on sait sans analyse : captures, atari subis, écart, abandon.
 * Victoire : ce qui a marché, puis l'adversaire suivant. Défaite : ton encourageant et, si c'est utile, une leçon.
 */
export function leconMochi(issue: Issue, s: StatsPartie, adv: string, suivant?: string): { texte: string; lecon?: string } {
  if (issue === 'egalite') return { texte: "Égalité parfaite : au go, c'est très rare !" };
  if (issue === 'victoire') {
    let pourquoi: string;
    if (s.capturesMoi >= 3 && s.capturesMoi > s.capturesAdv) pourquoi = `Tes ${s.capturesMoi} captures ont fait la différence.`;
    else if (s.coups >= 20 && s.capturesAdv === 0) pourquoi = "Aucune de tes pierres n'a été prise : solide !";
    else if (s.marge < 5) pourquoi = 'Gagné de peu : chaque point a compté.';
    else if (s.marge >= 30) pourquoi = 'Victoire nette : ton territoire est bien plus grand.';
    else pourquoi = `Tu as entouré plus de territoire que ${adv}.`;
    return { texte: `${pourquoi} ${suivant ? `${suivant} t'attend : prêt ?` : 'Personne ne te résiste ici.'}` };
  }
  if (s.abandon && s.coups < 10) return { texte: `Tu as abandonné tôt. Joue jusqu'au bout : ${adv} fait des erreurs aussi.` };
  if (s.capturesAdv >= 3) return { texte: `${adv} a pris ${fois(s.capturesAdv, 'pierre')}. La leçon sur l'atari t'apprend à les sauver.`, lecon: 'l2' };
  if (s.atarisSubis >= 2) return { texte: `Tes pierres ont été ${s.atarisSubis} fois en atari. La leçon sur l'atari t'apprend à les sauver.`, lecon: 'l2' };
  if (s.abandon) return { texte: 'Revois ta partie : tu trouveras le coup qui a tout changé.' };
  if (s.marge < s.komi) return { texte: `Sans le komi, les ${virgule(s.komi)} points donnés à Blanc qui joue en second, tu gagnais !` };
  if (s.marge <= 10) return { texte: 'Perdu de peu. La prochaine fois sera la bonne !' };
  return { texte: `${adv} a entouré plus de territoire. La leçon « Territoire et ouverture » montre comment bien commencer.`, lecon: 'l6' };
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
    cta: s ? `Défier ${s.nom}` : `Rejouer contre ${adv.nom}`,
    cible: s ? s.id : adv.id,
    bilan: { texte: `${texteCoups(stats.coups, stats.capturesMoi)} Ton bilan contre ${adv.nom} : `, gras: texteBilan(b) },
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
