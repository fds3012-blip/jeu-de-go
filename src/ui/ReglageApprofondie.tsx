// « Analyse approfondie » (C8, #732), dans Profil › Réglages, sous « L'IA sur ton téléphone » : un réseau KataGo plus
// fort, téléchargé seulement quand le joueur le demande (taille annoncée, Wi-Fi conseillé, annulable), utilisé par la revue
// et l'étude. Jamais par défaut. Logique et règles : src/engine/approfondie.ts. Styles : ceux de reglageIA.css.
import { useCallback, useEffect, useState } from 'react';
import { approfondie, APPROFONDI_OCTETS, type EtatApprofondi } from '../engine/approfondie';
import { formatMo } from '../engine/katago/prechargement';
import { useOnline } from '../app/hooks';
import { EVENTS, track } from '../data/analytics';
import { langue } from '../content/i18n';
import { thl } from '../content/i18n/horsLigne';
import { LigneIcone } from './Reglage';
import { IconeReglage } from './IconesReglages';
import './amis.css';
import './profil-ecran.css';
import './reglageIA.css';

export function ReglageApprofondie() {
  const enLigne = useOnline();
  const ap = approfondie();
  const [etat, setEtat] = useState<EtatApprofondi | null>(null);
  const [recu, setRecu] = useState<{ recu: number; total: number } | null>(null);
  const [message, setMessage] = useState<'echec' | 'annulee' | 'liberee' | null>(null);
  const l = langue();
  const taille = formatMo(APPROFONDI_OCTETS, l);

  const relire = useCallback(() => { void ap.etat().then(setEtat); }, [ap]);
  useEffect(() => {
    relire();
    const fin = ap.ecouterEtat(relire);
    return fin;
  }, [ap, relire]);
  useEffect(() => {
    if (etat !== 'telechargement') { setRecu(null); return; }
    return ap.ecouterProgression(i => setRecu(i.progression ? { ...i.progression } : null));
  }, [ap, etat]);

  async function activer() {
    if (!enLigne || etat === 'telechargement') return;
    setMessage(null);
    const debut = Date.now();
    const r = await ap.activer();
    setMessage(r === 'echec' ? 'echec' : r === 'annule' ? 'annulee' : null);
    relire();
    if (r !== 'annule') track(EVENTS.katagoTelecharge, { depuis: 'approfondie', resultat: r === 'ok' ? 'ok' : 'echec', secondes: Math.round((Date.now() - debut) / 1000) });
  }

  const pct = recu && recu.total > 0 ? Math.min(100, Math.round((recu.recu / recu.total) * 100)) : null;
  const texte = etat === 'telechargement' ? thl('ap.enCours')
    : message === 'echec' ? thl('ap.echec')
      : message === 'annulee' ? thl('ap.annulee')
        : message === 'liberee' ? thl('ap.liberee')
          : etat === 'active' ? thl('ap.active')
            : etat === 'en-cache' ? thl('ap.enCache', { taille })
              : etat === 'trop-lent' ? thl('ap.tropLent')
                : !enLigne && etat === 'desactivee' ? thl('ap.horsLigne')
                  : thl('ap.aTelecharger', { taille });

  return (
    <div className="lignes reglage-approfondi" data-testid="reglage-approfondie" data-etat={etat ?? 'verification'}>
      <div className="ligne ligne-ia">
        <LigneIcone><IconeReglage id="ia" /></LigneIcone>
        <span className="ligne-texte">
          <span className="ligne-libelle">{thl('ap.libelle')}</span>
          <span className="ligne-aide">{thl('ap.aide')}</span>
          <span className="ligne-aide" role="status">{texte}</span>
          {etat === 'telechargement' && (
            <span className="ia-progression">
              <span className="ia-barre" role="progressbar" aria-label={thl('ap.progressionAria')} aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={pct ?? undefined} data-indetermine={pct === null || undefined}>
                <span style={pct === null ? undefined : { transform: `scaleX(${pct / 100})` }} />
              </span>
              {recu && <span className="ia-octets" aria-hidden="true">{thl('ia.progression', { recu: formatMo(recu.recu, l), total: formatMo(recu.total, l) })}</span>}
            </span>
          )}
        </span>
      </div>
      {etat === 'telechargement' && (
        <button type="button" className="ligne ligne-ia-action discret" data-testid="ap-annuler" onClick={() => ap.annuler()}>{thl('ap.annuler')}</button>
      )}
      {etat === 'desactivee' && enLigne && (
        <button type="button" className="ligne ligne-ia-action" data-testid="ap-activer" onClick={() => { void activer(); }}>
          {thl(message === 'echec' ? 'ap.reessayer' : 'ap.activer')}
        </button>
      )}
      {etat === 'trop-lent' && (
        <button type="button" className="ligne ligne-ia-action" data-testid="ap-reessayer" onClick={() => { ap.reactiver(); }}>{thl('ap.reessayer')}</button>
      )}
      {etat === 'en-cache' && (
        <button type="button" className="ligne ligne-ia-action" data-testid="ap-reactiver" onClick={() => { setMessage(null); ap.reactiver(); }}>{thl('ap.reactiver')}</button>
      )}
      {etat === 'active' && (
        <button type="button" className="ligne ligne-ia-action discret" data-testid="ap-desactiver" onClick={() => { setMessage(null); ap.desactiver(); }}>{thl('ap.desactiver')}</button>
      )}
      {(etat === 'active' || etat === 'en-cache' || etat === 'trop-lent') && (
        <button type="button" className="ligne ligne-ia-action discret" data-testid="ap-liberer" onClick={() => { void ap.liberer().then(ok => { if (ok) setMessage('liberee'); relire(); }); }}>{thl('ap.liberer')}</button>
      )}
    </div>
  );
}
