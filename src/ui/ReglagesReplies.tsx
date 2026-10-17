// #571 (loi de Hick) : réglages d'une partie en ligne repliés derrière leur résumé. Les valeurs par défaut sont sûres
// (9 × 9, temps normal, comptage japonais ; 1 jour par coup) : le joueur voit ce qui sera joué et n'a qu'une action,
// « Trouver un adversaire ». « Changer » ouvre les choix là où ils étaient. Chargé avec Direct et Lentes (à la demande).
import { useId, useState, type ReactNode } from 'react';
import { EVENTS, track } from '../data/analytics';

export function ReglagesReplies({ ecran, resume, changer, masquer, aide, children }: {
  /** Écran mesuré par `plus_ouvert` (`ecran`). */
  ecran: 'direct' | 'lente';
  /** Ce qui sera joué, en une ligne (« 9 × 9 · Normal, 10 min + 3 × 30 s · comptage japonais »). */
  resume: ReactNode;
  changer: string;
  masquer: string;
  /** Texte qui reste lu replié (byo-yomi expliqué, délai par coup). */
  aide?: ReactNode;
  children: ReactNode;
}) {
  const [ouvert, setOuvert] = useState(false);
  const id = useId();
  return (
    <div className="reglages-replies" data-testid="reglages-replies">
      <div className="reglages-replies-tete">
        <p className="reglages-replies-resume" data-testid="reglages-resume">{resume}</p>
        <button type="button" className="lien" aria-expanded={ouvert} aria-controls={ouvert ? id : undefined}
          onClick={() => { if (!ouvert) track(EVENTS.plusOuvert, { ecran }); setOuvert(o => !o); }}>{ouvert ? masquer : changer}</button>
      </div>
      {ouvert ? <div id={id} className="reglages-replies-corps">{children}</div> : aide && <p className="muted small">{aide}</p>}
    </div>
  );
}
