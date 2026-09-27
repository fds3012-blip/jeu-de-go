// Écran de fin de partie (issue #40, phase 5 ; docs/design/v2/direction.md, section 6 « Fin de partie »).
// Le plateau final, avec ses territoires, sert de fond sous un voile ; par-dessus, une seule colonne centrée :
// sceau (et tampon « BATTU » qui s'imprime), titre, écart, bilan en une phrase, leçon de Mochi, un bouton en relief.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Mochi } from './Mochi';
import { Confettis } from './Confettis';
import { mouvementsReduits, useDefilement } from './defilement';
import './fin.css';

interface Props {
  /** Plateau final (avec territoires). */
  fond: ReactNode;
  /** Sceau de l'adversaire en 108 px, ou pierre du vainqueur. */
  sceau: ReactNode;
  /** Texte du tampon (« BATTUE »), seulement après une victoire. */
  tampon?: string | null;
  titre: string;
  /** Écart en points (il défile), mis en forme par `texteMarge`. Sans écart : `sousTitre` seul (« par abandon »). */
  marge?: number | null;
  texteMarge?: (v: number) => string;
  sousTitre?: string;
  /** Bilan en une phrase. */
  bilan: ReactNode;
  /** Leçon de la partie par Mochi (texte et, au besoin, un lien vers une leçon). */
  mochi?: ReactNode;
  /** L'action principale : un seul bouton en relief. */
  action: ReactNode;
  onRevoir?: () => void;
  onAccueil: () => void;
  /** Confettis (victoire, réglage « Célébrations » activé). Jamais avec les mouvements réduits. */
  confettis?: boolean;
}

export function FinPartie({ fond, sceau, tampon, titre, marge, texteMarge, sousTitre, bilan, mochi, action, onRevoir, onAccueil, confettis = false }: Props) {
  const [reduit] = useState(mouvementsReduits);
  const titreRef = useRef<HTMLHeadingElement>(null);
  const sceauRef = useRef<HTMLDivElement>(null);
  const [gerbe, setGerbe] = useState<null | { x: number; y: number }>(null);
  const [gerbeFinie, setGerbeFinie] = useState(false);
  const v = useDefilement(marge ?? 0, 600, !reduit && marge != null);

  // Le lecteur d'écran annonce le résultat : le focus va au titre.
  useEffect(() => { titreRef.current?.focus({ preventScroll: true }); }, []);
  // La gerbe part du sceau, au moment où le tampon frappe (après 360 ms).
  useEffect(() => {
    if (!confettis || reduit) return;
    const t = window.setTimeout(() => {
      const r = sceauRef.current?.getBoundingClientRect();
      setGerbe(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight * 0.4 });
    }, 360);
    return () => window.clearTimeout(t);
  }, [confettis, reduit]);

  return (
    <section className="fin" aria-labelledby="fin-titre">
      <div className="fin-fond">
        {fond}
        <div className="fin-voile" aria-hidden="true" />
      </div>
      <div className="fin-feuille">
        <div className="fin-sceau" ref={sceauRef}>
          {sceau}
          {tampon && <span className="fin-tampon">{tampon}</span>}
        </div>
        <h2 id="fin-titre" className="fin-titre" ref={titreRef} tabIndex={-1}>{titre}</h2>
        {marge != null && texteMarge ? (
          <p className="fin-marge">
            <span aria-hidden="true">{texteMarge(v)}</span>
            <span className="sr-only">{texteMarge(marge)}</span>
          </p>
        ) : sousTitre && <p className="fin-marge">{sousTitre}</p>}
        <p className="fin-bilan">{bilan}</p>
        {mochi && (
          <div className="fin-mochi">
            <Mochi size={44} />
            <div>{mochi}</div>
          </div>
        )}
        <div className="fin-action">{action}</div>
        <div className="fin-liens">
          {onRevoir && <button type="button" className="lien" onClick={onRevoir}>Revoir ma partie</button>}
          <button type="button" className="lien lien-discret" onClick={onAccueil}>Accueil</button>
        </div>
      </div>
      {gerbe && !gerbeFinie && <Confettis origine={gerbe} onFin={() => setGerbeFinie(true)} />}
    </section>
  );
}
