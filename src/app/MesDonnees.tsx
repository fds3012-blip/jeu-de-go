// « Mes données » (issue #530, reprend #371) : droit d'accès et portabilité. Une seule action : « Télécharger mes
// données ». Le fichier réunit ce que le serveur garde sur le compte (s'il y en a un) et ce que l'appareil garde ; il
// est fait dans le navigateur (src/data/exportDonnees.ts). Plafond du serveur : 3 par heure (message clair).
import { useEffect, useState } from 'react';
import { chargerSupabase, useSupabase } from '../data/client';
import { assembler, donneesAppareil, lireServeur, nomFichier, telechargerJson } from '../data/exportDonnees';
import { EVENTS, track } from '../data/analytics';
import { langue } from '../content/i18n';
import { tdon } from '../content/i18n/donnees';
import { fr } from '../ui/typo';
import '../ui/donnees.css';

type Etat = { quoi: 'pret' } | { quoi: 'enCours' } | { quoi: 'fait'; fichier: string } | { quoi: 'erreur'; message: string };

function stockageLocal(): Storage | undefined {
  try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; }
}

export function MesDonnees({ onMentions }: { onMentions: () => void }) {
  const db = useSupabase();
  useEffect(() => { if (db === undefined) void chargerSupabase(); }, [db]);
  const [compte, setCompte] = useState<boolean | null>(null);
  const [etat, setEtat] = useState<Etat>({ quoi: 'pret' });

  // Avec ou sans compte : le texte dit ce que le fichier contiendra.
  useEffect(() => {
    let vivant = true;
    if (db === undefined) return;
    if (!db) { setCompte(false); return; }
    db.auth.getSession().then(({ data }) => { if (vivant) setCompte(!!data.session); }, () => { if (vivant) setCompte(false); });
    return () => { vivant = false; };
  }, [db]);

  const telecharger = async () => {
    if (etat.quoi === 'enCours') return;
    setEtat({ quoi: 'enCours' });
    const serveur = await lireServeur(db ?? (await chargerSupabase().catch(() => null)));
    if (!serveur.ok) {
      track(EVENTS.donneesTelechargees, { compte: true, resultat: serveur.raison === 'horsLigne' ? 'hors_ligne' : serveur.raison });
      setEtat({ quoi: 'erreur', message: serveur.raison === 'limite' ? tdon('donnees.limite', { n: serveur.minutes })
        : tdon(serveur.raison === 'horsLigne' ? 'donnees.horsLigne' : 'donnees.serveur') });
      return;
    }
    const fichier = nomFichier();
    const contenu = assembler(serveur.serveur, donneesAppareil(stockageLocal()), tdon('donnees.fichierALire'), langue());
    if (!telechargerJson(contenu, fichier)) {
      setEtat({ quoi: 'erreur', message: tdon('donnees.serveur') });
      return;
    }
    track(EVENTS.donneesTelechargees, { compte: serveur.compte, resultat: 'ok' });
    setEtat({ quoi: 'fait', fichier });
  };

  return (
    <div className="donnees">
      <p className="donnees-intro">{fr(tdon('donnees.intro'))}</p>
      <ul className="donnees-contenu">
        {compte !== false && <li>{fr(tdon('donnees.contenuCompte'))}</li>}
        <li>{fr(tdon(compte === false ? 'donnees.sansCompte' : 'donnees.contenuAppareil'))}</li>
      </ul>
      <button type="button" className="btn primary donnees-action" data-testid="telecharger-donnees"
        aria-busy={etat.quoi === 'enCours' || undefined} disabled={etat.quoi === 'enCours' || db === undefined} onClick={() => void telecharger()}>
        {etat.quoi === 'enCours' ? tdon('donnees.enCours') : tdon('donnees.action')}
      </button>
      <p className={`donnees-statut${etat.quoi === 'erreur' ? ' erreur' : ''}`} role="status" aria-live="polite">
        {etat.quoi === 'fait' ? fr(tdon('donnees.fait', { fichier: etat.fichier })) : etat.quoi === 'erreur' ? fr(etat.message) : ''}
      </p>
      <p className="donnees-note">{fr(tdon('donnees.secrets'))}</p>
      {compte && <p className="donnees-note">{fr(tdon('donnees.supprimer'))}</p>}
      <button type="button" className="lien donnees-mentions" onClick={onMentions}>{tdon('donnees.mentions')}</button>
    </div>
  );
}
