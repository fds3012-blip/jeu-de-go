// Validation du pseudo, identique aux règles de la base (profils_joueurs + pseudo_unique_sans_casse) :
// 3 à 24 caractères, lettres sans accent, chiffres, « _ » et « - ». L'unicité (sans tenir compte
// des majuscules) est garantie par la base : voir usernameErrorFromDb.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
const PATTERN = /^[A-Za-z0-9_-]+$/;

export type UsernameCheck = { ok: true; value: string } | { ok: false; error: string };

export function normalizeUsername(raw: string): string {
  return raw.trim();
}

export function validateUsername(raw: string): UsernameCheck {
  const value = normalizeUsername(raw);
  if (value.length < USERNAME_MIN) return { ok: false, error: `Au moins ${USERNAME_MIN} caractères.` };
  if (value.length > USERNAME_MAX) return { ok: false, error: `${USERNAME_MAX} caractères au maximum.` };
  if (!PATTERN.test(value)) return { ok: false, error: 'Lettres sans accent, chiffres, _ et - seulement.' };
  return { ok: true, value };
}

/** Traduit une erreur Postgres renvoyée à l'enregistrement du pseudo en message pour le joueur. */
export function usernameErrorFromDb(code: string | undefined): string {
  if (code === '23505') return 'Ce pseudo est déjà pris. Essaie-en un autre.';
  if (code === '23514') return 'Ce pseudo n’est pas valide.';
  return 'Impossible d’enregistrer ton pseudo. Réessaie.';
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isEmail(raw: string): boolean {
  return EMAIL.test(raw.trim());
}
