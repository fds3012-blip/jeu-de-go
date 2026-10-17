// Progression du téléchargement du réseau KataGo pour un écran (#475) : « 2,1 / 3,8 Mo ».
// Un rendu au plus par dixième de mégaoctet (la valeur affichée), rien quand le réseau vient du cache.
import { useEffect, useState } from 'react';
import { ecouterKataGo, type KataGoInfo } from '../engine';
import { formatMo } from '../engine/katago/prechargement';
import { langue } from '../content/i18n';

export interface ProgressionAffichee { recu: string; total: string }

/** Progression à afficher pour cet état de KataGo, ou `null` (pas de téléchargement en cours). */
export function progressionAffichee(i: KataGoInfo, l: 'fr' | 'en' = 'fr'): ProgressionAffichee | null {
  const p = i.progression;
  if (!p || !(i.state === 'chargement' || i.prechargement === 'en-cours') || p.total <= 0 || p.recu >= p.total) return null;
  return { recu: formatMo(p.recu, l), total: formatMo(p.total, l) };
}

/** Suit le téléchargement tant que `actif` (écran en attente de KataGo). */
export function useProgressionKataGo(actif: boolean): ProgressionAffichee | null {
  const [p, setP] = useState<ProgressionAffichee | null>(null);
  useEffect(() => {
    if (!actif) { setP(null); return; }
    let cle = '';
    return ecouterKataGo(i => {
      const a = progressionAffichee(i, langue());
      const k = a ? `${a.recu}/${a.total}` : '';
      if (k !== cle) { cle = k; setP(a); }
    });
  }, [actif]);
  return p;
}

/**
 * #584 : l'IA se prépare-t-elle pour le coup de l'ordi ? `null` si KataGo n'est pas en train de démarrer (prêt, inactif,
 * indisponible) ; sinon la progression du téléchargement, ou `{}` pendant la lecture du cache et le démarrage.
 */
export function preparationIA(i: KataGoInfo, l: 'fr' | 'en' = 'fr'): ProgressionAffichee | Record<string, never> | null {
  if (i.state !== 'chargement') return null;
  return progressionAffichee(i, l) ?? {};
}

/** Suit la préparation de KataGo tant que `actif` (l'ordi, qui joue avec KataGo, doit jouer). Un rendu par dixième de Mo. */
export function usePreparationIA(actif: boolean): ProgressionAffichee | Record<string, never> | null {
  const [p, setP] = useState<ProgressionAffichee | Record<string, never> | null>(null);
  useEffect(() => {
    if (!actif) { setP(null); return; }
    let cle = '';
    return ecouterKataGo(i => {
      const a = preparationIA(i, langue());
      const k = a === null ? '' : 'recu' in a ? `${a.recu}/${a.total}` : '…';
      if (k !== cle) { cle = k; setP(a); }
    });
  }, [actif]);
  return p;
}
