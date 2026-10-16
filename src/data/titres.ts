// Titres mensuels (#561) : lecture de SES titres dans `titres_joueurs` (RLS : un joueur ne lit que ses lignes).
// Écrits par le serveur seul (`calculer_titres_mensuels`, pg_cron du 1er du mois) ; jamais de ligne sous le garde-fou des
// 200 joueurs actifs. Les titres d'un autre joueur passent par `titres_du_joueur` (profil public, #560), pas par ici.
import { lireTitres, type TitreDuMois } from '../app/titres';
import type { Db } from './supabase';

/** Ses 3 derniers titres, du plus récent au plus ancien ; [] en cas d'erreur (rien à montrer, rien à fêter). */
export async function chargerMesTitres(db: Db, userId: string): Promise<TitreDuMois[]> {
  const { data, error } = await db.from('titres_joueurs').select('mois, titre').eq('user_id', userId)
    .order('mois', { ascending: false }).limit(3);
  return error ? [] : lireTitres(data);
}
