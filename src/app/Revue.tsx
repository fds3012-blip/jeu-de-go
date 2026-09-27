// Écran de revue d'une partie terminée (issue #34, charte point 3 : « chaque erreur devient une leçon »).
// Goban en lecture avec navigation coup par coup, courbe d'avantage (Noir en bas, Blanc en haut),
// les 3 plus grosses erreurs du joueur avec une phrase de Mochi et le meilleur coup en pierre fantôme jade,
// puis une seule action en relief : « Rejouer d'ici ». Logique pure : revue.ts.
import { useEffect, useMemo, useState } from 'react';
import { Board } from '../ui/Board';
import { Mochi } from '../ui/Mochi';
import { Reflexion } from '../ui/Reflexion';
import { Icone } from '../ui/Partie';
import { fr } from '../ui/typo';
import { toLabel } from '../go/coords';
import type { Color, Position } from '../go/rules';
import { estimateLead, meilleurCoup } from '../engine';
import { EVENTS, track } from '../data/analytics';
import { courbe, grossesErreurs, phraseErreur, positionsDepuisSgf, rejouerDici, type Erreur } from './revue';
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

export function Revue({ sgf, joueur, adversaire, onRetour, onRejouer }: Props) {
  const { positions, komi } = useMemo(() => positionsDepuisSgf(sgf), [sgf]);
  const n = positions.length - 1, size = positions[0].size;
  const [i, setI] = useState(Math.min(1, n));
  const [avances, setAvances] = useState<(number | null)[]>([]);
  const [meilleurs, setMeilleurs] = useState<Record<number, number>>({});
  const [choisie, setChoisie] = useState<Erreur | null>(null);
  const analysees = avances.length;
  const finie = analysees > n;
  const erreurs = useMemo(() => (finie ? grossesErreurs(positions, avances, joueur) : []), [finie, positions, avances, joueur]);

  useEffect(() => { track(EVENTS.revueOuverte, { coups: n, taille: size, mode: adversaire ? 'ordi' : 'deux' }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Analyse dans le Worker du moteur, une position après l'autre (KataGo s'il est chargé, sinon le moteur simple).
  useEffect(() => {
    let vivant = true;
    (async () => {
      const out: (number | null)[] = [];
      for (const p of positions) {
        let v: number | null;
        try { v = (await estimateLead(p, komi))?.lead ?? null; } catch { v = null; }
        if (!vivant) return;
        out.push(v);
        setAvances([...out]);
      }
    })();
    return () => { vivant = false; };
  }, [positions, komi]);

  // Meilleur coup, seulement là où tu t'es trompé : juste avant chaque erreur.
  useEffect(() => {
    if (!erreurs.length) return;
    let vivant = true;
    (async () => {
      for (const e of erreurs) {
        let m: number;
        try { m = await meilleurCoup(positions[e.coup - 1], komi); } catch { m = -1; }
        if (!vivant) return;
        setMeilleurs(o => ({ ...o, [e.coup]: m }));
      }
    })();
    return () => { vivant = false; };
  }, [erreurs, positions, komi]);

  // Clavier : flèches gauche et droite.
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') aller(i - 1);
      else if (e.key === 'ArrowRight') aller(i + 1);
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  });

  function aller(k: number) { setI(Math.max(0, Math.min(n, k))); setChoisie(null); }
  function voir(e: Erreur) { setI(e.coup - 1); setChoisie(e); }

  const q = positions[i];
  let phrase: string;
  if (choisie) phrase = phraseErreur(choisie, positions, meilleurs[choisie.coup] ?? null);
  else if (i === 0) phrase = 'Début de la partie. Touche « Suivant » pour avancer.';
  else {
    const avant = positions[i - 1], c = avant.toPlay, m = q.lastMove ?? -1, cap = q.captures[c] - avant.captures[c];
    const toi = !!adversaire && c === 1, nom = adversaire ? (c === 1 ? 'Toi' : adversaire) : c === 1 ? 'Noir' : 'Blanc';
    const geste = m < 0 ? (toi ? 'Tu passes' : `${nom} passe`) : `${toi ? 'Tu joues' : `${nom} joue`} ${toLabel(m, size)}`;
    phrase = `${geste}${cap ? ` et ${toi ? 'captures' : 'capture'} ${pierres(cap)}` : ''}.`;
  }
  if (finie && !erreurs.length && !choisie && i === Math.min(1, n)) phrase = "Pas de grosse erreur dans cette partie. Bravo, continue comme ça !";

  const { ligne, aire } = courbe(avances, L, H, size);
  const x = (k: number) => (n <= 0 ? L / 2 : (k * L) / n);
  const meilleur = choisie ? meilleurs[choisie.coup] : undefined;

  return (
    <div className="revue">
      <header className="revue-tete">
        <button type="button" className="retour" onClick={onRetour} aria-label="Retour au bilan">‹</button>
        <h2>Revoir ma partie</h2>
        <span className="revue-compteur">Coup {i} sur {n}</span>
      </header>

      <div className="revue-plateau">
        <Board size={size} board={q.board} marks={{ last: q.lastMove, meilleur }} />
      </div>

      <figure className="revue-courbe">
        <svg viewBox={`0 0 ${L} ${H}`} preserveAspectRatio="none" role="img" aria-label="Courbe d'avantage : Noir en bas, Blanc en haut"
          onClick={e => { const r = e.currentTarget.getBoundingClientRect(); aller(Math.round(((e.clientX - r.left) / r.width) * n)); }}>
          <rect className="revue-courbe-blanc" x="0" y="0" width={L} height={H} />
          {aire && <path className="revue-courbe-noir" d={aire} />}
          <line className="revue-courbe-milieu" x1="0" x2={L} y1={H / 2} y2={H / 2} />
          {ligne && <path className="revue-courbe-ligne" d={ligne} vectorEffect="non-scaling-stroke" />}
          {erreurs.map(e => <line key={e.coup} className="revue-courbe-erreur" x1={x(e.coup)} x2={x(e.coup)} y1="0" y2={H} vectorEffect="non-scaling-stroke" />)}
          <line className="revue-courbe-curseur" x1={x(i)} x2={x(i)} y1="0" y2={H} vectorEffect="non-scaling-stroke" />
        </svg>
      </figure>

      <div className="revue-nav">
        <button type="button" className="btn revue-pas" onClick={() => aller(i - 1)} disabled={i <= 0} aria-label="Précédent"><Icone nom="precedent" /></button>
        <input type="range" min={0} max={n} value={i} onChange={e => aller(Number(e.target.value))} aria-label="Coup affiché" />
        <button type="button" className="btn revue-pas" onClick={() => aller(i + 1)} disabled={i >= n} aria-label="Suivant"><Icone nom="suivant" /></button>
      </div>

      {!finie ? (
        <p className="revue-analyse"><Reflexion taille={22} />{fr(`Mochi analyse ta partie… ${Math.min(analysees, n + 1)} / ${n + 1}`)}</p>
      ) : erreurs.length > 0 && (
        <div className="revue-erreurs" role="group" aria-label={fr(`Tes ${erreurs.length} plus grosses erreurs`)}>
          {erreurs.map(e => (
            <button type="button" key={e.coup} className={`revue-erreur${choisie?.coup === e.coup ? ' actif' : ''}`} aria-pressed={choisie?.coup === e.coup} onClick={() => voir(e)}>
              <b>Coup {e.coup}</b><span>{fr(`−${Math.max(1, Math.round(e.perte))} pts`)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="revue-mochi" aria-live="polite">
        <Mochi size={40} />
        <p>{fr(phrase)}</p>
      </div>

      <div className="dock revue-dock">
        <button type="button" className="cta" onClick={() => onRejouer(rejouerDici(positions, i + 1, joueur ?? null))}>Rejouer d'ici</button>
      </div>
    </div>
  );
}
