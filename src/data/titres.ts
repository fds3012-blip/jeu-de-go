// Titres mensuels (#561) : lecture de SES titres dans `titres_joueurs` (RLS : un joueur ne lit que ses lignes).
// Écrits par le serveur seul (`calculer_titres_mensuels`, pg_cron du 1er du mois) ; jamais de ligne sous le garde-fou des
// 200 joueurs actifs. Les titres d'un autre joueur passent par `titres_du_joueur` (profil public, #560), pas par ici.
import { useEffect, useState } from 'react';
import { lireTitres, titreDuMoisDernier, type TitreDuMois } from '../app/titres';
import type { Db } from './supabase';

/** Ses 3 derniers titres, du plus récent au plus ancien ; [] en cas d'erreur (rien à montrer, rien à fêter). */
export async function chargerMesTitres(db: Db, userId: string): Promise<TitreDuMois[]> {
  const { data, error } = await db.from('titres_joueurs').select('mois, titre').eq('user_id', userId)
    .order('mois', { ascending: false }).limit(3);
  return error ? [] : lireTitres(data);
}

/** Le titre du mois dernier du joueur connecté, ou null (pas de compte, pas de titre, garde-fou non atteint). */
export function useTitreDuMoisDernier(db: Db | null, userId: string | undefined): TitreDuMois | null {
  const [titre, setTitre] = useState<{ cle: string; titre: TitreDuMois | null } | null>(null);
  useEffect(() => {
    if (!db || !userId) return;
    let vivant = true;
    void chargerMesTitres(db, userId).then(t => { if (vivant) setTitre({ cle: userId, titre: titreDuMoisDernier(t) }); });
    return () => { vivant = false; };
  }, [db, userId]);
  return titre && titre.cle === userId ? titre.titre : null;
}
