import { useSyncExternalStore } from 'react';
import { analyticsAvailable, getConsent, setConsent, subscribeConsent, type Consent } from '../data/analytics';

function useConsent(): Consent | null {
  return useSyncExternalStore(subscribeConsent, getConsent, () => null);
}

/** Bandeau court, affiché tant que le joueur n'a pas choisi. Placé dans le flux : il ne recouvre rien. */
export function ConsentBanner({ onMore }: { onMore?: () => void }) {
  const consent = useConsent();
  if (consent !== null || !analyticsAvailable()) return null;
  return (
    <section className="card consent" aria-label="Mesure d'audience">
      <p className="small" style={{ margin: 0 }}>
        On aimerait mesurer l’usage de l’app et ses erreurs pour l’améliorer. Rien n’est envoyé sans ton accord.
      </p>
      {onMore && <button className="link small" onClick={onMore}>En savoir plus</button>}
      <div className="row" style={{ marginTop: 4 }}>
        <button className="btn" onClick={() => setConsent('refuse')}>Refuser</button>
        <button className="btn" onClick={() => setConsent('accepte')}>Accepter</button>
      </div>
    </section>
  );
}

/** Section « Confidentialité » du Profil : réglage du consentement et données collectées. */
export function Confidentialite() {
  const consent = useConsent();
  return (
    <div>
      {analyticsAvailable() && (
        <>
          <p className="muted small">Mesure d’audience et rapports d’erreur</p>
          <div className="seg">
            <button aria-pressed={consent === 'accepte'} onClick={() => setConsent('accepte')}>Oui</button>
            <button aria-pressed={consent === 'refuse'} onClick={() => setConsent('refuse')}>Non</button>
          </div>
          <p className="muted small">Refuser ne t’enlève aucune fonction. Tu peux changer d’avis à tout moment.</p>
        </>
      )}
      <div className="card small">
        <b>Ce qui reste sur ton téléphone</b>
        <p style={{ margin: '4px 0 0' }}>Tes réglages et ta progression dans les leçons. L’ordi calcule ses coups sur ton téléphone : tes parties contre lui ne sont pas envoyées.</p>
      </div>
      <div className="card small">
        <b>Si tu crées un compte</b>
        <p style={{ margin: '4px 0 0' }}>Ton adresse e-mail, ton pseudo et ta cote sont enregistrés chez Supabase, sur des serveurs à Paris. Ils servent à te connecter et à jouer en ligne.</p>
      </div>
      <div className="card small">
        <b>Seulement si tu acceptes la mesure d’audience</b>
        <p style={{ margin: '4px 0 0' }}>
          PostHog (serveurs dans l’Union européenne) reçoit quelques événements : ouverture de l’app, première pierre, partie terminée
          (taille, adversaire, résultat), leçon terminée, création de compte. Avec un identifiant tiré au hasard, et l’identifiant de ton compte si tu es connecté.
          Jamais ton e-mail ni tes coups. Ton adresse IP n’est pas conservée.
        </p>
        <p style={{ margin: '6px 0 0' }}>
          Sentry (serveurs en Allemagne) reçoit les rapports d’erreur : message d’erreur, version de l’app, navigateur.
        </p>
      </div>
    </div>
  );
}
