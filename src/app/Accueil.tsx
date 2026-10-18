// Écran d'accueil v3 (issue #40, phase 4 ; #119 : une seule action principale ; v3 : les 60 premières secondes).
// Premier lancement : une promesse en une phrase (Mochi), le goban, le bouton « Joue ta première partie », et
// « Je sais déjà jouer » en lien discret. Ni XP ni niveau tant qu'il n'y a rien à montrer, l'adversaire nommé
// sans son rang : rien à lire avant la première pierre (modèles : premier écran de chess.com et de Duolingo).
// Retours : l'adversaire parle, le bouton propose la partie, et sous lui « Aujourd'hui » met en avant la bonne
// chose à faire (défi où c'est ton tour, Go du jour à faire, leçon suivante ; src/app/aujourdhui.ts).
// #429 : tous les modes de jeu en 1 toucher, ou 2 par « Plus » : une rangée de tuiles sous le bouton (src/app/modes.ts).
// #432 : la partie en ligne classée en action principale dès le début (cote et grade visibles) ; l'ordi est une tuile.
// #487 : avant la toute première pierre posée (`epure`, src/app/premierePierre.ts), ni tuiles de modes ni cartes
// secondaires : la promesse, le goban, l'adversaire, le bouton et « Je sais déjà jouer ». Tout revient dès la première pierre.
// #509 (L4) : le mot « kyu » expliqué dans la feuille « Ton adversaire », là où l'on choisit un adversaire par son grade.
// #613 : l'ouverture va droit à l'action. Ni niveau ni XP (Profil, fin de partie), ni grade ni cote (lancement d'une
// partie classée, sa fin, Profil), ni taille du plateau : elle se choisit en lançant la partie (src/app/LancementPartie.tsx).
import { Suspense, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Board } from '../ui/Board';
import { Sceau } from '../ui/Sceau';
import { Portrait } from '../ui/Portrait';
import { Mochi } from '../ui/Mochi';
import { MiniGoban } from '../ui/MiniGoban';
import type { CarteAdversaire } from '../ui/Carrousel';
import { FeuilleLancement } from './ecrans';
import type { ReglagesAvances } from './LancementPartie';
import type { Opponent } from '../engine';
import type { Accueil as TextesAccueil } from './home';
import { ordreDuJour, type TuileDuJour } from './aujourdhui';
import { fr } from '../ui/typo';
import { t } from '../content/i18n';
import type { Depuis, Lancement, Mode, ModesAccueil } from './modes';
import { besoinReseau } from './horsLigne';

type Taille = 9 | 13 | 19;

/** Tuile du Go du jour (issue #75) : le défi commun, numéroté. */
export interface TuileProbleme { titre: string; reussi: boolean; rows: string[]; numero: number;
  /** Pastille d'état (#236, N4) : « Fait », « À faire », ou rien (premier lancement, autre appel à l'écran). */
  etat?: 'fait' | 'aFaire' | null }
export interface TuileLecon { titre: string }
/** Défis d'amis où c'est ton tour (#81) : la tuile passe en premier. */
export interface TuileDefis { n: number; ouvrir: () => void;
  /** #367 : un seul défi en attente, adversaire connu : « Contre Léa » (la tuile ouvre alors la partie). */
  adversaire?: string | null }

/** #440 : parties lentes, sur l'accueil : « À toi de jouer (N) » et la recherche en cours (ou l'adversaire trouvé). */
export interface TuileLentes {
  aJouer: number;
  recherche: { trouvee: boolean } | null;
  /** La partie (s'il n'y en a qu'une où c'est à toi), sinon l'écran des parties lentes. */
  ouvrir: () => void;
  /** Annule la recherche ; si l'adversaire est trouvé, ouvre la partie. */
  quitter: () => void;
  /** #498 : l'annulation a échoué (hors ligne : refaite au retour de la connexion). */
  erreur?: 'hors-ligne' | 'erreur' | null;
}

interface Props {
  adv: Opponent;
  battu: boolean;
  textes: TextesAccueil;
  taille: Taille;
  cartes: CarteAdversaire<Opponent['id']>[];
  /** #613 : feuille de lancement ouverte (l'ordi, à deux), ou null. */
  lancement: Lancement | null;
  setLancement: (m: Lancement | null) => void;
  /** Lance la partie choisie dans la feuille de lancement. */
  onJouer: (m: Lancement) => void;
  onTaille: (t: Taille) => void;
  onChoisir: (id: Opponent['id']) => void;
  /** #429 : action principale, tuiles et « Plus » (src/app/modes.ts). */
  modes: ModesAccueil;
  /** Un mode choisi, et d'où (bouton, goban, tuile, « Plus ») : mesuré par `mode_choisi`. */
  onMode: (mode: Mode, depuis: Depuis) => void;
  /** Défis d'amis où c'est ton tour : la tuile « Un ami » le dit. */
  defisAJouer?: number;
  probleme?: TuileProbleme;
  onProbleme: () => void;
  /** Leçon suivante ; absente quand tout le chemin est fait. */
  lecon?: TuileLecon;
  onLecon: () => void;
  defis?: TuileDefis;
  lentes?: TuileLentes;
  /** Carte « Installe l'app » (#214), sous les tuiles, au 2e retour ; elle décide seule si elle se montre. */
  installation?: ReactNode;
  /** #369 : bilan de la semaine passée, au même endroit, une fois par semaine (un seul appel secondaire à la fois). */
  semaine?: ReactNode;
  /** « Je sais déjà jouer » (#283) : lien discret sous le bouton, au premier lancement seulement. */
  onPlacement?: () => void;
  /** #469 : « Révisions du jour (N) », carte secondaire dans « Aujourd'hui » (absente s'il n'y a rien à revoir). */
  revisions?: { n: number; ouvrir: () => void };
  /** #487 : tout premier lancement, aucune pierre posée : une seule action, rien d'autre à choisir. */
  epure?: boolean;
  /** #528 : « Réglages de la partie » (handicap, komi, comptage), groupe replié de la feuille de lancement. */
  reglagesPartie?: ReglagesAvances;
  /** #528 : partie interrompue contre l'ordi : la tuile « Reprendre ta partie » (jamais au premier lancement épuré). */
  reprise?: TuileReprise;
  /** #538 : hors ligne, les tuiles qui ont besoin du réseau (en ligne, un ami, défis, parties lentes) sont grisées, avec la raison. */
  horsLigne?: boolean;
}

/** #528 : partie contre l'ordi interrompue (fermeture, veille, rechargement), à reprendre où elle s'est arrêtée. */
export interface TuileReprise { id: Opponent['id']; nom: string; taille: Taille; coups: number; ouvrir: () => void }

/**
 * #538 : tuile qui a besoin du réseau, hors ligne : trait clair (le pointillé dit déjà « leçon »), pictogramme éteint,
 * pastille neutre. En style en ligne : ces tuiles ne s'affichent que hors ligne, le CSS initial n'a pas à les porter.
 */
const INDISPO = { background: 'none', boxShadow: 'inset 0 0 0 1px var(--line)', cursor: 'default' } as const;
const ETEINT = { filter: 'grayscale(1)', opacity: 0.45 } as const;
const ETAT_INDISPO = { display: 'inline-flex', background: 'var(--surface-2)', color: 'var(--muted)' } as const;

/** #487 : l'accueil a été montré épuré pendant cette session ; au retour après la première pierre, les tuiles arrivent en fondu. */
let vuEpure = false;

const PLATEAUX: Record<Taille, Int8Array> = { 9: new Int8Array(81), 13: new Int8Array(169), 19: new Int8Array(361) };
/** Premier lancement : quelques pierres au centre, pour que le goban ressemble à une partie (illustration seulement). */
const PLATEAU_PREMIER: Record<Taille, Int8Array> = (() => {
  const scene = (n: Taille) => {
    const b = new Int8Array(n * n), c = (n - 1) / 2;
    const pose = (dx: number, dy: number, couleur: 1 | 2) => { b[(c + dy) * n + (c + dx)] = couleur; };
    pose(0, 0, 1); pose(-1, 1, 1); pose(1, -1, 1); pose(-1, 0, 2); pose(1, 1, 2);
    return b;
  };
  return { 9: scene(9), 13: scene(13), 19: scene(19) };
})();

export function Accueil(p: Props) {
  const { adv, textes, taille } = p;
  const premier = textes.nouveau;
  // Sans état fourni : l'ancien comportement (« Fait » ou « À faire »).
  const etat = p.probleme ? (p.probleme.etat !== undefined ? p.probleme.etat : p.probleme.reussi ? 'fait' : 'aFaire') : null;
  const defis = p.defis && p.defis.n > 0 ? p.defis : undefined;
  const tuiles = ordreDuJour({ premier, defis: defis?.n ?? 0, goDuJour: p.probleme ? (etat ?? 'neutre') : null, lecon: !!p.lecon });
  const enAvant = tuiles.some(x => x.enAvant);
  const enLigne = p.modes.principal === 'en_ligne';
  // #440 : point d'or sur « Jouer en ligne » (bouton ou tuile) quand une partie lente attend ton coup.
  const lentesAJouer = p.lentes?.aJouer ?? 0;
  const cta = enLigne ? t('accueil.cta.enLigne') : textes.cta;
  const revisions = !premier && p.revisions && p.revisions.n > 0 ? p.revisions : undefined;
  const [plusOuvert, setPlusOuvert] = useState(false);
  // #613 : la feuille de lancement, chargée à la première ouverture, reste montée ensuite (sa sortie est animée).
  const [dernier, setDernier] = useState<Lancement | null>(null);
  useEffect(() => { if (p.lancement) setDernier(p.lancement); }, [p.lancement]);
  const epure = !!p.epure;
  // Lu une fois au montage : les tuiles révélées après la première pierre arrivent une seule fois en fondu.
  const [revele] = useState(() => !epure && vuEpure);
  useEffect(() => { vuEpure = epure; }, [epure]);

  return (
    <div className={`accueil${premier ? ' accueil-premier' : ''}${revele ? ' accueil-revele' : ''}`} data-premier={premier || undefined} data-epure={epure || undefined}>
      {/* Premier lancement : la promesse, en une phrase, par Mochi. Elle porte la classe de la réplique (`scene-bulle`) :
          c'est la seule voix de l'écran, et elle invite à la même action que le bouton. */}
      {/* #592 : la promesse ne parle qu'avant la première pierre ; ensuite, elle a fait son travail. */}
      {premier && epure && (
        <div className="promesse" data-testid="promesse">
          <Mochi size={40} />
          <p className="scene-bulle">{textes.bulle}</p>
        </div>
      )}

      {/* Le goban est une illustration : plateau entier, aucune bulle ni pierre qui pulse par-dessus.
          Il reste touchable (même effet que le bouton), sans y inviter. */}
      <div className="scene">
        {/* Doublon tactile du bouton principal : masqué aux lecteurs d'écran, qui ont déjà le bouton. */}
        <div className="scene-plateau" aria-hidden="true" data-testid="plateau-accueil" onClick={() => p.onMode(p.modes.principal, 'plateau')}>
          <div className="scene-cadre">
            <Board size={taille} board={premier ? PLATEAU_PREMIER[taille] : PLATEAUX[taille]} />
          </div>
        </div>
      </div>

      {premier ? (
        // Une ligne : l'adversaire (nommé, sans rang : rien à expliquer avant la première pierre) et « Changer ».
        <div className="reglage reglage-premier">
          <Portrait id={adv.id} taille={32} decoratif signature={false} />
          <div className="reglage-contre">
            <h2>{adv.nom}</h2>
            <span>{t('accueil.premierAdversaire')}</span>
          </div>
          <button className="lien" aria-haspopup="dialog" aria-expanded={p.lancement === 'ordi'} onClick={() => p.setLancement('ordi')}>{t('accueil.changer')}</button>
        </div>
      ) : enLigne ? null : (
        // L'adversaire parle sous le plateau : sa bulle ne cache plus aucune ligne. #613 : en ligne, rien entre le goban
        // et le bouton : le grade et la cote attendent l'écran de lancement de la partie classée.
        <div className="adversaire">
          <Portrait id={adv.id} taille={48} decoratif signature={false} />
          <div className="adversaire-texte">
            <div className="adversaire-identite">
              <h2>{adv.nom}</h2>
              <span>{adv.rang}</span>
            </div>
            <p className="scene-bulle">{textes.bulle}</p>
          </div>
        </div>
      )}

      {/* Libellé court (« Jouer contre Pomme ») : taille pleine ; long (première partie) : un cran plus petit, sur une ligne. */}
      <button className={`cta cta-sceau${cta.length <= 26 ? ' court' : ''}${enLigne && lentesAJouer ? ' a-jouer' : ''}`} aria-label={enLigne ? t('accueil.cta.enLigneNom') : textes.ctaNom}
        data-mode={p.modes.principal} onClick={() => p.onMode(p.modes.principal, 'bouton')}>
        {enLigne ? <IconeMode mode="en_ligne" /> : <Sceau id={adv.id} taille={30} />}{cta}
      </button>
      {p.onPlacement && <button type="button" className="lien lien-placement" onClick={p.onPlacement}>{t('placement.lien')}</button>}

      {/* #487 : avant la première pierre, rien d'autre à choisir que la partie (et « Je sais déjà jouer »). */}
      {!epure && <>
        {/* #429 : les autres modes, en un toucher ; « Plus » pour le reste. Toujours dans le même ordre. */}
        <div className="modes" data-testid="modes">
          {p.modes.tuiles.map(m => <TuileMode key={m} mode={m} p={p} />)}
          {p.modes.plus.length > 0 && (
            <button type="button" className="mode" data-testid="mode-plus" aria-haspopup="dialog" aria-expanded={plusOuvert}
              aria-label={t('mode.plus.aria')} onClick={() => setPlusOuvert(true)}>
              <span className="mode-icone" aria-hidden="true"><IconeMode mode="plus" /></span>
              <b>{t('mode.plus')}</b>
            </button>
          )}
        </div>

        {p.reprise && <TuileReprendre r={p.reprise} />}

        {p.lentes && (p.lentes.aJouer > 0 || p.lentes.recherche) && <TuilesLentes l={p.lentes} horsLigne={!!p.horsLigne} />}

        {/* Aujourd'hui : la bonne chose à faire en premier, mise en avant ; les autres tuiles suivent. */}
        {(tuiles.length > 0 || revisions) && (
          // #592 : plus de titre visible « Aujourd'hui » ; le groupe garde son nom pour le lecteur d'écran.
          <div className={`tuiles${enAvant ? ' tuiles-jour' : ''}`} role={enAvant ? 'group' : undefined} aria-label={enAvant ? t('accueil.aujourdhui') : undefined}>
            {tuiles.map(tu => <Tuile key={tu.genre} tuile={tu} p={p} etat={etat} defis={defis} />)}
            {/* #469 : jamais en avant (une seule action principale) ; elle suit les tuiles du jour. */}
            {revisions && <TuileRevisions r={revisions} />}
          </div>
        )}

        {p.semaine}
        {p.installation}
      </>}

      {dernier && (
        <Suspense fallback={null}>
          <FeuilleLancement mode={p.lancement} dernier={dernier} fermer={() => p.setLancement(null)} adv={adv} cartes={p.cartes}
            taille={taille} onTaille={p.onTaille} onChoisir={p.onChoisir} cta={textes.cta} ctaNom={textes.ctaNom} onJouer={p.onJouer}
            reglagesPartie={p.reglagesPartie} />
        </Suspense>
      )}
      {!epure && p.modes.plus.length > 0 && <FeuillePlus modes={p.modes.plus} ouvert={plusOuvert} setOuvert={setPlusOuvert} onMode={p.onMode} />}
    </div>
  );
}

/** #528 : « Reprendre ta partie » : la partie interrompue contre l'ordi, en tuile (le bouton principal ne change pas). */
function TuileReprendre({ r }: { r: TuileReprise }) {
  const v = { nom: r.nom, taille: r.taille, n: r.coups };
  return (
    <div className="tuiles">
      <button type="button" className="tuile tuile-defi tuile-avant" onClick={r.ouvrir} data-testid="tuile-reprise" aria-label={t('accueil.reprise.aria', v)}>
        <span className="tuile-pierres" aria-hidden="true"><Sceau id={r.id} taille={36} /></span>
        <span>
          <small>{t('accueil.reprise.detail', v)}</small>
          <b>{t('accueil.reprise.titre')}</b>
        </span>
        <em className="tuile-etat" aria-hidden="true">{t('accueil.reprise.etat')}</em>
      </button>
    </div>
  );
}

/** #440 : « À toi de jouer (N) » (parties lentes), puis la recherche en cours, qu'on annule d'ici. */
function TuilesLentes({ l, horsLigne }: { l: TuileLentes; horsLigne: boolean }) {
  return (
    <div className="tuiles tuiles-lentes">
      {l.aJouer > 0 && (
        <button className={`tuile tuile-defi tuile-avant${horsLigne ? ' indispo' : ''}`} onClick={horsLigne ? undefined : l.ouvrir} data-testid="tuile-lente"
          style={horsLigne ? INDISPO : undefined}
          aria-disabled={horsLigne || undefined}
          aria-label={horsLigne ? t('horsLigne.tuileAria', { nom: t('lente.accueil.aJouer', { n: l.aJouer }) }) : t('lente.accueil.aJouerAria', { n: l.aJouer })}>
          <span className="tuile-pierres" aria-hidden="true" style={horsLigne ? ETEINT : undefined}><span className="stone b" /><span className="stone w" /></span>
          <span>
            <small>{t('lente.accueil.tuile', { n: l.aJouer })}</small>
            <b>{t('lente.accueil.aJouer', { n: l.aJouer })}</b>
          </span>
          <em className="tuile-etat" aria-hidden="true" style={horsLigne ? ETAT_INDISPO : undefined}>{t(horsLigne ? 'horsLigne.tuile' : 'defi.accueil.tuileEtat')}</em>
        </button>
      )}
      {l.recherche?.trouvee && (
        <button className="tuile tuile-defi tuile-avant" onClick={l.quitter} data-testid="tuile-lente-trouvee">
          <span className="tuile-pierres" aria-hidden="true"><span className="stone b" /><span className="stone w" /></span>
          <span><small>{t('lente.accueil.recherche')}</small><b>{t('lente.accueil.trouve')}</b></span>
          <em className="tuile-etat" aria-hidden="true">{t('lente.accueil.trouveEtat')}</em>
        </button>
      )}
      {l.recherche && !l.recherche.trouvee && (
        <div className="tuile tuile-recherche" data-testid="tuile-lente-recherche">
          <button type="button" className="tuile-recherche-ouvrir" onClick={l.ouvrir}>
            <small>{t('lente.accueil.recherche')}</small><b>{t('lente.accueil.rechercheEtat')}</b>
          </button>
          <button type="button" className="lien" onClick={l.quitter} aria-label={t('lente.accueil.annulerAria')}>{t('lente.accueil.annuler')}</button>
        </div>
      )}
      {l.recherche && l.erreur && (
        <p className="muted small tuiles-lentes-erreur" role="status" data-testid="lente-quitter-erreur">
          {fr(t(l.erreur === 'hors-ligne' ? 'lente.accueil.quitterHorsLigne' : 'lente.accueil.quitterErreur'))}
        </p>
      )}
    </div>
  );
}

function Tuile({ tuile, p, etat, defis }: { tuile: TuileDuJour; p: Props; etat: 'fait' | 'aFaire' | null; defis?: TuileDefis }) {
  const avant = tuile.enAvant ? ' tuile-avant' : '';
  if (tuile.genre === 'defi' && defis) {
    const off = !!p.horsLigne;
    return (
      <button className={`tuile tuile-defi${avant}${off ? ' indispo' : ''}`} onClick={off ? undefined : defis.ouvrir} data-testid="tuile-defi"
        style={off ? INDISPO : undefined}
        aria-disabled={off || undefined}
        aria-label={off ? t('horsLigne.tuileAria', { nom: t('defi.accueil.tuile', { n: defis.n }) }) : defis.adversaire
          ? `${t('defi.accueil.tuile', { n: 1 })}, ${t('aFaire.contre', { pseudo: defis.adversaire })}, ${t('defi.accueil.tuileEtat')}.`
          : t('defi.accueil.tuileAria', { n: defis.n })}>
        <span className="tuile-pierres" aria-hidden="true" style={off ? ETEINT : undefined}><span className="stone b" /><span className="stone w" /></span>
        <span>
          <small>{t('defi.accueil.tuile', { n: defis.n })}</small>
          <b>{defis.adversaire ? t('aFaire.contre', { pseudo: defis.adversaire }) : t('defi.accueil.tuileEtat')}</b>
        </span>
        <em className="tuile-etat" aria-hidden="true" style={off ? ETAT_INDISPO : undefined}>{t(off ? 'horsLigne.tuile' : 'defi.accueil.tuileEtat')}</em>
      </button>
    );
  }
  if (tuile.genre === 'goDuJour') {
    const pb = p.probleme;
    return (
      // #213 : la tuile dit l'état du jour, « À faire » tant que le Go du jour d'aujourd'hui n'est pas réussi, puis « Fait ».
      <button className={`tuile tuile-probleme${etat === 'fait' ? ' fait' : etat === 'aFaire' ? ' a-faire' : ''}${avant}`} onClick={p.onProbleme}
        aria-label={pb ? (etat
          ? t('accueil.tuileAria', { numero: pb.numero, titre: pb.titre, etat: t(etat === 'fait' ? 'accueil.fait' : 'accueil.aFaire') })
          : t('accueil.tuileAriaSimple', { numero: pb.numero, titre: pb.titre })) : undefined}>
        {pb && <MiniGoban rows={pb.rows} className="mini-plateau" />}
        <span>
          {/* #613 (E7) : le numéro du jour ne change pas le choix ; il reste dans le nom accessible. */}
          <small>{t('accueil.goDuJour')}</small>
          <b>{pb?.titre ?? t('nav.problemes')}</b>
        </span>
        {pb && etat && (
          <em className="tuile-etat" data-testid="etat-du-jour" aria-hidden="true">
            {etat === 'fait' && <svg viewBox="0 0 12 12" width="11" height="11" focusable="false"><path d="M2.5 6.4 5 8.8l4.6-5.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            {t(etat === 'fait' ? 'accueil.fait' : 'accueil.aFaire')}
          </em>
        )}
      </button>
    );
  }
  return (
    <button className={`tuile tuile-lecon${avant}`} onClick={p.onLecon}>
      {tuile.enAvant && <span className="tuile-chemin" aria-hidden="true"><Sceau id="mochi" taille={36} /></span>}
      <span>
        {/* #613 (E7) : plus de « 1 sur 48 » : le chemin le montre dans Apprendre, l'accueil dit seulement quoi faire. */}
        <small>{p.lecon ? t('accueil.leconCourte') : t('accueil.leconsTerminees')}</small>
        <b>{p.lecon?.titre ?? t('accueil.revoirChemin')}</b>
      </span>
      {tuile.enAvant && <em className="tuile-etat" aria-hidden="true">{t('accueil.leconSuivante')}</em>}
    </button>
  );
}

/**
 * #469 : « Révisions du jour (N) ». Le nom accessible est le texte visible (WCAG 2.5.3) : le titre d'abord, le détail
 * ensuite. Pictogramme : une flèche qui revient sur une pierre (ce qui revient au bon moment).
 */
function TuileRevisions({ r }: { r: { n: number; ouvrir: () => void } }) {
  return (
    <button type="button" className="tuile tuile-revisions" data-testid="tuile-revisions" onClick={r.ouvrir}>
      <span className="tuile-revisions-icone" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="24" height="24" focusable="false">
          <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M17.6 3.4v3.6h-3.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3.2" fill="currentColor" />
        </svg>
      </span>
      <span>
        <b>{t('accueil.revisions.titre', { n: r.n })}</b>
        <small>{t('accueil.revisions.detail')}</small>
      </span>
    </button>
  );
}

/** Ouvre ou ferme une boîte de dialogue modale native selon `ouvert`. */
function useDialogue(ref: RefObject<HTMLDialogElement | null>, ouvert: boolean) {
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ouvert && !d.open) d.showModal?.();
    if (!ouvert && d.open) d.close();
  }, [ref, ouvert]);
}

/** Pictogrammes des modes, au trait (24 × 24, couleur du texte) ; l'ordi prend le sceau de son adversaire. */
function IconeMode({ mode }: { mode: Mode | 'plus' }) {
  const trait = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" focusable="false" aria-hidden="true" className="icone-mode">
      {mode === 'en_ligne' && <><circle cx="12" cy="12" r="8.5" {...trait} /><path d="M3.5 12h17M12 3.5c-2.6 2.4-3.6 5.2-3.6 8.5s1 6.1 3.6 8.5M12 3.5c2.6 2.4 3.6 5.2 3.6 8.5s-1 6.1-3.6 8.5" {...trait} /></>}
      {mode === 'deux' && <><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" {...trait} /><circle cx="12" cy="8.5" r="2" fill="currentColor" /><circle cx="12" cy="15.5" r="2" {...trait} /></>}
      {mode === 'plus' && <g fill="currentColor"><circle cx="5.5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="18.5" cy="12" r="2" /></g>}
      {/* #524 : un coin de goban, une pierre noire et une blanche : la partie de découverte. */}
      {mode === 'decouverte' && <><path d="M4 8h16M4 16h16M8 4v16M16 4v16" {...trait} /><circle cx="8" cy="8" r="3.2" fill="currentColor" /><circle cx="16" cy="16" r="3.2" {...trait} fill="var(--bg)" /></>}
    </svg>
  );
}

/** Une tuile de mode : pictogramme, nom du mode, détail (cote, adversaire en cours, défi qui attend). */
function TuileMode({ mode, p }: { mode: Mode; p: Props }) {
  const choisir = () => p.onMode(mode, 'tuile');
  // #538 : hors ligne, la tuile reste à sa place (rien ne saute), grisée, et dit pourquoi au lieu d'échouer.
  if (p.horsLigne && besoinReseau(mode)) {
    const nom = t(mode === 'en_ligne' ? 'mode.enLigne' : 'mode.ami');
    return (
      <button type="button" className="mode indispo" data-testid={`mode-${mode}`} aria-disabled="true" aria-label={t('horsLigne.tuileAria', { nom })} style={INDISPO}>
        <span className={`mode-icone${mode === 'ami' ? ' mode-pierres' : ''}`} aria-hidden="true" style={ETEINT}>
          {mode === 'en_ligne' ? <IconeMode mode="en_ligne" /> : <><span className="stone b" /><span className="stone w" /></>}
        </span>
        <b>{nom}</b><small>{t('horsLigne.tuile')}</small>
      </button>
    );
  }
  if (mode === 'en_ligne') {
    const aJouer = p.lentes?.aJouer ?? 0;
    return (
      <button type="button" className={`mode${aJouer ? ' a-jouer' : ''}`} data-testid="mode-en_ligne" onClick={choisir}
        aria-label={`${t('mode.enLigne')} : ${aJouer ? t('mode.enLigne.aJouer') : t('mode.enLigne.detail')}`}>
        <span className="mode-icone" aria-hidden="true"><IconeMode mode="en_ligne" /></span>
        <b>{t('mode.enLigne')}</b>
      </button>
    );
  }
  if (mode === 'ordi') {
    return (
      <button type="button" className="mode" data-testid="mode-ordi" aria-label={`${t('mode.ordi')} : ${p.textes.ctaNom}`} onClick={choisir}>
        <span className="mode-icone" aria-hidden="true"><Sceau id={p.adv.id} taille={26} /></span>
        <b>{t('mode.ordi')}</b>
      </button>
    );
  }
  if (mode === 'ami') {
    const n = p.defisAJouer ?? 0;
    return (
      <button type="button" className={`mode${n ? ' a-jouer' : ''}`} data-testid="mode-ami" onClick={choisir}
        aria-label={n ? t('defi.accueil.aJouer', { n }) : t('defi.accueil.lien')}>
        <span className="mode-icone mode-pierres" aria-hidden="true"><span className="stone b" /><span className="stone w" /></span>
        <b>{t('mode.ami')}</b>
      </button>
    );
  }
  return (
    <button type="button" className="mode" data-testid={`mode-${mode}`} onClick={choisir} aria-label={t(TEXTES_MODE[mode].nom)}>
      <span className="mode-icone" aria-hidden="true"><IconeMode mode={mode} /></span>
      <b>{t(TEXTES_MODE[mode].court)}</b>
    </button>
  );
}

/** Textes des modes rangés en tuile simple ou sous « Plus » : nom complet (lu), nom court, détail, phrase de la feuille. */
const TEXTES_MODE = {
  deux: { nom: 'accueil.deux', court: 'mode.deux', texte: 'mode.deux.texte' },
  decouverte: { nom: 'accueil.decouverte', court: 'mode.decouverte', texte: 'mode.decouverte.texte' },
} as const satisfies Record<string, Record<'nom' | 'court' | 'texte', Parameters<typeof t>[0]>>;
type ModeSimple = keyof typeof TEXTES_MODE;
const estSimple = (m: Mode): m is ModeSimple => m in TEXTES_MODE;

/** Feuille « Plus » : les modes qui ne tiennent pas dans la rangée (à deux, découverte), une ligne chacun. #589 : la partie guidée est dans Apprendre. */
function FeuillePlus({ modes, ouvert, setOuvert, onMode }: { modes: Mode[]; ouvert: boolean; setOuvert: (o: boolean) => void; onMode: Props['onMode'] }) {
  const ref = useRef<HTMLDialogElement>(null);
  useDialogue(ref, ouvert);
  return (
    <dialog ref={ref} className="feuille" aria-labelledby="plus-titre" data-testid="feuille-plus" onClose={() => setOuvert(false)}
      onClick={e => { if (e.target === ref.current) setOuvert(false); }}>
      {ouvert && (
        <div className="feuille-corps">
          <div className="feuille-tete">
            <h2 id="plus-titre">{t('mode.plus.titre')}</h2>
            <button className="lien" onClick={() => setOuvert(false)}>{t('accueil.fermer')}</button>
          </div>
          <ul className="plus-liste">
            {modes.filter(estSimple).map(m => (
              <li key={m}>
                <button type="button" className="plus-mode" onClick={() => { setOuvert(false); onMode(m, 'plus'); }}>
                  <span className="mode-icone" aria-hidden="true"><IconeMode mode={m} /></span>
                  <span>
                    <b>{t(TEXTES_MODE[m].nom)}</b>
                    <small>{t(TEXTES_MODE[m].texte)}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </dialog>
  );
}
