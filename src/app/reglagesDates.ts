// Réglages synchronisés (#448) : date de chaque changement fait sur cet appareil. Petit module du chargement initial :
// il note la date et prévient la synchronisation (src/data/reglages.ts, chargée à la demande avec un compte).
// La règle « dernier changement gagne » compare ces dates, clé par clé, avec celles du serveur.

/** Date (ms) du dernier changement de chaque réglage sur cet appareil, ou reçu du serveur. */
export const DATES_REGLAGES_KEY = 'go.reglages.dates.v1';

export type DatesReglages = Record<string, number>;

let ecouteur: ((cle: string) => void) | null = null;

export function lireDatesReglages(): DatesReglages {
  try {
    const o = JSON.parse(localStorage.getItem(DATES_REGLAGES_KEY) || '{}') as unknown;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    return Object.fromEntries(Object.entries(o as Record<string, unknown>).filter((e): e is [string, number] => typeof e[1] === 'number' && Number.isFinite(e[1])));
  } catch { return {}; }
}

export function ecrireDatesReglages(d: DatesReglages): void {
  try { localStorage.setItem(DATES_REGLAGES_KEY, JSON.stringify(d)); } catch { /* stockage fermé : dates de cette visite perdues */ }
}

/** Le joueur vient de changer ce réglage : sa date est notée, et la synchronisation (si elle tourne) l'envoie. */
export function noterReglage(cle: string, t = Date.now()): void {
  ecrireDatesReglages({ ...lireDatesReglages(), [cle]: t });
  ecouteur?.(cle);
}

/** Branche la synchronisation (une seule à la fois). Renvoie de quoi la débrancher. */
export function ecouterReglages(f: (cle: string) => void): () => void {
  ecouteur = f;
  return () => { if (ecouteur === f) ecouteur = null; };
}
