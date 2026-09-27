// Paliers déjà fêtés (issue #103) : la micro-fête en or d'un palier complet ne se joue qu'une fois.
export const FETES_KEY = 'go.paliers-fetes.v1';

/** Paliers complets pas encore fêtés. */
export function aFeter(ps: { id: string; complet: boolean }[], deja: unknown): string[] {
  const vus = new Set(Array.isArray(deja) ? deja.filter((x): x is string => typeof x === 'string') : []);
  return ps.filter(p => p.complet && !vus.has(p.id)).map(p => p.id);
}
