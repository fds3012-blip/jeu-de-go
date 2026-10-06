// « Tes amis aujourd'hui » (issue #369) : sous la réussite du Go du jour, qui de tes amis l'a fait, en combien
// d'essais, et « Rappelle-lui » pour les autres. Repliable, fermé d'abord : la feuille garde une seule action
// principale (« Problème suivant »). Absent sans ami. Pas de rang numérique ni de cote (#137) : la liste suit
// l'ordre du serveur (réussis, moins d'essais d'abord ; puis « Fait » ; puis « Pas encore »).
// Données : src/data/emulation.ts (le serveur ne rend que les amis acceptés).
import { useEffect, useId, useState } from 'react';
import { classementGoDuJour, rappelerGoDuJour, type LigneDuJour } from '../data/emulation';
import type { Db } from '../data/supabase';
import { EVENTS, track } from '../data/analytics';
import { te } from '../content/i18n/emulation';
import { useOnline } from '../app/hooks';
import './emulation.css';

type Etat = { etat: 'chargement' } | { etat: 'erreur' } | { etat: 'pret'; lignes: LigneDuJour[] };

/** `amis_du_jour_vus` part une fois par Go du jour et par session. */
const vus = new Set<number>();

function Coche() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
      <path d="M2.5 6.4 5 8.8l4.6-5.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * `apres` : envoi de la réussite au serveur ; la liste est lue après lui, pour que « Toi » soit déjà à jour.
 */
export function AmisDuJour({ db, numero, apres }: { db: Db; numero: number; apres?: Promise<unknown> | null }) {
  const online = useOnline();
  const [etat, setEtat] = useState<Etat>({ etat: 'chargement' });
  const [cle, setCle] = useState(0);
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const idListe = useId();

  useEffect(() => {
    if (!online) return;
    let vivant = true;
    void (async () => {
      try { await apres; } catch { /* l'envoi a échoué : la liste dit ce que sait le serveur */ }
      const r = await classementGoDuJour(db);
      if (!vivant) return;
      setEtat(r.ok ? { etat: 'pret', lignes: r.value } : { etat: 'erreur' });
    })();
    return () => { vivant = false; };
  }, [db, apres, online, cle]);

  const amis = etat.etat === 'pret' ? etat.lignes.filter(l => !l.moi) : [];
  const reussis = amis.filter(l => l.etat !== 'pas_encore').length;
  useEffect(() => {
    if (etat.etat !== 'pret' || !amis.length || vus.has(numero)) return;
    vus.add(numero);
    track(EVENTS.amisDuJourVus, { amis: amis.length, reussis });
  }, [etat, amis.length, reussis, numero]);

  if (!online) return <p className="amis-jour-note muted small" role="status">{te('jour.horsLigne')}</p>;
  if (etat.etat === 'chargement') return null;
  if (etat.etat === 'erreur') {
    return (
      <p className="amis-jour-note muted small" role="status">
        {te('jour.erreur')} <button type="button" className="lien" onClick={() => { setEtat({ etat: 'chargement' }); setCle(c => c + 1); }}>{te('jour.reessayer')}</button>
      </p>
    );
  }
  // Sans ami : rien (le Go du jour reste un défi commun, sans liste vide).
  if (!amis.length) return null;

  async function rappeler(pseudo: string) {
    setEnvoi(pseudo); setMessage(null);
    const r = await rappelerGoDuJour(db, pseudo);
    setEnvoi(null);
    if (r.ok) {
      if (r.value === 'envoye') track(EVENTS.rappelAmiEnvoye);
      setEtat(e => e.etat === 'pret' ? { etat: 'pret', lignes: e.lignes.map(l => l.pseudo === pseudo ? { ...l, rappele: true } : l) } : e);
      return;
    }
    if (r.error === 'dejaFait') { setMessage(te('jour.erreur.dejaFait', { pseudo })); setCle(c => c + 1); return; }
    setMessage(te(r.error === 'limiteRappels' ? 'jour.erreur.limiteRappels' : 'jour.erreur.autre'));
  }

  return (
    <details className="amis-jour" data-testid="amis-du-jour">
      <summary aria-controls={idListe}>
        <span className="amis-jour-pierres" aria-hidden="true"><span className="stone b" /><span className="stone w" /></span>
        <span className="amis-jour-titre">{te('jour.titre')}</span>
        <span className="amis-jour-compte" aria-hidden="true">{te('jour.resume', { reussis, n: amis.length })}</span>
        <span className="sr-only">{te('jour.resumeAria', { reussis, n: amis.length })}</span>
        <svg className="amis-jour-chevron" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M4 6l4 4 4-4" /></svg>
      </summary>
      <ul className="amis-jour-liste" id={idListe}>
        {etat.lignes.map(l => (
          <li key={l.pseudo} className={`amis-jour-ligne${l.moi ? ' moi' : ''}`} data-etat={l.etat}>
            <span className="amis-jour-nom">
              <b>{l.moi ? te('jour.toi') : l.pseudo}</b>
              {l.etat === 'pas_encore' && !l.moi && <small>{te('jour.pasEncore')}</small>}
            </span>
            {l.etat === 'reussi' ? <span className="amis-jour-etat fait"><Coche />{te('jour.reussi', { n: l.essais ?? 1 })}</span>
              : l.etat === 'vu' ? <span className="amis-jour-etat fait"><Coche />{te('jour.vu')}</span>
              : l.moi ? <span className="amis-jour-etat">{te('jour.pasEncore')}</span>
              : l.rappele ? <span className="amis-jour-etat envoye" role="status"><Coche />{te('jour.rappele')}</span>
              : (
                <button type="button" className="amis-jour-rappel" aria-label={te('jour.rappelerAria', { pseudo: l.pseudo })}
                  disabled={envoi !== null} aria-busy={envoi === l.pseudo || undefined} onClick={() => void rappeler(l.pseudo)}>
                  {envoi === l.pseudo ? te('jour.envoi') : te('jour.rappeler')}
                </button>
              )}
          </li>
        ))}
      </ul>
      {message && <p className="amis-jour-message small" role="status">{message}</p>}
    </details>
  );
}
