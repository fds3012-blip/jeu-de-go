// Mochi, le chat coach, a deux rendus (#527, règle validée par Florian, charte `.claude/skills/personnages-go`) :
// - le sceau jade (`<Mochi>`) pour les messages d'interface : bandeaux, aides, états vides, confirmations, accueil ;
// - le portrait (`<PortraitMochi>`, src/ui/Portrait.tsx, avec ses humeurs) quand Mochi parle de la partie ou de
//   l'exercice du joueur : coach en partie, revue, bilan, « Rejouer mes erreurs », leçon, problèmes, découverte,
//   introduction des règles.
// La règle est figée écran par écran par src/ui/mochiRegle.test.ts.
import type { ReactNode } from 'react';
import { PortraitMochi, type HumeurMochi } from './Portrait';
import { Sceau } from './Sceau';

/** Mochi, le chat coach : son sceau jade (docs/design/v2/sceaux.html). Pour les messages d'interface. */
export function Mochi({ size = 44 }: { size?: number }) {
  return <Sceau id="mochi" taille={size} />;
}

/**
 * Qui parle dans la bulle :
 * - `interface` : un message de l'app (aide, état, accueil) : le sceau ;
 * - `coach` : Mochi parle de ta partie ou de ton exercice : le portrait.
 */
export type VoixMochi = 'interface' | 'coach';

/** Bulle de dialogue de Mochi. `voix` choisit son visage (voir en tête de fichier). */
export function Bubble({ children, voix, humeur = 'neutre' }: { children: ReactNode; voix: VoixMochi; humeur?: HumeurMochi }) {
  return (
    <div className="bubble" data-voix={voix}>
      {voix === 'coach'
        ? <PortraitMochi humeur={humeur} taille={44} decoratif className="bubble-portrait" />
        : <Sceau id="mochi" taille={44} />}
      <p>{children}</p>
    </div>
  );
}
