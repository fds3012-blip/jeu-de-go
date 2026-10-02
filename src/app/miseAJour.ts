/**
 * Nouvelle version disponible (robustesse, #325) : quand un déploiement arrive pendant que l'app est ouverte, le
 * service worker (public/sw.js) s'installe, s'active aussitôt (`skipWaiting`) et prend la page (`clients.claim`).
 * La page tourne alors avec l'ancien code et le nouveau cache : toucher un écran pas encore chargé peut échouer.
 * On propose donc de recharger, discrètement, et jamais au milieu d'une partie (l'écran décide du moment).
 *
 * Détection : `controllerchange` sur `navigator.serviceWorker`, seulement si la page avait déjà un contrôleur
 * (au premier passage, le premier service worker prend la page : ce n'est pas une mise à jour).
 * Petit magasin externe (useSyncExternalStore), sans dépendance à React ici pour rester testable en Node.
 */
let prete = false;
const abonnes = new Set<() => void>();

function annoncer() {
  if (prete) return;
  prete = true;
  abonnes.forEach(f => f());
}

/** Vrai quand une nouvelle version attend un rechargement. */
export function nouvelleVersionPrete(): boolean {
  return prete;
}

export function abonnerNouvelleVersion(f: () => void): () => void {
  abonnes.add(f);
  return () => { abonnes.delete(f); };
}

/** Décide, à partir de l'état des contrôleurs, si un `controllerchange` signale une mise à jour. */
export function estMiseAJour(controleurAvant: boolean, controleurApres: boolean): boolean {
  return controleurAvant && controleurApres;
}

/**
 * Écoute les changements de contrôleur. À appeler une fois, au démarrage (src/registerSW.ts).
 * Renvoie une fonction pour arrêter d'écouter (tests).
 */
export interface ConteneurSw {
  controller: unknown;
  addEventListener(type: 'controllerchange', f: () => void): void;
  removeEventListener(type: 'controllerchange', f: () => void): void;
}

export function ecouterNouvelleVersion(sw: ConteneurSw | undefined = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker): () => void {
  if (!sw) return () => {};
  let avant = !!sw.controller;
  const surChangement = () => {
    const apres = !!sw.controller;
    if (estMiseAJour(avant, apres)) annoncer();
    avant = apres;
  };
  sw.addEventListener('controllerchange', surChangement);
  return () => sw.removeEventListener('controllerchange', surChangement);
}

/** Recharge la page pour prendre la nouvelle version. */
export function recharger(): void {
  location.reload();
}

/** Réservé aux tests. */
export function _reinitialiserMiseAJour(): void {
  prete = false;
  abonnes.clear();
}
