// Widget Cloudflare Turnstile (#531), monté seulement si la clé du site existe (src/data/turnstile.ts). Il donne un
// jeton à usage unique : après chaque envoi, l'écran change `cle` pour en demander un nouveau. Invisible le plus
// souvent (« interaction-only ») ; s'il demande une action, il prend toute la largeur (cible bien plus grande que
// 44 px), dans le thème de l'appareil et la langue de l'interface.
import { useEffect, useRef } from 'react';
import { chargerTurnstile, cleTurnstile } from '../data/turnstile';
import { langue } from '../content/i18n';

interface Props {
  /** Jeton reçu, ou null (expiré, en erreur, ou pas encore là). */
  onJeton: (jeton: string | null) => void;
  /** Le script n'a pas pu être chargé ou le widget est en erreur. */
  onErreur: () => void;
  /** Changer cette valeur remonte le widget (nouveau jeton). */
  cle: number;
  /** Libellé lu par les lecteurs d'écran. */
  libelle: string;
}

export function Captcha({ onJeton, onErreur, cle, libelle }: Props) {
  const ici = useRef<HTMLDivElement>(null);
  // Les rappels changent à chaque rendu : on garde les derniers sans remonter le widget.
  const rappels = useRef({ onJeton, onErreur });
  rappels.current = { onJeton, onErreur };

  useEffect(() => {
    let vivant = true;
    let id: string | undefined;
    rappels.current.onJeton(null);
    chargerTurnstile().then(api => {
      if (!vivant || !ici.current) return;
      id = api.render(ici.current, {
        sitekey: cleTurnstile(),
        callback: j => { if (vivant) rappels.current.onJeton(j); },
        'expired-callback': () => { if (vivant) rappels.current.onJeton(null); },
        'error-callback': () => { if (vivant) { rappels.current.onJeton(null); rappels.current.onErreur(); } },
        theme: 'auto',
        language: langue(),
        size: 'flexible',
        appearance: 'interaction-only',
        action: 'connexion',
      });
    }, () => { if (vivant) rappels.current.onErreur(); });
    return () => {
      vivant = false;
      const w = window as unknown as { turnstile?: { remove(id: string): void } };
      if (id) try { w.turnstile?.remove(id); } catch { /* widget déjà retiré */ }
    };
  }, [cle]);

  return <div ref={ici} className="captcha" role="group" aria-label={libelle} data-testid="captcha" style={{ width: '100%' }} />;
}
