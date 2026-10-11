// Partie de découverte (#524) : la partie légère que l'accueil et Apprendre lisent (clé locale, partie finie ou en
// cours), sans le scénario ni ses textes, qui arrivent avec l'écran (docs/architecture/chargement-initial.md, #513).

/** Clé locale : moment atteint et partie finie (politique de confidentialité, section 3.1). */
export const DECOUVERTE_KEY = 'go.decouverte.v1';

/** État montré sur la carte d'Apprendre : jamais commencée, en cours (reprise), ou déjà menée au bout. */
export type EtatDecouverte = 'nouvelle' | 'encours' | 'finie';

export function etatDecouverte(brut: unknown): EtatDecouverte {
  if (!brut || typeof brut !== 'object') return 'nouvelle';
  const { etape, fini } = brut as { etape?: unknown; fini?: unknown };
  if (fini === true) return 'finie';
  return typeof etape === 'number' && etape > 0 ? 'encours' : 'nouvelle';
}
