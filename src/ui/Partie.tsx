// Composants de l'écran de partie (grammaire de chess.com) : bandeaux des joueurs avec leur couvercle,
// liste des coups, barre d'avantage, coach Mochi et barre d'actions. Styles : partie.css.
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { IconeAction, type NomAction } from './IconesActions';
import { PortraitMochi, type HumeurMochi } from './Portrait';
import { Reflexion } from './Reflexion';
import { fr } from './typo';
import { t } from '../content/i18n';
import './partie.css';

/** Pierres capturées, rangées dans un couvercle en bois. `pierres` : couleur des pierres prises. */
export function Couvercle({ n, pierres }: { n: number; pierres: 'noir' | 'blanc' }) {
  const vues = Math.min(3, n);
  return (
    // La clé relance la pulsation à chaque nouvelle prise.
    <span key={n} className={`couvercle${n ? ' plein' : ''}`} data-captures={n}>
      <span className="couvercle-creux" aria-hidden="true">
        {Array.from({ length: vues }, (_, i) => <i key={i} className={`mini ${pierres === 'noir' ? 'n' : 'b'}`} />)}
      </span>
      <b aria-hidden="true">{n}</b>
      <span className="sr-only">{t('bilan.pierresCapturees', { n })}</span>
    </span>
  );
}

interface BandeauProps {
  nom: string;
  sousTitre: ReactNode;
  portrait: ReactNode;
  actif: boolean;
  captures: number;
  /** Couleur des pierres capturées par ce joueur (celles de l'adversaire). */
  pierresPrises: 'noir' | 'blanc';
  replique?: { texte: string; n: number } | null;
  avant?: ReactNode;
  /** Pierres que ce joueur vient de prendre (#187) : un « +N » monte depuis le couvercle. `k` relance l'animation. */
  gain?: { n: number; k: number } | null;
}

/** Bandeau d'un joueur : portrait, nom, rang, réplique éventuelle et couvercle. */
export function Bandeau({ nom, sousTitre, portrait, actif, captures, pierresPrises, replique, avant, gain }: BandeauProps) {
  return (
    <div className={`joueur${actif ? ' active' : ''}`} data-joueur={nom}>
      {avant}
      <span className="portrait">{portrait}{actif && <span className="au-trait" aria-hidden="true" />}</span>
      <div className="joueur-texte">
        <div className="joueur-nom">
          <b>{nom}</b>
          {replique && <span key={replique.n} className="replique" role="status">{fr(replique.texte)}</span>}
        </div>
        <small>{sousTitre}{actif && <span className="sr-only">{t('partie.auTrait')}</span>}</small>
      </div>
      <span className="couvercle-zone">
        <Couvercle n={captures} pierres={pierresPrises} />
        {/* Décoratif : la phrase de Mochi dit déjà combien de pierres tu as prises. */}
        {gain && <span key={gain.k} className="gain-capture" aria-hidden="true">+{gain.n}</span>}
      </span>
    </div>
  );
}

/** Avatar du joueur : initiale du pseudo, ou une pierre de sa couleur. */
export function Avatar({ initiale, couleur }: { initiale?: string; couleur: 1 | 2 }) {
  if (initiale) return <span className="avatar" aria-hidden="true">{initiale}</span>;
  return <span className={`stone ${couleur === 1 ? 'b' : 'w'}`} aria-hidden="true" />;
}

/**
 * Liste des coups qui défile horizontalement. En partie, elle suit le dernier coup ;
 * en relecture, `courant` (index dans `coups`, -1 : aucun) désigne le coup affiché, gardé au centre.
 */
export function ListeCoups({ coups, courant = coups.length - 1 }: { coups: string[]; courant?: number }) {
  const ref = useRef<HTMLOListElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (courant >= coups.length - 1) { el.scrollLeft = el.scrollWidth; return; }
    const li = el.children[Math.max(0, courant)] as HTMLElement | undefined;
    if (li) el.scrollLeft = li.offsetLeft - (el.clientWidth - li.offsetWidth) / 2;
  }, [coups.length, courant]);
  return (
    <ol ref={ref} className="coups" aria-label={t('partie.coupsJoues')}>
      {coups.length === 0 && <li className="vide">{t('bilan.aucunCoup')}</li>}
      {coups.map((m, i) => (
        <li key={i} aria-current={i === courant ? 'step' : undefined}>{m}</li>
      ))}
    </ol>
  );
}

/**
 * Barre d'avantage : portion noire à gauche, papier à droite. `part` : part de Noir, de 0 à 1.
 * Sans estimation encore (`libelle` vide), la place est réservée pour que le plateau ne saute pas.
 */
/** `titre` : nom lu par les lecteurs d'écran (« Score compté » au comptage, #159). */
export function BarreAvantage({ libelle, part, titre = t('partie.avantageEstime') }: { libelle: string; part: number; titre?: string }) {
  return (
    <div className="avantage" style={libelle ? undefined : { visibility: 'hidden' }}>
      <span className="avantage-libelle" aria-hidden="true">{libelle || t('avantage.noir', { v: 0 })}</span>
      <div className="avantage-barre" role="img" aria-label={t('partie.avantageAria', { titre, libelle })}>
        <i style={{ transform: `translateX(${((part - 1) * 100).toFixed(2)}%)` }} />
      </div>
    </div>
  );
}

/** Coach Mochi : une phrase à la fois. */
export function Coach({ children, cle, attente = false, humeur = attente ? 'pensif' : 'neutre' }: { children: ReactNode; cle?: string | number; attente?: boolean; humeur?: HumeurMochi }) {
  return (
    <div className="coach">
      <PortraitMochi humeur={humeur} taille={44} decoratif className="coach-portrait" />
      <p key={cle} aria-live="polite">{children}</p>
      {/* L'adversaire réfléchit : les deux pierres du logo tournent (le texte voisin dit qui réfléchit). */}
      {attente && <Reflexion taille={22} />}
    </div>
  );
}

/**
 * Bulle de Mochi à deux choix (#235, reprise par #268) : une question, un choix qui agit (`agir`) et le choix sûr
 * (`rester`), en principal. Posée sur le bas de la zone de Mochi, elle monte par-dessus ton bandeau (voir partie.css).
 * `focus` : le choix sûr prend le focus à l'ouverture (demande venue d'un bouton qui disparaît du parcours clavier).
 */
export function ChoixMochi({ question, aria, agir, rester, focus = false, nom }: {
  question: string; aria: string; agir: { label: string; onClick: () => void }; rester: { label: string; onClick: () => void };
  focus?: boolean; nom?: string;
}) {
  const sur = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (focus) sur.current?.focus(); }, [focus]);
  return (
    <div className="coach-avertir" data-choix={nom}>
      <Coach cle={question}>{question}</Coach>
      <div className="coach-choix" role="group" aria-label={aria}>
        <button type="button" className="btn" onClick={agir.onClick}>{agir.label}</button>
        <button ref={sur} type="button" className="btn primary" onClick={rester.onClick}>{rester.label}</button>
      </div>
    </div>
  );
}

export interface Action { label: string; icone: ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean; description?: string; action?: string;
  /** Mis en évidence (#120) : style primaire jade ; `pulse` ajoute une pulsation douce (mouvements non réduits). */
  evidence?: boolean; pulse?: boolean;
  /** #236 (N7) : `decision` (passer, abandonner) se range à droite, après un filet ; les autres sont des aides. */
  groupe?: 'aide' | 'decision';
  /** L'action qui décide de la partie (passer) : bouton plein, tout à droite, sous le pouce. */
  principale?: boolean }

function Bouton({ a }: { a: Action }) {
  return (
    <button type="button" onClick={a.onClick} disabled={a.disabled}
      className={[a.principale && 'decider', a.danger && 'danger', a.evidence && !a.disabled && 'evidence', a.evidence && a.pulse && !a.disabled && 'pulse'].filter(Boolean).join(' ') || undefined}
      aria-description={a.description} data-action={a.action}>
      {a.icone}<span>{a.label}</span>
    </button>
  );
}

/**
 * Barre d'actions fixe en bas de l'écran, à la place de la barre de navigation.
 * #236 (N7) : les aides (indice, qui mène, annuler) à gauche, les décisions à droite après un filet ;
 * « Passer », l'action qui finit la partie, en bouton plein tout à droite. Sans groupes : une seule rangée.
 */
export function BarreActions({ actions, label }: { actions: Action[]; label: string }) {
  const decisions = actions.filter(a => a.groupe === 'decision');
  if (!decisions.length) {
    return (
      <div className="actions" role="toolbar" aria-label={label}>
        {actions.map(a => <Bouton key={a.label} a={a} />)}
      </div>
    );
  }
  const aides = actions.filter(a => a.groupe !== 'decision');
  // La principale en dernier : à droite, là où tombe le pouce ; l'ordre de lecture suit l'ordre visuel.
  const rangees = [...decisions.filter(a => !a.principale), ...decisions.filter(a => a.principale)];
  return (
    <div className="actions actions-groupees" role="toolbar" aria-label={label}>
      <div className="actions-aides">{aides.map(a => <Bouton key={a.label} a={a} />)}</div>
      <span className="actions-filet" aria-hidden="true" />
      <div className="actions-decisions">{rangees.map(a => <Bouton key={a.label} a={a} />)}</div>
    </div>
  );
}

/**
 * Indices restants (#35) : trois petites pierres collées à l'icône, pleines tant qu'il en reste.
 * Purement visuel : le nombre est dit par la description accessible du bouton.
 */
export function CompteurIndices({ restants, total = 3, children }: { restants: number; total?: number; children: ReactNode }) {
  return (
    <span className="compteur-indices" data-restants={restants}>
      {children}
      <span className="compteur-pierres" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => <i key={i} className={i < restants ? 'pleine' : undefined} />)}
      </span>
    </span>
  );
}

// Icônes de la barre d'actions. Les quatre actions de la partie sont dessinées avec des pierres (IconesActions.tsx,
// issue #65), comme la barre de navigation. Précédent et suivant (relecture) restent des chevrons au trait, 26 px.
const CHEVRONS = {
  precedent: <path d="M16 5 8 13l8 8" />,
  suivant: <path d="M10 5l8 8-8 8" />,
};

export function Icone({ nom }: { nom: NomAction | keyof typeof CHEVRONS }) {
  if (nom in CHEVRONS) return <svg className="icone-trait" viewBox="0 0 26 26" aria-hidden="true">{CHEVRONS[nom as keyof typeof CHEVRONS]}</svg>;
  return <IconeAction nom={nom as NomAction} />;
}
