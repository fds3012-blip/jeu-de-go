// Données des sceaux partagées par les composants (src/ui/Sceau.tsx, src/ui/Carrousel.tsx).

export type SceauId = 'pomme' | 'caillou' | 'bambou' | 'renard' | 'riviere' | 'tigre' | 'montagne' | 'dragon' | 'sensei' | 'mochi';

/** Adversaires au féminin (accord de « battue »). */
const FEMININ = new Set<SceauId>(['pomme', 'riviere', 'montagne']);
export const battuAccorde = (id: SceauId) => (FEMININ.has(id) ? 'battue' : 'battu');
