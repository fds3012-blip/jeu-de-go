// Icônes de la barre de navigation (issue #51). Charte : docs/design/v2/identite.md.
// Grammaire : tout est fait de pierres (ardoise et coquillage, reflet en haut à gauche, comme sur le goban)
// et de traits de grille, sur une grille de 28 × 28. Le logo (une noire devant, une blanche derrière, qui se touchent)
// est la cellule de base.
// - Inactif : encre brume. Pierre noire pleine, pierre blanche en contour de 1,5 px, aucune couleur.
// - Actif : les pierres prennent leur matière, et une seule pièce d'accent raconte l'onglet
//   (anneau jade, chemin or, point vital hanko, sceau indigo). Couleurs : jetons --onglet-* de tokens.css.
// Styles et animation (la pierre « tombe ») : nav.css.
import { useId, type ReactElement } from 'react';
import { ONGLETS, type Onglet } from './onglets';
import { t } from '../content/i18n';

export type { Onglet };

type Couleur = 'n' | 'b';
interface Pierre { x: number; y: number; r: number; c: Couleur }

/** Dégradés des pierres, repris du goban (Board.tsx) pour que l'icône et le plateau aient la même matière. */
function Matiere({ id }: { id: string }) {
  return (
    <defs>
      <radialGradient id={`${id}n`} cx="36%" cy="30%" r="72%">
        <stop offset="0" stopColor="#6a6e6c" /><stop offset=".22" stopColor="#2e3130" /><stop offset=".6" stopColor="#151716" /><stop offset="1" stopColor="#050606" />
      </radialGradient>
      <radialGradient id={`${id}b`} cx="38%" cy="32%" r="78%">
        <stop offset="0" stopColor="#fff" /><stop offset=".55" stopColor="#F3EEE3" /><stop offset=".85" stopColor="#DDD5C4" /><stop offset="1" stopColor="#BDB3A0" />
      </radialGradient>
    </defs>
  );
}

/** Une pierre. Active : matière, ombre portée et reflet. Inactive : encre brume (noire pleine, blanche en contour). */
function Caillou({ p, actif, id }: { p: Pierre; actif: boolean; id: string }) {
  if (!actif) {
    return p.c === 'n'
      ? <circle className="encre-plein" cx={p.x} cy={p.y} r={p.r} />
      // Pierre blanche : contour tracé à l'intérieur du disque (même encombrement que la noire), vide de la couleur de la barre.
      : <circle className="encre-trait vide" cx={p.x} cy={p.y} r={p.r - 0.75} />;
  }
  return (
    <g>
      <circle className="ombre" cx={p.x + 0.6} cy={p.y + 0.9} r={p.r} />
      <circle className={p.c === 'n' ? 'pierre-n' : 'pierre-b'} cx={p.x} cy={p.y} r={p.r} fill={`url(#${id}${p.c})`} />
      {p.c === 'n' && <ellipse cx={p.x - p.r * 0.34} cy={p.y - p.r * 0.4} rx={p.r * 0.36} ry={p.r * 0.24} fill="#fff" opacity=".28" transform={`rotate(-30 ${p.x - p.r * 0.34} ${p.y - p.r * 0.4})`} />}
    </g>
  );
}

/** Dessin propre à chaque onglet. `.pose` : ce qui « tombe » à l'activation. */
function dessin(onglet: Onglet, actif: boolean, id: string): ReactElement {
  const pierre = (p: Pierre) => <Caillou key={`${p.x}-${p.y}`} p={p} actif={actif} id={id} />;
  switch (onglet) {
    // Jouer : le logo. La noire (toi) devant, la blanche derrière. Actif, une onde jade part de la noire qui vient
    // d'être posée : l'onde de la pierre fantôme de l'accueil, qui dit « à toi de jouer ».
    case 'jouer': return (<>
      {actif && <path className="accent-trait" d="M8.8 25.5A9.6 9.6 0 0 1 4.3 8.7" />}
      <g className="pose">
        {pierre({ x: 19.4, y: 10.8, r: 6.2, c: 'b' })}
        <circle className="detache" cx="10.6" cy="16.2" r="8" />
        {pierre({ x: 10.6, y: 16.2, r: 7.2, c: 'n' })}
      </g>
    </>);
    // Apprendre : le chemin des leçons en petit. Trois pierres sur une route qui serpente et monte, de la plus petite
    // à la noire, le but. Actif, la route est en or.
    case 'apprendre': return (<>
      <path className={actif ? 'accent-pointille' : 'encre-pointille'} d="M6 23C13 25.5 24.5 22 20.5 16.8S5.5 12 9.8 6.8" />
      <g className="pose">
        {pierre({ x: 6, y: 23, r: 3.6, c: 'b' })}
        {pierre({ x: 20.5, y: 16.8, r: 4.2, c: 'b' })}
        {pierre({ x: 9.8, y: 6.8, r: 5.4, c: 'n' })}
      </g>
    </>);
    // Problèmes : un coin de goban. La blanche n'a plus qu'une liberté (atari) ; actif, le point vital est marqué en hanko.
    case 'problemes': return (<>
      <g className="grille">
        <path d="M4 1.5V23H27" />
        <path d="M14 1.5V23M24 1.5V23M4 3H27M4 13H27" className="grille-fine" />
      </g>
      <circle className={actif ? 'accent-plein' : 'encre-plein'} cx="24" cy="23" r={actif ? 2.8 : 1.9} />
      <g className="pose">
        {pierre({ x: 4, y: 23, r: 4.8, c: 'n' })}
        {pierre({ x: 14, y: 13, r: 4.8, c: 'n' })}
        {pierre({ x: 14, y: 23, r: 4.8, c: 'b' })}
      </g>
    </>);
    // Profil : ta pierre et ton sceau, posé de travers comme un tampon (fond plein, cadre intérieur, comme Sceau.tsx).
    // Indigo, la deuxième encre des sceaux : le vermillon reste aux adversaires et aux problèmes.
    case 'profil': return (<>
      <g className="pose">
        {pierre({ x: 11.2, y: 11.2, r: 8.4, c: 'n' })}
      </g>
      <g transform="rotate(-9 20.4 20.4)">
        <rect className="detache" x="13.4" y="13.4" width="14" height="14" rx="4" />
        {actif ? (<>
          <rect className="sceau-fond" x="14.6" y="14.6" width="11.6" height="11.6" rx="3" />
          <rect className="sceau-cadre" x="16.4" y="16.4" width="8" height="8" rx="1.8" />
        </>) : (<>
          <rect className="encre-trait" x="15.35" y="15.35" width="10.1" height="10.1" rx="2.4" />
          <rect className="encre-plein" x="18.4" y="18.4" width="4" height="4" rx="1" />
        </>)}
      </g>
    </>);
  }
}

/** Icône d'un onglet, 28 px. Décorative : le libellé du bouton porte le nom. */
export function IconeNav({ onglet, actif = false }: { onglet: Onglet; actif?: boolean }) {
  const id = `ic-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg className={`icone-nav icone-${onglet}${actif ? ' active' : ''}`} viewBox="0 0 28 28" width="28" height="28" aria-hidden="true" focusable="false">
      {actif && <Matiere id={id} />}
      {dessin(onglet, actif, id)}
    </svg>
  );
}

/** Barre de navigation du bas : quatre onglets, l'actif porte aria-current="page". */
/**
 * Barre du bas. `pastilles` (#367) : onglets où quelque chose attend le joueur (un ami attend son coup, une série en
 * jeu aujourd'hui), avec ce qui attend ; un point jade se pose sur l'icône, et le lecteur d'écran entend
 * « Jouer, C'est ton tour contre Léa ».
 */
export function BarreNav({ actif, onChoisir, pastilles }: { actif: Onglet; onChoisir: (o: Onglet) => void; pastilles?: ReadonlyMap<Onglet, string> }) {
  return (
    <nav className="nav" aria-label={t('nav.aria')}>
      {ONGLETS.map(o => {
        const est = o.id === actif;
        const attente = pastilles?.get(o.id);
        const pastille = attente !== undefined;
        return (
          <button key={o.id} type="button" className={`onglet onglet-${o.id}`} aria-current={est ? 'page' : undefined} onClick={() => onChoisir(o.id)}
            data-pastille={pastille || undefined} aria-label={pastille ? `${o.libelle}, ${attente || t('aFaire.pastilleAria')}` : undefined}>
            <span className="onglet-icone">
              <IconeNav onglet={o.id} actif={est} />
              {pastille && <span className="onglet-pastille" aria-hidden="true" data-testid={`pastille-${o.id}`} />}
            </span>
            {/* #465 : nom entier, ou libellé court quand l'onglet est trop étroit (nav.css) ; le lecteur d'écran lit le nom entier. */}
            {o.court === o.libelle
              ? <span className="onglet-libelle">{o.libelle}</span>
              : (
                <span className="onglet-libelle">
                  <span className="onglet-long">{o.libelle}</span>
                  <span className="onglet-court" aria-hidden="true">{o.court}</span>
                </span>
              )}
            <span className="onglet-point" aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
}
