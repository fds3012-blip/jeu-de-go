// Rappel quotidien du Go du jour (issue #36) : la carte de fin de partie, et le réglage du Profil.
// La carte se montre une seule fois (src/app/rappel.ts, doitProposerRappel), à son tour dans la file des célébrations
// (après l'XP et le niveau). « Non merci » est définitif ; le Profil garde toujours le réglage.
// La permission du navigateur n'est demandée qu'au toucher de « Me le rappeler » (Safari l'exige, et c'est plus honnête).
import { useEffect, useId, useRef, useState } from 'react';
import { EVENTS, track } from '../data/analytics';
import { useSupabase } from '../data/client';
import { compteDe } from '../data/defi';
import { usePseudo, useSession } from '../app/hooks';
import {
  activerRappel, changerMoment, couperRappel, doitProposerRappel, etatRappel, MOMENTS, noterRappel, supportCourant,
  type MomentRappel, type Resultat,
} from '../app/rappel';
import { langue, t } from '../content/i18n';
import { useTour } from './celebrations';
import { fr } from './typo';
import { LigneInterrupteur } from './Reglage';
import './installation.css';
import './rappel.css';

type Etape = 'choix' | 'attente' | 'fait' | 'bloque' | 'erreur';

/** Choix du moment : trois boutons de 44 px, un seul pressé. */
function ChoixMoment({ valeur, onChange, desactive, etiquette }: { valeur: MomentRappel; onChange: (m: MomentRappel) => void; desactive?: boolean; etiquette: string }) {
  return (
    <div className="seg rappel-moments" role="group" aria-label={etiquette}>
      {MOMENTS.map(m => (
        <button key={m} type="button" aria-pressed={valeur === m} disabled={desactive} onClick={() => onChange(m)}>{t(`rappel.${m}`)}</button>
      ))}
    </div>
  );
}

const messageDe = (r: Resultat): Etape => (r === 'ok' ? 'fait' : r === 'refuse_navigateur' ? 'bloque' : 'erreur');

/**
 * Carte de fin de partie. `partieFinie` : une partie contre l'ordi vient de se terminer ; `autreCarte` : la carte
 * d'installation est déjà sur cet écran (un seul appel secondaire à la fois).
 */
export function ProposerRappel({ partieFinie, autreCarte }: { partieFinie: boolean; autreCarte: boolean }) {
  const client = useSupabase(); // chargé à la demande (#401)
  const supabase = client ?? null;
  const session = useSession(client);
  // #343 : un vrai compte AVEC pseudo (comme l'exige enregistrer_abonnement_rappel côté serveur).
  const compte = !!usePseudo(supabase, compteDe(session));
  // Lus une fois : la carte montrée pose « proposée » sans se cacher elle-même.
  const [etat] = useState(etatRappel);
  const [support] = useState(supportCourant);
  // La carte d'installation a été prévue sur cet écran : pas de rappel ici, même après sa fermeture (une proposition par écran).
  const [bloque, setBloque] = useState(autreCarte);
  if (autreCarte && !bloque) setBloque(true);
  const voulue = doitProposerRappel({ compte: compte && !!supabase, support, etat, partieFinie, autreCarte: bloque });
  const [etape, setEtape] = useState<Etape | 'ferme'>('choix');
  const visible = useTour('rappel', voulue && etape !== 'ferme');
  const [moment, setMoment] = useState<MomentRappel>(etat.moment);
  const annoncee = useRef(false);
  const titre = useId();

  useEffect(() => {
    if (!visible || annoncee.current) return;
    annoncee.current = true;
    noterRappel({ proposition: 'proposee' });
    track(EVENTS.rappelPropose, { moment: 'fin_partie' });
  }, [visible]);

  if (!visible || !supabase) return null;
  const db = supabase;

  function nonMerci() {
    noterRappel({ proposition: 'refusee' });
    track(EVENTS.rappelRefuse, { raison: 'non', source: 'fin_partie' });
    setEtape('ferme');
  }

  async function oui() {
    setEtape('attente');
    const r = await activerRappel(db, moment, langue());
    if (r === 'ok') {
      noterRappel({ proposition: 'acceptee' });
      track(EVENTS.rappelAccepte, { moment_jour: moment, source: 'fin_partie' });
    } else if (r === 'refuse_navigateur') {
      // Refus dans la fenêtre du navigateur : définitif ici aussi, le Profil explique comment revenir dessus.
      noterRappel({ proposition: 'refusee' });
      track(EVENTS.rappelRefuse, { raison: 'navigateur', source: 'fin_partie' });
    }
    setEtape(messageDe(r));
  }

  return (
    <aside className="installer rappel" aria-labelledby={titre} data-rappel={etape}>
      <div className="installer-tete">
        <img className="installer-app" src="/icon-192.png" alt="" width="44" height="44" />
        <div>
          <h3 id={titre}>{t('rappel.titre')}</h3>
          <p>{fr(t('rappel.texte'))}</p>
        </div>
      </div>
      {etape === 'choix' || etape === 'attente' ? (
        <>
          <ChoixMoment valeur={moment} onChange={setMoment} desactive={etape === 'attente'} etiquette={t('rappel.moment')} />
          <div className="installer-actions">
            <button type="button" className="lien lien-discret" onClick={nonMerci} disabled={etape === 'attente'}>{t('rappel.non')}</button>
            <button type="button" className="btn installer-oui" onClick={oui} disabled={etape === 'attente'}>
              {etape === 'attente' ? t('rappel.attente') : t('rappel.oui')}
            </button>
          </div>
        </>
      ) : (
        <p className="rappel-etat" role="status">
          {fr(etape === 'fait' ? t('rappel.fait', { quand: t(`rappel.quand.${moment}`) }) : etape === 'bloque' ? t('rappel.bloque') : t('rappel.erreur'))}
        </p>
      )}
    </aside>
  );
}

/**
 * Réglage du Profil (sous-vue « Rappel du Go du jour »). `compte` : un vrai compte avec pseudo est connecté (#343).
 * Selon l'appareil : interrupteur et moment, ou une explication (compte, iPhone sans l'app installée, navigateur).
 */
export function ReglageRappel({ compte, onCompte, onInstaller }: { compte: boolean; onCompte: () => void; onInstaller: () => void }) {
  const [etat, setEtat] = useState(etatRappel);
  const [support, setSupport] = useState(supportCourant);
  const [attente, setAttente] = useState(false);
  const [message, setMessage] = useState<Etape | null>(null);
  const db = useSupabase();

  if (!compte || !db) {
    return (
      <div className="rappel-explication">
        <p>{fr(t('rappel.compte'))}</p>
        <button type="button" className="btn" onClick={onCompte}>{t('rappel.creerCompte')}</button>
      </div>
    );
  }
  if (support === 'ios_installer') {
    return (
      <div className="rappel-explication">
        <p>{fr(t('rappel.ios'))}</p>
        <button type="button" className="btn" onClick={onInstaller}>{t('rappel.installer')}</button>
      </div>
    );
  }
  if (support === 'non') return <div className="rappel-explication"><p>{fr(t('rappel.nonSupporte'))}</p></div>;

  async function basculer(actif: boolean) {
    if (!db) return;
    setAttente(true);
    setMessage(null);
    if (actif) {
      const r = await activerRappel(db, etat.moment, langue());
      if (r === 'ok') track(EVENTS.rappelAccepte, { moment_jour: etat.moment, source: 'profil' });
      if (r === 'refuse_navigateur') { track(EVENTS.rappelRefuse, { raison: 'navigateur', source: 'profil' }); setSupport(supportCourant()); }
      setMessage(r === 'ok' ? null : messageDe(r));
    } else {
      await couperRappel(db);
    }
    setEtat(etatRappel());
    setAttente(false);
  }

  async function choisir(m: MomentRappel) {
    if (m === etat.moment || !db) return;
    if (!etat.actif) { setEtat(noterRappel({ moment: m })); return; }
    setAttente(true);
    const r = await changerMoment(db, m, langue());
    setMessage(r === 'ok' ? null : 'erreur');
    setEtat(etatRappel());
    setAttente(false);
  }

  return (
    <div className="profil">
      <div className="lignes">
        {support === 'bloque'
          ? <p className="rappel-explication">{fr(t('rappel.bloque'))}</p>
          : <LigneInterrupteur libelle={t('rappel.interrupteur')} aide={t('rappel.aide')} actif={etat.actif} onChange={v => { if (!attente) void basculer(v); }} />}
        <div className="ligne ligne-choix rappel-ligne-moment">
          <span className="ligne-libelle" aria-hidden="true">{t('rappel.moment')}</span>
          <ChoixMoment valeur={etat.moment} onChange={m => void choisir(m)} desactive={attente || support === 'bloque'} etiquette={t('rappel.moment')} />
        </div>
      </div>
      {message && message !== 'fait' && <p className="rappel-etat" role="status">{fr(message === 'bloque' ? t('rappel.bloque') : t('rappel.erreur'))}</p>}
    </div>
  );
}

