import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Board } from '../ui/Board';
import { Avatar, Bandeau, BarreActions, BarreAvantage, Coach, CompteurIndices, Icone, ListeCoups } from '../ui/Partie';
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
import { coupsJoues, descriptionIndices, indicesRestants, INDICES_PAR_PARTIE, libelleAvantage, libelleCoup, messageAtari, messageIndice, metEnAtari, nouveauxAtari, partNoir } from './partie';
import { choisirReplique, DUREE_REPLIQUE, type Situation } from './repliques';
import { FinPartie } from '../ui/FinPartie';
import { Sceau } from '../ui/Sceau';
import { battuAccorde } from '../ui/sceaux';
import type { StatsPartie } from './bilan';
import { Revue } from './Revue';
import { REVUE_KEY, sgfDepuisHistorique, type PartieGardee } from './revue';

const REFUS = { occupe: '', ko: "Ko : tu ne peux pas reprendre tout de suite, joue d'abord ailleurs.", suicide: 'Coup interdit : cette pierre serait capturée par elle-même.', 'hors-plateau': '' };
const pierres = (n: number) => `${n} pierre${n > 1 ? 's' : ''}`;
const PALES = "Les pierres pâles sont prisonnières : elles ne peuvent plus s'échapper. Touche un groupe pour corriger.";
const virgule = (n: number) => String(n).replace('.', ',');
/** Vrai une fois que Mochi a expliqué le mot « atari » (on ne l'explique qu'une fois). */
const ATARI_KEY = 'go.atari-explique.v1';

// Sans `opponent` : partie à deux sur le même appareil. Avec : le joueur a Noir, l'ordi joue Blanc.
// `onResult` est appelé une fois à la fin de chaque partie (abandon ou score validé) avec le vainqueur (0 : égalité)
// et ce qu'on sait de la partie (captures, atari subis…), pour le bilan et la leçon de Mochi.
// `fin` complète l'écran de fin (src/ui/FinPartie.tsx) : bilan, leçon de Mochi et action principale choisis par l'écran parent.
interface Props {
  size: number; komi: number; confirmTouch: boolean; onExit: () => void; opponent?: Opponent; intro?: ReactNode;
  onResult?: (winner: 0 | 1 | 2, stats: StatsPartie) => void;
  fin?: { bilan: ReactNode; mochi: ReactNode; action: ReactNode; onAccueil: () => void };
  /** Réglage « Célébrations » : carillon, vibration et confettis après une victoire. */
  celebrer?: boolean;
  /** Komi vu par l'ordi pour choisir ses coups ; par défaut `komi`. Sert au paramètre de test `?komi=` (voir bilan.ts). */
  aiKomi?: number;
  /** Portrait de l'adversaire (44 px), par exemple son sceau. Par défaut : une pierre blanche. */
  portrait?: ReactNode;
  /** Aide de Mochi en partie (contre l'ordi) : alerte d'atari et liberté montrée. Voir aideActive (partie.ts). */
  aide?: boolean;
}

export function Game({ size, komi, confirmTouch, onExit, opponent: ai, intro, onResult, fin, aiKomi = komi, portrait, celebrer = true, aide = true }: Props) {
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
  // Indices donnés dans cette partie : limités à 3 contre l'ordi (#35), illimités à deux.
  const [indicesUtilises, setIndicesUtilises] = useState(0);
  const [atariExplique, setAtariExplique] = useStored<boolean>(ATARI_KEY, false);
  const profil = useProfil(ai ? supabase : null);
  const token = useRef(0); // invalide les réponses de l'ordi devenues caduques (annulation, sortie)
  const scoreToken = useRef(0); // idem pour les pierres mortes proposées
  const atarisSubis = useRef(0); // tes groupes mis en atari par l'ordi (leçon de Mochi en fin de partie)
  // Revue de la partie terminée (issue #34) : ouverte ou non (le nombre est gardé pour compatibilité), et SGF de la partie.
  const [relecture, setRelecture] = useState<number | null>(null);
  const [sgf, setSgf] = useState<string | null>(null);
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
    // Contre l'ordi, l'alerte est l'aide de Mochi (#35) : active contre Pomme et Caillou, réglable dans le Profil.
    if (ai && !aide) return null;
    setAtari({ len, libs: g.map(a => a.liberte) });
    if (ai) {
      const premiere = !atariExplique;
      if (premiere) setAtariExplique(true);
      return messageAtari(premiere);
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
        if (alerte) atarisSubis.current++;
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
  const restants = ai ? indicesRestants(indicesUtilises) : INDICES_PAR_PARTIE;
  function hint() {
    if (!myTurn || cherche || restants <= 0) return;
    const len = history.length;
    setCherche(true);
    setMsg('Je cherche un bon coup…');
    bestMove(pos, 'caillou', { komi }).then(m => {
      setCherche(false);
      if (len !== history.length) return;
      if (m < 0) { setMsg("Je ne vois plus de bon coup : tu peux passer."); return; }
      setIndice({ len, p: m });
      // Seul un indice montré compte ; le dernier, Mochi annonce qu'il n'y en a plus.
      if (ai) setIndicesUtilises(u => u + 1);
      setMsg(ai ? messageIndice(indicesRestants(indicesUtilises + 1)) : messageIndice(1));
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
  function finish(winner: 1 | 2, abandon: boolean) {
    const egalite = !abandon && sc.margin === 0;
    setPhase('end'); setRelecture(null);
    // La partie est gardée en SGF sur ce téléphone, pour la revue (Supabase viendra plus tard).
    const texte = sgfDepuisHistorique(history, komi, { noir: ai ? 'Toi' : 'Noir', blanc: ai?.nom ?? 'Blanc' });
    setSgf(texte);
    try { localStorage.setItem(REVUE_KEY, JSON.stringify({ sgf: texte, adversaire: ai?.id, date: new Date().toISOString() } satisfies PartieGardee)); } catch { /* stockage indisponible */ }
    onResult?.(egalite ? 0 : winner, {
      coups: history.length - 1, capturesMoi: pos.captures[1], capturesAdv: pos.captures[2], atarisSubis: atarisSubis.current,
      abandon, marge: abandon ? 0 : sc.margin, komi,
    });
    // Célébration (réglage « Célébrations ») : carillon et vibration ; les confettis sont sur l'écran de fin.
    if (celebrer && !egalite && (!ai || winner === 1)) { playVictory(); hapticVictory(); }
  }
  function resign() {
    if (!resignArm) { setResignArm(true); setTimeout(() => setResignArm(false), 3000); return; }
    token.current++;
    const loser = ai ? 1 : pos.toPlay;
    setResigned(loser); finish((3 - loser) as 1 | 2, true);
  }
  /** « Rejouer d'ici » (revue) : la partie reprend, contre le même adversaire, depuis la position choisie. */
  function rejouer(h: Position[]) {
    token.current++; atarisSubis.current = 0; setIndicesUtilises(0);
    setHistory(h); resume(); setResigned(0); setThinking(false); setRelecture(null); setSgf(null);
    setMsg(h.length > 1 ? (ai ? 'On reprend ici. À toi de trouver mieux !' : 'On reprend ici.') : ai ? 'Nouvelle partie : tu as Noir, à toi.' : 'Nouvelle partie : Noir commence.');
  }
  function restart() {
    token.current++; atarisSubis.current = 0; setIndicesUtilises(0);
    setHistory([newPosition(size)]); resume(); setResigned(0); setThinking(false); setRelecture(null);
    setMsg(ai ? `Nouvelle partie : tu as Noir, à toi.` : 'Nouvelle partie : Noir commence.');
  }

  const name = (c: 1 | 2) => (ai ? (c === 1 ? 'Toi' : ai.nom) : c === 1 ? 'Noir' : 'Blanc');
  const retourAccueil = <button type="button" className="retour" onClick={onExit} aria-label="Retour à l'accueil">‹</button>;
  // En relecture, on montre la position `q` et « ‹ » ramène au bilan.
  const bandeau = (c: 1 | 2, q: Position = pos, retour: ReactNode = retourAccueil, actif = phase === 'play' && q.toPlay === c) => {
    let sousTitre: string;
    if (c === 2) sousTitre = ai ? ai.rang : `komi ${virgule(komi)}`;
    else sousTitre = ai ? (profil ? `Noir, cote ${profil.cote}` : 'Noir') : 'joue en premier';
    const initiale = c === 1 && profil?.pseudo ? profil.pseudo[0] : undefined;
    return (
      <Bandeau nom={name(c)} sousTitre={sousTitre} actif={actif} captures={q.captures[c]} pierresPrises={c === 1 ? 'blanc' : 'noir'}
        portrait={c === 2 && portrait ? portrait : <Avatar couleur={c} initiale={initiale} />}
        replique={c === 2 ? replique : null} avant={c === 2 ? retour : undefined} />
    );
  };

  // Mesure : une partie terminée (score validé ou abandon). Ajout isolé pour faciliter les fusions.
  useEffect(() => { if (phase === 'end') track(EVENTS.partieTerminee, { mode: ai ? 'ordi' : 'deux', adversaire: ai?.id, taille: size, coups: history.length - 1, fin: resigned ? 'abandon' : 'score', gagnant: (resigned ? 3 - resigned : sc.winner) === 1 ? 'noir' : 'blanc' }); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  // Première partie contre l'ordi menée jusqu'au score ou à l'abandon : une seule fois par appareil (trackOnce, #35).
  useEffect(() => { if (phase === 'end' && ai) trackOnce(EVENTS.premierePartieTerminee, { adversaire: ai.id, taille: size, coups: history.length - 1, fin: resigned ? 'abandon' : 'score', indices: indicesUtilises, secondes: secondsSinceOpen() }); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'end' && relecture !== null && sgf) {
    // Revue de la partie (issue #34) : erreurs, courbe d'avantage, « Rejouer d'ici ».
    return <Revue sgf={sgf} joueur={ai ? 1 : null} adversaire={ai?.nom} onRetour={() => setRelecture(null)} onRejouer={rejouer} />;
  }

  if (phase === 'end') {
    const abandon = !!resigned;
    const winner = resigned ? (3 - resigned) as 1 | 2 : sc.winner;
    const egalite = !abandon && sc.margin === 0;
    const gagne = !egalite && (!ai || winner === 1);
    const titre = egalite ? 'Égalité' : ai ? (winner === 1 ? 'Victoire' : 'Défaite') : `${name(winner)} gagne`;
    const plateau = `${size} × ${size}`;
    const n = history.length - 1;
    const bilanDeux = fr(`${n} coup${n > 1 ? 's' : ''} sur ${plateau}. Captures : Noir ${pos.captures[1]}, Blanc ${pos.captures[2]}.`);
    return (
      <FinPartie
        fond={<Board size={size} board={pos.board} marks={{ owner: abandon ? undefined : sc.owner, dead, last: pos.lastMove }} />}
        sceau={ai ? <Sceau id={ai.id} taille={108} /> : <span className={`fin-pierre ${winner === 1 ? 'b' : 'w'}`} aria-hidden="true" />}
        tampon={ai && gagne ? battuAccorde(ai.id).toUpperCase() : null}
        titre={titre}
        marge={abandon || egalite ? null : sc.margin}
        texteMarge={v => `de ${virgule(v)} point${v >= 2 ? 's' : ''} sur ${plateau}`}
        sousTitre={abandon ? 'par abandon' : `sur ${plateau}, komi compris`}
        bilan={fin?.bilan ?? bilanDeux}
        mochi={fin?.mochi}
        action={fin?.action ?? <button type="button" className="cta" onClick={restart}>Rejouer</button>}
        onRevoir={n > 0 ? () => setRelecture(1) : undefined}
        onAccueil={fin?.onAccueil ?? onExit}
        confettis={celebrer && gagne}
      />
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
      <div className="partie-souffle" aria-hidden="true" />
      {montrerIntro ? <div className="coach-intro">{intro}</div> : <Coach cle={messageCoach} attente={phase === 'play' && thinking && !!ai}>{fr(messageCoach)}</Coach>}
      {phase === 'play' ? (
        <BarreActions label="Actions de la partie" actions={[
          { label: cherche ? 'Indice…' : 'Indice', icone: ai ? <CompteurIndices restants={restants}><Icone nom="indice" /></CompteurIndices> : <Icone nom="indice" />,
            onClick: hint, disabled: !myTurn || cherche || restants <= 0, description: ai ? descriptionIndices(restants) : undefined },
          { label: 'Annuler', icone: <Icone nom="annuler" />, onClick: undo, disabled: undoTo < 1 },
          { label: 'Passer', icone: <Icone nom="passer" />, onClick: pass, disabled: !myTurn },
          { label: resignArm ? fr('Confirmer ?') : 'Abandonner', icone: <Icone nom="abandonner" />, onClick: resign, danger: resignArm },
        ]} />
      ) : (
        <>
          <p className="comptage">{fr(`${name(1)} ${virgule(sc.black)}, ${name(2)} ${virgule(sc.white)} (komi compris). Les pierres pâles sont comptées comme mortes.`)}</p>
          <div className="barre-comptage" role="toolbar" aria-label="Comptage des points">
            <button className="btn" onClick={() => { resume(); setMsg('La partie reprend.'); }}>Reprendre</button>
            <button className="btn primary" onClick={() => finish(sc.winner, false)} disabled={finding}>Valider le score</button>
          </div>
        </>
      )}
    </div>
  );
}
