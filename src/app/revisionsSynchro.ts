// Révision espacée avec un compte (#469) : ce que l'appareil envoie et comment il applique la réponse du serveur.
// Logique pure, sans stockage ni réseau (réseau : src/data/revisions.ts ; serveur : fonction `echanger_revisions`,
// supabase/migrations/20261007230100_revisions_espacees.sql).
//
// Règle : élément par élément, le changement le plus récent (`maj`, horloge de l'appareil qui l'a fait) gagne. Le serveur
// garde le plus récent de ce qu'il reçoit et renvoie toute la file ; l'appareil applique ce qui est plus récent que chez lui.
// Minimisation : une erreur part avec sa position (pour la rejouer sur un autre appareil), jamais avec le nom de
// l'adversaire ; acquise, elle part sans position (le serveur efface aussi la sienne).
import { ajouter, type ErreurGardee } from './erreurs';
import { ACQUIS, MAX_PROBLEMES, cleProbleme, suiviValide, type EtatRevisions, type Genre, type Suivi } from './revisionEspacee';

/** Position d'une erreur, telle qu'elle part au serveur. */
export interface ContenuErreur {
  creeLe: string;
  size: 9 | 13 | 19;
  rows: string[];
  toPlay: 1 | 2;
  reponses: number[];
  joue: number;
  coup: number;
}

/** Une ligne de la file, comme le serveur la garde. */
export interface Ligne extends Suivi {
  cle: string;
  genre: Genre;
  contenu?: ContenuErreur | null;
}

const CLE_ERREUR = /^erreur-[0-9a-z]{1,13}$/;
const CLE_PROBLEME = /^pb:[A-Za-z0-9_.-]{1,64}$/;
/** Le serveur prend 200 lignes par envoi (erreurs : 30 au plus ; problèmes : les plus récents). */
export const MAX_ENVOI = 200;

const contenuDe = (e: ErreurGardee): ContenuErreur =>
  ({ creeLe: e.creeLe, size: e.size, rows: e.rows, toPlay: e.toPlay, reponses: e.reponses, joue: e.joue, coup: e.coup });

/** Contenu bien formé (réponse du serveur), ou null. */
export function contenuValide(brut: unknown): ContenuErreur | null {
  if (!brut || typeof brut !== 'object') return null;
  const c = brut as Partial<ContenuErreur>;
  const n = c.size;
  if (n !== 9 && n !== 13 && n !== 19) return null;
  if (!Array.isArray(c.rows) || c.rows.length !== n || !c.rows.every(r => typeof r === 'string' && r.length === n && /^[.XO]+$/.test(r))) return null;
  if (c.toPlay !== 1 && c.toPlay !== 2) return null;
  const caseOk = (p: unknown, min: number) => typeof p === 'number' && Number.isInteger(p) && p >= min && p < n * n;
  if (!Array.isArray(c.reponses) || !c.reponses.length || c.reponses.length > 20 || !c.reponses.every(p => caseOk(p, 0))) return null;
  if (!caseOk(c.joue, -1) || typeof c.coup !== 'number' || !Number.isInteger(c.coup) || c.coup < 1 || c.coup > 1000) return null;
  if (typeof c.creeLe !== 'string' || c.creeLe.length > 40 || Number.isNaN(Date.parse(c.creeLe))) return null;
  return { creeLe: c.creeLe, size: n, rows: [...c.rows], toPlay: c.toPlay, reponses: [...c.reponses], joue: c.joue as number, coup: c.coup };
}

/** Ligne bien formée (réponse du serveur), ou null. */
export function ligneValide(brut: unknown): Ligne | null {
  if (!brut || typeof brut !== 'object') return null;
  const b = brut as Record<string, unknown>;
  const cle = b.cle;
  if (typeof cle !== 'string' || !(CLE_ERREUR.test(cle) || CLE_PROBLEME.test(cle))) return null;
  const s = suiviValide(b);
  if (!s) return null;
  const genre: Genre = cle.startsWith('erreur-') ? 'erreur' : 'probleme';
  return { cle, genre, ...s, contenu: genre === 'erreur' ? contenuValide(b.contenu) : null };
}

/** Toute la file de l'appareil, prête à partir. */
export function lignesLocales(erreurs: readonly ErreurGardee[], etat: EtatRevisions): Ligne[] {
  const lignes: Ligne[] = [];
  const vues = new Set<string>();
  for (const e of erreurs) {
    if (!CLE_ERREUR.test(e.id)) continue;
    vues.add(e.id);
    lignes.push({
      cle: e.id, genre: 'erreur', etape: Math.min(ACQUIS - 1, e.reussites ?? 0), prochain: e.prochain, echecs: e.rates,
      maj: e.maj ?? (Date.parse(e.creeLe) || 0), contenu: contenuDe(e),
    });
  }
  for (const [id, maj] of Object.entries(etat.acquises)) {
    if (vues.has(id) || !CLE_ERREUR.test(id)) continue;
    lignes.push({ cle: id, genre: 'erreur', etape: ACQUIS, prochain: null, echecs: 0, maj, contenu: null });
  }
  const problemes = Object.entries(etat.problemes)
    .filter(([id]) => CLE_PROBLEME.test(cleProbleme(id)))
    .sort(([, a], [, b]) => b.maj - a.maj)
    .slice(0, Math.max(0, MAX_ENVOI - lignes.length));
  for (const [id, s] of problemes) lignes.push({ cle: cleProbleme(id), genre: 'probleme', ...s });
  return lignes;
}

/** Erreur reçue d'un autre appareil : le titre dira « Ta partie, coup 14 » (le nom de l'adversaire ne voyage pas). */
function erreurDe(l: Ligne, c: ContenuErreur): ErreurGardee {
  return { id: l.cle, ...c, prochain: l.prochain!, rates: l.echecs, reussites: l.etape, maj: l.maj };
}

/**
 * Applique la file du serveur : chaque ligne plus récente que la version de l'appareil la remplace.
 * `change` : faux si rien n'a bougé (pas d'écriture, pas d'événement).
 */
export function appliquerLignes(erreurs: readonly ErreurGardee[], etat: EtatRevisions, lignes: readonly Ligne[]):
  { erreurs: ErreurGardee[]; etat: EtatRevisions; change: boolean } {
  let liste = [...erreurs];
  let problemes = etat.problemes, acquises = etat.acquises, change = false;
  for (const l of lignes) {
    if (l.genre === 'probleme') {
      const id = l.cle.slice(3), local = problemes[id];
      if (local && local.maj >= l.maj) continue;
      problemes = { ...problemes, [id]: { etape: l.etape, prochain: l.prochain, echecs: l.echecs, maj: l.maj } };
      change = true;
      continue;
    }
    const i = liste.findIndex(e => e.id === l.cle);
    const majLocale = i >= 0 ? (liste[i].maj ?? (Date.parse(liste[i].creeLe) || 0)) : acquises[l.cle] ?? -1;
    if (majLocale >= l.maj) continue;
    if (l.etape >= ACQUIS) {
      if (i >= 0) liste.splice(i, 1);
      acquises = { ...acquises, [l.cle]: l.maj };
      change = true;
    } else if (i >= 0) {
      liste[i] = { ...liste[i], prochain: l.prochain!, reussites: l.etape, rates: l.echecs, maj: l.maj };
      change = true;
    } else if (l.contenu) {
      liste = ajouter(liste, erreurDe(l, l.contenu));
      if (l.cle in acquises) { acquises = { ...acquises }; delete acquises[l.cle]; }
      change = true;
    }
  }
  if (!change) return { erreurs: [...erreurs], etat, change };
  const garder = Object.entries(problemes).sort(([, a], [, b]) => b.maj - a.maj).slice(0, MAX_PROBLEMES);
  return { erreurs: liste, etat: { ...etat, problemes: Object.fromEntries(garder), acquises }, change };
}
