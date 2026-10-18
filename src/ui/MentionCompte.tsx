// #343 : mention « Avec un compte » sous une leçon qui en demande un (carte de la prochaine leçon, page d'un thème).
// Une silhouette, pas un cadenas : la leçon reste touchable et mène à la création de compte. Le mot dit le verrou.
import { t } from '../content/i18n/secondaires';

export const MentionCompte = () => (
  <span className="pas-compte">
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="8.5" r="3.5" /><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" /></svg>
    {t('apprendre.compte')}
  </span>
);
