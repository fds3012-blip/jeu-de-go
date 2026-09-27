// Composants de l'écran de partie (grammaire de chess.com) : bandeaux des joueurs avec leur couvercle,
// liste des coups, barre d'avantage, coach Mochi et barre d'actions. Styles : partie.css.
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { IconeAction, type NomAction } from './IconesActions';
import { Mochi } from './Mochi';
import { Reflexion } from './Reflexion';
import { fr } from './typo';
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
      <span className="sr-only">{n} pierre{n > 1 ? 's' : ''} capturée{n > 1 ? 's' : ''}</span>
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
}

/** Bandeau d'un joueur : portrait, nom, rang, réplique éventuelle et couvercle. */
export function Bandeau({ nom, sousTitre, portrait, actif, captures, pierresPrises, replique, avant }: BandeauProps) {
  return (
    <div className={`joueur${actif ? ' active' : ''}`} data-joueur={nom}>
      {avant}
      <span className="portrait">{portrait}{actif && <span className="au-trait" aria-hidden="true" />}</span>
      <div className="joueur-texte">
        <div className="joueur-nom">
          <b>{nom}</b>
          {replique && <span key={replique.n} className="replique" role="status">{fr(replique.texte)}</span>}
        </div>
        <small>{sousTitre}{actif && <span className="sr-only">, au trait</span>}</small>
      </div>
      <Couvercle n={captures} pierres={pierresPrises} />
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
    <ol ref={ref} className="coups" aria-label="Coups joués">
      {coups.length === 0 && <li className="vide">Aucun coup joué</li>}
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
export function BarreAvantage({ libelle, part }: { libelle: string; part: number }) {
  return (
    <div className="avantage" style={libelle ? undefined : { visibility: 'hidden' }}>
      <span className="avantage-libelle" aria-hidden="true">{libelle || 'Noir +0'}</span>
      <div className="avantage-barre" role="img" aria-label={`Avantage estimé : ${libelle}`}>
        <i style={{ transform: `translateX(${((part - 1) * 100).toFixed(2)}%)` }} />
      </div>
    </div>
  );
}

/** Coach Mochi : une phrase à la fois. */
export function Coach({ children, cle, attente = false }: { children: ReactNode; cle?: string | number; attente?: boolean }) {
  return (
    <div className="coach">
      <span className="coach-sceau"><Mochi size={30} /></span>
      <p key={cle} aria-live="polite">{children}</p>
      {/* L'adversaire réfléchit : les deux pierres du logo tournent (le texte voisin dit qui réfléchit). */}
      {attente && <Reflexion taille={22} />}
    </div>
  );
}

export interface Action { label: string; icone: ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean; description?: string; action?: string }

/** Barre d'actions fixe en bas de l'écran, à la place de la barre de navigation. */
export function BarreActions({ actions, label }: { actions: Action[]; label: string }) {
  return (
    <div className="actions" role="toolbar" aria-label={label}>
      {actions.map(a => (
        <button key={a.label} type="button" onClick={a.onClick} disabled={a.disabled} className={a.danger ? 'danger' : undefined} aria-description={a.description} data-action={a.action}>
          {a.icone}<span>{a.label}</span>
        </button>
      ))}
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
