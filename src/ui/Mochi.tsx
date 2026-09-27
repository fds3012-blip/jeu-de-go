import type { ReactNode } from 'react';
import { Sceau, type SceauId } from './Sceau';

/** Mochi, le chat coach : son sceau jade (docs/design/v2/sceaux.html). */
export function Mochi({ size = 44 }: { size?: number }) {
  return <Sceau id="mochi" taille={size} />;
}

/**
 * Bulle de dialogue. Par défaut, c'est Mochi qui parle ; `qui` donne la parole à un adversaire (son sceau).
 */
export function Bubble({ children, qui = 'mochi' }: { children: ReactNode; qui?: SceauId }) {
  return (
    <div className="bubble">
      <Sceau id={qui} taille={44} />
      <p>{children}</p>
    </div>
  );
}
