// #528 : « Réglages de la partie », groupe replié de la feuille « Changer » : handicap, komi, règle de comptage.
// Chargé seulement quand le joueur ouvre le groupe (hors du JS et du CSS initiaux) ; les textes sont dans fr.ts
// (clés `partie.reglages.*`) pour s'afficher sans attendre les textes des écrans secondaires.
import { nombre, t } from '../content/i18n';
import { fr } from './typo';
import { KOMI_DEBUTANT, KOMI_NORMAL } from '../app/equilibrage';
import { estDefaut, handicapVoisin, HANDICAPS, KOMI_HANDICAP, KOMIS, REGLAGES_DEFAUT, type ChoixKomi, type ReglagesPartie as Reglages } from '../app/reglagesPartie';
import type { Rules } from '../go/score';
import './reglagesPartie.css';

interface Props {
  valeur: Reglages;
  onChange: (r: Reglages, cle: 'handicap' | 'komi' | 'regles' | 'retablir') => void;
}

const REGLES: readonly Rules[] = ['japanese', 'chinese'];

export function ReglagesPartie({ valeur, onChange }: Props) {
  const { handicap, komi, regles } = valeur;
  const avecHandicap = handicap >= 2;
  const maxi = HANDICAPS[HANDICAPS.length - 1];
  const changer = (patch: Partial<Reglages>, cle: 'handicap' | 'komi' | 'regles') => onChange({ ...valeur, ...patch }, cle);
  const libelleKomi = (k: ChoixKomi) => (k === 'auto' ? t('partie.reglages.komi.auto') : nombre(k));
  return (
    <div className="reglages-partie" id="reglages-partie" data-testid="reglages-partie">
      <div className="rp-groupe" role="group" aria-labelledby="rp-handicap" aria-describedby="rp-handicap-aide">
        <h3 id="rp-handicap">{t('partie.reglages.handicap')}</h3>
        <div className="rp-pas">
          <button type="button" className="btn" aria-label={t('partie.reglages.handicap.moins')} disabled={handicap === 0}
            onClick={() => changer({ handicap: handicapVoisin(handicap, -1) }, 'handicap')}>−</button>
          <output aria-live="polite" data-testid="rp-handicap-valeur">
            {avecHandicap ? t('partie.reglages.handicap.n', { n: handicap }) : t('partie.reglages.handicap.aucun')}
          </output>
          <button type="button" className="btn" aria-label={t('partie.reglages.handicap.plus')} disabled={handicap === maxi}
            onClick={() => changer({ handicap: handicapVoisin(handicap, 1) }, 'handicap')}>+</button>
        </div>
        <p id="rp-handicap-aide" className="muted small">{fr(t('partie.reglages.handicap.aide'))}</p>
      </div>
      <div className="rp-groupe" role="group" aria-labelledby="rp-komi" aria-describedby="rp-komi-aide">
        <h3 id="rp-komi">{t('partie.reglages.komi')}</h3>
        <div className="seg">
          {(['auto', ...KOMIS] as const).map(k => (
            // Avec un handicap, le komi est imposé (0,5) : les choix restent visibles, grisés, et la phrase dit pourquoi.
            <button key={k} type="button" aria-pressed={avecHandicap ? k === KOMI_HANDICAP : komi === k} disabled={avecHandicap}
              onClick={() => changer({ komi: k }, 'komi')}>{libelleKomi(k)}</button>
          ))}
        </div>
        <p id="rp-komi-aide" className="muted small">{fr(avecHandicap
          ? t('partie.reglages.komi.handicap', { k: nombre(KOMI_HANDICAP) })
          : t('partie.reglages.komi.aide', { debut: nombre(KOMI_DEBUTANT), normal: nombre(KOMI_NORMAL) }))}</p>
      </div>
      <div className="rp-groupe" role="group" aria-labelledby="rp-regles" aria-describedby="rp-regles-aide">
        <h3 id="rp-regles">{t('partie.reglages.regles')}</h3>
        <div className="seg">
          {REGLES.map(r => (
            <button key={r} type="button" aria-pressed={regles === r} onClick={() => changer({ regles: r }, 'regles')}>{t(`partie.reglages.regles.${r}`)}</button>
          ))}
        </div>
        <p id="rp-regles-aide" className="muted small">{fr(t(`partie.reglages.regles.aide.${regles}`))}</p>
      </div>
      {!estDefaut(valeur) && (
        <button type="button" className="lien rp-retablir" onClick={() => onChange(REGLAGES_DEFAUT, 'retablir')}>{t('partie.reglages.retablir')}</button>
      )}
    </div>
  );
}
