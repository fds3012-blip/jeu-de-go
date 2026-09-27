// Carrousel horizontal des adversaires (issue #40, phase 4) : défilement à accroche, sceaux de 64 px.
// Les verrouillés restent visibles (grisés, cadenas) mais ne se choisissent pas : un message dit qui battre d'abord.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Sceau } from './Sceau';
import { battuAccorde, type SceauId } from './sceaux';
import { fr } from './typo';

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
  /** Texte affiché sous le carrousel quand rien n'est verrouillé (description de l'adversaire choisi). */
  legende?: string;
}

export function CarrouselAdversaires<I extends SceauId>({ cartes, choisi, onChoisir, legende }: Props<I>) {
  const liste = useRef<HTMLUListElement>(null);
  const [message, setMessage] = useState('');

  // À l'ouverture, l'adversaire choisi est centré, sans animer la page.
  useEffect(() => {
    const el = liste.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    const ul = liste.current;
    if (el && ul) ul.scrollLeft = el.offsetLeft - (ul.clientWidth - el.offsetWidth) / 2;
  }, []);

  function toucher(c: CarteAdversaire<I>) {
    if (!c.ouvert) { setMessage(fr(`Bats d'abord ${c.requis ?? 'le précédent'} pour affronter ${c.nom}.`)); return; }
    setMessage('');
    onChoisir(c.id);
  }

  // Flèches gauche et droite : passer d'une carte à l'autre (Tab marche aussi).
  function clavier(e: KeyboardEvent<HTMLUListElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const boutons = [...(liste.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const i = boutons.indexOf(document.activeElement as HTMLButtonElement);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? boutons.length - 1 : Math.min(boutons.length - 1, Math.max(0, i + (e.key === 'ArrowRight' ? 1 : -1)));
    e.preventDefault();
    boutons[j]?.focus();
    boutons[j]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }

  return (
    <>
      <ul className="carrousel" ref={liste} aria-label="Adversaires, du plus facile au plus fort" onKeyDown={clavier}>
        {cartes.map(c => {
          const etat = !c.ouvert ? ', verrouillé' : c.battu ? `, ${battuAccorde(c.id)}` : '';
          return (
            <li key={c.id}>
              <button className={`carte${c.ouvert ? '' : ' verrou'}`} aria-pressed={c.id === choisi} aria-disabled={!c.ouvert || undefined}
                aria-label={`${c.nom}, ${c.rang}${etat}`} onClick={() => toucher(c)}>
                <Sceau id={c.id} taille={64} verrouille={!c.ouvert} battu={c.battu} />
                <b>{c.nom}</b>
                <small>{c.rang}</small>
              </button>
            </li>
          );
        })}
      </ul>
      <p className={`carrousel-legende small${message ? ' alerte' : ''}`} aria-live="polite">{message || legende}</p>
    </>
  );
}
