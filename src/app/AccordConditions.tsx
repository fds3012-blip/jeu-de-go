// #583 : compte sans preuve d'accord (créé avant que l'accord soit enregistré, ou conditions changées depuis).
// La même case que la création du compte (`compte.age.case`, CaseAge), une seule action. Montrée une fois à l'ouverture ;
// « Plus tard » la ferme, mais le jeu en ligne reste fermé tant qu'elle n'est pas cochée (App.tsx). Écran chargé à la demande.
import { useId, useState, type FormEvent } from 'react';
import type { Db } from '../data/supabase';
import { CaseAge } from './Connexion';
import { envoyer } from './preuveConditions';
import { Mochi } from '../ui/Mochi';
import { fr } from '../ui/typo';
import { t } from '../content/i18n/secondaires';
import '../ui/compte.css';

export function AccordConditions({ db, userId, onFait, onPlusTard, onConditions }: {
  db: Db; userId: string; onFait: () => void; onPlusTard: () => void; onConditions?: () => void;
}) {
  const id = useId();
  const [coche, setCoche] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const valider = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!coche) { setError(t('conditions.accord.aide')); return; }
    setBusy(true);
    // Réseau coupé : l'accord reste noté sur l'appareil et part à la prochaine ouverture ; le joueur n'est pas bloqué.
    await envoyer(db, userId);
    setBusy(false);
    onFait();
  };

  return (
    <div className="creer-compte" data-testid="accord-conditions">
      <div className="creer-tete">
        <Mochi size={64} />
        <h2 className="creer-titre" id={`${id}-titre`}>{t('conditions.accord.titre')}</h2>
        <p className="creer-raison">{fr(t('conditions.accord.texte'))}</p>
      </div>
      <form className="connexion" onSubmit={valider} noValidate aria-labelledby={`${id}-titre`}>
        <CaseAge id={id} coche={coche} onChange={v => { setCoche(v); setError(''); }} onConditions={onConditions} />
        <p className="small connexion-erreur" role="alert">{error}</p>
        <button className={`btn primary connexion-cta${coche ? '' : ' inactif'}`} type="submit" disabled={busy} aria-disabled={!coche} aria-busy={busy}>
          {t(busy ? 'compte.enregistrement' : 'conditions.accord.valider')}
        </button>
      </form>
      <button type="button" className="lien creer-plus-tard" onClick={onPlusTard}>{t('creer.plusTard')}</button>
    </div>
  );
}
