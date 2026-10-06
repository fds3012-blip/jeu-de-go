// #440 : « En direct » ou « Partie lente », en tête des deux écrans de la partie en ligne. Le choix est mémorisé par
// l'app (src/app/enLigne.ts) : la prochaine fois, « Jouer en ligne » rouvre la même façon de jouer.
import { tl } from '../content/i18n/lente';

export type FaconEnLigne = 'direct' | 'lente';

export function BasculeEnLigne({ valeur, onChoix }: { valeur: FaconEnLigne; onChoix: (f: FaconEnLigne) => void }) {
  return (
    <div className="seg bascule-en-ligne" role="group" aria-label={tl('lente.bascule')} data-testid="bascule-en-ligne">
      {(['direct', 'lente'] as const).map(f => (
        <button key={f} type="button" aria-pressed={valeur === f} onClick={() => { if (f !== valeur) onChoix(f); }}>
          {tl(f === 'direct' ? 'lente.bascule.direct' : 'lente.bascule.lente')}
        </button>
      ))}
    </div>
  );
}
