// Profil vivant (issue #103) : rangée de statistiques et vitrine de badges en sceaux ronds.
import type { ReactNode } from 'react';
import type { Badge, BadgeId, Stat } from '../app/vitrine';
import { t } from '../content/i18n';

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

/** « Ton parcours » (#214) : quatre compteurs ; « 3/7 » se lit « 3 leçons finies sur 7 ». */
export function Statistiques({ stats }: { stats: Stat[] }) {
  return (
    <ul className="stats" aria-label={t('stats.aria')}>
      {stats.map(s => (
        <li key={s.id} className={`stat stat-${s.id}`}>
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">{ICONES[s.id]}</svg>
          <b>{s.valeur}{s.total !== undefined && <small aria-hidden="true">/{s.total}</small>}</b>
          <span>{s.legende}</span>
          {s.total !== undefined && <small className="sr-only"> {t('stats.sur', { total: s.total })}</small>}
        </li>
      ))}
    </ul>
  );
}

/** Signe gravé au centre de chaque sceau, dans un carré de 24. */
const SIGNES: Record<BadgeId, ReactNode> = {
  'premiere-partie': <><circle cx="9.5" cy="12" r="4.6" className="s-plein" /><circle cx="14.5" cy="12" r="4.6" className="s-creux" /></>,
  'premier-probleme': <path d="M6.5 12.5 10.5 16.5 17.5 8.5" className="s-trait" />,
  'victoire-pomme': <><path d="M12 8.2c-1.4-1.3-5.8-1.4-5.8 3.6 0 3.3 2.4 6 4.2 6 .8 0 1-.4 1.6-.4s.8.4 1.6.4c1.8 0 4.2-2.7 4.2-6 0-5-4.4-4.9-5.8-3.6Z" className="s-plein" /><path d="M12 8.2c0-1.6.6-2.8 2-3.6" className="s-trait fin" /></>,
  'palier-debutant': <><path d="M4 18 10 9l3.2 4.6L15 11l5 7Z" className="s-plein" /><path d="M10 9V4.5l3.6 1.4L10 7.3" className="s-trait fin" /></>,
  'dix-problemes': <text x="12" y="16.4" className="s-texte">10</text>,
  'palier-novice': <><path d="M3.5 18 9 10l3 4 3.5-6.5L20.5 18Z" className="s-plein" /><path d="M15.5 7.5V3l3.4 1.3-3.4 1.4" className="s-trait fin" /></>,
  'serie-7': <path d="M12.6 3.5c.5 2.8 4.7 4.7 4.7 9.5A5.4 5.4 0 0 1 12 18.5 5.4 5.4 0 0 1 6.6 13c0-2.4 1.2-3.8 2.4-4.8 0 1.7.7 2.9 1.8 3.3-.6-3 .4-6 1.8-8Z" className="s-plein" />,
};

/** Or pour les jalons longs (paliers, série, 10 problèmes), jade pour les premières fois. */
const OR: BadgeId[] = ['palier-debutant', 'palier-novice', 'serie-7', 'dix-problemes'];

export function SceauBadge({ id, obtenu, taille = 52 }: { id: BadgeId; obtenu: boolean; taille?: number }) {
  const ton = !obtenu ? 'eteint' : OR.includes(id) ? 'or' : 'jade';
  return (
    <svg className={`sceau-badge ${ton}`} viewBox="0 0 48 48" width={taille} height={taille} aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="22.5" className="b-fond" />
      <circle cx="24" cy="24" r="18.5" className="b-anneau" />
      {/* Petites encoches de sceau sur le pourtour. */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map(a => <circle key={a} cx={24 + 20.5 * Math.cos((a * Math.PI) / 180)} cy={24 + 20.5 * Math.sin((a * Math.PI) / 180)} r="0.9" className="b-point" />)}
      <g transform="translate(12 12)">{SIGNES[id]}</g>
    </svg>
  );
}

export function VitrineBadges({ liste }: { liste: Badge[] }) {
  const n = liste.filter(b => b.obtenu).length;
  return (
    <section className="vitrine" aria-labelledby="vitrine-titre">
      <h2 id="vitrine-titre" className="sr-only">{t('vitrine.titre', { n, total: liste.length })}</h2>
      <ul className="vitrine-rangee">
        {liste.map(b => (
          <li key={b.id} className={b.obtenu ? 'obtenu' : 'a-gagner'} data-badge={b.id}
            aria-label={b.obtenu ? t('vitrine.obtenu', { nom: b.nom }) : t('vitrine.aGagner', { nom: b.nom, condition: b.condition })}>
            <SceauBadge id={b.id} obtenu={b.obtenu} taille={36} />
            {/* Obtenu : son nom. À gagner : ce qu'il faut faire, le sceau en creux dit déjà de quoi il s'agit. */}
            {b.obtenu ? <b aria-hidden="true">{b.nom}</b> : <small aria-hidden="true">{b.condition}</small>}
          </li>
        ))}
      </ul>
    </section>
  );
}
