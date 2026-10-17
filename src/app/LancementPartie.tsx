// #613 : étape de lancement d'une partie sur l'appareil (contre l'ordi, à deux). C'est l'ancienne feuille « Changer »
// de l'accueil (#429, #528), qui s'ouvre maintenant au moment de jouer : la taille du plateau (le dernier choix déjà
// coché), l'adversaire pour l'ordi, les réglages de la partie repliés, et une seule action, « Jouer ».
// Hors du JS initial : chargée à la demande (préchargée après le premier écran, src/app/ecrans.ts). Une feuille ne mène
// à aucune autre feuille (A12) : les réglages se déplient dans la même feuille.
import { Suspense, useEffect, useRef, useState } from 'react';
import type { CarteAdversaire } from '../ui/Carrousel';
import { CarrouselAdversaires, ReglagesPartie } from './ecrans';
import { estDefaut, komiDeLaPartie, type ReglagesPartie as ValeurReglages } from './reglagesPartie';
import type { Opponent } from '../engine';
import type { Lancement } from './modes';
import { fr } from '../ui/typo';
import { nombre, t } from '../content/i18n';

type Taille = 9 | 13 | 19;

const AIDE_TAILLE = { 9: 'accueil.aideTaille.9', 13: 'accueil.aideTaille.13', 19: 'accueil.aideTaille.19' } as const satisfies Record<Taille, string>;

export interface ReglagesAvances {
  valeur: ValeurReglages;
  changer: (r: ValeurReglages, cle: 'handicap' | 'komi' | 'regles' | 'retablir') => void;
  komiAuto: number;
}

interface Props {
  /** Mode lancé ; null : la feuille se ferme (elle reste montée pour sa sortie animée). */
  mode: Lancement | null;
  /** Dernier mode ouvert : son contenu reste pendant la sortie. */
  dernier: Lancement;
  fermer: () => void;
  adv: Opponent;
  cartes: CarteAdversaire<Opponent['id']>[];
  taille: Taille;
  onTaille: (t: Taille) => void;
  onChoisir: (id: Opponent['id']) => void;
  /** « Jouer contre Caillou » : libellé et nom accessible du bouton contre l'ordi. */
  cta: string;
  ctaNom: string;
  /** Lance la partie du mode, avec la taille et l'adversaire choisis. */
  onJouer: (mode: Lancement) => void;
  reglagesPartie?: ReglagesAvances;
}

/** Feuille de lancement : contre l'ordi, adversaire et taille ; à deux, la taille seule. */
export function FeuilleLancement({ mode, dernier, fermer, adv, cartes, taille, onTaille, onChoisir, cta, ctaNom, onJouer, reglagesPartie }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const ouvert = mode !== null;
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ouvert && !d.open) d.showModal?.();
    if (!ouvert && d.open) d.close();
  }, [ouvert]);
  // #528 : « Réglages de la partie », replié à chaque ouverture de la feuille : le débutant ne le voit pas.
  const [avances, setAvances] = useState(false);
  useEffect(() => { if (!ouvert) setAvances(false); }, [ouvert]);
  const ordi = (mode ?? dernier) === 'ordi';
  const rp = reglagesPartie?.valeur;
  const resume = ordi && rp && !estDefaut(rp) ? t('partie.reglages.resume', {
    h: rp.handicap >= 2 ? rp.handicap : t('partie.reglages.handicap.aucun').toLowerCase(),
    k: nombre(komiDeLaPartie(rp, reglagesPartie.komiAuto)),
    r: t(`partie.reglages.regles.${rp.regles}`).toLowerCase(),
  }) : null;

  return (
    <dialog ref={ref} className="feuille" aria-labelledby="feuille-titre" data-testid="feuille-lancement" data-mode={mode ?? dernier}
      onClose={fermer}
      // Un toucher sur le voile (hors de la feuille) la ferme.
      onClick={e => { if (e.target === ref.current) fermer(); }}>
      {ouvert && (
        <div className="feuille-corps">
          <div className="feuille-tete">
            <h2 id="feuille-titre">{t(ordi ? 'accueil.tonAdversaire' : 'mode.deux')}</h2>
            <button className="lien" onClick={fermer}>{t('accueil.fermer')}</button>
          </div>
          {/* Audit du 02/10 (n° 5) : la taille du plateau en tête, sur une ligne. Le dernier choix est déjà coché. */}
          <div className="feuille-taille" role="group" aria-labelledby="feuille-taille-titre" aria-describedby="feuille-taille-aide">
            <h3 id="feuille-taille-titre">{t('accueil.taillePlateau')}</h3>
            <div className="seg">
              {([9, 13, 19] as const).map(n => <button key={n} aria-pressed={taille === n} onClick={() => onTaille(n)}>{n} × {n}</button>)}
            </div>
            <p id="feuille-taille-aide" className="muted small">{t(AIDE_TAILLE[taille])}</p>
          </div>
          {ordi && <>
            {/* #509 (L4, n° 10) : les adversaires se choisissent par leur grade (« 20 kyu ») ; le mot est expliqué juste avant. */}
            <p className="feuille-kyu muted small" data-testid="feuille-kyu">{fr(t('accueil.kyu'))}</p>
            <Suspense fallback={<div className="carrousel-attente" aria-busy="true" />}>
              <CarrouselAdversaires cartes={cartes} choisi={adv.id} onChoisir={onChoisir} legende={t(`adv.${adv.id}.description`)} />
            </Suspense>
            {reglagesPartie && (
              <div className="feuille-avances">
                <button type="button" className="lien feuille-avances-bouton" aria-expanded={avances} aria-controls={avances ? 'reglages-partie' : undefined}
                  data-testid="reglages-partie-ouvrir" onClick={() => setAvances(o => !o)}>
                  {t('partie.reglages.titre')}<span aria-hidden="true">{avances ? ' ▴' : ' ▾'}</span>
                </button>
                {resume && <p className="muted small" data-testid="reglages-partie-resume">{fr(resume)}</p>}
                {avances && (
                  <Suspense fallback={<p className="muted small" aria-busy="true">{t('partie.reglages.chargement')}</p>}>
                    <ReglagesPartie valeur={reglagesPartie.valeur} onChange={reglagesPartie.changer} />
                  </Suspense>
                )}
              </div>
            )}
          </>}
          {/* Une seule action : la partie, avec ce qui est choisi au-dessus. */}
          <button className="btn primary" data-testid="lancement-jouer" aria-label={ordi ? ctaNom : t('lancement.deuxNom')}
            onClick={() => onJouer(ordi ? 'ordi' : 'deux')}>{ordi ? cta : t('lancement.jouer')}</button>
        </div>
      )}
    </dialog>
  );
}
