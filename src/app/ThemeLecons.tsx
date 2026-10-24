// #590 : page d'un thème, ouverte depuis « Par thème » d'Apprendre (chargée à la demande, src/app/ecrans.ts).
// Le nom du thème, une phrase qui explique la notion, les leçons du thème (le sceau de la leçon quand elle est faite,
// #627), et une seule action en relief :
// « S'entraîner sur ce thème », la série de 3 problèmes de la fin de leçon (SeriePratique), restreinte à ce thème.
// Aucun nouveau contenu de go : les leçons viennent du programme, les problèmes de la banque (src/content/themes.ts).
// #652 : c'est désormais la seule porte vers une leçon qui n'est pas la prochaine. Chaque ligne garde l'accès d'avant
// (#343) : sans compte, une leçon après la 3e porte le verrou « Avec un compte », reste touchable, et `onOpen` ouvre la
// création de compte ; son nom accessible dit son rang dans le programme et son état (« Leçon 4 : Le ko, avec un compte »).
import { useState } from 'react';
import { LESSONS } from '../content/lessons';
import type { Theme } from '../content/themesLecons';
import type { Puzzle } from '../data/puzzles';
import { EnteteEcran } from '../ui/BoutonRetour';
import { SceauLecon } from '../ui/SceauLecon';
import { VignetteLecon } from '../ui/VignetteLecon';
import { fr } from '../ui/typo';
import { readLocal, writeLocal } from './hooks';
import { leconsDuTheme } from './themesApprendre';
import { etapes, nomLecon } from './apprendre';
import { MentionCompte } from '../ui/MentionCompte';
import { t } from '../content/i18n/secondaires';
import '../ui/apprendre.css';

/** Problèmes réussis et vus sur l'appareil : mêmes clés que SOLVED_KEY et VUS_KEY de Puzzles.tsx (vérifié par ecrans.test.ts). */
const SOLVED_KEY = 'go.problemes.v1';
const VUS_KEY = 'go.problemes.vus.v1';
/** #683 : problèmes déjà proposés par chaque thème, du plus ancien au plus récent (rotation de la série). */
const PROPOSES_KEY = 'go.themes.proposes.v1';

export function ThemeLecons({ theme, progress, onOpen, onRetour, onSerie, compteRequis = () => false }: {
  theme: Theme; progress: Record<string, number>;
  /** #343 : vrai si la leçon de ce rang (0 = leçon 1) demande un compte (même règle que la carte de la prochaine leçon). */
  compteRequis?: (rang: number) => boolean;
  onOpen: (id: string) => void; onRetour: () => void;
  /** La série est prête : App vérifie le compte (essai sans compte, #343) puis l'ouvre. */
  onSerie: (problemes: Puzzle[]) => void;
}) {
  const lecons = leconsDuTheme(theme, LESSONS);
  const etape = new Map(etapes(LESSONS, progress).map(e => [e.lecon.id, e]));
  const faites = lecons.filter(l => (progress[l.id] ?? 0) >= l.steps.length).length;
  const nom = t(`theme.${theme}`);
  const [etat, setEtat] = useState<'pret' | 'charge' | 'erreur' | 'epuise'>('pret');

  /** `refaire` : le thème est épuisé (tout est fait ou vu) et le joueur choisit de réviser quand même (#694). */
  const entrainer = (refaire = false) => {
    setEtat('charge');
    void Promise.all([import('../content/problemesLocaux'), import('../content/themes')])
      .then(([{ PROBLEMES_LOCAUX }, { serieDeTheme, noterProposes }]) => {
        const faits = new Set([SOLVED_KEY, VUS_KEY].flatMap(k => Object.keys(readLocal<Record<string, true>>(k, {}) ?? {})));
        const tous = readLocal<Record<string, unknown>>(PROPOSES_KEY, {}) ?? {};
        const proposes = Array.isArray(tous[theme]) ? (tous[theme] as unknown[]).filter((id): id is string => typeof id === 'string') : [];
        const complete = serieDeTheme(theme, PROBLEMES_LOCAUX, faits, undefined, proposes);
        // #694 : jamais une série qui rejoue des problèmes déjà faits sans le dire. Les problèmes neufs d'abord et seuls ;
        // s'il n'y en a plus, le thème est épuisé : on le dit, et le joueur peut réviser s'il le veut.
        const neufs = complete.filter(p => !faits.has(p.id));
        if (!refaire && neufs.length === 0) { setEtat('epuise'); return; }
        const s = refaire ? complete : neufs;
        writeLocal(PROPOSES_KEY, { ...tous, [theme]: noterProposes(proposes, s.map(p => p.id)) });
        // Chaque thème a au moins 3 problèmes (src/content/themes.test.ts) : la série n'est jamais vide.
        setEtat('pret');
        onSerie(s);
      }, () => setEtat('erreur'));
  };

  return (
    <div className="theme-lecons" data-theme-lecons={theme}>
      <EnteteEcran titre={nom} id="theme-titre" retour={t('partie.retourApprendre')} onRetour={onRetour} />
      <p className="theme-lecons-texte">{fr(t(`apprendre.theme.texte.${theme}`))}</p>

      <section aria-labelledby="theme-lecons-titre">
        <h3 id="theme-lecons-titre" className="theme-lecons-sous">
          {t('apprendre.theme.lecons')}<span>{t('apprendre.chapitre.avancee', { n: faites, total: lecons.length })}</span>
        </h3>
        <ul className="theme-lecons-liste">
          {lecons.map(l => {
            const e = etape.get(l.id)!, faite = e.etat === 'faite', compte = !faite && compteRequis(e.rang - 1);
            return (
              <li key={l.id}>
                <button type="button" className="theme-lecon" data-faite={faite || undefined} data-etat={e.etat} data-compte={compte || undefined}
                  onClick={() => onOpen(l.id)} aria-label={fr(nomLecon(e, compte))}>
                  <VignetteLecon id={l.id} taille={44} pale={!(progress[l.id] ?? 0)} />
                  <span className="theme-lecon-texte" aria-hidden="true"><b>{fr(l.title)}</b><small>{fr(l.desc)}</small>{compte && <MentionCompte />}</span>
                  {/* #627 (V12, P2) : une leçon faite porte son sceau, comme à la fin de la leçon ; plus de pastille texte.
                      L'état se lit aussi dans le nom accessible (« Faite », « À faire »), jamais par la couleur seule. */}
                  {faite && <SceauLecon id={l.id} taille={32} className="theme-lecon-sceau" />}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {etat === 'erreur' && <p className="notice" role="alert">{fr(t('apprendre.theme.horsLigne'))}</p>}
      {etat === 'epuise' && (
        <div className="notice" role="status" data-theme-epuise="">
          <p>{fr(t('apprendre.theme.epuise'))}</p>
          <button type="button" className="lien" onClick={() => entrainer(true)}>{t('apprendre.theme.refaire')}</button>
        </div>
      )}
      <button type="button" className="cta theme-entrainer" aria-busy={etat === 'charge'} disabled={etat === 'charge'} onClick={() => entrainer()}>
        {t('apprendre.theme.entrainer')}
      </button>
    </div>
  );
}
