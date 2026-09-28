// Onglet Problèmes (issue #40, phase 6) : cote et série, problème du jour mis en scène, grille des problèmes de base.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Db } from '../data/supabase';
import { ALL_PUZZLES } from '../content/puzzles';
import {
  checkAnswer, fetchPuzzleStats, fetchPuzzles, parsePuzzles, recordPuzzleAttempt, solutionFrames, startOf,
  type Puzzle, type PuzzleStats
} from '../data/puzzles';
import { Board } from '../ui/Board';
import { MiniGoban } from '../ui/MiniGoban';
import { Defile } from '../ui/Defile';
import { ecart } from '../ui/defile';
import { centreVertical } from '../ui/cadrage';
import { C, M, viewBoxOf } from '../ui/boardArt';
import { Retour, Verdict } from '../ui/Lecteur';
import { Bubble } from '../ui/Mochi';
import { Reflexion } from '../ui/Reflexion';
import { fr } from '../ui/typo';
import { playBadge, playFail, playIllegal, playStone, playSuccess } from '../ui/sound';
import { hapticBadge, hapticFail, hapticIllegal, hapticStone, hapticSuccess } from '../ui/haptics';
import { EVENTS, track } from '../data/analytics';
import { gagnerXp } from './xp';
import { aideSuivante, recompense, refutation, reponseVue, type NiveauAide, type Refutation } from './aide';
import { prefersReducedMotion, readLocal, useOnline, writeLocal } from './hooks';
import { niveau } from './problemes';
import { aContinuer, aSuivre, ordrePaliers, palierEnCours, palierRecommande, paliers, paliersVisibles, type Palier } from './paliers';
import { SceauLecon } from '../ui/SceauLecon';
import { aFeter, FETES_KEY } from './fetesPaliers';
import { MesErreurs } from '../ui/MesErreurs';
import { ProposerInstallation } from '../ui/ProposerInstallation';
import { SERIE_KEY, numeroDuJour, problemeDuNumero, serieVivante, textePartage, type Serie } from './goDuJour';
import '../ui/apprendre.css';
import { Glacon, PierreGivree } from '../ui/Glacon';
import { lireReserveAppareil } from './gelAppareil';
import { inviterCompte, serieAffichee } from './serieLocale';
import { goDuJourFaitAppareil, validerDefi } from './defiAppareil';
import { RevisionDuJour } from '../ui/RevisionDuJour';
// `t` désigne déjà un palier dans ce fichier : la traduction s'appelle `tr` (#167).
import { t as tr } from '../content/i18n';

const LOCAL_PUZZLES = parsePuzzles(ALL_PUZZLES);
export const SOLVED_KEY = 'go.problemes.v1';
/** Problèmes « vus » (#197) : résolus après avoir vu la réponse. Ni XP, ni palier. */
export const VUS_KEY = 'go.problemes.vus.v1';

type Load = { status: 'loading' } | { status: 'ready'; source: 'base' | 'copie'; error?: string };

interface Props {
  db: Db | null; userId: string | undefined; sessionLoading: boolean; confirmTouch: boolean;
  /** Mène à l'onglet Profil pour se connecter. */
  onCompte?: () => void;
  /** Numéro demandé par un lien partagé `?go-du-jour=N` : ouvre directement le Go du jour (issue #75). */
  lien?: number | null;
  /** Prévient quand le Go du jour est ouvert : la fenêtre de consentement attend, comme pendant une partie. */
  onDuJour?: (ouvert: boolean) => void;
  /** Réglage « Célébrations » : la pierre givrée se pose avec un rebond quand un gel est gagné. */
  celebrer?: boolean;
  /** Change quand on touche l'onglet Problèmes déjà actif : retour à la liste (R4). */
  racine?: number;
}

/** Flamme de la série de jours, en or. */
function Flamme({ taille = 22 }: { taille?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={taille} height={taille} aria-hidden="true" focusable="false">
      <path d="M8.6 1.2c.4 2.3 3.9 3.9 3.9 7.9A4.5 4.5 0 0 1 8 13.8a4.5 4.5 0 0 1-4.5-4.6c0-2 1-3.2 2-4 0 1.4.6 2.4 1.5 2.7C6.6 5.6 7.4 3 8.6 1.2Z" fill="currentColor" />
    </svg>
  );
}

/** Difficulté : trois petites pierres, pleines selon le niveau, et le mot. */
function Difficulte({ d }: { d: number }) {
  const n = niveau(d);
  return (
    <span className="difficulte">
      <span className="crans" aria-hidden="true">{[1, 2, 3].map(i => <i key={i} className={i <= n.crans ? 'plein' : undefined} />)}</span>
      {tr(`pb.difficulte.${n.crans}`)}
    </span>
  );
}

/** Onglet Problèmes : problème du jour, problèmes de base, cote problèmes et série de jours. */
export function Puzzles({ db, userId, sessionLoading, confirmTouch, onCompte, lien = null, onDuJour, celebrer = true, racine = 0 }: Props) {
  // Go du jour (issue #75) : le même pour tous, choisi dans la liste publique des problèmes de base, en heure de Paris.
  const [numero] = useState(() => numeroDuJour(new Date()));
  const daily = problemeDuNumero(LOCAL_PUZZLES, numero);
  const [serieDuJour, setSerieDuJour] = useState<Serie | null>(() => readLocal<Serie | null>(SERIE_KEY, null));
  // Série protégée (issue #76) : gels en réserve, et gel gagné à l'instant (micro-célébration).
  const [gels, setGels] = useState(() => lireReserveAppareil().gels);
  const [gelGagne, setGelGagne] = useState(false);
  const online = useOnline();
  const [list, setList] = useState<Puzzle[]>(LOCAL_PUZZLES);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [stats, setStats] = useState<PuzzleStats | null>(null);
  const [statsError, setStatsError] = useState('');
  const [localSolved, setLocalSolved] = useState<Record<string, true>>(() => readLocal(SOLVED_KEY, {}));
  const [openId, setOpenId] = useState<string | null>(() => (lien !== null && daily ? daily.id : null));
  // Lien d'un autre jour : on ouvre celui d'aujourd'hui, et on le dit.
  const [defiChange] = useState(() => lien !== null && lien !== numero);
  const [retry, setRetry] = useState(0);
  // Liste « Tous les problèmes » ouverte (#196) ; on y revient après un problème ouvert depuis la grille.
  const [tous, setTous] = useState(false);
  const [statsTick, setStatsTick] = useState(0);
  // Onglet actif touché (R4) : retour à la liste, sans remonter l'écran (le lien partagé rouvrirait le Go du jour).
  const racineVue = useRef(racine);
  useEffect(() => {
    if (racineVue.current === racine) return;
    racineVue.current = racine;
    setOpenId(null); setTous(false);
  }, [racine]);

  // Problèmes : la base pour un joueur connecté (RLS), la copie locale sinon.
  useEffect(() => {
    if (sessionLoading) return;
    if (!db || !userId) { setList(LOCAL_PUZZLES); setLoad({ status: 'ready', source: 'copie' }); return; }
    if (!online) { setList(LOCAL_PUZZLES); setLoad({ status: 'ready', source: 'copie', error: 'offline' }); return; }
    let alive = true;
    setLoad({ status: 'loading' });
    fetchPuzzles(db).then(r => {
      if (!alive) return;
      if (r.ok && r.value.length) { setList(r.value); setLoad({ status: 'ready', source: 'base' }); }
      else { setList(LOCAL_PUZZLES); setLoad({ status: 'ready', source: 'copie', error: r.ok ? undefined : r.error }); }
    });
    return () => { alive = false; };
  }, [db, userId, sessionLoading, online, retry]);

  useEffect(() => {
    if (!db || !userId || !online) { setStats(null); return; }
    let alive = true;
    fetchPuzzleStats(db, userId).then(r => {
      if (!alive) return;
      if (r.ok) { setStats(r.value); setStatsError(''); } else setStatsError(r.error);
    });
    return () => { alive = false; };
  }, [db, userId, online, retry, statsTick]);

  const solved = useMemo(() => new Set([...Object.keys(localSolved), ...(stats?.solved ?? [])]), [localSolved, stats]);
  const markSolved = useCallback((id: string) => {
    setLocalSolved(prev => { const next = { ...prev, [id]: true as const }; writeLocal(SOLVED_KEY, next); return next; });
  }, []);
  const [vus, setVus] = useState<Record<string, true>>(() => readLocal(VUS_KEY, {}));
  const markVu = useCallback((id: string) => {
    setVus(prev => { const next = { ...prev, [id]: true as const }; writeLocal(VUS_KEY, next); return next; });
  }, []);

  const tiers = useMemo(() => paliers(list, solved), [list, solved]);
  // Palier complet : une micro-fête en or, une seule fois par palier (réglage Célébrations et mouvements réduits respectés).
  const [fetes, setFetes] = useState<string[]>([]);
  useEffect(() => {
    if (openId) return;
    const deja = readLocal<unknown>(FETES_KEY, []);
    const nouveaux = aFeter(tiers, deja);
    if (!nouveaux.length) return;
    writeLocal(FETES_KEY, [...(Array.isArray(deja) ? deja : []), ...nouveaux]);
    // Sceau de palier obtenu (#165) : « toc » du sceau et cloche, même avec les mouvements réduits (ce n'est pas un mouvement).
    if (celebrer) { playBadge(); hapticBadge(); }
    if (celebrer && !prefersReducedMotion()) setFetes(nouveaux);
  }, [tiers, openId, celebrer]);
  const ordre = useMemo(() => ordrePaliers(tiers), [tiers]);
  // #147 : « Continuer » propose toujours un problème ; le tirage change à chaque retour à la liste
  // et évite le dernier problème joué.
  const dernierRef = useRef<string | undefined>(undefined);
  if (openId) dernierRef.current = openId;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- nouveau tirage voulu à chaque changement de problème
  const tirage = useMemo(() => Math.random(), [openId]);
  const open = list.find(p => p.id === openId) ?? (daily && openId === daily.id ? daily : undefined);
  const duJourOuvert = !!open && open.id === daily?.id;
  useEffect(() => {
    onDuJour?.(duJourOuvert);
  }, [duJourOuvert, onDuJour]);
  useEffect(() => () => onDuJour?.(false), [onDuJour]);

  if (open) {
    const nextPz = aSuivre(tiers, open, solved);
    const estDuJour = open.id === daily?.id;
    return (
      <PuzzlePlayer key={open.id} puzzle={open} rang={ordre.indexOf(open) + 1} confirmTouch={confirmTouch}
        duJour={estDuJour ? { numero, serie: serieVivante(serieDuJour, numero), defiChange, gelGagne, celebrer } : undefined}
        rated={!!db && !!userId && online && !!stats && !stats.attempted.includes(open.id) && !solved.has(open.id)}
        rating={stats?.rating}
        onAttempt={async ok => {
          if (!db || !userId) return null;
          const r = await recordPuzzleAttempt(db, open.id, ok);
          if (r.ok) setStats(s => s && { ...s, rating: r.value, attempted: [...s.attempted, open.id], solved: ok ? [...s.solved, open.id] : s.solved, streak: ok ? Math.max(1, s.streak) : s.streak });
          if (r.ok && ok) setStatsTick(n => n + 1); // relit la série calculée par le serveur
          return r;
        }}
        onSolved={(essais, aide) => {
          // #197 : résolu après avoir vu la réponse, c'est « Vu » : ni XP ni palier. La série du Go du jour tient quand même.
          const gain = recompense(aide, estDuJour);
          if (gain.xp && !solved.has(open.id)) { track(EVENTS.problemeResolu, { probleme: open.id, du_jour: estDuJour }); gagnerXp(estDuJour ? 'goDuJour' : 'probleme'); }
          // #199 : un défi par jour ; le Go du jour est coché à part, une leçon ou la révision ont pu faire vivre la série avant lui.
          if (gain.serie && !goDuJourFaitAppareil(numero)) {
            const { serie: s, gagne } = validerDefi('go_du_jour');
            setSerieDuJour(s);
            if (gagne) { setGelGagne(true); setGels(lireReserveAppareil().gels); }
            track(EVENTS.goDuJourResolu, { numero, essais, serie: s?.jours ?? 1, arrivee_par_lien: lien !== null, vu: gain.statut === 'vu' });
          }
          if (gain.palier) markSolved(open.id); else markVu(open.id);
        }}
        onSolutionVue={essais => track(EVENTS.solutionVue, { probleme: open.id, du_jour: estDuJour, essais })}
        onNext={nextPz ? () => { setOpenId(nextPz.id); window.scrollTo({ top: 0 }); } : undefined}
        onExit={() => setOpenId(null)} />
    );
  }

  if (load.status === 'loading') {
    return (
      <div className="problemes-chargement" aria-busy="true" role="status">
        <Reflexion taille={32} />
        <span>{tr('pb.chargement')}</span>
      </div>
    );
  }

  const connecte = !!db && !!userId;
  const prochainPz = aContinuer(tiers, solved, dernierRef.current, () => tirage);
  // Une seule action en relief : le Go du jour tant qu'il n'est pas fait, « Continuer » ensuite.
  const duJourReussi = !!daily && goDuJourFaitAppareil(numero);
  const duJourFait = !daily || duJourReussi;
  const recommande = connecte && stats ? palierRecommande(tiers, stats.rating) : undefined;
  // Série (issue #161) : celle de l'appareil sans compte, la plus longue des deux avec un compte.
  const serie = serieAffichee(connecte && stats ? stats.streak : null, serieDuJour, numero);
  const notices = <>
    {load.error === 'offline' && <p className="notice" role="status">{tr('pb.horsLigne')}</p>}
    {load.error && load.error !== 'offline' && (
      <p className="notice" role="alert">{load.error} {tr('pb.copieLocale')} <button className="lien" onClick={() => setRetry(n => n + 1)}>{tr('pb.reessayer')}</button></p>
    )}
  </>;

  // « Tous les problèmes » (issue #196) : la grille, derrière un lien. Paliers ouverts, puis le prochain palier en une ligne.
  if (tous) {
    const { ouverts, prochain: suivant } = paliersVisibles(tiers);
    return (
      <div className="problemes problemes-tous">
        <div className="tous-tete">
          <Retour label={tr('pb.retour')} onClick={() => { setTous(false); window.scrollTo({ top: 0 }); }} />
          <h2 id="paliers-titre">{tr('pb.tous')}</h2>
        </div>
        {notices}
        <p className="muted small bases-aide">{fr(tr('pb.aide.avant'))}<b>{tr('pb.aide.mot')}</b>{fr(tr('pb.aide.apres'))}</p>
        {ouverts.map(t => (
          <PalierVue key={t.id} t={t} ordre={ordre} solved={solved} vus={vus} recommande={t.id === recommande} onOpen={setOpenId}
            fete={fetes.includes(t.id)} />
        ))}
        {suivant && (
          <div className="palier verrouille palier-prochain" data-palier={suivant.id} role="group" aria-labelledby={`palier-${suivant.id}`}>
            <h3 id={`palier-${suivant.id}`}><Cadenas />{tr(`palier.${suivant.id}.nom`)}<span className="sr-only"> ({tr('pb.verrouille')})</span></h3>
            <p className="palier-verrou">{fr(tr('pb.palierVerrou'))}</p>
          </div>
        )}
      </div>
    );
  }

  const enCours = palierEnCours(tiers);
  return (
    <div className={`problemes${prochainPz && duJourFait ? ' avec-continuer' : ''}`}>
      {notices}

      {daily && (
        <section aria-labelledby="jour-titre">
          <h2 id="jour-titre" className="titre-pierres">{tr('accueil.goDuJour')} <span className="numero-du-jour">{tr('pb.numero', { numero })}</span><Glacon gels={stats ? stats.freezes : gels} /></h2>
          <p className="muted small bases-aide">{tr('pb.duJourAide')}</p>
          <DuJour pz={daily} reussi={duJourReussi} vu={!!vus[daily.id] && !solved.has(daily.id)} onOpen={() => setOpenId(daily.id)} />
        </section>
      )}

      {/* Révision du jour (#199) : problèmes déjà réussis, repris à J+1, J+3, J+7. */}
      <RevisionDuJour liste={list} reussis={solved} confirmTouch={confirmTouch} Lecteur={PuzzlePlayer} onSerie={setSerieDuJour} />

      {/* Un seul « Continuer », le palier en cours sans total, la grille derrière un lien discret (#196). */}
      <section aria-labelledby="paliers-titre">
        <h2 id="paliers-titre" className="titre-pierres">{tr('nav.problemes')}</h2>
        {prochainPz && (
          <button className={duJourFait ? 'cta continuer' : 'btn continuer'} onClick={() => setOpenId(prochainPz.id)}
            aria-label={tr('pb.continuerAria', { titre: prochainPz.title })}>
            {tr('pb.continuer')} <span className="continuer-titre">{prochainPz.title}</span>
          </button>
        )}
        {enCours && (
          <div className="palier-en-cours" data-palier-en-cours={enCours.id} data-reussis={enCours.reussis}>
            <div className="palier-nom">
              <small className="palier-surtitre">{tr('pb.tonPalier')}</small>
              <h3>{tr(`palier.${enCours.id}.nom`)}</h3>
              <small>{tr(`palier.${enCours.id}.kyu`)}{enCours.id === recommande && <span className="palier-reco"> · {tr('pb.pourTaCote')}</span>}</small>
            </div>
            {enCours.reussis > 0 && <p className="palier-compte">{tr('pb.reussis', { n: enCours.reussis })}</p>}
          </div>
        )}
        <button className="lien lien-tous" onClick={() => { setTous(true); window.scrollTo({ top: 0 }); }}>
          {tr('pb.tous')}
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </section>

      <MesErreurs confirmTouch={confirmTouch} Lecteur={PuzzlePlayer} />

      {connecte && stats ? (
        <div className="palmares">
          <div>
            <span className="chiffre">{stats.rating}</span>
            <span className="legende">{tr('pb.coteLegende')}</span>
          </div>
          <div className="palmares-serie">
            <span className="chiffre"><Flamme taille={30} />{serie}</span>
            <span className="legende">{tr('pb.serieLegende', { n: serie })}</span>
          </div>
        </div>
      ) : connecte && statsError ? (
        <p className="notice" role="alert">{statsError} <button className="lien" onClick={() => setRetry(n => n + 1)}>{tr('pb.reessayer')}</button></p>
      ) : connecte && online ? (
        <div className="palmares" aria-busy="true"><span className="sr-only">{tr('pb.chargementCote')}</span><div><span className="chiffre attente" /><span className="legende">{tr('pb.coteLegende')}</span></div></div>
      ) : !connecte && serie > 0 ? (
        // Sans compte, la série de l'appareil s'affiche comme pour un joueur connecté (issue #161).
        <div className="palmares palmares-invite">
          <div className="invitation">
            {inviterCompte(false, serie)
              ? <p>{fr(tr('serie.invitation'))}</p>
              : <p>{fr(tr('pb.invitation.avant'))}<b>{tr('pb.invitation.mot')}</b>{fr(tr('pb.invitationCourte.apres'))}</p>}
            {onCompte && <button className="lien" onClick={onCompte}>{inviterCompte(false, serie) ? tr('serie.creerCompte') : tr('pb.meConnecter')}</button>}
          </div>
          <div className="palmares-serie">
            <span className="chiffre"><Flamme taille={30} />{serie}</span>
            <span className="legende">{tr('pb.serieLegende', { n: serie })}</span>
          </div>
        </div>
      ) : !connecte ? (
        <div className="invitation">
          <p>{fr(tr('pb.invitation.avant'))}<b>{tr('pb.invitation.mot')}</b>{fr(tr('pb.invitation.apres'))}</p>
          {onCompte && <button className="lien" onClick={onCompte}>{tr('pb.meConnecter')}</button>}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Un palier : nom, rang en kyu, sceau quand il est complet, et sa grille de miniatures.
 * Aucun total affiché (ni « 3 / 33 », ni barre, ni montagne) : le joueur doit sentir que les problèmes ne s'arrêtent jamais.
 */
function PalierVue({ t, ordre, solved, vus, recommande, onOpen, fete }: {
  t: Palier<Puzzle>; ordre: Puzzle[]; solved: Set<string>; vus: Record<string, true>; recommande: boolean; onOpen: (id: string) => void; fete: boolean;
}) {
  const titre = `palier-${t.id}`;
  return (
    <div className={`palier${t.complet ? ' complet' : ''}${fete ? ' fete' : ''}`} data-palier={t.id} data-reussis={t.reussis} aria-labelledby={titre} role="group">
      <div className="palier-tete">
        <div className="palier-nom">
          <h3 id={titre}>{tr(`palier.${t.id}.nom`)}</h3>
          <small>{tr(`palier.${t.id}.kyu`)}{recommande && <span className="palier-reco"> · {tr('pb.pourTaCote')}</span>}</small>
        </div>
        {t.complet && <span className="palier-sceau" role="img" aria-label={tr('pb.palierComplet')}><SceauLecon id={`p${t.rang}`} taille={34} /></span>}
      </div>
      {t.reussis > 0 && <p className="palier-compte">{tr('pb.reussis', { n: t.reussis })}</p>}
      <ul className="grille-pb">
        {t.problemes.map(p => {
          const ok = solved.has(p.id);
          const vu = !ok && !!vus[p.id];
          const i = ordre.indexOf(p);
          return (
            <li key={p.id}>
              <button className={ok ? 'reussi' : undefined} onClick={() => onOpen(p.id)} data-probleme={p.id}
                aria-label={`${tr('pb.problemeAria', { n: i + 1, titre: p.title })}${ok ? `, ${tr('pb.reussi')}` : vu ? `, ${tr('pb.vu')}` : ''}`}>
                <span className="grille-goban">
                  <MiniGoban rows={p.rows} />
                  {vu && <span className="pastille-vu" aria-hidden="true">{tr('pb.tamponVu')}</span>}
                  {ok && <span className="pastille-ok" aria-hidden="true"><svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" className="sceau-fond" /><circle cx="16" cy="16" r="11.5" className="sceau-anneau" /><path d="M10.5 16.6 14.3 20.2 21.5 12.4" className="sceau-coche" /></svg></span>}
                </span>
                <b aria-hidden="true">{p.title}</b>
                <span aria-hidden="true"><Difficulte d={p.difficulty} /></span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Cadenas() {
  return (
    <svg className="cadenas" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <rect x="3" y="7" width="10" height="7.5" rx="2" fill="currentColor" />
      <path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/** Problème du jour : la vraie position sur le goban, recadrée sur les pierres, et le bouton « Résoudre » en relief. */
function DuJour({ pz, reussi, vu, onOpen }: { pz: Puzzle; reussi: boolean; vu: boolean; onOpen: () => void }) {
  const start = useMemo(() => startOf(pz), [pz]);
  const vb = viewBoxOf(pz.size);
  // Hauteur du centre des pierres, en fraction de la largeur de l'image du goban (qui est carrée).
  const f = (M + centreVertical(pz.rows) * C - vb.min) / vb.span;
  return (
    <div className={`du-jour${reussi ? ' reussi' : ''}`}>
      <div className="du-jour-plateau" aria-hidden="true" onClick={onOpen} style={{ '--f': f } as CSSProperties}>
        <div className="du-jour-cadre"><Board size={pz.size} board={start.pos.board} marks={{ targets: start.marked }} /></div>
        {reussi && <span className={`tampon-reussi${vu ? ' tampon-vu' : ''}`}>{tr(vu ? 'pb.tamponVu' : 'pb.tampon')}</span>}
      </div>
      <div className="du-jour-corps">
        <h3>{pz.title}</h3>
        <p><Difficulte d={pz.difficulty} /> <span className="muted">{tr(pz.toPlay === 1 ? 'pb.joue.1' : 'pb.joue.2')}</span></p>
        <button className={reussi ? 'btn du-jour-refaire' : 'cta'} aria-label={tr(reussi ? 'pb.refaireAria' : 'pb.resoudreAria')} onClick={onOpen}>{tr(reussi ? 'pb.refaire' : 'pb.resoudre')}</button>
      </div>
    </div>
  );
}

type Answer = { kind: 'ok' | 'wrong' | 'illegal'; p: number; text: string; n: number };

/** Bouton « Partager » du Go du jour : Web Share API, sinon copie dans le presse-papiers. Texte sans la réponse. */
function Partager({ numero, essais, serie }: { numero: number; essais: number; serie: number }) {
  const [etat, setEtat] = useState<'' | 'copie' | 'erreur'>('');
  const p = textePartage(numero, essais, serie);
  async function partager() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text: p.texte, url: p.url });
        track(EVENTS.goDuJourPartage, { numero, essais, methode: 'partage' });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return; // le joueur a fermé la feuille de partage
      }
    }
    try {
      await navigator.clipboard.writeText(p.complet);
      setEtat('copie');
      track(EVENTS.goDuJourPartage, { numero, essais, methode: 'copie' });
    } catch {
      setEtat('erreur');
    }
  }
  return (
    <>
      <button className="cta partager" onClick={partager}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
        {tr('pb.partager')}
      </button>
      <p className="partage-etat" role="status" aria-live="polite">
        {etat === 'copie' ? tr('pb.copie') : etat === 'erreur' ? <>{tr('pb.copieImpossible')} <span className="partage-lien">{p.url}</span></> : null}
      </p>
    </>
  );
}

interface DuJourInfo { numero: number; serie: number; defiChange: boolean; gelGagne: boolean; celebrer: boolean }

export function PuzzlePlayer({ puzzle, rang, duJour, confirmTouch, rated, rating, onAttempt, onSolved, onNext, onExit, onSolutionVue, retour, surtitre }: {
  puzzle: Puzzle; rang: number; duJour?: DuJourInfo; confirmTouch: boolean; rated: boolean; rating?: number;
  onAttempt: (ok: boolean) => Promise<{ ok: true; value: number } | { ok: false; error: string } | null>;
  onSolved: (essais: number, aide: NiveauAide) => void; onNext?: () => void; onExit: () => void;
  /** La réponse vient d'être montrée (#197). */
  onSolutionVue?: (essais: number) => void;
  /** Série de fin de leçon (#200) : libellé du retour (« Retour au chemin ») et surtitre (« Entraînement, 1 sur 3 »). */
  retour?: string; surtitre?: string;
}) {
  const start = useMemo(() => startOf(puzzle), [puzzle]);
  // Aide graduée (#197) : indice, puis réfutation, puis réponse.
  const [aide, setAide] = useState<NiveauAide>(0);
  const [refut, setRefut] = useState<{ r: Refutation; vue: boolean } | null>(null);
  const dernierFaux = useRef<number | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [board, setBoard] = useState(start.pos.board);
  const [tries, setTries] = useState(0);
  const [cote, setCote] = useState<{ de: number; a: number } | { erreur: string } | null>(null);
  const [replay, setReplay] = useState<{ frame: number; total: number } | null>(null);
  const [shake, setShake] = useState<{ p: number; n: number } | null>(null);
  const firstTry = useRef(true);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const solvedNow = answer?.kind === 'ok';

  async function onPlay(p: number) {
    if (solvedNow || replay || refut) return;
    const r = checkAnswer(puzzle, p);
    const n = (answer?.n ?? 0) + 1;
    if (r.kind === 'illegal') {
      playIllegal(); hapticIllegal(); setShake({ p, n });
      setAnswer({ kind: 'illegal', p, text: tr(`pb.illegal.${r.reason}`), n });
      return;
    }
    const ok = r.kind === 'ok';
    playStone(p, puzzle.size); hapticStone();
    if (ok) { playSuccess(); hapticSuccess(); } else { playFail(); hapticFail(); }
    setTries(tries + 1);
    if (!ok) dernierFaux.current = p;
    setAnswer({ kind: r.kind, p, text: ok ? (puzzle.explanation ?? tr('pb.bonCoup')) : (puzzle.refutation ?? tr('pb.pasTout')), n });
    setBoard(ok ? r.after.board : start.pos.board);
    if (ok) onSolved(tries + 1, aide);
    // Seul le premier essai compte pour la cote.
    if (firstTry.current && rated) {
      firstTry.current = false;
      const res = await onAttempt(ok);
      if (res && res.ok) setCote({ de: rating ?? res.value, a: res.value });
      else if (res) setCote({ erreur: res.error });
    }
    firstTry.current = false;
  }

  function showLine() {
    const frames = solutionFrames(puzzle);
    window.clearTimeout(timer.current);
    if (prefersReducedMotion()) {
      setBoard(frames[frames.length - 1].board);
      setReplay({ frame: frames.length - 1, total: frames.length - 1 });
      return;
    }
    let i = 0;
    setBoard(frames[0].board);
    setReplay({ frame: 0, total: frames.length - 1 });
    const stepOnce = () => {
      i++;
      setBoard(frames[i].board);
      setReplay({ frame: i, total: frames.length - 1 });
      if (i < frames.length - 1) timer.current = window.setTimeout(stepOnce, 800);
    };
    timer.current = window.setTimeout(stepOnce, 500);
  }
  function reessayer() {
    window.clearTimeout(timer.current);
    setReplay(null); setRefut(null); setBoard(start.pos.board); setAnswer(null);
  }

  /** Marche suivante de l'aide : l'indice entoure la zone, la réfutation joue la réponse de l'adversaire, puis la réponse. */
  function demanderAide() {
    const suite = aideSuivante(aide);
    if (suite === null) return;
    window.clearTimeout(timer.current);
    const r = suite === 2 && dernierFaux.current !== null ? refutation(puzzle, dernierFaux.current) : null;
    if (suite === 1) {
      setAide(1); setAnswer(null); setBoard(start.pos.board);
    } else if (suite === 2 && r) {
      setAide(2); setAnswer(null);
      // Le coup faux d'abord, puis l'adversaire répond au point clé (600 ms) ; tout de suite si les mouvements sont réduits.
      const avecFaux = checkAnswer(puzzle, r.faux);
      if (r.reponse === null || prefersReducedMotion() || avecFaux.kind === 'illegal') {
        setBoard(r.pos.board); setRefut({ r, vue: true });
      } else {
        setBoard(avecFaux.after.board); setRefut({ r, vue: false });
        timer.current = window.setTimeout(() => {
          setBoard(r.pos.board); setRefut({ r, vue: true });
          if (r.reponse !== null) { playStone(r.reponse, puzzle.size); hapticStone(); }
        }, 600);
      }
    } else {
      setAide(3); setRefut(null); setAnswer(null);
      onSolutionVue?.(tries);
      showLine();
    }
  }
  const prochaineAide = aideSuivante(aide);
  const libelleAide = prochaineAide === 1 ? tr('pb.aide.indice') : prochaineAide === 2 && dernierFaux.current !== null ? tr('pb.aide.pourquoi') : tr('pb.aide.reponse');
  const boutonAide = prochaineAide !== null && tries >= 1
    ? <button className="btn" onClick={demanderAide}>{libelleAide}</button>
    : null;
  const vu = reponseVue(aide);

  const frames = replay ? solutionFrames(puzzle) : null;
  const lastMove = replay && frames ? frames[replay.frame].lastMove : solvedNow ? answer.p : null;
  const replayDone = !!replay && replay.frame === replay.total;

  const ligneCote = cote && ('erreur' in cote
    ? <p className="verdict-cote">{cote.erreur}</p>
    : <p className="verdict-cote">{tr('pb.taCote')} <b><Defile de={cote.de} a={cote.a} /></b>{cote.a !== cote.de && <span className={cote.a > cote.de ? 'monte' : 'baisse'}> {ecart(cote.de, cote.a)}</span>}</p>);
  const suivantBtn = <button className="cta" onClick={onNext ?? onExit}>{onNext ? tr('pb.suivant') : retour ?? tr('pb.retour')}</button>;

  let verdict = null;
  if (replay) {
    verdict = (
      <Verdict ton="neutre" actions={solvedNow
        ? <>{suivantBtn}<button className="lien" onClick={showLine} disabled={!replayDone}>{tr('pb.revoirSuite')}</button></>
        : <div className="row"><button className="btn" onClick={showLine} disabled={!replayDone}>{tr('pb.revoirSuite')}</button><button className="btn" onClick={reessayer}>{tr('pb.reessayer')}</button></div>}>
        <p>{replayDone ? tr(solvedNow ? 'pb.suiteFinie' : 'pb.suiteFinieVu') : tr('pb.suiteCoup', { n: replay.frame, total: replay.total })}</p>
      </Verdict>
    );
  } else if (refut) {
    // Réfutation (#197) : l'adversaire répond au coup faux, au point clé.
    const texte = puzzle.refutation ?? tr(refut.r.reponse === null ? 'pb.aide.refutationSeule' : puzzle.toPlay === 1 ? 'pb.aide.refutation.1' : 'pb.aide.refutation.2');
    verdict = (
      <Verdict ton="neutre" actions={<div className="row">{boutonAide}<button className="btn" onClick={reessayer}>{tr('pb.reessayer')}</button></div>}>
        <p data-refutation="">{refut.vue ? fr(texte) : tr('pb.aide.regarde')}</p>
      </Verdict>
    );
  } else if (!answer && aide >= 1 && tries >= 1 && !vu) {
    // Indice (#197) : la zone du bon coup est entourée ; le plateau reste jouable.
    verdict = (
      <Verdict ton="neutre">
        <p>{fr(tr('pb.aide.indiceTexte'))}</p>
      </Verdict>
    );
  } else if (answer) {
    verdict = solvedNow && vu ? (
      // Résolu après avoir vu la réponse (#197) : « Vu », sans XP ; la série du Go du jour tient quand même.
      <Verdict ton="neutre" actions={<>{suivantBtn}<button className="lien" onClick={showLine}>{tr('pb.voirSuite')}</button></>}>
        <p data-vu="">{fr(tr('pb.vuTexte'))}</p>
        {duJour && <p className="verdict-cote">{fr(tr('pb.vuSerie'))}</p>}
      </Verdict>
    ) : solvedNow ? (
      <Verdict ton="juste" cle={answer.n} actions={duJour
        // Go du jour réussi : « Partager » est l'action principale, en relief ; la suite reste à portée, en lien.
        ? <>
            <Partager numero={duJour.numero} essais={tries} serie={duJour.serie} />
            {duJour.gelGagne && (
              <p className={`gel-gagne${duJour.celebrer ? ' fete' : ''}`} role="status"><PierreGivree taille={18} />{fr(tr('pb.gelGagne'))}</p>
            )}
            <div className="row liens-du-jour">
              <button className="lien" onClick={showLine}>{tr('pb.voirSuite')}</button>
              <button className="lien" onClick={onNext ?? onExit}>{tr(onNext ? 'pb.suivant' : 'pb.retour')}</button>
            </div>
            <ProposerInstallation moment="go_du_jour" />
          </>
        : <>{suivantBtn}<button className="lien" onClick={showLine}>{tr('pb.voirSuite')}</button></>}>
        <p>{fr(answer.text)}</p>{ligneCote}
      </Verdict>
    ) : (
      <Verdict ton="revoir" cle={answer.n} actions={
        <div className="row">
          {boutonAide}
          <button className="btn" onClick={() => setAnswer(null)}>{tr('pb.reessayer')}</button>
        </div>}>
        <p>{fr(answer.text)}</p>{ligneCote}
      </Verdict>
    );
  }

  return (
    <div className="lecteur">
      <div className="lecteur-tete">
        <Retour label={retour ?? tr('pb.retour')} onClick={onExit} />
        <div className="lecteur-nom">
          {duJour
            ? <small className="entete-du-jour">{tr('accueil.goDuJour')} <b className="numero-du-jour">{tr('pb.numero', { numero: duJour.numero })}</b></small>
            : <small>{surtitre ?? tr('pb.probleme', { n: rang })}</small>}
          <h2>{puzzle.title}</h2>
        </div>
        <Difficulte d={puzzle.difficulty} />
      </div>
      {duJour?.defiChange && <p className="notice" role="status">{fr(tr('pb.defiChange'))}</p>}
      <Bubble>{fr(`${puzzle.prompt} ${tr(puzzle.toPlay === 1 ? 'pb.tuJoues.1' : 'pb.tuJoues.2')}`)}</Bubble>
      <Board size={puzzle.size} board={board} toPlay={puzzle.toPlay} interactive={!solvedNow && !replay && !refut} confirmTouch={confirmTouch} onPlay={onPlay} shake={shake}
        marks={{
          targets: start.marked,
          last: refut ? (refut.vue ? refut.r.reponse : refut.r.faux) : lastMove,
          ok: solvedNow && !replay ? answer.p : undefined,
          mistake: refut ? refut.r.faux : answer && answer.kind === 'wrong' && !replay ? answer.p : undefined,
          // Indice : zone entourée autour du bon coup, tant que le problème n'est pas résolu.
          zone: aide >= 1 && !solvedNow && !replay && !refut ? puzzle.answers[0] : undefined
        }} />
      {verdict}
    </div>
  );
}
