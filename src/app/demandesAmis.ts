// Demandes d'ami reçues (#359), pour la pastille de l'onglet Profil, l'élément « À faire » (#367, aFaire.ts) et la
// ligne « Mes amis ». Crochet léger du JS initial : la couche amis (src/data/amis.ts) arrive après le premier écran,
// par import dynamique, comme le calcul « À faire » (useAFaire.ts ; budget du JS initial, scripts/budget-bundle.mjs).
import { useEffect, useState } from 'react';
import type { Db } from '../data/supabase';
import { useOnline } from './hooks';
import { premierEcran } from '../premierEcran';

/** Nombre de demandes reçues, relu à chaque changement de `cle` (écran affiché). 0 sans compte, hors ligne ou en erreur. */
export function useDemandesAmis(db: Db | null, actif: boolean, cle: string): number {
  const online = useOnline();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!db || !actif || !online) return;
    let vivant = true;
    premierEcran()
      .then(() => import('../data/amis'))
      .then(m => m.mesAmis(db))
      .then(r => { if (vivant) setN(r.ok ? r.value.filter(a => a.etat === 'recue').length : 0); }, () => { /* hors ligne : pas de pastille */ });
    return () => { vivant = false; };
  }, [db, actif, online, cle]);
  return actif && online ? n : 0;
}
