/**
 * Textes anglais chargés à la demande (#325) : interface, leçons et problèmes sortent du JS initial. Un joueur en
 * français ne les télécharge jamais avec l'accueil ; le service worker les met en cache ensuite, avec le reste de l'app.
 *
 * La langue est choisie une fois au chargement (src/content/i18n/detection.ts) ; changer de langue dans le Profil
 * recharge la page. Si c'est l'anglais, ce module attend le morceau des textes anglais avant de rendre la main
 * (`await` au niveau du module) : i18n, leçons et problèmes, qui l'importent, ne s'évaluent qu'après et lisent
 * l'anglais dès leur premier calcul, comme avant.
 *
 * Morceau introuvable (hors ligne sans cache, réseau coupé) : l'app s'ouvre en français plutôt que sur un écran vide.
 * Hors du fil principal (Workers du moteur, qui n'affichent rien) : jamais chargé.
 * Tests (Vitest) : src/content/anglais.setup.ts enregistre l'anglais pour tous les tests.
 */
import { langueDuNavigateur } from './i18n/detection';
import type { Langue } from './i18n/types';
import type { ContenuAnglais } from './anglaisContenu';

let contenu: ContenuAnglais | null = null;

/** Textes anglais, ou `null` s'ils ne sont pas chargés (interface en français). */
export function anglais(): ContenuAnglais | null {
  return contenu;
}

/** Enregistre les textes anglais (chargement ci-dessous ; tests). */
export function enregistrerAnglais(c: ContenuAnglais): void {
  contenu = c;
}

const demandee: Langue = typeof document === 'undefined' ? 'fr' : langueDuNavigateur();

/** Langue de l'interface au chargement : l'anglais seulement si ses textes sont bien arrivés. */
export function langueAuChargement(): Langue {
  return demandee === 'en' && !contenu ? 'fr' : demandee;
}

if (demandee === 'en') {
  try {
    enregistrerAnglais((await import('./anglaisContenu')).ANGLAIS);
  } catch {
    /* textes anglais introuvables : l'interface reste en français (langueAuChargement) */
  }
}
