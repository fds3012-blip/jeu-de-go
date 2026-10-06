// « Ta semaine » (issue #369), sous-vue du Profil : tes trois objectifs de la semaine (sur l'appareil, XP à la clé)
// et ce que tu as fait depuis lundi ; avec un compte, tes parties en ligne contre tes amis et ta cote de la semaine
// (serveur). Une seule action principale : le prochain objectif à atteindre ; rien quand tout est fait.
import { useEffect, useMemo, useRef } from 'react';
import type { Db } from '../data/supabase';
import { EVENTS, track } from '../data/analytics';
import { te } from '../content/i18n/emulation';
import { GAINS } from './xp';
import { OBJECTIFS, etatSemaine, progression, prochainObjectif, type Objectif } from './semaine';
import { PhrasesSemaine, StatsSemaine, useBilanServeur } from '../ui/BilanSemaine';
import { fr } from '../ui/typo';

const LIBELLES: Record<Objectif, 'semaine.obj.parties' | 'semaine.obj.problemes' | 'semaine.obj.erreurs'> = {
  parties: 'semaine.obj.parties', problemes: 'semaine.obj.problemes', erreurs: 'semaine.obj.erreurs',
};
const ACTIONS: Record<Objectif, 'semaine.action.parties' | 'semaine.action.problemes' | 'semaine.action.erreurs'> = {
  parties: 'semaine.action.parties', problemes: 'semaine.action.problemes', erreurs: 'semaine.action.erreurs',
};

function Etoile() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M8 1.8 9.8 5.6l4.1.5-3 2.8.8 4.1L8 11l-3.7 2 .8-4.1-3-2.8 4.1-.5Z" fill="currentColor" />
    </svg>
  );
}

/**
 * `db` : service et compte complet (pseudo), sinon null. `actions` : où mène chaque objectif (partie, problèmes,
 * « Mes parties » pour rejouer ses erreurs depuis la revue).
 */
export function Semaine({ db, actions }: { db: Db | null; actions: Record<Objectif, () => void> }) {
  const etat = useMemo(() => etatSemaine(), []);
  const s = etat.courante;
  const { serveur, recharger } = useBilanServeur(db, false);
  const prochain = prochainObjectif(s);
  const note = useRef(false);
  const amis = serveur.etat === 'pret' ? serveur.bilan.amis.length : 0;
  useEffect(() => {
    if (note.current || serveur.etat === 'chargement') return;
    note.current = true;
    track(EVENTS.bilanSemaineVu, { depuis: 'profil', parties: s.compte.parties, problemes: s.compte.problemes, go_du_jour: s.compte.goDuJour, amis });
  }, [serveur.etat, amis, s]);

  return (
    <div className="semaine" data-testid="semaine">
      <section className="semaine-objectifs" aria-labelledby="semaine-objectifs-titre">
        <h3 id="semaine-objectifs-titre">{te('semaine.objectifs')}</h3>
        <p className="semaine-aide small">{fr(te('semaine.objectifsAide', { xp: GAINS.objectif }))}</p>
        <ul className="objectifs">
          {OBJECTIFS.map(o => {
            const p = progression(s, o);
            const nom = te(LIBELLES[o], { n: p.cible });
            return (
              <li key={o} className={`objectif${p.atteint ? ' atteint' : ''}`} data-objectif={o}
                aria-label={p.atteint ? te('semaine.obj.atteintAria', { objectif: nom, xp: GAINS.objectif }) : te('semaine.obj.aria', { objectif: nom, fait: p.fait, cible: p.cible })}>
                <span className="objectif-texte" aria-hidden="true">{nom}</span>
                <span className="objectif-compte" aria-hidden="true">
                  {p.atteint ? <><Etoile />{te('semaine.obj.atteint')}</> : te('semaine.obj.progression', { fait: p.fait, cible: p.cible })}
                </span>
                <span className="objectif-barre" aria-hidden="true"><span style={{ transform: `scaleX(${p.fait / p.cible})` }} /></span>
              </li>
            );
          })}
        </ul>
      </section>

      {prochain
        ? <button type="button" className="btn primary" data-objectif={prochain} onClick={actions[prochain]}>{te(ACTIONS[prochain])}</button>
        : <p className="semaine-fait" role="status">{fr(te('semaine.toutFait'))}</p>}
      {prochain === 'erreurs' && <p className="semaine-aide small">{fr(te('semaine.obj.aide.erreurs'))}</p>}

      <section className="semaine-bilan" aria-labelledby="semaine-bilan-titre">
        <h3 id="semaine-bilan-titre">{te('semaine.depuisLundi')}</h3>
        <StatsSemaine compte={s.compte} />
        <div>
          {serveur.etat === 'pret' && <PhrasesSemaine bilan={serveur.bilan} />}
          {serveur.etat === 'chargement' && <p className="muted small" aria-busy="true">{te('semaine.serveur.chargement')}</p>}
          {serveur.etat === 'horsLigne' && <p className="muted small" role="status">{te('semaine.serveur.horsLigne')}</p>}
          {serveur.etat === 'sansCompte' && <p className="muted small">{fr(te('semaine.serveur.sansCompte'))}</p>}
          {serveur.etat === 'erreur' && (
            <p className="muted small" role="status">
              {te('semaine.serveur.erreur')} <button type="button" className="lien" onClick={recharger}>{te('jour.reessayer')}</button>
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
