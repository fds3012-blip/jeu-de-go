// #509 (lot L1, n° 2) : ce qui compose le total d'XP de la carte de fin, en une ligne courte sous la pastille.
import { t } from '../content/i18n';
import { fr } from './typo';
import type { XpSeance } from './xpSeance';

export function DetailXp({ xp }: { xp: XpSeance }) {
  const { bonus, objectif } = xp;
  if (!bonus && !objectif) return null;
  const texte = bonus && objectif ? t('xp.bonusObjectif', { bonus, objectif })
    : bonus ? t('xp.bonus', { bonus }) : t('xp.objectif', { objectif });
  return <p className="rejeu-fin-detail">{fr(texte)}</p>;
}
