// Onglet Apprendre (issues #40, #54 ; épure #602 ; sommaire #652, règle A13 de DESIGN.md).
// #652 (retour de Florian : « pas besoin des lignes zigzag ; la partie Par thème est suffisante ; même pas besoin de
// mentionner le Bientôt ») : un sommaire. En haut, la carte de la prochaine leçon, seule action en relief ; puis trois
// entrées au même format (Ouvertures, Jouer avec Mochi, Revoir les règles) ; enfin la grille de tous les thèmes, la seule
// liste longue, rangée en dernier (P5). Chaque leçon s'ouvre depuis la page de son thème (ThemeLecons) : un test le
// vérifie pour les 55 (src/app/themesApprendre.test.ts). Le lecteur de leçon et sa fin sont dans Lecon.tsx.
import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CHAPITRES, LESSONS } from '../content/lessons';
import { Bubble } from '../ui/Mochi';
import { ThemesApprendre } from '../ui/ThemesApprendre';
import { themesAvecLecons } from './themesApprendre';
import type { Theme } from '../content/themesLecons';
import { VignetteLecon } from '../ui/VignetteLecon';
import { Confettis } from '../ui/Confettis';
import { MiniGoban } from '../ui/MiniGoban';
import { PortraitMochi } from '../ui/Portrait';
import { Sommaire } from '../ui/Sommaire';
import { EnteteEcran } from '../ui/BoutonRetour';
import { MentionCompte } from '../ui/MentionCompte';
import { fr } from '../ui/typo';
import { readLocal, writeLocal, type SyncState } from './hooks';
import { FETES_KEY, boutonChemin, chapitresAFeter, dureeMinutes, etapes, nomLecon, type Etape, type Progression } from './apprendre';
import { t } from '../content/i18n/secondaires';
import type { EtatDecouverte } from './decouverteEtat';
import { tentree } from '../content/i18n/ouverturesEntree';
import '../ui/apprendre.css';

/** #591 : répertoire d'ouvertures, ouvert depuis le sommaire, chargé à la demande. */
const EcranOuvertures = lazy(() => import('./Ouvertures'));

export { LessonPlayer, POSE_MS } from './Lecon';

/** Texte de l'état de synchronisation (#167 : clés `apprendre.synchro.*`). */
const texteSynchro = (s: SyncState) => t(`apprendre.synchro.${s}`);

const Coche = () => <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5 10 17l9-10" /></svg>;

/** Visuels des entrées du sommaire (P3 : le go se montre). Ouvertures : deux pierres dans un coin ; règles : une prise. */
const COIN = ['.......', '.......', '.......', '...X...', '....O..', '.......', '.......'];
const REGLES = ['.....', '..X..', '.XOX.', '.....', '.....'];

/**
 * Ce que dit Mochi au-dessus de la carte de la prochaine leçon (#602, E5) : seulement quand il a quelque chose de neuf
 * à dire, au tout début et quand tout est fait. Sinon, le bouton (« Commencer », « Reprendre ») suffit.
 */
function phraseMochi(liste: Etape[], iEnCours: number): string | null {
  if (iEnCours < 0) return t('apprendre.mochi.fini');
  return iEnCours === 0 && liste[0].faites === 0 ? t('apprendre.mochi.debut') : null;
}

/**
 * #652 (A13, A6) : où en était le sommaire quand un détail s'est ouvert (page d'un thème, Jouer avec Mochi) : son
 * défilement et l'entrée touchée (un sélecteur). Le sommaire, remonté à la sortie du détail, y revient.
 */
let quitte: { y: number; entree: string } | null = null;
function quitter(entree: string) {
  quitte = { y: window.scrollY, entree };
  window.scrollTo({ top: 0 });
}

/**
 * `compteRequis` (#343) : vrai si la leçon de ce rang (0 = leçon 1) demande un compte. Sans compte, les leçons 1 à 3 sont libres ;
 * les suivantes restent touchables, portent le verrou « compte », et `onOpen` ouvre la création de compte (garde d'App.tsx).
 */
export function LearnHome({ progress, onOpen, sync = 'local', compteRequis = () => false, onRegles, onMochi, onTheme }: {
  progress: Progression; onOpen: (id: string) => void; sync?: SyncState; compteRequis?: (rang: number) => boolean;
  /** #523 : « Revoir les règles » (l'introduction interactive). */
  onRegles?: () => void;
  /** #652 : « Jouer avec Mochi » ouvre son détail (partie de découverte #524, partie guidée #589). */
  onMochi?: () => void;
  /** #590 : la grille « Par thème » ; ouvre la page du thème, d'où s'ouvrent ses leçons. */
  onTheme?: (theme: Theme) => void;
}) {
  const liste = etapes(LESSONS, progress);
  const iEnCours = liste.findIndex(e => e.etat === 'encours');
  const bouton = boutonChemin(LESSONS, progress);
  const [ouvertures, setOuvertures] = useState(false);
  useLayoutEffect(() => {
    const q = quitte;
    quitte = null;
    if (!q) return;
    window.scrollTo(0, q.y);
    document.querySelector<HTMLElement>(`.apprendre ${q.entree}`)?.focus({ preventScroll: true });
  }, []);

  // Fête de fin de chapitre (#200) : une seule fois par chapitre, mémorisée sur l'appareil. Plus d'en-tête de chapitre
  // (#652) : le tampon d'or se pose en tête du sommaire, au-dessus de la prochaine leçon, pour cette visite.
  const [fete] = useState<string | null>(() => chapitresAFeter(CHAPITRES, progress, readLocal<string[]>(FETES_KEY, []))[0] ?? null);
  useEffect(() => {
    if (fete) writeLocal(FETES_KEY, [...new Set([...readLocal<string[]>(FETES_KEY, []), fete])]);
  }, [fete]);

  // #591 : au retour, le sommaire revient sur l'entrée « Ouvertures », focus compris (A6).
  if (ouvertures) return <Suspense fallback={null}><EcranOuvertures onLecon={id => { setOuvertures(false); onOpen(id); }} onExit={() => { setOuvertures(false); requestAnimationFrame(() => { const e = document.querySelector<HTMLElement>('[data-testid="entree-ouvertures"]'); e?.scrollIntoView({ block: 'center' }); e?.focus({ preventScroll: true }); }); }} /></Suspense>;

  const entrees = [
    { cle: 'ouvertures', nom: tentree('titre'), aria: `${tentree('titre')}. ${tentree('texte')}`, visuel: <MiniGoban rows={COIN} />, testId: 'entree-ouvertures',
      onOuvrir: () => { window.scrollTo({ top: 0 }); setOuvertures(true); } },
    ...(onMochi ? [{ cle: 'mochi', nom: t('apprendre.avecMochi'), visuel: <PortraitMochi taille={40} decoratif />, testId: 'jouer-avec-mochi',
      onOuvrir: () => { quitter('[data-entree="mochi"]'); onMochi(); } }] : []),
    ...(onRegles ? [{ cle: 'regles', nom: t('apprendre.revoirRegles'), visuel: <MiniGoban rows={REGLES} />, testId: 'revoir-regles', onOuvrir: onRegles }] : []),
  ];

  return (
    <div className="apprendre">
      {fete && <FeteChapitre id={fete} />}
      {bouton && <CarteProchaine etape={iEnCours >= 0 ? liste[iEnCours] : liste[0]} bouton={bouton} mochi={phraseMochi(liste, iEnCours)} onOpen={onOpen} compteRequis={compteRequis} />}
      <Sommaire entrees={entrees} nom={t('apprendre.aussi')} className="apprendre-entrees" testId="apprendre-entrees" />
      {onTheme && <ThemesApprendre themes={themesAvecLecons(LESSONS, progress)} onTheme={th => { quitter(`.theme-carte[data-theme="${th}"]`); onTheme(th); }} />}
      <p className={`synchro synchro-${sync}`} role="status" aria-busy={sync === 'sync'}>{texteSynchro(sync)}</p>
    </div>
  );
}

/** Le tampon d'or du chapitre fini, et les confettis (une fois, sauf mouvements réduits : Confettis ne rend rien). */
function FeteChapitre({ id }: { id: string }) {
  const titre = CHAPITRES.find(c => c.id === id)?.titre ?? '';
  const tampon = useRef<HTMLSpanElement>(null);
  const [gerbe, setGerbe] = useState<null | { x: number; y: number }>(null);
  useEffect(() => {
    const r = tampon.current?.getBoundingClientRect();
    setGerbe(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth / 2, y: 160 });
  }, []);
  return (
    <div className="chapitre-annonce" data-chapitre={id} data-fete="true">
      <span ref={tampon} className="chapitre-fete" role="img" aria-label={fr(t('apprendre.fete.aria', { titre }))}><Coche />{fr(t('apprendre.fete.aria', { titre }))}</span>
      {gerbe && <Confettis origine={gerbe} onFin={() => setGerbe(null)} />}
    </div>
  );
}

/** #454 : « 19 × 19 » sous le titre de la prochaine leçon, sur un grand plateau ; rien pour le 9 × 9. */
const MentionTaille = ({ taille }: { taille?: number }) =>
  taille && taille !== 9 ? <span className="pas-taille" data-taille={taille}>{t('apprendre.taille', { n: taille })}</span> : null;

/**
 * Carte de la prochaine leçon : la vignette et le titre disent de quoi il s'agit, la promesse et la durée donnent envie,
 * et le seul bouton en relief de l'écran l'ouvre. Mochi ne la présente qu'au début et à la fin.
 */
function CarteProchaine({ etape, bouton, mochi, onOpen, compteRequis }: {
  etape: Etape; bouton: NonNullable<ReturnType<typeof boutonChemin>>; mochi: string | null; onOpen: (id: string) => void;
  compteRequis: (rang: number) => boolean;
}) {
  const l = etape.lecon, compte = compteRequis(etape.rang - 1);
  return (
    <div className="prochaine" data-testid="prochaine-lecon">
      {mochi && <Bubble voix="interface">{fr(mochi)}</Bubble>}
      <div className="prochaine-carte">
        <button className="pas-bouton" data-etat={etape.etat} data-compte={compte || undefined} aria-label={nomLecon(etape, compte)} onClick={() => onOpen(l.id)}>
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
 * #652 : détail de « Jouer avec Mochi » (A13). Les deux parties avec lui : la partie de découverte (#524, jouer, reprendre,
 * rejouer) et la partie guidée (#589). « ‹ » ramène au sommaire d'Apprendre.
 */
export function JouerAvecMochi({ decouverte, onGuidee, onRetour }: {
  decouverte: { etat: EtatDecouverte; ouvrir: () => void }; onGuidee: () => void; onRetour: () => void;
}) {
  return (
    <div className="apprendre avec-mochi-ecran">
      <EnteteEcran titre={t('apprendre.avecMochi')} retour={t('partie.retourApprendre')} onRetour={onRetour} />
      <div className="avec-mochi" role="group" aria-label={t('apprendre.avecMochi')}>
        <CarteDecouverte {...decouverte} />
        <CarteGuidee ouvrir={onGuidee} />
      </div>
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
