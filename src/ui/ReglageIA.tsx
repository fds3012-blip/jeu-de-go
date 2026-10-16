// « L'IA sur ton téléphone » (#538), dans Profil › Réglages : l'état de KataGo sur l'appareil (prête, à télécharger,
// en cours avec la progression, échec, hors ligne) et une seule action à la fois : « Télécharger l'IA maintenant »,
// « Réessayer » ou « Libérer la place ». S'appuie sur le préchargement de #475 (réseau dans le cache du navigateur,
// code de TensorFlow.js dans celui du service worker), sans démarrer KataGo. Styles : reglageIA.css (chargée avec le Profil).
import { useEffect, useState } from 'react';
import { ecouterKataGo, libererIA, reseauEnCache, telechargerIA } from '../engine';
import { MODEL_OCTETS } from '../engine/katago/loader';
import { formatMo } from '../engine/katago/prechargement';
import { useProgressionKataGo } from '../app/progressionKataGo';
import { useOnline } from '../app/hooks';
import { etatIA } from '../app/horsLigne';
import { EVENTS, track } from '../data/analytics';
import { langue } from '../content/i18n';
import { thl } from '../content/i18n/horsLigne';
import { LigneIcone } from './Reglage';
import { IconeReglage } from './IconesReglages';
// #563 : titres de groupe (.lignes-titre), hors du CSS initial ; avant reglageIA.css, comme dans la feuille principale.
import './amis.css';
import './profil-ecran.css';
import './reglageIA.css';

/** « 2,1 » ou « 2.1 » : nombre de mégaoctets affiché, relu en nombre pour la barre. */
const mo = (s: string) => Number(s.replace(',', '.')) || 0;

export function ReglageIA() {
  const enLigne = useOnline();
  const [enCache, setEnCache] = useState<boolean | null>(null);
  const [demande, setDemande] = useState(false);
  // Un préchargement lancé ailleurs (fin de partie, revue) se voit ici aussi.
  const [enFond, setEnFond] = useState(false);
  const [echec, setEchec] = useState(false);
  const [message, setMessage] = useState<'faite' | 'liberee' | null>(null);
  const enCours = demande || enFond;
  const progression = useProgressionKataGo(enCours);

  useEffect(() => {
    let vivant = true;
    void reseauEnCache().then(v => { if (vivant) setEnCache(v); });
    const fin = ecouterKataGo(i => {
      const fond = i.prechargement === 'en-cours' || i.state === 'chargement';
      setEnFond(avant => {
        // Fin d'un téléchargement lancé ailleurs : le cache est relu.
        if (avant && !fond) void reseauEnCache().then(v => { if (vivant) setEnCache(v); });
        return fond;
      });
    });
    return () => { vivant = false; fin(); };
  }, []);

  const etat = etatIA({ enCache, enCours, echec, enLigne });
  const taille = formatMo(MODEL_OCTETS, langue());

  async function telecharger() {
    if (enCours || !enLigne) return;
    setDemande(true); setEchec(false); setMessage(null);
    const debut = Date.now();
    const ok = await telechargerIA().catch(() => false);
    setDemande(false); setEnCache(ok); setEchec(!ok);
    if (ok) setMessage('faite');
    track(EVENTS.katagoTelecharge, { depuis: 'reglages', resultat: ok ? 'ok' : 'echec', secondes: Math.round((Date.now() - debut) / 1000) });
  }

  async function liberer() {
    if (!(await libererIA())) return;
    setEnCache(false); setEchec(false); setMessage('liberee');
    track(EVENTS.katagoLibere);
  }

  const texte = message === 'faite' && etat === 'prete' ? thl('ia.faite')
    : message === 'liberee' && etat === 'a-telecharger' ? thl('ia.liberee')
      : etat === 'verification' ? thl('ia.verification')
        : etat === 'prete' ? thl('ia.prete', { taille })
          : etat === 'en-cours' ? thl('ia.enCours')
            : etat === 'echec' ? thl('ia.echec')
              : etat === 'hors-ligne' ? thl('ia.horsLigne')
                : thl('ia.aTelecharger', { taille });
  const pct = progression ? Math.min(100, Math.round((mo(progression.recu) / Math.max(0.1, mo(progression.total))) * 100)) : null;

  return (
    <>
      <h3 className="lignes-titre">{thl('ia.groupe')}</h3>
      <div className="lignes" data-testid="reglage-ia" data-etat={etat}>
        <div className="ligne ligne-ia">
          <LigneIcone><IconeReglage id="ia" /></LigneIcone>
          <span className="ligne-texte">
            <span className="ligne-libelle">{thl('ia.libelle')}</span>
            {/* L'état seul est annoncé (pas chaque dixième de mégaoctet). */}
            <span className="ligne-aide" role="status">{texte}</span>
            {etat === 'en-cours' && (
              <span className="ia-progression">
                <span className="ia-barre" role="progressbar" aria-label={thl('ia.progressionAria')} aria-valuemin={0} aria-valuemax={100}
                  aria-valuenow={pct ?? undefined} data-indetermine={pct === null || undefined}>
                  <span style={pct === null ? undefined : { transform: `scaleX(${pct / 100})` }} />
                </span>
                {progression && <span className="ia-octets" aria-hidden="true">{thl('ia.progression', { recu: progression.recu, total: progression.total })}</span>}
              </span>
            )}
          </span>
        </div>
        {(etat === 'a-telecharger' || etat === 'echec') && (
          <button type="button" className="ligne ligne-ia-action" data-testid="ia-telecharger" onClick={() => { void telecharger(); }}>
            {thl(etat === 'echec' ? 'ia.reessayer' : 'ia.telecharger')}
          </button>
        )}
        {etat === 'prete' && (
          <button type="button" className="ligne ligne-ia-action discret" data-testid="ia-liberer" onClick={() => { void liberer(); }}>
            {thl('ia.liberer')}
          </button>
        )}
      </div>
      <p className="ligne-aide reglage-ia-aide">{thl('ia.aide')}</p>
    </>
  );
}
