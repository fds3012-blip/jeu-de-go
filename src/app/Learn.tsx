// Onglet Apprendre (issues #40 et #54) : chemin de pierres sur les lignes d'un goban, lecteur de leçon, fin de leçon.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CHAPITRES, LESSONS, chapitreDe, explicationRefus, type Chapitre, type Lesson } from '../content/lessons';
import { acquis } from '../content/acquis';
import { Board, type BoardMarks } from '../ui/Board';
import { CASE_MS, TEMPS_MS, imageDuGeste, imagesDemo, type DemoImage } from '../content/demo';

/** Fond du compteur de libertés, posé sur le bois comme les autres marques jade. */
const JADE_COMPTEUR = '#3CC48E';
import { Bubble } from '../ui/Mochi';
import { SceauLecon } from '../ui/SceauLecon';
import { Confettis } from '../ui/Confettis';
import { Etapes, Marque, Retour, Verdict } from '../ui/Lecteur';
import { fr } from '../ui/typo';
import { fromRows } from '../go/position';
import { play, type Position } from '../go/rules';
import { fromLabel, toLabel } from '../go/coords';
import { score } from '../go/score';
import { prefersReducedMotion, type SyncState } from './hooks';
import { playFail, playStone, playSuccess, playVictory } from '../ui/sound';
import { hapticFail, hapticStone, hapticSuccess, hapticVictory } from '../ui/haptics';
import { EVENTS, track } from '../data/analytics';
import { gagnerXp } from './xp';
import { validerDefi } from './defiAppareil';
import { CHAPITRES_A_VENIR, LIGNE, actionsFin, boutonChemin, etapes, finDeChapitre, finDeLecon, trace, traceJusqua, type ActionFin, type Etape, type Progression } from './apprendre';
import { t } from '../content/i18n';
import '../ui/apprendre.css';

function lineOf(p: number, n: number) { const x = p % n, y = Math.floor(p / n); return Math.min(x, y, n - 1 - x, n - 1 - y); }

const SYNC_TEXT: Record<SyncState, string> = {
  local: 'Ta progression reste sur ce téléphone. Connecte-toi dans Profil pour la garder partout.',
  sync: 'Synchronisation de ta progression…',
  ok: 'Progression enregistrée sur ton compte.',
  error: 'Hors ligne : ta progression est gardée ici et partira plus tard.'
};

/** Lignes du goban sous le chemin : un seul tracé, x compté depuis le milieu, assez large pour les écrans jusqu'à 560 px. */
function lignesGoban(hauteur: number): string {
  const cols = 5, bord = cols * LIGNE;
  let d = '';
  for (let c = -cols; c <= cols; c++) d += `M${c * LIGNE} 0V${hauteur}`;
  for (let y = 0; y <= hauteur; y += LIGNE) d += `M${-bord} ${y}H${bord}`;
  return d;
}

export function LearnHome({ progress, onOpen, sync = 'local' }: { progress: Progression; onOpen: (id: string) => void; sync?: SyncState }) {
  const liste = etapes(LESSONS, progress);
  const iEnCours = liste.findIndex(e => e.etat === 'encours');
  const bouton = boutonChemin(LESSONS, progress);
  const cta = useRef<HTMLButtonElement>(null);
  // #121 : sous 390 px (zoom 200 %), les écarts horizontaux du chemin (pierres, tracé, lignes) sont mis à l'échelle
  // de la largeur de l'écran pour que les pierres restent dedans ; à 390 px et plus, k = 1 : rien ne change.
  const [k, setK] = useState(() => Math.min(1, window.innerWidth / 390));
  useEffect(() => {
    const maj = () => setK(Math.min(1, window.innerWidth / 390));
    window.addEventListener('resize', maj);
    return () => window.removeEventListener('resize', maj);
  }, []);

  // La leçon en cours doit être à l'écran, avec son bouton : on fait défiler d'un coup, sans animation.
  useEffect(() => {
    const r = cta.current?.getBoundingClientRect();
    const bas = window.innerHeight - 96;
    if (r && r.bottom > bas) window.scrollBy({ top: r.bottom - bas, behavior: 'instant' as ScrollBehavior });
  }, []);

  // Sous la leçon en cours, le verbe suffit (le titre est juste au-dessus) ; chemin fini, le bouton dit quelle leçon il rouvre.
  const boutonCta = bouton && (
    <button ref={cta} className="cta cta-chemin" aria-label={fr(bouton.texte)} onClick={() => onOpen(bouton.id)}>{iEnCours < 0 ? fr(bouton.texte) : bouton.verbe}</button>
  );

  return (
    <div className="apprendre">
      {/* #228 : un chemin par chapitre, l'un sous l'autre ; un seul bouton en relief, sous la première leçon pas finie. */}
      {CHAPITRES.map(c => (
        <CheminChapitre key={c.id} chapitre={c} liste={liste.filter(e => c.lecons.includes(e.lecon))} k={k} boutonCta={boutonCta} onOpen={onOpen} progress={progress} />
      ))}

      {iEnCours < 0 && <div className="chemin-fini">{boutonCta}</div>}

      <section className="a-venir" aria-labelledby="a-venir-titre">
        <h2 id="a-venir-titre" className="titre-pierres">Bientôt</h2>
        <p>Cinq autres chapitres sont en préparation, jusqu’au niveau des joueurs de club.</p>
        <ul>{CHAPITRES_A_VENIR.map(c => <li key={c}>{c}</li>)}</ul>
      </section>

      <p className={`synchro synchro-${sync}`} role="status" aria-busy={sync === 'sync'}>{SYNC_TEXT[sync]}</p>
    </div>
  );
}

/** Phrase sous le titre d'un chapitre : son intro, l'avancée, ou la fin (« la suite arrive » pour un chapitre en cours d'écriture). */
function phraseChapitre(c: Chapitre, faites: number): string {
  const n = c.lecons.length;
  if (faites === 0) return c.intro;
  if (faites === n) return c.complet ? `Chapitre terminé.${c.fin ? ` ${c.fin.replace(/\.$/, ' !')}` : ''}` : 'Tout est fait. La suite arrive bientôt.';
  return `${faites} leçon${faites > 1 ? 's' : ''} faite${faites > 1 ? 's' : ''} sur ${n}. Continue !`;
}

/** Chemin d'un chapitre : titre, puis ses pierres de gué sur les lignes d'un goban. */
function CheminChapitre({ chapitre, liste, k, boutonCta, onOpen, progress }: {
  chapitre: Chapitre; liste: Etape[]; k: number; boutonCta: ReactNode; onOpen: (id: string) => void; progress: Progression;
}) {
  const iEnCours = liste.findIndex(e => e.etat === 'encours');
  // #169 : place occupée par chaque rangée sous le centre de sa pierre, mesurée après l'affichage. Au zoom 200 %,
  // un titre sur plusieurs lignes repousse la rangée suivante au lieu de la chevaucher. À 390 px, tout tient : rien ne bouge.
  const [bas, setBas] = useState<number[]>([]);
  const t = useMemo(() => trace(liste.length, { encours: iEnCours, bas }), [liste.length, iEnCours, bas]);
  const faites = liste.filter(e => e.etat === 'faite').length;
  // Tracé parcouru : jusqu'à la leçon en cours, tout le chapitre s'il est fini, rien s'il n'est pas commencé.
  const parcouru = traceJusqua(t, iEnCours >= 0 ? iEnCours : faites === liste.length ? liste.length - 1 : -1);
  const chemin = useRef<HTMLOListElement>(null);
  // Une rangée qui change de hauteur sans nouveau rendu (police chargée après coup, texte agrandi) : on remesure.
  const [tour, remesurer] = useState(0);
  // Mesure avant l'affichage : si une rangée a changé de hauteur, le chemin est recalculé tout de suite.
  // Stable : la hauteur d'une rangée ne dépend pas de sa position, la seconde mesure donne le même résultat.
  useLayoutEffect(() => {
    const rangees = [...(chemin.current?.children ?? [])] as HTMLElement[];
    const mesure = rangees.map(li => {
      const pierre = li.querySelector('.pierre-gue')?.getBoundingClientRect();
      return pierre ? Math.ceil(li.getBoundingClientRect().bottom - (pierre.top + pierre.height / 2)) : 0;
    });
    if (mesure.length !== bas.length || mesure.some((m, i) => m !== bas[i])) setBas(mesure);
  }, [bas, k, tour, progress]);
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !chemin.current) return;
    const obs = new ResizeObserver(() => remesurer(x => x + 1));
    for (const li of chemin.current.children) obs.observe(li);
    return () => obs.disconnect();
  }, [liste.length]);
  const echelle = k < 1 ? `scale(${k} 1)` : undefined;

  return (
    <section className="chapitre-chemin" data-chapitre={chapitre.id} aria-labelledby={`chapitre-${chapitre.id}`}>
      <div className="chapitre">
        <h2 id={`chapitre-${chapitre.id}`}>{fr(chapitre.titre)}</h2>
        <p>{fr(phraseChapitre(chapitre, faites))}</p>
      </div>

      <div className="gue" style={{ height: t.hauteur }}>
        <div className="gue-goban" aria-hidden="true">
          <svg width="1" height={t.hauteur} focusable="false"><path d={lignesGoban(t.hauteur)} transform={echelle} vectorEffect="non-scaling-stroke" /></svg>
        </div>
        <svg className="gue-trace" width="1" height={t.hauteur} aria-hidden="true" focusable="false">
          <g transform={echelle}>
            <path d={t.d} className="gue-route" vectorEffect="non-scaling-stroke" />
            {parcouru && <path d={parcouru} className="gue-parcouru" vectorEffect="non-scaling-stroke" />}
          </g>
        </svg>
        <ol ref={chemin}>
          {liste.map((e, i) => {
            const p = t.pierres[i], droite = p.col > 0;
            const style = { top: p.y, '--x': `${p.x * k}px` } as CSSProperties;
            const etat = e.etat === 'faite' ? ', terminée' : e.etat === 'encours' ? ', prochaine étape' : '';
            return (
              <li key={e.lecon.id} className={`pas pas-${e.etat} ${droite ? 'a-droite' : 'a-gauche'}`} style={style}>
                <button className="pas-bouton" data-etat={e.etat} aria-label={`Leçon ${e.rang} : ${e.lecon.title}${etat}`} onClick={() => onOpen(e.lecon.id)}>
                  <span className="pierre-gue" aria-hidden="true" />
                  <span className="pas-texte" aria-hidden="true">
                    <SceauLecon id={e.lecon.id} taille={34} pale={e.etat === 'avenir'} />
                    <span><b>{fr(e.lecon.title)}</b><small>{e.lecon.desc}</small></span>
                  </span>
                </button>
                {e.etat === 'encours' && boutonCta}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

interface PlayerProps {
  lesson: Lesson;
  start: number;
  confirmTouch: boolean;
  /** Progression de toutes les leçons, pour la rangée de pierres de la fin de leçon. */
  progress?: Progression;
  /** Réglage « Célébrations » : faux coupe le carillon et les confettis de la dernière leçon. */
  celebrer?: boolean;
  onProgress: (steps: number) => void;
  onExit: () => void;
  /** Ouvre la leçon suivante ; absent pour la dernière. */
  onNext?: () => void;
  /** Fin de leçon (#200) : série de 3 problèmes du thème de la leçon (`themes` : leurs noms) ; absente si la leçon n'a pas de thème. */
  pratique?: { themes: string[]; ouvrir: () => void };
  /** Fin de chapitre (#200) : lance une partie contre le premier adversaire. */
  jouer?: { nom: string; lancer: () => void };
}

export function LessonPlayer({ lesson, start, confirmTouch, progress = {}, celebrer = true, onProgress, onExit, onNext, pratique, jouer }: PlayerProps) {
  const [idx, setIdx] = useState(Math.min(start, lesson.steps.length - 1));
  const [answer, setAnswer] = useState<{ ok: boolean; p?: number; after?: Position; choice?: number; n: number } | null>(null);
  /** Choix faux déjà touchés au quiz (#198) : ils restent marqués, les autres restent touchables. */
  const [faux, setFaux] = useState<number[]>([]);
  const [fini, setFini] = useState(false);
  const step = lesson.steps[idx];
  const { pos, marked } = useMemo(() => fromRows(step.rows), [step]);
  const owner = useMemo(() => (step.kind === 'quiz' && step.terr ? score(pos, 0, 'japanese').owner : undefined), [step, pos]);
  const derniere = idx === lesson.steps.length - 1;
  // Démonstration (#101) : un temps toutes les 600 ms ; mouvements réduits : l'état final d'emblée.
  const images = useMemo(() => (step.kind === 'info' && step.demo ? imagesDemo(step.rows, step.demo, step.avant) : null), [step]);
  // Geste (#198) : la démonstration s'arrête sur l'image `pause` jusqu'à ce que l'élève pose la pierre ou touche le point.
  const geste = step.kind === 'info' && step.demo ? step.geste : undefined;
  const pause = useMemo(() => (step.kind === 'info' && step.demo && step.geste ? imageDuGeste(step.rows, step.demo, step.avant, step.geste) : -1), [step]);
  const [gesteFait, setGesteFait] = useState(false);
  const [rate, setRate] = useState<{ p: number; n: number } | null>(null);
  const attente = !!geste && !gesteFait;
  const gesteA = useRef(0);
  const [reduit] = useState(prefersReducedMotion);
  const limite = images ? (attente ? pause : images.length - 1) : 0;
  const [temps, setTemps] = useState(() => (reduit ? limite : 0));
  useEffect(() => { setTemps(reduit ? limite : 0); }, [images, reduit]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!images || temps >= limite) return;
    const m = window.setTimeout(() => {
      const suivant = images[temps + 1];
      if (suivant.derniere != null && suivant.derniere !== images[temps].derniere) { playStone(suivant.derniere, 9); }
      setTemps(temps + 1);
    }, TEMPS_MS);
    return () => window.clearTimeout(m);
  }, [images, temps, limite]);

  // Événement d'entonnoir (#198) : leçons terminées ÷ leçons commencées.
  useEffect(() => {
    track(EVENTS.leconCommencee, { lecon: lesson.id, rang: LESSONS.indexOf(lesson) + 1, etape: Math.min(start, lesson.steps.length - 1) + 1 });
  }, [lesson.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function next() {
    onProgress(idx + 1);
    if (derniere) {
      track(EVENTS.leconTerminee, { lecon: lesson.id, rang: LESSONS.indexOf(lesson) + 1 });
      validerDefi('lecon'); // #199 : une leçon terminée est le défi du jour (série de l'appareil, SERIE_UN_DEFI)
      if ((progress[lesson.id] ?? 0) < lesson.steps.length) gagnerXp('lecon'); // une seule fois par leçon
      setFini(true);
    } else { setIdx(idx + 1); setAnswer(null); setFaux([]); setGesteFait(false); setRate(null); }
    window.scrollTo({ top: 0 });
  }
  function repondre(ok: boolean, extra: { p?: number; after?: Position; choice?: number }) {
    if (ok) { playSuccess(); hapticSuccess(); } else { playFail(); hapticFail(); }
    setAnswer(a => ({ ok, ...extra, n: (a?.n ?? 0) + 1 }));
  }
  /** Geste de la démonstration : juste, la suite se joue ; faux, le point se marque et l'élève rejoue tout de suite. */
  function onGeste(p: number) {
    if (!geste || !images) return;
    const bons = 'pose' in geste ? [geste.pose] : geste.touche;
    if (!bons.map(a => fromLabel(a, 9)).includes(p)) {
      playFail(); hapticFail();
      setRate(r => ({ p, n: (r?.n ?? 0) + 1 }));
      return;
    }
    gesteA.current = Date.now();
    setRate(null);
    setGesteFait(true);
    if ('pose' in geste) { playStone(p, 9); hapticStone(); } else hapticStone();
    const suite = 'pose' in geste ? pause + 1 : pause;
    setTemps(reduit ? images.length - 1 : suite);
  }
  function onPlay(p: number) {
    if (attente) { onGeste(p); return; }
    if (answer?.ok) return;
    // Question « touche » : on désigne un point, sans poser de pierre.
    if (step.kind === 'touche') { hapticStone(); repondre(step.accept.map(a => fromLabel(a, 9)).includes(p), { p }); return; }
    if (step.kind !== 'move') return;
    const r = play(pos, p);
    if (typeof r === 'string') return;
    const ok = step.accept === 'line3' ? lineOf(p, 9) >= 2
      : step.accept === 'terrB' ? score(pos, 0, 'japanese').owner[p] === 1
      : step.accept.map(a => fromLabel(a, 9)).includes(p);
    playStone(p, 9); hapticStone();
    repondre(ok, { p, after: ok ? r : undefined });
  }

  if (fini) {
    return <FinLecon lesson={lesson} progress={{ ...progress, [lesson.id]: lesson.steps.length }} celebrer={celebrer} onNext={onNext} onExit={onExit} pratique={pratique} jouer={jouer} />;
  }

  const img = images ? images[Math.min(temps, images.length - 1)] : null;
  const demoFinie = !images || temps >= images.length - 1;
  const board = img ? img.board : answer?.ok && answer.after ? answer.after.board : pos.board;
  const faites = idx + (answer?.ok ? 1 : 0);
  // En attente du geste « pose » : seul le point à jouer est vert (le compteur de libertés reste).
  const vert = attente && geste && 'pose' in geste ? [fromLabel(geste.pose, 9)] : null;
  const cta = <button className="cta" onClick={next}>{derniere ? 'Terminer la leçon' : 'Continuer'}</button>;
  const marks: BoardMarks = img
    ? { libs: vert ?? [...img.libs, ...img.yeux], targets: img.atari, mistake: attente && rate ? rate.p : img.interdit, last: img.derniere ?? null, ...territoire(img.terr, reduit),
        note: img.compteur ? { p: img.compteur.p, fond: JADE_COMPTEUR, texte: '#0B2A1D', symbole: String(img.compteur.n), libelle: `${img.compteur.n} liberté${img.compteur.n > 1 ? 's' : ''}`, cle: `${idx}-${temps}` } : undefined }
    : { libs: step.kind === 'info' || step.kind === 'move' ? (step.libs ?? (step.kind === 'move' ? step.aide : undefined))?.map(l => fromLabel(l, 9)) : undefined, targets: marked, owner,
        ok: answer?.ok ? answer.p : undefined, mistake: answer && !answer.ok ? answer.p : undefined, last: answer?.ok ? answer.p : null };

  return (
    <div className="lecteur lecteur-lecon">
      <div className="lecteur-tete">
        <Retour label="Retour au chemin" onClick={onExit} />
        <Etapes total={lesson.steps.length} faites={faites} />
      </div>
      <h2 className="lecteur-titre"><SceauLecon id={lesson.id} taille={24} />{fr(lesson.title)}</h2>
      <Bubble>{fr(step.text)}</Bubble>
      {/* Zone souple : le plateau prend la place qui reste au-dessus du bouton (iPhone SE compris). */}
      <div className={`lecteur-plateau${img?.atari.length ? ' demo-atari' : ''}`} data-demo={images ? (attente ? 'geste' : demoFinie ? 'finie' : 'en-cours') : undefined}
        onClick={images && !demoFinie && temps < limite ? () => { if (Date.now() - gesteA.current > 400) setTemps(limite); } : undefined}>
        <Board size={9} board={board} interactive={attente || ((step.kind === 'move' || step.kind === 'touche') && !answer?.ok)} confirmTouch={confirmTouch}
          toucher={step.kind === 'touche' || (attente && !!geste && 'touche' in geste)} stonesTappable={attente && !!geste && 'touche' in geste} onPlay={onPlay} marks={marks} />
      </div>
      {img?.terr && <Compteur cle={`${idx}-${temps}`} n={img.terr.points.length} reduit={reduit} />}
      {images && images.length > 1 && !attente && (
        <button className="lien revoir" disabled={!demoFinie} onClick={() => setTemps(0)}>Revoir</button>
      )}
      {step.kind === 'quiz' && (
        <div className={`choix${step.choices.some(c => /\p{L}/u.test(c)) ? ' choix-mots' : ''}`} role="group" aria-label="Ta réponse">
          {step.choices.map((c, i) => (
            <button key={c} disabled={answer?.ok && answer.choice !== i} aria-disabled={faux.includes(i) || undefined}
              className={answer?.ok && answer.choice === i ? 'choix-juste' : faux.includes(i) ? 'choix-faux' : undefined}
              onClick={() => {
                if (answer?.ok || faux.includes(i)) return;
                if (i !== step.answer) setFaux(f => [...f, i]);
                repondre(i === step.answer, { choice: i });
              }}>{c}</button>
          ))}
        </div>
      )}
      {/* Quiz (#198) : l'erreur s'écrit sous les choix, sans feuille qui les cache ni bouton ; on rechoisit tout de suite. */}
      {step.kind === 'quiz' && answer && !answer.ok && (
        <div className="choix-aide" role="status" aria-live="polite"><Marque key={answer.n} juste={false} taille={24} /><p>{fr(`${step.no} Essaie encore.`)}</p></div>
      )}
      {step.kind === 'info' && !attente && cta}
      {attente && rate && geste && (
        <Verdict ton="revoir" cle={rate.n}><p>{fr('pose' in geste ? 'Pose ta pierre sur le point vert.' : geste.no)}</p></Verdict>
      )}
      {answer && step.kind !== 'info' && (
        answer.ok
          ? <Verdict ton="juste" cle={answer.n} actions={cta}><p>{fr(step.ok)}</p></Verdict>
          // #198 : pas de bouton « Réessayer » ; le plateau reste jouable, on rejoue directement.
          : step.kind !== 'quiz' && <Verdict ton="revoir" cle={answer.n}><p>{fr(`${step.kind === 'move' && answer.p != null ? explicationRefus(step, toLabel(answer.p, 9)) : step.no} Essaie encore.`)}</p></Verdict>
      )}
    </div>
  );
}

/** Territoire d'une démonstration : les carrés se colorent case par case (`ownerDelai`), ou d'emblée en mouvements réduits. */
function territoire(terr: DemoImage['terr'], reduit: boolean): Pick<BoardMarks, 'owner' | 'ownerDelai'> {
  if (!terr) return {};
  const owner = new Int8Array(81);
  for (const p of terr.points) owner[p] = terr.couleur;
  return { owner, ownerDelai: reduit ? undefined : new Map(terr.points.map((p, i) => [p, i * CASE_MS])) };
}

/** Compteur qui suit les cases coloriées : 1, 2, 3… jusqu'à `n`, au rythme des carrés. */
function Compteur({ n, reduit, cle }: { n: number; reduit: boolean; cle: string }) {
  const [k, setK] = useState(reduit ? n : 0);
  useEffect(() => {
    if (reduit) { setK(n); return; }
    setK(0);
    const m = window.setInterval(() => setK(v => { if (v + 1 >= n) window.clearInterval(m); return Math.min(n, v + 1); }), CASE_MS);
    return () => window.clearInterval(m);
  }, [n, reduit, cle]);
  return <p className="demo-compteur" aria-live="off" data-compteur={k}><b>{k}</b> {k > 1 ? 'points' : 'point'}</p>;
}

/**
 * Instant où la pierre de la leçon touche le goban (ms), calé sur l'animation CSS `pose` (délai 320 ms + 140 ms).
 * Le claquement part à ce moment-là ; avec les mouvements réduits, tout est déjà posé et il part tout de suite.
 */
export const POSE_MS = 460;

/**
 * Fin de leçon : le sceau de la leçon s'imprime, la pierre se pose sur la rangée du chemin (avec son claquement),
 * puis une seule action en relief. Célébration modeste ; carillon et confettis seulement pour la dernière leçon.
 */
function FinLecon({ lesson, progress, celebrer, onNext, onExit, pratique, jouer }: {
  lesson: Lesson; progress: Progression; celebrer: boolean; onNext?: () => void; onExit: () => void;
  pratique?: PlayerProps['pratique']; jouer?: PlayerProps['jouer'];
}) {
  // #228 : tout se compte dans le chapitre de la leçon. Un chapitre en cours d'écriture ne se ferme pas encore.
  const chap = chapitreDe(lesson.id), lecons = chap.lecons;
  const liste = etapes(lecons, progress);
  const derniere = chap.complet && finDeLecon(lecons, lesson.id).derniere;
  // Fin de chapitre (#200) : dernière leçon terminée, ou toutes les leçons du chapitre faites.
  const chapitre = chap.complet && finDeChapitre(lecons, progress, lesson.id);
  // Hors fin de chapitre, « Leçon terminée » (la dernière leçon d'un chapitre en cours d'écriture aussi).
  const titre = chapitre ? finDeLecon(lecons, lecons[lecons.length - 1].id).titre : finDeLecon([], lesson.id).titre;
  const { principale, liens } = actionsFin({ chapitre, pratique: !!pratique, suivante: !!onNext, jouer: !!jouer });
  const bouton = (a: ActionFin, classe: 'cta' | 'lien') => {
    const props = { className: classe, 'data-action': a };
    if (a === 'jouer' && jouer) return <button key={a} {...props} onClick={jouer.lancer}>{t('lecon.jouerContre', { nom: jouer.nom })}</button>;
    if (a === 'pratique' && pratique) {
      return <button key={a} {...props} onClick={pratique.ouvrir} aria-label={fr(t('lecon.pratiqueAria', { themes: pratique.themes.join(', ') }))}>{fr(t('lecon.pratique'))}</button>;
    }
    if (a === 'suivante' && onNext) return <button key={a} {...props} onClick={onNext}>{t('lecon.suivante')}</button>;
    return <button key={a} {...props} onClick={onExit}>{t('lecon.retourChemin')}</button>;
  };
  const [reduit] = useState(prefersReducedMotion);
  const fete = derniere && celebrer;
  const sceau = useRef<HTMLDivElement>(null);
  const titreRef = useRef<HTMLHeadingElement>(null);
  const [gerbe, setGerbe] = useState<null | { x: number; y: number }>(null);

  useEffect(() => {
    titreRef.current?.focus({ preventScroll: true });
    // Minuteries annulées si on quitte l'écran avant la fin : rien ne claque après coup.
    const minuteries: number[] = [];
    const apres = (ms: number, f: () => void) => { minuteries.push(window.setTimeout(f, reduit ? 0 : ms)); };
    const i = LESSONS.findIndex(l => l.id === lesson.id);
    apres(POSE_MS, () => { playStone(Math.max(0, i) + 1, 9); hapticStone(); });
    if (fete) {
      apres(POSE_MS + 120, () => { playVictory(); hapticVictory(); });
      if (!reduit) apres(POSE_MS, () => {
        const r = sceau.current?.getBoundingClientRect();
        setGerbe(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight * 0.3 });
      });
    }
    return () => minuteries.forEach(m => window.clearTimeout(m));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`lecteur fin-lecon${derniere ? ' fin-chapitre' : ''}`}>
      <div className="fin-sceau" ref={sceau}><SceauLecon id={lesson.id} taille={96} /></div>
      <ol className="fin-gue" aria-hidden="true">
        {liste.map(e => (
          <li key={e.lecon.id} className={`${e.etat === 'faite' ? 'faite' : ''}${e.lecon.id === lesson.id ? ' juste-posee' : ''}`}><i /></li>
        ))}
      </ol>
      <h2 className="fin-titre" ref={titreRef} tabIndex={-1}>{titre}</h2>
      <p className="fin-acquis">{fr(acquis(lesson.id))}{chapitre && chap.fin && <> {fr(chap.fin)}</>}</p>
      {bouton(principale, 'cta')}
      {liens.map(a => bouton(a, 'lien'))}
      {gerbe && <Confettis origine={gerbe} onFin={() => setGerbe(null)} />}
    </div>
  );
}
