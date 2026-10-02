// Écran d'accueil v3 (issue #40, phase 4 ; #119 : une seule action principale ; v3 : les 60 premières secondes).
// Premier lancement : une promesse en une phrase (Mochi), le goban, le bouton « Joue ta première partie », et
// « Je sais déjà jouer » en lien discret. Ni XP ni niveau tant qu'il n'y a rien à montrer, l'adversaire nommé
// sans son rang : rien à lire avant la première pierre (modèles : premier écran de chess.com et de Duolingo).
// Retours : l'adversaire parle, le bouton propose la partie, et sous lui « Aujourd'hui » met en avant la bonne
// chose à faire (défi où c'est ton tour, Go du jour à faire, leçon suivante ; src/app/aujourdhui.ts).
import { useEffect, useRef, type ReactNode } from 'react';
import { Board } from '../ui/Board';
import { Sceau } from '../ui/Sceau';
import { Portrait } from '../ui/Portrait';
import { Mochi } from '../ui/Mochi';
import { MiniGoban } from '../ui/MiniGoban';
import { CarrouselAdversaires, type CarteAdversaire } from '../ui/Carrousel';
import type { Opponent } from '../engine';
import type { Accueil as TextesAccueil } from './home';
import { ordreDuJour, type TuileDuJour } from './aujourdhui';
import { fr } from '../ui/typo';
import { t } from '../content/i18n';

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
  onJouer: () => void;
  onDeux: () => void;
  /** Partie guidée contre Mochi (#79), hors de l'échelle des adversaires. */
  onGuidee?: () => void;
  probleme?: TuileProbleme;
  onProbleme: () => void;
  /** Leçon suivante ; absente quand tout le chemin est fait. */
  lecon?: TuileLecon;
  onLecon: () => void;
  defis?: TuileDefis;
  /** Carte « Installe l'app » (#214), sous les tuiles, au 2e retour ; elle décide seule si elle se montre. */
  installation?: ReactNode;
  /** « Je sais déjà jouer » (#283) : lien discret sous le bouton, au premier lancement seulement. */
  onPlacement?: () => void;
}

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
const AIDE_TAILLE = { 9: 'accueil.aideTaille.9', 13: 'accueil.aideTaille.13', 19: 'accueil.aideTaille.19' } as const satisfies Record<Taille, string>;

export function Accueil(p: Props) {
  const { adv, textes, taille } = p;
  const premier = textes.nouveau;
  // Sans état fourni : l'ancien comportement (« Fait » ou « À faire »).
  const etat = p.probleme ? (p.probleme.etat !== undefined ? p.probleme.etat : p.probleme.reussi ? 'fait' : 'aFaire') : null;
  const defis = p.defis && p.defis.n > 0 ? p.defis : undefined;
  const tuiles = ordreDuJour({ premier, defis: defis?.n ?? 0, goDuJour: p.probleme ? (etat ?? 'neutre') : null, lecon: !!p.lecon });
  const enAvant = tuiles.some(x => x.enAvant);

  return (
    <div className={`accueil${premier ? ' accueil-premier' : ''}`} data-premier={premier || undefined}>
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
        <div className="scene-plateau" aria-hidden="true" data-testid="plateau-accueil" onClick={p.onJouer}>
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
          {/* L'adversaire parle sous le plateau : sa bulle ne cache plus aucune ligne. */}
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
          <div className="reglage">
            <span>{t('accueil.plateau', { taille })}</span>
            <button className="lien" aria-haspopup="dialog" aria-expanded={p.reglages} onClick={() => p.setReglages(true)}>{t('accueil.changer')}</button>
          </div>
        </>
      )}

      {/* Libellé court (« Jouer contre Pomme ») : taille pleine ; long (première partie) : un cran plus petit, sur une ligne. */}
      <button className={`cta cta-sceau${textes.cta.length <= 26 ? ' court' : ''}`} aria-label={textes.ctaNom} onClick={p.onJouer}>
        <Sceau id={adv.id} taille={30} />{textes.cta}
      </button>
      {p.onPlacement && <button type="button" className="lien lien-placement" onClick={p.onPlacement}>{t('placement.lien')}</button>}

      {/* Aujourd'hui : la bonne chose à faire en premier, mise en avant ; les autres tuiles suivent. */}
      {tuiles.length > 0 && (
        <div className={`tuiles${enAvant ? ' tuiles-jour' : ''}`}>
          {enAvant && <p className="tuiles-titre">{t('accueil.aujourdhui')}</p>}
          {tuiles.map(tu => <Tuile key={tu.genre} tuile={tu} p={p} etat={etat} defis={defis} />)}
        </div>
      )}

      {p.installation}

      <Reglages {...p} />
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

/** Feuille « Changer » : carrousel des adversaires et taille du plateau, dans une boîte de dialogue modale native. */
function Reglages({ adv, cartes, taille, reglages, setReglages, onTaille, onChoisir, onJouer, onDeux, onGuidee, textes }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (reglages && !d.open) d.showModal?.();
    if (!reglages && d.open) d.close();
  }, [reglages]);

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
          <CarrouselAdversaires cartes={cartes} choisi={adv.id} onChoisir={onChoisir} legende={t(`adv.${adv.id}.description`)} />
          <button className="btn primary" aria-label={textes.ctaNom} onClick={onJouer}>{textes.cta}</button>
          <button className="lien deux" onClick={onDeux}>{t('accueil.deux')}</button>
          {onGuidee && <button className="lien deux" onClick={onGuidee}>{t('accueil.guidee')}</button>}
        </div>
      )}
    </dialog>
  );
}
