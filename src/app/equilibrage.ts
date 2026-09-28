// Équilibrage des premières parties contre l'ordi (issue #160) : une première victoire possible et honnête.
// Décision et indicateurs visés : docs/game-design/boucle.md.
import { fr } from '../ui/typo';
import { nombre, t } from '../content/i18n';
import type { Parties } from './home';

/** Komi habituel (règles japonaises, 9 × 9 compris) : points donnés à Blanc parce que Noir commence. */
export const KOMI_NORMAL = 6.5;
/**
 * Komi des premières parties contre l'ordi. La demie évite l'égalité ; Blanc garde un petit avantage,
 * donc le komi existe bien et on peut l'expliquer. Indicateur visé : part des premières parties gagnées
 * (analyse du 27/09 : 1 victoire sur 6, surtout à cause du komi), puis rétention J1.
 */
export const KOMI_DEBUTANT = 0.5;
/** Nombre de premières parties contre l'ordi jouées avec KOMI_DEBUTANT (le « camp » de Clash Royale en compte 3). */
export const PARTIES_KOMI_DEBUTANT = 3;
/**
 * Parties contre l'ordi sans barre d'avantage. La barre disait « Blanc +5,5 » avant le premier coup (C3 de l'analyse
 * du 27/09) : le débutant démarrait « perdant » sans savoir pourquoi. On la cache pendant la toute première partie.
 */
export const PARTIES_SANS_BARRE_AVANTAGE = 1;

/**
 * Nombre de parties contre l'ordi déjà lancées sur cet appareil (compteur `go.parties.v1`).
 * Les anciens compteurs n'ont pas de champ `ordi` : on prend alors `n` (toutes les parties), l'hypothèse prudente.
 */
export function partiesOrdi(p: Parties): number {
  const n = p.ordi ?? p.n;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Réglages d'une partie contre l'ordi. `rang` : parties contre l'ordi déjà lancées avant celle-ci (0 pour la première). */
export interface Equilibrage {
  komi: number;
  /** Barre d'avantage (« qui mène ») affichée pendant la partie. */
  avantage: boolean;
  /**
   * L'ordi passe quand tu passes, une fois les frontières fermées, même s'il pourrait grappiller (#185, option
   * `accommodant` du moteur). Indicateur visé : au plus 2 passes du joueur par partie (médiane), plus de parties finies.
   */
  accommodant?: boolean;
}

/** Premières parties contre l'ordi où il passe quand tu passes (#185) : le même « camp » de 3 parties que le komi. */
export const PARTIES_ACCOMMODANTES = 3;

export function equilibrage(rang: number): Equilibrage {
  return {
    komi: rang < PARTIES_KOMI_DEBUTANT ? KOMI_DEBUTANT : KOMI_NORMAL,
    avantage: rang >= PARTIES_SANS_BARRE_AVANTAGE,
    accommodant: rang < PARTIES_ACCOMMODANTES,
  };
}


/**
 * Phrase de Mochi au début de la partie, qui annonce le komi réellement compté (`komi`) :
 * - première partie : le mot est expliqué ;
 * - parties 2 et 3 : un rappel, la dernière le dit ;
 * - quatrième partie : le komi habituel revient, et on le dit.
 * Rien sinon, ni quand le komi n'est pas celui de l'équilibrage (paramètre de test `?komi=`).
 */
export function annonceKomi(rang: number, komi: number): string | null {
  if (komi === KOMI_DEBUTANT && rang < PARTIES_KOMI_DEBUTANT) {
    const k = nombre(KOMI_DEBUTANT);
    if (rang === 0) return fr(t('komi.premiere', { k }));
    if (rang === PARTIES_KOMI_DEBUTANT - 1) return fr(t('komi.derniere', { k }));
    return fr(t('komi.encore', { k }));
  }
  if (komi === KOMI_NORMAL && rang === PARTIES_KOMI_DEBUTANT) return fr(t('komi.normal', { k: nombre(KOMI_NORMAL) }));
  return null;
}
