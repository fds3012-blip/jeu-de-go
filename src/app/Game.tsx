import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Board } from '../ui/Board';
import { Avatar, Bandeau, BarreActions, BarreAvantage, Coach, CompteurIndices, Icone, ListeCoups } from '../ui/Partie';
import { groupAt, newPosition, play, type Position } from '../go/rules';
import { playAtari, playCapture, playIllegal, playStone, playVictory } from '../ui/sound';
import { hapticCapture, hapticIllegal, hapticStone, hapticVictory } from '../ui/haptics';
import { score } from '../go/score';
import { toLabel } from '../go/coords';
import { bestMove, estimateLead, estimateTerritoire, proposeComptage, type Opponent } from '../engine';
import { EVENTS, secondsSinceOpen, track, trackOnce } from '../data/analytics';
import { gagnerXp } from './xp';
import { supabase } from '../data/supabase';
import { fr } from '../ui/typo';
import { useProfil } from './hooks';
import { useStored } from './settings';
import { carteTerritoire, conseilPasser, passerEnEvidence, coupsJoues, descriptionIndices, descriptionQuiMene, DUREE_QUI_MENE, indicesRestants, INDICES_PAR_PARTIE, libelleAvantage, libelleCoup, messageAtari, messageIndice, metEnAtari, nouveauxAtari, partNoir, phraseQuiMene, QUI_MENE_PAR_PARTIE, quiMeneDisponible, quiMeneRestants } from './partie';
import { CORRIGER_MORTES, EXPLICATION_MORTES, messageComptage, modeComptage } from './partie';
import '../ui/comptage.css';
import { choisirReplique, DUREE_REPLIQUE, type Situation } from './repliques';
import { FinPartie } from '../ui/FinPartie';
import { RecitScore } from '../ui/RecitScore';
import { mouvementsReduits } from '../ui/defilement';
import { recitScore } from './score';
import { Portrait, type Humeur } from '../ui/Portrait';

/** Durée d'une réaction du portrait de l'adversaire (content, surpris), en millisecondes. */
const DUREE_HUMEUR = 1500;
import { battuAccorde } from '../ui/sceaux';
import type { StatsPartie } from './bilan';
import { Revue } from './Revue';
import { REVUE_KEY, sgfDepuisHistorique, type PartieGardee } from './revue';

const REFUS = { occupe: '', ko: "Ko : tu ne peux pas reprendre tout de suite, joue d'abord ailleurs.", suicide: 'Coup interdit : cette pierre serait capturée par elle-même.', 'hors-plateau': '' };
const pierres = (n: number) => `${n} pierre${n > 1 ? 's' : ''}`;
const virgule = (n: number) => String(n).replace('.', ',');
/** Vrai une fois que Mochi a expliqué le mot « atari » (on ne l'explique qu'une fois). */
const ATARI_KEY = 'go.atari-explique.v1';
/** Vrai une fois que le récit du score a expliqué le mot « komi » (#78). */
const KOMI_KEY = 'go.komi-explique.v1';

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
  /** Barre d'avantage contre l'ordi ; cachée pendant la toute première partie (#160, voir equilibrage.ts). */
  avantage?: boolean;
  /** L'ordi passe quand tu passes, frontières fermées (#185, 3 premières parties, voir equilibrage.ts). */ accommodant?: boolean;
}

export function Game({ size, komi, confirmTouch, onExit, opponent: ai, intro, onResult, fin, aiKomi = komi, portrait, celebrer = true, aide = true, avantage = true, accommodant = false }: Props) {
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
  // Humeur du portrait de l'adversaire dans l'en-tête (issue #102) : elle réagit aux prises, puis revient à neutre.
  const [humeur, setHumeur] = useState<{ h: Humeur; n: number }>({ h: 'neutre', n: 0 });
  // Estimation d'avantage, rattachée à la position estimée (une estimation d'une autre position est ignorée).
  const [estimation, setEstimation] = useState<{ pos: Position; lead: number } | null>(null);
  const [estimationKo, setEstimationKo] = useState(false);
  // Libertés à montrer (atari) et zone d'indice : valables pour un seul état de l'historique.
  const [atari, setAtari] = useState<{ len: number; libs: number[] } | null>(null);
  const [indice, setIndice] = useState<{ len: number; p: number } | null>(null);
  const [cherche, setCherche] = useState(false);
  // Indices donnés dans cette partie : limités à 3 contre l'ordi (#35), illimités à deux.
  const [indicesUtilises, setIndicesUtilises] = useState(0);
  // « Qui mène ? » (#94) : carte des territoires et phrase, valables pour un seul état de l'historique, 3 s au plus.
  const [quiMene, setQuiMene] = useState<{ len: number; owner: Int8Array; phrase: string; n: number } | null>(null);
  const [quiMeneCalcul, setQuiMeneCalcul] = useState(false);
  const [quiMeneUtilises, setQuiMeneUtilises] = useState(0);
  const [atariExplique, setAtariExplique] = useStored<boolean>(ATARI_KEY, false);
  const [komiExplique, setKomiExplique] = useStored<boolean>(KOMI_KEY, false);
  // Récit du score (#78) : raconté une fois après « Valider le score », avant l'écran de fin.
  const [recitFini, setRecitFini] = useState(true);
  // Comptage automatique contre l'ordi (#117) : score validé sans passer par la phase manuelle, résultat différé
  // jusqu'à la fin du récit pour que « Corriger les pierres mortes » reste possible.
  const [autoCompte, setAutoCompte] = useState<'non' | 'calcule' | 'oui'>('non');
  const resultatDiffere = useRef<(() => void) | null>(null);
  const profil = useProfil(ai ? supabase : null);
  const token = useRef(0); // invalide les réponses de l'ordi devenues caduques (annulation, sortie)
  const scoreToken = useRef(0); // idem pour les pierres mortes proposées
  const atarisSubis = useRef(0); // tes groupes mis en atari par l'ordi (leçon de Mochi en fin de partie)
  // Revue de la partie terminée (issue #34) : ouverte ou non (le nombre est gardé pour compatibilité), et SGF de la partie.
  const [relecture, setRelecture] = useState<number | null>(null);
  const [sgf, setSgf] = useState<string | null>(null);
  const pos = history[history.length - 1];
  const [conseilPasserA, setConseilPasserA] = useState<number | null>(null); // #120 : longueur d'historique au conseil « passer »
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
    if (humeur.h === 'neutre') return;
    const t = window.setTimeout(() => setHumeur(x => (x.n === humeur.n ? { h: 'neutre', n: x.n } : x)), DUREE_HUMEUR);
    return () => window.clearTimeout(t);
  }, [humeur]);
  const reagir = (h: Humeur) => setHumeur(x => ({ h, n: x.n + 1 }));
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
    bestMove(pos, ai.id, { komi: aiKomi, accommodant }).then(async m => {
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
        else { const c = conseilPasser(ai.nom, aide, true, r.board); if (c) setConseilPasserA(history.length + 1); setMsg(c ?? `${ai.nom} passe. Si tu passes aussi, on compte les points.`); }
      } else {
        const cap = r.captures[2] - pos.captures[2];
        playStone(m, size, true);
        if (cap) { playCapture(cap); repliquer('capture'); reagir('content'); }
        if (metEnAtari(r, m)) playAtari();
        const alerte = cap ? null : alerteAtari(pos, r, 1, history.length + 1);
        if (alerte) atarisSubis.current++;
        const c = cap || alerte ? null : conseilPasser(ai.nom, aide, false, r.board);
        if (c) setConseilPasserA(history.length + 1);
        setMsg(cap ? `${ai.nom} capture ${pierres(cap)} en ${toLabel(m, size)}.` : alerte ?? c ?? `${ai.nom} joue ${toLabel(m, size)}. À toi.`);
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

  // Deux passes : le moteur marque les pierres mortes (grisées). Contre l'ordi, si rien n'est incertain, on va droit
  // au récit du score (#117) ; sinon, et toujours à deux, le joueur corrige d'une touche avant « Valider le score ».
  function enterScore(p: Position, fin: string) {
    const t = ++scoreToken.current;
    setPhase('score'); setDead(new Set()); setFinding(true); setMsg(`${fin} Je cherche les pierres mortes…`);
    proposeComptage(p, komi).then(({ dead: d, incertains }) => {
      if (t !== scoreToken.current) return;
      setFinding(false); setDead(new Set(d));
      if (modeComptage(!!ai, incertains) === 'auto') setAutoCompte('calcule');
      if (modeComptage(!!ai, incertains) !== 'auto') track(EVENTS.comptageManuel, { mode: ai ? 'ordi' : 'deux', adversaire: ai?.id, taille: size, mortes: d.length, incertains: incertains.length });
      else setMsg(messageComptage(fin, d.length, incertains.length > 0));
    });
  }
  // Validation automatique au rendu suivant, quand `dead`, le score et l'historique sont à jour.
  useEffect(() => { if (autoCompte === 'calcule' && phase === 'score') { setAutoCompte('oui'); finish(sc.winner, false, true); } }, [autoCompte]); // eslint-disable-line react-hooks/exhaustive-deps
  function corriger() {
    resultatDiffere.current = null;
    setAutoCompte('non'); setRecitFini(true); setPhase('score'); setMsg(`${EXPLICATION_MORTES} Touche un groupe pour corriger.`);
  }
  function resume() { scoreToken.current++; setFinding(false); setPhase('play'); setDead(new Set()); setAutoCompte('non'); resultatDiffere.current = null; }

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
    if (history.length === 1) track(EVENTS.partieCommencee, { mode: ai ? 'ordi' : 'deux', adversaire: ai?.id, taille: size });
    if (history.length === 1) trackOnce(EVENTS.premierePierre, { secondes: secondsSinceOpen(), mode: ai ? 'ordi' : 'deux', adversaire: ai?.id, taille: size });
    if (ai) {
      if (cap) { repliquer('captureSubie'); reagir('surpris'); }
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
  // « Qui mène ? » (#94) : l'estimation tourne dans un Worker (KataGo s'il est prêt, sinon le moteur simple).
  // Contre l'ordi : 3 fois par partie et seulement si l'aide de Mochi est active. À deux : illimité.
  const avecQuiMene = quiMeneDisponible(!!ai, aide);
  const quiMeneReste = ai ? quiMeneRestants(quiMeneUtilises) : QUI_MENE_PAR_PARTIE;
  const quiMeneVisible = quiMene && quiMene.len === history.length && phase === 'play' ? quiMene : null;
  function quiMeneToucher() {
    // Un nouveau toucher masque la carte (sans rien décompter).
    if (quiMeneVisible) { setQuiMene(null); return; }
    if (quiMeneCalcul || quiMeneReste <= 0) return;
    const len = history.length;
    setQuiMeneCalcul(true);
    // KataGo cherche peut-être le coup de l'ordi : on ne le ralentit pas pendant son tour.
    estimateTerritoire(pos, komi, { kataGo: !thinking }).then(e => {
      setQuiMeneCalcul(false);
      if (len !== history.length) return;
      if (!e) { setMsg("Je n'arrive pas à estimer pour l'instant. Réessaie dans un instant."); return; }
      setQuiMene(q => ({ len, owner: carteTerritoire(e.own), phrase: phraseQuiMene(e.lead, e.engine), n: (q?.n ?? 0) + 1 }));
      if (ai) setQuiMeneUtilises(u => u + 1);
    }, () => { setQuiMeneCalcul(false); setMsg("Je n'arrive pas à estimer pour l'instant. Réessaie dans un instant."); });
  }
  // La carte s'efface au bout de 3 s, ou au prochain toucher n'importe où (sauf sur le bouton, qui la masque lui-même).
  const quiMeneN = quiMeneVisible?.n;
  useEffect(() => {
    if (quiMeneN == null) return;
    const masquer = () => setQuiMene(q => (q?.n === quiMeneN ? null : q));
    const t = window.setTimeout(masquer, DUREE_QUI_MENE);
    const toucher = (e: PointerEvent) => { if (!(e.target instanceof Element && e.target.closest('[data-action="qui-mene"]'))) masquer(); };
    document.addEventListener('pointerdown', toucher, true);
    return () => { window.clearTimeout(t); document.removeEventListener('pointerdown', toucher, true); };
  }, [quiMeneN]);
  // Contre l'ordi, on revient juste avant ton dernier coup : ton coup et la réponse de l'ordi sont repris.
  let undoTo = history.length - 1;
  if (ai) { undoTo = -1; for (let i = history.length - 1; i > 0; i--) if (history[i].toPlay === 2) { undoTo = i; break; } }
  function undo() {
    if (undoTo < 1) return;
    token.current++;
    setThinking(false);
    setHistory(history.slice(0, undoTo)); resume(); setMsg(ai ? 'Coup annulé. À toi de rejouer.' : 'Coup annulé.');
  }
  function finish(winner: 1 | 2, abandon: boolean, differe = false) {
    const egalite = !abandon && sc.margin === 0;
    setPhase('end'); setRelecture(null); setRecitFini(abandon);
    // La partie est gardée en SGF sur ce téléphone, pour la revue (Supabase viendra plus tard).
    const texte = sgfDepuisHistorique(history, komi, { noir: ai ? 'Toi' : 'Noir', blanc: ai?.nom ?? 'Blanc' });
    setSgf(texte);
    try { localStorage.setItem(REVUE_KEY, JSON.stringify({ sgf: texte, adversaire: ai?.id, date: new Date().toISOString() } satisfies PartieGardee)); } catch { /* stockage indisponible */ }
    const resultat = () => onResult?.(egalite ? 0 : winner, {
      coups: history.length - 1, capturesMoi: pos.captures[1], capturesAdv: pos.captures[2], atarisSubis: atarisSubis.current,
      abandon, marge: abandon ? 0 : sc.margin, komi,
    });
    resultatDiffere.current = differe ? resultat : null;
    if (!differe) resultat();
    // Célébration (réglage « Célébrations ») : carillon et vibration ; les confettis sont sur l'écran de fin.
    // Après un comptage, elle attend la fin du récit du score (le résultat n'est pas gâché d'avance).
    if (abandon) celebrerVictoire(winner, egalite);
  }
  function celebrerVictoire(winner: 1 | 2, egalite: boolean) {
    if (celebrer && !egalite && (!ai || winner === 1)) { playVictory(); hapticVictory(); }
  }
  function finRecit() {
    if (recitFini) return;
    setRecitFini(true);
    resultatDiffere.current?.(); resultatDiffere.current = null;
    if (!komiExplique) setKomiExplique(true);
    celebrerVictoire(sc.winner, sc.margin === 0);
  }
  function resign() {
    if (!resignArm) { setResignArm(true); setTimeout(() => setResignArm(false), 3000); return; }
    token.current++;
    const loser = ai ? 1 : pos.toPlay;
    setResigned(loser); finish((3 - loser) as 1 | 2, true);
  }
  /** « Rejouer d'ici » (revue) : la partie reprend, contre le même adversaire, depuis la position choisie. */
  function rejouer(h: Position[]) {
    token.current++; atarisSubis.current = 0; setIndicesUtilises(0); setQuiMeneUtilises(0); setQuiMene(null);
    setHistory(h); resume(); setResigned(0); setThinking(false); setRelecture(null); setSgf(null);
    setMsg(h.length > 1 ? (ai ? 'On reprend ici. À toi de trouver mieux !' : 'On reprend ici.') : ai ? 'Nouvelle partie : tu as Noir, à toi.' : 'Nouvelle partie : Noir commence.');
  }
  function restart() {
    token.current++; atarisSubis.current = 0; setIndicesUtilises(0); setQuiMeneUtilises(0); setQuiMene(null);
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
        portrait={c === 2 && ai ? <Portrait id={ai.id} taille={44} humeur={humeur.h} decoratif signature={false} />
          : c === 2 && portrait ? portrait : <Avatar couleur={c} initiale={initiale} />}
        replique={c === 2 ? replique : null} avant={c === 2 ? retour : undefined} />
    );
  };

  // Mesure : une partie terminée (score validé ou abandon). Ajout isolé pour faciliter les fusions.
  useEffect(() => { if (phase === 'end') track(EVENTS.partieTerminee, { mode: ai ? 'ordi' : 'deux', adversaire: ai?.id, taille: size, coups: history.length - 1, fin: resigned ? 'abandon' : 'score', gagnant: (resigned ? 3 - resigned : sc.winner) === 1 ? 'noir' : 'blanc' }); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  // Progression (issue #109) : la partie terminée rapporte de l'XP, une victoire contre l'ordi davantage
  // (au moins 10 coups : un abandon immédiat ne rapporte rien).
  useEffect(() => { if (phase === 'end' && history.length > 10) gagnerXp(ai && (resigned ? 3 - resigned : sc.winner) === 1 ? 'victoire' : 'partie'); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
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
    if (!abandon && !recitFini) {
      const recit = recitScore(pos, komi, 'japanese', dead);
      const immediat = !celebrer || mouvementsReduits();
      const ownerDelai = immediat ? undefined : new Map(recit.territoire.map(q => [q.p, q.delai]));
      const recitEl = (
        <RecitScore recit={recit} immediat={immediat} expliquerKomi={!komiExplique} adversaire={ai?.nom} onFini={finRecit}
          fond={<Board size={size} board={pos.board} marks={{ owner: sc.owner, ownerDelai, dead, last: pos.lastMove }} />} />
      );
      if (autoCompte !== 'oui') return recitEl;
      // Comptage automatique (#117) : Mochi explique les pierres grisées, la correction reste possible.
      return (
        <div className="recit-auto">
          {recitEl}
          <aside className="comptage-auto" aria-label="Pierres mortes">
            {dead.size > 0 && <p>{fr(EXPLICATION_MORTES)}</p>}
            <button type="button" className="lien lien-discret" onClick={corriger}>{CORRIGER_MORTES}</button>
          </aside>
        </div>
      );
    }
    const bilanDeux = fr(`${n} coup${n > 1 ? 's' : ''} sur ${plateau}. Captures : Noir ${pos.captures[1]}, Blanc ${pos.captures[2]}.`);
    return (
      <FinPartie
        fond={<Board size={size} board={pos.board} marks={{ owner: abandon ? undefined : sc.owner, dead, last: pos.lastMove }} />}
        sceau={ai ? <Portrait id={ai.id} taille={108} decoratif humeur={gagne ? 'surpris' : 'content'} /> : <span className={`fin-pierre ${winner === 1 ? 'b' : 'w'}`} aria-hidden="true" />}
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
      {ai && avantage && !estimationKo && <BarreAvantage libelle={lead === null ? '' : libelleAvantage(lead)} part={lead === null ? 0.5 : partNoir(lead, size)} />}
      <div className="partie-plateau">
        <Board size={size} board={pos.board} toPlay={pos.toPlay} interactive={phase === 'score' || myTurn} stonesTappable={phase === 'score'} confirmTouch={confirmTouch}
          marks={{ last: pos.lastMove, owner: phase === 'score' ? sc.owner : quiMeneVisible?.owner, ownerFondu: !!quiMeneVisible, dead, libs, zone }} onPlay={onPlay} shake={shake} versCouvercles noms={ai ? { 2: ai.nom } : undefined} />
        {quiMeneVisible && <p key={quiMeneVisible.n} className="qui-mene-phrase" role="status">{fr(quiMeneVisible.phrase)}</p>}
      </div>
      {bandeau(1)}
      <div className="partie-souffle" aria-hidden="true" />
      {montrerIntro ? <div className="coach-intro">{intro}</div> : <Coach cle={messageCoach} attente={phase === 'play' && thinking && !!ai}
        humeur={phase === 'play' && thinking && ai ? 'pensif' : humeur.h === 'surpris' ? 'content' : 'neutre'}>{fr(messageCoach)}</Coach>}
      {phase === 'play' ? (
        <BarreActions label="Actions de la partie" actions={[
          { label: cherche ? 'Indice…' : 'Indice', icone: ai ? <CompteurIndices restants={restants}><Icone nom="indice" /></CompteurIndices> : <Icone nom="indice" />,
            onClick: hint, disabled: !myTurn || cherche || restants <= 0, description: ai ? descriptionIndices(restants) : undefined },
          ...(avecQuiMene ? [{ label: fr('Qui mène ?'), action: 'qui-mene',
            icone: ai ? <CompteurIndices restants={quiMeneReste}><Icone nom="quimene" /></CompteurIndices> : <Icone nom="quimene" />,
            onClick: quiMeneToucher, disabled: !quiMeneVisible && (quiMeneCalcul || quiMeneReste <= 0),
            description: ai ? descriptionQuiMene(quiMeneReste) : undefined }] : []),
          { label: 'Annuler', icone: <Icone nom="annuler" />, onClick: undo, disabled: undoTo < 1 },
          { label: 'Passer', icone: <Icone nom="passer" />, onClick: pass, disabled: !myTurn,
            evidence: passerEnEvidence(aide && !!ai, myTurn, pos.lastMove === -1, conseilPasserA, history.length), pulse: celebrer && !mouvementsReduits() },
          { label: resignArm ? fr('Confirmer ?') : 'Abandonner', icone: <Icone nom="abandonner" />, onClick: resign, danger: resignArm },
        ]} />
      ) : (
        <>
          <p className="comptage">{fr(`${name(1)} ${virgule(sc.black)}, ${name(2)} ${virgule(sc.white)} (komi compris). Les pierres grisées sont comptées comme mortes.`)}</p>
          <div className="barre-comptage" role="toolbar" aria-label="Comptage des points">
            <button className="btn" onClick={() => { resume(); setMsg('La partie reprend.'); }}>Reprendre</button>
            <button className="btn primary" onClick={() => finish(sc.winner, false)} disabled={finding}>Valider le score</button>
          </div>
        </>
      )}
    </div>
  );
}
