// Partager l'app (#521) : feuille native du téléphone (Web Share API), sinon copie du texte et du lien.
// Mesure `app_partagee` (`depuis`, `methode`, `abandon`) ; rien quand la copie échoue (le lien est alors montré).
import { EVENTS, track } from '../data/analytics';
import { langue } from '../content/i18n';
import { tp } from '../content/i18n/partage';
import { lienApp, type DepuisPartage } from './partageApp';

/** '' : partagé ou feuille fermée ; `copie` : lien copié ; `manuel` : copie impossible, lien à montrer. */
export type EtatPartageApp = '' | 'copie' | 'manuel';

/** Feuille native, sinon copie. Mesure `app_partagee` ; rien n'est envoyé si la copie échoue (lien montré). */
export async function partagerApp(depuis: DepuisPartage): Promise<EtatPartageApp> {
  const url = lienApp(langue());
  const texte = tp('app.texte');
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: tp('app.titre'), text: texte, url });
      track(EVENTS.appPartagee, { depuis, methode: 'natif' });
      return '';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        track(EVENTS.appPartagee, { depuis, methode: 'natif', abandon: true });
        return '';
      }
      // Autre refus (permission, contexte) : on passe à la copie.
    }
  }
  try {
    await navigator.clipboard.writeText(`${texte} ${url}`);
    track(EVENTS.appPartagee, { depuis, methode: 'copie' });
    return 'copie';
  } catch {
    return 'manuel';
  }
}

