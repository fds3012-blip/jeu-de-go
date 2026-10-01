/**
 * « Après le premier écran » (#323, #325) : la page est chargée (`load`), ses polices sont prêtes (5 s d'attente au plus :
 * une police bloquée ne retarde pas le reste indéfiniment) et le navigateur est libre. Ce qui n'est pas utile pour voir
 * l'accueil attend ce moment, pour ne pas lui disputer le réseau ni le processeur d'un téléphone lent : écrans suivants,
 * service worker, PostHog au niveau anonyme.
 *
 * Hors d'un vrai navigateur (tests Node, `document` simulé sans `readyState`) : tout de suite.
 */
let promesse: Promise<void> | null = null;

export function premierEcran(): Promise<void> {
  if (promesse) return promesse;
  const doc = typeof document === 'undefined' ? undefined : (document as Partial<Document>);
  if (!doc || typeof doc.readyState !== 'string' || typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return (promesse = Promise.resolve());
  }
  promesse = new Promise<void>(resolve => {
    const libre = () => {
      if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout: 2000 });
      else setTimeout(resolve, 200);
    };
    const polices = () => {
      const pret = doc.fonts?.ready ?? Promise.resolve();
      Promise.race([pret, new Promise(r => setTimeout(r, 5000))]).then(libre, libre);
    };
    if (doc.readyState === 'complete') polices();
    else window.addEventListener('load', polices, { once: true });
  });
  return promesse;
}

/** Lance `f` après le premier écran. */
export function apresPremierEcran(f: () => void): void {
  void premierEcran().then(f);
}

/** Réservé aux tests. */
export function _reinitialiserPremierEcran(): void {
  promesse = null;
}
