import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Board } from '../ui/Board';
import { Avatar, Bandeau, BarreActions, BarreAvantage, ChoixMochi, Coach, CompteurIndices, Icone, ListeCoups } from '../ui/Partie';
import { groupAt, newPosition, play, type Position } from '../go/rules';
import { playAtari, playCapture, playDefeat, playIllegal, playStone, playVictory } from '../ui/sound';
import { hapticAtari, hapticCapture, hapticDefeat, hapticIllegal, hapticStone, hapticVictory } from '../ui/haptics';
import { score } from '../go/score';
import { toLabel } from '../go/coords';
import { bestMove, bestMoveExplique, estimateLead, estimateTerritoire, forceInitiale, niveauGuide, PERIODE_GUIDEE, proposeComptage, reglerForce, type Opponent } from '../engine';
import { EVENTS, secondsSinceOpen, track, trackOnce } from '../data/analytics';
import { gagnerXp, sourceXpPartie, type SourceXp } from './xp';
import { supabase } from '../data/supabase';
import { fr } from '../ui/typo';
import { nombre as virgule, t as tr } from '../content/i18n';
import { useProfil } from './hooks';
import { useStored } from './settings';
import { carteTerritoire, conseilPasser, passerEnEvidence, coupsJoues, descriptionIndices, descriptionQuiMene, DUREE_QUI_MENE, indicesRestants, INDICES_PAR_PARTIE, libelleAvantage, libelleCoup, messageAtari, messageIndice, metEnAtari, nouveauxAtari, partNoir, phraseQuiMene, QUI_MENE_PAR_PARTIE, quiMeneDisponible, quiMeneRestants } from './partie';
import { messageComptage, modeComptage } from './partie';
import { avanceBarre, avertirAvantPasse, frontieresAuPasse, frontieresVisibles, type AlerteFrontieres } from './partie';
import '../ui/comptage.css';
import { choisirReplique, DUREE_REPLIQUE, type Situation } from './repliques';
import { FinPartie } from '../ui/FinPartie';
import { ProposerInstallation } from '../ui/ProposerInstallation';
import { noterVictoire } from './installation';
import { RecitScore } from '../ui/RecitScore';
import { mouvementsReduits } from '../ui/defilement';
import { conseil as conseilMochi, phraseConseil } from '../engine/conseil';
import { PortraitMochi } from '../ui/Portrait';
import { recitScore } from './score';
import { Portrait, type Humeur } from '../ui/Portrait';

/** Durée d'une réaction du portrait de l'adversaire (content, surpris), en millisecondes. */
const DUREE_HUMEUR = 1500;
import { battuAccorde } from '../ui/sceaux';
import type { StatsPartie } from './bilan';
import { Revue } from './Revue';
import { resultatSgf, REVUE_KEY, sgfDepuisHistorique, type PartieGardee } from './revue';
import { delaiReponse, messageContinue } from './rythme';

// Textes de l'écran passés par `tr` (#167) : français d'origine dans src/content/i18n/fr.ts.
const REFUS = { occupe: null, ko: 'partie.refus.ko', suicide: 'partie.refus.suicide', 'hors-plateau': null } as const;
const camp = (c: number) => tr(c === 1 ? 'camp.noir' : 'camp.blanc');
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
  /**
   * Partie guidée (#79) : l'ordi est Mochi, dont la force part du cran `depart` et se règle tous les 10 coups
   * (src/engine/guidee.ts). `onCran` reçoit chaque nouveau cran, pour que la partie suivante reparte de là.
   */
  guidee?: { depart: number; onCran?: (cran: number) => void };
}

export function Game({ size, komi, confirmTouch, onExit, opponent: ai, intro, onResult, fin, aiKomi = komi, portrait, celebrer = true, aide = true, avantage = true, accommodant = false, guidee }: Props) {
  const [history, setHistory] = useState<Position[]>(() => [newPosition(size)]);
  const [phase, setPhase] = useState<'play' | 'score' | 'end'>('play');
  const [dead, setDead] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState(ai ? tr('partie.debut.ordi', { nom: ai.nom }) : tr('partie.debut.deux'));
  // « Abandonner » armé (#audit-wig, point 3) : valable pour l'état courant de l'historique seulement, sans minuterie.
  // Un coup joué le désarme ; l'état est annoncé par une zone polie permanente (voir plus bas).
  const [resignArmAt, setResignArmAt] = useState<number | null>(null);
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
  // Partie guidée (#79) : force de Mochi, réglée tous les 10 coups selon l'écart estimé ; dernier coup réglé.
  const force = useRef(forceInitiale(guidee?.depart));
  const regleA = useRef(0);
  // Libertés à montrer (atari) et zone d'indice : valables pour un seul état de l'historique.
  const [atari, setAtari] = useState<{ len: number; libs: number[] } | null>(null);
  const [indice, setIndice] = useState<{ len: number; p: number } | null>(null);
  // Conseil de Mochi (#80) : une phrase et la zone entourée, pour un seul état de l'historique.
  const [conseilVu, setConseilVu] = useState<{ len: number; zone: number[] } | null>(null);
  const [cherche, setCherche] = useState(false);
  // Indices donnés dans cette partie : limités à 3 contre l'ordi (#35), illimités à deux.
  const [indicesUtilises, setIndicesUtilises] = useState(0);
  // Conseil de Mochi (#80) : calculé sur l'appareil par src/engine/conseil.ts (règles seules, instantané).
  function conseiller() {
    if (!myTurn) return;
    const c = conseilMochi(pos);
    if (!c) { setConseilVu(null); setMsg(tr('conseil.aucun')); return; }
    setConseilVu({ len: history.length, zone: c.zone });
    setMsg(phraseConseil(c, size));
  }
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
  // Vrai si la partie a été reprise avec « Rejouer d'ici » (revue) : elle ne rapporte pas d'XP (#233, P5).
  const reprise = useRef(false);
  const profil = useProfil(ai ? supabase : null);
  const token = useRef(0); // invalide les réponses de l'ordi devenues caduques (annulation, sortie)
  const scoreToken = useRef(0); // idem pour les pierres mortes proposées
  // Ce que le dernier coup du joueur demande à la réponse de l'ordi (#187) : une pause pour fêter sa capture,
  // une réponse plus rapide quand l'ordi doit sauver un groupe en atari.
  const aRepondre = useRef<{ capture: boolean; forcee: boolean }>({ capture: false, forcee: false });
  // Capture du joueur fêtée (#187) : longueur d'historique et nombre de pierres, pour le « +N » et la phrase de Mochi.
  const [fete, setFete] = useState<{ len: number; n: number } | null>(null);
  const atarisSubis = useRef(0); // tes groupes mis en atari par l'ordi (leçon de Mochi en fin de partie)
  // Revue de la partie terminée (issue #34) : ouverte ou non (le nombre est gardé pour compatibilité), et SGF de la partie.
  const [relecture, setRelecture] = useState<number | null>(null);
  const [sgf, setSgf] = useState<string | null>(null);
  const pos = history[history.length - 1];
  const [conseilPasserA, setConseilPasserA] = useState<number | null>(null); // #120 : longueur d'historique au conseil « passer »
  const [frontieres, setFrontieres] = useState<AlerteFrontieres | null>(null); // #159 : frontières ouvertes montrées au passe
  const [avertiPasse, setAvertiPasse] = useState<number | null>(null); // #235 : longueur d'historique quand Mochi a prévenu avant un passe
  // #268 : le bouton retour a demandé « Tu quittes la partie ? » (partie en cours, au moins un coup joué).
  const [demandeQuitter, setDemandeQuitter] = useState(false);
  const retourRef = useRef<HTMLButtonElement>(null);
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
    return tr(c === 1 ? 'partie.atari.noir' : 'partie.atari.blanc');
  }

  // Tour de l'ordi : on demande un coup au moteur (dans un Web Worker), puis on le joue.
  useEffect(() => {
    if (!ai || !aiTurn) return;
    const jeton = token; // même objet ref ; alias pour la fonction de nettoyage
    const t = ++jeton.current, t0 = Date.now();
    setThinking(true);
    // Pomme « respire » (#187) : délai variable, plus long après ta capture ; court dans les tests de bout en bout.
    const cible = delaiReponse({ hasard: Math.random(), ...aRepondre.current, e2e: !!import.meta.env.VITE_E2E });
    // Passes du joueur (Noir) depuis le début : en partie accommodante, l'ordi passe dès la deuxième (#235).
    const passesJoueur = history.filter((h, i) => i > 0 && h.lastMove === -1 && h.toPlay === 2).length;
    bestMoveExplique(pos, guidee ? niveauGuide(force.current.cran) : ai.id, { komi: aiKomi, accommodant, passesJoueur }).then(async ({ move: m, raison }) => {
      const wait = cible - (Date.now() - t0);
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      if (t !== token.current) return;
      setThinking(false);
      const r = play(pos, m);
      if (typeof r === 'string') return;
      setHistory(h => [...h, r]);
      if (m === -1) {
        repliquer('passe');
        if (pos.lastMove === -1) enterScore(r, tr('partie.ordiPasseAussi', { nom: ai.nom }));
        else { const c = conseilPasser(ai.nom, aide, true, r.board); if (c) setConseilPasserA(history.length + 1); setMsg(c ?? tr('partie.ordiPasse', { nom: ai.nom })); }
      } else {
        const cap = r.captures[2] - pos.captures[2];
        playStone(m, size, true);
        if (cap) { playCapture(cap); repliquer('capture'); reagir('content'); }
        if (metEnAtari(r, m)) { playAtari(); hapticAtari(); }
        const alerte = cap ? null : alerteAtari(pos, r, 1, history.length + 1);
        if (alerte) atarisSubis.current++;
        // Pomme joue après ta passe (#185) : Mochi dit pourquoi, en une phrase (#187).
        const continue_ = pos.lastMove === -1 && raison ? messageContinue(ai.nom, raison) : null;
        const c = cap || alerte || continue_ ? null : conseilPasser(ai.nom, aide, false, r.board);
        if (c) setConseilPasserA(history.length + 1);
        const rappel = ` ${tr(frontieresVisibles(frontieres, history.length + 1, r.board, size, true) ? 'partie.frontieres' : 'partie.aToi')}`;
        setMsg(cap ? tr('partie.ordiCapture', { nom: ai.nom, n: cap, point: toLabel(m, size) }) : alerte ?? continue_ ?? c ?? `${tr('partie.ordiJoue', { nom: ai.nom, point: toLabel(m, size) })}${rappel}`);
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
      // Partie guidée : tous les 10 coups, l'écart estimé règle la force de Mochi (Blanc : son avance est -lead).
      // Première estimation reçue 10 coups après le réglage précédent : une estimation annulée ne saute pas un réglage.
      const coups = history.length - 1;
      if (guidee && e && coups - regleA.current >= PERIODE_GUIDEE) {
        regleA.current = coups;
        const r = reglerForce(-e.lead, force.current);
        force.current = r.force;
        guidee.onCran?.(r.force.cran);
        if (r.annonce) { const phrase = tr(r.annonce === 'plus-doux' ? 'guidee.plusDoux' : 'guidee.plusFort'); setMsg(m => `${m} ${phrase}`); }
      }
    }, () => { if (alive) setEstimationKo(true); });
    return () => { alive = false; };
  }, [ai, pos, komi, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deux passes : le moteur marque les pierres mortes (grisées). Contre l'ordi, si rien n'est incertain, on va droit
  // au récit du score (#117) ; sinon, et toujours à deux, le joueur corrige d'une touche avant « Valider le score ».
  function enterScore(p: Position, fin: string) {
    const t = ++scoreToken.current;
    setPhase('score'); setDead(new Set()); setFinding(true); setMsg(tr('partie.chercheMortes', { fin }));
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
    resultatDiffere.current = null; xpEnAttente.current = null;
    setAutoCompte('non'); setRecitFini(true); setPhase('score'); setMsg(`${tr('partie.mortes.explication')} ${tr('partie.mortes.toucher')}`);
  }
  function resume() { setFrontieres(null); scoreToken.current++; setFinding(false); setPhase('play'); setDead(new Set()); setAutoCompte('non'); resultatDiffere.current = null; }

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
    if (typeof r !== 'string') setDemandeQuitter(false);
    if (typeof r === 'string') {
      const refus = REFUS[r];
      if (refus) { setMsg(tr(refus)); playIllegal(); hapticIllegal(); setShake(s => ({ p, n: (s?.n ?? 0) + 1 })); }
      return;
    }
    const cap = r.captures[pos.toPlay] - pos.captures[pos.toPlay];
    playStone(p, size); hapticStone();
    if (cap) { playCapture(cap); hapticCapture(); }
    const enAtari = metEnAtari(r, p);
    // Ton atari sur l'ordi sonne aussi (#187) ; la vibration reste réservée à l'atari à deux (et à l'atari subi).
    if (enAtari) playAtari();
    if (!ai && enAtari) hapticAtari();
    if (ai) { aRepondre.current = { capture: cap > 0, forcee: enAtari }; setFete(cap ? { len: history.length + 1, n: cap } : null); }
    setHistory([...history, r]);
    if (history.length === 1) track(EVENTS.partieCommencee, { mode: ai ? 'ordi' : 'deux', adversaire: ai?.id, taille: size });
    if (history.length === 1) trackOnce(EVENTS.premierePierre, { secondes: secondsSinceOpen(), mode: ai ? 'ordi' : 'deux', adversaire: ai?.id, taille: size });
    if (ai) {
      if (cap) { repliquer('captureSubie'); reagir('surpris'); }
      else if (enAtari) repliquer('atariSubi');
      setMsg(cap ? tr('partie.tuCaptures', { n: cap }) : tr('partie.tuJoues', { point: toLabel(p, size) }));
    } else {
      const alerte = cap ? null : alerteAtari(pos, r, r.toPlay, history.length + 1);
      setMsg(cap ? tr('partie.campCapture', { camp: camp(pos.toPlay), n: cap }) : alerte ?? tr('partie.campJoue', { camp: camp(r.toPlay), point: toLabel(p, size) }));
    }
  }
  /** Tu passes. Partie pas finie (#235) : Mochi prévient d'abord ; « Passer » (ici ou dans sa bulle) confirme. */
  function pass() {
    if (!myTurn) return;
    setDemandeQuitter(false);
    const avertir = avertiPasse !== history.length && avertirAvantPasse({ contreOrdi: !!ai, aide, premieresParties: accommodant, adversairePasse: pos.lastMove === -1, board: pos.board, size });
    if (avertir) {
      setAvertiPasse(history.length);
      const ouverts = frontieresAuPasse(true, pos.board, size);
      setFrontieres(ouverts.length ? { len: history.length, points: ouverts } : null);
      setMsg(tr('partie.passe.avertir'));
      return;
    }
    setAvertiPasse(null);
    const r = play(pos, -1) as Position;
    aRepondre.current = { capture: false, forcee: false }; setFete(null);
    setHistory([...history, r]);
    const ouverts = pos.lastMove === -1 ? [] : frontieresAuPasse(aide, pos.board, size);
    if (pos.lastMove === -1) enterScore(r, tr('partie.deuxPasses'));
    else if (ouverts.length) { setFrontieres({ len: history.length + 1, points: ouverts }); setMsg(tr('partie.frontieres')); if (ai) repliquer('passeJoueur'); }
    else if (ai) { repliquer('passeJoueur'); setMsg(tr('partie.tuPasses', { nom: ai.nom })); }
    else setMsg(tr('partie.campPasse', { camp: camp(pos.toPlay), autre: camp(r.toPlay) }));
  }
  function continuerAJouer() { setAvertiPasse(null); setMsg(tr('partie.passe.continue')); }
  // Indice : le moteur cherche un bon coup (niveau Caillou, dans son Worker) et on entoure la zone où il se trouve.
  const restants = ai ? indicesRestants(indicesUtilises) : INDICES_PAR_PARTIE;
  function hint() {
    if (!myTurn || cherche || restants <= 0) return;
    const len = history.length;
    setCherche(true);
    setMsg(tr('partie.indice.cherche'));
    bestMove(pos, 'caillou', { komi }).then(m => {
      setCherche(false);
      if (len !== history.length) return;
      if (m < 0) { setMsg(tr('partie.indice.aucun')); return; }
      setIndice({ len, p: m });
      // Seul un indice montré compte ; le dernier, Mochi annonce qu'il n'y en a plus.
      if (ai) setIndicesUtilises(u => u + 1);
      setMsg(ai ? messageIndice(indicesRestants(indicesUtilises + 1)) : messageIndice(1));
    }, () => { setCherche(false); setMsg(tr('partie.indice.erreur')); });
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
      if (!e) { setMsg(tr('partie.quiMene.erreur')); return; }
      setQuiMene(q => ({ len, owner: carteTerritoire(e.own), phrase: phraseQuiMene(e.lead, e.engine), n: (q?.n ?? 0) + 1 }));
      if (ai) setQuiMeneUtilises(u => u + 1);
    }, () => { setQuiMeneCalcul(false); setMsg(tr('partie.quiMene.erreur')); });
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
    setHistory(history.slice(0, undoTo)); resume(); setMsg(tr(ai ? 'partie.annule.ordi' : 'partie.annule.deux'));
  }
  function finish(winner: 1 | 2, abandon: boolean, differe = false) {
    const egalite = !abandon && sc.margin === 0;
    setPhase('end'); setRelecture(null); setRecitFini(abandon);
    // La partie est gardée en SGF sur ce téléphone, pour la revue (Supabase viendra plus tard).
    // Résultat exact (RE) : la revue connaît l'écart, komi compris (#187).
    const texte = sgfDepuisHistorique(history, komi, { noir: ai ? 'Toi' : 'Noir', blanc: ai?.nom ?? 'Blanc', resultat: resultatSgf(egalite ? 0 : winner, abandon, sc.margin) });
    setSgf(texte);
    try { localStorage.setItem(REVUE_KEY, JSON.stringify({ sgf: texte, adversaire: ai?.id, date: new Date().toISOString() } satisfies PartieGardee)); } catch { /* stockage indisponible */ }
    const resultat = () => onResult?.(egalite ? 0 : winner, {
      coups: history.length - 1, capturesMoi: pos.captures[1], capturesAdv: pos.captures[2], atarisSubis: atarisSubis.current,
      abandon, marge: abandon ? 0 : sc.margin, komi, pierres: pos.board.reduce((n, c) => n + (c ? 1 : 0), 0),
    });
    resultatDiffere.current = differe ? resultat : null;
    if (!differe) resultat();
    // Célébration (réglage « Célébrations ») : carillon et vibration ; les confettis sont sur l'écran de fin.
    // Après un comptage, elle attend la fin du récit du score (le résultat n'est pas gâché d'avance).
    if (abandon) celebrerVictoire(winner, egalite);
  }
  function celebrerVictoire(winner: 1 | 2, egalite: boolean) {
    if (celebrer && !egalite && (!ai || winner === 1)) { playVictory(); hapticVictory(); }
    else if (ai && !egalite && winner === 2) { playDefeat(); hapticDefeat(); }
  }
  function finRecit() {
    if (recitFini) return;
    setRecitFini(true);
    resultatDiffere.current?.(); resultatDiffere.current = null;
    if (!komiExplique) setKomiExplique(true);
    celebrerVictoire(sc.winner, sc.margin === 0);
  }
  const resignArm = resignArmAt === history.length && phase === 'play';
  function resign() {
    if (!resignArm) { setResignArmAt(history.length); return; }
    token.current++;
    const loser = ai ? 1 : pos.toPlay;
    setResigned(loser); finish((3 - loser) as 1 | 2, true);
  }
  /** « Rejouer d'ici » (revue) : la partie reprend, contre le même adversaire, depuis la position choisie. */
  function rejouer(h: Position[]) {
    token.current++; atarisSubis.current = 0; setIndicesUtilises(0); setQuiMeneUtilises(0); setQuiMene(null);
    reprise.current = h.length > 1;
    setHistory(h); resume(); setResigned(0); setThinking(false); setRelecture(null); setSgf(null);
    setMsg(tr(h.length > 1 ? (ai ? 'partie.reprise.ordi' : 'partie.reprise.deux') : ai ? 'partie.nouvelle.ordi' : 'partie.nouvelle.deux'));
  }
  function restart() {
    token.current++; atarisSubis.current = 0; setIndicesUtilises(0); setQuiMeneUtilises(0); setQuiMene(null);
    reprise.current = false;
    setHistory([newPosition(size)]); resume(); setResigned(0); setThinking(false); setRelecture(null);
    setMsg(tr(ai ? 'partie.nouvelle.ordi' : 'partie.nouvelle.deux'));
  }

  const name = (c: 1 | 2) => (ai ? (c === 1 ? tr('camp.toi') : ai.nom) : camp(c));
  // #268 : quitter une partie en cours (au moins un coup, pas finie) la perd ; Mochi demande d'abord, avec la bulle du passe.
  // Sans coup joué, ou partie finie (l'écran de fin a son propre retour), on sort tout de suite.
  const quitterDemandeConfirmation = phase !== 'end' && history.length > 1;
  const retourAccueil = <button ref={retourRef} type="button" className="retour" onClick={() => (quitterDemandeConfirmation ? setDemandeQuitter(true) : onExit())} aria-label={tr('partie.retourAccueil')}>‹</button>;
  // En relecture, on montre la position `q` et « ‹ » ramène au bilan.
  const bandeau = (c: 1 | 2, q: Position = pos, retour: ReactNode = retourAccueil, actif = phase === 'play' && q.toPlay === c, gain: { n: number; k: number } | null = null) => {
    let sousTitre: string;
    if (c === 2) sousTitre = ai ? ai.rang : tr('partie.komi', { komi: virgule(komi) });
    else sousTitre = ai ? (profil ? tr('partie.noirCote', { cote: profil.cote }) : camp(1)) : tr('partie.joueEnPremier');
    const initiale = c === 1 && profil?.pseudo ? profil.pseudo[0] : undefined;
    return (
      <Bandeau nom={name(c)} sousTitre={sousTitre} actif={actif} captures={q.captures[c]} pierresPrises={c === 1 ? 'blanc' : 'noir'}
        portrait={c === 2 && ai ? <Portrait id={ai.id} taille={44} humeur={humeur.h} decoratif signature={false} />
          : c === 2 && portrait ? portrait : <Avatar couleur={c} initiale={initiale} />}
        replique={c === 2 ? replique : null} avant={c === 2 ? retour : undefined} gain={gain} />
    );
  };

  // Mesure : une partie terminée (score validé ou abandon). Ajout isolé pour faciliter les fusions.
  useEffect(() => { if (phase === 'end') track(EVENTS.partieTerminee, { mode: ai ? 'ordi' : 'deux', adversaire: ai?.id, taille: size, coups: history.length - 1, fin: resigned ? 'abandon' : 'score', gagnant: (resigned ? 3 - resigned : sc.winner) === 1 ? 'noir' : 'blanc' }); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  // Progression (issue #109) : la partie terminée rapporte de l'XP, une victoire contre l'ordi davantage
  // (au moins 10 coups : un abandon immédiat ne rapporte rien ; une partie reprise depuis la revue, rien : #233, P5).
  // L'XP est acquise dès que le résultat est connu (#233, P4) : si le joueur quitte pendant le récit du score,
  // elle est créditée à la sortie (#233, P4). Sinon elle arrive avec l'écran de fin, après le récit :
  // « +60 XP » ne doit pas dévoiler la victoire (recette du 28/09, R2).
  const xpEnAttente = useRef<SourceXp | null>(null);
  useEffect(() => {
    if (phase !== 'end') { xpEnAttente.current = null; return; }
    if (!recitFini) {
      xpEnAttente.current = sourceXpPartie({ coups: history.length - 1, contreOrdi: !!ai, gagne: (resigned ? 3 - resigned : sc.winner) === 1, reprise: reprise.current });
      return;
    }
    const s = xpEnAttente.current ?? sourceXpPartie({ coups: history.length - 1, contreOrdi: !!ai, gagne: (resigned ? 3 - resigned : sc.winner) === 1, reprise: reprise.current });
    xpEnAttente.current = null;
    if (s) gagnerXp(s);
  }, [phase, recitFini]); // eslint-disable-line react-hooks/exhaustive-deps
  // Sortie pendant le récit (écran quitté, app fermée ou rechargée) : le résultat est connu, l'XP est acquise.
  useEffect(() => {
    const crediter = () => { const s = xpEnAttente.current; xpEnAttente.current = null; if (s) gagnerXp(s); };
    window.addEventListener('pagehide', crediter);
    return () => { window.removeEventListener('pagehide', crediter); crediter(); };
  }, []);

  // Première partie contre l'ordi menée jusqu'au score ou à l'abandon : une seule fois par appareil (trackOnce, #35).
  useEffect(() => { if (phase === 'end' && ai) trackOnce(EVENTS.premierePartieTerminee, { adversaire: ai.id, taille: size, coups: history.length - 1, fin: resigned ? 'abandon' : 'score', indices: indicesUtilises, secondes: secondsSinceOpen() }); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Proposer d'installer l'app (#178) : après la toute première victoire contre l'ordi sur cet appareil, jamais pendant la partie.
  // Le repère n'est lu qu'une fois par fin de partie (le double effet du mode strict ne doit pas le consommer).
  const [premiereVictoire, setPremiereVictoire] = useState(false);
  const victoireLue = useRef(false);
  useEffect(() => {
    if (phase !== 'end') { victoireLue.current = false; setPremiereVictoire(false); return; }
    if (victoireLue.current) return;
    victoireLue.current = true;
    const gagneOrdi = !!ai && (resigned ? 3 - resigned : sc.winner) === 1 && (!!resigned || sc.margin !== 0);
    if (gagneOrdi && noterVictoire()) setPremiereVictoire(true);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'end' && relecture !== null && sgf) {
    // Revue de la partie (issue #34) : erreurs, courbe d'avantage, « Rejouer d'ici ».
    return <Revue sgf={sgf} joueur={ai ? 1 : null} adversaire={ai?.nom} onRetour={() => setRelecture(null)} onRejouer={rejouer} confirmTouch={confirmTouch} />;
  }

  if (phase === 'end') {
    const abandon = !!resigned;
    const winner = resigned ? (3 - resigned) as 1 | 2 : sc.winner;
    const egalite = !abandon && sc.margin === 0;
    const gagne = !egalite && (!ai || winner === 1);
    const titre = egalite ? tr('fin.egalite') : ai ? tr(winner === 1 ? 'fin.victoire' : 'fin.defaite') : tr('fin.gagne', { nom: name(winner) });
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
          <aside className="comptage-auto" aria-label={tr('partie.mortes.aria')}>
            {dead.size > 0 && <p>{fr(tr('partie.mortes.explication'))}</p>}
            <button type="button" className="lien lien-discret" onClick={corriger}>{tr('partie.mortes.corriger')}</button>
          </aside>
        </div>
      );
    }
    const bilanDeux = fr(tr('fin.bilanDeux', { n, plateau, noir: pos.captures[1], blanc: pos.captures[2] }));
    return (
      <FinPartie
        fond={<Board size={size} board={pos.board} marks={{ owner: abandon ? undefined : sc.owner, dead, last: pos.lastMove }} />}
        sceau={ai ? <Portrait id={ai.id} taille={108} decoratif humeur={gagne ? 'surpris' : 'content'} /> : <span className={`fin-pierre ${winner === 1 ? 'b' : 'w'}`} aria-hidden="true" />}
        tampon={ai && gagne ? battuAccorde(ai.id).toUpperCase() : null}
        titre={titre}
        marge={abandon || egalite ? null : sc.margin}
        texteMarge={v => tr('fin.marge', { n: v, v: virgule(v), plateau })}
        sousTitre={abandon ? tr('fin.parAbandon') : tr('fin.komiCompris', { plateau })}
        bilan={fin?.bilan ?? bilanDeux}
        mochi={fin?.mochi}
        action={fin?.action ?? <button type="button" className="cta" onClick={restart}>{tr('fin.rejouer')}</button>}
        onRevoir={n > 0 ? () => setRelecture(1) : undefined}
        onAccueil={fin?.onAccueil ?? onExit}
        confettis={celebrer && gagne}
        apres={premiereVictoire && gagne ? <ProposerInstallation moment="premiere_victoire" /> : null}
      />
    );
  }

  const lead = ai ? avanceBarre(phase, estimation?.lead ?? null, sc) : null;
  const libs = atari && atari.len === history.length && phase === 'play' ? atari.libs : undefined;
  const zone = indice && indice.len === history.length && phase === 'play' ? indice.p : undefined;
  const zoneConseil = conseilVu && conseilVu.len === history.length && phase === 'play' ? conseilVu.zone : undefined;
  // Ta capture reste affichée pendant que Pomme réfléchit (#187) : le « Bravo » ne s'efface qu'à sa réponse.
  const feteVisible = fete && fete.len === history.length && phase === 'play' ? fete : null;
  const pense = phase === 'play' && thinking && !!ai && !feteVisible;
  const messageCoach = pense && ai ? tr('partie.reflechit', { nom: ai.nom }) : msg;
  const quitter = demandeQuitter && quitterDemandeConfirmation;
  const avertissementPasse = phase === 'play' && myTurn && avertiPasse === history.length && !quitter;
  const montrerIntro = intro && history.length === 1 && phase === 'play' && !avertissementPasse && !quitter;

  return (
    <div className="partie">
      {bandeau(2)}
      <ListeCoups coups={coups} />
      {ai && avantage && (!estimationKo || phase === 'score') && <BarreAvantage libelle={lead === null ? '' : libelleAvantage(lead)} part={lead === null ? 0.5 : partNoir(lead, size)} titre={phase === 'score' ? tr('partie.scoreCompte') : undefined} />}
      <div className="partie-plateau">
        <Board size={size} board={pos.board} toPlay={pos.toPlay} interactive={phase === 'score' || myTurn} stonesTappable={phase === 'score'} confirmTouch={confirmTouch}
          marks={{ last: pos.lastMove, owner: phase === 'score' ? sc.owner : quiMeneVisible?.owner, ownerFondu: !!quiMeneVisible, dead, libs, zone, conseil: zoneConseil, ouverts: phase === 'play' ? frontieresVisibles(frontieres, history.length, pos.board, size, !!ai) : undefined }} onPlay={onPlay} shake={shake} versCouvercles noms={ai ? { 2: ai.nom } : undefined} />
        {quiMeneVisible && <p key={quiMeneVisible.n} className="qui-mene-phrase" aria-hidden="true">{fr(quiMeneVisible.phrase)}</p>}
        {/* Zones d'annonce permanentes (audit web, points 3 et 4) : seul leur texte change, pour être lues à coup sûr. */}
        <p className="sr-only" role="status" data-annonce="qui-mene">{quiMeneVisible ? fr(quiMeneVisible.phrase) : ''}</p>
        <p className="sr-only" aria-live="polite" data-annonce="abandon">{resignArm ? `${tr('partie.action.abandonner')} : ${fr(tr('partie.action.confirmer'))}` : ''}</p>
      </div>
      {bandeau(1, pos, retourAccueil, phase === 'play' && pos.toPlay === 1, feteVisible && !mouvementsReduits() ? { n: feteVisible.n, k: feteVisible.len } : null)}
      <div className="partie-souffle" aria-hidden="true" />
      {/* Zone de Mochi de hauteur fixe (#187) : la bulle d'intro garde sa place après le premier coup, le plateau ne bouge pas. */}
      <div className="partie-mochi">
        {intro && phase === 'play' && <div className="coach-intro" aria-hidden={!montrerIntro || undefined} data-cache={!montrerIntro || undefined}>{intro}</div>}
        {!montrerIntro && !avertissementPasse && !quitter && <Coach cle={messageCoach} attente={pense}
          humeur={pense ? 'pensif' : feteVisible || humeur.h === 'surpris' ? 'content' : 'neutre'}>{fr(messageCoach)}</Coach>}
        {/* Avant un passe trop tôt (#235) : la bulle et ses deux choix montent au-dessus de ton bandeau, rien ne bouge. */}
        {avertissementPasse && (
          <ChoixMochi nom="passe" question={fr(messageCoach)} aria={tr('partie.passe.aria')}
            agir={{ label: tr('partie.passe.confirmer'), onClick: pass }} rester={{ label: tr('partie.passe.continuer'), onClick: continuerAJouer }} />
        )}
        {/* Quitter une partie en cours (#268) : même bulle ; « Jouer encore » (principal) prend le focus, rien n'est perdu. */}
        {quitter && (
          <ChoixMochi nom="quitter" focus question={fr(tr('partie.quitter.avertir'))} aria={tr('partie.quitter.aria')}
            agir={{ label: tr('partie.quitter.confirmer'), onClick: onExit }} rester={{ label: tr('partie.quitter.continuer'), onClick: () => { setDemandeQuitter(false); retourRef.current?.focus(); } }} />
        )}
      </div>
      {phase === 'play' ? (
        <BarreActions label={tr('partie.actions')} actions={[
          { label: tr(cherche ? 'partie.action.indiceCours' : 'partie.action.indice'), icone: ai ? <CompteurIndices restants={restants}><Icone nom="indice" /></CompteurIndices> : <Icone nom="indice" />,
            onClick: hint, disabled: !myTurn || cherche || restants <= 0, description: ai ? descriptionIndices(restants) : undefined },
          ...(ai && aide ? [{ label: tr('partie.action.conseil'), action: 'conseil', icone: <PortraitMochi humeur="neutre" taille={26} decoratif />,
            onClick: conseiller, disabled: !myTurn }] : []),
          ...(avecQuiMene ? [{ label: fr(tr('partie.action.quiMene')), action: 'qui-mene',
            icone: ai ? <CompteurIndices restants={quiMeneReste}><Icone nom="quimene" /></CompteurIndices> : <Icone nom="quimene" />,
            onClick: quiMeneToucher, disabled: !quiMeneVisible && (quiMeneCalcul || quiMeneReste <= 0),
            description: ai ? descriptionQuiMene(quiMeneReste) : undefined }] : []),
          { label: tr('partie.action.annuler'), icone: <Icone nom="annuler" />, onClick: undo, disabled: undoTo < 1 },
          { label: tr('partie.action.passer'), icone: <Icone nom="passer" />, onClick: pass, disabled: !myTurn, groupe: 'decision', principale: true,
            evidence: passerEnEvidence(aide && !!ai, myTurn, pos.lastMove === -1, conseilPasserA, history.length), pulse: celebrer && !mouvementsReduits() },
          { label: resignArm ? fr(tr('partie.action.confirmer')) : tr('partie.action.abandonner'), icone: <Icone nom="abandonner" />, onClick: resign, danger: resignArm, groupe: 'decision' },
        ]} />
      ) : (
        <>
          <p className="comptage">{fr(tr('partie.comptage', { noir: name(1), pn: virgule(sc.black), blanc: name(2), pb: virgule(sc.white) }))}</p>
          <div className="barre-comptage" role="toolbar" aria-label={tr('partie.comptageAria')}>
            <button className="btn" onClick={() => { resume(); setMsg(tr('partie.reprend')); }}>{tr('partie.reprendre')}</button>
            <button className="btn primary" onClick={() => finish(sc.winner, false)} disabled={finding}>{tr('partie.valider')}</button>
          </div>
        </>
      )}
    </div>
  );
}
