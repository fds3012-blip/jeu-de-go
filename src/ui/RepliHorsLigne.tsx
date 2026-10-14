// Hors ligne, sans l'IA sur le téléphone, partie demandée contre Bambou ou plus fort (#538) : au lieu d'une partie qui
// attend un téléchargement impossible, une feuille propose Caillou (il joue sans réseau) ou « Plus tard ».
// Feuille en bas d'écran (boîte de dialogue native, styles `.feuille` de l'accueil) : une seule action principale.
import { useEffect, useRef } from 'react';
import { Portrait } from './Portrait';
import { fr } from './typo';
import { thl } from '../content/i18n/horsLigne';
import type { OpponentId } from '../engine';

export default function RepliHorsLigne({ nom, caillou, onCaillou, onPlusTard }: {
  /** Adversaire demandé (« Bambou »). */
  nom: string;
  caillou: OpponentId;
  onCaillou: () => void;
  onPlusTard: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Un seul choix : la fermeture de la feuille (Échap, voile) après « Jouer contre Caillou » ne compte pas.
  const fait = useRef(false);
  const choisir = (f: () => void) => () => { if (fait.current) return; fait.current = true; f(); };
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
    return () => { if (d?.open) d.close?.(); };
  }, []);
  return (
    <dialog ref={ref} className="feuille" aria-labelledby="repli-hl-titre" aria-describedby="repli-hl-texte" data-testid="repli-hors-ligne"
      onClose={choisir(onPlusTard)} onClick={e => { if (e.target === ref.current) choisir(onPlusTard)(); }}>
      <div className="feuille-corps">
        <div className="feuille-tete">
          <h2 id="repli-hl-titre">{thl('repli.titre', { nom })}</h2>
        </div>
        <p id="repli-hl-texte" style={{ margin: 0 }}>{fr(thl('repli.texte'))}</p>
        <p className="muted small">{fr(thl('repli.astuce'))}</p>
        <button type="button" className="btn primary" style={{ gap: 10 }} autoFocus onClick={choisir(onCaillou)}>
          <Portrait id={caillou} taille={28} decoratif signature={false} />{thl('repli.caillou')}
        </button>
        <button type="button" className="lien" onClick={choisir(onPlusTard)}>{thl('repli.plusTard')}</button>
      </div>
    </dialog>
  );
}
