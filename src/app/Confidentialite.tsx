import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { setConsent, setOpposition } from '../data/analytics';
import { useConsentement, useOpposition } from './consentement';
import { Sceau } from '../ui/Sceau';
import { LigneInterrupteur } from '../ui/Reglage';
import { FINE } from '../ui/typo';

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
        <h2 id="accord-titre" tabIndex={-1}>Tu m’aides à chasser les bugs{FINE}?</h2>
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
        <p className="conditions-intro">Pas de pub. Tes données ne sont jamais vendues.</p>
        <Repli titre="Ce qu’on garde" ouvert>
          <p><strong>Sur ton téléphone{FINE}:</strong> tes réglages et ta progression. L’ordi calcule ses coups ici{FINE}: tes parties contre lui ne partent pas.</p>
          <p><strong>Si tu crées un compte{FINE}:</strong> ton e-mail, ton pseudo, ta cote, tes parties en ligne, tes badges. Chez Supabase, à Paris.</p>
          <p><strong>Comptage anonyme{FINE}:</strong> quelques événements (partie jouée, leçon finie) chez PostHog, dans l’Union européenne. Sans cookie, sans identifiant, sans ton adresse IP.</p>
          <p><strong>Seulement si tu dis oui{FINE}:</strong> les rapports de bug chez Sentry, et un identifiant pour voir si tu reviens jouer. Jamais ton e-mail ni tes coups.</p>
        </Repli>
        <Repli titre="Pourquoi">
          <p>Ton compte sert à te connecter, à jouer en ligne et à garder ta progression partout.</p>
          <p>Le comptage nous dit combien de parties se jouent. Les rapports de bug nous aident à réparer vite.</p>
          <p>Le site est hébergé par Vercel. Personne d’autre ne reçoit tes données.</p>
        </Repli>
        <Repli titre="Combien de temps">
          <p><strong>Compte{FINE}:</strong> tant qu’il existe. Tu peux le faire effacer quand tu veux.</p>
          <p><strong>Comptage et suivi{FINE}:</strong> 1 an, puis effacés.</p>
          <p><strong>Sur ton téléphone{FINE}:</strong> jusqu’à ce que tu effaces les données du site ou l’app.</p>
        </Repli>
        <Repli titre="Tes droits">
          <p>Change d’avis quand tu veux avec les interrupteurs en haut de la page.</p>
          <p>Tu peux demander à voir, corriger ou effacer tes données. On répond sous un mois.</p>
          <p>Moins de 15 ans{FINE}? Crée ton compte avec un parent.</p>
          <p>Un souci{FINE}? Tu peux aussi saisir la CNIL.</p>
          {/* Aucune adresse inventée : le contact sera ajouté par l'éditeur (docs/juridique/politique-confidentialite.md). */}
          <p className="conditions-contact">Contact{FINE}: bientôt disponible</p>
        </Repli>
      </div>
    </section>
  );
}

/** Section repliable native : clavier et lecteur d'écran gérés par le navigateur. */
function Repli({ titre, ouvert, children }: { titre: string; ouvert?: boolean; children: ReactNode }) {
  return (
    <details className="card small repli" open={ouvert}>
      <summary><h3>{titre}</h3></summary>
      <div className="repli-corps">{children}</div>
    </details>
  );
}
