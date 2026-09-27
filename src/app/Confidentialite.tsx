import { useEffect, useRef, type KeyboardEvent } from 'react';
import { setConsent, setOpposition } from '../data/analytics';
import { useConsentement, useOpposition } from './consentement';
import { Sceau } from '../ui/Sceau';
import { LigneInterrupteur } from '../ui/Reglage';

/**
 * Fenêtre de consentement (issue #50) : posée une seule fois, au premier lancement.
 * Boîte de dialogue modale native : le reste de la page est inerte ; Tab tourne dans la fenêtre.
 * Échap ferme sans choix (`onIgnorer`) : elle reviendra au prochain lancement.
 */
export function ConsentModal({ visible, onConditions, onIgnorer }: { visible: boolean; onConditions: () => void; onIgnorer: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (visible && !d.open) {
      d.showModal?.();
      // Focus sur le titre : lu en premier par les lecteurs d'écran, sans mettre en avant un des deux choix.
      d.querySelector<HTMLElement>('#accord-titre')?.focus();
    }
    if (!visible && d.open) d.close();
  }, [visible]);

  // Focus piégé : Tab et Maj+Tab tournent entre le premier et le dernier bouton de la fenêtre.
  const piege = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== 'Tab' || !ref.current) return;
    const cibles = [...ref.current.querySelectorAll<HTMLElement>('button, a[href]')];
    if (!cibles.length) return;
    const premier = cibles[0], dernier = cibles[cibles.length - 1];
    const actif = document.activeElement as HTMLElement | null;
    const dedans = !!actif && cibles.includes(actif);
    // Depuis le titre (focus d'ouverture) ou hors des boutons : on repart du premier ou du dernier.
    if (e.shiftKey && (actif === premier || !dedans)) { e.preventDefault(); dernier.focus(); }
    else if (!e.shiftKey && (actif === dernier || !dedans)) { e.preventDefault(); premier.focus(); }
  };

  return (
    <dialog ref={ref} className="accord" aria-modal="true" aria-labelledby="accord-titre" aria-describedby="accord-texte"
      // Échap : `cancel`, ou directement `close` quand le navigateur saute `cancel` (aucun geste avant).
      // Une fermeture que l'app n'a pas demandée (visible encore vrai) vaut « pas de choix ».
      onCancel={e => { e.preventDefault(); onIgnorer(); }} onClose={() => { if (visible) onIgnorer(); }} onKeyDown={piege}>
      {/* Contenu toujours rendu : la sortie en fondu garde le texte visible jusqu'au bout. */}
      <div className="accord-corps">
        <Sceau id="mochi" taille={48} />
        <h2 id="accord-titre" tabIndex={-1}>Tu m’aides à chasser les bugs ?</h2>
        <p id="accord-texte">
          Si le jeu plante chez toi, l’équipe reçoit un rapport et répare plus vite. Elle voit aussi si tu reviens jouer,
          pour garder ce qui te plaît. Jamais ton e-mail ni tes coups.
        </p>
        <p className="accord-note">Sans ton accord, on compte juste les parties, sans savoir qui joue.</p>
        <button type="button" className="lien accord-conditions" onClick={onConditions}>Lire les conditions</button>
        {/* Deux choix de même taille et de même poids : aucun n'est mis en avant (issue #64, CNIL). */}
        <div className="accord-actions">
          <button type="button" className="btn accord-choix" onClick={() => setConsent('accepte')}>Oui, j’aide</button>
          <button type="button" className="btn accord-choix" onClick={() => setConsent('refuse')}>Non merci</button>
        </div>
        </div>
    </dialog>
  );
}

/** Page « Conditions et confidentialité » : l'interrupteur pour changer d'avis, puis les données collectées. */
export function Conditions({ onRetour }: { onRetour: () => void }) {
  const consent = useConsentement();
  const oppose = useOpposition();
  return (
    <section className="sous-vue" aria-labelledby="conditions-titre">
      <button type="button" className="back retour" onClick={onRetour}>
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M10 3.5 5.5 8 10 12.5" /></svg>Retour
      </button>
      <h2 id="conditions-titre">Conditions et confidentialité</h2>
      <div className="lignes">
        <LigneInterrupteur libelle="Rapports de bugs et suivi détaillé" aide="Seulement avec ton accord. Refuser ne t’enlève aucune fonction."
          actif={consent === 'accepte'} onChange={v => setConsent(v ? 'accepte' : 'refuse')} />
        <LigneInterrupteur libelle="Comptage anonyme des parties" aide="Sans cookie ni identifiant. Tu peux le couper."
          actif={!oppose} onChange={v => setOpposition(!v)} />
      </div>
      <div className="conditions-texte">
        <div className="card small">
          <h3>Ce qui reste sur ton téléphone</h3>
          <p>Tes réglages et ta progression dans les leçons. L’ordi calcule ses coups sur ton téléphone : tes parties contre lui ne sont pas envoyées.</p>
        </div>
        <div className="card small">
          <h3>Si tu crées un compte</h3>
          <p>Ton adresse e-mail, ton pseudo et ta cote sont enregistrés chez Supabase, sur des serveurs à Paris. Ils servent à te connecter et à jouer en ligne.</p>
        </div>
        <div className="card small">
          <h3>Comptage anonyme, sans ton accord</h3>
          <p>
            Pour savoir combien de parties se jouent, PostHog (serveurs dans l’Union européenne) reçoit quelques événements :
            ouverture de l’app, première pierre, partie terminée (taille, adversaire, résultat), leçon terminée, création de compte.
            Rien n’est écrit sur ton téléphone, aucun identifiant ne te suit d’une visite à l’autre, ton adresse IP n’est pas conservée,
            et ces chiffres ne sont jamais reliés à ton compte ni croisés avec d’autres données. Ils servent seulement à nos statistiques.
          </p>
          <p>Tu peux t’y opposer à tout moment avec l’interrupteur « Comptage anonyme des parties » en haut de cette page.</p>
        </div>
        <div className="card small">
          <h3>Seulement si tu dis oui</h3>
          <p>
            Sentry (serveurs en Allemagne) reçoit les rapports de bug : message d’erreur, version de l’app, navigateur.
            PostHog garde un identifiant tiré au hasard sur ton téléphone, et celui de ton compte si tu es connecté, pour voir si tu reviens jouer.
            Jamais ton e-mail ni tes coups.
          </p>
        </div>
        <div className="card small">
          <h3>Tes droits</h3>
          <p>
            Tu peux changer d’avis à tout moment avec les interrupteurs en haut de cette page. Tu peux aussi demander à voir,
            corriger ou effacer tes données. Sans compte, effacer les données du site dans ton navigateur supprime tout ce qui est sur ce téléphone.
          </p>
        </div>
      </div>
    </section>
  );
}
