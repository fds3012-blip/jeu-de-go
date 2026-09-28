// Données des sceaux partagées par les composants (src/ui/Sceau.tsx, src/ui/Carrousel.tsx).
import { t } from '../content/i18n';

export type SceauId = 'pomme' | 'caillou' | 'bambou' | 'renard' | 'riviere' | 'tigre' | 'montagne' | 'dragon' | 'sensei' | 'mochi';

/** Adversaires au féminin (accord de « battue »). */
const FEMININ = new Set<SceauId>(['pomme', 'riviere', 'montagne']);
/** « battu » ou « battue », dans la langue de l'interface (#167 : « beaten » en anglais). */
export const battuAccorde = (id: SceauId) => t(FEMININ.has(id) ? 'sceau.battue' : 'sceau.battu');
