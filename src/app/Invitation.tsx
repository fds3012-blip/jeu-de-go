// « Inviter un ami » (#729), encart de « Mes amis » (Profil), chargé à la demande quand on l'ouvre. Une phrase, le cadeau, un
// seul bouton : « Partager mon lien » (feuille native du téléphone, sinon lien copié, sinon lien à copier à la main).
// Le serveur fait foi : le code, le nombre d'amis arrivés et les cadeaux viennent de `mon_invitation()`. On ne voit jamais
// QUI est arrivé. Mesure : `invitation_partagee` (`methode`). Règles et données : docs/produit/invitation-2026-10.md.
import './../ui/invitation.css';
import { useEffect, useRef, useState } from 'react';
import type { Db } from '../data/supabase';
import { EVENTS, track } from '../data/analytics';
import { lienInvitation, monInvitation, type EtatInvitation } from '../data/invitation';
import { langue } from '../content/i18n';
import { ti } from '../content/i18n/invitation';
import { fr } from '../ui/typo';
import { IconePartagerApp } from '../ui/PartagerApp';
import { RECOMPENSES, libelleRecompense } from './xp';

type Charge = { etat: 'chargement' } | { etat: 'erreur' } | { etat: 'pret'; v: EtatInvitation };
type Retour = '' | 'copie' | 'manuel';

/** Feuille native, sinon copie, sinon lien montré. Mesure `invitation_partagee` (`methode`), sans le code. */
async function partager(lien: string): Promise<Retour> {
  const texte = ti('inv.texteLien');
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: ti('inv.titreLien'), text: texte, url: lien });
      track(EVENTS.invitationPartagee, { methode: 'partage' });
      return '';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') { track(EVENTS.invitationPartagee, { methode: 'annule' }); return ''; }
    }
  }
  try {
    await navigator.clipboard.writeText(`${texte} ${lien}`);
    track(EVENTS.invitationPartagee, { methode: 'copie' });
    return 'copie';
  } catch {
    track(EVENTS.invitationPartagee, { methode: 'manuel' });
    return 'manuel';
  }
}

export default function Invitation({ db, online }: { db: Db; online: boolean }) {
  const [charge, setCharge] = useState<Charge>({ etat: 'chargement' });
  const [retour, setRetour] = useState<Retour>('');
  const [essai, setEssai] = useState(0);
  const encours = useRef(false);

  useEffect(() => {
    let fini = false;
    void monInvitation(db).then(r => { if (!fini) setCharge(r.ok ? { etat: 'pret', v: r.value } : { etat: 'erreur' }); });
    return () => { fini = true; };
  }, [db, essai]);
  useEffect(() => {
    if (retour !== 'copie') return;
    const id = window.setTimeout(() => setRetour(''), 2000);
    return () => window.clearTimeout(id);
  }, [retour]);

  if (charge.etat === 'chargement') return <section className="invitation card" aria-busy="true"><p className="muted small">{ti('inv.chargement')}</p></section>;
  if (charge.etat === 'erreur') {
    return (
      <section className="invitation card" role="alert">
        <p className="small">{fr(ti('inv.erreur'))} <button type="button" className="lien" onClick={() => { setCharge({ etat: 'chargement' }); setEssai(n => n + 1); }}>{ti('inv.reessayer')}</button></p>
      </section>
    );
  }
  const { code, amis, plafond, cadeaux } = charge.v;
  const lien = lienInvitation(code, langue());
  const lancer = async () => {
    if (encours.current) return;
    encours.current = true;
    try { setRetour(await partager(lien)); } finally { encours.current = false; }
  };
  const progres = amis === 0 ? ti('inv.progres0') : amis === 1 ? ti('inv.progres1', { max: plafond }) : ti('inv.progresN', { n: amis, max: plafond });
  return (
    <section className="invitation card" aria-labelledby="invitation-titre" data-testid="invitation">
      <h3 id="invitation-titre" className="invitation-titre">{ti('inv.titre')}</h3>
      <p className="invitation-texte">{fr(ti('inv.texte'))}</p>
      <button type="button" className={`btn invitation-bouton${retour === 'copie' ? ' copie' : ''}`} disabled={!online} onClick={() => void lancer()}>
        <IconePartagerApp coche={retour === 'copie'} />{retour === 'copie' ? ti('inv.copie') : ti('inv.bouton')}
      </button>
      <p className="sr-only" role="status" aria-live="polite">{retour === 'copie' ? ti('inv.copieAnnonce') : ''}</p>
      {!online && <p className="muted small">{fr(ti('inv.horsLigne'))}</p>}
      {retour === 'manuel' && (
        <div className="invitation-manuel" role="alert">
          <p>{ti('inv.copierManuel')}</p>
          <input readOnly value={lien} aria-label={ti('inv.lienAria')} onFocus={e => e.currentTarget.select()} />
        </div>
      )}
      <p className="invitation-progres small" data-testid="invitation-progres">{amis >= plafond ? ti('inv.complet', { max: plafond }) : progres}</p>
      {amis < 3 && !cadeaux.includes('jade') && <p className="muted small">{ti('inv.jade')}</p>}
      {cadeaux.length > 0 && (
        <div className="invitation-cadeaux">
          <h4>{ti('inv.cadeaux')}</h4>
          <ul>
            {RECOMPENSES.filter(r => (cadeaux as readonly string[]).includes(r.id)).map(r => <li key={r.id} data-cadeau={r.id}>{libelleRecompense(r)}</li>)}
          </ul>
          <p className="muted small">{ti('inv.cadeauAide')}</p>
        </div>
      )}
    </section>
  );
}
