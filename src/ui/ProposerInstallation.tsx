// Carte « Installe l'app » (issue #178). Montée seulement à un bon moment (première victoire contre l'ordi,
// Go du jour réussi), jamais pendant une partie ; elle décide seule, avec src/app/installation.ts, si elle se montre.
// Une seule fois par appareil : montrée, elle ne revient plus, même sans réponse. « Plus tard » est mémorisé.
// Textes passés par l'i18n (#167, étape 3).
import { useEffect, useId, useRef, useState } from 'react';
import { EVENTS, track } from '../data/analytics';
import {
  doitProposer, etatInstallation, noterInstallation, ouvrirInvite, plateformeCourante, type Moment, type Plateforme
} from '../app/installation';
import { fr } from './typo';
import { t } from '../content/i18n';
import './installation.css';

/** Icône « Partager » de Safari : un carré ouvert et une flèche vers le haut. */
function IconePartager() {
  return (
    <svg className="installer-icone" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d="M12 3v11M8 7l4-4 4 4M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H16" />
    </svg>
  );
}

/** Icône « Sur l'écran d'accueil » : un carré arrondi et un plus. */
function IconeAjouter() {
  return (
    <svg className="installer-icone" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

export function ProposerInstallation({ moment }: { moment: Moment }) {
  const [plateforme] = useState<Plateforme>(plateformeCourante);
  const [visible, setVisible] = useState(() => doitProposer({ plateforme, etat: etatInstallation(), moment, enPartie: false }));
  const [attente, setAttente] = useState(false);
  const annoncee = useRef(false);
  const titre = useId();

  useEffect(() => {
    if (!visible || annoncee.current) return;
    annoncee.current = true;
    noterInstallation('proposee');
    track(EVENTS.installationProposee, { plateforme, moment });
  }, [visible, plateforme, moment]);

  if (!visible) return null;

  function plusTard() {
    noterInstallation('refusee');
    setVisible(false);
  }

  async function installer() {
    setAttente(true);
    const choix = await ouvrirInvite();
    if (choix === 'accepted') {
      noterInstallation('acceptee');
      track(EVENTS.installationAcceptee, { plateforme, moment });
    } else {
      noterInstallation('refusee');
    }
    setVisible(false);
  }

  return (
    <aside className="installer" aria-labelledby={titre} data-plateforme={plateforme}>
      <div className="installer-tete">
        <img className="installer-app" src="/icon-192.png" alt="" width="44" height="44" />
        <div>
          <h3 id={titre}>{t('installer.titre')}</h3>
          <p>{fr(t('installer.texte'))}</p>
        </div>
      </div>
      {plateforme === 'ios' ? (
        <ol className="installer-etapes">
          <li><span className="installer-num" aria-hidden="true">1</span>{t('installer.touche')}<IconePartager /><b>{t('installer.partager')}</b></li>
          <li><span className="installer-num" aria-hidden="true">2</span>{t('installer.choisis')}<IconeAjouter /><b>{t('installer.ecranAccueil')}</b></li>
        </ol>
      ) : null}
      <div className="installer-actions">
        {plateforme === 'chrome' && (
          <button type="button" className="btn installer-oui" onClick={installer} disabled={attente}>{t('installer.oui')}</button>
        )}
        <button type="button" className="lien lien-discret" onClick={plusTard} disabled={attente}>{t('installer.plusTard')}</button>
      </div>
    </aside>
  );
}
