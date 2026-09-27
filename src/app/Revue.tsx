// Écran de revue d'une partie terminée (issue #34, charte point 3 : « chaque erreur devient une leçon »).
// Goban en lecture avec navigation coup par coup, courbe d'avantage (Noir en bas, Blanc en haut),
// les 3 plus grosses erreurs du joueur avec une phrase de Mochi et le meilleur coup en pierre fantôme jade,
// puis une seule action en relief : « Rejouer d'ici ». Logique pure : revue.ts.
// Issue #71 : une note pour chaque coup (sceau sur la pierre, liste des coups, points sur la courbe),
// et un bilan de précision pour les deux joueurs, avec la phrase de Mochi.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Board } from '../ui/Board';
import { Mochi } from '../ui/Mochi';
import { Reflexion } from '../ui/Reflexion';
import { Icone } from '../ui/Partie';
import { SceauNote } from '../ui/SceauNote';
import { NOTE_ENCRE } from '../ui/notes';
import { fr } from '../ui/typo';
import { mouvementsReduits } from '../ui/defilement';
import { toLabel } from '../go/coords';
import type { Color, Position } from '../go/rules';
import { analyseRevue, meilleurCoup, preparerKataGo } from '../engine';
import { EVENTS, track } from '../data/analytics';
import {
  AUCUNE_ERREUR, candidatsBrillant, compteNotes, conseilFiable, courbe, courbeY, NOTE_INFO, noterCoups, phraseBilan, phraseErreur, phraseNote,
  precision, SANS_KATAGO, positionsDepuisSgf, rejouerDici, type AnalyseRevue, type Erreur, type Note, type NoteCoup,
} from './revue';
import { readLocal, writeLocal } from './hooks';
import { ajouter, creerErreur, ERREURS_KEY, lireErreurs, peutEnFaireUnProbleme } from './erreurs';
import '../ui/revue.css';

interface Props {
  /** La partie, en SGF. */
  sgf: string;
  /** Joueur dont on cherche les erreurs (contre l'ordi : Noir) ; `null` : les deux couleurs (partie à deux). */
  joueur: Color | null;
  /** Nom de l'adversaire (contre l'ordi), pour les phrases. */
  adversaire?: string;
  onRetour: () => void;
  /** « Rejouer d'ici » : historique jusqu'à la position choisie. */
  onRejouer: (history: Position[]) => void;
}

const L = 300, H = 64; // courbe : repère du viewBox
const pierres = (n: number) => `${n} pierre${n > 1 ? 's' : ''}`;
/** Lignes du tableau du bilan, du meilleur au pire (Solide seulement sans KataGo, Brillant seulement s'il y en a). */
const LIGNES: Note[] = ['brillant', 'meilleur', 'excellent', 'bon', 'solide', 'imprecision', 'erreur', 'grosse'];

export function Revue({ sgf, joueur, adversaire, onRetour, onRejouer }: Props) {
  const { positions, komi } = useMemo(() => positionsDepuisSgf(sgf), [sgf]);
  const n = positions.length - 1, size = positions[0].size;
  const [i, setI] = useState(Math.min(1, n));
  const [analyses, setAnalyses] = useState<(AnalyseRevue | null)[]>([]);
  const [confirmations, setConfirmations] = useState<Record<number, number>>({});
  // Meilleur coup par erreur, seulement s'il est fiable (conseilFiable) ; `null` : rien à montrer.
  const [meilleurs, setMeilleurs] = useState<Record<number, number | null>>({});
  const [sansKataGo, setSansKataGo] = useState(false);
  const [choisie, setChoisie] = useState<Erreur | null>(null);
  const [resume, setResume] = useState(false);
  // Erreurs déjà transformées en problème pendant cette revue (issue #77).
  const [gardees, setGardees] = useState<Record<number, true>>({});
  const liste = useRef<HTMLOListElement>(null);
  const analysees = analyses.length;
  const finie = analysees > n;
  const avances = useMemo(() => analyses.map(a => a?.lead ?? null), [analyses]);
  const notes = useMemo(() => (finie ? noterCoups(positions, analyses, confirmations) : []), [finie, positions, analyses, confirmations]);
  // Les 3 plus grosses erreurs du joueur, tirées des notes (le bruit du moteur y est déjà écarté).
  const erreurs = useMemo<Erreur[]>(() => notes
    .filter((x): x is NoteCoup => !!x && (!joueur || x.couleur === joueur) && (x.note === 'imprecision' || x.note === 'erreur' || x.note === 'grosse'))
    .sort((a, b) => b.perte - a.perte || a.coup - b.coup).slice(0, 3).map(x => ({ coup: x.coup, perte: x.perte })), [notes, joueur]);

  useEffect(() => { track(EVENTS.revueOuverte, { coups: n, taille: size, mode: adversaire ? 'ordi' : 'deux' }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Analyse dans le Worker du moteur, une position après l'autre. Le moteur est choisi une fois pour toutes
  // (KataGo s'il est prêt ou en cache, sinon le moteur simple) : deux moteurs ne se comparent pas.
  useEffect(() => {
    let vivant = true;
    (async () => {
      const kataGo = await preparerKataGo();
      const out: (AnalyseRevue | null)[] = [];
      for (const p of positions) {
        let a: AnalyseRevue | null;
        try { a = await analyseRevue(p, komi, { kataGo }); } catch { a = null; }
        if (!vivant) return;
        out.push(a);
        setAnalyses([...out]);
      }
      // Brillant : chaque candidat est revu par une analyse cinq fois plus longue. Sans confirmation, pas de Brillant.
      for (const k of candidatsBrillant(positions, out)) {
        const a = await analyseRevue(positions[k], komi, { visits: 160 }).catch(() => null);
        if (!vivant) return;
        if (a?.engine === 'katago') setConfirmations(c => ({ ...c, [k]: positions[k - 1].toPlay === 1 ? a.lead : -a.lead }));
      }
    })();
    return () => { vivant = false; };
  }, [positions, komi]);

  // Meilleur coup, seulement là où tu t'es trompé, et seulement avec KataGo : sans lui, aucun conseil (jamais de conseil faux).
  useEffect(() => {
    if (!erreurs.length) return;
    let vivant = true;
    (async () => {
      for (const e of erreurs) {
        const avant = positions[e.coup - 1], c = avant.toPlay, apres = avances[e.coup];
        let m: number | null = null;
        try {
          const r = await meilleurCoup(avant, komi);
          if (!vivant) return;
          if (!r.katago) { setSansKataGo(true); return; }
          // Gain du coup conseillé sur le coup joué, pour le joueur qui s'est trompé.
          const gain = apres == null ? 0 : r.lead - (c === 1 ? apres : -apres);
          m = conseilFiable(avant, r.move, gain) ? r.move : null;
        } catch { m = null; }
        if (!vivant) return;
        setMeilleurs(o => ({ ...o, [e.coup]: m }));
      }
    })();
    return () => { vivant = false; };
  }, [erreurs, positions, komi]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clavier : flèches gauche et droite.
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') aller(i - 1);
      else if (e.key === 'ArrowRight') aller(i + 1);
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  });

  // La liste des coups suit le coup affiché.
  useEffect(() => {
    const b = liste.current?.querySelector<HTMLElement>('[aria-current="true"]');
    b?.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: mouvementsReduits() ? 'auto' : 'smooth' });
  }, [i]);

  function aller(k: number) { setI(Math.max(0, Math.min(n, k))); setChoisie(null); }
  function voir(e: Erreur) { setI(e.coup - 1); setChoisie(e); setResume(false); }
  /** « En faire un problème » : la position avant l'erreur, le meilleur coup de KataGo et ses équivalents, gardés sur l'appareil. */
  function enFaireUnProbleme(e: Erreur) {
    const pb = creerErreur({
      avant: positions[e.coup - 1], joue: positions[e.coup].lastMove ?? -1, coup: e.coup, note: notes[e.coup - 1]?.note,
      meilleur: meilleurs[e.coup], perte: e.perte, analyse: analyses[e.coup - 1], adversaire,
    }, new Date());
    if (!pb) return;
    writeLocal(ERREURS_KEY, ajouter(lireErreurs(readLocal<unknown>(ERREURS_KEY, [])), pb));
    setGardees(g => ({ ...g, [e.coup]: true }));
  }

  const q = positions[i];
  const note = i > 0 ? notes[i - 1] ?? null : null;
  let phrase: string;
  if (choisie) phrase = phraseErreur(choisie, positions, meilleurs[choisie.coup] ?? null);
  else if (i === 0) phrase = 'Début de la partie. Touche « Suivant » pour avancer.';
  else {
    const avant = positions[i - 1], c = avant.toPlay, m = q.lastMove ?? -1, cap = q.captures[c] - avant.captures[c];
    const toi = !!adversaire && c === 1, nom = adversaire ? (c === 1 ? 'Toi' : adversaire) : c === 1 ? 'Noir' : 'Blanc';
    const geste = m < 0 ? (toi ? 'Tu passes' : `${nom} passe`) : `${toi ? 'Tu joues' : `${nom} joue`} ${toLabel(m, size)}`;
    phrase = `${geste}${cap ? ` et ${toi ? 'captures' : 'capture'} ${pierres(cap)}` : ''}.${note ? ` ${phraseNote(note)}` : ''}`;
  }

  const { ligne, aire } = courbe(avances, L, H, size);
  const x = (k: number) => (n <= 0 ? L / 2 : (k * L) / n);
  const meilleur = choisie ? meilleurs[choisie.coup] ?? undefined : undefined;
  const moi: Color = joueur ?? 1, lui = (3 - moi) as Color;
  const nomMoi = adversaire ? 'Toi' : 'Noir', nomLui = adversaire ?? 'Blanc';
  const precMoi = finie ? precision(notes, moi) : null, precLui = finie ? precision(notes, lui) : null;
  const cMoi = compteNotes(notes, moi), cLui = compteNotes(notes, lui);
  // Avec KataGo : toutes les notes (Brillant seulement s'il y en a un). Sans lui : Solide et les pertes, rien d'autre.
  const avecKataGo = analyses.some(a => a?.engine === 'katago');
  const lignes = LIGNES.filter(l => (avecKataGo ? l !== 'solide' && (l !== 'brillant' || cMoi[l] + cLui[l] > 0) : l === 'solide' || l === 'imprecision' || l === 'erreur' || l === 'grosse'));
  const marqueNote = note && q.lastMove != null && q.lastMove >= 0
    ? { p: q.lastMove, ...NOTE_ENCRE[note.note], symbole: NOTE_INFO[note.note].symbole, libelle: NOTE_INFO[note.note].libelle, cle: i } : undefined;

  return (
    <div className="revue">
      <header className="revue-tete">
        <button type="button" className="retour" onClick={onRetour} aria-label="Retour au bilan">‹</button>
        <h2>Revoir ma partie</h2>
        <span className="revue-compteur">Coup {i} sur {n}</span>
      </header>

      {precMoi != null && (
        <button type="button" className="revue-precision" aria-expanded={resume} aria-controls="revue-resume" onClick={() => setResume(r => !r)}>
          <span className="revue-precision-texte">
            <span className="revue-precision-titre">Précision</span>
            <span className="revue-precision-duo">{fr(`${nomMoi} ${precMoi} %`)}{precLui != null && <span className="revue-precision-lui">{fr(` · ${nomLui} ${precLui} %`)}</span>}</span>
          </span>
          <span className="revue-precision-voir">{resume ? 'Fermer' : 'Résumé'}</span>
        </button>
      )}

      {/* Résumé et coups se partagent la place, comme deux onglets : le résumé ne repousse jamais le goban. */}
      {resume && precMoi != null ? (
        <section id="revue-resume" className="revue-resume" aria-label="Résumé de la partie">
          <table className="revue-table">
            <thead><tr><th scope="col"><span className="sr-only">Note</span></th><th scope="col">{nomMoi}</th><th scope="col">{nomLui}</th></tr></thead>
            <tbody>
              {lignes.map(l => (
                <tr key={l} data-ligne={l}>
                  <th scope="row"><span className="revue-table-note"><SceauNote note={l} taille={22} />{NOTE_INFO[l].libelle}</span></th>
                  <td>{cMoi[l] || '–'}</td><td>{cLui[l] || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="revue-mochi revue-mochi-bilan">
            <Mochi size={40} />
            <p>{fr(phraseBilan(notes, moi, adversaire))}</p>
          </div>
          {!avecKataGo && <p className="revue-note">{fr('Sans KataGo, Mochi ne note que les pertes sûres : pas de « Meilleur coup ».')}</p>}
        </section>
      ) : (
        <>
      <div className="revue-plateau">
        <Board size={size} board={q.board} marks={{ last: q.lastMove, meilleur, note: marqueNote }} />
      </div>

      <div className="revue-nav">
        <button type="button" className="btn revue-pas" onClick={() => aller(i - 1)} disabled={i <= 0} aria-label="Précédent"><Icone nom="precedent" /></button>
        <ol ref={liste} className="revue-coups" aria-label="Coups de la partie">
          {positions.slice(1).map((p, k) => {
            const c = k + 1, nt = notes[k], m = p.lastMove ?? -1;
            const etiquette = `Coup ${c}, ${m < 0 ? 'passe' : toLabel(m, size)}${nt ? `, ${NOTE_INFO[nt.note].libelle}` : ''}`;
            return (
              <li key={c}>
                <button type="button" className="revue-coup" aria-current={c === i ? 'true' : undefined} aria-label={etiquette} onClick={() => aller(c)}>
                  <span className="revue-coup-num">{c}</span>
                  <span className={`revue-coup-pierre ${positions[k].toPlay === 1 ? 'noire' : 'blanche'}`} aria-hidden="true" />
                  <span className="revue-coup-lieu">{m < 0 ? 'passe' : toLabel(m, size)}</span>
                  {nt ? <SceauNote note={nt.note} taille={18} /> : <span className="revue-coup-vide" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ol>
        <button type="button" className="btn revue-pas" onClick={() => aller(i + 1)} disabled={i >= n} aria-label="Suivant"><Icone nom="suivant" /></button>
      </div>

      <div className="dock revue-dock">
        <button type="button" className="cta" onClick={() => onRejouer(rejouerDici(positions, i + 1, joueur ?? null))}>Rejouer d'ici</button>
      </div>
      <div className="revue-mochi" aria-live="polite">
        <Mochi size={40} />
        <p>{fr(phrase)}</p>
      </div>
      {choisie && peutEnFaireUnProbleme(notes[choisie.coup - 1]?.note, meilleurs[choisie.coup]) && (
        gardees[choisie.coup]
          ? <p className="revue-probleme-ok" role="status">{fr('Ajouté à tes problèmes : retrouve-le dans l’onglet Problèmes.')}</p>
          : <button type="button" className="btn revue-probleme" onClick={() => enFaireUnProbleme(choisie)}>En faire un problème</button>
      )}
      {sansKataGo && erreurs.length > 0 && <p className="revue-note">{fr(SANS_KATAGO)}</p>}

      <figure className="revue-courbe">
        <svg viewBox={`0 0 ${L} ${H}`} preserveAspectRatio="none" role="img" aria-label="Courbe d'avantage : Noir en bas, Blanc en haut"
          onClick={e => { const r = e.currentTarget.getBoundingClientRect(); aller(Math.round(((e.clientX - r.left) / r.width) * n)); }}>
          <rect className="revue-courbe-blanc" x="0" y="0" width={L} height={H} />
          {aire && <path className="revue-courbe-noir" d={aire} />}
          <line className="revue-courbe-milieu" x1="0" x2={L} y1={H / 2} y2={H / 2} />
          {ligne && <path className="revue-courbe-ligne" d={ligne} vectorEffect="non-scaling-stroke" />}
          <line className="revue-courbe-curseur" x1={x(i)} x2={x(i)} y1="0" y2={H} vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Points des erreurs, en HTML : ronds même quand la courbe s'étire. */}
        {notes.map(nt => nt && (nt.note === 'erreur' || nt.note === 'grosse') && avances[nt.coup] != null ? (
          <span key={nt.coup} className="revue-courbe-point" data-note={nt.note} aria-hidden="true"
            style={{ left: `${(x(nt.coup) / L) * 100}%`, top: `${(courbeY(avances[nt.coup]!, H, size) / H) * 100}%`, background: NOTE_ENCRE[nt.note].fond }} />
        ) : null)}
      </figure>

      {!finie ? (
        <p className="revue-analyse"><Reflexion taille={22} />{fr(`Mochi analyse ta partie… ${Math.min(analysees, n + 1)} / ${n + 1}`)}</p>
      ) : !erreurs.length ? (
        <p className="revue-aucune">{fr(AUCUNE_ERREUR)}</p>
      ) : (
        <div className="revue-erreurs" role="group" aria-label={fr(`Tes ${erreurs.length} plus grosses erreurs`)}>
          {erreurs.map(e => (
            <button type="button" key={e.coup} className={`revue-erreur${choisie?.coup === e.coup ? ' actif' : ''}`} aria-pressed={choisie?.coup === e.coup} onClick={() => voir(e)}>
              <b>Coup {e.coup}</b><span>{fr(`−${Math.max(1, Math.round(e.perte))} pts`)}</span>
            </button>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
}
