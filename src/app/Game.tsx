import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Board } from '../ui/Board';
import { Avatar, Bandeau, BarreActions, BarreAvantage, Coach, Icone, ListeCoups } from '../ui/Partie';
import { groupAt, newPosition, play, type Position } from '../go/rules';
import { playAtari, playCapture, playIllegal, playStone, playVictory } from '../ui/sound';
import { hapticCapture, hapticIllegal, hapticStone, hapticVictory } from '../ui/haptics';
import { score } from '../go/score';
import { toLabel } from '../go/coords';
import { bestMove, estimateLead, proposeDead, type Opponent } from '../engine';
import { EVENTS, secondsSinceOpen, track, trackOnce } from '../data/analytics';
import { supabase } from '../data/supabase';
import { fr } from '../ui/typo';
import { useProfil } from './hooks';
import { useStored } from './settings';
import { coupsJoues, libelleAvantage, libelleCoup, metEnAtari, nouveauxAtari, partNoir } from './partie';
import { choisirReplique, DUREE_REPLIQUE, type Situation } from './repliques';

const REFUS = { occupe: '', ko: "Ko : tu ne peux pas reprendre tout de suite, joue d'abord ailleurs.", suicide: 'Coup interdit : cette pierre serait capturée par elle-même.', 'hors-plateau': '' };
const pierres = (n: number) => `${n} pierre${n > 1 ? 's' : ''}`;
const PALES = "Les pierres pâles sont prisonnières : elles ne peuvent plus s'échapper. Touche un groupe pour corriger.";
const virgule = (n: number) => String(n).replace('.', ',');
/** Vrai une fois que Mochi a expliqué le mot « atari » (on ne l'explique qu'une fois). */
const ATARI_KEY = 'go.atari-explique.v1';

// Sans `opponent` : partie à deux sur le même appareil. Avec : le joueur a Noir, l'ordi joue Blanc.
// `onResult` est appelé une fois à la fin de chaque partie (abandon ou score validé) avec le vainqueur.
// `fin` remplace le bouton « Rejouer » de l'écran de fin : phrase de Mochi et actions choisies par l'écran parent.
interface Props {
  size: number; komi: number; confirmTouch: boolean; onExit: () => void; opponent?: Opponent; intro?: ReactNode;
  onResult?: (winner: 1 | 2) => void; fin?: { mochi: ReactNode; actions: ReactNode };
  /** Komi vu par l'ordi pour choisir ses coups ; par défaut `komi`. Sert au paramètre de test `?komi=` (voir bilan.ts). */
  aiKomi?: number;
  /** Portrait de l'adversaire (44 px), par exemple son sceau. Par défaut : une pierre blanche. */
  portrait?: ReactNode;
}

export function Game({ size, komi, confirmTouch, onExit, opponent: ai, intro, onResult, fin, aiKomi = komi, portrait }: Props) {
  const [history, setHistory] = useState<Position[]>(() => [newPosition(size)]);
  const [phase, setPhase] = useState<'play' | 'score' | 'end'>('play');
  const [dead, setDead] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState(ai ? `Tu as Noir, ${ai.nom} a Blanc. Touche une intersection pour jouer.` : 'Noir commence. Touche une intersection, puis touche-la à nouveau pour confirmer.');
  const [resignArm, setResignArm] = useState(false);
  const [resigned, setResigned] = useState<0 | 1 | 2>(0);
  const [thinking, setThinking] = useState(false);
  const [finding, setFinding] = useState(false);
  const [shake, setShake] = useState<{ p: number; n: number } | null>(null); // coup interdit : la pierre fantôme tremble
  const [replique, setReplique] = useState<{ texte: string; n: number } | null>(null);
  // Estimation d'avantage, rattachée à la position estimée (une estimation d'une autre position est ignorée).
  const [estimation, setEstimation] = useState<{ pos: Position; lead: number } | null>(null);
  const [estimationKo, setEstimationKo] = useState(false);
  // Libertés à montrer (atari) et zone d'indice : valables pour un seul état de l'historique.
  const [atari, setAtari] = useState<{ len: number; libs: number[] } | null>(null);
  const [indice, setIndice] = useState<{ len: number; p: number } | null>(null);
  const [cherche, setCherche] = useState(false);
  const [atariExplique, setAtariExplique] = useStored<boolean>(ATARI_KEY, false);
  const profil = useProfil(ai ? supabase : null);
  const token = useRef(0); // invalide les réponses de l'ordi devenues caduques (annulation, sortie)
  const scoreToken = useRef(0); // idem pour les pierres mortes proposées
  const pos = history[history.length - 1];
  const sc = useMemo(() => score(pos, komi, 'japanese', dead), [pos, komi, dead]);
  const aiTurn = !!ai && phase === 'play' && pos.toPlay === 2;
  const myTurn = !ai || (pos.toPlay === 1 && !thinking);
  const coups = useMemo(() => coupsJoues(history).map((m, i) => libelleCoup(i + 1, m, size)), [history, size]);

  function repliquer(s: Situation) {
    if (!ai) return;
    setReplique(r => ({ texte: choisirReplique(ai.id, s, r?.texte), n: (r?.n ?? 0) + 1 }));
  }
  // La réplique s'efface au bout de 3 s.
  useEffect(() => {
    if (!replique) return;
    const t = window.setTimeout(() => setReplique(r => (r?.n === replique.n ? null : r)), DUREE_REPLIQUE);
    return () => window.clearTimeout(t);
  }, [replique]);

  /** Message d'atari quand le coup qui vient d'être joué met en atari un groupe de `c`. */
  function alerteAtari(avant: Position, apres: Position, c: 1 | 2, len: number): string | null {
    const g = nouveauxAtari(avant.board, apres.board, size, c);
    if (!g.length) return null;
    setAtari({ len, libs: g.map(a => a.liberte) });
    if (ai) {
      const premiere = !atariExplique;
      if (premiere) setAtariExplique(true);
      return premiere
        ? `Atari ! Ton groupe n'a plus qu'une liberté, le point vert. On dit « atari » : si ${ai.nom} joue là, il capture ton groupe.`
        : "Atari ! Ton groupe n'a plus qu'une liberté.";
    }
    return `Atari ! Un groupe ${c === 1 ? 'noir' : 'blanc'} n'a plus qu'une liberté, le point vert.`;
  }

  // Tour de l'ordi : on demande un coup au moteur (dans un Web Worker), puis on le joue.
  useEffect(() => {
    if (!ai || !aiTurn) return;
    const jeton = token; // même objet ref ; alias pour la fonction de nettoyage
    const t = ++jeton.current, t0 = Date.now();
    setThinking(true);
    bestMove(pos, ai.id, { komi: aiKomi }).then(async m => {
      const wait = 350 - (Date.now() - t0); // petite pause pour que la réponse ne paraisse pas instantanée
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      if (t !== token.current) return;
      setThinking(false);
      const r = play(pos, m);
      if (typeof r === 'string') return;
      setHistory(h => [...h, r]);
      if (m === -1) {
        repliquer('passe');
        if (pos.lastMove === -1) enterScore(r, `${ai.nom} passe aussi : la partie est finie.`);
        else setMsg(`${ai.nom} passe. Si tu passes aussi, on compte les points.`);
      } else {
        const cap = r.captures[2] - pos.captures[2];
        playStone(m, size, true);
        if (cap) { playCapture(cap); repliquer('capture'); }
        if (metEnAtari(r, m)) playAtari();
        const alerte = cap ? null : alerteAtari(pos, r, 1, history.length + 1);
        setMsg(cap ? `${ai.nom} capture ${pierres(cap)} en ${toLabel(m, size)}.` : alerte ?? `${ai.nom} joue ${toLabel(m, size)}. À toi.`);
      }
    });
    return () => { jeton.current++; setThinking(false); };
  }, [ai, aiTurn, pos, aiKomi, size]); // eslint-disable-line react-hooks/exhaustive-deps

  // Barre d'avantage (contre l'ordi) : estimation dans un Worker après chaque coup, sans bloquer l'interface.
  useEffect(() => {
    if (!ai || phase !== 'play') return;
    let alive = true;
    estimateLead(pos, komi, { kataGo: pos.toPlay === 1 }).then(e => {
      if (!alive) return;
      if (e) setEstimation({ pos, lead: e.lead });
      else setEstimationKo(true);
    }, () => { if (alive) setEstimationKo(true); });
    return () => { alive = false; };
  }, [ai, pos, komi, phase]);

  // Deux passes : on passe au comptage et le moteur propose les pierres mortes (pâles), que le joueur corrige d'une touche.
  function enterScore(p: Position, fin: string) {
    const t = ++scoreToken.current;
    setPhase('score'); setDead(new Set()); setFinding(true); setMsg(`${fin} Je cherche les pierres prisonnières…`);
    proposeDead(p).then(d => {
      if (t !== scoreToken.current) return;
      setFinding(false); setDead(new Set(d));
      setMsg(d.length ? PALES : `${fin} Aucune pierre prisonnière. Si un groupe est mort, touche-le pour le retirer.`);
    });
  }
  function resume() { scoreToken.current++; setFinding(false); setPhase('play'); setDead(new Set()); }

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
    if (typeof r === 'string') {
      if (REFUS[r]) { setMsg(REFUS[r]); playIllegal(); hapticIllegal(); setShake(s => ({ p, n: (s?.n ?? 0) + 1 })); }
      return;
    }
    const cap = r.captures[pos.toPlay] - pos.captures[pos.toPlay];
    playStone(p, size); hapticStone();
    if (cap) { playCapture(cap); hapticCapture(); }
    const enAtari = metEnAtari(r, p);
    if (!ai && enAtari) playAtari();
    setHistory([...history, r]);
    if (history.length === 1) trackOnce(EVENTS.premierePierre, { secondes: secondsSinceOpen(), mode: ai ? 'ordi' : 'deux', adversaire: ai?.id, taille: size });
    if (ai) {
      if (cap) repliquer('captureSubie');
      else if (enAtari) repliquer('atariSubi');
      setMsg(cap ? `Bravo, tu captures ${pierres(cap)} !` : `Tu joues ${toLabel(p, size)}.`);
    } else {
      const alerte = cap ? null : alerteAtari(pos, r, r.toPlay, history.length + 1);
      setMsg(cap ? `${pos.toPlay === 1 ? 'Noir' : 'Blanc'} capture ${pierres(cap)}.` : alerte ?? `${r.toPlay === 1 ? 'Noir' : 'Blanc'} joue. Dernier coup : ${toLabel(p, size)}.`);
    }
  }
  function pass() {
    if (!myTurn) return;
    const r = play(pos, -1) as Position;
    setHistory([...history, r]);
    if (pos.lastMove === -1) enterScore(r, 'Deux passes : la partie est finie.');
    else if (ai) { repliquer('passeJoueur'); setMsg(`Tu passes. Si ${ai.nom} passe aussi, on compte les points.`); }
    else setMsg(`${pos.toPlay === 1 ? 'Noir' : 'Blanc'} passe. Si ${r.toPlay === 1 ? 'Noir' : 'Blanc'} passe aussi, on compte les points.`);
  }
  // Indice : le moteur cherche un bon coup (niveau Caillou, dans son Worker) et on entoure la zone où il se trouve.
  function hint() {
    if (!myTurn || cherche) return;
    const len = history.length;
    setCherche(true);
    setMsg('Je cherche un bon coup…');
    bestMove(pos, 'caillou', { komi }).then(m => {
      setCherche(false);
      if (len !== history.length) return;
      if (m < 0) { setMsg("Je ne vois plus de bon coup : tu peux passer."); return; }
      setIndice({ len, p: m });
      setMsg('Regarde dans le cercle vert : il y a un bon coup.');
    }, () => { setCherche(false); setMsg("Pas d'indice pour l'instant. Réessaie dans un instant."); });
  }
  // Contre l'ordi, on revient juste avant ton dernier coup : ton coup et la réponse de l'ordi sont repris.
  let undoTo = history.length - 1;
  if (ai) { undoTo = -1; for (let i = history.length - 1; i > 0; i--) if (history[i].toPlay === 2) { undoTo = i; break; } }
  function undo() {
    if (undoTo < 1) return;
    token.current++;
    setThinking(false);
    setHistory(history.slice(0, undoTo)); resume(); setMsg(ai ? 'Coup annulé. À toi de rejouer.' : 'Coup annulé.');
  }
  function finish(winner: 1 | 2) {
    setPhase('end'); onResult?.(winner);
    if (!ai || winner === 1) { playVictory(); hapticVictory(); }
  }
  function resign() {
    if (!resignArm) { setResignArm(true); setTimeout(() => setResignArm(false), 3000); return; }
    token.current++;
    const loser = ai ? 1 : pos.toPlay;
    setResigned(loser); finish((3 - loser) as 1 | 2);
  }
  function restart() {
    token.current++;
    setHistory([newPosition(size)]); resume(); setResigned(0); setThinking(false);
    setMsg(ai ? `Nouvelle partie : tu as Noir, à toi.` : 'Nouvelle partie : Noir commence.');
  }

  const name = (c: 1 | 2) => (ai ? (c === 1 ? 'Toi' : ai.nom) : c === 1 ? 'Noir' : 'Blanc');
  const retour = <button type="button" className="retour" onClick={onExit} aria-label="Retour à l'accueil">‹</button>;
  const bandeau = (c: 1 | 2) => {
    const actif = phase === 'play' && pos.toPlay === c;
    let sousTitre: string;
    if (c === 2) sousTitre = ai ? ai.rang : `komi ${virgule(komi)}`;
    else sousTitre = ai ? (profil ? `Noir, cote ${profil.cote}` : 'Noir') : 'joue en premier';
    const initiale = c === 1 && profil?.pseudo ? profil.pseudo[0] : undefined;
    return (
      <Bandeau nom={name(c)} sousTitre={sousTitre} actif={actif} captures={pos.captures[c]} pierresPrises={c === 1 ? 'blanc' : 'noir'}
        portrait={c === 2 && portrait ? portrait : <Avatar couleur={c} initiale={initiale} />}
        replique={c === 2 ? replique : null} avant={c === 2 ? retour : undefined} />
    );
  };

  // Mesure : une partie terminée (score validé ou abandon). Ajout isolé pour faciliter les fusions.
  useEffect(() => { if (phase === 'end') track(EVENTS.partieTerminee, { mode: ai ? 'ordi' : 'deux', adversaire: ai?.id, taille: size, coups: history.length - 1, fin: resigned ? 'abandon' : 'score', gagnant: (resigned ? 3 - resigned : sc.winner) === 1 ? 'noir' : 'blanc' }); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'end') {
    const winner = resigned ? (3 - resigned) as 1 | 2 : sc.winner;
    const how = resigned ? 'par abandon' : `de ${virgule(sc.margin)} point${sc.margin >= 2 ? 's' : ''}`;
    return (
      <div className="partie">
        {!fin && <button className="back" onClick={onExit}>‹ Accueil</button>}
        <p className="big">{ai && winner === 1 ? 'Tu gagnes' : `${name(winner)} gagne`} {how}</p>
        <p className="muted">{history.length - 1} coups joués sur {size} × {size}.</p>
        {fin && <div aria-live="polite">{fin.mochi}</div>}
        {!resigned && (
          <table>
            <thead><tr><th /><th>{name(1)}</th><th>{name(2)}</th></tr></thead>
            <tbody>
              <tr><td>Territoire</td><td>{sc.territory[1]}</td><td>{sc.territory[2]}</td></tr>
              <tr><td>Prisonniers</td><td>{sc.black - sc.territory[1]}</td><td>{sc.white - komi - sc.territory[2]}</td></tr>
              <tr><td>Komi</td><td>–</td><td>{virgule(komi)}</td></tr>
              <tr><td><b>Total</b></td><td><b>{virgule(sc.black)}</b></td><td><b>{virgule(sc.white)}</b></td></tr>
            </tbody>
          </table>
        )}
        <div className="partie-plateau" style={{ marginTop: 12 }}>
          <Board size={size} board={pos.board} marks={{ owner: resigned ? undefined : sc.owner, dead }} />
        </div>
        {fin ? <><div className="fin-espace" aria-hidden="true" />{fin.actions}</> : <button className="cta" onClick={restart}>Rejouer</button>}
      </div>
    );
  }

  const lead = estimation && ai ? estimation.lead : null;
  const libs = atari && atari.len === history.length && phase === 'play' ? atari.libs : undefined;
  const zone = indice && indice.len === history.length && phase === 'play' ? indice.p : undefined;
  const messageCoach = phase === 'play' && thinking && ai ? `${ai.nom} réfléchit…` : msg;
  const montrerIntro = intro && history.length === 1 && phase === 'play';

  return (
    <div className="partie">
      {bandeau(2)}
      <ListeCoups coups={coups} />
      {ai && !estimationKo && <BarreAvantage libelle={lead === null ? '' : libelleAvantage(lead)} part={lead === null ? 0.5 : partNoir(lead, size)} />}
      <div className="partie-plateau">
        <Board size={size} board={pos.board} toPlay={pos.toPlay} interactive={phase === 'score' || myTurn} stonesTappable={phase === 'score'} confirmTouch={confirmTouch}
          marks={{ last: pos.lastMove, owner: phase === 'score' ? sc.owner : undefined, dead, libs, zone }} onPlay={onPlay} shake={shake} versCouvercles />
      </div>
      {bandeau(1)}
      {montrerIntro ? <div className="coach-intro">{intro}</div> : <Coach cle={messageCoach}>{fr(messageCoach)}</Coach>}
      {phase === 'play' ? (
        <BarreActions label="Actions de la partie" actions={[
          { label: cherche ? 'Indice…' : 'Indice', icone: <Icone nom="indice" />, onClick: hint, disabled: !myTurn || cherche },
          { label: 'Annuler', icone: <Icone nom="annuler" />, onClick: undo, disabled: undoTo < 1 },
          { label: 'Passer', icone: <Icone nom="passer" />, onClick: pass, disabled: !myTurn },
          { label: resignArm ? fr('Confirmer ?') : 'Abandonner', icone: <Icone nom="abandonner" />, onClick: resign, danger: resignArm },
        ]} />
      ) : (
        <>
          <p className="comptage">{fr(`${name(1)} ${virgule(sc.black)}, ${name(2)} ${virgule(sc.white)} (komi compris). Les pierres pâles sont comptées comme mortes.`)}</p>
          <div className="barre-comptage" role="toolbar" aria-label="Comptage des points">
            <button className="btn" onClick={() => { resume(); setMsg('La partie reprend.'); }}>Reprendre</button>
            <button className="btn primary" onClick={() => finish(sc.winner)} disabled={finding}>Valider le score</button>
          </div>
        </>
      )}
    </div>
  );
}
