// Répertoire d'ouvertures (#591) : fuseki et joseki prouvés par KataGo, chargé à la demande depuis Apprendre.
// Deux vues : la liste (par taille de plateau), puis le lecteur d'une entrée (avancer, reculer, voir l'erreur courante).
// Même grammaire que le lecteur de leçon (Lecon.tsx) : la barre, le plateau, la parole, puis une seule action en relief.
// Données : src/content/ouvertures.ts ; textes : src/content/i18n/ouvertures.ts ; preuves : src/go/ouvertures.test.ts.
import { useMemo, useState } from 'react';
import { OUVERTURES } from '../content/ouvertures';
import { tou, type CleOuvertures } from '../content/i18n/ouvertures';
import { fenetreDe } from '../content/cadreLecon';
import { Board, type BoardMarks } from '../ui/Board';
import { EnteteEcran } from '../ui/BoutonRetour';
import { MiniGoban } from '../ui/MiniGoban';
import { fr } from '../ui/typo';
import { fromSgf, toLabel } from '../go/coords';
import { lireOuverture, positionsErreur, positionsOuverture, type Ouverture } from '../go/ouvertures';
import type { Position } from '../go/rules';
import '../ui/lecon.css';
import '../ui/ouvertures.css';

const k = (s: string) => s as CleOuvertures;
const camp = (c: 1 | 2) => tou(c === 1 ? 'noir' : 'blanc');
const lignes = (p: Position) => Array.from({ length: p.size }, (_, y) => Array.from({ length: p.size }, (_, x) => '.XO'[p.board[y * p.size + x]]).join(''));

/** `onLecon` (#672) : ouvre la leçon qui enseigne une entrée (champ `lecon`). */
export default function Ouvertures({ onExit, onLecon }: { onExit: () => void; onLecon?: (id: string) => void }) {
  const [taille, setTaille] = useState<9 | 19>(9);
  const [choisie, setChoisie] = useState<Ouverture | null>(null);
  if (choisie) return <LecteurOuverture key={choisie.id} o={choisie} onLecon={onLecon} onExit={() => { setChoisie(null); window.scrollTo({ top: 0 }); }} />;
  // #672 : une ligne prouvée pour une leçon seulement (`repertoire: false`) n'est pas dans la liste.
  const liste = OUVERTURES.filter(o => o.taille === taille && o.repertoire !== false);
  return (
    <div className="ouvertures" data-testid="ouvertures">
      <EnteteEcran titre={tou('titre')} retour={tou('retourApprendre')} onRetour={onExit} />
      {/* #626 (V4) : un choix exclusif ordinaire (.seg), à plat : l'écran n'a pas d'action principale en relief (E1). */}
      <div className="seg ouv-tailles" role="group" aria-label={tou('tailles')}>
        {([9, 19] as const).map(n => (
          <button key={n} type="button" aria-pressed={taille === n} onClick={() => setTaille(n)}>{tou(n === 9 ? 'taille.9' : 'taille.19')}</button>
        ))}
      </div>
      {/* #626 (V4, P2) : des cartes visuelles. La position après la séquence (les vrais coups), le nom, une ligne.
          L'idée complète, le nombre de coups et la preuve KataGo viennent dans l'écran de l'ouverture. */}
      <ul className="ouv-liste" aria-label={tou(taille === 9 ? 'taille.9' : 'taille.19')}>
        {liste.map(o => {
          const lue = lireOuverture(o), fin = positionsOuverture(lue).at(-1)!;
          // Miniature : la position finale, dans la zone que montre le lecteur (le coin), ou sur tout le plateau.
          const f = fenetreDe(o.cadre, o.taille) ?? { x: 0, y: 0, k: o.taille };
          return (
            <li key={o.id}>
              <button type="button" className="ouv-carte" data-id={o.id} aria-labelledby={`ouv-${o.id}-nom`} aria-describedby={`ouv-${o.id}-ligne`}
                onClick={() => { setChoisie(o); window.scrollTo({ top: 0 }); }}>
                <MiniGoban rows={lignes(fin)} fenetre={f} className="ouv-mini" />
                <b id={`ouv-${o.id}-nom`}>{fr(tou(k(`o.${o.id}.nom`)))}</b>
                <small id={`ouv-${o.id}-ligne`}>{fr(tou(k(`o.${o.id}.ligne`)))}</small>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Lecteur d'une entrée : `i` coups joués (0 : le départ) ; `erreur` : rang de l'erreur montrée, ou null. */
function LecteurOuverture({ o, onExit, onLecon }: { o: Ouverture; onExit: () => void; onLecon?: (id: string) => void }) {
  const lue = useMemo(() => lireOuverture(o), [o]);
  const positions = useMemo(() => positionsOuverture(lue), [lue]);
  const [i, setI] = useState(0);
  const [erreur, setErreur] = useState<number | null>(null);
  const n = lue.coups.length, taille = o.taille, fenetre = fenetreDe(o.cadre, taille);
  const e = erreur === null ? null : o.erreurs[erreur];

  // Plateau : la séquence jusqu'au coup i (numéros sur les pierres de la séquence), ou l'erreur et sa réplique.
  let board: Int8Array, marks: BoardMarks, numeros: Map<number, number>;
  if (e) {
    const ps = positionsErreur(o, lue, e), p = fromSgf(e.c, taille);
    board = ps[ps.length - 1].board;
    numeros = new Map(lue.coups.slice(0, e.coup).map((c, j) => [c.point, j + 1]));
    numeros.set(p, e.coup + 1);
    if (e.reponse) numeros.set(fromSgf(e.reponse, taille), e.coup + 2);
    marks = { mistake: p, last: e.reponse ? fromSgf(e.reponse, taille) : null };
  } else {
    board = positions[i].board;
    numeros = new Map(lue.coups.slice(0, i).map((c, j) => [c.point, j + 1]));
    marks = { last: i ? lue.coups[i - 1].point : null };
  }

  const coup = i ? lue.coups[i - 1] : null;
  const texte = e ? tou(k(`o.${o.id}.e${erreur! + 1}`)) : coup ? tou(k(`o.${o.id}.c${i}`)) : tou(k(`o.${o.id}.idee`));
  const fin = !e && i === n;
  /** L'erreur à montrer : celle du coup affiché, sinon la première qui suit, sinon la première. */
  const erreurAMontrer = () => {
    const j = o.erreurs.findIndex(x => x.coup === i - 1);
    if (j >= 0) return j;
    const s = o.erreurs.findIndex(x => x.coup >= i - 1);
    return s >= 0 ? s : 0;
  };
  const voirErreur = () => setErreur(erreurAMontrer());

  return (
    <div className="lecteur lecteur-lecon ouv-lecteur" data-testid="ouverture" data-id={o.id} data-coup={i} data-erreur={erreur ?? undefined}>
      <EnteteEcran titre={fr(tou(k(`o.${o.id}.nom`)))} retour={tou('retourListe')} onRetour={onExit} />
      <p className="ouv-etat" aria-hidden={!coup && !e}>
        {e ? <b className="ouv-etat-erreur">{tou('erreurTitre')}</b>
          : coup ? <>{tou('progression', { n: i, total: n })} · {tou('joue', { camp: camp(coup.couleur), point: toLabel(coup.point, taille) })}</>
            : '\u00A0'}
      </p>
      <div className="lecteur-plateau">
        <div className="plateau-cadre">
          <Board lieu="lecon" size={taille} fenetre={fenetre} board={board} marks={marks} numeros={numeros} />
        </div>
      </div>
      <div key={`${i}-${erreur}`} className={`bubble ouv-parole${e ? ' ouv-parole-erreur' : ''}`} role="status" aria-live="polite" data-testid="ouverture-texte">
        <p>{fr(texte)}</p>
        {e && <p className="ouv-perte">{fr(tou('perte', { pts: e.perte }))}</p>}
        {/* #626 : la preuve KataGo, au départ de la séquence (elle quittait le bas de la liste). */}
        {!e && i === 0 && <p className="ouv-aide">{fr(tou('preuve'))}</p>}
        {fin && o.ailleurs && <p>{fr(tou('ailleurs', { camp: camp((3 - lue.coups[n - 1].couleur) as 1 | 2) }))}</p>}
        {fin && <p className="ouv-aide">{fr(tou('fin'))}</p>}
      </div>
      {e ? (
        <div className="ouv-actions">
          <button type="button" className="btn primary ouv-principal" onClick={() => { setI(e.coup + 1); setErreur(null); }}>{tou('retourSequence')}</button>
          {o.erreurs.length > 1 && (
            <button type="button" className="lien ouv-autre" onClick={() => setErreur((erreur! + 1) % o.erreurs.length)}>{tou('autreErreur')}</button>
          )}
        </div>
      ) : (
        <div className="ouv-actions">
          <div className="ouv-nav">
            <button type="button" className="btn ouv-precedent" disabled={i === 0} onClick={() => setI(i - 1)}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M15 5 8 12l7 7" /></svg>{tou('precedent')}
            </button>
            {fin
              ? <button type="button" className="btn primary ouv-principal" onClick={() => setI(0)}>{tou('recommencer')}</button>
              : <button type="button" className="btn primary ouv-principal" data-testid="ouverture-suivant" onClick={() => setI(i + 1)}>
                {tou('suivant')}<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="m9 5 7 7-7 7" /></svg>
              </button>}
          </div>
          {/* #672 : au départ et à la fin de la séquence, la leçon qui enseigne cette ouverture, à côté de l'erreur courante. */}
          <div className="ouv-liens">
            <button type="button" className="lien ouv-voir-erreur" data-testid="voir-erreur" onClick={voirErreur}>{tou('voirErreur')}</button>
            {o.lecon && onLecon && (i === 0 || fin) && (
              <button type="button" className="lien ouv-lecon" data-testid="ouverture-lecon" onClick={() => onLecon(o.lecon!)}>{tou('lecon')}</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
