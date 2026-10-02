// Liste des amis (issue #359), partagée par l'écran « Mes amis » (Amis.tsx) et la pastille du Profil.
import { useCallback, useEffect, useState } from 'react';
import { mesAmis, type Ami } from '../data/amis';
import type { Db } from '../data/supabase';
import { useOnline } from './hooks';

export type ListeAmis = { etat: 'chargement' } | { etat: 'erreur' } | { etat: 'pret'; amis: Ami[] };

/** Amis et demandes, relus à la demande (`recharger`). Rien sans service ou hors ligne. */
export function useAmis(db: Db | null, actif: boolean) {
  const online = useOnline();
  const [liste, setListe] = useState<ListeAmis>({ etat: 'chargement' });
  const [essai, setEssai] = useState(0);
  useEffect(() => {
    if (!db || !actif || !online) return;
    let vivant = true;
    mesAmis(db).then(r => { if (vivant) setListe(r.ok ? { etat: 'pret', amis: r.value } : { etat: 'erreur' }); });
    return () => { vivant = false; };
  }, [db, actif, online, essai]);
  const recharger = useCallback(() => setEssai(n => n + 1), []);
  return { liste, recharger, online };
}

/** Demandes d'ami reçues, pour la pastille de la ligne « Mes amis » du Profil. 0 sans compte, hors ligne ou en erreur. */
export function useDemandesRecues(db: Db | null, actif: boolean): number {
  const { liste } = useAmis(db, actif);
  return actif && liste.etat === 'pret' ? liste.amis.filter(a => a.etat === 'recue').length : 0;
}
