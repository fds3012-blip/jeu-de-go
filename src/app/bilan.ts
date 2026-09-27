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

export interface Fin {
  /** Phrase de Mochi. */
  mochi: string;
  /** Libellé de l'action principale. */
  cta: string;
  /** Adversaire de la prochaine partie proposée par l'action principale. */
  cible: string;
}

const fois = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/**
 * Écran de fin contre l'ordi. `bilan` est le bilan APRÈS la partie.
 * - Victoire : « Défier <suivant> » ; contre le dernier adversaire, « Rejouer contre <adv> ».
 * - Défaite : « Rejouer contre <adv> ».
 */
export function fin(adv: Adv, gagne: boolean, bilan: Bilan, liste: readonly Adv[]): Fin {
  const b = bilan[adv.id] ?? { v: 0, d: 0 };
  const rejouer = { cta: `Rejouer contre ${adv.nom}`, cible: adv.id };
  if (gagne) {
    const s = suivant(liste, adv.id);
    const debut = b.v <= 1 ? `Bravo, tu as battu ${adv.nom} !` : `Encore gagné : ${fois(b.v, 'victoire')} contre ${adv.nom} !`;
    if (!s) return { ...rejouer, mochi: `${debut} Personne ne te résiste ici.` };
    return { cta: `Défier ${s.nom}`, cible: s.id, mochi: `${debut} ${s.nom} t'attend.` };
  }
  const bilanTxt = b.v ? ` Ton bilan : ${fois(b.v, 'victoire')}, ${fois(b.d, 'défaite')}.` : '';
  return { ...rejouer, mochi: `${adv.nom} gagne cette fois. Chaque partie t'apprend quelque chose.${bilanTxt}` };
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
