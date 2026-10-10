// Choix de l'adversaire (issues #40 et #102) : grand portrait de l'adversaire choisi et sa bulle,
// puis les 9 adversaires groupés par palier (les 3 encres des sceaux), en vignettes rondes.
// Les verrouillés restent visibles (grisés, cadenas) mais ne se choisissent pas : un message dit qui battre d'abord.
// Les battus portent une couronne et le tampon « BATTU ».
import { useRef, useState, type KeyboardEvent } from 'react';
import { Couronne, Portrait, palierDe, type PortraitId } from './Portrait';
import { battuAccorde, type SceauId } from './sceaux';
import { fr } from './typo';
import { t } from '../content/i18n/secondaires';

export interface CarteAdversaire<I extends SceauId = SceauId> {
  id: I;
  nom: string;
  rang: string;
  battu: boolean;
  ouvert: boolean;
  /** Pour un verrouillé : le nom de l'adversaire à battre d'abord. */
  requis?: string;
}

interface Props<I extends SceauId> {
  cartes: CarteAdversaire<I>[];
  choisi: string;
  onChoisir: (id: I) => void;
  /** Réplique de l'adversaire choisi, dans sa bulle à côté du grand portrait. */
  legende?: string;
}

const PALIERS = ['carrousel.palier.0', 'carrousel.palier.1', 'carrousel.palier.2'] as const;

export function CarrouselAdversaires<I extends SceauId>({ cartes, choisi, onChoisir, legende }: Props<I>) {
  const zone = useRef<HTMLUListElement>(null);
  const [message, setMessage] = useState('');
  const actuel = cartes.find(c => c.id === choisi) ?? cartes[0];
  // #509 (L4, n° 22) : l'adversaire montré à l'ouverture ne s'anime pas ; seul un nouveau choix fait entrer le portrait.
  const [nouveau, setNouveau] = useState(false);

  function toucher(c: CarteAdversaire<I>) {
    if (!c.ouvert) { setMessage(fr(t('carrousel.verrou', { requis: c.requis ?? t('carrousel.precedent'), nom: c.nom }))); return; }
    setMessage('');
    if (c.id !== choisi) setNouveau(true);
    onChoisir(c.id);
  }

  // Flèches : passer d'une vignette à l'autre (Tab marche aussi).
  function clavier(e: KeyboardEvent<HTMLUListElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const boutons = [...(zone.current?.querySelectorAll<HTMLButtonElement>('button.carte') ?? [])];
    const i = boutons.indexOf(document.activeElement as HTMLButtonElement);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? boutons.length - 1 : Math.min(boutons.length - 1, Math.max(0, i + (e.key === 'ArrowRight' ? 1 : -1)));
    e.preventDefault();
    boutons[j]?.focus();
  }

  const groupes = PALIERS.map((cle, p) => ({ titre: t(cle), cartes: cartes.filter(c => c.id !== 'mochi' && palierDe(c.id as PortraitId) === p) }));

  return (
    <>
      {actuel && actuel.id !== 'mochi' && (
        <div className="choix-vedette" data-nouveau={nouveau || undefined}>
          {/* La clé relance l'entrée à chaque nouveau choix (accueil.css, `[data-nouveau]`). */}
          <Portrait key={actuel.id} id={actuel.id as PortraitId} taille={104} decoratif className="vedette-portrait" />
          <div className="vedette-bulle">
            <b>{actuel.nom} <small>{actuel.rang}</small></b>
            <p className={`carrousel-legende${message ? ' alerte' : ''}`} aria-live="polite">{message || legende}</p>
          </div>
        </div>
      )}
      <ul className="paliers" ref={zone} onKeyDown={clavier} aria-label={t('carrousel.aria')}>
        {groupes.map(g => (
          <li key={g.titre} className="palier">
            <h3>{g.titre}</h3>
            <ul className="carrousel">
              {g.cartes.map(c => {
                const etat = !c.ouvert ? `, ${t('carrousel.verrouille')}` : c.battu ? `, ${battuAccorde(c.id)}` : '';
                return (
                  <li key={c.id}>
                    <button className={`carte${c.ouvert ? '' : ' verrou'}`} aria-pressed={c.id === choisi} aria-disabled={!c.ouvert || undefined}
                      aria-label={`${c.nom}, ${c.rang}${etat}`} onClick={() => toucher(c)}>
                      <span className="vignette">
                        <Portrait id={c.id as PortraitId} taille={52} rond decoratif signature={false} />
                        {!c.ouvert && (
                          <span className="vignette-cadenas" aria-hidden="true">
                            <svg viewBox="0 0 16 16" width="100%" height="100%" focusable="false">
                              <path d="M5 7V5.2a3 3 0 0 1 6 0V7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                              <rect x="3.2" y="7" width="9.6" height="7" rx="1.8" fill="currentColor" />
                            </svg>
                          </span>
                        )}
                        {c.battu && c.ouvert && <span className="vignette-couronne"><Couronne /></span>}
                        {c.battu && c.ouvert && <span className="vignette-tampon" aria-hidden="true">{battuAccorde(c.id).toUpperCase()}</span>}
                      </span>
                      <b>{c.nom}</b>
                      <small>{c.rang}</small>
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </>
  );
}
