import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Board } from '../ui/Board';
import { groupAt, newPosition, play, type Position } from '../go/rules';
import { score } from '../go/score';
import { toLabel } from '../go/coords';
import { bestMove, type Opponent } from '../engine';

const REFUS = { occupe: '', ko: "Ko : tu ne peux pas reprendre tout de suite, joue d'abord ailleurs.", suicide: 'Coup interdit : cette pierre serait capturée par elle-même.', 'hors-plateau': '' };
const pierres = (n: number) => `${n} pierre${n > 1 ? 's' : ''}`;

// Sans `opponent` : partie à deux sur le même appareil. Avec : le joueur a Noir, l'ordi joue Blanc.
interface Props { size: number; komi: number; confirmTouch: boolean; onExit: () => void; opponent?: Opponent; intro?: ReactNode }

export function Game({ size, komi, confirmTouch, onExit, opponent: ai, intro }: Props) {
  const [history, setHistory] = useState<Position[]>(() => [newPosition(size)]);
  const [phase, setPhase] = useState<'play' | 'score' | 'end'>('play');
  const [dead, setDead] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState(ai ? `Tu as Noir, ${ai.nom} a Blanc. Touche une intersection pour jouer.` : 'Noir commence. Touche une intersection, puis touche-la à nouveau pour confirmer.');
  const [resignArm, setResignArm] = useState(false);
  const [resigned, setResigned] = useState<0 | 1 | 2>(0);
  const [thinking, setThinking] = useState(false);
  const token = useRef(0); // invalide les réponses de l'ordi devenues caduques (annulation, sortie)
  const pos = history[history.length - 1];
  const sc = useMemo(() => score(pos, komi, 'japanese', dead), [pos, komi, dead]);
  const aiTurn = !!ai && phase === 'play' && pos.toPlay === 2;
  const myTurn = !ai || (pos.toPlay === 1 && !thinking);

  // Tour de l'ordi : on demande un coup au moteur (dans un Web Worker), puis on le joue.
  useEffect(() => {
    if (!ai || !aiTurn) return;
    const t = ++token.current, t0 = Date.now();
    setThinking(true);
    bestMove(pos, ai.id, { komi }).then(async m => {
      const wait = 350 - (Date.now() - t0); // petite pause pour que la réponse ne paraisse pas instantanée
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      if (t !== token.current) return;
      setThinking(false);
      const r = play(pos, m);
      if (typeof r === 'string') return;
      setHistory(h => [...h, r]);
      if (m === -1) {
        if (pos.lastMove === -1) { setPhase('score'); setMsg(`${ai.nom} passe aussi : la partie est finie. Touche les groupes morts pour les retirer, puis valide.`); }
        else setMsg(`${ai.nom} passe. Si tu passes aussi, on compte les points.`);
      } else {
        const cap = r.captures[2] - pos.captures[2];
        setMsg(cap ? `${ai.nom} capture ${pierres(cap)} en ${toLabel(m, size)}.` : `${ai.nom} joue ${toLabel(m, size)}. À toi.`);
      }
    });
    return () => { token.current++; setThinking(false); };
  }, [ai, aiTurn, pos, komi, size]);

  function onPlay(p: number) {
    if (phase === 'score') {
      if (!pos.board[p]) return;
      const g = groupAt(pos.board, size, p), next = new Set(dead), isDead = dead.has(p);
      for (const s of g.stones) isDead ? next.delete(s) : next.add(s);
      setDead(next);
      return;
    }
    if (phase !== 'play' || !myTurn) return;
    const r = play(pos, p);
    if (typeof r === 'string') { if (REFUS[r]) setMsg(REFUS[r]); return; }
    const cap = r.captures[pos.toPlay] - pos.captures[pos.toPlay];
    setHistory([...history, r]);
    if (ai) setMsg(cap ? `Bravo, tu captures ${pierres(cap)} !` : `Tu joues ${toLabel(p, size)}.`);
    else setMsg(cap ? `${pos.toPlay === 1 ? 'Noir' : 'Blanc'} capture ${pierres(cap)}.` : `${r.toPlay === 1 ? 'Noir' : 'Blanc'} joue. Dernier coup : ${toLabel(p, size)}.`);
  }
  function pass() {
    if (!myTurn) return;
    const r = play(pos, -1) as Position;
    setHistory([...history, r]);
    if (pos.lastMove === -1) { setPhase('score'); setMsg('Deux passes : la partie est finie. Touche les groupes morts pour les retirer, puis valide.'); }
    else if (ai) setMsg(`Tu passes. Si ${ai.nom} passe aussi, on compte les points.`);
    else setMsg(`${pos.toPlay === 1 ? 'Noir' : 'Blanc'} passe. Si ${r.toPlay === 1 ? 'Noir' : 'Blanc'} passe aussi, on compte les points.`);
  }
  // Contre l'ordi, on revient juste avant ton dernier coup : ton coup et la réponse de l'ordi sont repris.
  let undoTo = history.length - 1;
  if (ai) { undoTo = -1; for (let i = history.length - 1; i > 0; i--) if (history[i].toPlay === 2) { undoTo = i; break; } }
  function undo() {
    if (undoTo < 1) return;
    token.current++;
    setThinking(false);
    setHistory(history.slice(0, undoTo)); setPhase('play'); setDead(new Set()); setMsg(ai ? 'Coup annulé. À toi de rejouer.' : 'Coup annulé.');
  }
  function resign() {
    if (!resignArm) { setResignArm(true); setTimeout(() => setResignArm(false), 3000); return; }
    token.current++;
    setResigned(ai ? 1 : pos.toPlay); setPhase('end');
  }
  function restart() {
    token.current++;
    setHistory([newPosition(size)]); setPhase('play'); setDead(new Set()); setResigned(0); setThinking(false);
    setMsg(ai ? `Nouvelle partie : tu as Noir, à toi.` : 'Nouvelle partie : Noir commence.');
  }

  const name = (c: 1 | 2) => (ai ? (c === 1 ? 'Toi' : ai.nom) : c === 1 ? 'Noir' : 'Blanc');
  const strip = (c: 1 | 2) => (
    <div className={`strip ${phase === 'play' && pos.toPlay === c ? 'active' : ''}`}>
      <span className={`stone ${c === 1 ? 'b' : 'w'}`} />
      <span><b>{name(c)}</b><small>{c === 2 ? `${ai ? `${ai.rang}, ` : ''}komi ${String(komi).replace('.', ',')}` : ai ? 'Noir, tu commences' : 'commence'}</small></span>
      <span className="caps">{pos.captures[c]} prisonnier{pos.captures[c] > 1 ? 's' : ''}</span>
    </div>
  );

  if (phase === 'end') {
    const winner = resigned ? (3 - resigned) as 1 | 2 : sc.winner;
    const how = resigned ? 'par abandon' : `de ${String(sc.margin).replace('.', ',')} point${sc.margin >= 2 ? 's' : ''}`;
    return (
      <div>
        <button className="back" onClick={onExit}>‹ Accueil</button>
        <p className="big">{ai && winner === 1 ? 'Tu gagnes' : `${name(winner)} gagne`} {how}</p>
        <p className="muted">{history.length - 1} coups joués sur {size} × {size}.</p>
        {!resigned && (
          <table>
            <thead><tr><th /><th>{name(1)}</th><th>{name(2)}</th></tr></thead>
            <tbody>
              <tr><td>Territoire</td><td>{sc.territory[1]}</td><td>{sc.territory[2]}</td></tr>
              <tr><td>Prisonniers</td><td>{sc.black - sc.territory[1]}</td><td>{sc.white - komi - sc.territory[2]}</td></tr>
              <tr><td>Komi</td><td>–</td><td>{String(komi).replace('.', ',')}</td></tr>
              <tr><td><b>Total</b></td><td><b>{String(sc.black).replace('.', ',')}</b></td><td><b>{String(sc.white).replace('.', ',')}</b></td></tr>
            </tbody>
          </table>
        )}
        <Board size={size} board={pos.board} marks={{ owner: resigned ? undefined : sc.owner, dead }} />
        <button className="cta" onClick={restart}>Rejouer</button>
      </div>
    );
  }

  return (
    <div>
      <button className="back" onClick={onExit}>‹ Accueil</button>
      {intro && history.length === 1 && <div className="intro">{intro}</div>}
      {strip(2)}
      <Board size={size} board={pos.board} toPlay={pos.toPlay} interactive={phase === 'score' || myTurn} stonesTappable={phase === 'score'} confirmTouch={confirmTouch}
        marks={{ last: pos.lastMove, owner: phase === 'score' ? sc.owner : undefined, dead }} onPlay={onPlay} />
      {strip(1)}
      <p className="hint" aria-live="polite">{thinking && ai ? `${ai.nom} réfléchit…` : msg}</p>
      {phase === 'play' ? (
        <div className="row">
          <button className="btn" onClick={pass} disabled={!myTurn}>Passer</button>
          <button className="btn" onClick={undo} disabled={undoTo < 1}>Annuler</button>
          <button className="btn" onClick={resign} style={resignArm ? { borderColor: 'var(--vermillon)', color: 'var(--vermillon)' } : undefined}>{resignArm ? 'Confirmer ?' : 'Abandonner'}</button>
        </div>
      ) : (
        <>
          <p className="card small">{name(1)} {String(sc.black).replace('.', ',')}, {name(2)} {String(sc.white).replace('.', ',')} (komi compris). Les pierres pâles sont comptées comme mortes.</p>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => { setPhase('play'); setDead(new Set()); setMsg('La partie reprend.'); }}>Reprendre</button>
            <button className="btn primary" onClick={() => setPhase('end')}>Valider le score</button>
          </div>
        </>
      )}
    </div>
  );
}
