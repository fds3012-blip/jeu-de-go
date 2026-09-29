// Conseil de Mochi (#80) : le calque qui montre la zone sur le plateau, et la bulle avec le retour « utile / pas utile ».
// Le calque est un SVG séparé, posé exactement sur le plateau (même viewBox que src/ui/Board.tsx), sans toucher à Board :
// il ne capte aucun geste (les touches passent au plateau) et il est muet pour les lecteurs d'écran (la phrase suffit).
import { toLabel } from '../go/coords';
import { C, M, viewBoxOf } from './boardArt';
import { contour } from './conseilCalque';
import { PortraitMochi } from './Portrait';
import { t } from '../content/i18n';
import { fr } from './typo';
import './conseil.css';

// Couleurs posées sur le bois : les mêmes en mode sombre et clair (le goban ne change pas), comme l'indice de Board.tsx.
const JADE = '#3CC48E', JADE_FONCE = '#155E40';

/** Calque du conseil : cases de la zone teintées de jade, contour en tirets, et le point nommé cerclé. */
export function CalqueConseil({ size, zone, point }: { size: number; zone: readonly number[]; point: number | null }) {
  const vb = viewBoxOf(size), d = C / 2;
  const chemin = contour(zone, size).map(([a, b, c, e]) => `M${a} ${b}L${c} ${e}`).join('');
  return (
    <svg className="calque-conseil" viewBox={`${vb.min} ${vb.min} ${vb.span} ${vb.span}`} aria-hidden="true" focusable="false"
      data-conseil={zone.map(p => toLabel(p, size)).join(' ')} data-point={point === null ? undefined : toLabel(point, size)}>
      <g fill={JADE} fillOpacity={0.2}>
        {zone.map(p => <rect key={p} x={M + (p % size) * C - d} y={M + Math.floor(p / size) * C - d} width={C} height={C} />)}
      </g>
      <path d={chemin} fill="none" stroke={JADE_FONCE} strokeWidth={5} strokeOpacity={0.5} strokeLinecap="round" />
      <path d={chemin} fill="none" stroke={JADE} strokeWidth={3} strokeDasharray="7 5" strokeLinecap="round" />
      {point !== null && (
        <circle cx={M + (point % size) * C} cy={M + Math.floor(point / size) * C} r={C * 0.56} fill="none" stroke={JADE} strokeWidth={3.2} />
      )}
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
