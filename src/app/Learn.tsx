// Onglet Apprendre (issues #40 et #54) : chemin de pierres sur les lignes d'un goban.
// Le lecteur de leçon et la fin de leçon sont dans Lecon.tsx (recette du 30/09, R2) ; ré-exportés ici pour src/app/ecrans.ts.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CHAPITRES, LESSONS, type Chapitre } from '../content/lessons';
import { SceauLecon } from '../ui/SceauLecon';
import { fr } from '../ui/typo';
import { type SyncState } from './hooks';
import { LIGNE, boutonChemin, chapitresAVenir, etapes, placeSousLigne, trace, traceJusqua, type Etape, type Progression } from './apprendre';
import { t } from '../content/i18n';
import '../ui/apprendre.css';

export { LessonPlayer, POSE_MS } from './Lecon';

/** Texte de l'état de synchronisation (#167 : clés `apprendre.synchro.*`). */
const texteSynchro = (s: SyncState) => t(`apprendre.synchro.${s}`);

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
        <h2 id="a-venir-titre" className="titre-pierres">{t('apprendre.bientot')}</h2>
        <p>{t('apprendre.bientot.texte')}</p>
        <ul>{chapitresAVenir().map(c => <li key={c}>{c}</li>)}</ul>
      </section>

      <p className={`synchro synchro-${sync}`} role="status" aria-busy={sync === 'sync'}>{texteSynchro(sync)}</p>
    </div>
  );
}

/** Phrase sous le titre d'un chapitre : son intro, l'avancée, ou la fin (« la suite arrive » pour un chapitre en cours d'écriture). */
function phraseChapitre(c: Chapitre, faites: number): string {
  const n = c.lecons.length;
  if (faites === 0) return c.intro;
  // Titre, intro et phrase de fin du chapitre : contenu des leçons (content/lessons.fr.js), traduit avec elles.
  if (faites === n) return c.complet ? `${t('apprendre.chapitre.termine')}${c.fin ? ` ${c.fin.replace(/\.$/, ' !')}` : ''}` : t('apprendre.chapitre.suite');
  return t('apprendre.bases.progres', { n: faites, total: n });
}

/** Chemin d'un chapitre : titre, puis ses pierres de gué sur les lignes d'un goban. */
function CheminChapitre({ chapitre, liste, k, boutonCta, onOpen, progress }: {
  chapitre: Chapitre; liste: Etape[]; k: number; boutonCta: ReactNode; onOpen: (id: string) => void; progress: Progression;
}) {
  const iEnCours = liste.findIndex(e => e.etat === 'encours');
  // #169 : place occupée par chaque rangée sous sa ligne, mesurée après l'affichage. Au zoom 200 %,
  // un titre sur plusieurs lignes repousse la rangée suivante au lieu de la chevaucher. À 390 px, tout tient : rien ne bouge.
  const [bas, setBas] = useState<number[]>([]);
  const tc = useMemo(() => trace(liste.length, { encours: iEnCours, bas }), [liste.length, iEnCours, bas]);
  const faites = liste.filter(e => e.etat === 'faite').length;
  // Tracé parcouru : jusqu'à la leçon en cours, tout le chapitre s'il est fini, rien s'il n'est pas commencé.
  const parcouru = traceJusqua(tc, iEnCours >= 0 ? iEnCours : faites === liste.length ? liste.length - 1 : -1);
  const chemin = useRef<HTMLOListElement>(null);
  // Une rangée qui change de hauteur sans nouveau rendu (police chargée après coup, texte agrandi) : on remesure.
  const [tour, remesurer] = useState(0);
  // Mesure avant l'affichage : si une rangée a changé de hauteur, le chemin est recalculé tout de suite.
  // Stable : la hauteur d'une rangée ne dépend pas de sa position, la seconde mesure donne le même résultat.
  useLayoutEffect(() => {
    const rangees = [...(chemin.current?.children ?? [])] as HTMLElement[];
    // #232 : depuis la ligne de la rangée, pas depuis le centre de sa pierre (dessinée plus bas quand le texte est plus haut qu'elle).
    const mesure = rangees.map(li => {
      const pierre = li.querySelector('.pierre-gue')?.getBoundingClientRect();
      const r = li.getBoundingClientRect();
      return pierre ? placeSousLigne({ haut: r.top, bas: r.bottom }, pierre.height) : 0;
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

      <div className="gue" style={{ height: tc.hauteur }}>
        <div className="gue-goban" aria-hidden="true">
          <svg width="1" height={tc.hauteur} focusable="false"><path d={lignesGoban(tc.hauteur)} transform={echelle} vectorEffect="non-scaling-stroke" /></svg>
        </div>
        <svg className="gue-trace" width="1" height={tc.hauteur} aria-hidden="true" focusable="false">
          <g transform={echelle}>
            <path d={tc.d} className="gue-route" vectorEffect="non-scaling-stroke" />
            {parcouru && <path d={parcouru} className="gue-parcouru" vectorEffect="non-scaling-stroke" />}
          </g>
        </svg>
        <ol ref={chemin}>
          {liste.map((e, i) => {
            const p = tc.pierres[i], droite = p.col > 0;
            const style = { top: p.y, '--x': `${p.x * k}px` } as CSSProperties;
            const etat = e.etat === 'faite' ? t('apprendre.pas.faite') : e.etat === 'encours' ? t('apprendre.pas.encours') : '';
            return (
              <li key={e.lecon.id} className={`pas pas-${e.etat} ${droite ? 'a-droite' : 'a-gauche'}`} style={style}>
                <button className="pas-bouton" data-etat={e.etat} aria-label={t('apprendre.pas', { rang: e.rang, titre: e.lecon.title, etat })} onClick={() => onOpen(e.lecon.id)}>
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
