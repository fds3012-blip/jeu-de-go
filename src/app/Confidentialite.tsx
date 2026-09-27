import { useEffect, useRef, type KeyboardEvent } from 'react';
import { setConsent } from '../data/analytics';
import { useConsentement } from './consentement';
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
        <h2 id="accord-titre" tabIndex={-1}>Aide-nous à améliorer le jeu</h2>
        <p id="accord-texte">On aimerait compter les parties et repérer les bugs, sans jamais voir ton e-mail ni tes coups.</p>
        <button type="button" className="lien accord-conditions" onClick={onConditions}>Lire les conditions</button>
        <div className="accord-actions">
          <button type="button" className="btn primary" onClick={() => setConsent('accepte')}>Accepter</button>
          <button type="button" className="btn accord-refuser" onClick={() => setConsent('refuse')}>Refuser</button>
        </div>
        </div>
    </dialog>
  );
}

/** Page « Conditions et confidentialité » : l'interrupteur pour changer d'avis, puis les données collectées. */
export function Conditions({ onRetour }: { onRetour: () => void }) {
  const consent = useConsentement();
  return (
    <section className="sous-vue" aria-labelledby="conditions-titre">
      <button type="button" className="back retour" onClick={onRetour}>
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M10 3.5 5.5 8 10 12.5" /></svg>Retour
      </button>
      <h2 id="conditions-titre">Conditions et confidentialité</h2>
      <div className="lignes">
        <LigneInterrupteur libelle="Mesure d’audience et erreurs" aide="Refuser ne t’enlève aucune fonction."
          actif={consent === 'accepte'} onChange={v => setConsent(v ? 'accepte' : 'refuse')} />
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
          <h3>Seulement si tu acceptes la mesure d’audience</h3>
          <p>
            PostHog (serveurs dans l’Union européenne) reçoit quelques événements : ouverture de l’app, première pierre, partie terminée
            (taille, adversaire, résultat), leçon terminée, création de compte. Avec un identifiant tiré au hasard, et l’identifiant de ton compte si tu es connecté.
            Jamais ton e-mail ni tes coups. Ton adresse IP n’est pas conservée.
          </p>
          <p>Sentry (serveurs en Allemagne) reçoit les rapports d’erreur : message d’erreur, version de l’app, navigateur.</p>
        </div>
        <div className="card small">
          <h3>Tes droits</h3>
          <p>
            Tu peux retirer ton accord à tout moment avec l’interrupteur en haut de cette page. Tu peux aussi demander à voir,
            corriger ou effacer tes données. Sans compte, effacer les données du site dans ton navigateur supprime tout ce qui est sur ce téléphone.
          </p>
        </div>
      </div>
    </section>
  );
}
