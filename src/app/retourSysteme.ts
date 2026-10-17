// Retour du système (#606, lot N1 ; règle A7 de DESIGN.md) : le bouton ou le geste retour d'Android, le retour du
// navigateur, le geste d'iOS (Safari) et Échap font ce que fait « ‹ » sur l'écran affiché. Chargé après le premier
// écran (budget du JS initial) : App.tsx ne garde que deux fonctions de lecture.
//
// Historique : une seule entrée « garde » au-dessus de l'entrée de l'app, tant que l'écran n'est pas la racine de
// Jouer. Le retour du système la consomme (`popstate`) : on la repose aussitôt (un second retour rapide ne fait pas
// sortir de l'app), puis on fait la sortie de l'écran. Revenu à la racine de Jouer, on retire la garde : le retour
// suivant laisse le système faire (fermer l'app, quitter le site). Pour le joueur, c'est une entrée par écran :
// chaque retour fait un « ‹ », jusqu'à Jouer. Une garde unique évite les pièges d'une pile d'entrées : boucle,
// entrées périmées après un rechargement, désaccord avec une pile tenue ailleurs.
//
// Ce que fait un retour, dans l'ordre (le premier qui s'applique) :
// 1. une fenêtre `<dialog>` ouverte (feuille, Aide, consentement…) : fermée comme par Échap (`cancel`, puis `close`) ;
// 2. une question « Quitter la partie ? » (ou « Passer ? ») : « Continuer » ; un menu déroulant ouvert : refermé ;
// 3. le bouton « ‹ » de l'écran (`.retour`, ou `[data-retour]`) : touché, confirmation comprise ;
// 4. sinon `repli` (App.tsx) : sortie sans bouton « ‹ » (placement, arrivée d'un défi), ou retour à Jouer depuis la
//    racine d'Apprendre, de Problèmes ou du Profil.
import { EVENTS, track } from '../data/analytics';
import type { Ecran, Onglet } from './navigation';
import type { EcranTitre } from './titreEcran';

export interface Branchement {
  /** Vrai hors de la racine de Jouer, d'après l'état d'App.tsx (l'écran visible, sans ses feuilles ni sous-écrans). */
  horsRacine: () => boolean;
  /** Sortie sans bouton « ‹ » ; rien à faire à la racine de Jouer. */
  repli: () => void;
  /** État d'App.tsx qui nomme l'écran affiché (voir `ecranDe`). */
  etat: () => EtatApp;
}

/**
 * Ce qu'App.tsx sait de l'écran : son titre (`titreEcran.ts`), l'onglet, la vue du Profil, puis l'Aide ouverte, la série
 * de fin de leçon, la page d'un thème, la partie en direct, la feuille « Changer », l'introduction des règles.
 */
export type EtatApp = [EcranTitre, Onglet, string, boolean, boolean, boolean, boolean, boolean, boolean];

/** Identifiant de l'écran (type `Ecran` de navigation.ts) pour l'événement `retour_systeme`. */
export function ecranDe([titre, onglet, vue, aide, serie, theme, plein, changer, intro]: EtatApp): Ecran {
  if (aide) return 'aide';
  if (intro) return 'intro_regles';
  switch (titre.quoi) {
    case 'accueil': return changer ? 'feuille_changer' : 'jouer';
    case 'compte': return 'creer_compte';
    case 'lecon': return theme ? 'theme' : 'lecon';
    case 'partie': return titre.guidee ? 'partie_guidee' : titre.contre ? 'partie_ordi' : 'partie_deux';
    case 'direct': return plein ? 'partie_direct' : 'en_ligne_direct';
    case 'lente': return 'en_ligne_lente';
    case 'enLigne': return 'partie_defi';
    case 'defi': return 'defis';
    case 'partagee': return 'partie_partagee';
    case 'placement': return 'placement';
    case 'revisions': return 'seance_revisions';
    case 'decouverte': return 'partie_decouverte';
  }
  if (onglet === 'apprendre') return serie ? 'serie_lecon' : 'apprendre';
  if (onglet !== 'profil') return onglet;
  return vue === 'menu' ? 'profil' : vue === 'parties' ? 'mes_parties' : vue as Ecran;
}

interface EtatHistorique { mochiNav?: number; garde?: boolean }

const MARQUE = 'mochiNav';

const visible = (el: Element) => (el as HTMLElement).getClientRects().length > 0;

/** Le dernier élément visible qui répond au sélecteur (un écran posé par-dessus vient après dans le document). */
function dernier(selecteur: string): HTMLElement | null {
  const tous = document.querySelectorAll<HTMLElement>(selecteur);
  for (let i = tous.length - 1; i >= 0; i--) if (visible(tous[i])) return tous[i];
  return null;
}

/** Menu déroulant ouvert (menu « Plus » de la partie). */
const MENU = '[data-action="plus"][aria-expanded="true"]';
const BOUTON = '.retour, [data-retour]';
/** Une fenêtre ouverte, une question en attente, un menu ouvert ou un bouton « ‹ » : il y a quelque chose à fermer. */
const SELECTEUR = `dialog[open], [data-choix] .coach-choix, ${MENU}, ${BOUTON}`;

/** Fait un retour : ferme ou quitte ce qui est au-dessus (voir l'ordre en tête de fichier). */
export function faireRetour(b: Pick<Branchement, 'repli'>): void {
  const fenetres = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
  const fenetre = fenetres[fenetres.length - 1];
  if (fenetre) {
    // Comme Échap : une fenêtre qui refuse `cancel` (écran bloquant) reste ouverte.
    if (fenetre.dispatchEvent(new Event('cancel', { cancelable: true }))) fenetre.close();
    return;
  }
  const question = dernier('[data-choix] .coach-choix .primary');
  if (question) { question.click(); return; }
  const menu = dernier(MENU);
  if (menu) { menu.click(); return; }
  const bouton = dernier(BOUTON);
  if (bouton) { bouton.click(); return; }
  b.repli();
}

/**
 * Écran du suivi. Un sous-écran tenu par son composant (problème ouvert dans Problèmes, Ouvertures dans Apprendre)
 * n'est pas connu d'App.tsx : son bouton « ‹ » le trahit.
 */
function ecranVu(e: Ecran): Ecran {
  if ((e === 'problemes' || e === 'apprendre') && dernier(BOUTON)) return e === 'problemes' ? 'probleme' : 'ouvertures';
  return e;
}

/**
 * Branche le retour du système. `lire` donne l'état courant d'App.tsx (relu à chaque retour). Renvoie `verifier`
 * (à appeler après chaque rendu d'App.tsx : pose ou retire la garde) et `arreter`.
 */
export function brancherRetourSysteme(lire: () => Branchement, h: History = history, w: Window = window): { verifier: () => void; arreter: () => void } {
  const etat = (): EtatHistorique => (h.state && typeof h.state === 'object' ? h.state as EtatHistorique : {});
  // Entrée courante : son rang (`mochiNav`) et si c'est la garde. Au chargement, l'entrée devient l'entrée de l'app
  // (rang 0), même après un rechargement sur une garde : l'écran est de nouveau la racine.
  let rang = 0;
  let garde = false;
  /** Retours lancés par nous (retrait de la garde) : leur `popstate` n'est pas un retour du joueur. */
  let enAttente = 0;
  try { h.replaceState({ ...etat(), [MARQUE]: 0, garde: false }, ''); } catch { /* historique indisponible */ }

  const besoin = () => lire().horsRacine() || document.querySelector(SELECTEUR) !== null;

  const poser = () => {
    try { h.pushState({ [MARQUE]: rang + 1, garde: true }, ''); rang++; garde = true; } catch { /* trop d'appels : ignoré */ }
  };

  function verifier() {
    if (enAttente > 0) return;
    const b2 = besoin();
    if (b2 && !garde) poser();
    else if (!b2 && garde) { enAttente++; h.back(); }
  }

  let prevu = 0;
  const plusTard = () => { if (!prevu) prevu = w.requestAnimationFrame(() => { prevu = 0; verifier(); }); };

  function surPopstate(e: PopStateEvent) {
    const s = (e.state && typeof e.state === 'object' ? e.state : {}) as EtatHistorique;
    const n = typeof s.mochiNav === 'number' ? s.mochiNav : null;
    if (enAttente > 0) {
      enAttente--;
      rang = n ?? rang; garde = !!s.garde;
      plusTard();
      return;
    }
    if (n === null) {
      // Entrée qui n'est pas à nous, en avant : lien de défi ou de partie ouvert dans l'onglet (`#defi=`, `#partie=`).
      // Elle devient l'entrée de l'app ; l'écran du lien la reçoit par `hashchange`.
      rang++; garde = false;
      try { h.replaceState({ ...s, [MARQUE]: rang, garde: false }, ''); } catch { /* ignoré */ }
      plusTard();
      return;
    }
    const enArriere = n < rang;
    rang = n; garde = !!s.garde;
    if (!enArriere) { plusTard(); return; }
    // Retour du joueur. La garde revient tout de suite : un second retour rapide refait un « ‹ » au lieu de sortir.
    const ecran = ecranVu(ecranDe(lire().etat()));
    if (!garde) poser();
    track(EVENTS.retourSysteme, { ecran });
    faireRetour(lire());
    plusTard();
  }

  function surTouche(e: KeyboardEvent) {
    if (e.key !== 'Escape' || e.defaultPrevented || e.repeat) return;
    // Une fenêtre ouverte se ferme d'elle-même (Échap natif) ; un champ de saisie garde sa touche.
    if (document.querySelector('dialog[open]')) return;
    const cible = e.target as HTMLElement | null;
    if (cible && (cible.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName))) return;
    // Après les autres écouteurs (menu de la partie, révision ouverte) : s'ils ont pris la touche, rien de plus.
    w.setTimeout(() => {
      if (e.defaultPrevented || !besoin()) return;
      track(EVENTS.retourSysteme, { ecran: ecranVu(ecranDe(lire().etat())) });
      faireRetour(lire());
      plusTard();
    }, 0);
  }

  // Une feuille, une question ou un sous-écran ouvert dans un composant (sans rendu d'App.tsx) : on revérifie.
  const observateur = new MutationObserver(plusTard);
  observateur.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'aria-expanded'] });
  w.addEventListener('popstate', surPopstate);
  w.addEventListener('keydown', surTouche);
  verifier();
  return {
    verifier: plusTard,
    arreter: () => {
      observateur.disconnect();
      w.removeEventListener('popstate', surPopstate);
      w.removeEventListener('keydown', surTouche);
      if (prevu) w.cancelAnimationFrame(prevu);
    },
  };
}
