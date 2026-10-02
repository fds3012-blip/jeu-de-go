// « Mes parties » (issue #358), sous-vue du Profil : chaque partie terminée, la plus récente d'abord, et la revue
// existante (src/app/Revue.tsx) d'un toucher. Comme l'onglet Archive de chess.com, mais sans cote : l'adversaire avec
// son portrait, le résultat en mots, la date en mots et la taille du plateau.
// Les parties de l'appareil s'affichent tout de suite (hors ligne compris) ; les défis par lien terminés arrivent
// ensuite de Supabase (lecture sous RLS : seulement les parties du joueur), avec les parties gardées sur le compte
// (`parties_perso`, src/data/partiesPerso.ts) : un nouvel appareil retrouve celles des autres. À l'ouverture, les
// parties de l'appareil qui ne sont pas encore sur le compte y partent en arrière-plan. Logique pure : historique.ts.
import { useEffect, useMemo, useState } from 'react';
import { Revue } from './Revue';
import { useOnline } from './hooks';
import {
  dateRelative, depuisDefi, etiquette, fusionner, historiqueAppareil, issueDe, MAX_AFFICHEES, nomAdversaire, phraseResultat,
  portraitDe, type PartieHistorique,
} from './historique';
import { mesDefis } from '../data/defi';
import type { Db } from '../data/supabase';
import { Portrait, PortraitMochi } from '../ui/Portrait';
import { Reflexion } from '../ui/Reflexion';
import { IconeReglage } from '../ui/IconesReglages';
import { fr } from '../ui/typo';
import { t } from '../content/i18n';
import '../ui/historique.css';

/** Visites de KataGo par position pour une partie importée : mêmes réglages que l'import (ImportSgf.tsx). */
const visitesImport = (taille: number) => (taille >= 19 ? 16 : taille >= 13 ? 24 : 32);

type EtatDefis = 'sans' | 'chargement' | 'pret' | 'hors-ligne' | 'erreur';

interface Props {
  onRetour: () => void;
  /** État vide : « Joue ta première partie ». */
  onJouer: () => void;
  /** « Analyser une partie jouée ailleurs » (#286) : action secondaire, en bas de la liste. */
  onImporter?: () => void;
  /** Client Supabase et identifiant de session : défis par lien terminés et parties du compte. Sans eux, l'appareil seulement. */
  db?: Db | null;
  userId?: string;
  confirmTouch?: boolean;
}

/** Visage de l'adversaire : portrait de l'échelle, Mochi, deux pierres (partie à deux, défi) ou initiale (partie importée). */
function Visage({ p }: { p: PartieHistorique }) {
  const id = portraitDe(p);
  if (id) return <Portrait id={id} taille={44} decoratif signature={false} />;
  if (p.mode === 'guidee') return <PortraitMochi taille={44} decoratif />;
  if (p.mode === 'import') {
    const initiale = [...nomAdversaire(p).trim()][0]?.toUpperCase() ?? '?';
    return <span className="mp-partie-initiale" aria-hidden="true">{initiale}</span>;
  }
  return <span className="mp-partie-pierres" aria-hidden="true"><span className="stone b" /><span className="stone w" /></span>;
}

/** Sceau de l'issue, posé sur le portrait. Décoratif : la phrase du résultat dit déjà tout. */
function SceauIssue({ p }: { p: PartieHistorique }) {
  const issue = issueDe(p);
  if (!issue) return null;
  return (
    <span className="mp-partie-sceau" data-issue={issue} aria-hidden="true">
      <svg viewBox="0 0 12 12" focusable="false">
        {issue === 'victoire' ? <path d="M2.8 6.3 5 8.4l4.2-4.8" />
          : issue === 'defaite' ? <path d="M3.2 6h5.6" />
          : <path d="M3.2 4.6h5.6M3.2 7.4h5.6" />}
      </svg>
    </span>
  );
}

export function MesParties({ onRetour, onJouer, onImporter, db = null, userId, confirmTouch = false }: Props) {
  const [appareil] = useState(historiqueAppareil);
  const [defis, setDefis] = useState<PartieHistorique[]>([]);
  const [duCompte, setDuCompte] = useState<PartieHistorique[]>([]);
  const [etat, setEtat] = useState<EtatDefis>(db && userId ? 'chargement' : 'sans');
  const [ouverte, setOuverte] = useState<PartieHistorique | null>(null);
  const online = useOnline();
  // Ouvert depuis une ligne du Profil peut-être défilée : la liste commence en haut.
  useEffect(() => { window.scrollTo?.({ top: 0 }); }, []);

  useEffect(() => {
    if (!db || !userId) { setEtat('sans'); return; }
    if (!online) { setEtat('hors-ligne'); return; }
    let vivant = true;
    setEtat('chargement');
    // Parties du compte : module chargé à la demande. Un échec ici n'empêche pas d'afficher les défis.
    const perso = import('../data/partiesPerso').then(async m => {
      const r = await m.lirePartiesPerso(db, userId);
      // Puis, en arrière-plan, les parties de l'appareil qui n'y sont pas encore (refusé sans pseudo : sans effet).
      void m.synchroniser(db, userId).catch(() => undefined);
      return r;
    });
    Promise.all([mesDefis(db, userId), perso]).then(([d, p]) => {
      if (!vivant) return;
      if (d.ok) setDefis(d.value.flatMap(x => { const g = depuisDefi(x.partie, userId, x.resultat); return g ? [g] : []; }));
      if (p.ok) setDuCompte(p.value);
      setEtat(d.ok && p.ok ? 'pret' : 'erreur');
    }, () => { if (vivant) setEtat('erreur'); });
    return () => { vivant = false; };
  }, [db, userId, online]);

  const liste = useMemo(() => fusionner(appareil, [...defis, ...duCompte], MAX_AFFICHEES), [appareil, defis, duCompte]);
  const maintenant = useMemo(() => new Date(), []);

  function ouvrir(p: PartieHistorique) { setOuverte(p); window.scrollTo?.({ top: 0 }); }
  function fermer() { setOuverte(null); window.scrollTo?.({ top: 0 }); }

  if (ouverte) {
    // Pas de « Rejouer d'ici » ici : l'écran de partie ne sait pas encore reprendre une partie gardée (voir la PR #358).
    const nom = ouverte.mode === 'deux' ? undefined : nomAdversaire(ouverte);
    return (
      <Revue key={ouverte.id} sgf={ouverte.sgf} joueur={ouverte.joueur} adversaire={nom} confirmTouch={confirmTouch}
        visites={ouverte.mode === 'import' ? visitesImport(ouverte.taille) : undefined}
        retour={t('historique.retour')} onRetour={fermer} source="historique" />
    );
  }

  const importer = onImporter && (
    <button type="button" className="lien mp-parties-importer" onClick={onImporter}>
      <IconeReglage id="importer" taille={20} />{t('historique.importer')}
    </button>
  );
  const statut = etat === 'chargement' ? t('defi.historique.chargement') : etat === 'hors-ligne' ? t('defi.historique.horsLigne') : etat === 'erreur' ? t('defi.historique.erreur') : null;

  return (
    <section className="sous-vue mes-parties" aria-labelledby="mes-parties-titre">
      <button type="button" className="back retour" onClick={onRetour}>
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M10 3.5 5.5 8 10 12.5" /></svg>{t('profil.retour')}
      </button>
      <h2 id="mes-parties-titre">{t('historique.titre')}</h2>

      {liste.length === 0 && etat !== 'chargement' ? (
        <div className="mp-parties-vide">
          <PortraitMochi taille={112} humeur="content" decoratif />
          <h3>{t('historique.vide.titre')}</h3>
          <p>{fr(t('historique.vide.texte'))}</p>
          {statut && <p className="mp-parties-statut" role="status">{fr(statut)}</p>}
          {importer}
          <div className="dock">
            <button type="button" className="cta" onClick={onJouer}>{t('historique.vide.cta')}</button>
          </div>
        </div>
      ) : (
        <>
          {liste.length > 0 && <p className="mp-parties-intro">{fr(t('historique.intro'))}</p>}
          <ol className="mp-parties" aria-labelledby="mes-parties-titre">
            {liste.map(p => {
              const issue = issueDe(p);
              return (
                <li key={p.id}>
                  <button type="button" className="mp-partie" data-mode={p.mode} aria-label={etiquette(p, maintenant)} onClick={() => ouvrir(p)}>
                    <span className="mp-partie-visage"><Visage p={p} /><SceauIssue p={p} /></span>
                    <span className="mp-partie-texte" aria-hidden="true">
                      <span className="mp-partie-haut">
                        <b className="mp-partie-nom">{nomAdversaire(p)}</b>
                        <span className="mp-partie-date">{dateRelative(p.date, maintenant)}</span>
                      </span>
                      <span className="mp-partie-bas">
                        <span className="mp-partie-resultat" data-issue={issue ?? undefined}>{fr(phraseResultat(p))}</span>
                        <span className="mp-partie-taille">{t('historique.taille', { taille: p.taille })}</span>
                      </span>
                    </span>
                    <svg className="chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M6 3.5 10.5 8 6 12.5" /></svg>
                  </button>
                </li>
              );
            })}
          </ol>
          {statut && (
            <p className="mp-parties-statut" role="status">{etat === 'chargement' && <Reflexion taille={20} />}{fr(statut)}</p>
          )}
          {importer}
        </>
      )}
    </section>
  );
}
