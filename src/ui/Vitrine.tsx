// Profil vivant (issue #103) : statistiques en anneaux et vitrine de badges, sept sceaux dessinés, tous différents.
import { useState, type CSSProperties, type ReactNode } from 'react';
import type { Badge, BadgeId, Stat } from '../app/vitrine';
import { t } from '../content/i18n/secondaires';
import { fr } from './typo';
import { entier } from './entier';

/** Icônes de la grammaire « deux pierres » : une pierre noire, une blanche, et un signe. 24 × 24. */
const ICONES: Record<Stat['id'], ReactNode> = {
  record: <>
    <circle cx="8" cy="15" r="5" className="p-noire" /><circle cx="16" cy="15" r="5" className="p-blanche" />
    <path d="M12.3 2.5c.3 1.6 2.6 2.6 2.6 5.2a2.9 2.9 0 0 1-5.8 0c0-1.3.6-2 1.3-2.6 0 .9.4 1.6 1 1.8-.3-1.6.2-3.2.9-4.4Z" className="p-or" />
  </>,
  // Leçons : deux pierres et le fanion du chemin.
  lecons: <>
    <circle cx="8" cy="15" r="5" className="p-noire" /><circle cx="16" cy="15" r="5" className="p-blanche" />
    <path d="M12 10V2.8l5 1.9-5 1.9" className="p-or" />
  </>,
  adversaires: <>
    <circle cx="8" cy="15" r="5" className="p-blanche" /><circle cx="16" cy="15" r="5" className="p-noire" />
    <path d="M7.5 8.5 9 3.5l3 3 3-3 1.5 5Z" className="p-or" />
  </>,
  problemes: <>
    <circle cx="9" cy="12" r="6" className="p-noire" /><circle cx="16" cy="12" r="6" className="p-blanche" />
    <path d="M13.2 12.2 15.2 14.2 18.8 10.2" className="p-trait" />
  </>,
};

const RAYON = 20, TOUR = 2 * Math.PI * RAYON;

/**
 * Anneau d'une statistique (#103) : piste discrète et arc d'or quand il y a un total (« 3 sur 7 ») ; sans total
 * (record, problèmes réussis : ils n'ont pas de fin), un médaillon plein, or ou jade. L'icône au centre.
 */
function Anneau({ s }: { s: Stat }) {
  const part = s.total ? Math.min(1, s.valeur / s.total) : 0;
  return (
    <svg className={`stat-anneau${s.total === undefined ? ' medaillon' : ''}`} viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" focusable="false">
      <circle className="an-piste" cx="24" cy="24" r={RAYON} />
      {s.total !== undefined && part > 0 && (
        <circle className="an-arc" cx="24" cy="24" r={RAYON} strokeDasharray={`${part * TOUR} ${TOUR}`} transform="rotate(-90 24 24)" />
      )}
      <g transform="translate(12 12)">{ICONES[s.id]}</g>
    </svg>
  );
}

/** « Ton parcours » (#214) : quatre compteurs ; « 3/7 » se lit « 3 leçons finies sur 7 ». */
export function Statistiques({ stats }: { stats: Stat[] }) {
  return (
    <ul className="stats" aria-label={t('stats.aria')}>
      {stats.map(s => (
        <li key={s.id} className={`stat stat-${s.id}`}>
          <Anneau s={s} />
          <b>{entier(s.valeur)}{s.total !== undefined && <small aria-hidden="true">/{s.total}</small>}</b>
          <span>{s.legende}</span>
          {s.total !== undefined && <small className="sr-only"> {t('stats.sur', { total: s.total })}</small>}
        </li>
      ))}
    </ul>
  );
}

/** Encre et forme de chaque sceau : jade rond pour les premières fois, or carré pour les paliers et les jalons, hanko pour la victoire. */
const SCEAUX: Record<BadgeId, { ton: 'jade' | 'or' | 'hanko'; forme: 'rond' | 'carre' }> = {
  'premiere-partie': { ton: 'jade', forme: 'rond' },
  'premier-probleme': { ton: 'jade', forme: 'rond' },
  'victoire-pomme': { ton: 'hanko', forme: 'rond' },
  'palier-debutant': { ton: 'or', forme: 'carre' },
  'dix-problemes': { ton: 'or', forme: 'carre' },
  'palier-novice': { ton: 'or', forme: 'carre' },
  'serie-7': { ton: 'or', forme: 'rond' },
};

/** Motif gravé de chaque sceau, dans la grille 48 × 48 (zone utile 10–38). */
const MOTIFS: Record<BadgeId, ReactNode> = {
  // Première partie : le coin du goban, une pierre noire posée, une blanche à côté.
  'premiere-partie': <>
    <path d="M13 36V13H36M24 13v23M13 24h23" className="s-ligne" />
    <circle cx="24" cy="24" r="6.2" className="s-pierre-n" /><circle cx="31.5" cy="16.5" r="5" className="s-pierre-b" />
  </>,
  // Premier problème : le point vital, entouré, et la pierre qui s'y pose.
  'premier-probleme': <>
    <circle cx="24" cy="24" r="12" className="s-cible" />
    <circle cx="24" cy="24" r="6.5" className="s-pierre-b" />
    <path d="M20.8 24.3 23.2 26.6 27.6 21.8" className="s-coche" />
  </>,
  // Pomme battue : la pomme de son sceau, et la coche jade dans le coin.
  'victoire-pomme': <>
    <g transform="translate(5.5 6) scale(.37)">
      <path d="M50 38c-7-6-24-4-25 12-1 13 8 28 16 28 4 0 6-2 9-2s5 2 9 2c8 0 17-15 16-28-1-16-18-18-25-12Z" className="s-plein" />
      <path d="M50 38c0-6 2-10 6-13" className="s-trait" strokeWidth="4" />
      <path d="M54 29c5-6 12-5 15-3-3 5-10 7-15 3Z" className="s-plein" />
    </g>
    <circle cx="35" cy="34" r="6.5" className="s-pastille" /><path d="M31.8 34.2 34.2 36.5 38.4 31.8" className="s-coche-pastille" />
  </>,
  // Palier Débutant : les collines au pied de la montagne, le soleil, un pin.
  'palier-debutant': <>
    <circle cx="33" cy="15" r="4.5" className="s-clair" />
    <path d="M8 36c6-9 12-9 18-5s8 4 14 1v8H8Z" className="s-plein" />
    <path d="M15 30l4-8 4 8Z" className="s-plein" />
  </>,
  // 10 problèmes : le chiffre, et les deux pierres.
  'dix-problemes': <>
    <text x="24" y="27" className="s-texte">10</text>
    <circle cx="19" cy="35.5" r="2.8" className="s-pierre-n" /><circle cx="29" cy="35.5" r="2.8" className="s-pierre-b" />
  </>,
  // Palier Novice : deux sommets au-dessus d'un nuage.
  'palier-novice': <>
    <path d="M7 38 19 17l6 9 7-11 9 23Z" className="s-plein" />
    <path d="M32 15l3 3-3-1-3 1Z" className="s-clair" />
    <ellipse cx="15" cy="34" rx="8" ry="2.6" className="s-clair" />
  </>,
  // 7 jours de série : la flamme, le chiffre dedans.
  'serie-7': <>
    <path d="M24.5 9c.7 4 6.6 6.6 6.6 13.3A7.5 7.5 0 0 1 24 30a7.5 7.5 0 0 1-7.5-7.7c0-3.4 1.7-5.3 3.4-6.7 0 2.4 1 4 2.5 4.6-.8-4.2.6-8.4 2.1-11.2Z" className="s-plein" />
    <text x="24" y="27" className="s-texte s-texte-flamme">7</text>
  </>,
};

export function SceauBadge({ id, obtenu, taille = 52 }: { id: BadgeId; obtenu: boolean; taille?: number }) {
  const { ton, forme } = SCEAUX[id];
  return (
    <svg className={`sceau-badge ${obtenu ? ton : 'eteint'} ${forme}`} viewBox="0 0 48 48" width={taille} height={taille} aria-hidden="true" focusable="false">
      {forme === 'rond'
        ? <><circle cx="24" cy="24" r="22.5" className="b-fond" /><circle cx="24" cy="24" r="18.5" className="b-anneau" /></>
        : <><rect x="2" y="2" width="44" height="44" rx="13" className="b-fond" /><rect x="6.5" y="6.5" width="35" height="35" rx="10" className="b-anneau" /></>}
      {MOTIFS[id]}
    </svg>
  );
}

/**
 * Vitrine des badges (#103, refaite pour #214) : les sept sceaux sur une rangée, chacun se touche (44 px).
 * Une ligne dessous dit le badge touché : son nom, et comment le gagner. Sans toucher, elle montre le badge qui vient
 * d'être gagné, sinon le prochain à gagner (effet de gradient : on voit le but suivant). Plus de texte coupé ni de
 * défilement caché. Un badge gagné depuis la dernière visite s'imprime une fois (jamais avec les mouvements réduits).
 */
export function VitrineBadges({ liste, nouveaux = [] }: { liste: Badge[]; nouveaux?: readonly string[] }) {
  const n = liste.filter(b => b.obtenu).length;
  const [choisi, setChoisi] = useState<BadgeId | null>(null);
  const b = (choisi && liste.find(x => x.id === choisi))
    || liste.find(x => x.obtenu && nouveaux.includes(x.id)) || null;
  const prochain = liste.find(x => !x.obtenu);
  const detail = b
    ? (b.obtenu ? t('vitrine.detailObtenu', { nom: b.nom }) : t('vitrine.detailAGagner', { nom: b.nom, condition: b.condition }))
    : prochain ? t('vitrine.prochain', { nom: prochain.nom, condition: prochain.condition }) : t('vitrine.aide');
  return (
    <section className="vitrine" aria-labelledby="vitrine-titre">
      <h2 id="vitrine-titre" className="vitrine-tete">
        <span aria-hidden="true">{t('vitrine.titreVisible')}</span>
        <span className="vitrine-compte" aria-hidden="true">{n}/{liste.length}</span>
        <span className="sr-only">{t('vitrine.titre', { n, total: liste.length })}</span>
      </h2>
      <ul className="vitrine-grille">
        {liste.map((x, i) => (
          <li key={x.id} className={`${x.obtenu ? 'obtenu' : 'a-gagner'}${x.obtenu && nouveaux.includes(x.id) ? ' nouveau' : ''}`} data-badge={x.id}
            style={{ '--rang': i } as CSSProperties}>
            <button type="button" className="badge-bouton" aria-pressed={choisi === x.id}
              aria-label={x.obtenu ? t('vitrine.obtenu', { nom: x.nom }) : t('vitrine.aGagner', { nom: x.nom, condition: x.condition })}
              onClick={() => setChoisi(c => (c === x.id ? null : x.id))}>
              <SceauBadge id={x.id} obtenu={x.obtenu} taille={44} />
            </button>
          </li>
        ))}
      </ul>
      <p className="vitrine-detail" aria-live="polite">{fr(detail)}</p>
    </section>
  );
}
