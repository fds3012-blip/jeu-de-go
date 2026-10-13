// Compte suspendu par l'équipe (#531, supabase/migrations/20261013120100_moderation.sql). Le serveur refuse avec le
// code JGU01 les files d'attente (direct et lente), les défis, les demandes d'ami et les messages en partie ; le
// détail porte la fin de la suspension (ISO 8601, vide si elle est sans fin). L'adversaire d'un joueur suspendu lit
// le refus habituel « Ce joueur n'est pas disponible » (JGB01) : rien n'est dit de la suspension d'un autre.
// Contre l'ordi, leçons et problèmes ne passent pas par le serveur : rien ne change.

export const CODE_SUSPENDU = 'JGU01';

/** Vrai si l'erreur de Supabase est le refus « compte suspendu ». */
export function estSuspendu(erreur: unknown): boolean {
  return (erreur as { code?: unknown } | null | undefined)?.code === CODE_SUSPENDU;
}

/** Fin de la suspension lue dans le refus, ou null (sans fin, ou détail illisible). */
export function finSuspension(erreur: unknown): Date | null {
  if (!estSuspendu(erreur)) return null;
  const detail = (erreur as { details?: unknown }).details;
  if (typeof detail !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(detail)) return null;
  const d = new Date(detail);
  return Number.isNaN(d.getTime()) ? null : d;
}
