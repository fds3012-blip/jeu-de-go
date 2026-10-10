// Premier geste réel de la page (#519, rapport docs/data/mesure-lancement-2026-10.md, section 5.1).
//
// Environ 87 % des « premiers écrans » comptés étaient des robots : ils chargent la page et exécutent le JS, mais ne
// touchent rien. Le premier `pointerdown` ou `keydown` émis par une personne (`isTrusted` : jamais un événement fabriqué
// par un script de la page) donne un dénominateur humain :
// - compteur anonyme `premier_geste` (src/data/compteurs.ts : une fois par appareil neuf, rien sur un navigateur piloté) ;
// - événement PostHog `premier_geste` (`secondes`, `nouveau`), une fois par session sans accord.
// Rien n'est lu du geste lui-même : ni la touche, ni la position, ni la cible.
import { compterEtape } from '../data/compteurs';
import { EVENTS, secondsSinceOpen, trackOnce } from '../data/analytics';

type Cible = Pick<Window, 'addEventListener' | 'removeEventListener'>;
const TYPES = ['pointerdown', 'keydown'] as const;

/**
 * Écoute le premier geste réel, le mesure, puis cesse d'écouter. `nouveau` : tout premier lancement sur l'appareil.
 * Rend la fonction qui retire l'écoute (démontage).
 */
export function ecouterPremierGeste(nouveau: boolean, cible: Cible | null = typeof window === 'undefined' ? null : window): () => void {
  if (!cible || typeof cible.addEventListener !== 'function') return () => {};
  const options = { capture: true, passive: true } as const;
  const retirer = () => TYPES.forEach(t => cible.removeEventListener(t, surGeste, options));
  function surGeste(e: Event) {
    if (!e.isTrusted) return;
    retirer();
    compterEtape('premier_geste');
    trackOnce(EVENTS.premierGeste, { secondes: secondsSinceOpen(), nouveau });
  }
  TYPES.forEach(t => cible.addEventListener(t, surGeste, options));
  return retirer;
}
