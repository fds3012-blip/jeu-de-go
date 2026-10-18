// Progression (issue #109) : barre de niveau, « Niveau 3 · 140 / 155 XP » et la prochaine récompense.
// #613 : elle a quitté l'accueil (« à l'ouverture, le niveau ne sert à rien ») ; elle vit dans le Profil, chargé à la
// demande. La fête de fin (pastille « +N XP », « Niveau N ! ») dit le progrès au moment où il arrive.
import { useEffect, useState, type CSSProperties } from 'react';
import { abonnerXp, libelleRecompense, lireXp, niveauDe, prochaineRecompense } from '../app/xp';
import { fr } from './typo';
import { t } from '../content/i18n';
import './niveau.css';

/** XP de l'appareil, mis à jour à chaque gain. */
function useXp(): number {
  const [xp, setXp] = useState(lireXp);
  useEffect(() => abonnerXp(g => setXp(g.apres)), []);
  return xp;
}

/** Barre compacte : « Niveau 3 · 140 / 155 XP », une pierre qui avance sur une ligne du goban. */
export function BarreNiveau() {
  const xp = useXp();
  const { niveau, dans, besoin } = niveauDe(xp);
  const part = Math.min(100, (dans / besoin) * 100);
  const suivante = prochaineRecompense(niveau);
  return (
    <div className="niveau" data-testid="barre-niveau">
      <p className="niveau-texte">
        <b>{t('niveau.barre', { niveau })}</b>
        <span>{t('niveau.xp', { dans, besoin })}</span>
      </p>
      <div className="niveau-piste" role="progressbar" aria-label={t('niveau.aria', { niveau })} aria-valuemin={0} aria-valuemax={besoin} aria-valuenow={dans}
        aria-valuetext={t('niveau.valeur', { dans, besoin, suivant: niveau + 1 })}
        // #509 (L4) : la part faite en variable CSS, que la ligne et la pierre suivent par transform (niveau.css).
        style={{ '--p': part / 100 } as CSSProperties}>
        <span className="niveau-plein" />
        <span className="niveau-rail"><span className="niveau-pierre" /></span>
      </div>
      {suivante && <p className="niveau-suite">{fr(t('niveau.suite', { niveau: suivante.niveau, recompense: libelleRecompense(suivante) }))}</p>}
    </div>
  );
}
