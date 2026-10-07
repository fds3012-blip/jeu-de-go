// Onglet Apprendre (issues #40, #54 ; chemin v3) : chemin des leçons en courbe, chapitres illustrés, carte de la prochaine leçon.
// Le lecteur de leçon et la fin de leçon sont dans Lecon.tsx (recette du 30/09, R2) ; ré-exportés ici pour src/app/ecrans.ts.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CHAPITRES, LESSONS, type Chapitre } from '../content/lessons';
import { Bubble } from '../ui/Mochi';
import { VignetteLecon } from '../ui/VignetteLecon';
import { Confettis } from '../ui/Confettis';
import { fr } from '../ui/typo';
import { readLocal, writeLocal, type SyncState } from './hooks';
import { FETES_KEY, boutonChemin, chapitresAFeter, chapitresAVenir, colonne, courbe, dureeMinutes, etapes, type Ancre, type Etape, type Progression } from './apprendre';
import { t } from '../content/i18n/secondaires';
import '../ui/apprendre.css';

export { LessonPlayer, POSE_MS } from './Lecon';

/** Texte de l'état de synchronisation (#167 : clés `apprendre.synchro.*`). */
const texteSynchro = (s: SyncState) => t(`apprendre.synchro.${s}`);

/** Écart horizontal d'une colonne du chemin, en px à 390 px de large ; mis à l'échelle de l'écran en dessous (#121). */
const PAS_X = 92;

const Coche = () => <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5 10 17l9-10" /></svg>;
/** Verrou « compte » (#343) : une silhouette, pas un cadenas de progression ; la leçon reste touchable et mène à la création de compte. */
const Compte = () => <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="8.5" r="3.5" /><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" /></svg>;
const Horloge = () => <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>;

/** Ce que dit Mochi sur la carte de la prochaine leçon : commencer, reprendre, continuer, ou tout est fait. */
function phraseMochi(liste: Etape[], iEnCours: number): string {
  if (iEnCours < 0) return t('apprendre.mochi.fini');
  if (liste[iEnCours].faites > 0) return t('apprendre.mochi.reprendre');
  return t(iEnCours === 0 ? 'apprendre.mochi.debut' : 'apprendre.mochi.suite');
}

/**
 * `compteRequis` (#343) : vrai si la leçon de ce rang (0 = leçon 1) demande un compte. Sans compte, les leçons 1 à 3 sont libres ;
 * les suivantes restent touchables, portent le verrou « compte », et `onOpen` ouvre la création de compte (garde d'App.tsx).
 */
export function LearnHome({ progress, onOpen, sync = 'local', compteRequis = () => false }: {
  progress: Progression; onOpen: (id: string) => void; sync?: SyncState; compteRequis?: (rang: number) => boolean;
}) {
  const liste = etapes(LESSONS, progress);
  const iEnCours = liste.findIndex(e => e.etat === 'encours');
  const bouton = boutonChemin(LESSONS, progress);
  const carte = useRef<HTMLLIElement | HTMLDivElement>(null);
  // #121 : sous 390 px, les écarts horizontaux du chemin sont mis à l'échelle de l'écran ; à 390 px et plus, k = 1.
  const [k, setK] = useState(() => Math.min(1, window.innerWidth / 390));
  useEffect(() => {
    const maj = () => setK(Math.min(1, window.innerWidth / 390));
    window.addEventListener('resize', maj);
    return () => window.removeEventListener('resize', maj);
  }, []);

  // Fête de fin de chapitre : une seule fois par chapitre, mémorisée sur l'appareil.
  const [fete, setFete] = useState<string | null>(() => chapitresAFeter(CHAPITRES, progress, readLocal<string[]>(FETES_KEY, []))[0] ?? null);
  useEffect(() => {
    if (fete) writeLocal(FETES_KEY, [...new Set([...readLocal<string[]>(FETES_KEY, []), fete])]);
  }, [fete]);

  // Le chemin s'ouvre sur la prochaine leçon : si sa carte est sous la ligne de flottaison, on défile jusqu'à elle, d'un coup.
  // Un chapitre à fêter passe avant : on s'arrête sur son en-tête, là où le tampon d'or se pose.
  useEffect(() => {
    const section = fete ? document.querySelector<HTMLElement>(`[data-chapitre="${fete}"]`) : null;
    const r = (section ?? carte.current)?.getBoundingClientRect();
    if (!r) return;
    const bas = window.innerHeight - 96;
    if (section) { if (r.top > bas - 160 || r.top < 0) window.scrollBy({ top: r.top - 12, behavior: 'instant' as ScrollBehavior }); return; }
    if (r.bottom > bas) window.scrollBy({ top: Math.max(0, Math.min(r.top - 88, r.bottom - bas)), behavior: 'instant' as ScrollBehavior });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const prochaine = bouton && (
    <CarteProchaine refCarte={carte} etape={iEnCours >= 0 ? liste[iEnCours] : liste[0]} bouton={bouton} mochi={phraseMochi(liste, iEnCours)} onOpen={onOpen} compteRequis={compteRequis} />
  );

  return (
    <div className="apprendre">
      {/* #228 : un chemin par chapitre, l'un sous l'autre ; une seule carte en relief, celle de la prochaine leçon. */}
      {CHAPITRES.map(c => (
        <CheminChapitre key={c.id} chapitre={c} liste={liste.filter(e => c.lecons.includes(e.lecon))} k={k}
          carte={iEnCours >= 0 && c.lecons.includes(liste[iEnCours].lecon) ? prochaine : null}
          fete={fete === c.id} onFeteFinie={() => setFete(null)} onOpen={onOpen} compteRequis={compteRequis} />
      ))}

      {iEnCours < 0 && <div className="chemin-fini">{prochaine}</div>}

      <section className="a-venir" aria-labelledby="a-venir-titre">
        <h2 id="a-venir-titre" className="titre-pierres">{t('apprendre.bientot')}</h2>
        <p>{t('apprendre.bientot.texte')}</p>
        <ul>{chapitresAVenir().map(c => <li key={c}>{c}</li>)}</ul>
      </section>

      <p className={`synchro synchro-${sync}`} role="status" aria-busy={sync === 'sync'}>{texteSynchro(sync)}</p>
    </div>
  );
}

/** Nom accessible d'une pierre du chemin : rang, titre, état, et « avec un compte » si elle en demande un. */
function nomPas(e: Etape, compte = false): string {
  const etat = (e.etat === 'faite' ? t('apprendre.pas.faite') : e.etat === 'encours' ? t('apprendre.pas.encours') : '') + (compte ? t('apprendre.pas.compte') : '');
  const taille = e.lecon.taille && e.lecon.taille !== 9 ? `, ${t('apprendre.taille', { n: e.lecon.taille })}` : '';
  return t('apprendre.pas', { rang: e.rang, titre: e.lecon.title + taille, etat });
}

/** #454 : « 19 × 19 » sous le titre d'une leçon sur un grand plateau ; rien pour le 9 × 9. */
const MentionTaille = ({ taille }: { taille?: number }) =>
  taille && taille !== 9 ? <span className="pas-taille" data-taille={taille}>{t('apprendre.taille', { n: taille })}</span> : null;

/**
 * Carte de la prochaine leçon : Mochi la présente, la vignette et le titre disent de quoi il s'agit,
 * la promesse et la durée donnent envie, et le seul bouton en relief de l'écran l'ouvre.
 */
/** Mention visible sous une leçon qui demande un compte. */
const MentionCompte = () => <span className="pas-compte"><Compte />{t('apprendre.compte')}</span>;

function CarteProchaine({ etape, bouton, mochi, onOpen, refCarte, compteRequis }: {
  etape: Etape; bouton: NonNullable<ReturnType<typeof boutonChemin>>; mochi: string; onOpen: (id: string) => void;
  compteRequis: (rang: number) => boolean;
  refCarte: React.RefObject<HTMLLIElement | HTMLDivElement | null>;
}) {
  const l = etape.lecon, compte = compteRequis(etape.rang - 1);
  return (
    <div className="prochaine" ref={refCarte as React.RefObject<HTMLDivElement>} data-testid="prochaine-lecon">
      <Bubble>{fr(mochi)}</Bubble>
      <div className="prochaine-carte">
        <button className="pas-bouton" data-etat={etape.etat} data-compte={compte || undefined} aria-label={nomPas(etape, compte)} onClick={() => onOpen(l.id)}>
          <span className="pas-texte" aria-hidden="true">
            <VignetteLecon id={l.id} taille={72} />
            <span>
              <b>{fr(l.title)}</b>
              <small>{fr(l.desc)}</small>
              <MentionTaille taille={l.taille} />
              <span className="prochaine-duree"><Horloge />{t('apprendre.duree', { n: dureeMinutes(l.steps.length) })}</span>
              {compte && <MentionCompte />}
            </span>
          </span>
        </button>
        <button className="cta cta-chemin" aria-label={fr(bouton.texte)} onClick={() => onOpen(bouton.id)}>{bouton.verbe}</button>
      </div>
    </div>
  );
}

/** Phrase sous le titre d'un chapitre : son intro, ou la fin (« la suite arrive » pour un chapitre en cours d'écriture). */
function phraseChapitre(c: Chapitre, faites: number): string {
  if (faites < c.lecons.length) return c.intro;
  // Titre, intro et phrase de fin du chapitre : contenu des leçons (content/lessons.fr.js), traduit avec elles.
  return c.complet ? `${t('apprendre.chapitre.termine')}${c.fin ? ` ${c.fin.replace(/\.$/, ' !')}` : ''}` : t('apprendre.chapitre.suite');
}

/** Chemin d'un chapitre : en-tête illustré, puis ses pierres sur une courbe, la prochaine leçon en carte. */
function CheminChapitre({ chapitre, liste, k, carte, fete, onFeteFinie, onOpen, compteRequis }: {
  chapitre: Chapitre; liste: Etape[]; k: number; carte: ReactNode; fete: boolean; onFeteFinie: () => void; onOpen: (id: string) => void;
  compteRequis: (rang: number) => boolean;
}) {
  const iEnCours = liste.findIndex(e => e.etat === 'encours');
  const faites = liste.filter(e => e.etat === 'faite').length;
  const n = liste.length, fini = n > 0 && faites === n;
  const chemin = useRef<HTMLOListElement>(null);
  const embleme = useRef<HTMLSpanElement>(null);
  // Ancres mesurées à l'écran (centre des pierres, haut et bas de la carte) : la courbe les suit.
  const [ancres, setAncres] = useState<{ points: Ancre[]; parcouru: number; hauteur: number }>({ points: [], parcouru: 0, hauteur: 0 });
  const mesurer = () => {
    const ol = chemin.current;
    if (!ol) return;
    const boite = ol.getBoundingClientRect(), milieu = boite.left + boite.width / 2;
    const points: Ancre[] = [];
    let parcouru = 0;
    [...ol.children].forEach((li, i) => {
      const pierre = li.querySelector('.pierre-gue');
      if (pierre) {
        const r = pierre.getBoundingClientRect();
        points.push({ x: r.left + r.width / 2 - milieu, y: r.top + r.height / 2 - boite.top });
        if (liste[i]?.etat === 'faite' && (i < iEnCours || iEnCours < 0)) parcouru = points.length;
      } else {
        const r = li.getBoundingClientRect();
        points.push({ x: 0, y: r.top - boite.top + 4 });
        parcouru = points.length;
        points.push({ x: 0, y: r.bottom - boite.top - 4 });
      }
    });
    const hauteur = Math.round(boite.height);
    setAncres(a => (a.hauteur === hauteur && a.parcouru === parcouru && a.points.length === points.length && a.points.every((p, i) => p.x === points[i].x && p.y === points[i].y) ? a : { points, parcouru, hauteur }));
  };
  useLayoutEffect(mesurer, [k, liste, iEnCours]);
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !chemin.current) return;
    const obs = new ResizeObserver(mesurer);
    obs.observe(chemin.current);
    for (const li of chemin.current.children) obs.observe(li);
    return () => obs.disconnect();
  }, [liste.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const route = useMemo(() => courbe(ancres.points), [ancres.points]);
  const dore = useMemo(() => courbe(ancres.points.slice(0, fini ? ancres.points.length : ancres.parcouru)), [ancres, fini]);
  const [gerbe, setGerbe] = useState<null | { x: number; y: number }>(null);
  useEffect(() => {
    if (!fete) return;
    const r = embleme.current?.getBoundingClientRect();
    setGerbe(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth / 2, y: 160 });
  }, [fete]);

  return (
    <section className={`chapitre-chemin${fini ? ' chapitre-fini' : ''}`} data-chapitre={chapitre.id} data-fete={fete || undefined} aria-labelledby={`chapitre-${chapitre.id}`}>
      <header className="chapitre">
        <span ref={embleme} className="chapitre-embleme"><VignetteLecon id={chapitre.lecons[chapitre.lecons.length - 1]?.id ?? 'l1'} taille={52} /></span>
        <h2 id={`chapitre-${chapitre.id}`}>{fr(chapitre.titre)}</h2>
        <p>{fr(phraseChapitre(chapitre, faites))}</p>
        <div className="chapitre-compte">
          <span className="chapitre-pierres" aria-hidden="true">{liste.map(e => <i key={e.lecon.id} className={e.etat} />)}</span>
          {fini && chapitre.complet
            ? <span className="chapitre-fete" role="img" aria-label={fr(t('apprendre.fete.aria', { titre: chapitre.titre }))}><Coche />{t('apprendre.fete.titre')}</span>
            : <span>{faites > 0 ? t('apprendre.chapitre.avancee', { n: faites, total: n }) : t('apprendre.chapitre.lecons', { n })}</span>}
        </div>
      </header>

      <div className="gue">
        <svg className="gue-trace" width="1" height={ancres.hauteur} aria-hidden="true" focusable="false">
          <path d={route} className="gue-route" />
          {dore && <path d={dore} className="gue-parcouru" />}
        </svg>
        <ol ref={chemin}>
          {liste.map((e, i) => {
            if (e.etat === 'encours' && carte) return <li key={e.lecon.id} className="pas pas-encours">{carte}</li>;
            // Sous 390 px, toutes les pierres vont au bord (±1) : un titre comme « Techniques » garde sa ligne en face.
            const col = k < 1 ? Math.sign(colonne(i)) : colonne(i), droite = col > 0;
            const style = { '--x': `${Math.round(col * PAS_X * k)}px` } as CSSProperties;
            // À venir : pierre grise, toujours touchable (on peut sauter une leçon). Seul le compte (#343) verrouille.
            const avenir = e.etat === 'avenir', compte = e.etat !== 'faite' && compteRequis(e.rang - 1);
            return (
              <li key={e.lecon.id} className={`pas pas-${e.etat} ${droite ? 'a-droite' : 'a-gauche'}`} style={style}>
                <button className="pas-bouton" data-etat={e.etat} data-compte={compte || undefined} aria-label={nomPas(e, compte)} onClick={() => onOpen(e.lecon.id)}>
                  <span className="pierre-gue" aria-hidden="true">
                    {e.etat === 'faite' && <span className="pierre-coche"><Coche /></span>}
                    {compte && <span className="pierre-compte"><Compte /></span>}
                  </span>
                  <span className="pas-texte" aria-hidden="true">
                    <VignetteLecon id={e.lecon.id} taille={44} pale={avenir} />
                    <span><b>{fr(e.lecon.title)}</b><small>{fr(e.lecon.desc)}</small><MentionTaille taille={e.lecon.taille} />{compte && <MentionCompte />}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      {gerbe && <Confettis origine={gerbe} onFin={() => { setGerbe(null); onFeteFinie(); }} />}
    </section>
  );
}
