// Carte « Installe l'app » (issue #178). Montée seulement à un bon moment (première victoire contre l'ordi,
// accueil du 2e retour depuis #214), jamais pendant une partie ; elle décide seule, avec src/app/installation.ts, si elle se montre.
// Une seule fois par appareil : montrée, elle ne revient plus, même sans réponse. « Plus tard » est mémorisé.
// #214 : depuis le Profil (`profil`), c'est le joueur qui la demande : ni « Plus tard », ni repère posé.
// Textes passés par l'i18n (#167, étape 3).
import { useEffect, useId, useRef, useState } from 'react';
import { EVENTS, track } from '../data/analytics';
import {
  abonnerInvite, doitProposer, etatInstallation, noterInstallation, ouvrirInvite, plateformeCourante, type Moment, type Plateforme
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

/** Plateforme d'installation, mise à jour quand l'invite de Chrome arrive après le premier rendu (#214). */
export function usePlateformeInstallation(): Plateforme {
  const [plateforme, setPlateforme] = useState<Plateforme>(plateformeCourante);
  useEffect(() => abonnerInvite(() => setPlateforme(plateformeCourante())), []);
  return plateforme;
}

export function ProposerInstallation({ moment, onFin }: { moment: Moment; /** Appelé quand la carte se ferme (installée, refusée). */ onFin?: () => void }) {
  const demandee = moment === 'profil';
  // Accueil (#214) : carte compacte, pour laisser le goban en vue ; sur iPhone, les deux gestes s'ouvrent sur « Comment faire ? ».
  const compacte = moment === 'retour';
  const [etapes, setEtapes] = useState(!compacte);
  const liste = useRef<HTMLOListElement>(null);
  useEffect(() => { if (compacte && etapes) liste.current?.focus(); }, [compacte, etapes]);
  const plateforme = usePlateformeInstallation();
  // État lu une fois : la carte montrée pose « proposée » sans se cacher elle-même.
  const [etat] = useState(etatInstallation);
  const [fermee, setFermee] = useState(false);
  const visible = !fermee && doitProposer({ plateforme, etat, moment, enPartie: false });
  const setVisible = (v: boolean) => setFermee(!v);
  const [attente, setAttente] = useState(false);
  const annoncee = useRef(false);
  const titre = useId();

  useEffect(() => {
    if (!visible || annoncee.current) return;
    annoncee.current = true;
    if (!demandee) noterInstallation('proposee');
    track(EVENTS.installationProposee, { plateforme, moment });
  }, [visible, plateforme, moment, demandee]);

  if (!visible) return null;

  function plusTard() {
    noterInstallation('refusee');
    setVisible(false);
    onFin?.();
  }

  async function installer() {
    setAttente(true);
    const choix = await ouvrirInvite();
    if (choix === 'accepted') {
      noterInstallation('acceptee');
      track(EVENTS.installationAcceptee, { plateforme, moment });
    } else if (!demandee) {
      noterInstallation('refusee');
    }
    setVisible(false);
    onFin?.();
  }

  return (
    <aside className={`installer${demandee ? ' installer-demandee' : ''}${compacte ? ' installer-compacte' : ''}`} aria-labelledby={titre} data-plateforme={plateforme} data-moment={moment}>
      <div className="installer-tete">
        <img className="installer-app" src="/icon-192.png" alt="" width="44" height="44" />
        <div>
          <h3 id={titre}>{t('installer.titre')}</h3>
          <p>{fr(t(compacte ? 'installer.texteCourt' : 'installer.texte'))}</p>
        </div>
      </div>
      {plateforme === 'ios' && etapes ? (
        <ol className="installer-etapes" ref={liste} tabIndex={-1}>
          <li><span className="installer-num" aria-hidden="true">1</span>{t('installer.touche')}<IconePartager /><b>{t('installer.partager')}</b></li>
          <li><span className="installer-num" aria-hidden="true">2</span>{t('installer.choisis')}<IconeAjouter /><b>{t('installer.ecranAccueil')}</b></li>
        </ol>
      ) : null}
      {(plateforme === 'chrome' || !demandee) && <div className="installer-actions">
        {plateforme === 'ios' && !etapes && (
          <button type="button" className="btn installer-oui" aria-expanded={false} onClick={() => setEtapes(true)}>{t('installer.comment')}</button>
        )}
        {plateforme === 'chrome' && (
          <button type="button" className="btn installer-oui" onClick={installer} disabled={attente}>{t('installer.oui')}</button>
        )}
        {!demandee && <button type="button" className="lien lien-discret" onClick={plusTard} disabled={attente}>{t('installer.plusTard')}</button>}
      </div>}
    </aside>
  );
}
