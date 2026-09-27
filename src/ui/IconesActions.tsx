// Icônes de la barre d'actions de la partie (issue #65). Même famille que la barre de navigation (IconesNav.tsx,
// charte docs/design/v2/identite.md) : des pierres et des traits de grille sur une grille de 28 × 28.
// - Disponible : les pierres ont la matière du goban (dégradé, reflet, ombre), comme un onglet actif.
// - Désactivé : encre brume, sans couleur, comme un onglet inactif. C'est la CSS qui bascule (partie.css) :
//   le même dessin sert aux deux états, l'icône n'a pas besoin de savoir si son bouton est désactivé.
// - Une seule pièce d'accent : le halo jade de l'indice ; le couvercle devient hanko à l'étape « Confirmer ? ».
// Appui : la pierre `.pose` s'enfonce (transform seulement). Styles et mouvement : partie.css.
import { useId, type ReactElement } from 'react';

export type NomAction = 'indice' | 'quimene' | 'annuler' | 'passer' | 'abandonner';

interface Pierre { x: number; y: number; r: number; c: 'n' | 'b' }

/** Matières : pierres du goban (mêmes dégradés que Board.tsx et IconesNav.tsx) et bois du couvercle (Couvercle). */
function Matieres({ id }: { id: string }) {
  return (
    <defs>
      <radialGradient id={`${id}n`} cx="36%" cy="30%" r="72%">
        <stop offset="0" stopColor="#6a6e6c" /><stop offset=".22" stopColor="#2e3130" /><stop offset=".6" stopColor="#151716" /><stop offset="1" stopColor="#050606" />
      </radialGradient>
      <radialGradient id={`${id}b`} cx="38%" cy="32%" r="78%">
        <stop offset="0" stopColor="#fff" /><stop offset=".55" stopColor="#F3EEE3" /><stop offset=".85" stopColor="#DDD5C4" /><stop offset="1" stopColor="#BDB3A0" />
      </radialGradient>
      <radialGradient id={`${id}bois`} cx="50%" cy="15%" r="95%">
        <stop offset="0" stopColor="#8a6238" /><stop offset=".55" stopColor="#5e4022" /><stop offset="1" stopColor="#3a2714" />
      </radialGradient>
    </defs>
  );
}

/** Une pierre avec sa matière. Désactivée, la CSS la repasse à l'encre (noire pleine, blanche en contour). */
function Caillou({ p, id }: { p: Pierre; id: string }) {
  return (
    <g>
      <circle className="ombre" cx={p.x + 0.6} cy={p.y + 0.9} r={p.r} />
      <circle className={p.c === 'n' ? 'pierre-n' : 'pierre-b'} cx={p.x} cy={p.y} r={p.r} fill={`url(#${id}${p.c})`} />
      {p.c === 'n' && <ellipse className="reflet" cx={p.x - p.r * 0.34} cy={p.y - p.r * 0.4} rx={p.r * 0.36} ry={p.r * 0.24} fill="#fff" opacity=".28" transform={`rotate(-30 ${p.x - p.r * 0.34} ${p.y - p.r * 0.4})`} />}
    </g>
  );
}

function dessin(nom: NomAction, id: string): ReactElement {
  switch (nom) {
    // Indice : la pierre fantôme de l'accueil, qui brille dans son onde jade (le même anneau qui pulse sur l'accueil).
    // Elle dit « ici » sans jouer à ta place. Pas de grille en croix : ce serait un viseur.
    case 'indice': return (<>
      <circle className="lueur" cx="14" cy="14" r="13" />
      <circle className="lueur-anneau" cx="14" cy="14" r="11" />
      <g className="pose">
        <circle className="lueur-pierre" cx="14" cy="14" r="7.4" />
        <ellipse className="lueur-reflet" cx="11.4" cy="11.2" rx="2.5" ry="1.6" transform="rotate(-30 11.4 11.2)" />
      </g>
    </>);
    // Qui mène ? (#94) : une balance. Le fléau penche vers la pierre noire, plus basse que la blanche.
    case 'quimene': return (<>
      <path className="trait" d="M14 6V25M9 25H19" />
      <path className="trait" d="M4 10.5 24 5.5" />
      <g className="pose">
        <Caillou p={{ x: 6.4, y: 15.6, r: 4.6, c: 'n' }} id={id} />
        <Caillou p={{ x: 21.6, y: 11.2, r: 4.6, c: 'b' }} id={id} />
      </g>
    </>);
    // Annuler : tu reprends ta dernière pierre. Elle remonte par un chemin de petites pierres (le pointillé du chemin
    // des leçons) qui tourne vers la gauche, le sens du retour.
    case 'annuler': return (<>
      <path className="trait-pointille" d="M18.4 11.6C18.4 7.2 15.6 4.6 11.4 4.6H6.6" />
      <path className="trait" d="M7.4 1.2 3.6 4.6 7.4 8" />
      <g className="pose"><Caillou p={{ x: 18.6, y: 19.8, r: 7.4, c: 'n' }} id={id} /></g>
    </>);
    // Passer : le bord du goban en haut, et tes deux pierres qui restent dessous, hors du plateau.
    // Tu ne poses rien ce tour-ci.
    case 'passer': return (<>
      <g className="grille">
        <path className="grille-fine" d="M7.5 1.5V11M14 1.5V11M20.5 1.5V11M1.5 5.5H26.5" />
        <path d="M1.5 11H26.5" />
      </g>
      <g className="pose">
        <Caillou p={{ x: 8, y: 20.4, r: 5.8, c: 'n' }} id={id} />
        <Caillou p={{ x: 20, y: 20.4, r: 5.8, c: 'b' }} id={id} />
      </g>
    </>);
    // Abandonner : le geste traditionnel, une pierre posée sur le couvercle retourné.
    // À l'étape « Confirmer ? », le couvercle devient un sceau hanko (cadre papier intérieur, comme Sceau.tsx).
    case 'abandonner': return (<>
      {/* Couvercle retourné vu de trois quarts : une tranche et un dessus en ellipse. La pierre est posée à droite
          du centre : centrée sur un dôme, l'icône se lisait comme un buste (icône « profil »). */}
      <path className="couvercle-bois" d="M2 19.6V22.2C2 24.3 7.4 25.9 14 25.9S26 24.3 26 22.2V19.6Z" fill={`url(#${id}bois)`} />
      <ellipse className="couvercle-dessus" cx="14" cy="19.6" rx="12" ry="3.6" />
      <ellipse className="couvercle-cadre" cx="14" cy="19.6" rx="8.6" ry="2.1" />
      <g className="pose">
        <Caillou p={{ x: 16.2, y: 13.4, r: 6.6, c: 'n' }} id={id} />
      </g>
    </>);
  }
}

/** Icône d'une action de la partie, 28 px. Décorative : le libellé du bouton porte le nom. */
export function IconeAction({ nom }: { nom: NomAction }) {
  const id = `ia-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg className={`icone-action icone-${nom}`} viewBox="0 0 28 28" width="28" height="28" aria-hidden="true" focusable="false">
      <Matieres id={id} />
      {dessin(nom, id)}
    </svg>
  );
}
