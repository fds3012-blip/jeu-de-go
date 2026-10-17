// #590 : page d'un thème, ouverte depuis « Par thème » d'Apprendre (chargée à la demande, src/app/ecrans.ts).
// Le nom du thème, une phrase qui explique la notion, les leçons du thème avec leur état, et une seule action en relief :
// « S'entraîner sur ce thème », la série de 3 problèmes de la fin de leçon (SeriePratique), restreinte à ce thème.
// Aucun nouveau contenu de go : les leçons viennent du chemin, les problèmes de la banque (src/content/themes.ts).
import { useState } from 'react';
import { LESSONS } from '../content/lessons';
import type { Theme } from '../content/themesLecons';
import type { Puzzle } from '../data/puzzles';
import { EnteteEcran } from '../ui/BoutonRetour';
import { VignetteLecon } from '../ui/VignetteLecon';
import { fr } from '../ui/typo';
import { readLocal } from './hooks';
import { leconsDuTheme } from './themesApprendre';
import { t } from '../content/i18n/secondaires';
import '../ui/apprendre.css';

/** Problèmes réussis sur l'appareil : même clé que SOLVED_KEY de Puzzles.tsx (vérifié par ecrans.test.ts). */
const SOLVED_KEY = 'go.problemes.v1';

const Coche = () => <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5 10 17l9-10" /></svg>;

export function ThemeLecons({ theme, progress, onOpen, onRetour, onSerie }: {
  theme: Theme; progress: Record<string, number>;
  onOpen: (id: string) => void; onRetour: () => void;
  /** La série est prête : App vérifie le compte (essai sans compte, #343) puis l'ouvre. */
  onSerie: (problemes: Puzzle[]) => void;
}) {
  const lecons = leconsDuTheme(theme, LESSONS);
  const faites = lecons.filter(l => (progress[l.id] ?? 0) >= l.steps.length).length;
  const nom = t(`theme.${theme}`);
  const [etat, setEtat] = useState<'pret' | 'charge' | 'erreur'>('pret');

  const entrainer = () => {
    setEtat('charge');
    void Promise.all([import('../content/problemesLocaux'), import('../content/themes')])
      .then(([{ PROBLEMES_LOCAUX }, { serieDeTheme }]) => {
        const s = serieDeTheme(theme, PROBLEMES_LOCAUX, new Set(Object.keys(readLocal<Record<string, true>>(SOLVED_KEY, {}))));
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
            const faite = (progress[l.id] ?? 0) >= l.steps.length;
            return (
              <li key={l.id}>
                <button type="button" className="theme-lecon" data-faite={faite || undefined} onClick={() => onOpen(l.id)}
                  aria-label={`${fr(l.title)}, ${t(faite ? 'apprendre.theme.faite' : 'apprendre.theme.afaire')}`}>
                  <VignetteLecon id={l.id} taille={44} pale={!(progress[l.id] ?? 0)} />
                  <span className="theme-lecon-texte" aria-hidden="true"><b>{fr(l.title)}</b><small>{fr(l.desc)}</small></span>
                  <span className="theme-lecon-etat" aria-hidden="true">{faite && <Coche />}{t(faite ? 'apprendre.theme.faite' : 'apprendre.theme.afaire')}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {etat === 'erreur' && <p className="notice" role="alert">{fr(t('apprendre.theme.horsLigne'))}</p>}
      <button type="button" className="cta theme-entrainer" aria-busy={etat === 'charge'} disabled={etat === 'charge'} onClick={entrainer}>
        {t('apprendre.theme.entrainer')}
      </button>
    </div>
  );
}
