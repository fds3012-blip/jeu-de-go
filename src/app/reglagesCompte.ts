// Réglages synchronisés entre les appareils d'un même compte (#448) : logique pure, sans stockage ni réseau.
// Liste blanche des clés et des valeurs : la même que la fonction serveur `enregistrer_reglages`
// (supabase/migrations/20261006123100_reglages_compte.sql). Aucune donnée personnelle : que des choix fermés.

/** Une valeur de réglage et la date (ms depuis 1970) de son dernier changement. */
export interface EntreeReglage { v: unknown; t: number }
export type Reglages = Record<string, EntreeReglage>;

const booleen = (v: unknown) => typeof v === 'boolean';
const parmi = (...l: readonly unknown[]) => (v: unknown) => l.includes(v);

/** Clés synchronisées et valeurs acceptées. */
export const CLES_REGLAGES: Readonly<Record<string, (v: unknown) => boolean>> = {
  // Réglages du Profil (src/app/settings.ts, #365 compris)
  theme: parmi('auto', 'dark', 'light'),
  size: parmi(9, 13, 19),
  aide: parmi('auto', 'oui', 'non'),
  coach: parmi('auto', 'oui', 'non'), // #470 (supabase/migrations/20261007223000_reglages_coach.sql)
  cadence: parmi('rapide', 'normale', 'lente'),
  confirmTouch: booleen,
  sound: booleen,
  vibrations: booleen,
  celebrations: booleen,
  coordonnees: booleen,
  dernierCoup: booleen,
  numerosRevue: booleen,
  serieVisible: booleen,
  // Langue de l'interface (go.langue.v1), façon de jouer en ligne (go.enLigne.v1, #440),
  // messages des adversaires coupés (go.echanges.v1, #373), décor du goban (go.themeGoban.v1, #109)
  langue: parmi('fr', 'en'),
  enLigne: parmi('direct', 'lente'),
  messagesCoupes: booleen,
  themeGoban: parmi('kaya', 'kaya-clair', 'ardoise', 'coquillage-dore'),
};

/** Le serveur refuse une date plus d'un jour dans le futur. */
export const AVANCE_MAX_MS = 86_400_000;

/** Date d'un réglage changé avant la synchronisation (#448), sans date connue : plus ancienne que tout changement daté. */
export const DATE_ANCIENNE = 1;

/** Entrée valable (clé connue, valeur permise, date entière dans les bornes) ? */
export function entreeValide(cle: string, e: unknown, maintenant = Date.now()): e is EntreeReglage {
  if (!e || typeof e !== 'object') return false;
  const { v, t } = e as Partial<EntreeReglage>;
  const ok = Object.prototype.hasOwnProperty.call(CLES_REGLAGES, cle) ? CLES_REGLAGES[cle] : undefined;
  return !!ok && ok(v) && typeof t === 'number' && Number.isInteger(t) && t >= 0 && t <= maintenant + AVANCE_MAX_MS;
}

/** Garde seulement les entrées valables (réponse du serveur, stockage modifié à la main). */
export function nettoyer(brut: unknown, maintenant = Date.now()): Reglages {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return {};
  const r: Reglages = {};
  for (const [k, e] of Object.entries(brut as Record<string, unknown>)) {
    if (entreeValide(k, e, maintenant)) r[k] = { v: (e as EntreeReglage).v, t: (e as EntreeReglage).t };
  }
  return r;
}

/**
 * Dernier changement gagne, clé par clé. À date égale, le serveur gagne : tous les appareils finissent sur la même valeur.
 * Renvoie l'ensemble fusionné.
 */
export function fusionner(local: Reglages, serveur: Reglages): Reglages {
  const r: Reglages = { ...serveur };
  for (const [k, e] of Object.entries(local)) {
    const s = serveur[k];
    if (!s || e.t > s.t) r[k] = e;
  }
  return r;
}

/**
 * Ce que l'appareil doit appliquer : les entrées du serveur plus récentes que les siennes (ou à date égale mais de
 * valeur différente), et absentes chez lui.
 */
export function aAppliquer(local: Reglages, serveur: Reglages): Reglages {
  const r: Reglages = {};
  for (const [k, s] of Object.entries(serveur)) {
    const e = local[k];
    if (!e || s.t > e.t || (s.t === e.t && s.v !== e.v)) r[k] = s;
  }
  return r;
}

/**
 * Entrées de l'appareil à partir de ses valeurs et des dates notées. Un réglage sans date mais différent de sa valeur
 * par défaut (changé avant #448) part avec une date très ancienne : il remplit un compte vide sans écraser un
 * changement daté d'un autre appareil. Un réglage jamais changé ne part pas.
 */
export function entreesLocales(valeurs: Record<string, unknown>, dates: Record<string, number>, defauts: Record<string, unknown>, maintenant = Date.now()): Reglages {
  const r: Reglages = {};
  for (const [k, v] of Object.entries(valeurs)) {
    if (v === undefined || v === null) continue;
    const t = dates[k];
    const e = { v, t: typeof t === 'number' ? Math.min(Math.max(0, Math.round(t)), maintenant + AVANCE_MAX_MS) : DATE_ANCIENNE };
    if (typeof t !== 'number' && v === defauts[k]) continue;
    if (entreeValide(k, e, maintenant)) r[k] = e;
  }
  return r;
}
