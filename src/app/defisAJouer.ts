// Compteur de l'accueil (#338), à part de l'écran des défis (src/app/Defis.tsx) : l'accueil l'affiche
// sans charger le code des défis, chargé à la demande (#323, src/app/ecrans.ts).
import { useEffect, useState } from 'react';
import { mesDefis } from '../data/defi';
import type { Db } from '../data/supabase';
import { aJouer, vueDefi } from './defiAmi';
import { useOnline } from './hooks';

/** Nombre de défis où c'est au joueur d'agir, pour le lien de l'accueil. 0 sans session, hors ligne ou en erreur. */
export function useDefisAJouer(db: Db | null, userId: string | undefined, actif: boolean): number {
  const online = useOnline();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!db || !userId || !online || !actif) return;
    let vivant = true;
    mesDefis(db, userId).then(r => { if (vivant) setN(r.ok ? aJouer(r.value.map(d => vueDefi(d.partie, d.defi, userId, Date.now(), d.resultat))) : 0); });
    return () => { vivant = false; };
  }, [db, userId, online, actif]);
  return userId ? n : 0;
}
