// Conseil de Mochi (#80) : le calque qui montre la zone sur le plateau, et la bulle avec le retour « utile / pas utile ».
// Le calque est un SVG séparé, posé exactement sur le plateau (même viewBox que src/ui/Board.tsx), sans toucher à Board :
// il ne capte aucun geste (les touches passent au plateau) et il est muet pour les lecteurs d'écran (la phrase suffit).
// Passe design #509 (point 3) : un repère net sur le point à jouer, un halo autour des pierres, jamais de voile dessus.
import { toLabel } from '../go/coords';
import { C, M, R, viewBoxOf } from './boardArt';
import { reperes } from './conseilCalque';
import { PortraitMochi } from './Portrait';
import { t } from '../content/i18n/secondaires';
import { fr } from './typo';
import './conseil.css';

// Couleurs posées sur le bois : les mêmes en mode sombre et clair (le goban ne change pas), comme l'indice de Board.tsx.
// Le jade foncé dessous garde chaque trait lisible sur le bois clair, l'ardoise et les pierres blanches.
const JADE = '#3CC48E', JADE_FONCE = '#155E40', HANKO = '#D2432C', PAPIER = '#F3EDE3';

/**
 * Calque du conseil : anneau en tirets sur le point à jouer (une croix si la phrase dit de l'éviter), halo de 2 px
 * autour des pierres concernées, petite pastille sur les autres points vides de la zone.
 */
export function CalqueConseil({ size, zone, point, board, eviter = false }:
  { size: number; zone: readonly number[]; point: number | null; board: ArrayLike<number>; eviter?: boolean }) {
  const vb = viewBoxOf(size), { cible, halos, points } = reperes(zone, point, board);
  const X = (p: number) => M + (p % size) * C, Y = (p: number) => M + Math.floor(p / size) * C;
  return (
    <svg className="calque-conseil" viewBox={`${vb.min} ${vb.min} ${vb.span} ${vb.span}`} aria-hidden="true" focusable="false"
      data-conseil={zone.map(p => toLabel(p, size)).join(' ')} data-point={point === null ? undefined : toLabel(point, size)}>
      <g fill="none" data-halo="">
        {halos.map(p => (
          <g key={p}>
            <circle cx={X(p)} cy={Y(p)} r={R + 2.6} stroke={JADE_FONCE} strokeOpacity={0.3} strokeWidth={4} />
            <circle cx={X(p)} cy={Y(p)} r={R + 2.6} stroke={JADE} strokeOpacity={0.85} strokeWidth={2} />
          </g>
        ))}
      </g>
      {points.map(p => <circle key={p} cx={X(p)} cy={Y(p)} r={C * 0.13} fill={JADE} stroke={JADE_FONCE} strokeWidth={1.6} />)}
      {cible !== null && (eviter ? (() => {
        const x = X(cible), y = Y(cible), d = `M${x - 8} ${y - 8}L${x + 8} ${y + 8}M${x + 8} ${y - 8}L${x - 8} ${y + 8}`;
        return <g className="conseil-cible" fill="none" strokeLinecap="round" data-eviter=""><path d={d} stroke={PAPIER} strokeOpacity={0.85} strokeWidth={7} /><path d={d} stroke={HANKO} strokeWidth={4} /></g>;
      })() : (
        <g className="conseil-cible" fill="none" data-cible="">
          <circle cx={X(cible)} cy={Y(cible)} r={R * 0.86} stroke={JADE_FONCE} strokeOpacity={0.6} strokeWidth={6} pathLength={100} strokeDasharray="6.5 3.5" />
          <circle cx={X(cible)} cy={Y(cible)} r={R * 0.86} stroke={JADE} strokeWidth={3.6} pathLength={100} strokeDasharray="6.5 3.5" />
        </g>
      ))}
    </svg>
  );
}

const POUCE = 'M9 11v9H5.5A1.5 1.5 0 0 1 4 18.5v-6A1.5 1.5 0 0 1 5.5 11H9Zm0 0 3.4-6.3a1.6 1.6 0 0 1 3 .9L14.7 10h4.1a2 2 0 0 1 2 2.3l-1 6A2 2 0 0 1 17.8 20H9';

function Pouce({ bas }: { bas?: boolean }) {
  return (
    <svg className="icone-trait" viewBox="0 0 26 26" aria-hidden="true">
      <path d={POUCE} transform={bas ? 'rotate(180 13 13) translate(0 1)' : 'translate(0 1)'} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Bulle du conseil : Mochi, la phrase (annoncée), puis « Utile » et « Pas utile » (44 px) tant que le joueur n'a pas répondu ;
 * ensuite un merci. Même place et même hauteur que la bulle habituelle de Mochi (src/ui/Partie.tsx, `Coach`).
 */
export function BulleConseil({ phrase, cle, note, onNote }: { phrase: string; cle: string | number; note: 'utile' | 'pas-utile' | null; onNote: (utile: boolean) => void }) {
  return (
    <div className="coach coach-conseil" data-conseil-bulle="">
      <PortraitMochi humeur="content" taille={44} decoratif className="coach-portrait" />
      <p key={cle} aria-live="polite">{fr(phrase)}</p>
      {note === null ? (
        <div className="conseil-note" role="group" aria-label={fr(t('conseil.note.question'))}>
          <button type="button" className="conseil-note-btn" aria-label={t('conseil.note.utile')} title={t('conseil.note.utile')} onClick={() => onNote(true)}><Pouce /></button>
          <button type="button" className="conseil-note-btn" aria-label={t('conseil.note.pasUtile')} title={t('conseil.note.pasUtile')} onClick={() => onNote(false)}><Pouce bas /></button>
        </div>
      ) : (
        <span className="conseil-merci" role="status">{fr(t('conseil.note.merci'))}</span>
      )}
    </div>
  );
}
