// Défi par lien (#81), constat juridique E14 : PostHog et Sentry enregistrent l'adresse de la page ($current_url,
// avec la query et le fragment). Le jeton du défi (`#defi=JETON`) ne doit jamais y partir.
// Ce module est importé EN PREMIER par src/main.tsx : il lit le jeton puis le retire de l'adresse avant que
// la mesure ne soit chargée et avant tout événement. Il fait de même quand un lien est ouvert dans un onglet déjà
// ouvert (`hashchange`), et prévient l'app par `ecouterJetonDefi`. Le filet avant envoi (fragment et paramètres
// sensibles retirés des adresses envoyées à PostHog et Sentry) est src/data/urlSensible.ts (#336) : pas de doublon ici.
import { inviteurDepuisLien, jetonDeLAdresse } from '../data/defiLien';

type Emplacement = Pick<Location, 'hash' | 'pathname' | 'search'>;
type Historique = Pick<History, 'replaceState' | 'state'>;

/** Lit le jeton du fragment, puis retire tout le fragment de l'adresse. Null (adresse inchangée) sans jeton. */
export function prendreJeton(loc: Emplacement, hist: Historique): string | null {
  // Tout fragment `#defi=…`, même mal formé, est retiré : un jeton tronqué ne doit pas partir non plus.
  if (!/^#defi=/.test(loc.hash)) return null;
  const jeton = jetonDeLAdresse(loc.hash);
  try { hist.replaceState(hist.state, '', loc.pathname + loc.search); } catch { /* adresse inchangée */ }
  return jeton ?? '';
}


const navigateur = typeof location !== 'undefined' && typeof history !== 'undefined';

/** Pseudo de qui invite (`&de=Pseudo`, #343), lu au chargement AVANT que le fragment ne soit retiré ; null sinon. */
export const INVITEUR_AU_CHARGEMENT: string | null = navigateur && /^#defi=/.test(location.hash) ? inviteurDepuisLien(location.hash) : null;

/** Jeton lu au chargement ; '' si le fragment était mal formé (le défi est alors « introuvable »), null sans lien. */
export const JETON_AU_CHARGEMENT: string | null = navigateur ? prendreJeton(location, history) : null;

const abonnes = new Set<(jeton: string, inviteur: string | null) => void>();
/** Lien ouvert dans un onglet déjà ouvert : `f` reçoit le jeton (déjà retiré de l'adresse) et le pseudo de qui invite. */
export function ecouterJetonDefi(f: (jeton: string, inviteur: string | null) => void): () => void {
  abonnes.add(f);
  return () => { abonnes.delete(f); };
}
if (navigateur && typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const inviteur = /^#defi=/.test(location.hash) ? inviteurDepuisLien(location.hash) : null;
    const jeton = prendreJeton(location, history);
    if (jeton !== null) abonnes.forEach(f => f(jeton, inviteur));
  });
}
