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
import { Suspense, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Board } from '../ui/Board';
import { Sceau } from '../ui/Sceau';
import { Portrait } from '../ui/Portrait';
import { Mochi } from '../ui/Mochi';
import { MiniGoban } from '../ui/MiniGoban';
import type { CarteAdversaire } from '../ui/Carrousel';
import { CarrouselAdversaires } from './ecrans';
import type { Opponent } from '../engine';
import type { Accueil as TextesAccueil } from './home';
import { ordreDuJour, type TuileDuJour } from './aujourdhui';
import { fr } from '../ui/typo';
import { langue, t } from '../content/i18n';
import { gradeDe, texteGrade } from '../go/cote';
import type { Depuis, Mode, ModesAccueil } from './modes';

type Taille = 9 | 13 | 19;

/** Tuile du Go du jour (issue #75) : le défi commun, numéroté. */
export interface TuileProbleme { titre: string; reussi: boolean; rows: string[]; numero: number;
  /** Pastille d'état (#236, N4) : « Fait », « À faire », ou rien (premier lancement, autre appel à l'écran). */
  etat?: 'fait' | 'aFaire' | null }
export interface TuileLecon { rang: number; total: number; titre: string }
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
  reglages: boolean;
  setReglages: (ouvert: boolean) => void;
  onTaille: (t: Taille) => void;
  onChoisir: (id: Opponent['id']) => void;
  /** #429 : action principale, tuiles et « Plus » (src/app/modes.ts). */
  modes: ModesAccueil;
  /** Un mode choisi, et d'où (bouton, goban, tuile, « Plus », feuille « Changer ») : mesuré par `mode_choisi`. */
  onMode: (mode: Mode, depuis: Depuis) => void;
  /** Cote du joueur connecté (partie en ligne) ; null sans compte ou tant qu'elle n'est pas lue. */
  cote?: { cote: number; provisoire: boolean } | null;
  /** Compte complet : la partie en ligne mène droit à la recherche (sinon, « Crée ton compte » d'abord). */
  compte?: boolean;
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
}

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
/** Cote affichée : « 1200 », ou « 1200 ? » tant qu'elle est provisoire (même écriture que src/content/i18n/cote.ts, hors du JS initial). */
const texteCote = (c: { cote: number; provisoire: boolean }) => `${Math.round(c.cote)}${c.provisoire ? (langue() === 'fr' ? '\u00a0?' : '?') : ''}`;
const texteGradeDe = (cote: number) => texteGrade(gradeDe(cote), langue());

const AIDE_TAILLE = { 9: 'accueil.aideTaille.9', 13: 'accueil.aideTaille.13', 19: 'accueil.aideTaille.19' } as const satisfies Record<Taille, string>;

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
  const epure = !!p.epure;
  // Lu une fois au montage : les tuiles révélées après la première pierre arrivent une seule fois en fondu.
  const [revele] = useState(() => !epure && vuEpure);
  useEffect(() => { vuEpure = epure; }, [epure]);

  return (
    <div className={`accueil${premier ? ' accueil-premier' : ''}${revele ? ' accueil-revele' : ''}`} data-premier={premier || undefined} data-epure={epure || undefined}>
      {/* Premier lancement : la promesse, en une phrase, par Mochi. Elle porte la classe de la réplique (`scene-bulle`) :
          c'est la seule voix de l'écran, et elle invite à la même action que le bouton. */}
      {premier && (
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
            <span>{fr(t('accueil.contre', { role: t('accueil.premierAdversaire'), taille }))}</span>
          </div>
          <button className="lien" aria-haspopup="dialog" aria-expanded={p.reglages} onClick={() => p.setReglages(true)}>{t('accueil.changer')}</button>
        </div>
      ) : (
        <>
          {enLigne ? (
            // #429 : partie en ligne en action principale. Ce qui se joue (la cote) à la place de l'adversaire de l'ordi.
            <div className="adversaire classee" data-testid="classee">
              <span className="classee-pierres" aria-hidden="true"><span className="stone b" /><span className="stone w" /></span>
              <div className="adversaire-texte">
                <div className="adversaire-identite">
                  <h2>{p.cote ? texteGradeDe(p.cote.cote) : t('accueil.classee.titre')}</h2>
                  {p.cote && <span data-testid="classee-cote">{texteCote(p.cote)}</span>}
                </div>
                <p className="scene-bulle">{fr(t(p.compte ? 'accueil.classee.bulle' : 'accueil.classee.sansCompte'))}</p>
              </div>
            </div>
          ) : (
            // L'adversaire parle sous le plateau : sa bulle ne cache plus aucune ligne.
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
          <div className="reglage">
            <span>{t(enLigne ? 'accueil.plateauSeul' : 'accueil.plateau', { taille })}</span>
            <button className="lien" aria-haspopup="dialog" aria-expanded={p.reglages} onClick={() => p.setReglages(true)}>{t('accueil.changer')}</button>
          </div>
        </>
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
              <b>{t('mode.plus')}</b><small>{t('mode.plus.detail')}</small>
            </button>
          )}
        </div>

        {p.lentes && (p.lentes.aJouer > 0 || p.lentes.recherche) && <TuilesLentes l={p.lentes} />}

        {/* Aujourd'hui : la bonne chose à faire en premier, mise en avant ; les autres tuiles suivent. */}
        {(tuiles.length > 0 || revisions) && (
          <div className={`tuiles${enAvant ? ' tuiles-jour' : ''}`}>
            {enAvant && <p className="tuiles-titre">{t('accueil.aujourdhui')}</p>}
            {tuiles.map(tu => <Tuile key={tu.genre} tuile={tu} p={p} etat={etat} defis={defis} />)}
            {/* #469 : jamais en avant (une seule action principale) ; elle suit les tuiles du jour. */}
            {revisions && <TuileRevisions r={revisions} />}
          </div>
        )}

        {p.semaine}
        {p.installation}
      </>}

      <Reglages {...p} />
      {!epure && p.modes.plus.length > 0 && <FeuillePlus modes={p.modes.plus} ouvert={plusOuvert} setOuvert={setPlusOuvert} onMode={p.onMode} />}
    </div>
  );
}

/** #440 : « À toi de jouer (N) » (parties lentes), puis la recherche en cours, qu'on annule d'ici. */
function TuilesLentes({ l }: { l: TuileLentes }) {
  return (
    <div className="tuiles tuiles-lentes">
      {l.aJouer > 0 && (
        <button className="tuile tuile-defi tuile-avant" onClick={l.ouvrir} data-testid="tuile-lente" aria-label={t('lente.accueil.aJouerAria', { n: l.aJouer })}>
          <span className="tuile-pierres" aria-hidden="true"><span className="stone b" /><span className="stone w" /></span>
          <span>
            <small>{t('lente.accueil.tuile', { n: l.aJouer })}</small>
            <b>{t('lente.accueil.aJouer', { n: l.aJouer })}</b>
          </span>
          <em className="tuile-etat" aria-hidden="true">{t('defi.accueil.tuileEtat')}</em>
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
    return (
      <button className={`tuile tuile-defi${avant}`} onClick={defis.ouvrir} data-testid="tuile-defi"
        aria-label={defis.adversaire
          ? `${t('defi.accueil.tuile', { n: 1 })}, ${t('aFaire.contre', { pseudo: defis.adversaire })}, ${t('defi.accueil.tuileEtat')}.`
          : t('defi.accueil.tuileAria', { n: defis.n })}>
        <span className="tuile-pierres" aria-hidden="true"><span className="stone b" /><span className="stone w" /></span>
        <span>
          <small>{t('defi.accueil.tuile', { n: defis.n })}</small>
          <b>{defis.adversaire ? t('aFaire.contre', { pseudo: defis.adversaire }) : t('defi.accueil.tuileEtat')}</b>
        </span>
        <em className="tuile-etat" aria-hidden="true">{t('defi.accueil.tuileEtat')}</em>
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
          <small>{pb ? t('accueil.goDuJourNumero', { numero: pb.numero }) : t('accueil.goDuJour')}</small>
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
        <small>{p.lecon ? t('accueil.lecon', { rang: p.lecon.rang, total: p.lecon.total }) : t('accueil.leconsTerminees')}</small>
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

/** Feuille « Changer » : carrousel des adversaires et taille du plateau, dans une boîte de dialogue modale native. */
function Reglages({ adv, cartes, taille, reglages, setReglages, onTaille, onChoisir, onMode, textes }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useDialogue(ref, reglages);

  return (
    <dialog ref={ref} className="feuille" aria-labelledby="feuille-titre" onClose={() => setReglages(false)}
      // Un toucher sur le voile (hors de la feuille) la ferme.
      onClick={e => { if (e.target === ref.current) setReglages(false); }}>
      {reglages && (
        <div className="feuille-corps">
          <div className="feuille-tete">
            <h2 id="feuille-titre">{t('accueil.tonAdversaire')}</h2>
            <button className="lien" onClick={() => setReglages(false)}>{t('accueil.fermer')}</button>
          </div>
          {/* Audit du 02/10 (n° 5) : la taille du plateau passe en tête, sur une ligne. Elle restait cachée sous le bouton
              collant, au premier affichage comme au bout de la liste, en 320 px. */}
          <div className="feuille-taille" role="group" aria-labelledby="feuille-taille-titre" aria-describedby="feuille-taille-aide">
            <h3 id="feuille-taille-titre">{t('accueil.taillePlateau')}</h3>
            <div className="seg">
              {([9, 13, 19] as const).map(n => <button key={n} aria-pressed={taille === n} onClick={() => onTaille(n)}>{n} × {n}</button>)}
            </div>
            <p id="feuille-taille-aide" className="muted small">{t(AIDE_TAILLE[taille])}</p>
          </div>
          {/* #509 (L4, n° 10) : les adversaires se choisissent par leur grade (« 20 kyu ») ; le mot est expliqué juste avant. */}
          <p className="feuille-kyu muted small" data-testid="feuille-kyu">{fr(t('accueil.kyu'))}</p>
          {/* #429 : chargé avec la feuille (préchargé après le premier écran) ; la place est gardée pendant l'attente. */}
          <Suspense fallback={<div className="carrousel-attente" aria-busy="true" />}>
            <CarrouselAdversaires cartes={cartes} choisi={adv.id} onChoisir={onChoisir} legende={t(`adv.${adv.id}.description`)} />
          </Suspense>
          {/* #429 : « Changer » ne sert plus qu'à choisir l'adversaire et la taille ; les modes sont sur l'accueil. */}
          <button className="btn primary" aria-label={textes.ctaNom} onClick={() => onMode('ordi', 'feuille')}>{textes.cta}</button>
        </div>
      )}
    </dialog>
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

/** Pictogrammes des modes, au trait (24 × 24, couleur du texte) ; l'ordi et la partie guidée prennent un sceau. */
function IconeMode({ mode }: { mode: Mode | 'plus' }) {
  const trait = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" focusable="false" aria-hidden="true" className="icone-mode">
      {mode === 'en_ligne' && <><circle cx="12" cy="12" r="8.5" {...trait} /><path d="M3.5 12h17M12 3.5c-2.6 2.4-3.6 5.2-3.6 8.5s1 6.1 3.6 8.5M12 3.5c2.6 2.4 3.6 5.2 3.6 8.5s-1 6.1-3.6 8.5" {...trait} /></>}
      {mode === 'deux' && <><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" {...trait} /><circle cx="12" cy="8.5" r="2" fill="currentColor" /><circle cx="12" cy="15.5" r="2" {...trait} /></>}
      {mode === 'plus' && <g fill="currentColor"><circle cx="5.5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="18.5" cy="12" r="2" /></g>}
    </svg>
  );
}

/** Une tuile de mode : pictogramme, nom du mode, détail (cote, adversaire en cours, défi qui attend). */
function TuileMode({ mode, p }: { mode: Mode; p: Props }) {
  const choisir = () => p.onMode(mode, 'tuile');
  if (mode === 'en_ligne') {
    const cote = p.cote && `${texteGradeDe(p.cote.cote)} · ${texteCote(p.cote)}`;
    const aJouer = p.lentes?.aJouer ?? 0;
    return (
      <button type="button" className={`mode${aJouer ? ' a-jouer' : ''}`} data-testid="mode-en_ligne" onClick={choisir}
        aria-label={`${t('mode.enLigne')} : ${aJouer ? t('mode.enLigne.aJouer') : t('mode.enLigne.detail')}${cote ? `, ${cote}` : ''}`}>
        <span className="mode-icone" aria-hidden="true"><IconeMode mode="en_ligne" /></span>
        <b>{t('mode.enLigne')}</b>
        <small>{aJouer ? t('mode.enLigne.aJouer') : cote ?? t('mode.enLigne.detail')}</small>
      </button>
    );
  }
  if (mode === 'ordi') {
    return (
      <button type="button" className="mode" data-testid="mode-ordi" aria-label={`${t('mode.ordi')} : ${p.textes.ctaNom}`} onClick={choisir}>
        <span className="mode-icone" aria-hidden="true"><Sceau id={p.adv.id} taille={26} /></span>
        <b>{t('mode.ordi')}</b><small>{p.adv.nom}</small>
      </button>
    );
  }
  if (mode === 'ami') {
    const n = p.defisAJouer ?? 0;
    return (
      <button type="button" className={`mode${n ? ' a-jouer' : ''}`} data-testid="mode-ami" onClick={choisir}
        aria-label={n ? t('defi.accueil.aJouer', { n }) : t('defi.accueil.lien')}>
        <span className="mode-icone mode-pierres" aria-hidden="true"><span className="stone b" /><span className="stone w" /></span>
        <b>{t('mode.ami')}</b><small>{n ? t('defi.accueil.tuileEtat') : t('mode.ami.detail')}</small>
      </button>
    );
  }
  return (
    <button type="button" className="mode" data-testid={`mode-${mode}`} onClick={choisir}
      aria-label={t(mode === 'deux' ? 'accueil.deux' : 'accueil.guidee')}>
      <span className="mode-icone" aria-hidden="true">{mode === 'deux' ? <IconeMode mode="deux" /> : <Sceau id="mochi" taille={26} />}</span>
      <b>{t(mode === 'deux' ? 'mode.deux' : 'mode.guidee')}</b><small>{t(mode === 'deux' ? 'mode.deux.detail' : 'mode.guidee.detail')}</small>
    </button>
  );
}

/** Feuille « Plus » : les modes qui ne tiennent pas dans la rangée (à deux, partie guidée), une ligne chacun. */
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
            {modes.map(m => (
              <li key={m}>
                <button type="button" className="plus-mode" onClick={() => { setOuvert(false); onMode(m, 'plus'); }}>
                  <span className="mode-icone" aria-hidden="true">{m === 'deux' ? <IconeMode mode="deux" /> : <Sceau id="mochi" taille={30} />}</span>
                  <span>
                    <b>{t(m === 'deux' ? 'accueil.deux' : 'accueil.guidee')}</b>
                    <small>{t(m === 'deux' ? 'mode.deux.texte' : 'mode.guidee.texte')}</small>
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
