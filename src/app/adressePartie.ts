// Lien de revue partagée (#364) : `/#partie=JETON` (après index.html, qui remet `/partie#JETON` à cette forme).
// Comme le jeton du défi (src/app/adresseDefi.ts, constat E14) : importé en tête de src/main.tsx, il lit le jeton puis
// le retire de l'adresse avant la mesure et tout événement. Un lien ouvert dans un onglet déjà ouvert (`hashchange`)
// prévient l'app par `ecouterJetonPartie`.

/** Jeton d'une partie partagée : 24 octets aléatoires en base64url (comme le défi par lien). */
export const FORMAT_JETON_PARTIE = /^[A-Za-z0-9_-]{32}$/;
/** Fragment de l'adresse : `/#partie=JETON` (forme longue, après index.html). */
export const PARAM_PARTIE = 'partie';

/** Jeton d'une partie partagée lu dans le fragment (`#partie=JETON`) ; '' si mal formé ; null sans lien. */
export function jetonPartieDeLAdresse(hash: string): string | null {
  const brut = hash.replace(/^#/, '');
  if (!brut.startsWith(`${PARAM_PARTIE}=`)) return null;
  const jeton = brut.slice(PARAM_PARTIE.length + 1).split('&')[0].trim();
  return FORMAT_JETON_PARTIE.test(jeton) ? jeton : '';
}

type Emplacement = Pick<Location, 'hash' | 'pathname' | 'search'>;
type Historique = Pick<History, 'replaceState' | 'state'>;

/** Lit le jeton du fragment, puis retire le fragment. Null (adresse inchangée) sans lien ; '' si le jeton est mal formé. */
export function prendreJetonPartie(loc: Emplacement, hist: Historique): string | null {
  const jeton = jetonPartieDeLAdresse(loc.hash);
  if (jeton === null) return null;
  try { hist.replaceState(hist.state, '', loc.pathname + loc.search); } catch { /* adresse inchangée */ }
  return jeton;
}

const navigateur = typeof location !== 'undefined' && typeof history !== 'undefined';

/** Jeton lu au chargement ; '' si mal formé (la partie est alors « introuvable »), null sans lien. */
export const PARTIE_AU_CHARGEMENT: string | null = navigateur ? prendreJetonPartie(location, history) : null;

const abonnes = new Set<(jeton: string) => void>();
/** Lien ouvert dans un onglet déjà ouvert : `f` reçoit le jeton (déjà retiré de l'adresse). */
export function ecouterJetonPartie(f: (jeton: string) => void): () => void {
  abonnes.add(f);
  return () => { abonnes.delete(f); };
}
if (navigateur && typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const jeton = prendreJetonPartie(location, history);
    if (jeton !== null) abonnes.forEach(f => f(jeton));
  });
}
