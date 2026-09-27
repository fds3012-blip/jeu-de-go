import { useMemo, useState } from 'react';
import { Board } from '../ui/Board';
import { groupAt, newPosition, play, type Position } from '../go/rules';
import { score } from '../go/score';
import { toLabel } from '../go/coords';

const REFUS = { occupe: '', ko: "Ko : tu ne peux pas reprendre tout de suite, joue d'abord ailleurs.", suicide: 'Coup interdit : cette pierre serait capturée par elle-même.', 'hors-plateau': '' };

interface Props { size: number; komi: number; confirmTouch: boolean; onExit: () => void }

export function Game({ size, komi, confirmTouch, onExit }: Props) {
  const [history, setHistory] = useState<Position[]>(() => [newPosition(size)]);
  const [phase, setPhase] = useState<'play' | 'score' | 'end'>('play');
  const [dead, setDead] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState('Noir commence. Touche une intersection, puis touche-la à nouveau pour confirmer.');
  const [resignArm, setResignArm] = useState(false);
  const [resigned, setResigned] = useState<0 | 1 | 2>(0);
  const pos = history[history.length - 1];
  const sc = useMemo(() => score(pos, komi, 'japanese', dead), [pos, komi, dead]);

  function onPlay(p: number) {
    if (phase === 'score') {
      if (!pos.board[p]) return;
      const g = groupAt(pos.board, size, p), next = new Set(dead), isDead = dead.has(p);
      for (const s of g.stones) isDead ? next.delete(s) : next.add(s);
      setDead(next);
      return;
    }
    if (phase !== 'play') return;
    const r = play(pos, p);
    if (typeof r === 'string') { if (REFUS[r]) setMsg(REFUS[r]); return; }
    const cap = r.captures[pos.toPlay] - pos.captures[pos.toPlay];
    setHistory([...history, r]);
    setMsg(cap ? `${pos.toPlay === 1 ? 'Noir' : 'Blanc'} capture ${cap} pierre${cap > 1 ? 's' : ''}.` : `${r.toPlay === 1 ? 'Noir' : 'Blanc'} joue. Dernier coup : ${toLabel(p, size)}.`);
  }
  function pass() {
    const r = play(pos, -1) as Position;
    const next = [...history, r];
    setHistory(next);
    if (pos.lastMove === -1) { setPhase('score'); setMsg('Deux passes : la partie est finie. Touche les groupes morts pour les retirer, puis valide.'); }
    else setMsg(`${pos.toPlay === 1 ? 'Noir' : 'Blanc'} passe. Si ${r.toPlay === 1 ? 'Noir' : 'Blanc'} passe aussi, on compte les points.`);
  }
  function undo() {
    if (history.length < 2) return;
    setHistory(history.slice(0, -1)); setPhase('play'); setDead(new Set()); setMsg('Coup annulé.');
  }
  function resign() {
    if (!resignArm) { setResignArm(true); setTimeout(() => setResignArm(false), 3000); return; }
    setResigned(pos.toPlay); setPhase('end');
  }

  const strip = (c: 1 | 2) => (
    <div className={`strip ${phase === 'play' && pos.toPlay === c ? 'active' : ''}`}>
      <span className={`stone ${c === 1 ? 'b' : 'w'}`} />
      <span><b>{c === 1 ? 'Noir' : 'Blanc'}</b><small>{c === 2 ? `komi ${String(komi).replace('.', ',')}` : 'commence'}</small></span>
      <span className="caps">{pos.captures[c]} prisonnier{pos.captures[c] > 1 ? 's' : ''}</span>
    </div>
  );

  if (phase === 'end') {
    const winner = resigned ? (3 - resigned) : sc.winner;
    const how = resigned ? 'par abandon' : `de ${String(sc.margin).replace('.', ',')} point${sc.margin >= 2 ? 's' : ''}`;
    return (
      <div>
        <button className="back" onClick={onExit}>‹ Accueil</button>
        <p className="big">{winner === 1 ? 'Noir' : 'Blanc'} gagne {how}</p>
        <p className="muted">{history.length - 1} coups joués sur {size} × {size}.</p>
        {!resigned && (
          <table>
            <thead><tr><th /><th>Noir</th><th>Blanc</th></tr></thead>
            <tbody>
              <tr><td>Territoire</td><td>{sc.territory[1]}</td><td>{sc.territory[2]}</td></tr>
              <tr><td>Prisonniers</td><td>{sc.black - sc.territory[1]}</td><td>{sc.white - komi - sc.territory[2]}</td></tr>
              <tr><td>Komi</td><td>–</td><td>{String(komi).replace('.', ',')}</td></tr>
              <tr><td><b>Total</b></td><td><b>{String(sc.black).replace('.', ',')}</b></td><td><b>{String(sc.white).replace('.', ',')}</b></td></tr>
            </tbody>
          </table>
        )}
        <Board size={size} board={pos.board} marks={{ owner: resigned ? undefined : sc.owner, dead }} />
        <button className="cta" onClick={() => { setHistory([newPosition(size)]); setPhase('play'); setDead(new Set()); setResigned(0); setMsg('Nouvelle partie : Noir commence.'); }}>Rejouer</button>
      </div>
    );
  }

  return (
    <div>
      <button className="back" onClick={onExit}>‹ Accueil</button>
      {strip(2)}
      <Board size={size} board={pos.board} toPlay={pos.toPlay} interactive stonesTappable={phase === 'score'} confirmTouch={confirmTouch}
        marks={{ last: pos.lastMove, owner: phase === 'score' ? sc.owner : undefined, dead }} onPlay={onPlay} />
      {strip(1)}
      <p className="hint" aria-live="polite">{msg}</p>
      {phase === 'play' ? (
        <div className="row">
          <button className="btn" onClick={pass}>Passer</button>
          <button className="btn" onClick={undo} disabled={history.length < 2}>Annuler</button>
          <button className="btn" onClick={resign} style={resignArm ? { borderColor: 'var(--vermillon)', color: 'var(--vermillon)' } : undefined}>{resignArm ? 'Confirmer ?' : 'Abandonner'}</button>
        </div>
      ) : (
        <>
          <p className="card small">Noir {String(sc.black).replace('.', ',')}, Blanc {String(sc.white).replace('.', ',')} (komi compris). Les pierres pâles sont comptées comme mortes.</p>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => { setPhase('play'); setDead(new Set()); setMsg('La partie reprend.'); }}>Reprendre</button>
            <button className="btn primary" onClick={() => setPhase('end')}>Valider le score</button>
          </div>
        </>
      )}
    </div>
  );
}
