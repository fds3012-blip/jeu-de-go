// Onglet Apprendre (issues #40, #54 ; chemin v3 ; épure #602) : chemin des leçons en courbe, carte de la prochaine leçon.
// Épure #602 : la carte de la prochaine leçon est le seul bloc qui parle ; le chemin montre les titres seuls, et ce qui
// est secondaire (jouer avec Mochi, revoir les règles, ouvertures) se range en liens discrets à la fin de son chapitre.
// Le lecteur de leçon et la fin de leçon sont dans Lecon.tsx (recette du 30/09, R2) ; ré-exportés ici pour src/app/ecrans.ts.
import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CHAPITRES, LESSONS, type Chapitre } from '../content/lessons';
import { Bubble } from '../ui/Mochi';
import { ThemesApprendre } from '../ui/ThemesApprendre';
import { themesAvecLecons } from './themesApprendre';
import type { Theme } from '../content/themesLecons';
import { VignetteLecon } from '../ui/VignetteLecon';
import { Confettis } from '../ui/Confettis';
import { fr } from '../ui/typo';
import { readLocal, writeLocal, type SyncState } from './hooks';
import { FETES_KEY, boutonChemin, chapitresAFeter, chapitresAVenir, colonne, courbe, dureeMinutes, etapes, type Ancre, type Etape, type Progression } from './apprendre';
import { t } from '../content/i18n/secondaires';
import type { EtatDecouverte } from './decouverteEtat';
import { EntreeOuvertures } from '../ui/EntreeOuvertures';
import '../ui/apprendre.css';

/** #591 : répertoire d'ouvertures, ouvert depuis le chapitre « L'ouverture », chargé à la demande. */
const EcranOuvertures = lazy(() => import('./Ouvertures'));

export { LessonPlayer, POSE_MS } from './Lecon';

/** Texte de l'état de synchronisation (#167 : clés `apprendre.synchro.*`). */
const texteSynchro = (s: SyncState) => t(`apprendre.synchro.${s}`);

/** Écart horizontal d'une colonne du chemin, en px à 390 px de large ; mis à l'échelle de l'écran en dessous (#121). */
const PAS_X = 92;

const Coche = () => <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5 10 17l9-10" /></svg>;
/** Verrou « compte » (#343) : une silhouette, pas un cadenas de progression ; la leçon reste touchable et mène à la création de compte. */
const Compte = () => <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="8.5" r="3.5" /><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" /></svg>;

/**
 * Ce que dit Mochi au-dessus de la carte de la prochaine leçon (#602, E5) : seulement quand il a quelque chose de neuf
 * à dire, au tout début du chemin et quand tout est fait. Sinon, le bouton (« Commencer », « Reprendre ») suffit.
 */
function phraseMochi(liste: Etape[], iEnCours: number): string | null {
  if (iEnCours < 0) return t('apprendre.mochi.fini');
  return iEnCours === 0 && liste[0].faites === 0 ? t('apprendre.mochi.debut') : null;
}

/** #602 : « Jouer avec Mochi » reste ouvert au retour d'une partie (l'écran Apprendre est remonté à chaque visite). */
let mochiDeplie = false;

/**
 * `compteRequis` (#343) : vrai si la leçon de ce rang (0 = leçon 1) demande un compte. Sans compte, les leçons 1 à 3 sont libres ;
 * les suivantes restent touchables, portent le verrou « compte », et `onOpen` ouvre la création de compte (garde d'App.tsx).
 */
export function LearnHome({ progress, onOpen, sync = 'local', compteRequis = () => false, decouverte, onRegles, onGuidee, onTheme }: {
  progress: Progression; onOpen: (id: string) => void; sync?: SyncState; compteRequis?: (rang: number) => boolean;
  /** #524 : la partie de découverte, en tête du chapitre « Les bases » (état gardé sur l'appareil, ouverture). */
  decouverte?: { etat: EtatDecouverte; ouvrir: () => void };
  /** #523 : « Revoir les règles » (l'introduction interactive), en tête de « Les bases », avant la partie de découverte. */
  onRegles?: () => void;
  /** #589 : la partie guidée contre Mochi, sous la partie de découverte. */
  onGuidee?: () => void;
  /** #590 : « Par thème », sous la carte de la prochaine leçon ; ouvre la page du thème. */
  onTheme?: (theme: Theme) => void;
}) {
  const liste = etapes(LESSONS, progress);
  const iEnCours = liste.findIndex(e => e.etat === 'encours');
  const bouton = boutonChemin(LESSONS, progress);
  const carte = useRef<HTMLLIElement | HTMLDivElement>(null);
  const [ouvertures, setOuvertures] = useState(false);
  // #121 : sous 390 px, les écarts horizontaux du chemin sont mis à l'échelle de l'écran ; à 390 px et plus, k = 1.
  const [k, setK] = useState(() => Math.min(1, window.innerWidth / 390));
  useEffect(() => {
    const maj = () => setK(Math.min(1, window.innerWidth / 390));
    window.addEventListener('resize', maj);
    return () => window.removeEventListener('resize', maj);
  }, []);

  // Fête de fin de chapitre : une seule fois par chapitre, mémorisée sur l'appareil.
  const [fete, setFete] = useState<string | null>(() => chapitresAFeter(CHAPITRES, progress, readLocal<string[]>(FETES_KEY, []))[0] ?? null);
  useEffect(() => {
    if (fete) writeLocal(FETES_KEY, [...new Set([...readLocal<string[]>(FETES_KEY, []), fete])]);
  }, [fete]);

  // Le chemin s'ouvre sur la prochaine leçon : si sa carte est sous la ligne de flottaison, on défile jusqu'à elle, d'un coup.
  // Un chapitre à fêter passe avant : on s'arrête sur son en-tête, là où le tampon d'or se pose.
  useEffect(() => {
    const section = fete ? document.querySelector<HTMLElement>(`[data-chapitre="${fete}"]`) : null;
    const r = (section ?? carte.current)?.getBoundingClientRect();
    if (!r) return;
    const bas = window.innerHeight - 96;
    if (section) { if (r.top > bas - 160 || r.top < 0) window.scrollBy({ top: r.top - 12, behavior: 'instant' as ScrollBehavior }); return; }
    if (r.bottom > bas) window.scrollBy({ top: Math.max(0, Math.min(r.top - 88, r.bottom - bas)), behavior: 'instant' as ScrollBehavior });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // #343, #602 : « avec un compte » une seule fois sur le chemin, à la première leçon qu'il ouvre (la carte, si c'est elle).
  const premierCompte = liste.find(e => e.etat !== 'faite' && compteRequis(e.rang - 1));
  const rangCompte = premierCompte && premierCompte.etat !== 'encours' ? premierCompte.rang : -1;

  const prochaine = bouton && <>
    <CarteProchaine refCarte={carte} etape={iEnCours >= 0 ? liste[iEnCours] : liste[0]} bouton={bouton} mochi={phraseMochi(liste, iEnCours)} onOpen={onOpen} compteRequis={compteRequis} />
    {onTheme && <ThemesApprendre themes={themesAvecLecons(LESSONS, progress)} onTheme={onTheme} />}
  </>;

  // #591 : au retour, le chemin revient sur la ligne « Ouvertures ».
  if (ouvertures) return <Suspense fallback={null}><EcranOuvertures onExit={() => { setOuvertures(false); requestAnimationFrame(() => document.querySelector('[data-testid="entree-ouvertures"]')?.scrollIntoView({ block: 'center' })); }} /></Suspense>;

  return (
    <div className="apprendre">
      {/* #228 : un chemin par chapitre, l'un sous l'autre ; une seule carte en relief, celle de la prochaine leçon. */}
      {CHAPITRES.map((c, i) => (
        <CheminChapitre key={c.id} chapitre={c} liste={liste.filter(e => c.lecons.includes(e.lecon))} k={k} rangCompte={rangCompte}
          suite={i === 0 ? <SuiteBases decouverte={decouverte} onGuidee={onGuidee} onRegles={onRegles} />
            : c.id === 'c2' ? <EntreeOuvertures onOpen={() => setOuvertures(true)} /> : null}
          carte={iEnCours >= 0 && c.lecons.includes(liste[iEnCours].lecon) ? prochaine : null}
          fete={fete === c.id} onFeteFinie={() => setFete(null)} onOpen={onOpen} compteRequis={compteRequis} />
      ))}

      {iEnCours < 0 && <div className="chemin-fini">{prochaine}</div>}

      <section className="a-venir" aria-labelledby="a-venir-titre">
        <h2 id="a-venir-titre" className="titre-pierres">{t('apprendre.bientot')}</h2>
        <p>{t('apprendre.bientot.texte')}</p>
        <ul>{chapitresAVenir().map(c => <li key={c}>{c}</li>)}</ul>
      </section>

      <p className={`synchro synchro-${sync}`} role="status" aria-busy={sync === 'sync'}>{texteSynchro(sync)}</p>
    </div>
  );
}

/** Nom accessible d'une pierre du chemin : rang, titre, état, et « avec un compte » si elle en demande un. */
function nomPas(e: Etape, compte = false): string {
  const etat = (e.etat === 'faite' ? t('apprendre.pas.faite') : e.etat === 'encours' ? t('apprendre.pas.encours') : '') + (compte ? t('apprendre.pas.compte') : '');
  const taille = e.lecon.taille && e.lecon.taille !== 9 ? `, ${t('apprendre.taille', { n: e.lecon.taille })}` : '';
  return t('apprendre.pas', { rang: e.rang, titre: e.lecon.title + taille, etat });
}

/** #454 : « 19 × 19 » sous le titre de la prochaine leçon, sur un grand plateau ; rien pour le 9 × 9 (sur le chemin : nom accessible seulement). */
const MentionTaille = ({ taille }: { taille?: number }) =>
  taille && taille !== 9 ? <span className="pas-taille" data-taille={taille}>{t('apprendre.taille', { n: taille })}</span> : null;

/** Mention visible sous une leçon qui demande un compte : « Avec un compte » sur la carte, « La suite s'ouvre… » sur le chemin. */
const MentionCompte = ({ texte = t('apprendre.compte') }: { texte?: string }) => <span className="pas-compte"><Compte />{texte}</span>;

/**
 * Carte de la prochaine leçon : la vignette et le titre disent de quoi il s'agit, la promesse et la durée donnent envie,
 * et le seul bouton en relief de l'écran l'ouvre. Mochi ne la présente qu'au début et à la fin du chemin.
 */
function CarteProchaine({ etape, bouton, mochi, onOpen, refCarte, compteRequis }: {
  etape: Etape; bouton: NonNullable<ReturnType<typeof boutonChemin>>; mochi: string | null; onOpen: (id: string) => void;
  compteRequis: (rang: number) => boolean;
  refCarte: React.RefObject<HTMLLIElement | HTMLDivElement | null>;
}) {
  const l = etape.lecon, compte = compteRequis(etape.rang - 1);
  return (
    <div className="prochaine" ref={refCarte as React.RefObject<HTMLDivElement>} data-testid="prochaine-lecon">
      {mochi && <Bubble voix="interface">{fr(mochi)}</Bubble>}
      <div className="prochaine-carte">
        <button className="pas-bouton" data-etat={etape.etat} data-compte={compte || undefined} aria-label={nomPas(etape, compte)} onClick={() => onOpen(l.id)}>
          <span className="pas-texte" aria-hidden="true">
            <VignetteLecon id={l.id} taille={72} />
            <span>
              <b>{fr(l.title)}</b>
              <small>{fr(l.desc)}</small>
              <MentionTaille taille={l.taille} />
              <span className="prochaine-duree">{t('apprendre.duree', { n: dureeMinutes(l.steps.length) })}</span>
              {compte && <MentionCompte />}
            </span>
          </span>
        </button>
        <button className="cta cta-chemin" aria-label={fr(bouton.texte)} onClick={() => onOpen(bouton.id)}>{bouton.verbe}</button>
      </div>
    </div>
  );
}

/**
 * #602 : fin du chapitre « Les bases ». Deux liens discrets au lieu de deux tuiles et d'un bouton en tête du chapitre :
 * « Jouer avec Mochi » déplie les deux parties avec lui (découverte #524, guidée #589), puis « Revoir les règles » (#523).
 */
function SuiteBases({ decouverte, onGuidee, onRegles }: { decouverte?: { etat: EtatDecouverte; ouvrir: () => void }; onGuidee?: () => void; onRegles?: () => void }) {
  // Une partie de découverte en cours se reprend d'un toucher : la liste s'ouvre d'elle-même.
  const [deplie, setDeplie] = useState(() => mochiDeplie || decouverte?.etat === 'encours');
  const basculer = () => { mochiDeplie = !deplie; setDeplie(mochiDeplie); };
  if (!decouverte && !onGuidee && !onRegles) return null;
  return (
    <div className="chapitre-suite">
      {(decouverte || onGuidee) && <>
        <button type="button" className="lien lien-chapitre" aria-expanded={deplie} aria-controls="jouer-avec-mochi" data-testid="jouer-avec-mochi" onClick={basculer}>
          {t('apprendre.avecMochi')}<svg className="lien-deplier" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        {deplie && (
          <div id="jouer-avec-mochi" className="avec-mochi" role="group" aria-label={t('apprendre.avecMochi')}>
            {decouverte && <CarteDecouverte {...decouverte} />}
            {onGuidee && <CarteGuidee ouvrir={onGuidee} />}
          </div>
        )}
      </>}
      {onRegles && <button type="button" className="lien lien-chapitre" data-testid="revoir-regles" onClick={onRegles}>{t('apprendre.revoirRegles')}</button>}
    </div>
  );
}

/** #524 : la partie de découverte (jouer, reprendre, rejouer). Une ligne secondaire : le nom, une phrase, le verbe. */
function CarteDecouverte({ etat, ouvrir }: { etat: EtatDecouverte; ouvrir: () => void }) {
  const verbe = t(`apprendre.decouverte.${etat}`);
  return (
    <button type="button" className="carte-decouverte" data-etat={etat} data-testid="carte-decouverte" onClick={ouvrir}
      aria-label={fr(t('apprendre.decouverte.aria', { etat: etat === 'finie' ? `${t('apprendre.decouverte.faite')}. ${verbe}` : verbe }))}>
      <span className="carte-decouverte-texte" aria-hidden="true">
        <b>{t('apprendre.decouverte')}</b>
        <small>{fr(t('apprendre.decouverte.texte'))}</small>
      </span>
      <span className="carte-decouverte-etat" aria-hidden="true">{etat === 'finie' && <Coche />}{verbe}</span>
    </button>
  );
}

/** #589 : la partie guidée contre Mochi (Mochi règle sa force), juste sous la découverte, même ligne. */
function CarteGuidee({ ouvrir }: { ouvrir: () => void }) {
  return (
    <button type="button" className="carte-decouverte carte-guidee" data-testid="carte-guidee" onClick={ouvrir} aria-label={fr(t('apprendre.guidee.aria'))}>
      <span className="carte-decouverte-texte" aria-hidden="true">
        <b>{t('apprendre.guidee')}</b>
        <small>{fr(t('apprendre.guidee.texte'))}</small>
      </span>
      <span className="carte-decouverte-etat" aria-hidden="true">{t('apprendre.decouverte.nouvelle')}</span>
    </button>
  );
}

/** Chemin d'un chapitre : en-tête (titre et mini-pierres), ses pierres sur une courbe, la prochaine leçon en carte. */
function CheminChapitre({ chapitre, liste, k, carte, fete, onFeteFinie, onOpen, compteRequis, suite, rangCompte }: {
  chapitre: Chapitre; liste: Etape[]; k: number; carte: ReactNode; fete: boolean; onFeteFinie: () => void; onOpen: (id: string) => void;
  /** #602 : les liens discrets posés sous le chemin (jouer avec Mochi et les règles pour « Les bases », les ouvertures). */
  suite?: ReactNode;
  compteRequis: (rang: number) => boolean;
  /** #602 : rang de la seule leçon du chemin qui porte la mention « La suite s'ouvre avec un compte » (−1 : aucune). */
  rangCompte: number;
}) {
  const iEnCours = liste.findIndex(e => e.etat === 'encours');
  const faites = liste.filter(e => e.etat === 'faite').length;
  const n = liste.length, fini = n > 0 && faites === n;
  const chemin = useRef<HTMLOListElement>(null);
  const embleme = useRef<HTMLSpanElement>(null);
  // Ancres mesurées à l'écran (centre des pierres, haut et bas de la carte) : la courbe les suit.
  const [ancres, setAncres] = useState<{ points: Ancre[]; parcouru: number; hauteur: number }>({ points: [], parcouru: 0, hauteur: 0 });
  const mesurer = () => {
    const ol = chemin.current;
    if (!ol) return;
    const boite = ol.getBoundingClientRect(), milieu = boite.left + boite.width / 2;
    const points: Ancre[] = [];
    let parcouru = 0;
    [...ol.children].forEach((li, i) => {
      const pierre = li.querySelector('.pierre-gue');
      if (pierre) {
        const r = pierre.getBoundingClientRect();
        points.push({ x: r.left + r.width / 2 - milieu, y: r.top + r.height / 2 - boite.top });
        if (liste[i]?.etat === 'faite' && (i < iEnCours || iEnCours < 0)) parcouru = points.length;
      } else {
        const r = li.getBoundingClientRect();
        points.push({ x: 0, y: r.top - boite.top + 4 });
        parcouru = points.length;
        points.push({ x: 0, y: r.bottom - boite.top - 4 });
      }
    });
    const hauteur = Math.round(boite.height);
    setAncres(a => (a.hauteur === hauteur && a.parcouru === parcouru && a.points.length === points.length && a.points.every((p, i) => p.x === points[i].x && p.y === points[i].y) ? a : { points, parcouru, hauteur }));
  };
  useLayoutEffect(mesurer, [k, liste, iEnCours]);
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !chemin.current) return;
    const obs = new ResizeObserver(mesurer);
    obs.observe(chemin.current);
    for (const li of chemin.current.children) obs.observe(li);
    return () => obs.disconnect();
  }, [liste.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const route = useMemo(() => courbe(ancres.points), [ancres.points]);
  const dore = useMemo(() => courbe(ancres.points.slice(0, fini ? ancres.points.length : ancres.parcouru)), [ancres, fini]);
  const [gerbe, setGerbe] = useState<null | { x: number; y: number }>(null);
  useEffect(() => {
    if (!fete) return;
    const r = embleme.current?.getBoundingClientRect();
    setGerbe(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth / 2, y: 160 });
  }, [fete]);

  return (
    <section className={`chapitre-chemin${fini ? ' chapitre-fini' : ''}`} data-chapitre={chapitre.id} data-fete={fete || undefined} aria-labelledby={`chapitre-${chapitre.id}`}>
      {/* #602 : titre et mini-pierres seulement ; le compte des leçons est lu par le lecteur d'écran. */}
      <header className="chapitre">
        <h2 id={`chapitre-${chapitre.id}`}>{fr(chapitre.titre)}</h2>
        <div className="chapitre-compte">
          <span ref={embleme} className="chapitre-pierres" role="img" aria-label={t('apprendre.chapitre.aria', { n: faites, total: n })}>{liste.map(e => <i key={e.lecon.id} className={e.etat} />)}</span>
          {fini && chapitre.complet && <span className="chapitre-fete" role="img" aria-label={fr(t('apprendre.fete.aria', { titre: chapitre.titre }))}><Coche />{t('apprendre.fete.titre')}</span>}
        </div>
      </header>

      <div className="gue">
        <svg className="gue-trace" width="1" height={ancres.hauteur} aria-hidden="true" focusable="false">
          <path d={route} className="gue-route" />
          {dore && <path d={dore} className="gue-parcouru" />}
        </svg>
        <ol ref={chemin}>
          {liste.map((e, i) => {
            if (e.etat === 'encours' && carte) return <li key={e.lecon.id} className="pas pas-encours">{carte}</li>;
            // Sous 390 px, toutes les pierres vont au bord (±1) : un titre comme « Techniques » garde sa ligne en face.
            const col = k < 1 ? Math.sign(colonne(i)) : colonne(i), droite = col > 0;
            const style = { '--x': `${Math.round(col * PAS_X * k)}px` } as CSSProperties;
            // À venir : pierre grise, toujours touchable (on peut sauter une leçon). Seul le compte (#343) verrouille.
            const compte = e.etat !== 'faite' && compteRequis(e.rang - 1);
            return (
              <li key={e.lecon.id} className={`pas pas-${e.etat} ${droite ? 'a-droite' : 'a-gauche'}`} style={style}>
                <button className="pas-bouton" data-etat={e.etat} data-compte={compte || undefined} aria-label={nomPas(e, compte)} onClick={() => onOpen(e.lecon.id)}>
                  <span className="pierre-gue" aria-hidden="true">
                    {e.etat === 'faite' && <span className="pierre-coche"><Coche /></span>}
                    {compte && <span className="pierre-compte"><Compte /></span>}
                  </span>
                  {/* #602 : le titre seul ; la promesse, la taille et la durée sont sur la carte de la prochaine leçon. */}
                  <span className="pas-texte" aria-hidden="true">
                    <span><b>{fr(e.lecon.title)}</b>{e.rang === rangCompte && <MentionCompte texte={t('apprendre.compte.suite')} />}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      {suite}
      {gerbe && <Confettis origine={gerbe} onFin={() => { setGerbe(null); onFeteFinie(); }} />}
    </section>
  );
}
